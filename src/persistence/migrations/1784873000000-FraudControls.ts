import { MigrationInterface, QueryRunner } from 'typeorm';

export class FraudControls1784873000000 implements MigrationInterface {
  name = 'FraudControls1784873000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE email_send_log (
        id bigserial PRIMARY KEY,
        recipient_hash varchar(64) NOT NULL,
        ip varchar(64) NOT NULL DEFAULT '',
        purpose varchar(30) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX idx_email_send_log_recipient ON email_send_log (recipient_hash, created_at)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_email_send_log_ip ON email_send_log (ip, created_at)`,
    );

    await queryRunner.query(`
      CREATE TABLE card_attempts (
        id bigserial PRIMARY KEY,
        customer_uid uuid NULL,
        email varchar(255) NOT NULL DEFAULT '',
        tax_id varchar(14) NOT NULL DEFAULT '',
        card_fingerprint varchar(20) NOT NULL,
        approved boolean NOT NULL,
        ip varchar(64) NOT NULL DEFAULT '',
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX idx_card_attempts_customer ON card_attempts (customer_uid, created_at)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_card_attempts_tax_id ON card_attempts (tax_id, created_at)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_card_attempts_email ON card_attempts (email, created_at)`,
    );

    await queryRunner.query(`
      ALTER TABLE orders
        ADD COLUMN review_status varchar(20) NOT NULL DEFAULT 'none',
        ADD COLUMN review_reasons jsonb NOT NULL DEFAULT '[]',
        ADD COLUMN reviewed_at timestamptz NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE orders
        DROP COLUMN reviewed_at,
        DROP COLUMN review_reasons,
        DROP COLUMN review_status
    `);
    await queryRunner.query(`DROP TABLE card_attempts`);
    await queryRunner.query(`DROP TABLE email_send_log`);
  }
}
