import { Column, Entity, PrimaryColumn } from 'typeorm';
import { TimestampedEntity } from '../../persistence/timestamped.entity';

@Entity({ name: 'hero_config' })
export class HeroConfigEntity extends TimestampedEntity {
  @PrimaryColumn({ type: 'integer' })
  id: number;

  @Column({ type: 'boolean', default: false })
  enabled: boolean;
}
