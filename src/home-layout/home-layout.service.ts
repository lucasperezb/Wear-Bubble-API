import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ProductEntity } from '../products/entities/product.entity';
import { UpdateHomeLayoutDto } from './dto/update-home-layout.dto';
import { HomeLayoutEntity } from './entities/home-layout.entity';
import {
  BF_MAX_OFFERS,
  BlackFridayConfig,
  BlackFridayPiece,
  BlackFridayTraining,
  DEFAULT_STORY_LABELS,
  FizzLayoutConfig,
  HOME_LAYOUTS,
  HomeLayoutSettings,
  MAX_NEWS_PRODUCTS,
  STORY_IMAGE_SLOTS,
  StoryImage,
  emptyBlackFridayConfig,
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

const isFuture = (iso: string) => Date.parse(iso) > Date.now();

export function normalizeBlackFridayConfig(
  raw: Loose<BlackFridayConfig> | null | undefined,
): BlackFridayConfig {
  const base = emptyBlackFridayConfig();
  const value = raw || {};
  const list = <T>(items: unknown) =>
    (Array.isArray(items) ? items : []) as Loose<T>[];
  const hero = list<BlackFridayPiece>(value.hero);
  const trainings = list<BlackFridayTraining>(value.trainings);
  const offers = list<unknown>(value.offerProductIds)
    .map(positiveId)
    .filter((id): id is number => !!id);
  const endsAt = text(value.endsAt);
  return {
    maxPct: Math.max(0, Math.min(90, Math.round(Number(value.maxPct)) || 0)),
    endsAt: Number.isNaN(Date.parse(endsAt)) ? base.endsAt : endsAt,
    heroText: text(value.heroText) || base.heroText,
    hero: base.hero.map((_, index) => ({
      productId: positiveId(hero[index]?.productId),
      color: text(hero[index]?.color),
    })),
    offerProductIds: [...new Set(offers)].slice(0, BF_MAX_OFFERS),
    trainings: base.trainings.map((slot, index) => ({
      productId: positiveId(trainings[index]?.productId),
      color: text(trainings[index]?.color),
      sport: text(trainings[index]?.sport) || slot.sport,
      line: text(trainings[index]?.line) || slot.line,
    })),
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
    const blackFriday = normalizeBlackFridayConfig(row?.blackFriday);
    const previous = row?.previous === 'fizz' ? 'fizz' : 'padrao';
    const stored =
      row && HOME_LAYOUTS.includes(row.active) ? row.active : 'padrao';
    // Terminada a Black, o layout anterior volta sozinho.
    const active =
      stored === 'blackfriday' && !isFuture(blackFriday.endsAt)
        ? previous
        : stored;
    return {
      active,
      previous,
      fizz: normalizeFizzConfig(row?.fizz),
      blackFriday,
    };
  }

  async update(dto: UpdateHomeLayoutDto): Promise<HomeLayoutSettings> {
    const current = await this.get();
    const fizz = dto.fizz
      ? normalizeFizzConfig({ ...current.fizz, ...definedOnly(dto.fizz) })
      : current.fizz;
    const blackFriday = dto.blackFriday
      ? normalizeBlackFridayConfig({
          ...current.blackFriday,
          ...definedOnly(dto.blackFriday),
        })
      : current.blackFriday;
    if (dto.fizz) await this.assertProductsExist(fizz);
    if (dto.blackFriday) {
      await this.assertIdsExist([
        ...blackFriday.hero.map((item) => item.productId),
        ...blackFriday.offerProductIds,
        ...blackFriday.trainings.map((item) => item.productId),
      ]);
    }
    const active = dto.active ?? current.active;
    if (active === 'blackfriday' && !isFuture(blackFriday.endsAt)) {
      throw new BadRequestException(
        'O término da Black Friday precisa estar no futuro. Para tirar do ar, publique outro layout.',
      );
    }
    const previous =
      active === 'blackfriday' && current.active !== 'blackfriday'
        ? current.active
        : current.previous;
    const next = { active, previous, fizz, blackFriday };
    await this.settings.save(this.settings.create({ id: 1, ...next }));
    return next;
  }

  private async assertIdsExist(ids: Array<number | null>) {
    const unique = [...new Set(ids.filter((id): id is number => !!id))];
    if (!unique.length) return;
    const found = await this.products.count({ where: { id: In(unique) } });
    if (found !== unique.length) {
      throw new BadRequestException(
        'Uma das peças selecionadas não existe mais. Recarregue a página e escolha de novo.',
      );
    }
  }

  private async assertProductsExist(fizz: FizzLayoutConfig) {
    await this.assertIdsExist([
      fizz.heroProductId,
      fizz.sideProductId,
      ...fizz.newsProductIds,
      ...fizz.storyImages.map((item) => item.productId),
    ]);
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
