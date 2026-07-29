import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProductColorSizeStock1784849000000
  implements MigrationInterface
{
  name = 'ProductColorSizeStock1784849000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE product_colors
        ADD COLUMN size_stock jsonb NOT NULL DEFAULT '{}'::jsonb
    `);
    await queryRunner.query(`
      ALTER TABLE order_items
        ADD COLUMN color varchar(100) NOT NULL DEFAULT ''
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE order_items DROP COLUMN color`);
    await queryRunner.query(`ALTER TABLE product_colors DROP COLUMN size_stock`);
  }
}
