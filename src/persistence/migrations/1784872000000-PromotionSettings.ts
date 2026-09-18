import { MigrationInterface, QueryRunner } from 'typeorm';

export class PromotionSettings1784872000000 implements MigrationInterface {
  name = 'PromotionSettings1784872000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE promotion_settings (
        id integer PRIMARY KEY,
        individual_enabled boolean NOT NULL DEFAULT true,
        progressive_enabled boolean NOT NULL DEFAULT false,
        progressive_tiers jsonb NOT NULL DEFAULT '[10, 20, 30]',
        progressive_extend_last boolean NOT NULL DEFAULT true,
        progressive_stack boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      INSERT INTO promotion_settings (id) VALUES (1)
    `);
    await queryRunner.query(`
      ALTER TABLE orders
        ADD COLUMN progressive_discount numeric(12, 2) NOT NULL DEFAULT 0
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE orders
        DROP COLUMN progressive_discount
    `);
    await queryRunner.query('DROP TABLE promotion_settings');
  }
}
