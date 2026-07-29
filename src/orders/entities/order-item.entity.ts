import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ProductEntity } from '../../products/entities/product.entity';
import { decimalTransformer } from '../../persistence/column-transformers';
import { OrderEntity } from './order.entity';

@Entity({ name: 'order_items' })
@Index('idx_order_items_order_id', ['orderId'])
@Index('idx_order_items_product_id', ['productId'])
@Check('ck_order_items_quantity', 'quantity > 0')
export class OrderItemEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'order_id', type: 'uuid' })
  orderId: string;

  @ManyToOne(() => OrderEntity, (order) => order.items, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'order_id',
    foreignKeyConstraintName: 'fk_order_items_order',
  })
  order: OrderEntity;

  @Column({ name: 'product_id', type: 'integer', nullable: true })
  productId: number | null;

  @ManyToOne(() => ProductEntity, (product) => product.orderItems, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({
    name: 'product_id',
    foreignKeyConstraintName: 'fk_order_items_product',
  })
  product?: ProductEntity | null;

  @Column({ name: 'product_name', type: 'varchar', length: 180 })
  productName: string;

  @Column({ type: 'varchar', length: 20 })
  size: string;

  @Column({ type: 'varchar', length: 100, default: '' })
  color: string;

  @Column({ type: 'integer' })
  quantity: number;

  @Column({
    name: 'unit_price',
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: decimalTransformer,
  })
  unitPrice: number;
}
