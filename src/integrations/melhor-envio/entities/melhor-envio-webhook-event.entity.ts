import { Column, Entity, PrimaryColumn } from 'typeorm';
import { TimestampedEntity } from '../../../persistence/timestamped.entity';

@Entity({ name: 'melhor_envio_webhook_events' })
export class MelhorEnvioWebhookEventEntity extends TimestampedEntity {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id: string;

  @Column({ type: 'varchar', length: 60 })
  event: string;

  @Column({
    name: 'provider_order_id',
    type: 'varchar',
    length: 120,
    nullable: true,
  })
  providerOrderId: string | null;

  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>;

  @Column({ name: 'processed_at', type: 'timestamptz', nullable: true })
  processedAt: Date | null;
}
