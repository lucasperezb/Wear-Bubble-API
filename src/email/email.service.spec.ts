import { AppConfigService } from '../config/config.service';
import { OrderRecord } from '../orders/order.types';
import { EmailService } from './email.service';

describe('EmailService order updates', () => {
  const order: OrderRecord = {
    id: 'order-1',
    customerId: 'customer-1',
    number: 'B00123',
    date: new Date('2026-08-05T14:30:00-03:00').getTime(),
    items: [
      {
        pid: 1,
        name: 'Legging Compressão Rose',
        color: 'Rose',
        size: 'M',
        qty: 2,
        price: 249.9,
      },
    ],
    total: 499.8,
    method: 'PIX',
    coupon: null,
    couponPct: 0,
    status: 'paid',
    shipStage: 3,
    delivery: {
      name: 'Maria da Silva',
      email: 'maria@example.com',
      taxId: '00000000000',
      phone: '11999999999',
      cep: '06543-645',
      street: 'Rua das Flores',
      neighborhood: 'Centro',
      number: '123',
      reference: 'Casa rosa',
      city: 'Barueri',
      state: 'SP',
    },
    shipping: {
      serviceId: 1,
      name: 'PAC',
      company: 'Correios',
      price: 0,
      deliveryTime: 5,
    },
    tracking: 'BR123456789',
  };

  function setup() {
    const service = new EmailService({
      smtpPassword: '',
      storeUrl: 'https://www.wearbubble.com.br',
    } as AppConfigService);
    const safeSend = jest
      .spyOn(service as never, 'safeSend' as never)
      .mockResolvedValue(undefined as never);
    return { service, safeSend };
  }

  it('detalha produtos, variações, valores, entrega e endereço', async () => {
    const { service, safeSend } = setup();

    await service.sendOrderCreated(order);

    const message = safeSend.mock.calls[0][0] as { content: string };
    expect(message.content).toContain('Legging Compressão Rose');
    expect(message.content).toContain('Cor: Rose');
    expect(message.content).toContain('Tamanho: M');
    expect(message.content).toContain('2 un.');
    expect(message.content.replace(/\u00a0/g, ' ')).toContain('R$ 499,80');
    expect(message.content).toContain('Correios · PAC · até 5 dias úteis');
    expect(message.content).toContain('Rua das Flores');
    expect(message.content).toContain('https://www.wearbubble.com.br/conta');
  });

  it('usa assunto, etapa e rastreio específicos no envio', async () => {
    const { service, safeSend } = setup();

    await service.sendShippingUpdate(order);

    const message = safeSend.mock.calls[0][0] as {
      subject: string;
      content: string;
    };
    expect(message.subject).toBe('Pedido enviado · B00123');
    expect(message.content).toContain('Seu pedido foi enviado');
    expect(message.content).toContain('BR123456789');
    expect(message.content).toContain('transportadora');
  });
});
