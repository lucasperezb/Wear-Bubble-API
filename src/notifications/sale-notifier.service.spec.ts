import { SaleNotifierService } from './sale-notifier.service';

describe('SaleNotifierService', () => {
  const order = {
    id: 'order',
    customerId: 'customer',
    number: 'B00042',
    date: Date.now(),
    method: 'Pix',
    coupon: 'BUBBLE10',
    couponPct: 10,
    status: 'paid' as const,
    shipStage: 1,
    total: 447.18,
    shipping: {
      serviceId: 2,
      name: 'SEDEX',
      company: 'Correios',
      price: 24.9,
      deliveryTime: 3,
    },
    delivery: { city: 'Campinas', state: 'SP' } as never,
    items: [
      {
        pid: 1,
        name: 'Legging Core Run',
        color: 'Preto',
        size: 'M',
        qty: 1,
        price: 110.44,
      },
      {
        pid: 2,
        name: 'Top <Core>',
        color: 'Verde',
        size: 'P',
        qty: 2,
        price: 155.92,
      },
    ],
  };

  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
    jest.restoreAllMocks();
  });

  it('monta a mensagem com peças, valores e total', () => {
    const text = new SaleNotifierService({} as never).saleMessage(order);
    expect(text).toContain('Pedido B00042');
    expect(text).toContain('3 peças');
    expect(text).toContain('1x Legging Core Run (Preto / M)');
    expect(text).toContain('Top &lt;Core&gt;');
    expect(text).toContain('Cupom: BUBBLE10');
    expect(text).toMatch(/Total: R\$\s447,18/);
  });

  it('não chama o Telegram sem configuração', async () => {
    const fetchSpy = jest.fn();
    global.fetch = fetchSpy as never;
    await new SaleNotifierService({
      telegramBotToken: '',
      telegramChatIds: [],
    } as never).notifySale(order);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('envia para cada chat e não lança erro se o Telegram falhar', async () => {
    jest.spyOn(console, 'error').mockImplementation();
    const fetchSpy = jest
      .fn()
      .mockResolvedValueOnce({ ok: true })
      .mockRejectedValueOnce(new Error('offline'));
    global.fetch = fetchSpy as never;
    await expect(
      new SaleNotifierService({
        telegramBotToken: 'TOKEN',
        telegramChatIds: ['1', '-100'],
      } as never).notifySale(order),
    ).resolves.toBeUndefined();
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(fetchSpy.mock.calls[0][0]).toBe(
      'https://api.telegram.org/botTOKEN/sendMessage',
    );
  });
});
