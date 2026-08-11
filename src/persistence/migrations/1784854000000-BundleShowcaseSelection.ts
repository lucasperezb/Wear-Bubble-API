import { MigrationInterface, QueryRunner } from 'typeorm';

export class BundleShowcaseSelection1784854000000 implements MigrationInterface {
  name = 'BundleShowcaseSelection1784854000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE products
        ADD COLUMN bundle_position smallint,
        ADD CONSTRAINT ck_products_bundle_position
          CHECK (bundle_position IS NULL OR bundle_position >= 1)
    `);
    await queryRunner.query(`
      WITH ranked AS (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY cat ORDER BY id) AS position
        FROM products
        WHERE active = true AND cat IN ('Top', 'Parte de baixo', 'Blusas/Top', 'Shorts/Calça')
      )
      UPDATE products product
      SET bundle_position = ranked.position
      FROM ranked
      WHERE product.id = ranked.id AND ranked.position <= 3
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX uq_products_bundle_category_position
      ON products (cat, bundle_position)
      WHERE bundle_position IS NOT NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX IF EXISTS uq_products_bundle_category_position',
    );
    await queryRunner.query(`
      ALTER TABLE products
        DROP CONSTRAINT ck_products_bundle_position,
        DROP COLUMN bundle_position
    `);
  }
}
