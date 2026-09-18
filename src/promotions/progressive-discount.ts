/**
 * Desconto progressivo por quantidade.
 *
 * As peças do carrinho viram unidades (uma por quantidade), ordenadas da mais
 * cara para a mais barata. A 1ª paga cheio; a 2ª, 3ª, 4ª... recebem a % da
 * faixa correspondente. Espelhado em Wear-Bubble-Front/lib/progressive-discount.ts —
 * qualquer mudança aqui precisa ir para lá também.
 */

export const PROGRESSIVE_MAX_TIERS = 9;
export const PROGRESSIVE_MAX_PCT = 90;

export type ProgressiveSettings = {
  enabled: boolean;
  /** % de desconto da 2ª, 3ª, 4ª... peça, nessa ordem. */
  tiers: number[];
  /** Peças além da última faixa recebem a % da última faixa. */
  extendLast: boolean;
  /** Peças já com promoção individual ou em conjunto também participam. */
  stackWithOtherDiscounts: boolean;
};

export type PromotionSettings = {
  /** Chave-mestra das promoções individuais (promoPct de cada peça). */
  individualEnabled: boolean;
  progressive: ProgressiveSettings;
};

export const defaultPromotionSettings: PromotionSettings = {
  individualEnabled: true,
  progressive: {
    enabled: false,
    tiers: [10, 20, 30],
    extendLast: true,
    stackWithOtherDiscounts: false,
  },
};

export type ProgressiveUnit = {
  /** Identificador da linha de origem, para devolver o rateio por linha. */
  key: string;
  price: number;
  /** false = a unidade não entra na contagem nem recebe desconto. */
  eligible: boolean;
};

export type ProgressiveAllocation = {
  key: string;
  price: number;
  /** Posição 1 = peça mais cara (sem desconto). */
  position: number;
  pct: number;
  discount: number;
};

export type ProgressiveResult = {
  discount: number;
  eligibleCount: number;
  allocations: ProgressiveAllocation[];
  /** % média sobre as unidades elegíveis (o "desconto efetivo" da planilha). */
  effectivePct: number;
};

export function clampPct(value: unknown) {
  return Math.min(
    PROGRESSIVE_MAX_PCT,
    Math.max(0, Math.round(Number(value) || 0)),
  );
}

export function normalizeTiers(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, PROGRESSIVE_MAX_TIERS).map(clampPct);
}

/** % da peça na posição informada (1 = mais cara). */
export function progressivePctForPosition(
  position: number,
  tiers: number[],
  extendLast: boolean,
) {
  if (position <= 1) return 0;
  const index = position - 2;
  if (index < tiers.length) return clampPct(tiers[index]);
  return extendLast && tiers.length ? clampPct(tiers[tiers.length - 1]) : 0;
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

export function calculateProgressiveDiscount(
  units: ProgressiveUnit[],
  settings: ProgressiveSettings,
): ProgressiveResult {
  const empty: ProgressiveResult = {
    discount: 0,
    eligibleCount: 0,
    allocations: [],
    effectivePct: 0,
  };
  const tiers = normalizeTiers(settings?.tiers);
  if (!settings?.enabled || !tiers.length) return empty;

  const eligible = units
    .filter((unit) => unit.eligible && Number(unit.price) > 0)
    .map((unit, index) => ({ ...unit, index }))
    // Mais cara primeiro; empate mantém a ordem do carrinho.
    .sort((a, b) => b.price - a.price || a.index - b.index);
  if (eligible.length < 2) return { ...empty, eligibleCount: eligible.length };

  const allocations = eligible.map((unit, offset) => {
    const position = offset + 1;
    const pct = progressivePctForPosition(position, tiers, settings.extendLast);
    return {
      key: unit.key,
      price: unit.price,
      position,
      pct,
      discount: round2((unit.price * pct) / 100),
    };
  });
  const discount = round2(
    allocations.reduce((sum, item) => sum + item.discount, 0),
  );
  const base = allocations.reduce((sum, item) => sum + item.price, 0);
  return {
    discount,
    eligibleCount: eligible.length,
    allocations,
    effectivePct: base ? round2((discount / base) * 100) : 0,
  };
}

/** Quanto falta para a próxima faixa, para o aviso no carrinho. */
export function nextProgressiveStep(
  eligibleCount: number,
  settings: ProgressiveSettings,
) {
  const tiers = normalizeTiers(settings?.tiers);
  if (!settings?.enabled || !tiers.length) return null;
  const nextPosition = eligibleCount + 1;
  const pct = progressivePctForPosition(nextPosition, tiers, settings.extendLast);
  if (!pct) return null;
  return { position: nextPosition, pct };
}
