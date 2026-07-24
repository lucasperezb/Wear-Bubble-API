import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
} from 'typeorm';
import { UserEntity } from '../../users/entities/user.entity';
import { CouponEntity } from '../../coupons/entities/coupon.entity';
import { decimalTransformer } from '../../persistence/column-transformers';
import { TimestampedEntity } from '../../persistence/timestamped.entity';
import { OrderItemEntity } from './order-item.entity';

@Entity({ name: 'orders' })
@Index('idx_orders_customer_uid', ['customerUid'])
@Index('idx_orders_coupon_code', ['couponCode'])
@Index('idx_orders_ordered_at', ['orderedAt'])
@Check('ck_orders_status', `"status" IN ('pending', 'paid', 'canceled')`)
@Check('ck_orders_ship_stage', 'ship_stage BETWEEN 0 AND 5')
export class OrderEntity extends TimestampedEntity {
  @PrimaryColumn({ type: 'uuid' })
  id: string;

  @Column({ name: 'customer_uid', type: 'uuid', nullable: true })
  customerUid: string | null;

  @ManyToOne(() => UserEntity, (user) => user.orders, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({
    name: 'customer_uid',
    referencedColumnName: 'uid',
    foreignKeyConstraintName: 'fk_orders_customer',
  })
  customer?: UserEntity | null;

  @Column({ type: 'varchar', length: 30, unique: true })
  number: string;

  @Column({ name: 'ordered_at', type: 'timestamptz' })
  orderedAt: Date;

  @Column({ name: 'customer_name', type: 'varchar', length: 150, default: '' })
  customerName: string;

  @Column({ name: 'customer_email', type: 'varchar', length: 255, default: '' })
  customerEmail: string;

  @Column({ name: 'customer_tax_id', type: 'varchar', length: 18, default: '' })
  customerTaxId: string;

  @Column({ name: 'customer_phone', type: 'varchar', length: 30, default: '' })
  customerPhone: string;

  @Column({ name: 'shipping_cep', type: 'varchar', length: 12, default: '' })
  shippingCep: string;

  @Column({
    name: 'shipping_street',
    type: 'varchar',
    length: 255,
    default: '',
  })
  shippingStreet: string;

  @Column({
    name: 'shipping_neighborhood',
    type: 'varchar',
    length: 120,
    default: '',
  })
  shippingNeighborhood: string;

  @Column({ name: 'shipping_number', type: 'varchar', length: 30, default: '' })
  shippingNumber: string;

  @Column({
    name: 'shipping_reference',
    type: 'varchar',
    length: 255,
    default: '',
  })
  shippingReference: string;

  @Column({ name: 'shipping_city', type: 'varchar', length: 120, default: '' })
  shippingCity: string;

  @Column({ name: 'shipping_state', type: 'varchar', length: 2, default: '' })
  shippingState: string;

  @OneToMany(() => OrderItemEntity, (item) => item.order, {
    cascade: true,
    eager: true,
  })
  items: OrderItemEntity[];

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: decimalTransformer,
  })
  total: number;

  @Column({ type: 'varchar', length: 40 })
  method: string;

  @Column({ name: 'coupon_code', type: 'varchar', length: 80, nullable: true })
  couponCode: string | null;

  @ManyToOne(() => CouponEntity, (coupon) => coupon.orders, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({
    name: 'coupon_code',
    referencedColumnName: 'code',
    foreignKeyConstraintName: 'fk_orders_coupon',
  })
  coupon?: CouponEntity | null;

  @Column({
    name: 'coupon_pct',
    type: 'numeric',
    precision: 5,
    scale: 2,
    default: 0,
    transformer: decimalTransformer,
  })
  couponPct: number;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: 'pending' | 'paid' | 'canceled';

  @Column({ name: 'ship_stage', type: 'smallint', default: 0 })
  shipStage: number;

  @Column({ type: 'varchar', length: 40, nullable: true })
  gateway: string | null;

  @Column({
    name: 'pagbank_checkout_id',
    type: 'varchar',
    length: 120,
    nullable: true,
  })
  pagbankCheckoutId: string | null;

  @Column({
    name: 'pagbank_payment_id',
    type: 'varchar',
    length: 120,
    nullable: true,
  })
  pagbankPaymentId: string | null;

  @Column({ type: 'varchar', length: 160, nullable: true })
  tracking: string | null;

  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true })
  paidAt: Date | null;
}
