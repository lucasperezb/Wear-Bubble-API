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

@Entity({ name: 'password_reset_tokens' })
@Index('idx_password_reset_tokens_user_created', ['userUid', 'createdAt'])
@Index('uq_password_reset_tokens_hash', ['tokenHash'], { unique: true })
export class PasswordResetTokenEntity extends TimestampedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_uid', type: 'uuid' })
  userUid: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'user_uid',
    referencedColumnName: 'uid',
    foreignKeyConstraintName: 'fk_password_reset_tokens_user',
  })
  user: UserEntity;

  @Column({ name: 'token_hash', type: 'varchar', length: 64 })
  tokenHash: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ name: 'used_at', type: 'timestamptz', nullable: true })
  usedAt: Date | null;
}
