export const HOME_LAYOUTS = ['padrao', 'fizz'] as const;
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

export type HomeLayoutSettings = {
  active: HomeLayoutKey;
  fizz: FizzLayoutConfig;
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
