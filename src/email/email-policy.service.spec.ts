import { BadRequestException } from '@nestjs/common';
import { EmailPolicyService } from './email-policy.service';

const dnsError = (code: string) =>
  Promise.reject(Object.assign(new Error(code), { code }));

describe('EmailPolicyService', () => {
  const setup = (
    resolver: Partial<EmailPolicyService['resolvers'][number]> = {},
  ) => {
    const service = new EmailPolicyService();
    service.resolvers = [
      {
        resolveMx: jest
          .fn()
          .mockResolvedValue([{ exchange: 'mx', priority: 1 }]),
        resolve4: jest.fn().mockResolvedValue(['1.2.3.4']),
        resolve6: jest.fn().mockResolvedValue([]),
        ...resolver,
      },
    ];
    return service;
  };

  it('accepts common providers with mail servers', async () => {
    const service = setup();
    await expect(
      service.assertAcceptable('cliente@gmail.com'),
    ).resolves.toBeUndefined();
    await expect(
      service.assertAcceptable('cliente@uol.com.br'),
    ).resolves.toBeUndefined();
  });

  it('rejects disposable domains and their subdomains', async () => {
    const service = setup();
    await expect(
      service.assertAcceptable('robo@mailinator.com'),
    ).rejects.toThrow('E-mails temporários não são aceitos');
    await expect(
      service.assertAcceptable('robo@abc.mailinator.com'),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects domains that do not exist', async () => {
    const service = setup({
      resolveMx: () => dnsError('ENOTFOUND'),
      resolve4: () => dnsError('ENOTFOUND'),
      resolve6: () => dnsError('ENOTFOUND'),
    });
    await expect(
      service.assertAcceptable('cliente@gmial-errado.com'),
    ).rejects.toThrow('Não encontramos o domínio');
  });

  it('accepts a domain with only an A record (implicit MX)', async () => {
    const service = setup({ resolveMx: () => dnsError('ENODATA') });
    await expect(
      service.assertAcceptable('contato@lojapequena.com.br'),
    ).resolves.toBeUndefined();
  });

  it('falls back to the next DNS when the first one fails', async () => {
    const service = setup({ resolveMx: () => dnsError('ECONNREFUSED') });
    service.resolvers.push({
      resolveMx: () => dnsError('ENOTFOUND'),
      resolve4: () => dnsError('ENOTFOUND'),
      resolve6: () => dnsError('ENOTFOUND'),
    });
    service.resolvers[0].resolve4 = () => dnsError('ECONNREFUSED');
    service.resolvers[0].resolve6 = () => dnsError('ECONNREFUSED');
    await expect(
      service.assertAcceptable('cliente@nao-existe.com.br'),
    ).rejects.toThrow('Não encontramos o domínio');
  });

  it('lets the email through when DNS is unavailable', async () => {
    const service = setup({ resolveMx: () => dnsError('ECONNREFUSED') });
    await expect(
      service.assertAcceptable('cliente@empresa.com.br'),
    ).resolves.toBeUndefined();
  });

  it('rejects malformed addresses', async () => {
    await expect(setup().assertAcceptable('sem-arroba')).rejects.toThrow(
      'Informe um e-mail válido',
    );
  });
});
