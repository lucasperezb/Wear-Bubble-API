import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'node:crypto';
import { Repository } from 'typeorm';
import { CreateLeadDto } from './dto/create-lead.dto';
import { LeadEntity } from './entities/lead.entity';

const sha256 = (value: string) =>
  createHash('sha256').update(value).digest('hex');

@Injectable()
export class LeadsService {
  constructor(
    @InjectRepository(LeadEntity)
    private readonly leads: Repository<LeadEntity>,
  ) {}

  async create(dto: CreateLeadDto) {
    const email = String(dto?.email || '')
      .trim()
      .toLowerCase();
    if (!email || !email.includes('@'))
      throw new BadRequestException('E-mail invalido.');
    const hash = sha256(email);
    if (!(await this.leads.existsBy({ hash }))) {
      await this.leads.save(
        this.leads.create({
          hash,
          email,
          consent: true,
          source: dto?.source || 'clube',
          joinedAt: new Date(),
          userUid: null,
        }),
      );
    }
    return { ok: true, coupon: 'BUBBLE10' };
  }
}
