import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { PaymentsService } from './payments.service';

describe('PaymentsService.cancelOrder', () => {
  const orderRow = {
    id: '67c53525-2a4c-496d-9844-d1326376f134',
    number: 'B00001',
    status: 'paid',
    gateway: 'pagbank',
    pagbankPaymentId: 'CHAR_TESTE',
    total: 49.9,
  };
  const orderRecord = {
    ...orderRow,
    date: Date.now(),
    customerId: 'customer',
    method: 'Pix',
    coupon: null,
    couponPct: 0,
    shipStage: 1,
    items: [
      { pid: 1, name: 'Top', size: 'P', color: 'Preto', qty: 2, price: 24.95 },
    ],
  };
  let orders: {
    findEntity: jest.Mock;
    toRecord: jest.Mock;
    saveEntity: jest.Mock;
  };
  let products: {
    findEntity: jest.Mock;
    saveEntity: jest.Mock;
  };
  let service: PaymentsService;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    orders = {
      findEntity: jest.fn().mockResolvedValue({ ...orderRow }),
      toRecord: jest
        .fn()
        .mockImplementation((row) => ({ ...orderRecord, status: row.status })),
      saveEntity: jest.fn().mockResolvedValue(undefined),
    };
    products = {
      findEntity: jest.fn().mockResolvedValue({ id: 1, stock: 3 }),
      saveEntity: jest.fn().mockResolvedValue(undefined),
    };
    service = new PaymentsService(
      {
        pagbankToken: 'sandbox-token',
        pagbankBaseUrl: 'https://sandbox.api.pagseguro.com',
        pagbankEnv: 'sandbox',
      } as never,
      orders as never,
      products as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('cancels the charge, restores stock and updates the order', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'CHAR_TESTE',
          status: 'CANCELED',
          amount: { value: 4990, currency: 'BRL' },
        }),
        { status: 201, headers: { 'content-type': 'application/json' } },
      ),
    );

    const result = await service.cancelOrder(orderRow.id);

    expect(fetch).toHaveBeenCalledWith(
      'https://sandbox.api.pagseguro.com/charges/CHAR_TESTE/cancel',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ amount: { value: 4990 } }),
      }),
    );
    expect(products.saveEntity).toHaveBeenCalledWith(
      expect.objectContaining({ stock: 5 }),
    );
    expect(orders.saveEntity).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'canceled' }),
    );
    expect(result.cancellation).toEqual(
      expect.objectContaining({
        responseStatus: 201,
        chargeId: 'CHAR_TESTE',
        status: 'CANCELED',
      }),
    );
  });

  it('keeps the order paid when PagBank rejects the cancellation', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          error_messages: [{ description: 'Charge cannot be canceled' }],
        }),
        { status: 400, headers: { 'content-type': 'application/json' } },
      ),
    );

    await expect(service.cancelOrder(orderRow.id)).rejects.toThrow(
      ServiceUnavailableException,
    );
    expect(products.saveEntity).not.toHaveBeenCalled();
    expect(orders.saveEntity).not.toHaveBeenCalled();
  });
});
