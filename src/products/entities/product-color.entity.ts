import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ProductEntity } from './product.entity';

@Entity({ name: 'product_colors' })
@Index('idx_product_colors_product_id', ['productId'])
export class ProductColorEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'product_id', type: 'integer' })
  productId: number;

  @ManyToOne(() => ProductEntity, (product) => product.colors, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'product_id',
    foreignKeyConstraintName: 'fk_product_colors_product',
  })
  product: ProductEntity;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 20 })
  hex: string;

  @Column({ type: 'smallint', default: 0 })
  position: number;
}
