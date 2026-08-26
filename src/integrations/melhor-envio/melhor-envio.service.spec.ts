import { UnauthorizedException } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { MelhorEnvioService } from './melhor-envio.service';

describe('MelhorEnvioService security rules', () => {
  const config = {
    jwtSecret: 'test-jwt-secret',
    melhorEnvioClientSecret: 'test-client-secret',
    melhorEnvioAllowedServices: [1, 2],
  };
  const service = new MelhorEnvioService(
    config as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );

  it('accepts a valid Melhor Envio webhook signature', () => {
    const body = Buffer.from('{"event":"order.posted"}');
    const signature = createHmac('sha256', config.melhorEnvioClientSecret)
      .update(body)
      .digest('base64');

    expect(() =>
      service.validateWebhookSignature(body, signature),
    ).not.toThrow();
  });

  it('rejects an invalid Melhor Envio webhook signature', () => {
    expect(() =>
      service.validateWebhookSignature(Buffer.from('{}'), 'invalid'),
    ).toThrow(UnauthorizedException);
  });

  it('accepts the signed webhook registration test payload', async () => {
    const body = Buffer.from('{}');
    const signature = createHmac('sha256', config.melhorEnvioClientSecret)
      .update(body)
      .digest('base64');

    await expect(service.handleWebhook(body, signature)).resolves.toEqual({
      received: true,
      verification: true,
    });
  });

  it('rejects quote tokens for services other than PAC and SEDEX', () => {
    const token = jwt.sign(
      {
        purpose: 'melhor-envio-quote',
        postalCode: '01001000',
        serviceId: 17,
        name: 'Mini Envios',
        company: 'Correios',
        price: 10,
        carrierPrice: 10,
        deliveryTime: 5,
        packages: [
          {
            height: 4,
            width: 20,
            length: 25,
            weight: 0.3,
            insuranceValue: 50,
            products: [{ id: '1', quantity: 1 }],
          },
        ],
      },
      config.jwtSecret,
      { issuer: 'wearbubble' },
    );

    expect(() => service.verifyQuoteToken(token, '01001-000')).toThrow(
      'A cotação de frete expirou. Calcule novamente.',
    );
  });
});
