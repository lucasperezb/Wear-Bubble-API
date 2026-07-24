import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserEmailVerification1784845000000 implements MigrationInterface {
  name = 'UserEmailVerification1784845000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users
        ADD COLUMN email_verified boolean NOT NULL DEFAULT false
    `);
    await queryRunner.query(`
      UPDATE users SET email_verified = true
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users DROP COLUMN email_verified
    `);
  }
}
