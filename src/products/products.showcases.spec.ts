import { BadRequestException } from '@nestjs/common';
import { ProductShowcaseEntity } from './entities/product-showcase.entity';
import { ProductEntity } from './entities/product.entity';
import { ProductsService } from './products.service';

describe('ProductsService showcases', () => {
  const makeProduct = (id: number, overrides: Partial<ProductEntity> = {}) =>
    ({
      id,
      name: `Produto ${id}`,
      cat: 'Blusas/Top',
      sub: '',
      price: 100,
      promoPct: 0,
      tag: '',
      collectionName: 'Core',
      icon: 'top',
      rating: 5,
      reviews: 0,
      stock: 10,
      active: true,
      sizes: ['P'],
      material: '',
      pairId: null,
      bundlePosition: null,
      catalogPosition: id - 1,
      sports: [],
      colors: [],
      desc: '',
      image: null,
      images: [],
      ...overrides,
    }) as ProductEntity;

  function setup(rows: ProductEntity[], saved: ProductShowcaseEntity[] = []) {
    const manager = {
      delete: jest.fn().mockResolvedValue(undefined),
      save: jest.fn().mockResolvedValue(undefined),
    };
    const products = {
      find: jest.fn().mockResolvedValue(rows),
      manager: {
        transaction: jest.fn((callback: (value: typeof manager) => unknown) =>
          callback(manager),
        ),
      },
    };
    const showcases = { find: jest.fn().mockResolvedValue(saved) };
    const service = new ProductsService(
      products as never,
      {} as never,
      {} as never,
      showcases as never,
      {} as never,
      {
        reservationSnapshot: jest.fn().mockResolvedValue({
          byProduct: new Map(),
          byVariant: new Map(),
        }),
      } as never,
    );
    return { service, products, showcases, manager };
  }

  it('returns every showcase key with catalog defaults', async () => {
    const products = [1, 2, 3, 4].map((id) => makeProduct(id));
    const { service } = setup(products);

    const result = await service.listShowcases();

    expect(Object.keys(result)).toEqual([
      'hero',
      'home',
      'core',
      'tops',
      'bottoms',
      'sets',
    ]);
    expect(result.hero.map((product) => product.id)).toEqual([1]);
    expect(result.home.map((product) => product.id)).toEqual([1, 2, 3, 4]);
  });

  it('persists the selected order for a home showcase', async () => {
    const products = [1, 2, 3, 4].map((id) => makeProduct(id));
    const { service, manager } = setup(products);

    await service.saveShowcase('home', [4, 2, 1, 3]);

    expect(manager.delete).toHaveBeenCalledWith(ProductShowcaseEntity, {
      pageKey: 'home',
    });
    expect(manager.save).toHaveBeenCalledWith(ProductShowcaseEntity, [
      { pageKey: 'home', position: 1, productId: 4 },
      { pageKey: 'home', position: 2, productId: 2 },
      { pageKey: 'home', position: 3, productId: 1 },
      { pageKey: 'home', position: 4, productId: 3 },
    ]);
  });

  it('rejects invalid keys and unavailable products', async () => {
    const { service, products } = setup([
      makeProduct(1),
      makeProduct(2),
      makeProduct(3),
      makeProduct(4, { stock: 0 }),
    ]);

    await expect(
      service.saveShowcase('unknown', [1, 2, 3, 4]),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.saveShowcase('home', [1, 2, 3, 4]),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(products.manager.transaction).not.toHaveBeenCalled();
  });
});
