import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProductPageShowcases1784858000000 implements MigrationInterface {
  name = 'ProductPageShowcases1784858000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE product_showcases (
        page_key varchar(40) NOT NULL,
        position smallint NOT NULL,
        product_id integer NOT NULL,
        CONSTRAINT pk_product_showcases PRIMARY KEY (page_key, position),
        CONSTRAINT uq_product_showcases_page_product UNIQUE (page_key, product_id),
        CONSTRAINT ck_product_showcases_position CHECK (position BETWEEN 1 AND 4),
        CONSTRAINT fk_product_showcases_product
          FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      INSERT INTO product_showcases (page_key, position, product_id)
      SELECT 'home', ROW_NUMBER() OVER (ORDER BY id), id
      FROM products
      WHERE active = true AND stock > 0
      ORDER BY id
      LIMIT 4
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS product_showcases');
  }
}
