import { MigrationInterface, QueryRunner } from 'typeorm';

export class OrderStoreCredit1784853000000 implements MigrationInterface {
  name = 'OrderStoreCredit1784853000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE orders
        ADD COLUMN store_credit_code varchar(40),
        ADD COLUMN store_credit_amount numeric(12,2) NOT NULL DEFAULT 0
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE orders
        DROP COLUMN store_credit_amount,
        DROP COLUMN store_credit_code
    `);
  }
}
