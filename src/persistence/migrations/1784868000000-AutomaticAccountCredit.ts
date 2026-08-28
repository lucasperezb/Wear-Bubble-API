import { MigrationInterface, QueryRunner } from 'typeorm';

export class AutomaticAccountCredit1784868000000 implements MigrationInterface {
  name = 'AutomaticAccountCredit1784868000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE store_credit_allocations (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        reservation_id uuid NOT NULL,
        credit_id uuid NOT NULL,
        amount numeric(12,2) NOT NULL,
        released_amount numeric(12,2) NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_store_credit_allocation_credit
          FOREIGN KEY (credit_id) REFERENCES store_credits(id) ON DELETE RESTRICT,
        CONSTRAINT ck_store_credit_allocation_amounts
          CHECK (amount > 0 AND released_amount >= 0 AND released_amount <= amount)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX idx_store_credit_allocations_reservation ON store_credit_allocations(reservation_id)`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE store_credit_allocations`);
  }
}
