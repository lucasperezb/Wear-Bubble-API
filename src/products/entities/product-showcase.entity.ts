import { Check, Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { ProductEntity } from './product.entity';

@Entity({ name: 'product_showcases' })
@Check('ck_product_showcases_position', 'position BETWEEN 1 AND 4')
export class ProductShowcaseEntity {
  @PrimaryColumn({ name: 'page_key', type: 'varchar', length: 40 })
  pageKey: string;

  @PrimaryColumn({ type: 'smallint' })
  position: number;

  @Column({ name: 'product_id', type: 'integer' })
  productId: number;

  @ManyToOne(() => ProductEntity, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id', foreignKeyConstraintName: 'fk_product_showcases_product' })
  product: ProductEntity;
}
