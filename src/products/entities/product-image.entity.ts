import {
  Check,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { TimestampedEntity } from '../../persistence/timestamped.entity';
import { ProductEntity } from './product.entity';

@Entity({ name: 'product_images' })
@Check('ck_product_images_position', 'position >= 0')
export class ProductImageEntity extends TimestampedEntity {
  @PrimaryColumn({ type: 'uuid' })
  id: string;

  @Column({ name: 'product_id', type: 'integer' })
  productId: number;

  @ManyToOne(() => ProductEntity, (product) => product.images, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'product_id',
    foreignKeyConstraintName: 'fk_product_images_product',
  })
  product?: ProductEntity;

  @Column({ name: 'storage_path', type: 'text', nullable: true })
  storagePath: string | null;

  @Column({ type: 'text' })
  url: string;

  @Column({ name: 'alt_text', type: 'varchar', length: 180, default: '' })
  altText: string;

  @Column({ type: 'integer', default: 0 })
  position: number;

  @Column({ name: 'is_primary', type: 'boolean', default: false })
  isPrimary: boolean;
}
