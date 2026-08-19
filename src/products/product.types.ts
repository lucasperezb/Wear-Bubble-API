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
  active: boolean;
  sizes: string[];
  material: string;
  pair: number;
  bundlePosition?: number;
  sports: string[];
  colors: Array<{
    n: string;
    h: string;
    sizes?: Array<{ size: string; q: number }>;
  }>;
  desc: string;
  image?: string | null;
  images?: Array<{
    id: string;
    url: string;
    altText: string;
    position: number;
    isPrimary: boolean;
  }>;
};
