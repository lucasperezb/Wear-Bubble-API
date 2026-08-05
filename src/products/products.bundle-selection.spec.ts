import { BadRequestException } from '@nestjs/common';
import { ProductEntity } from './entities/product.entity';
import { ProductsService } from './products.service';

describe('ProductsService bundle selection', () => {
  const makeProduct = (id: number, cat: string) =>
    ({
      id,
      name: `Produto ${id}`,
      cat,
      sub: '',
      price: 100,
      tag: '',
      icon: 'top',
      rating: 5,
      reviews: 0,
      stock: 10,
      active: true,
      sizes: ['P'],
      material: '',
      pairId: null,
      bundlePosition: null,
      sports: [],
      colors: [],
      desc: '',
      image: null,
      images: [],
    }) as unknown as ProductEntity;

  function setup(rows: ProductEntity[]) {
    const execute = jest.fn().mockResolvedValue(undefined);
    const set = jest.fn().mockReturnValue({ execute });
    const updateQuery = jest.fn().mockReturnValue({ set });
    const createQueryBuilder = jest
      .fn()
      .mockReturnValue({ update: updateQuery });
    const update = jest.fn().mockResolvedValue(undefined);
    const manager = { createQueryBuilder, update };
    const products = {
      find: jest.fn().mockResolvedValue(rows),
      manager: {
        transaction: jest.fn(
          async (callback: (value: typeof manager) => unknown) =>
            callback(manager),
        ),
      },
    };
    const service = new ProductsService(
      products as never,
      {} as never,
      {} as never,
      {} as never,
    );
    return { service, products, manager, set };
  }

  it('salva três posições para cada categoria', async () => {
    const rows = [
      makeProduct(1, 'Parte de baixo'),
      makeProduct(2, 'Parte de baixo'),
      makeProduct(3, 'Parte de baixo'),
      makeProduct(4, 'Top'),
      makeProduct(5, 'Top'),
      makeProduct(6, 'Top'),
    ];
    const { service, products, manager, set } = setup(rows);

    await service.saveBundleSelection([1, 2, 3], [4, 5, 6]);

    expect(products.manager.transaction).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledWith({ bundlePosition: null });
    expect(manager.update).toHaveBeenNthCalledWith(
      1,
      ProductEntity,
      { id: 1 },
      { bundlePosition: 1 },
    );
    expect(manager.update).toHaveBeenNthCalledWith(
      6,
      ProductEntity,
      { id: 6 },
      { bundlePosition: 3 },
    );
  });

  it('recusa produto na categoria errada', async () => {
    const rows = [
      makeProduct(1, 'Top'),
      makeProduct(2, 'Parte de baixo'),
      makeProduct(3, 'Parte de baixo'),
      makeProduct(4, 'Top'),
      makeProduct(5, 'Top'),
      makeProduct(6, 'Top'),
    ];
    const { service, products } = setup(rows);

    await expect(
      service.saveBundleSelection([1, 2, 3], [4, 5, 6]),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(products.manager.transaction).not.toHaveBeenCalled();
  });
});
