import { groupInventoryLines } from './inventory.service';

describe('groupInventoryLines', () => {
  it('agrupa linhas repetidas pela variante e normaliza o tamanho', () => {
    const groups = groupInventoryLines([
      {
        item: { id: 10 } as never,
        productId: 1,
        productColorId: 7,
        size: ' p ',
        quantity: 2,
      },
      {
        item: { id: 11 } as never,
        productId: 1,
        productColorId: 7,
        size: 'P',
        quantity: 2,
      },
      {
        item: { id: 12 } as never,
        productId: 1,
        productColorId: 8,
        size: 'P',
        quantity: 1,
      },
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0]).toEqual(
      expect.objectContaining({
        key: '1:7:P',
        quantity: 4,
        size: 'P',
      }),
    );
    expect(groups[0].items.map((line) => line.item.id)).toEqual([10, 11]);
  });
});
