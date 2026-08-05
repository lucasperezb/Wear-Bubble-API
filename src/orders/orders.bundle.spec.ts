import { calculateBundleSubtotal } from './orders.service';

describe('calculateBundleSubtotal', () => {
  it('discounts only matched Top and Parte de baixo quantities', () => {
    expect(
      calculateBundleSubtotal([
        { bundle: 'look-1', productId: 1, category: 'Parte de baixo', quantity: 2, unitPrice: 100 },
        { bundle: 'look-1', productId: 2, category: 'Top', quantity: 1, unitPrice: 80 },
      ]),
    ).toBe(180);
  });

  it('does not discount forged groups with invalid categories', () => {
    expect(
      calculateBundleSubtotal([
        { bundle: 'fake', productId: 1, category: 'Top', quantity: 1, unitPrice: 80 },
        { bundle: 'fake', productId: 2, category: 'Top', quantity: 1, unitPrice: 90 },
      ]),
    ).toBe(0);
  });

  it('does not discount incomplete, duplicated, or ungrouped items', () => {
    expect(
      calculateBundleSubtotal([
        { bundle: 'incomplete', productId: 1, category: 'Top', quantity: 1, unitPrice: 80 },
        { bundle: 'duplicate', productId: 3, category: 'Top', quantity: 1, unitPrice: 70 },
        { bundle: 'duplicate', productId: 3, category: 'Parte de baixo', quantity: 1, unitPrice: 100 },
        { bundle: '', productId: 4, category: 'Top', quantity: 1, unitPrice: 60 },
      ]),
    ).toBe(0);
  });
});
