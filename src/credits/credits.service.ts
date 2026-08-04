import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StoreCreditEntity } from '../returns/entities/store-credit.entity';

@Injectable()
export class CreditsService {
  constructor(
    @InjectRepository(StoreCreditEntity)
    private readonly credits: Repository<StoreCreditEntity>,
  ) {}

  async validate(customerUid: string, codeParam: string) {
    const credit = await this.getActive(customerUid, codeParam);
    return {
      code: credit.code,
      value: credit.balance,
      balance: credit.balance,
      expiresAt: credit.expiresAt.getTime(),
      type: 'store_credit' as const,
    };
  }

  async reserve(customerUid: string, codeParam: string, maximum: number) {
    return this.credits.manager.transaction(async (manager) => {
      const repository = manager.getRepository(StoreCreditEntity);
      const credit = await repository.findOne({
        where: { code: this.normalize(codeParam) },
        lock: { mode: 'pessimistic_write' },
      });
      await this.assertActive(credit, customerUid, repository);
      const amount =
        Math.round(Math.min(credit!.balance, Math.max(0, maximum)) * 100) / 100;
      if (amount <= 0)
        throw new BadRequestException('Crédito sem saldo disponível.');
      credit!.balance = Math.round((credit!.balance - amount) * 100) / 100;
      if (credit!.balance === 0) credit!.status = 'used';
      await repository.save(credit!);
      return { code: credit!.code, amount };
    });
  }

  async release(code: string, amount: number) {
    if (amount <= 0) return;
    await this.credits.manager.transaction(async (manager) => {
      const repository = manager.getRepository(StoreCreditEntity);
      const credit = await repository.findOne({
        where: { code: this.normalize(code) },
        lock: { mode: 'pessimistic_write' },
      });
      if (!credit) return;
      credit.balance = Math.min(
        credit.initialAmount,
        Math.round((credit.balance + amount) * 100) / 100,
      );
      credit.status = credit.balance > 0 ? 'active' : 'used';
      await repository.save(credit);
    });
  }

  private async getActive(customerUid: string, codeParam: string) {
    const code = this.normalize(codeParam);
    const credit = await this.credits.findOneBy({ code });
    await this.assertActive(credit, customerUid, this.credits);
    return credit!;
  }

  private async assertActive(
    credit: StoreCreditEntity | null,
    customerUid: string,
    repository: Repository<StoreCreditEntity>,
  ) {
    if (!credit) throw new NotFoundException('Crédito Wear Bubble inválido.');
    if (credit.customerUid !== customerUid) {
      throw new BadRequestException('Este crédito pertence a outra conta.');
    }
    if (credit.expiresAt.getTime() < Date.now()) {
      credit.status = 'expired';
      await repository.save(credit);
      throw new BadRequestException('Crédito Wear Bubble expirado.');
    }
    if (credit.status !== 'active' || credit.balance <= 0) {
      throw new BadRequestException(
        'Crédito Wear Bubble sem saldo disponível.',
      );
    }
  }

  private normalize(code: string) {
    return String(code || '')
      .trim()
      .toUpperCase();
  }
}
