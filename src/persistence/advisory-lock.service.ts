import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

/**
 * Serializes concurrent operations that share a key (a coupon code, an
 * order id) using a Postgres session-level advisory lock, without needing
 * to route every caller through the same EntityManager/transaction.
 */
@Injectable()
export class AdvisoryLockService {
  constructor(private readonly dataSource: DataSource) {}

  async withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    try {
      await queryRunner.query('SELECT pg_advisory_lock(hashtext($1))', [key]);
      return await fn();
    } finally {
      try {
        await queryRunner.query('SELECT pg_advisory_unlock(hashtext($1))', [
          key,
        ]);
      } finally {
        await queryRunner.release();
      }
    }
  }
}
