import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { OrderEntity } from '../../../orders/entities/order.entity';
import { decimalTransformer } from '../../../persistence/column-transformers';
import { TimestampedEntity } from '../../../persistence/timestamped.entity';

@Entity({ name: 'order_shipments' })
@Index('uq_order_shipments_order_package', ['orderId', 'packageIndex'], {
  unique: true,
})
@Index('uq_order_shipments_provider_order_id', ['providerOrderId'], {
  unique: true,
  where: 'provider_order_id IS NOT NULL',
})
export class OrderShipmentEntity extends TimestampedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'order_id', type: 'uuid' })
  orderId: string;

  @ManyToOne(() => OrderEntity, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'order_id',
    foreignKeyConstraintName: 'fk_order_shipments_order',
  })
  order?: OrderEntity;

  @Column({ name: 'package_index', type: 'smallint', default: 0 })
  packageIndex: number;

  @Column({ name: 'provider_order_id', type: 'uuid', nullable: true })
  providerOrderId: string | null;

  @Column({ type: 'varchar', length: 40, default: 'draft' })
  status: string;

  @Column({ name: 'service_id', type: 'integer' })
  serviceId: number;

  @Column({ name: 'service_name', type: 'varchar', length: 80 })
  serviceName: string;

  @Column({ type: 'varchar', length: 80, default: 'Correios' })
  carrier: string;

  @Column({
    name: 'carrier_price',
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: decimalTransformer,
  })
  carrierPrice: number;

  @Column({ name: 'invoice_key', type: 'varchar', length: 60, nullable: true })
  invoiceKey: string | null;

  @Column({ type: 'jsonb' })
  volume: Record<string, unknown>;

  @Column({ type: 'varchar', length: 120, nullable: true })
  protocol: string | null;

  @Column({
    name: 'authorization_code',
    type: 'varchar',
    length: 120,
    nullable: true,
  })
  authorizationCode: string | null;

  @Column({ type: 'varchar', length: 160, nullable: true })
  tracking: string | null;

  @Column({ name: 'tracking_url', type: 'text', nullable: true })
  trackingUrl: string | null;

  @Column({ name: 'print_url', type: 'text', nullable: true })
  printUrl: string | null;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError: string | null;

  @Column({ type: 'integer', default: 0 })
  attempts: number;

  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true })
  paidAt: Date | null;

  @Column({ name: 'generated_at', type: 'timestamptz', nullable: true })
  generatedAt: Date | null;

  @Column({ name: 'posted_at', type: 'timestamptz', nullable: true })
  postedAt: Date | null;

  @Column({ name: 'delivered_at', type: 'timestamptz', nullable: true })
  deliveredAt: Date | null;

  @Column({ name: 'canceled_at', type: 'timestamptz', nullable: true })
  canceledAt: Date | null;
}
