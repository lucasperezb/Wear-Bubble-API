import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReverseShipmentDetails1784869000000 implements MigrationInterface {
  name = 'ReverseShipmentDetails1784869000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE return_requests
        ADD COLUMN reverse_provider_order_id uuid,
        ADD COLUMN reverse_service_id integer,
        ADD COLUMN reverse_status varchar(40),
        ADD COLUMN reverse_print_url text,
        ADD COLUMN reverse_last_error text
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX uq_return_requests_reverse_provider_order_id
      ON return_requests(reverse_provider_order_id)
      WHERE reverse_provider_order_id IS NOT NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX uq_return_requests_reverse_provider_order_id`,
    );
    await queryRunner.query(`
      ALTER TABLE return_requests
        DROP COLUMN reverse_last_error,
        DROP COLUMN reverse_print_url,
        DROP COLUMN reverse_status,
        DROP COLUMN reverse_service_id,
        DROP COLUMN reverse_provider_order_id
    `);
  }
}
