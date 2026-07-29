import { Injectable } from '@nestjs/common';
import { Response } from 'express';
import jwt from 'jsonwebtoken';
import { AppConfigService } from '../config/config.service';
import { UserRecord } from '../users/users.types';

@Injectable()
export class AuthTokenService {
  constructor(private readonly env: AppConfigService) {}

  sign(user: Pick<UserRecord, 'uid' | 'email' | 'role'>) {
    return jwt.sign(
      { uid: user.uid, email: user.email, role: user.role },
      this.env.jwtSecret,
      { expiresIn: '30d' },
    );
  }

  verify(token: string) {
    const payload = jwt.verify(token, this.env.jwtSecret);
    if (
      typeof payload === 'string' ||
      typeof payload.uid !== 'string' ||
      typeof payload.email !== 'string' ||
      !['customer', 'manager'].includes(String(payload.role))
    ) {
      throw new Error('Token de autenticacao invalido.');
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
