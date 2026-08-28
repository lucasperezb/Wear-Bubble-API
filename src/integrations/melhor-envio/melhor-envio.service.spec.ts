import { UnauthorizedException } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import jwt from 'jsonwebtoken';
import {
  MelhorEnvioService,
  shippingStageForEvent,
} from './melhor-envio.service';

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

describe('shippingStageForEvent', () => {
  it('atualiza somente pelas etapas automáticas do Melhor Envio', () => {
    expect(shippingStageForEvent(1, 'order.generated')).toBe(2);
    expect(shippingStageForEvent(2, 'order.posted')).toBe(3);
    expect(shippingStageForEvent(3, 'order.delivered')).toBe(5);
  });

  it('não regride etapa nem altera eventos sem correspondência', () => {
    expect(shippingStageForEvent(3, 'order.generated')).toBe(3);
    expect(shippingStageForEvent(3, 'order.paused')).toBe(3);
  });
});

describe('MelhorEnvioService reverse shipment payload', () => {
  it('omite DCe quando não existe uma chave para a API comunicar a declaração', async () => {
    const shipments = {
      findOne: jest.fn().mockResolvedValue({
        providerOrderId: '9c79c7bb-e365-4d92-8553-255d60bc28d0',
        serviceId: 1,
        volume: { height: 4, width: 20, length: 25, weight: 0.3 },
      }),
    };
    const reverseService = new MelhorEnvioService(
      { melhorEnvioAllowedServices: [1, 2] } as never,
      {} as never,
      shipments as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const request = jest
      .spyOn(reverseService as never, 'authorizedRequest' as never)
      .mockResolvedValue({
        id: '4e129067-2050-4f01-a014-b33ac3c56b84',
      } as never);

    await reverseService.createReverseCart({
      orderId: '8e27c2e8-d821-4fc4-9600-b7a700f50cbc',
      customerEmail: 'cliente@example.com',
      customerPhone: '11999999999',
      insuranceValue: 100,
    });

    const init = request.mock.calls[0][1] as RequestInit;
    const payload = JSON.parse(String(init.body)) as {
      options: Record<string, unknown>;
    };
    expect(payload.options).toEqual({ own_hand: false, receipt: false });
    expect(payload.options).not.toHaveProperty('dce');
  });
});
