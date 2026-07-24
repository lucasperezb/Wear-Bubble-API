import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { UserEntity } from '../../users/entities/user.entity';
import { TimestampedEntity } from '../../persistence/timestamped.entity';

@Entity({ name: 'addresses' })
@Index('idx_addresses_user', ['userUid'])
export class AddressEntity extends TimestampedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_uid', type: 'uuid' })
  userUid: string;

  @ManyToOne(() => UserEntity, (user) => user.addresses, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'user_uid',
    referencedColumnName: 'uid',
    foreignKeyConstraintName: 'fk_addresses_user',
  })
  user: UserEntity;

  @Column({ type: 'varchar', length: 60, default: 'Casa' })
  label: string;

  @Column({ type: 'varchar', length: 12 })
  cep: string;

  @Column({ type: 'varchar', length: 255 })
  street: string;

  @Column({ type: 'varchar', length: 120 })
  neighborhood: string;

  @Column({ type: 'varchar', length: 30 })
  number: string;

  @Column({ type: 'varchar', length: 255, default: '' })
  reference: string;

  @Column({ type: 'varchar', length: 120 })
  city: string;

  @Column({ type: 'varchar', length: 2 })
  state: string;

  @Column({ name: 'is_default', type: 'boolean', default: false })
  isDefault: boolean;
}
