import { Column, Entity, PrimaryColumn } from 'typeorm';
import { TimestampedEntity } from '../../persistence/timestamped.entity';

/** Linha única (id = 1) com as chaves e faixas das promoções da loja. */
@Entity({ name: 'promotion_settings' })
export class PromotionSettingsEntity extends TimestampedEntity {
  @PrimaryColumn({ type: 'integer' })
  id: number;

  @Column({ name: 'individual_enabled', type: 'boolean', default: true })
  individualEnabled: boolean;

  @Column({ name: 'progressive_enabled', type: 'boolean', default: false })
  progressiveEnabled: boolean;

  @Column({
    name: 'progressive_tiers',
    type: 'jsonb',
    default: () => "'[10, 20, 30]'",
  })
  progressiveTiers: number[];

  @Column({ name: 'progressive_extend_last', type: 'boolean', default: true })
  progressiveExtendLast: boolean;

  @Column({ name: 'progressive_stack', type: 'boolean', default: false })
  progressiveStack: boolean;
}
