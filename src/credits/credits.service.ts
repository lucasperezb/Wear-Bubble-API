import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { MoreThan, Repository } from 'typeorm';
import { StoreCreditEntity } from '../returns/entities/store-credit.entity';
import { StoreCreditAllocationEntity } from './entities/store-credit-allocation.entity';

@Injectable()
export class CreditsService {
  constructor(
    @InjectRepository(StoreCreditEntity)
    private readonly credits: Repository<StoreCreditEntity>,
  ) {}

  async balance(customerUid: string) {
    const rows = await this.credits.find({
      where: {
        customerUid,
        status: 'active',
        expiresAt: MoreThan(new Date()),
      },
      order: { expiresAt: 'ASC', createdAt: 'ASC' },
    });
    return {
      balance:
        Math.round(rows.reduce((sum, row) => sum + row.balance, 0) * 100) / 100,
      expiresAt: rows[0]?.expiresAt.getTime() || null,
      credits: rows.length,
    };
  }

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

  async reserveBalance(customerUid: string, maximum: number) {
    if (maximum <= 0) return null;
    return this.credits.manager.transaction(async (manager) => {
      const repository = manager.getRepository(StoreCreditEntity);
      const allocationRepository = manager.getRepository(
        StoreCreditAllocationEntity,
      );
      const rows = await repository.find({
        where: { customerUid, status: 'active' },
        order: { expiresAt: 'ASC', createdAt: 'ASC' },
        lock: { mode: 'pessimistic_write' },
      });
      const now = Date.now();
      const active: StoreCreditEntity[] = [];
      for (const credit of rows) {
        if (credit.expiresAt.getTime() < now) {
          credit.status = 'expired';
          await repository.save(credit);
        } else if (credit.balance > 0) {
          active.push(credit);
        }
      }

      const reservationId = randomUUID();
      let remaining = Math.max(0, Math.round(maximum * 100) / 100);
      let amount = 0;
      for (const credit of active) {
        if (remaining <= 0) break;
        const used =
          Math.round(Math.min(credit.balance, remaining) * 100) / 100;
        if (used <= 0) continue;
        credit.balance = Math.round((credit.balance - used) * 100) / 100;
        credit.status = credit.balance > 0 ? 'active' : 'used';
        await repository.save(credit);
        await allocationRepository.save(
          allocationRepository.create({
            reservationId,
            creditId: credit.id,
            amount: used,
            releasedAmount: 0,
          }),
        );
        amount = Math.round((amount + used) * 100) / 100;
        remaining = Math.round((remaining - used) * 100) / 100;
      }
      return amount > 0 ? { code: reservationId, amount } : null;
    });
  }

  async release(code: string, amount: number) {
    if (amount <= 0) return;
    await this.credits.manager.transaction(async (manager) => {
      const repository = manager.getRepository(StoreCreditEntity);
      const allocationRepository = manager.getRepository(
        StoreCreditAllocationEntity,
      );
      const allocations = await allocationRepository.find({
        where: { reservationId: code },
        order: { createdAt: 'DESC' },
        lock: { mode: 'pessimistic_write' },
      });
      if (allocations.length) {
        let remaining = Math.round(amount * 100) / 100;
        for (const allocation of allocations) {
          if (remaining <= 0) break;
          const available =
            Math.round((allocation.amount - allocation.releasedAmount) * 100) /
            100;
          const restored = Math.min(available, remaining);
          if (restored <= 0) continue;
          const credit = await repository.findOne({
            where: { id: allocation.creditId },
            lock: { mode: 'pessimistic_write' },
          });
          if (!credit) continue;
          credit.balance = Math.min(
            credit.initialAmount,
            Math.round((credit.balance + restored) * 100) / 100,
          );
          credit.status =
            credit.expiresAt.getTime() < Date.now()
              ? 'expired'
              : credit.balance > 0
                ? 'active'
                : 'used';
          allocation.releasedAmount =
            Math.round((allocation.releasedAmount + restored) * 100) / 100;
          remaining = Math.round((remaining - restored) * 100) / 100;
          await repository.save(credit);
          await allocationRepository.save(allocation);
        }
        return;
      }
      const credit = await repository.findOne({
        where: { code: this.normalize(code) },
        lock: { mode: 'pessimistic_write' },
      });
      if (!credit) return;
      credit.balance = Math.min(
        credit.initialAmount,
        Math.round((credit.balance + amount) * 100) / 100,
      );
      credit.status =
        credit.expiresAt.getTime() < Date.now()
          ? 'expired'
          : credit.balance > 0
            ? 'active'
            : 'used';
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
