import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProfileEntity } from '../account/entities/profile.entity';
import { AddressEntity } from '../account/entities/address.entity';
import { UsersService } from '../users/users.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly users: UsersService,
    @InjectRepository(ProfileEntity)
    private readonly profiles: Repository<ProfileEntity>,
    @InjectRepository(AddressEntity)
    private readonly addresses: Repository<AddressEntity>,
  ) {}

  async customers() {
    const [users, profiles, addresses] = await Promise.all([
      this.users.findAll(),
      this.profiles.find(),
      this.addresses.find({ order: { isDefault: 'DESC' } }),
    ]);
    const primaryAddress = new Map<string, AddressEntity>();
    for (const address of addresses)
      if (!primaryAddress.has(address.userUid))
        primaryAddress.set(address.userUid, address);
    const mask = (email?: string) =>
      email ? `${email[0]}***@${email.split('@')[1]}` : '';
    return {
      users: users.map((user) => ({
        uid: user.uid,
        role: user.role,
        marketingOptIn: user.marketingOptIn,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt.getTime(),
      })),
      profiles: profiles.map((profile) => ({
        uid: profile.uid,
        name: profile.name,
        email: mask(profile.email),
        city: primaryAddress.get(profile.uid)?.city || '',
      })),
    };
  }
}
