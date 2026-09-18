import {
  calculateProgressiveDiscount,
  nextProgressiveStep,
  normalizeTiers,
  progressivePctForPosition,
  ProgressiveSettings,
} from './progressive-discount';

const settings: ProgressiveSettings = {
  enabled: true,
  tiers: [10, 20, 30],
  extendLast: true,
  stackWithOtherDiscounts: false,
};

function units(prices: number[], eligible = true) {
  return prices.map((price, index) => ({ key: String(index), price, eligible }));
}

describe('desconto progressivo por quantidade', () => {
  it('reproduz a planilha: 2, 3 e 4 peças iguais dão 5%, 10% e 15% efetivos', () => {
    const price = 119.9;
    expect(
      calculateProgressiveDiscount(units([price, price]), settings).effectivePct,
    ).toBe(5);
    expect(
      calculateProgressiveDiscount(units([price, price, price]), settings)
        .effectivePct,
    ).toBe(10);
    const four = calculateProgressiveDiscount(
      units([price, price, price, price]),
      settings,
    );
    expect(four.effectivePct).toBe(15);
    expect(four.discount).toBe(71.94);
    expect(four.allocations.map((item) => item.pct)).toEqual([0, 10, 20, 30]);
  });

  it('a peça mais cara paga cheio e a mais barata recebe a maior faixa', () => {
    const result = calculateProgressiveDiscount(
      units([89.9, 299.9, 129.9]),
      settings,
    );
    expect(result.allocations.map((item) => [item.price, item.pct])).toEqual([
      [299.9, 0],
      [129.9, 10],
      [89.9, 20],
    ]);
    expect(result.discount).toBeCloseTo(30.97, 2);
  });

  it('além da última faixa repete a última % só quando extendLast está ligado', () => {
    const five = units([100, 100, 100, 100, 100]);
    expect(
      calculateProgressiveDiscount(five, settings).allocations.map((i) => i.pct),
    ).toEqual([0, 10, 20, 30, 30]);
    expect(
      calculateProgressiveDiscount(five, {
        ...settings,
        extendLast: false,
      }).allocations.map((i) => i.pct),
    ).toEqual([0, 10, 20, 30, 0]);
  });

  it('ignora unidades não elegíveis e exige pelo menos duas elegíveis', () => {
    const mixed = [
      { key: 'promo', price: 200, eligible: false },
      { key: 'a', price: 100, eligible: true },
      { key: 'b', price: 80, eligible: true },
    ];
    const result = calculateProgressiveDiscount(mixed, settings);
    expect(result.eligibleCount).toBe(2);
    expect(result.allocations.map((item) => item.key)).toEqual(['a', 'b']);
    expect(result.discount).toBe(8);

    const single = calculateProgressiveDiscount(units([100]), settings);
    expect(single.discount).toBe(0);
    expect(single.eligibleCount).toBe(1);
  });

  it('não desconta nada com a chave desligada ou sem faixas', () => {
    expect(
      calculateProgressiveDiscount(units([100, 100]), {
        ...settings,
        enabled: false,
      }).discount,
    ).toBe(0);
    expect(
      calculateProgressiveDiscount(units([100, 100]), {
        ...settings,
        tiers: [],
      }).discount,
    ).toBe(0);
  });

  it('normaliza faixas e posições', () => {
    expect(normalizeTiers(['15', 120, -3, 2.6])).toEqual([15, 90, 0, 3]);
    expect(normalizeTiers('x')).toEqual([]);
    expect(progressivePctForPosition(1, [10, 20], true)).toBe(0);
    expect(progressivePctForPosition(2, [10, 20], true)).toBe(10);
    expect(progressivePctForPosition(4, [10, 20], true)).toBe(20);
    expect(progressivePctForPosition(4, [10, 20], false)).toBe(0);
  });

  it('informa a próxima faixa para o aviso do carrinho', () => {
    expect(nextProgressiveStep(1, settings)).toEqual({ position: 2, pct: 10 });
    expect(nextProgressiveStep(3, settings)).toEqual({ position: 4, pct: 30 });
    expect(nextProgressiveStep(4, { ...settings, extendLast: false })).toBeNull();
    expect(nextProgressiveStep(1, { ...settings, enabled: false })).toBeNull();
  });
});
