import { MigrationInterface, QueryRunner } from 'typeorm';

export class PasswordResetTokens1784850000000 implements MigrationInterface {
  name = 'PasswordResetTokens1784850000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE password_reset_tokens (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_uid uuid NOT NULL,
        token_hash varchar(64) NOT NULL,
        expires_at timestamptz NOT NULL,
        used_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_password_reset_tokens_user
          FOREIGN KEY (user_uid) REFERENCES users(uid) ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX uq_password_reset_tokens_hash
      ON password_reset_tokens(token_hash)
    `);
    await queryRunner.query(`
      CREATE INDEX idx_password_reset_tokens_user_created
      ON password_reset_tokens(user_uid, created_at)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE password_reset_tokens');
  }
}
