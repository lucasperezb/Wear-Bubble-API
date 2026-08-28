import { Injectable } from '@nestjs/common';
import { Response } from 'express';
import jwt from 'jsonwebtoken';
import { AppConfigService } from '../config/config.service';
import { UsersService } from '../users/users.service';
import { UserRecord } from '../users/users.types';

@Injectable()
export class AuthTokenService {
  constructor(
    private readonly env: AppConfigService,
    private readonly users: UsersService,
  ) {}

  sign(user: Pick<UserRecord, 'uid' | 'email' | 'role' | 'tokenVersion'>) {
    return jwt.sign(
      {
        uid: user.uid,
        email: user.email,
        role: user.role,
        tv: user.tokenVersion,
      },
      this.env.jwtSecret,
      { expiresIn: '30d' },
    );
  }

  async verify(token: string) {
    const payload = jwt.verify(token, this.env.jwtSecret);
    if (
      typeof payload === 'string' ||
      typeof payload.uid !== 'string' ||
      typeof payload.email !== 'string' ||
      !['customer', 'manager'].includes(String(payload.role)) ||
      typeof payload.tv !== 'number'
    ) {
      throw new Error('Token de autenticação inválido.');
    }
    // Password reset / a future "sign out everywhere" bumps tokenVersion,
    // instantly invalidating every token issued before that point instead
    // of letting a stolen 30-day token keep working after the user reset
    // their password.
    const user = await this.users.findByUid(payload.uid);
    if (!user || user.tokenVersion !== payload.tv) {
      throw new Error('Sessão expirada. Faça login novamente.');
    }
    return {
      uid: payload.uid,
      email: payload.email,
      role: payload.role as UserRecord['role'],
    };
  }

  setCookie(res: Response, token: string) {
    res.cookie('bubble_token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
  }

  clearCookie(res: Response) {
    res.clearCookie('bubble_token', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    });
  }
}
