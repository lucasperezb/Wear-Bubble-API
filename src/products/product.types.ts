/**
 * Guia de medidas de uma peça. `rows` mapeia tamanho ("P") -> campo
 * ("busto") -> valor em cm como texto, para aceitar faixas ("82–86").
 * Campos permitidos: numeracao, busto, cintura, quadril, comprimento.
 */
export type ProductMeasurements = {
  rows: Record<string, Record<string, string>>;
  notes?: string;
};

export const MEASUREMENT_FIELDS = [
  'numeracao',
  'busto',
  'cintura',
  'quadril',
  'comprimento',
] as const;
export const MEASUREMENT_VALUE_MAX_LENGTH = 24;
export const MEASUREMENT_NOTES_MAX_LENGTH = 240;
export const MEASUREMENT_MAX_SIZES = 12;

export type ProductRecord = {
  id: number;
  name: string;
  cat: string;
  sub: string;
  price: number;
  promoPct: number;
  tag: string;
  collectionName?: string;
  icon: string;
  rating: number;
  reviews: number;
  stock: number;
  physicalStock?: number;
  reservedStock?: number;
  active: boolean;
  sizes: string[];
  material: string;
  weight?: number;
  width?: number;
  height?: number;
  length?: number;
  pair: number;
  bundlePosition?: number;
  catalogPosition?: number;
  sports: string[];
  colors: Array<{
    n: string;
    h: string;
    sizes?: Array<{
      size: string;
      q: number;
      physicalQ?: number;
      reservedQ?: number;
    }>;
  }>;
  desc: string;
  image?: string | null;
  images?: Array<{
    id: string;
    url: string;
    altText: string;
    colorName?: string | null;
    position: number;
    isPrimary: boolean;
  }>;
  measurements?: ProductMeasurements | null;
};
