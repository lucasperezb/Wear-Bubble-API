import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'node:crypto';
import { LessThan, MoreThan, Repository } from 'typeorm';
import { EmailSendLogEntity } from './entities/email-send-log.entity';

/** Limites de e-mails disparados por visitantes (códigos, redefinição, pedido). */
export const EMAIL_LIMITS = {
  /** Por endereço de destino. */
  perRecipientHour: 5,
  perRecipientDay: 15,
  /** Endereços diferentes por IP em 1 hora. */
  recipientsPerIpHour: 10,
};

const HOUR_MS = 60 * 60_000;
const DAY_MS = 24 * HOUR_MS;

export type EmailPurpose =
  'login-code' | 'verification' | 'password-reset' | 'order-created';

/**
 * Impede que o site seja usado para mandar spam pelo contato@ (e queimar a
 * reputação do domínio): limita envios por destinatário e por IP.
 *
 * - `assertIpAllowed`: chamado no início das rotas de cadastro/código/senha,
 *   antes de procurar a conta, devolve 429 para um IP que já disparou e-mail
 *   para muitos endereços. Como roda igual exista ou não a conta, não serve
 *   para descobrir quais e-mails estão cadastrados.
 * - `allow`: na hora de enviar. Acima de qualquer limite o envio é pulado em
 *   silêncio e a resposta da API continua igual.
 */
@Injectable()
export class EmailGuardService {
  private readonly logger = new Logger(EmailGuardService.name);
  private lastCleanup = 0;

  constructor(
    @InjectRepository(EmailSendLogEntity)
    private readonly logs: Repository<EmailSendLogEntity>,
  ) {}

  async assertIpAllowed(ip: string) {
    if (!ip) return;
    if (
      (await this.recipientsFromIp(ip, new Date(Date.now() - HOUR_MS))) >=
      EMAIL_LIMITS.recipientsPerIpHour
    ) {
      this.logger.warn('Limite de e-mails por IP atingido.');
      throw new HttpException(
        'Muitas solicitações a partir desta conexão. Tente novamente mais tarde.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  async allow(email: string, ip: string, purpose: EmailPurpose) {
    const recipientHash = createHash('sha256')
      .update(
        String(email || '')
          .trim()
          .toLowerCase(),
      )
      .digest('hex');
    const now = Date.now();
    const hourAgo = new Date(now - HOUR_MS);

    const [lastHour, lastDay] = await Promise.all([
      this.logs.count({
        where: { recipientHash, createdAt: MoreThan(hourAgo) },
      }),
      this.logs.count({
        where: { recipientHash, createdAt: MoreThan(new Date(now - DAY_MS)) },
      }),
    ]);
    if (
      lastHour >= EMAIL_LIMITS.perRecipientHour ||
      lastDay >= EMAIL_LIMITS.perRecipientDay
    ) {
      this.logger.warn(
        `Limite de e-mails por destinatário atingido (${purpose}).`,
      );
      return false;
    }

    if (
      ip &&
      (await this.recipientsFromIp(ip, hourAgo, recipientHash)) >=
        EMAIL_LIMITS.recipientsPerIpHour
    ) {
      this.logger.warn(`Limite de e-mails por IP atingido (${purpose}).`);
      return false;
    }

    await this.logs.insert({
      recipientHash,
      ip: String(ip || '').slice(0, 64),
      purpose,
    });
    await this.cleanup(now);
    return true;
  }

  /** Endereços diferentes que receberam e-mail a pedido deste IP. */
  private async recipientsFromIp(
    ip: string,
    since: Date,
    exceptRecipient?: string,
  ) {
    const query = this.logs
      .createQueryBuilder('log')
      .select('COUNT(DISTINCT log.recipient_hash)', 'count')
      .where('log.ip = :ip', { ip })
      .andWhere('log.created_at > :since', { since });
    if (exceptRecipient) {
      query.andWhere('log.recipient_hash <> :exceptRecipient', {
        exceptRecipient,
      });
    }
    const row = await query.getRawOne<{ count: string }>();
    return Number(row?.count || 0);
  }

  /** Mantém só os últimos 2 dias; roda no máximo uma vez por hora. */
  private async cleanup(now: number) {
    if (now - this.lastCleanup < HOUR_MS) return;
    this.lastCleanup = now;
    await this.logs
      .delete({ createdAt: LessThan(new Date(now - 2 * DAY_MS)) })
      .catch(() => undefined);
  }
}
