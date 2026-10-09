import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** Registro de e-mails disparados a pedido de visitantes, para limitar abuso. */
@Entity({ name: 'email_send_log' })
@Index('idx_email_send_log_recipient', ['recipientHash', 'createdAt'])
@Index('idx_email_send_log_ip', ['ip', 'createdAt'])
export class EmailSendLogEntity {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: string;

  /** sha256 do e-mail: conta envios sem guardar o endereço em claro. */
  @Column({ name: 'recipient_hash', type: 'varchar', length: 64 })
  recipientHash: string;

  @Column({ type: 'varchar', length: 64, default: '' })
  ip: string;

  @Column({ type: 'varchar', length: 30 })
  purpose: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
