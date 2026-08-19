export const SHOWCASE_KEYS = [
  'hero',
  'home',
  'core',
  'tops',
  'bottoms',
  'sets',
] as const;

export type ShowcaseKey = (typeof SHOWCASE_KEYS)[number];

export function isShowcaseKey(value: string): value is ShowcaseKey {
  return SHOWCASE_KEYS.includes(value as ShowcaseKey);
}
