import { MigrationInterface, QueryRunner } from 'typeorm';

export class CouponFreeShipping1784867000000 implements MigrationInterface {
  name = 'CouponFreeShipping1784867000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE coupons
        ADD COLUMN free_shipping boolean NOT NULL DEFAULT false
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE coupons DROP COLUMN free_shipping
    `);
  }
}
