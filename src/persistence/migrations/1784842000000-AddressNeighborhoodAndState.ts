import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddressNeighborhoodAndState1784842000000
  implements MigrationInterface
{
  name = 'AddressNeighborhoodAndState1784842000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE profiles
        ADD COLUMN neighborhood varchar(120) NOT NULL DEFAULT '',
        ADD COLUMN state varchar(2) NOT NULL DEFAULT ''
    `);
    await queryRunner.query(`
      ALTER TABLE orders
        ADD COLUMN shipping_neighborhood varchar(120) NOT NULL DEFAULT '',
        ADD COLUMN shipping_state varchar(2) NOT NULL DEFAULT ''
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE orders
        DROP COLUMN shipping_state,
        DROP COLUMN shipping_neighborhood
    `);
    await queryRunner.query(`
      ALTER TABLE profiles
        DROP COLUMN state,
        DROP COLUMN neighborhood
    `);
  }
}
