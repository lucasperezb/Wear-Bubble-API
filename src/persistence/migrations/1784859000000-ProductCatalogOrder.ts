import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProductCatalogOrder1784859000000 implements MigrationInterface {
  name = 'ProductCatalogOrder1784859000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE products ADD COLUMN catalog_position integer
    `);
    await queryRunner.query(`
      WITH ordered_products AS (
        SELECT id, row_number() OVER (ORDER BY id) - 1 AS position
        FROM products
      )
      UPDATE products
      SET catalog_position = ordered_products.position
      FROM ordered_products
      WHERE products.id = ordered_products.id
    `);
    await queryRunner.query(`
      ALTER TABLE products
      ALTER COLUMN catalog_position SET DEFAULT 0,
      ALTER COLUMN catalog_position SET NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE products
      ADD CONSTRAINT ck_products_catalog_position CHECK (catalog_position >= 0)
    `);
    await queryRunner.query(`
      CREATE INDEX idx_products_catalog_position
      ON products(catalog_position, id)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE products DROP CONSTRAINT ck_products_catalog_position
    `);
    await queryRunner.query(`
      ALTER TABLE products DROP COLUMN catalog_position
    `);
  }
}
