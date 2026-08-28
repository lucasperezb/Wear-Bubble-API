import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { OrderItemEntity } from '../../orders/entities/order-item.entity';
import { OrderEntity } from '../../orders/entities/order.entity';
import { ProductColorEntity } from '../../products/entities/product-color.entity';
import { ProductEntity } from '../../products/entities/product.entity';
import { TimestampedEntity } from '../../persistence/timestamped.entity';

export type InventoryReservationStatus =
  'active' | 'committed' | 'released' | 'conflict';

@Entity({ name: 'inventory_reservations' })
@Index('idx_inventory_reservations_order_id', ['orderId'])
@Index('idx_inventory_reservations_variant', [
  'productId',
  'productColorId',
  'size',
  'status',
  'expiresAt',
])
@Check('ck_inventory_reservations_quantity', 'quantity > 0')
@Check(
  'ck_inventory_reservations_status',
  `"status" IN ('active', 'committed', 'released', 'conflict')`,
)
export class InventoryReservationEntity extends TimestampedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'order_id', type: 'uuid' })
  orderId: string;

  @ManyToOne(() => OrderEntity, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'order_id',
    foreignKeyConstraintName: 'fk_inventory_reservations_order',
  })
  order: OrderEntity;

  @Column({ name: 'order_item_id', type: 'integer', unique: true })
  orderItemId: number;

  @ManyToOne(() => OrderItemEntity, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'order_item_id',
    foreignKeyConstraintName: 'fk_inventory_reservations_order_item',
  })
  orderItem: OrderItemEntity;

  @Column({ name: 'product_id', type: 'integer' })
  productId: number;

  @ManyToOne(() => ProductEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'product_id',
    foreignKeyConstraintName: 'fk_inventory_reservations_product',
  })
  product: ProductEntity;

  @Column({ name: 'product_color_id', type: 'integer', nullable: true })
  productColorId: number | null;

  @ManyToOne(() => ProductColorEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({
    name: 'product_color_id',
    foreignKeyConstraintName: 'fk_inventory_reservations_product_color',
  })
  productColor?: ProductColorEntity | null;

  @Column({ type: 'varchar', length: 20 })
  size: string;

  @Column({ type: 'integer' })
  quantity: number;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status: InventoryReservationStatus;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ name: 'committed_at', type: 'timestamptz', nullable: true })
  committedAt: Date | null;

  @Column({ name: 'released_at', type: 'timestamptz', nullable: true })
  releasedAt: Date | null;
}
