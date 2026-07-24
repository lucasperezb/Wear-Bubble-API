import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Response } from 'express';
import { Repository } from 'typeorm';
import { UsersService } from '../users/users.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { AddressEntity } from './entities/address.entity';
import { DeletionReportEntity } from './entities/deletion-report.entity';
import { ProfileEntity } from './entities/profile.entity';

@Injectable()
export class AccountService {
  constructor(
    @InjectRepository(ProfileEntity)
    private readonly profiles: Repository<ProfileEntity>,
    @InjectRepository(AddressEntity)
    private readonly addresses: Repository<AddressEntity>,
    @InjectRepository(DeletionReportEntity)
    private readonly reports: Repository<DeletionReportEntity>,
    private readonly users: UsersService,
  ) {}

  async get(uid: string) {
    const profile = await this.profiles.findOneBy({ uid });
    return profile ? this.profileResponse(profile) : {};
  }

  async update(uid: string, dto: UpdateAccountDto) {
    const row = await this.profiles.findOneBy({ uid });
    if (!row) return {};
    const allowed = ['name', 'taxId', 'phone'] as const;
    for (const key of allowed)
      if (key in (dto || {})) row[key] = String(dto[key] ?? '');
    await this.profiles.save(row);
    return this.profileResponse(row);
  }

  async listAddresses(uid: string) {
    return (
      await this.addresses.find({
        where: { userUid: uid },
        order: { isDefault: 'DESC', createdAt: 'ASC' },
      })
    ).map((address) => this.addressResponse(address));
  }

  async createAddress(uid: string, dto: CreateAddressDto) {
    const count = await this.addresses.countBy({ userUid: uid });
    const makeDefault = Boolean(dto.isDefault) || count === 0;
    if (makeDefault)
      await this.addresses.update({ userUid: uid }, { isDefault: false });
    const address = await this.addresses.save(
      this.addresses.create({
        userUid: uid,
        label: String(dto.label || 'Casa').trim() || 'Casa',
        cep: dto.cep,
        street: dto.street,
        neighborhood: dto.neighborhood,
        number: dto.number,
        reference: dto.reference || '',
        city: dto.city,
        state: dto.state,
        isDefault: makeDefault,
      }),
    );
    return this.addressResponse(address);
  }

  async updateAddress(uid: string, id: string, dto: UpdateAddressDto) {
    const address = await this.addresses.findOneBy({ id, userUid: uid });
    if (!address) throw new NotFoundException('Endereco nao encontrado.');
    if (dto.isDefault)
      await this.addresses.update({ userUid: uid }, { isDefault: false });
    const textFields = [
      'label',
      'cep',
      'street',
      'neighborhood',
      'number',
      'reference',
      'city',
      'state',
    ] as const;
    for (const key of textFields)
      if (key in dto) address[key] = String(dto[key] ?? '');
    if ('isDefault' in dto) address.isDefault = Boolean(dto.isDefault);
    const saved = await this.addresses.save(address);
    return this.addressResponse(saved);
  }

  async deleteAddress(uid: string, id: string) {
    const address = await this.addresses.findOneBy({ id, userUid: uid });
    if (!address) throw new NotFoundException('Endereco nao encontrado.');
    await this.addresses.remove(address);
    if (address.isDefault) {
      const next = await this.addresses.findOne({
        where: { userUid: uid },
        order: { createdAt: 'ASC' },
      });
      if (next) {
        next.isDefault = true;
        await this.addresses.save(next);
      }
    }
    return { ok: true };
  }

  async delete(uid: string, res: Response) {
    await this.users.delete(uid);
    const protocol = `DEL-${Date.now().toString(36).toUpperCase()}`;
    await this.reports.save(
      this.reports.create({
        protocol,
        requestedAt: new Date(),
        maskedId: `${uid.slice(0, 4)}...`,
      }),
    );
    res.clearCookie('bubble_token');
    return { protocol };
  }

  private profileResponse(profile: ProfileEntity) {
    const { uid, name, email, taxId, phone } = profile;
    return { uid, name, email, taxId, phone };
  }

  private addressResponse(address: AddressEntity) {
    const {
      id,
      label,
      cep,
      street,
      neighborhood,
      number,
      reference,
      city,
      state,
      isDefault,
    } = address;
    return {
      id,
      label,
      cep,
      street,
      neighborhood,
      number,
      reference,
      city,
      state,
      isDefault,
    };
  }
}
