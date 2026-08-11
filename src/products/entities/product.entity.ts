import {
  Check,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
} from 'typeorm';
import { OrderItemEntity } from '../../orders/entities/order-item.entity';
import { decimalTransformer } from '../../persistence/column-transformers';
import { TimestampedEntity } from '../../persistence/timestamped.entity';
import { ProductColorEntity } from './product-color.entity';
import { ProductImageEntity } from './product-image.entity';

@Entity({ name: 'products' })
@Check('ck_products_stock', 'stock >= 0')
@Check('ck_products_promo_pct', 'promo_pct BETWEEN 0 AND 90')
export class ProductEntity extends TimestampedEntity {
  @PrimaryColumn({ type: 'integer' })
  id: number;

  @Column({ type: 'varchar', length: 180 })
  name: string;

  @Column({ type: 'varchar', length: 100 })
  cat: string;

  @Column({ type: 'varchar', length: 100, default: '' })
  sub: string;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: decimalTransformer,
  })
  price: number;

  @Column({ name: 'promo_pct', type: 'smallint', default: 0 })
  promoPct: number;

  @Column({ type: 'varchar', length: 100, default: '' })
  tag: string;

  @Column({ type: 'varchar', length: 80, default: '' })
  icon: string;

  @Column({
    type: 'numeric',
    precision: 3,
    scale: 2,
    default: 0,
    transformer: decimalTransformer,
  })
  rating: number;

  @Column({ type: 'integer', default: 0 })
  reviews: number;

  @Column({ type: 'integer', default: 0 })
  stock: number;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @Column({ type: 'text', array: true, default: '{}' })
  sizes: string[];

  @Column({ type: 'varchar', length: 180, default: '' })
  material: string;

  @Column({ name: 'pair_id', type: 'integer', nullable: true })
  pairId: number | null;

  @Column({ name: 'bundle_position', type: 'smallint', nullable: true })
  bundlePosition: number | null;

  @Column({ name: 'catalog_position', type: 'integer', default: 0 })
  catalogPosition: number;

  @ManyToOne(() => ProductEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'pair_id', foreignKeyConstraintName: 'fk_products_pair' })
  pairedProduct?: ProductEntity | null;

  @Column({ type: 'text', array: true, default: '{}' })
  sports: string[];

  @OneToMany(() => ProductColorEntity, (color) => color.product, {
    cascade: true,
    eager: true,
  })
  colors: ProductColorEntity[];

  @Column({ name: 'description', type: 'text', default: '' })
  desc: string;

  @Column({ type: 'text', nullable: true })
  image: string | null;

  @OneToMany(() => ProductImageEntity, (image) => image.product, {
    eager: true,
  })
  images: ProductImageEntity[];

  @OneToMany(() => OrderItemEntity, (item) => item.product)
  orderItems?: OrderItemEntity[];
}
