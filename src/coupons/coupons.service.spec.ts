import { BadRequestException } from '@nestjs/common';
import { CouponEntity } from './entities/coupon.entity';
import { CouponsService } from './coupons.service';

describe('CouponsService customer usage limit', () => {
  const coupon = {
    code: 'CLIENTE1',
    pct: 10,
    active: true,
    expiresAt: null,
    maxUses: null,
    maxUsesPerCustomer: 1,
    minSubtotal: 0,
    assignedTo: '',
    uses: 5,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as CouponEntity;

  function setup(customerUses: number, override: Partial<CouponEntity> = {}) {
    const coupons = {
      findOneBy: jest.fn().mockResolvedValue({ ...coupon, ...override }),
    };
    const orders = {
      count: jest.fn().mockResolvedValue(customerUses),
    };
    const locks = {};
    const service = new CouponsService(
      locks as never,
      coupons as never,
      orders as never,
    );
    return { service, orders };
  }

  it('bloqueia quando o cliente já atingiu o limite', async () => {
    const { service, orders } = setup(1);

    await expect(
      service.getActive(
        'CLIENTE1',
        '35cdd51a-4da8-42cc-a22f-bd158624b63e',
        'cliente@example.com',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(orders.count).toHaveBeenCalledTimes(1);
  });

  it('permite enquanto o cliente estiver abaixo do limite', async () => {
    const { service } = setup(0);

    await expect(
      service.getActive('CLIENTE1', undefined, 'cliente@example.com'),
    ).resolves.toMatchObject({ code: 'CLIENTE1', maxUsesPerCustomer: 1 });
  });

  it('não aplica limite individual na consulta pública sem identidade', async () => {
    const { service, orders } = setup(1);

    await expect(service.getActive('CLIENTE1')).resolves.toMatchObject({
      code: 'CLIENTE1',
    });
    expect(orders.count).not.toHaveBeenCalled();
  });

  it('bloqueia quando o cupom atinge o limite geral', async () => {
    const { service } = setup(5, {
      maxUses: 5,
      maxUsesPerCustomer: null,
    });

    await expect(service.getActive('CLIENTE1')).rejects.toThrow(
      'Cupom atingiu o limite geral de usos.',
    );
  });
});
