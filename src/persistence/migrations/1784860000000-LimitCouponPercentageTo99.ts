import { MigrationInterface, QueryRunner } from 'typeorm';

export class LimitCouponPercentageTo991784860000000
  implements MigrationInterface
{
  name = 'LimitCouponPercentageTo991784860000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE coupons SET pct = 99 WHERE pct > 99
    `);
    await queryRunner.query(`
      ALTER TABLE coupons
        DROP CONSTRAINT IF EXISTS ck_coupons_pct,
        ADD CONSTRAINT ck_coupons_pct CHECK (pct >= 0 AND pct <= 99)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE coupons
        DROP CONSTRAINT IF EXISTS ck_coupons_pct,
        ADD CONSTRAINT ck_coupons_pct CHECK (pct >= 0 AND pct <= 100)
    `);
  }
}
