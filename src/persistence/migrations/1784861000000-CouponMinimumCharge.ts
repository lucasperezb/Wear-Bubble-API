import { MigrationInterface, QueryRunner } from 'typeorm';

export class CouponMinimumCharge1784861000000 implements MigrationInterface {
  name = 'CouponMinimumCharge1784861000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE coupons
        ADD COLUMN minimum_charge boolean NOT NULL DEFAULT false
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE coupons DROP COLUMN minimum_charge
    `);
  }
}
