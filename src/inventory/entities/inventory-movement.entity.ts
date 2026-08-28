import { Check, Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TimestampedEntity } from '../../persistence/timestamped.entity';

export type InventoryMovementType =
  'sale' | 'cancellation' | 'return' | 'manual_adjustment';

@Entity({ name: 'inventory_movements' })
@Index('idx_inventory_movements_order_id', ['orderId'])
@Index('idx_inventory_movements_product_id', ['productId'])
@Check('ck_inventory_movements_quantity', 'quantity <> 0')
@Check(
  'ck_inventory_movements_type',
  `"type" IN ('sale', 'cancellation', 'return', 'manual_adjustment')`,
)
export class InventoryMovementEntity extends TimestampedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    name: 'idempotency_key',
    type: 'varchar',
    length: 180,
    unique: true,
  })
  idempotencyKey: string;

  @Column({ name: 'order_id', type: 'uuid', nullable: true })
  orderId: string | null;

  @Column({ name: 'order_item_id', type: 'integer', nullable: true })
  orderItemId: number | null;

  @Column({ name: 'product_id', type: 'integer' })
  productId: number;

  @Column({ name: 'product_color_id', type: 'integer', nullable: true })
  productColorId: number | null;

  @Column({ type: 'varchar', length: 20 })
  size: string;

  @Column({ type: 'integer' })
  quantity: number;

  @Column({ type: 'varchar', length: 30 })
  type: InventoryMovementType;

  @Column({ type: 'text', default: '' })
  reason: string;
}
