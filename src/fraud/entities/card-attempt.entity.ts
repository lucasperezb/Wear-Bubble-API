import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Cada tentativa de pagamento com cartão, aprovada ou recusada. Pedidos com
 * cartão recusado são apagados, então este é o único rastro de quem testa
 * vários cartões. Nunca guarda o número: só os 4 últimos dígitos + validade.
 */
@Entity({ name: 'card_attempts' })
@Index('idx_card_attempts_customer', ['customerUid', 'createdAt'])
@Index('idx_card_attempts_tax_id', ['taxId', 'createdAt'])
@Index('idx_card_attempts_email', ['email', 'createdAt'])
export class CardAttemptEntity {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: string;

  @Column({ name: 'customer_uid', type: 'uuid', nullable: true })
  customerUid: string | null;

  @Column({ type: 'varchar', length: 255, default: '' })
  email: string;

  /** CPF só com dígitos. */
  @Column({ name: 'tax_id', type: 'varchar', length: 14, default: '' })
  taxId: string;

  /** "1234|12|30": 4 últimos dígitos | mês | ano da validade. */
  @Column({ name: 'card_fingerprint', type: 'varchar', length: 20 })
  cardFingerprint: string;

  @Column({ type: 'boolean' })
  approved: boolean;

  @Column({ type: 'varchar', length: 64, default: '' })
  ip: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
