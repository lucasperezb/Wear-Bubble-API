import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { PaymentsService } from './payments.service';

describe('PaymentsService.cancelOrder', () => {
  const orderRow = {
    id: '67c53525-2a4c-496d-9844-d1326376f134',
    number: 'B00001',
    status: 'paid',
    gateway: 'asaas',
    asaasPaymentId: 'pay_TESTE',
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
    releaseStoreCredit: jest.Mock;
  };
  let inventory: {
    restockCanceledOrder: jest.Mock;
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
      releaseStoreCredit: jest.fn().mockResolvedValue(undefined),
    };
    inventory = {
      restockCanceledOrder: jest.fn().mockResolvedValue(undefined),
    };
    service = new PaymentsService(
      {
        asaasApiKey: '$aact_hmlg_test',
        asaasBaseUrl: 'https://api-sandbox.asaas.com/v3',
        asaasEnv: 'sandbox',
        asaasUserAgent: 'WearBubble/Test',
      } as never,
      orders as never,
      inventory as never,
      {} as never,
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
          id: 'pay_TESTE',
          status: 'REFUNDED',
          value: 49.9,
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    const result = await service.cancelOrder(orderRow.id);

    expect(fetch).toHaveBeenCalledWith(
      'https://api-sandbox.asaas.com/v3/payments/pay_TESTE/refund',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          description: `Cancelamento do pedido ${orderRow.number}`,
        }),
      }),
    );
    expect(inventory.restockCanceledOrder).toHaveBeenCalledWith(
      orderRow.id,
      true,
    );
    expect(orders.releaseStoreCredit).toHaveBeenCalled();
    expect(result.cancellation).toEqual(
      expect.objectContaining({
        responseStatus: 200,
        paymentId: 'pay_TESTE',
        status: 'REFUNDED',
      }),
    );
  });

  it('keeps the order paid when Asaas rejects the refund', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          errors: [{ description: 'Payment cannot be refunded' }],
        }),
        { status: 400, headers: { 'content-type': 'application/json' } },
      ),
    );

    await expect(service.cancelOrder(orderRow.id)).rejects.toThrow(
      ServiceUnavailableException,
    );
    expect(inventory.restockCanceledOrder).not.toHaveBeenCalled();
    expect(orders.saveEntity).not.toHaveBeenCalled();
  });
});
