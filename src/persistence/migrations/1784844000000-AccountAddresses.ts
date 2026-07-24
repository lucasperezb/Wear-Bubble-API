import { MigrationInterface, QueryRunner } from 'typeorm';

export class AccountAddresses1784844000000 implements MigrationInterface {
  name = 'AccountAddresses1784844000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE addresses (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_uid uuid NOT NULL,
        label varchar(60) NOT NULL DEFAULT 'Casa',
        cep varchar(12) NOT NULL,
        street varchar(255) NOT NULL,
        neighborhood varchar(120) NOT NULL,
        number varchar(30) NOT NULL,
        reference varchar(255) NOT NULL DEFAULT '',
        city varchar(120) NOT NULL,
        state varchar(2) NOT NULL,
        is_default boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_addresses_user
          FOREIGN KEY (user_uid) REFERENCES users(uid) ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX idx_addresses_user ON addresses(user_uid)
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX uq_addresses_user_default
        ON addresses(user_uid) WHERE is_default = true
    `);
    await queryRunner.query(`
      INSERT INTO addresses (
        user_uid, label, cep, street, neighborhood, number,
        reference, city, state, is_default
      )
      SELECT
        uid, 'Principal', cep, street, neighborhood, number,
        reference, city, state, true
      FROM profiles
      WHERE cep <> '' OR street <> '' OR city <> ''
    `);
    await queryRunner.query(`
      ALTER TABLE profiles
        DROP COLUMN cep,
        DROP COLUMN street,
        DROP COLUMN neighborhood,
        DROP COLUMN number,
        DROP COLUMN reference,
        DROP COLUMN city,
        DROP COLUMN state
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE profiles
        ADD COLUMN cep varchar(12) NOT NULL DEFAULT '',
        ADD COLUMN street varchar(255) NOT NULL DEFAULT '',
        ADD COLUMN neighborhood varchar(120) NOT NULL DEFAULT '',
        ADD COLUMN number varchar(30) NOT NULL DEFAULT '',
        ADD COLUMN reference varchar(255) NOT NULL DEFAULT '',
        ADD COLUMN city varchar(120) NOT NULL DEFAULT '',
        ADD COLUMN state varchar(2) NOT NULL DEFAULT ''
    `);
    await queryRunner.query(`
      UPDATE profiles profile
      SET
        cep = address.cep,
        street = address.street,
        neighborhood = address.neighborhood,
        number = address.number,
        reference = address.reference,
        city = address.city,
        state = address.state
      FROM addresses address
      WHERE address.user_uid = profile.uid AND address.is_default = true
    `);
    await queryRunner.query(`DROP TABLE addresses`);
  }
}
