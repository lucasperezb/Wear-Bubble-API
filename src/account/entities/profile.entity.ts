import { Column, Entity, JoinColumn, OneToOne, PrimaryColumn } from 'typeorm';
import { UserEntity } from '../../users/entities/user.entity';
import { TimestampedEntity } from '../../persistence/timestamped.entity';

@Entity({ name: 'profiles' })
export class ProfileEntity extends TimestampedEntity {
  @PrimaryColumn({ type: 'uuid' })
  uid: string;

  @OneToOne(() => UserEntity, (user) => user.profile, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'uid',
    referencedColumnName: 'uid',
    foreignKeyConstraintName: 'fk_profiles_user',
  })
  user: UserEntity;

  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Column({ name: 'tax_id', type: 'varchar', length: 18, default: '' })
  taxId: string;

  @Column({ type: 'varchar', length: 30, default: '' })
  phone: string;
}
