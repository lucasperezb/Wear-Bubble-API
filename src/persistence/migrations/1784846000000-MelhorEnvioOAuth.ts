import { MigrationInterface, QueryRunner } from 'typeorm';

export class MelhorEnvioOAuth1784846000000 implements MigrationInterface {
  name = 'MelhorEnvioOAuth1784846000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE melhor_envio_credentials (
        id varchar(32) PRIMARY KEY,
        access_token_encrypted text NOT NULL,
        refresh_token_encrypted text NOT NULL,
        token_type varchar(32) NOT NULL DEFAULT 'Bearer',
        scope text,
        expires_at timestamptz NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE melhor_envio_credentials`);
  }
}
