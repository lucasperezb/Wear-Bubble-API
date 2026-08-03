import { MigrationInterface, QueryRunner } from 'typeorm';

export class GuestCheckoutAndLoginCodes1784841000000 implements MigrationInterface {
  name = 'GuestCheckoutAndLoginCodes1784841000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE login_codes (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_uid uuid NOT NULL,
        code_hash varchar(64) NOT NULL,
        expires_at timestamptz NOT NULL,
        attempts smallint NOT NULL DEFAULT 0,
        used_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_login_codes_user
          FOREIGN KEY (user_uid) REFERENCES users(uid) ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX idx_login_codes_user_created
      ON login_codes (user_uid, created_at)
    `);
    await queryRunner.query(`
      ALTER TABLE orders
        ADD COLUMN customer_name varchar(150) NOT NULL DEFAULT '',
        ADD COLUMN customer_email varchar(255) NOT NULL DEFAULT '',
        ADD COLUMN customer_phone varchar(30) NOT NULL DEFAULT '',
        ADD COLUMN shipping_cep varchar(12) NOT NULL DEFAULT '',
        ADD COLUMN shipping_street varchar(255) NOT NULL DEFAULT '',
        ADD COLUMN shipping_number varchar(30) NOT NULL DEFAULT '',
        ADD COLUMN shipping_reference varchar(255) NOT NULL DEFAULT '',
        ADD COLUMN shipping_city varchar(120) NOT NULL DEFAULT ''
    `);
    await queryRunner.query(`
      UPDATE orders AS order_row SET
        customer_name = COALESCE(profile.name, ''),
        customer_email = COALESCE(profile.email, account.email, ''),
        customer_phone = COALESCE(profile.phone, ''),
        shipping_cep = COALESCE(profile.cep, ''),
        shipping_street = COALESCE(profile.street, ''),
        shipping_number = COALESCE(profile.number, ''),
        shipping_reference = COALESCE(profile.reference, ''),
        shipping_city = COALESCE(profile.city, '')
      FROM users AS account
      LEFT JOIN profiles AS profile ON profile.uid = account.uid
      WHERE account.uid = order_row.customer_uid
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE orders
        DROP COLUMN shipping_city,
        DROP COLUMN shipping_reference,
        DROP COLUMN shipping_number,
        DROP COLUMN shipping_street,
        DROP COLUMN shipping_cep,
        DROP COLUMN customer_phone,
        DROP COLUMN customer_email,
        DROP COLUMN customer_name
    `);
    await queryRunner.query(`DROP TABLE login_codes`);
  }
}
