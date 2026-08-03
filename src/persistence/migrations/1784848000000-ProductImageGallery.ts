import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProductImageGallery1784848000000 implements MigrationInterface {
  name = 'ProductImageGallery1784848000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE product_images (
        id uuid PRIMARY KEY,
        product_id integer NOT NULL,
        storage_path text,
        url text NOT NULL,
        alt_text varchar(180) NOT NULL DEFAULT '',
        position integer NOT NULL DEFAULT 0,
        is_primary boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT ck_product_images_position CHECK (position >= 0),
        CONSTRAINT fk_product_images_product
          FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX idx_product_images_product_position
      ON product_images(product_id, position)
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX ux_product_images_primary
      ON product_images(product_id)
      WHERE is_primary = true
    `);
    await queryRunner.query(`
      INSERT INTO product_images (
        id, product_id, storage_path, url, alt_text, position, is_primary
      )
      SELECT
        md5('legacy-product-image-' || id::text)::uuid,
        id,
        NULL,
        image,
        name,
        0,
        true
      FROM products
      WHERE image IS NOT NULL AND btrim(image) <> ''
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE product_images');
  }
}
