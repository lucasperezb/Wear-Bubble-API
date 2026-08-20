import { Check, Column, Entity, OneToMany, PrimaryColumn } from 'typeorm';
import { OrderEntity } from '../../orders/entities/order.entity';
import { decimalTransformer } from '../../persistence/column-transformers';
import { TimestampedEntity } from '../../persistence/timestamped.entity';

@Entity({ name: 'coupons' })
@Check('ck_coupons_pct', 'pct >= 0 AND pct <= 99')
@Check('ck_coupons_uses', 'uses >= 0')
export class CouponEntity extends TimestampedEntity {
  @PrimaryColumn({ type: 'varchar', length: 80 })
  code: string;

  @Column({
    type: 'numeric',
    precision: 5,
    scale: 2,
    transformer: decimalTransformer,
  })
  pct: number;

  @Column({ name: 'minimum_charge', type: 'boolean', default: false })
  minimumCharge: boolean;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt: Date | null;

  @Column({ name: 'max_uses', type: 'integer', nullable: true })
  maxUses: number | null;

  @Column({ name: 'max_uses_per_customer', type: 'integer', nullable: true })
  maxUsesPerCustomer: number | null;

  @Column({
    name: 'min_subtotal',
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: decimalTransformer,
  })
  minSubtotal: number;

  @Column({ name: 'assigned_to', type: 'varchar', length: 255, default: '' })
  assignedTo: string;

  @Column({ type: 'integer', default: 0 })
  uses: number;

  @OneToMany(() => OrderEntity, (order) => order.coupon)
  orders?: OrderEntity[];
}
