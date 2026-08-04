import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReplacePagBankWithAsaas1784851000000 implements MigrationInterface {
  name = 'ReplacePagBankWithAsaas1784851000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE orders
        RENAME COLUMN pagbank_checkout_id TO asaas_customer_id
    `);
    await queryRunner.query(`
      ALTER TABLE orders
        RENAME COLUMN pagbank_payment_id TO asaas_payment_id
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE orders
        RENAME COLUMN asaas_customer_id TO pagbank_checkout_id
    `);
    await queryRunner.query(`
      ALTER TABLE orders
        RENAME COLUMN asaas_payment_id TO pagbank_payment_id
    `);
  }
}
