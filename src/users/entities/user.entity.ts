import {
  Check,
  Column,
  Entity,
  OneToMany,
  OneToOne,
  PrimaryColumn,
} from 'typeorm';
import { AddressEntity } from '../../account/entities/address.entity';
import { ProfileEntity } from '../../account/entities/profile.entity';
import { EventEntity } from '../../events/entities/event.entity';
import { LeadEntity } from '../../leads/entities/lead.entity';
import { OrderEntity } from '../../orders/entities/order.entity';
import { TimestampedEntity } from '../../persistence/timestamped.entity';
import { Role } from '../users.types';

@Entity({ name: 'users' })
@Check('ck_users_role', `"role" IN ('customer', 'manager')`)
export class UserEntity extends TimestampedEntity {
  @PrimaryColumn({ type: 'uuid' })
  uid: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ name: 'password_hash', type: 'varchar', length: 255 })
  passwordHash: string;

  @Column({ type: 'varchar', length: 20, default: 'customer' })
  role: Role;

  @Column({ name: 'marketing_opt_in', type: 'boolean', default: false })
  marketingOptIn: boolean;

  @Column({ name: 'email_verified', type: 'boolean', default: false })
  emailVerified: boolean;

  @Column({ name: 'token_version', type: 'int', default: 0 })
  tokenVersion: number;

  @OneToOne(() => ProfileEntity, (profile) => profile.user)
  profile?: ProfileEntity;

  @OneToMany(() => AddressEntity, (address) => address.user)
  addresses?: AddressEntity[];

  @OneToMany(() => OrderEntity, (order) => order.customer)
  orders?: OrderEntity[];

  @OneToMany(() => EventEntity, (event) => event.actor)
  events?: EventEntity[];

  @OneToMany(() => LeadEntity, (lead) => lead.user)
  leads?: LeadEntity[];
}
