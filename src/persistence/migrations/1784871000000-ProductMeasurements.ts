import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProductMeasurements1784871000000 implements MigrationInterface {
  name = 'ProductMeasurements1784871000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE products
        ADD COLUMN measurements jsonb
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE products
        DROP COLUMN measurements
    `);
  }
}
