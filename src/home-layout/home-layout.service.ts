import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ProductEntity } from '../products/entities/product.entity';
import { UpdateHomeLayoutDto } from './dto/update-home-layout.dto';
import { HomeLayoutEntity } from './entities/home-layout.entity';
import {
  DEFAULT_STORY_LABELS,
  FizzLayoutConfig,
  HOME_LAYOUTS,
  HomeLayoutSettings,
  MAX_NEWS_PRODUCTS,
  STORY_IMAGE_SLOTS,
  StoryImage,
  emptyFizzConfig,
} from './home-layout.types';

const positiveId = (value: unknown) => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const text = (value: unknown) =>
  typeof value === 'string' ? value.trim() : '';

type Loose<T> = { [K in keyof T]?: unknown };

/** Completa e limpa o que está salvo, para a loja sempre receber o mesmo formato. */
export function normalizeFizzConfig(
  raw: Loose<FizzLayoutConfig> | null | undefined,
): FizzLayoutConfig {
  const base = emptyFizzConfig();
  const value = raw || {};
  const news = Array.isArray(value.newsProductIds)
    ? (value.newsProductIds as unknown[])
        .map(positiveId)
        .filter((id): id is number => !!id)
    : [];
  const story = (
    Array.isArray(value.storyImages) ? value.storyImages : []
  ) as Loose<StoryImage>[];
  return {
    heroProductId: positiveId(value.heroProductId),
    heroColor: text(value.heroColor),
    sideProductId: positiveId(value.sideProductId),
    newsProductIds: [...new Set(news)].slice(0, MAX_NEWS_PRODUCTS),
    storyImages: base.storyImages.map((slot, index) => {
      const item = story[index] || slot;
      return {
        productId: positiveId(item.productId),
        color: text(item.color),
        imageIndex: Math.max(0, Math.min(30, Number(item.imageIndex) || 0)),
        label: text(item.label) || DEFAULT_STORY_LABELS[index] || '',
      };
    }),
  };
}

@Injectable()
export class HomeLayoutService {
  constructor(
    @InjectRepository(HomeLayoutEntity)
    private readonly settings: Repository<HomeLayoutEntity>,
    @InjectRepository(ProductEntity)
    private readonly products: Repository<ProductEntity>,
  ) {}

  async get(): Promise<HomeLayoutSettings> {
    const row = await this.settings.findOneBy({ id: 1 });
    return {
      active: row && HOME_LAYOUTS.includes(row.active) ? row.active : 'padrao',
      fizz: normalizeFizzConfig(row?.fizz),
    };
  }

  async update(dto: UpdateHomeLayoutDto): Promise<HomeLayoutSettings> {
    const current = await this.get();
    const fizz = dto.fizz
      ? normalizeFizzConfig({ ...current.fizz, ...definedOnly(dto.fizz) })
      : current.fizz;
    if (dto.fizz) await this.assertProductsExist(fizz);
    const active = dto.active ?? current.active;
    await this.settings.save(this.settings.create({ id: 1, active, fizz }));
    return { active, fizz };
  }

  private async assertProductsExist(fizz: FizzLayoutConfig) {
    const ids = [
      fizz.heroProductId,
      fizz.sideProductId,
      ...fizz.newsProductIds,
      ...fizz.storyImages.map((item) => item.productId),
    ].filter((id): id is number => !!id);
    const unique = [...new Set(ids)];
    if (!unique.length) return;
    const found = await this.products.count({ where: { id: In(unique) } });
    if (found !== unique.length) {
      throw new BadRequestException(
        'Uma das peças selecionadas não existe mais. Recarregue a página e escolha de novo.',
      );
    }
    if (fizz.newsProductIds.length > MAX_NEWS_PRODUCTS) {
      throw new BadRequestException(
        `Escolha no máximo ${MAX_NEWS_PRODUCTS} peças para "As novidades".`,
      );
    }
    if (fizz.storyImages.length > STORY_IMAGE_SLOTS) {
      throw new BadRequestException('A seção "A coleção" tem três fotos.');
    }
  }
}

/** Com target ES2022 os campos opcionais do DTO existem como undefined. */
function definedOnly<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined),
  ) as Partial<T>;
}
