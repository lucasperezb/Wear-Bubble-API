import { MigrationInterface, QueryRunner } from 'typeorm';

export class StandardizeProductRatings1784864000000
  implements MigrationInterface
{
  name = 'StandardizeProductRatings1784864000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE products
      SET rating = CASE
        WHEN rating >= 4.95 THEN 5.00
        WHEN rating >= 4.85 THEN 4.90
        ELSE 4.80
      END
    `);
    await queryRunner.query(`
      ALTER TABLE products
      ADD CONSTRAINT ck_products_rating
      CHECK (rating IN (4.80, 4.90, 5.00))
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE products
      DROP CONSTRAINT ck_products_rating
    `);
  }
}
