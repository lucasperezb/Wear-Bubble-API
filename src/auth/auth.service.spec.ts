import bcrypt from 'bcryptjs';
import { BadRequestException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { AuthService } from './auth.service';

const hash = (value: string) =>
  createHash('sha256').update(value).digest('hex');

describe('AuthService password reset', () => {
  function setup() {
    const config = {
      storeUrl: 'https://wearbubble.com.br/',
      loginCodeSecret: 'test-secret',
    };
    const emailSender = { sendPasswordReset: jest.fn() };
    const users = {
      findByEmail: jest.fn(),
      findByUid: jest.fn(),
      save: jest.fn((value) => Promise.resolve(value)),
    };
    const passwordResetTokens = {
      findOne: jest.fn(),
      update: jest.fn(),
      create: jest.fn((value) => value),
      save: jest.fn((value) => Promise.resolve({ id: 'reset-id', ...value })),
      delete: jest.fn(),
    };
    const service = new AuthService(
      config as never,
      {} as never,
      emailSender as never,
      users as never,
      {} as never,
      {} as never,
      {} as never,
      passwordResetTokens as never,
    );
    return { service, emailSender, users, passwordResetTokens };
  }

  it('creates a one-time token and sends the reset link', async () => {
    const { service, emailSender, users, passwordResetTokens } = setup();
    users.findByEmail.mockResolvedValue({
      uid: 'user-id',
      email: 'cliente@exemplo.com',
    });
    passwordResetTokens.findOne.mockResolvedValue(null);

    const result = await service.requestPasswordReset('CLIENTE@EXEMPLO.COM');

    expect(result.ok).toBe(true);
    expect(emailSender.sendPasswordReset).toHaveBeenCalledTimes(1);
    const [, resetUrl] = emailSender.sendPasswordReset.mock.calls[0];
    const url = new URL(String(resetUrl));
    const token = url.searchParams.get('token') || '';
    expect(url.origin + url.pathname).toBe(
      'https://wearbubble.com.br/redefinir-senha',
    );
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    expect(passwordResetTokens.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userUid: 'user-id',
        tokenHash: hash(token),
        usedAt: null,
      }),
    );
  });

  it('does not reveal whether the e-mail is registered', async () => {
    const { service, emailSender, users, passwordResetTokens } = setup();
    users.findByEmail.mockResolvedValue(null);

    const result = await service.requestPasswordReset('naoexiste@exemplo.com');

    expect(result.ok).toBe(true);
    expect(emailSender.sendPasswordReset).not.toHaveBeenCalled();
    expect(passwordResetTokens.save).not.toHaveBeenCalled();
  });

  it('replaces the password and consumes every active reset token', async () => {
    const { service, users, passwordResetTokens } = setup();
    const token = 'a'.repeat(64);
    const user = {
      uid: 'user-id',
      email: 'cliente@exemplo.com',
      passwordHash: 'old-hash',
      emailVerified: false,
    };
    passwordResetTokens.findOne.mockResolvedValue({
      id: 'reset-id',
      userUid: user.uid,
      tokenHash: hash(token),
      usedAt: null,
    });
    users.findByUid.mockResolvedValue(user);

    const result = await service.confirmPasswordReset(token, 'nova-senha');

    expect(result).toEqual({
      ok: true,
      message: 'Senha redefinida com sucesso.',
    });
    expect(await bcrypt.compare('nova-senha', user.passwordHash)).toBe(true);
    expect(user.emailVerified).toBe(true);
    expect(passwordResetTokens.update).toHaveBeenCalledWith(
      expect.objectContaining({ userUid: user.uid }),
      expect.objectContaining({ usedAt: expect.any(Date) }),
    );
  });

  it('rejects an expired or already used token', async () => {
    const { service, passwordResetTokens } = setup();
    passwordResetTokens.findOne.mockResolvedValue(null);

    await expect(
      service.confirmPasswordReset('b'.repeat(64), 'nova-senha'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
