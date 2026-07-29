import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateLegacySchema1784839000000 implements MigrationInterface {
  name = 'CreateLegacySchema1784839000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS users (
        uid uuid PRIMARY KEY,
        data jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS profiles (
        uid uuid PRIMARY KEY,
        data jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS products (
        id integer PRIMARY KEY,
        data jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS coupons (
        code varchar(80) PRIMARY KEY,
        data jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS orders (
        id uuid PRIMARY KEY,
        data jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS events (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        data jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS leads (
        hash varchar(64) PRIMARY KEY,
        data jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS deletion_reports (
        protocol varchar(80) PRIMARY KEY,
        data jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS email_indexes (
        email varchar(255) PRIMARY KEY,
        uid uuid
      );

      CREATE TABLE IF NOT EXISTS order_counters (
        key varchar(32) PRIMARY KEY,
        value integer NOT NULL DEFAULT 0
      );
    `);
  }

  down(): Promise<void> {
    return Promise.reject(
      new Error(
        'Esta migration estabelece o schema legado e deve ser revertida por backup do PostgreSQL.',
      ),
    );
  }
}
