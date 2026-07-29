import { MigrationInterface, QueryRunner } from 'typeorm';

export class OrderShippingQuote1784847000000 implements MigrationInterface {
  name = 'OrderShippingQuote1784847000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE orders
        ADD COLUMN shipping_service_id integer,
        ADD COLUMN shipping_service_name varchar(120),
        ADD COLUMN shipping_company varchar(120),
        ADD COLUMN shipping_price numeric(12,2) NOT NULL DEFAULT 0,
        ADD COLUMN shipping_delivery_time integer
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE orders
        DROP COLUMN shipping_delivery_time,
        DROP COLUMN shipping_price,
        DROP COLUMN shipping_company,
        DROP COLUMN shipping_service_name,
        DROP COLUMN shipping_service_id
    `);
  }
}
