import { MigrationInterface, QueryRunner } from 'typeorm';

export class CheckoutTaxId1784843000000 implements MigrationInterface {
  name = 'CheckoutTaxId1784843000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE profiles
        ADD COLUMN tax_id varchar(18) NOT NULL DEFAULT ''
    `);
    await queryRunner.query(`
      ALTER TABLE orders
        ADD COLUMN customer_tax_id varchar(18) NOT NULL DEFAULT ''
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE orders DROP COLUMN customer_tax_id
    `);
    await queryRunner.query(`
      ALTER TABLE profiles DROP COLUMN tax_id
    `);
  }
}
