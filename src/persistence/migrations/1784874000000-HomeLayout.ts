import { MigrationInterface, QueryRunner } from 'typeorm';

export class HomeLayout1784874000000 implements MigrationInterface {
  name = 'HomeLayout1784874000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE home_layout_settings (
        id integer PRIMARY KEY,
        active varchar(20) NOT NULL DEFAULT 'padrao',
        fizz jsonb NOT NULL DEFAULT '{}',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    // Começa no layout de sempre; o gerente publica o de verão pelo painel.
    await queryRunner.query(`INSERT INTO home_layout_settings (id) VALUES (1)`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE home_layout_settings`);
  }
}
