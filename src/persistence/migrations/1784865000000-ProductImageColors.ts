import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProductImageColors1784865000000 implements MigrationInterface {
  name = 'ProductImageColors1784865000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE product_images
      ADD COLUMN color_name varchar(100)
    `);
    await queryRunner.query(`
      CREATE INDEX idx_product_images_product_color
      ON product_images(product_id, color_name, position)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX idx_product_images_product_color');
    await queryRunner.query(
      'ALTER TABLE product_images DROP COLUMN color_name',
    );
  }
}
