export const HOME_LAYOUTS = ['padrao', 'fizz', 'blackfriday'] as const;
export type HomeLayoutKey = (typeof HOME_LAYOUTS)[number];

/** Até quantas peças entram em "As novidades". */
export const MAX_NEWS_PRODUCTS = 10;
export const STORY_IMAGE_SLOTS = 3;

export type StoryImage = {
  productId: number | null;
  color: string;
  /** Posição na galeria daquela cor (0 = primeira foto). */
  imageIndex: number;
  label: string;
};

export type FizzLayoutConfig = {
  heroProductId: number | null;
  heroColor: string;
  sideProductId: number | null;
  newsProductIds: number[];
  storyImages: StoryImage[];
};

export const BF_HERO_SLOTS = 3;
export const BF_TRAINING_SLOTS = 4;
export const BF_MAX_OFFERS = 12;

export type BlackFridayPiece = { productId: number | null; color: string };
export type BlackFridayTraining = BlackFridayPiece & {
  sport: string;
  line: string;
};

export type BlackFridayConfig = {
  /** Maior desconto anunciado ("Até X% OFF"); 0 = "Preço de Black". */
  maxPct: number;
  /** Fim da campanha (ISO). Depois disso volta o layout anterior. */
  endsAt: string;
  heroText: string;
  hero: BlackFridayPiece[];
  /** Vitrine "Preço de Black"; vazio = peças com desconto, automático. */
  offerProductIds: number[];
  trainings: BlackFridayTraining[];
};

/** Layouts que podem voltar ao ar quando a Black termina. */
export type BaseLayoutKey = Exclude<HomeLayoutKey, 'blackfriday'>;

export const emptyBlackFridayConfig = (): BlackFridayConfig => ({
  maxPct: 0,
  endsAt: '2026-11-30T23:59:59-03:00',
  heroText:
    'A Fizz com preço de Black, e ainda 5% off no Pix e 5% off montando seu conjunto. Quantidade limitada.',
  hero: Array.from({ length: BF_HERO_SLOTS }, () => ({
    productId: null,
    color: '',
  })),
  offerProductIds: [],
  trainings: [
    ['Musculação', 'bolso que segura o celular'],
    ['Pilates', 'cintura em V, boca flare'],
    ['Beach tennis', 'cara de saia, short por baixo'],
    ['Corrida', 'uma peça só, look pronto'],
  ].map(([sport, line]) => ({ productId: null, color: '', sport, line })),
});

export type HomeLayoutSettings = {
  active: HomeLayoutKey;
  /** Layout que estava no ar antes da Black Friday. */
  previous: BaseLayoutKey;
  fizz: FizzLayoutConfig;
  blackFriday: BlackFridayConfig;
};

export const DEFAULT_STORY_LABELS = [
  'Look completo',
  'Bolso lateral',
  'Cintura em V',
];

export const emptyFizzConfig = (): FizzLayoutConfig => ({
  heroProductId: null,
  heroColor: '',
  sideProductId: null,
  newsProductIds: [],
  storyImages: DEFAULT_STORY_LABELS.map((label) => ({
    productId: null,
    color: '',
    imageIndex: 0,
    label,
  })),
});
