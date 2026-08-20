import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CouponEntity } from '../coupons/entities/coupon.entity';
import { ProductEntity } from '../products/entities/product.entity';
import { StoreCreditEntity } from '../returns/entities/store-credit.entity';
import { OrderEntity } from './entities/order.entity';
import { OrdersService } from './orders.service';

describe('OrdersService.remove', () => {
  function setup(order: Partial<OrderEntity> | null, generatedCredits = 0) {
    const orderRepository = {
      findOne: jest.fn().mockResolvedValue(order),
      delete: jest.fn().mockResolvedValue({ affected: order ? 1 : 0 }),
    };
    const productRepository = { increment: jest.fn() };
    const couponRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
    };
    const creditQuery = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(generatedCredits),
    };
    const creditRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(creditQuery),
      findOne: jest.fn(),
      save: jest.fn(),
    };
    const manager = {
      getRepository: jest.fn((entity) => {
        if (entity === OrderEntity) return orderRepository;
        if (entity === ProductEntity) return productRepository;
        if (entity === CouponEntity) return couponRepository;
        if (entity === StoreCreditEntity) return creditRepository;
        throw new Error('Repositório não configurado para o teste.');
      }),
    };
    const orders = {
      manager: {
        transaction: jest.fn(async (callback) => callback(manager)),
      },
    };
    const service = new OrdersService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      orders as never,
      {} as never,
      {} as never,
    );
    return {
      service,
      orderRepository,
      productRepository,
      couponRepository,
      creditRepository,
    };
  }

  it('exclui o pedido pago e reverte estoque, cupom e crédito reservado', async () => {
    const row = {
      id: 'a8241350-3f26-4bbf-b3e2-338a927010dc',
      number: 'B00027',
      status: 'paid',
      couponCode: 'TESTE',
      storeCreditCode: 'CREDITO',
      storeCreditAmount: 15,
      items: [{ productId: 3, quantity: 2 }],
    } as OrderEntity;
    const context = setup(row);
    const coupon = { code: 'TESTE', uses: 2 } as CouponEntity;
    const credit = {
      code: 'CREDITO',
      balance: 5,
      initialAmount: 30,
      status: 'used',
    } as StoreCreditEntity;
    context.couponRepository.findOne.mockResolvedValue(coupon);
    context.creditRepository.findOne.mockResolvedValue(credit);

    await expect(context.service.remove(row.id)).resolves.toEqual({
      id: row.id,
      number: row.number,
      deleted: true,
    });
    expect(context.productRepository.increment).toHaveBeenCalledWith(
      { id: 3 },
      'stock',
      2,
    );
    expect(context.couponRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ uses: 1 }),
    );
    expect(context.creditRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ balance: 20, status: 'active' }),
    );
    expect(context.orderRepository.delete).toHaveBeenCalledWith({ id: row.id });
  });

  it('não exclui pedido que gerou crédito de devolução', async () => {
    const row = {
      id: 'a8241350-3f26-4bbf-b3e2-338a927010dc',
      number: 'B00027',
      status: 'canceled',
      items: [],
    } as unknown as OrderEntity;
    const context = setup(row, 1);

    await expect(context.service.remove(row.id)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(context.orderRepository.delete).not.toHaveBeenCalled();
  });

  it('retorna 404 quando o pedido não existe', async () => {
    const context = setup(null);

    await expect(
      context.service.remove('a8241350-3f26-4bbf-b3e2-338a927010dc'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
