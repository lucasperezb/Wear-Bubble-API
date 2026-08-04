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
import { UserEntity } from '../../users/entities/user.entity';
import { ReturnRequestEntity } from './return-request.entity';

@Entity({ name: 'store_credits' })
@Index('idx_store_credits_customer_uid', ['customerUid'])
export class StoreCreditEntity extends TimestampedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 40, unique: true })
  code: string;

  @Column({ name: 'customer_uid', type: 'uuid' })
  customerUid: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'customer_uid',
    referencedColumnName: 'uid',
    foreignKeyConstraintName: 'fk_store_credit_customer',
  })
  customer: UserEntity;

  @Column({ name: 'return_request_id', type: 'uuid', unique: true })
  returnRequestId: string;

  @ManyToOne(() => ReturnRequestEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'return_request_id',
    foreignKeyConstraintName: 'fk_store_credit_return_request',
  })
  returnRequest: ReturnRequestEntity;

  @Column({
    name: 'initial_amount',
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: decimalTransformer,
  })
  initialAmount: number;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: decimalTransformer,
  })
  balance: number;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status: 'active' | 'used' | 'expired' | 'canceled';

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;
}
