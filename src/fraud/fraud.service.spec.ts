import { cardFingerprint, reviewReasons } from './fraud.service';

describe('reviewReasons', () => {
  it('returns no reasons for a normal customer', () => {
    expect(
      reviewReasons({
        accountsWithTaxId: 1,
        distinctCards30d: 1,
        declined24h: 0,
      }),
    ).toEqual([]);
  });

  it('flags a CPF shared by more than one account', () => {
    expect(
      reviewReasons({
        accountsWithTaxId: 3,
        distinctCards30d: 1,
        declined24h: 0,
      }),
    ).toEqual(['CPF usado em 3 contas diferentes']);
  });

  it('flags many cards and many declines', () => {
    expect(
      reviewReasons({
        accountsWithTaxId: 1,
        distinctCards30d: 4,
        declined24h: 3,
      }),
    ).toEqual([
      '4 cartões diferentes nos últimos 30 dias',
      '3 tentativas de cartão recusadas nas últimas 24h',
    ]);
  });
});

describe('cardFingerprint', () => {
  it('keeps only the last 4 digits and the expiry', () => {
    expect(
      cardFingerprint({
        number: '4111 1111 1111 1234',
        expiryMonth: '3',
        expiryYear: '2030',
      }),
    ).toBe('1234|03|30');
  });

  it('ignores missing card data', () => {
    expect(cardFingerprint(undefined)).toBe('');
  });
});
