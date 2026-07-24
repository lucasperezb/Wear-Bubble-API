import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TimestampedEntity } from '../../persistence/timestamped.entity';
import { UserEntity } from '../../users/entities/user.entity';

@Entity({ name: 'login_codes' })
@Index('idx_login_codes_user_created', ['userUid', 'createdAt'])
export class LoginCodeEntity extends TimestampedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_uid', type: 'uuid' })
  userUid: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'user_uid',
    referencedColumnName: 'uid',
    foreignKeyConstraintName: 'fk_login_codes_user',
  })
  user: UserEntity;

  @Column({ name: 'code_hash', type: 'varchar', length: 64 })
  codeHash: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ type: 'smallint', default: 0 })
  attempts: number;

  @Column({ name: 'used_at', type: 'timestamptz', nullable: true })
  usedAt: Date | null;
}
