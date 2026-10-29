import { BadRequestException } from '@nestjs/common';
import { HomeLayoutService, normalizeFizzConfig } from './home-layout.service';

describe('HomeLayoutService', () => {
  const setup = (saved: unknown = null, existingProducts = 99) => {
    const settings = {
      findOneBy: jest.fn().mockResolvedValue(saved),
      create: jest.fn((value: unknown) => value),
      save: jest.fn().mockResolvedValue(undefined),
    };
    const products = { count: jest.fn().mockResolvedValue(existingProducts) };
    const service = new HomeLayoutService(settings as never, products as never);
    return { service, settings, products };
  };

  it('starts on the standard layout with an empty summer config', async () => {
    const { service } = setup();
    const result = await service.get();
    expect(result.active).toBe('padrao');
    expect(result.fizz.newsProductIds).toEqual([]);
    expect(result.fizz.storyImages.map((item) => item.label)).toEqual([
      'Look completo',
      'Bolso lateral',
      'Cintura em V',
    ]);
  });

  it('saves summer pieces without publishing the layout', async () => {
    const { service, settings } = setup(
      { id: 1, active: 'padrao', fizz: {} },
      2,
    );
    const result = await service.update({
      fizz: {
        heroProductId: 101,
        heroColor: 'Café',
        newsProductIds: [101, 102, 101],
      },
    });
    expect(result.active).toBe('padrao');
    expect(result.fizz.heroProductId).toBe(101);
    expect(result.fizz.newsProductIds).toEqual([101, 102]);
    expect(settings.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, active: 'padrao' }),
    );
  });

  it('publishes a layout and keeps the saved pieces', async () => {
    const saved = {
      id: 1,
      active: 'padrao',
      fizz: { heroProductId: 101, newsProductIds: [101] },
    };
    const { service } = setup(saved);
    const result = await service.update({ active: 'fizz' });
    expect(result.active).toBe('fizz');
    expect(result.fizz.heroProductId).toBe(101);
    expect(result.fizz.newsProductIds).toEqual([101]);
  });

  it('rejects pieces that no longer exist', async () => {
    const { service } = setup(null, 1);
    await expect(
      service.update({ fizz: { newsProductIds: [101, 999] } }),
    ).rejects.toThrow(BadRequestException);
  });

  it('normalizes broken saved data', () => {
    const config = normalizeFizzConfig({
      heroProductId: -3,
      newsProductIds: Array.from({ length: 14 }, (_, index) => index + 1),
    });
    expect(config.heroProductId).toBeNull();
    expect(config.newsProductIds).toHaveLength(10);
  });
});
