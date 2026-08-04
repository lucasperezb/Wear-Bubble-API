import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ReturnRequestEntity } from './return-request.entity';

@Entity({ name: 'return_request_events' })
@Index('idx_return_events_request_id', ['requestId'])
export class ReturnEventEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'request_id', type: 'uuid' })
  requestId: string;

  @ManyToOne(() => ReturnRequestEntity, (request) => request.events, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'request_id',
    foreignKeyConstraintName: 'fk_return_event_request',
  })
  request: ReturnRequestEntity;

  @Column({ type: 'varchar', length: 40 })
  status: string;

  @Column({ type: 'varchar', length: 180 })
  label: string;

  @Column({ type: 'text', default: '' })
  message: string;

  @Column({ name: 'actor_type', type: 'varchar', length: 20 })
  actorType: 'customer' | 'manager' | 'system';

  @Column({ name: 'visible_to_customer', type: 'boolean', default: true })
  visibleToCustomer: boolean;

  @Column({
    name: 'occurred_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  occurredAt: Date;
}
