import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProductCollectionName1784859000000 implements MigrationInterface {
  name = 'ProductCollectionName1784859000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE products
      ADD COLUMN collection_name varchar(100) NOT NULL DEFAULT ''
    `);
    await queryRunner.query(`
      UPDATE products
      SET collection_name = 'Core'
      WHERE active = true
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE products DROP COLUMN collection_name');
  }
}
