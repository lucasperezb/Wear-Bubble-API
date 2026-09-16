import { ProductEntity } from './entities/product.entity';
import {
  MEASUREMENT_MAX_SIZES,
  MEASUREMENT_NOTES_MAX_LENGTH,
  MEASUREMENT_VALUE_MAX_LENGTH,
} from './product.types';
import { ProductsService } from './products.service';

describe('ProductsService measurements', () => {
  const makeRow = (overrides: Partial<ProductEntity> = {}) =>
    ({
      id: 1,
      name: 'Produto 1',
      cat: 'Blusas/Top',
      sub: '',
      price: 100,
      promoPct: 0,
      tag: '',
      collectionName: '',
      icon: 'top',
      rating: 5,
      reviews: 0,
      stock: 10,
      active: true,
      sizes: ['P', 'M'],
      material: '',
      weight: 0.3,
      width: 20,
      height: 4,
      length: 25,
      pairId: null,
      bundlePosition: null,
      catalogPosition: 0,
      sports: [],
      colors: [],
      desc: '',
      image: null,
      images: [],
      measurements: null,
      ...overrides,
    }) as unknown as ProductEntity;

  function setup(row: ProductEntity = makeRow()) {
    const products = {
      find: jest.fn().mockResolvedValue([]),
      findOneBy: jest.fn().mockResolvedValue(row),
      create: jest.fn((data: unknown) => data),
      save: jest.fn(async (data: unknown) => data),
    };
    const colors = {
      create: jest.fn((data: unknown) => data),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    const service = new ProductsService(
      products as never,
      colors as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    return { service, products, row };
  }

  it('mantém apenas os campos conhecidos e normaliza os tamanhos', async () => {
    const { service } = setup();

    const created = await service.create({
      name: 'Top',
      measurements: {
        rows: {
          ' p ': { busto: ' 82–86 ', cintura: '62–66', ombro: '40' },
          m: { quadril: 92 as never, comprimento: '' },
        },
      },
    });

    expect(created.measurements).toEqual({
      rows: {
        P: { busto: '82–86', cintura: '62–66' },
        M: { quadril: '92' },
      },
    });
  });

  it('descarta linhas que ficam vazias', async () => {
    const { service } = setup();

    const created = await service.create({
      measurements: {
        rows: {
          P: { busto: '82–86' },
          M: { busto: '   ', cintura: '' },
          G: { ombro: '40' },
          GG: {},
          XG: 'texto' as never,
        },
      },
    });

    expect(created.measurements).toEqual({ rows: { P: { busto: '82–86' } } });
  });

  it('trunca valores e observações no limite', async () => {
    const { service } = setup();
    const longValue = 'x'.repeat(MEASUREMENT_VALUE_MAX_LENGTH + 10);
    const longNotes = 'n'.repeat(MEASUREMENT_NOTES_MAX_LENGTH + 10);

    const created = await service.create({
      measurements: {
        rows: { P: { busto: longValue } },
        notes: `  ${longNotes}  `,
      },
    });

    expect(created.measurements?.rows.P.busto).toHaveLength(
      MEASUREMENT_VALUE_MAX_LENGTH,
    );
    expect(created.measurements?.notes).toHaveLength(
      MEASUREMENT_NOTES_MAX_LENGTH,
    );
  });

  it('limita a quantidade de tamanhos', async () => {
    const { service } = setup();
    const rows = Object.fromEntries(
      Array.from({ length: MEASUREMENT_MAX_SIZES + 5 }, (_, index) => [
        `T${index}`,
        { busto: '80' },
      ]),
    );

    const created = await service.create({ measurements: { rows } });

    expect(Object.keys(created.measurements?.rows || {})).toHaveLength(
      MEASUREMENT_MAX_SIZES,
    );
  });

  it('devolve null para entradas inválidas ou vazias', async () => {
    const garbage: unknown[] = [
      null,
      undefined,
      'texto',
      42,
      [],
      {},
      { rows: [] },
      { rows: 'texto' },
      { rows: {}, notes: '   ' },
      { rows: { P: { ombro: '40' } } },
      { rows: { P: { busto: { valor: 82 } } } },
    ];

    for (const input of garbage) {
      const { service } = setup();
      const created = await service.create({
        measurements: input as never,
      });
      expect(created.measurements).toBeNull();
    }
  });

  it('mantém apenas as observações quando não há linhas', async () => {
    const { service } = setup();

    const created = await service.create({
      measurements: { rows: {}, notes: '  Medidas do corpo, não da peça.  ' },
    });

    expect(created.measurements).toEqual({
      rows: {},
      notes: 'Medidas do corpo, não da peça.',
    });
  });

  it('sanitiza e limpa as medidas na atualização', async () => {
    const { service, products, row } = setup(
      makeRow({ measurements: { rows: { P: { busto: '80' } } } }),
    );

    const updated = await service.update(1, {
      measurements: { rows: { m: { cintura: ' 64 ', ombro: '40' } } },
    });

    expect(updated.measurements).toEqual({ rows: { M: { cintura: '64' } } });
    expect(products.save).toHaveBeenCalledWith(
      expect.objectContaining({
        measurements: { rows: { M: { cintura: '64' } } },
      }),
    );

    const cleared = await service.update(1, { measurements: null });
    expect(cleared.measurements).toBeNull();
    expect(row.measurements).toBeNull();
  });

  it('preserva as medidas quando o campo não é enviado', async () => {
    const measurements = { rows: { P: { busto: '80' } } };
    const { service } = setup(makeRow({ measurements }));

    const updated = await service.update(1, { name: 'Novo nome' });

    expect(updated.measurements).toEqual(measurements);
  });
});
