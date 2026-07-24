import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { UserEntity } from '../../users/entities/user.entity';
import { TimestampedEntity } from '../../persistence/timestamped.entity';

@Entity({ name: 'leads' })
@Index('idx_leads_user_uid', ['userUid'])
export class LeadEntity extends TimestampedEntity {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  hash: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'boolean', default: true })
  consent: boolean;

  @Column({ type: 'varchar', length: 80, default: 'clube' })
  source: string;

  @Column({ name: 'joined_at', type: 'timestamptz' })
  joinedAt: Date;

  @Column({ name: 'user_uid', type: 'uuid', nullable: true })
  userUid: string | null;

  @ManyToOne(() => UserEntity, (user) => user.leads, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({
    name: 'user_uid',
    referencedColumnName: 'uid',
    foreignKeyConstraintName: 'fk_leads_user',
  })
  user?: UserEntity | null;
}
