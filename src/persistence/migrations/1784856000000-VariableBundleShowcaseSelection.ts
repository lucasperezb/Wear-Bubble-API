import { MigrationInterface, QueryRunner } from 'typeorm';

export class VariableBundleShowcaseSelection1784856000000
  implements MigrationInterface
{
  name = 'VariableBundleShowcaseSelection1784856000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE products
        DROP CONSTRAINT IF EXISTS ck_products_bundle_position,
        ADD CONSTRAINT ck_products_bundle_position
          CHECK (bundle_position IS NULL OR bundle_position >= 1)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE products
        DROP CONSTRAINT IF EXISTS ck_products_bundle_position,
        ADD CONSTRAINT ck_products_bundle_position
          CHECK (bundle_position IS NULL OR bundle_position BETWEEN 1 AND 3)
    `);
  }
}
