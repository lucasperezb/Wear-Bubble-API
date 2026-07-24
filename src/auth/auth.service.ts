import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import bcrypt from 'bcryptjs';
import {
  createHash,
  createHmac,
  randomInt,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';
import { Response } from 'express';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { AppConfigService } from '../config/config.service';
import { ProfileEntity } from '../account/entities/profile.entity';
import { LeadEntity } from '../leads/entities/lead.entity';
import { UserEntity } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { UserRecord } from '../users/users.types';
import { AuthTokenService } from './auth-token.service';
import { EmailService } from '../email/email.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RequestLoginCodeDto } from './dto/request-login-code.dto';
import { VerifyLoginCodeDto } from './dto/verify-login-code.dto';
import { LoginCodeEntity } from './entities/login-code.entity';

const sha256 = (value: string) =>
  createHash('sha256').update(value).digest('hex');

@Injectable()
export class AuthService {
  constructor(
    private readonly config: AppConfigService,
    private readonly tokens: AuthTokenService,
    private readonly emailSender: EmailService,
    private readonly users: UsersService,
    @InjectRepository(ProfileEntity)
    private readonly profiles: Repository<ProfileEntity>,
    @InjectRepository(LeadEntity)
    private readonly leads: Repository<LeadEntity>,
    @InjectRepository(LoginCodeEntity)
    private readonly loginCodes: Repository<LoginCodeEntity>,
  ) {}

  async register(dto: RegisterDto, res: Response) {
    const name = String(dto?.name || '').trim();
    const email = String(dto?.email || '')
      .trim()
      .toLowerCase();
    const password = String(dto?.password || '');
    const marketing = Boolean(dto?.marketing);
    if (!name || !email || password.length < 6)
      throw new BadRequestException(
        'Nome, e-mail e senha (min. 6 caracteres) sao obrigatorios.',
      );
    if (await this.users.existsByEmail(email)) {
      throw new ConflictException('Ja existe uma conta com este e-mail.');
    }
    const uid = randomUUID();
    const role: UserRecord['role'] =
      email === this.config.managerEmail ? 'manager' : 'customer';
    const user = await this.users.save(
      this.users.create({
        uid,
        email,
        passwordHash: await bcrypt.hash(password, 10),
        role,
        marketingOptIn: marketing,
        emailVerified: false,
      }),
    );
    await Promise.all([
      this.profiles.save(
        this.profiles.create({
          uid,
          name,
          email,
          taxId: '',
          phone: '',
        }),
      ),
      marketing && !(await this.leads.existsBy({ hash: sha256(email) }))
        ? this.leads.save(
            this.leads.create({
              hash: sha256(email),
              email,
              consent: true,
              source: 'registro',
              joinedAt: new Date(),
              userUid: uid,
            }),
          )
        : Promise.resolve(),
    ]);
    this.tokens.clearCookie(res);
    await this.issueLoginCode(user, 'verification');
    return { verificationRequired: true, email };
  }

  async login(dto: LoginDto, res: Response) {
    const email = String(dto?.email || '')
      .trim()
      .toLowerCase();
    const password = String(dto?.password || '');
    const user = await this.users.findByEmail(email);
    if (!user || !(await bcrypt.compare(password, user.passwordHash)))
      throw new UnauthorizedException('E-mail ou senha incorretos.');
    if (!user.emailVerified) {
      this.tokens.clearCookie(res);
      await this.issueLoginCode(user, 'verification');
      return { verificationRequired: true, email: user.email };
    }
    const profile = await this.profiles.findOneBy({ uid: user.uid });
    this.tokens.setCookie(res, this.tokens.sign(user));
    return {
      uid: user.uid,
      email: user.email,
      role: user.role,
      name: profile?.name || '',
      emailVerified: true,
    };
  }

  async requestLoginCode(dto: RequestLoginCodeDto) {
    const email = this.normalizeEmail(dto.email);
    const user = await this.users.findByEmail(email);
    if (!user) return { ok: true, expiresIn: 600 };
    return this.issueLoginCode(
      user,
      user.emailVerified ? 'login' : 'verification',
    );
  }

  async verifyLoginCode(dto: VerifyLoginCodeDto, res: Response) {
    const email = this.normalizeEmail(dto.email);
    const user = await this.users.findByEmail(email);
    if (!user) throw new UnauthorizedException('Codigo invalido ou expirado.');

    const loginCode = await this.loginCodes.findOne({
      where: {
        userUid: user.uid,
        usedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
      order: { createdAt: 'DESC' },
    });
    if (!loginCode || loginCode.attempts >= 5)
      throw new UnauthorizedException('Codigo invalido ou expirado.');

    const received = Buffer.from(this.hashLoginCode(user.uid, dto.code));
    const expected = Buffer.from(loginCode.codeHash);
    const valid =
      received.length === expected.length &&
      timingSafeEqual(received, expected);
    loginCode.attempts += 1;
    if (valid || loginCode.attempts >= 5) loginCode.usedAt = new Date();
    await this.loginCodes.save(loginCode);
    if (!valid) throw new UnauthorizedException('Codigo invalido ou expirado.');

    if (!user.emailVerified) {
      user.emailVerified = true;
      await this.users.save(user);
    }
    const profile = await this.profiles.findOneBy({ uid: user.uid });
    this.tokens.setCookie(res, this.tokens.sign(user));
    return {
      uid: user.uid,
      email: user.email,
      role: user.role,
      name: profile?.name || '',
      emailVerified: true,
    };
  }

  logout(res: Response) {
    this.tokens.clearCookie(res);
    return { ok: true };
  }

  async me(uid: string, email: string, role: UserRecord['role']) {
    const profile = await this.profiles.findOneBy({ uid });
    return { uid, email, role, name: profile?.name || '', emailVerified: true };
  }

  passwordReset(emailValue: string) {
    const email = String(emailValue || '')
      .trim()
      .toLowerCase();
    if (email)
      console.log(`[auth] pedido de redefinicao de senha para ${email}`);
    return { ok: true };
  }

  private normalizeEmail(value: string) {
    return String(value || '')
      .trim()
      .toLowerCase();
  }

  private hashLoginCode(uid: string, code: string) {
    return createHmac('sha256', this.config.loginCodeSecret)
      .update(`${uid}:${code}`)
      .digest('hex');
  }

  private async issueLoginCode(
    user: UserEntity,
    purpose: 'login' | 'verification',
  ) {
    const latest = await this.loginCodes.findOne({
      where: { userUid: user.uid },
      order: { createdAt: 'DESC' },
    });
    if (
      latest &&
      Date.now() - latest.createdAt.getTime() < 60_000 &&
      !latest.usedAt
    ) {
      return { ok: true, expiresIn: 600 };
    }

    await this.loginCodes.update(
      { userUid: user.uid, usedAt: IsNull() },
      { usedAt: new Date() },
    );
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const loginCode = await this.loginCodes.save(
      this.loginCodes.create({
        userUid: user.uid,
        codeHash: this.hashLoginCode(user.uid, code),
        expiresAt: new Date(Date.now() + 10 * 60_000),
        attempts: 0,
        usedAt: null,
      }),
    );
    try {
      await this.emailSender.sendLoginCode(user.email, code, purpose);
    } catch (error) {
      loginCode.usedAt = new Date();
      await this.loginCodes.save(loginCode);
      throw error;
    }
    return { ok: true, expiresIn: 600 };
  }
}
