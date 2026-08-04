import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { decimalTransformer } from '../../persistence/column-transformers';
import { TimestampedEntity } from '../../persistence/timestamped.entity';
import { OrderEntity } from '../../orders/entities/order.entity';
import { UserEntity } from '../../users/entities/user.entity';
import { ReturnEventEntity } from './return-event.entity';
import { ReturnItemEntity } from './return-item.entity';

export type ReturnKind = 'exchange' | 'return' | 'defect';
export type ReturnStatus =
  | 'requested'
  | 'approved'
  | 'awaiting_posting'
  | 'returning'
  | 'received'
  | 'inspecting'
  | 'completed'
  | 'rejected'
  | 'canceled';

@Entity({ name: 'return_requests' })
@Index('idx_return_requests_order_id', ['orderId'])
@Index('idx_return_requests_customer_uid', ['customerUid'])
@Index('idx_return_requests_status', ['status'])
export class ReturnRequestEntity extends TimestampedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 30, unique: true })
  protocol: string;

  @Column({ name: 'order_id', type: 'uuid' })
  orderId: string;

  @ManyToOne(() => OrderEntity, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'order_id',
    foreignKeyConstraintName: 'fk_return_request_order',
  })
  order: OrderEntity;

  @Column({ name: 'customer_uid', type: 'uuid' })
  customerUid: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'customer_uid',
    referencedColumnName: 'uid',
    foreignKeyConstraintName: 'fk_return_request_customer',
  })
  customer: UserEntity;

  @Column({ type: 'varchar', length: 20 })
  kind: ReturnKind;

  @Column({ type: 'varchar', length: 40 })
  reason: string;

  @Column({ type: 'text', default: '' })
  details: string;

  @Column({ type: 'varchar', length: 30, default: 'requested' })
  status: ReturnStatus;

  @Column({ name: 'public_note', type: 'text', default: '' })
  publicNote: string;

  @Column({
    name: 'posting_code',
    type: 'varchar',
    length: 160,
    nullable: true,
  })
  postingCode: string | null;

  @Column({
    name: 'return_tracking',
    type: 'varchar',
    length: 160,
    nullable: true,
  })
  returnTracking: string | null;

  @Column({ name: 'posting_expires_at', type: 'timestamptz', nullable: true })
  postingExpiresAt: Date | null;

  @Column({ name: 'resolution', type: 'varchar', length: 20, nullable: true })
  resolution: 'credit' | 'refund' | null;

  @Column({
    name: 'resolution_amount',
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: decimalTransformer,
  })
  resolutionAmount: number;

  @Column({ name: 'credit_code', type: 'varchar', length: 40, nullable: true })
  creditCode: string | null;

  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true })
  approvedAt: Date | null;

  @Column({ name: 'posted_at', type: 'timestamptz', nullable: true })
  postedAt: Date | null;

  @Column({ name: 'received_at', type: 'timestamptz', nullable: true })
  receivedAt: Date | null;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt: Date | null;

  @OneToMany(() => ReturnItemEntity, (item) => item.request, {
    cascade: true,
    eager: true,
  })
  items: ReturnItemEntity[];

  @OneToMany(() => ReturnEventEntity, (event) => event.request, {
    cascade: true,
    eager: true,
  })
  events: ReturnEventEntity[];
}
