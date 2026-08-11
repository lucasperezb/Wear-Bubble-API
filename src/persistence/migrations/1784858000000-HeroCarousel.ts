import { MigrationInterface, QueryRunner } from 'typeorm';

export class HeroCarousel1784858000000 implements MigrationInterface {
  name = 'HeroCarousel1784858000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE hero_config (
        id integer PRIMARY KEY,
        enabled boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      INSERT INTO hero_config (id, enabled) VALUES (1, false)
    `);
    await queryRunner.query(`
      CREATE TABLE hero_slides (
        id uuid PRIMARY KEY,
        storage_path text NOT NULL,
        image_url text NOT NULL,
        link_url varchar(500) NOT NULL,
        alt_text varchar(180) NOT NULL DEFAULT '',
        position integer NOT NULL DEFAULT 0,
        active boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT ck_hero_slides_position CHECK (position >= 0)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX idx_hero_slides_position ON hero_slides(position)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE hero_slides');
    await queryRunner.query('DROP TABLE hero_config');
  }
}
