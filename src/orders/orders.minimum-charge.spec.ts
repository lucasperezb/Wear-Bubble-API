import { applyCouponToSubtotal, enforceMinimumCharge } from './orders.service';

describe('enforceMinimumCharge', () => {
  it('mantém cobranças a partir de R$ 0,50', () => {
    expect(enforceMinimumCharge(0.5)).toBe(0.5);
    expect(enforceMinimumCharge(10)).toBe(10);
  });

  it('eleva saldos positivos abaixo de R$ 0,50', () => {
    expect(enforceMinimumCharge(0.48)).toBe(0.5);
  });

  it('preserva pedidos sem saldo a cobrar', () => {
    expect(enforceMinimumCharge(0)).toBe(0);
  });
});

describe('applyCouponToSubtotal', () => {
  it('fixa o total em R$ 5 para o cupom especial', () => {
    expect(applyCouponToSubtotal(200, 0, true)).toEqual({
      subtotal: 5,
      couponPct: 0,
    });
  });

  it('mantém o comportamento percentual dos cupons comuns', () => {
    expect(applyCouponToSubtotal(200, 10, false)).toEqual({
      subtotal: 180,
      couponPct: 10,
    });
  });
});
