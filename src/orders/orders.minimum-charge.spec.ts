import { enforceMinimumCharge } from './orders.service';

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
