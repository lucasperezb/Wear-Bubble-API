import { MigrationInterface, QueryRunner } from 'typeorm';

export class CouponPerCustomerLimit1784855000000 implements MigrationInterface {
  name = 'CouponPerCustomerLimit1784855000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE coupons
        ADD COLUMN max_uses_per_customer integer,
        ADD CONSTRAINT ck_coupons_max_uses_per_customer
          CHECK (max_uses_per_customer IS NULL OR max_uses_per_customer >= 1)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE coupons
        DROP CONSTRAINT ck_coupons_max_uses_per_customer,
        DROP COLUMN max_uses_per_customer
    `);
  }
}
