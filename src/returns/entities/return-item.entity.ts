import {
  Check,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { decimalTransformer } from '../../persistence/column-transformers';
import { OrderItemEntity } from '../../orders/entities/order-item.entity';
import { ReturnRequestEntity } from './return-request.entity';

@Entity({ name: 'return_request_items' })
@Check('ck_return_request_items_quantity', 'quantity > 0')
export class ReturnItemEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'request_id', type: 'uuid' })
  requestId: string;

  @ManyToOne(() => ReturnRequestEntity, (request) => request.items, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'request_id',
    foreignKeyConstraintName: 'fk_return_item_request',
  })
  request: ReturnRequestEntity;

  @Column({ name: 'order_item_id', type: 'integer' })
  orderItemId: number;

  @ManyToOne(() => OrderItemEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'order_item_id',
    foreignKeyConstraintName: 'fk_return_item_order_item',
  })
  orderItem: OrderItemEntity;

  @Column({ type: 'integer' })
  quantity: number;

  @Column({
    name: 'unit_refund_value',
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: decimalTransformer,
  })
  unitRefundValue: number;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  condition: 'pending' | 'resellable' | 'damaged';
}
