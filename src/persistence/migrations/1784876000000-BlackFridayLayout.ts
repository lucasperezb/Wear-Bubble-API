import { MigrationInterface, QueryRunner } from 'typeorm';

export class BlackFridayLayout1784876000000 implements MigrationInterface {
  name = 'BlackFridayLayout1784876000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE home_layout_settings
        ADD COLUMN previous varchar(20) NOT NULL DEFAULT 'padrao',
        ADD COLUMN black_friday jsonb NOT NULL DEFAULT '{}'
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE home_layout_settings SET active = previous WHERE active = 'blackfriday'`,
    );
    await queryRunner.query(`
      ALTER TABLE home_layout_settings
        DROP COLUMN black_friday,
        DROP COLUMN previous
    `);
  }
}
