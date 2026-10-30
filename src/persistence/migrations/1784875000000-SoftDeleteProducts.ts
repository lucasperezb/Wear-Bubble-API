import { MigrationInterface, QueryRunner } from 'typeorm';

export class SoftDeleteProducts1784875000000 implements MigrationInterface {
  name = 'SoftDeleteProducts1784875000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE products ADD COLUMN deleted_at timestamptz;
      CREATE INDEX idx_products_deleted_at ON products(deleted_at);
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX idx_products_deleted_at;
      ALTER TABLE products DROP COLUMN deleted_at;
    `);
  }
}
