import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { decimalTransformer } from '../../persistence/column-transformers';
import { TimestampedEntity } from '../../persistence/timestamped.entity';
import { StoreCreditEntity } from '../../returns/entities/store-credit.entity';

@Entity({ name: 'store_credit_allocations' })
@Index('idx_store_credit_allocations_reservation', ['reservationId'])
export class StoreCreditAllocationEntity extends TimestampedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'reservation_id', type: 'uuid' })
  reservationId: string;

  @Column({ name: 'credit_id', type: 'uuid' })
  creditId: string;

  @ManyToOne(() => StoreCreditEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'credit_id',
    foreignKeyConstraintName: 'fk_store_credit_allocation_credit',
  })
  credit: StoreCreditEntity;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: decimalTransformer,
  })
  amount: number;

  @Column({
    name: 'released_amount',
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: decimalTransformer,
  })
  releasedAmount: number;
}
