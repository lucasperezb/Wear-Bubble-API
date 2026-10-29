import { Column, Entity, PrimaryColumn } from 'typeorm';
import { TimestampedEntity } from '../../persistence/timestamped.entity';
import type { FizzLayoutConfig, HomeLayoutKey } from '../home-layout.types';

/**
 * Linha única (id = 1): qual layout da página inicial está no ar e as peças
 * escolhidas para o layout da coleção de verão. As peças do layout padrão
 * continuam nas vitrines (product_showcases: hero + home).
 */
@Entity({ name: 'home_layout_settings' })
export class HomeLayoutEntity extends TimestampedEntity {
  @PrimaryColumn({ type: 'integer' })
  id: number;

  @Column({ type: 'varchar', length: 20, default: 'padrao' })
  active: HomeLayoutKey;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  fizz: Partial<FizzLayoutConfig>;
}
