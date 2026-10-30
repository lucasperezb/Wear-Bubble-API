import { ProductsService } from './products.service';

describe('ProductsService removal', () => {
  function setup() {
    const products = {
      softDelete: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    const imageStorage = { remove: jest.fn() };
    const service = new ProductsService(
      products as never,
      {} as never,
      {} as never,
      {} as never,
      imageStorage as never,
      {} as never,
      {} as never,
    );
    return { service, products, imageStorage };
  }

  it('soft-deletes a product so inventory history remains valid', async () => {
    const { service, products, imageStorage } = setup();

    await expect(service.remove(17)).resolves.toEqual({ removed: 1 });
    expect(products.softDelete).toHaveBeenCalledWith({ id: 17 });
    expect(imageStorage.remove).not.toHaveBeenCalled();
  });
});
