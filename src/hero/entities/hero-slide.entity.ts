import { Check, Column, Entity, PrimaryColumn } from 'typeorm';
import { TimestampedEntity } from '../../persistence/timestamped.entity';

@Entity({ name: 'hero_slides' })
@Check('ck_hero_slides_position', 'position >= 0')
export class HeroSlideEntity extends TimestampedEntity {
  @PrimaryColumn({ type: 'uuid' })
  id: string;

  @Column({ name: 'storage_path', type: 'text' })
  storagePath: string;

  @Column({ name: 'image_url', type: 'text' })
  imageUrl: string;

  @Column({ name: 'link_url', type: 'varchar', length: 500 })
  linkUrl: string;

  @Column({ name: 'alt_text', type: 'varchar', length: 180, default: '' })
  altText: string;

  @Column({ type: 'integer', default: 0 })
  position: number;

  @Column({ type: 'boolean', default: true })
  active: boolean;
}
