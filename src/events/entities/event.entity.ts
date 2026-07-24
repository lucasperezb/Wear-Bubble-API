import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { UserEntity } from '../../users/entities/user.entity';
import { TimestampedEntity } from '../../persistence/timestamped.entity';
import { ProductEntity } from '../../products/entities/product.entity';

@Entity({ name: 'events' })
@Index('idx_events_product_id', ['productId'])
@Index('idx_events_actor_uid', ['actorUid'])
@Index('idx_events_occurred_at', ['occurredAt'])
export class EventEntity extends TimestampedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 80 })
  type: string;

  @Column({ name: 'product_id', type: 'integer', nullable: true })
  productId: number | null;

  @ManyToOne(() => ProductEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({
    name: 'product_id',
    foreignKeyConstraintName: 'fk_events_product',
  })
  product?: ProductEntity | null;

  @Column({ name: 'occurred_at', type: 'timestamptz' })
  occurredAt: Date;

  @Column({ name: 'actor_uid', type: 'uuid', nullable: true })
  actorUid: string | null;

  @ManyToOne(() => UserEntity, (user) => user.events, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({
    name: 'actor_uid',
    referencedColumnName: 'uid',
    foreignKeyConstraintName: 'fk_events_actor',
  })
  actor?: UserEntity | null;

  @Column({
    name: 'actor_label',
    type: 'varchar',
    length: 120,
    default: 'guest',
  })
  actorLabel: string;
}
