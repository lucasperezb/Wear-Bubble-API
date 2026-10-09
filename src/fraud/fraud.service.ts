import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { OrderEntity } from '../orders/entities/order.entity';
import { CardAttemptEntity } from './entities/card-attempt.entity';

/** Regras de revisão de pedidos pagos. */
export const FRAUD_RULES = {
  /** O mesmo CPF em N contas diferentes (contando a do pedido). */
  accountsPerTaxId: 2,
  /** N cartões diferentes em 30 dias para o mesmo cliente/CPF/e-mail. */
  cardsPer30Days: 3,
  /** N cartões recusados em 24h para o mesmo cliente/CPF/e-mail. */
  declinedPer24Hours: 3,
};

export type FraudCounts = {
  accountsWithTaxId: number;
  distinctCards30d: number;
  declined24h: number;
};

/** Transforma as contagens nos motivos exibidos ao gerente. */
export function reviewReasons(counts: FraudCounts) {
  const reasons: string[] = [];
  if (counts.accountsWithTaxId >= FRAUD_RULES.accountsPerTaxId) {
    reasons.push(`CPF usado em ${counts.accountsWithTaxId} contas diferentes`);
  }
  if (counts.distinctCards30d >= FRAUD_RULES.cardsPer30Days) {
    reasons.push(
      `${counts.distinctCards30d} cartões diferentes nos últimos 30 dias`,
    );
  }
  if (counts.declined24h >= FRAUD_RULES.declinedPer24Hours) {
    reasons.push(
      `${counts.declined24h} tentativas de cartão recusadas nas últimas 24h`,
    );
  }
  return reasons;
}

const digits = (value: string | null | undefined) =>
  String(value || '').replace(/\D/g, '');

/** "1234|12|30" a partir dos dados do cartão. Nunca o número inteiro. */
export function cardFingerprint(card?: {
  number?: string;
  expiryMonth?: string;
  expiryYear?: string;
}) {
  const number = digits(card?.number);
  if (number.length < 4) return '';
  const month = digits(card?.expiryMonth).padStart(2, '0').slice(-2);
  const year = digits(card?.expiryYear).slice(-2);
  return `${number.slice(-4)}|${month}|${year}`;
}

const ACCOUNTS_WITH_TAX_ID = `
  SELECT COUNT(DISTINCT uid) AS count FROM (
    SELECT uid FROM profiles
     WHERE regexp_replace(tax_id, '[^0-9]', '', 'g') = $1
    UNION
    SELECT customer_uid AS uid FROM orders
     WHERE customer_uid IS NOT NULL
       AND regexp_replace(customer_tax_id, '[^0-9]', '', 'g') = $1
  ) AS accounts`;

/**
 * Sinaliza pedidos pagos com padrão de fraude para o gerente revisar antes
 * do envio. Só marca; não cancela nem estorna nada sozinho.
 */
@Injectable()
export class FraudService {
  private readonly logger = new Logger(FraudService.name);
  private lastCleanup = 0;

  constructor(
    @InjectRepository(CardAttemptEntity)
    private readonly attempts: Repository<CardAttemptEntity>,
    @InjectRepository(OrderEntity)
    private readonly orders: Repository<OrderEntity>,
  ) {}

  /** Nunca derruba o checkout: falha ao registrar só vai para o log. */
  async recordCardAttempt(input: {
    customerUid: string | null;
    email: string;
    taxId: string;
    card?: { number?: string; expiryMonth?: string; expiryYear?: string };
    approved: boolean;
    ip: string;
  }) {
    const fingerprint = cardFingerprint(input.card);
    if (!fingerprint) return;
    try {
      await this.attempts.insert({
        customerUid: input.customerUid,
        email: String(input.email || '')
          .trim()
          .toLowerCase()
          .slice(0, 255),
        taxId: digits(input.taxId).slice(0, 14),
        cardFingerprint: fingerprint,
        approved: input.approved,
        ip: String(input.ip || '').slice(0, 64),
      });
      await this.cleanup();
    } catch (error) {
      this.logger.error('Falha ao registrar tentativa de cartão.', error);
    }
  }

  /**
   * Avalia um pedido pago e, se houver motivo, marca como "em revisão".
   * Devolve os motivos (vazio = sem alerta). Falha de consulta não bloqueia.
   */
  async evaluatePaidOrder(order: OrderEntity) {
    if (order.reviewStatus === 'cleared') return [];
    try {
      const reasons = reviewReasons(await this.counts(order));
      if (!reasons.length) return [];
      order.reviewStatus = 'pending';
      order.reviewReasons = reasons;
      await this.orders.update(order.id, {
        reviewStatus: 'pending',
        reviewReasons: reasons,
      });
      this.logger.warn(
        `Pedido ${order.number} em revisão: ${reasons.join('; ')}`,
      );
      return reasons;
    } catch (error) {
      this.logger.error(
        `Falha ao avaliar risco do pedido ${order.number}.`,
        error,
      );
      return [];
    }
  }

  private async counts(order: OrderEntity): Promise<FraudCounts> {
    const taxId = digits(order.customerTaxId);
    const email = String(order.customerEmail || '')
      .trim()
      .toLowerCase();

    const accounts = taxId
      ? await this.orders.manager.query<{ count: string }[]>(
          ACCOUNTS_WITH_TAX_ID,
          [taxId],
        )
      : [];

    // Mesma pessoa = mesma conta, mesmo CPF ou mesmo e-mail.
    const identity: string[] = [];
    const params: string[] = [];
    const candidates: [string, string | null][] = [
      ['customer_uid', order.customerUid],
      ['tax_id', taxId],
      ['email', email],
    ];
    for (const [column, value] of candidates) {
      if (!value) continue;
      params.push(value);
      identity.push(`${column} = $${params.length}`);
    }
    let distinctCards30d = 0;
    let declined24h = 0;
    if (identity.length) {
      const [row] = await this.attempts.manager.query<
        { cards: string; declined: string }[]
      >(
        `SELECT
           COUNT(DISTINCT card_fingerprint)
             FILTER (WHERE created_at > now() - interval '30 days') AS cards,
           COUNT(*)
             FILTER (WHERE NOT approved AND created_at > now() - interval '24 hours') AS declined
         FROM card_attempts
         WHERE ${identity.join(' OR ')}`,
        params,
      );
      distinctCards30d = Number(row?.cards || 0);
      declined24h = Number(row?.declined || 0);
    }

    return {
      accountsWithTaxId: Number(accounts[0]?.count || 0),
      distinctCards30d,
      declined24h,
    };
  }

  /** Mantém 90 dias de histórico; roda no máximo uma vez por hora. */
  private async cleanup() {
    const now = Date.now();
    if (now - this.lastCleanup < 60 * 60_000) return;
    this.lastCleanup = now;
    await this.attempts
      .delete({ createdAt: LessThan(new Date(now - 90 * 24 * 60 * 60_000)) })
      .catch(() => undefined);
  }
}
