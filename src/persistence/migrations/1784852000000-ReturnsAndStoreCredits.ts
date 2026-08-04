import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReturnsAndStoreCredits1784852000000 implements MigrationInterface {
  name = 'ReturnsAndStoreCredits1784852000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE orders ADD COLUMN delivered_at timestamptz`,
    );
    await queryRunner.query(`
      CREATE TABLE return_requests (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        protocol varchar(30) NOT NULL UNIQUE,
        order_id uuid NOT NULL,
        customer_uid uuid NOT NULL,
        kind varchar(20) NOT NULL,
        reason varchar(40) NOT NULL,
        details text NOT NULL DEFAULT '',
        status varchar(30) NOT NULL DEFAULT 'requested',
        public_note text NOT NULL DEFAULT '',
        posting_code varchar(160),
        return_tracking varchar(160),
        posting_expires_at timestamptz,
        resolution varchar(20),
        resolution_amount numeric(12,2) NOT NULL DEFAULT 0,
        credit_code varchar(40),
        approved_at timestamptz,
        posted_at timestamptz,
        received_at timestamptz,
        resolved_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_return_request_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
        CONSTRAINT fk_return_request_customer FOREIGN KEY (customer_uid) REFERENCES users(uid) ON DELETE CASCADE,
        CONSTRAINT ck_return_request_kind CHECK (kind IN ('exchange', 'return', 'defect')),
        CONSTRAINT ck_return_request_status CHECK (status IN ('requested','approved','awaiting_posting','returning','received','inspecting','completed','rejected','canceled'))
      )
    `);
    await queryRunner.query(
      `CREATE INDEX idx_return_requests_order_id ON return_requests(order_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_return_requests_customer_uid ON return_requests(customer_uid)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_return_requests_status ON return_requests(status)`,
    );
    await queryRunner.query(`
      CREATE TABLE return_request_items (
        id serial PRIMARY KEY,
        request_id uuid NOT NULL,
        order_item_id integer NOT NULL,
        quantity integer NOT NULL,
        unit_refund_value numeric(12,2) NOT NULL,
        condition varchar(20) NOT NULL DEFAULT 'pending',
        CONSTRAINT fk_return_item_request FOREIGN KEY (request_id) REFERENCES return_requests(id) ON DELETE CASCADE,
        CONSTRAINT fk_return_item_order_item FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE RESTRICT,
        CONSTRAINT ck_return_request_items_quantity CHECK (quantity > 0),
        CONSTRAINT ck_return_item_condition CHECK (condition IN ('pending','resellable','damaged')),
        CONSTRAINT uq_return_item_request UNIQUE (request_id, order_item_id)
      )
    `);
    await queryRunner.query(`
      CREATE TABLE return_request_events (
        id serial PRIMARY KEY,
        request_id uuid NOT NULL,
        status varchar(40) NOT NULL,
        label varchar(180) NOT NULL,
        message text NOT NULL DEFAULT '',
        actor_type varchar(20) NOT NULL,
        visible_to_customer boolean NOT NULL DEFAULT true,
        occurred_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_return_event_request FOREIGN KEY (request_id) REFERENCES return_requests(id) ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX idx_return_events_request_id ON return_request_events(request_id)`,
    );
    await queryRunner.query(`
      CREATE TABLE store_credits (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        code varchar(40) NOT NULL UNIQUE,
        customer_uid uuid NOT NULL,
        return_request_id uuid NOT NULL UNIQUE,
        initial_amount numeric(12,2) NOT NULL,
        balance numeric(12,2) NOT NULL,
        status varchar(20) NOT NULL DEFAULT 'active',
        expires_at timestamptz NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_store_credit_customer FOREIGN KEY (customer_uid) REFERENCES users(uid) ON DELETE CASCADE,
        CONSTRAINT fk_store_credit_return_request FOREIGN KEY (return_request_id) REFERENCES return_requests(id) ON DELETE RESTRICT,
        CONSTRAINT ck_store_credit_amounts CHECK (initial_amount >= 0 AND balance >= 0),
        CONSTRAINT ck_store_credit_status CHECK (status IN ('active','used','expired','canceled'))
      )
    `);
    await queryRunner.query(
      `CREATE INDEX idx_store_credits_customer_uid ON store_credits(customer_uid)`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE store_credits`);
    await queryRunner.query(`DROP TABLE return_request_events`);
    await queryRunner.query(`DROP TABLE return_request_items`);
    await queryRunner.query(`DROP TABLE return_requests`);
    await queryRunner.query(`ALTER TABLE orders DROP COLUMN delivered_at`);
  }
}
