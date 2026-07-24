import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CouponRecord } from './coupon.types';
import { seedCoupons } from './coupon.seed';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';
import { CouponEntity } from './entities/coupon.entity';

@Injectable()
export class CouponsService implements OnModuleInit {
  constructor(
    @InjectRepository(CouponEntity)
    private readonly coupons: Repository<CouponEntity>,
  ) {}

  async onModuleInit() {
    if (await this.coupons.count()) return;
    await this.coupons.save(
      seedCoupons.map((data) =>
        this.coupons.create({
          code: data.code,
          pct: data.pct,
          active: data.active,
          expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
          maxUses: data.maxUses,
          minSubtotal: data.minSubtotal,
          assignedTo: data.assignedTo,
          uses: data.uses,
          createdAt: new Date(data.createdAt),
        }),
      ),
    );
  }

  async validate(codeParam: string) {
    const coupon = await this.getActive(codeParam);
    return {
      code: coupon.code,
      pct: coupon.pct,
      minSubtotal: coupon.minSubtotal || 0,
    };
  }

  async list() {
    return (await this.coupons.find({ order: { code: 'ASC' } })).map((row) =>
      this.toRecord(row),
    );
  }

  async create(dto: CreateCouponDto) {
    const code = String(dto?.code || '')
      .trim()
      .toUpperCase();
    if (!code) throw new BadRequestException('Codigo obrigatorio.');
    if (await this.coupons.existsBy({ code }))
      throw new ConflictException('Cupom ja existe.');
    const data: CouponRecord = {
      code,
      pct: Math.min(90, Math.max(0, Number(dto?.pct) || 0)),
      active: dto?.active !== false,
      expiresAt: dto?.expiresAt ? Number(dto.expiresAt) : null,
      maxUses: dto?.maxUses ? Number(dto.maxUses) : null,
      minSubtotal: Number(dto?.minSubtotal) || 0,
      assignedTo: dto?.assignedTo || '',
      uses: 0,
      createdAt: Date.now(),
    };
    const saved = await this.coupons.save(
      this.coupons.create({
        code,
        pct: data.pct,
        active: data.active,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        maxUses: data.maxUses,
        minSubtotal: data.minSubtotal,
        assignedTo: data.assignedTo,
        uses: data.uses,
      }),
    );
    return this.toRecord(saved);
  }

  async update(codeParam: string, dto: UpdateCouponDto) {
    const code = String(codeParam || '')
      .trim()
      .toUpperCase();
    const row = await this.coupons.findOneBy({ code });
    if (!row) throw new NotFoundException('Cupom nao encontrado.');
    const allowed = [
      'pct',
      'active',
      'maxUses',
      'minSubtotal',
      'assignedTo',
    ] as const;
    for (const key of allowed)
      if (key in dto) (row as any)[key] = (dto as any)[key];
    if ('expiresAt' in dto)
      row.expiresAt = dto.expiresAt ? new Date(Number(dto.expiresAt)) : null;
    await this.coupons.save(row);
    return this.toRecord(row);
  }

  async remove(codeParam: string) {
    const result = await this.coupons.delete({
      code: String(codeParam || '')
        .trim()
        .toUpperCase(),
    });
    return { removed: result.affected || 0 };
  }

  async getActive(codeParam: string): Promise<CouponRecord> {
    const code = String(codeParam || '')
      .trim()
      .toUpperCase();
    const row = await this.coupons.findOneBy({ code });
    if (!row) throw new NotFoundException('Cupom invalido.');
    const coupon = this.toRecord(row);
    if (!coupon.active) throw new BadRequestException('Cupom pausado.');
    if (coupon.expiresAt && Date.now() > coupon.expiresAt)
      throw new BadRequestException('Cupom expirado.');
    if (coupon.maxUses && coupon.uses >= coupon.maxUses)
      throw new BadRequestException('Cupom atingiu o limite de usos.');
    return coupon;
  }

  async increment(code: string, delta: number) {
    const row = await this.coupons.findOneBy({ code });
    if (!row) return;
    row.uses = Math.max(0, row.uses + delta);
    await this.coupons.save(row);
  }

  private toRecord(row: CouponEntity): CouponRecord {
    return {
      code: row.code,
      pct: row.pct,
      active: row.active,
      expiresAt: row.expiresAt?.getTime() || null,
      maxUses: row.maxUses,
      minSubtotal: row.minSubtotal,
      assignedTo: row.assignedTo,
      uses: row.uses,
      createdAt: row.createdAt.getTime(),
    };
  }
}
