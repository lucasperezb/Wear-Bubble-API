import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProductPromotions1784857000000 implements MigrationInterface {
  name = 'ProductPromotions1784857000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE products
        ADD COLUMN promo_pct smallint NOT NULL DEFAULT 0,
        ADD CONSTRAINT ck_products_promo_pct
          CHECK (promo_pct BETWEEN 0 AND 90)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE products
        DROP CONSTRAINT IF EXISTS ck_products_promo_pct,
        DROP COLUMN IF EXISTS promo_pct
    `);
  }
}
