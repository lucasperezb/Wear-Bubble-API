import { MigrationInterface, QueryRunner } from 'typeorm';

export class TransactionalInventory1784866000000 implements MigrationInterface {
  name = 'TransactionalInventory1784866000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE orders DROP CONSTRAINT ck_orders_status;
      ALTER TABLE orders
        ADD COLUMN inventory_status varchar(20) NOT NULL DEFAULT 'none',
        ADD COLUMN payment_status varchar(20) NOT NULL DEFAULT 'pending',
        ADD COLUMN stock_conflict_reason text,
        ADD COLUMN refund_requested_at timestamptz,
        ADD COLUMN refunded_at timestamptz,
        ADD CONSTRAINT ck_orders_status
          CHECK (status IN ('pending', 'paid', 'canceled', 'expired', 'stock_conflict')),
        ADD CONSTRAINT ck_orders_inventory_status
          CHECK (inventory_status IN ('none', 'reserved', 'committed', 'released', 'conflict')),
        ADD CONSTRAINT ck_orders_payment_status
          CHECK (payment_status IN ('pending', 'authorized', 'confirmed', 'refund_pending', 'refunded', 'failed'));

      ALTER TABLE order_items ADD COLUMN product_color_id integer;
      ALTER TABLE order_items
        ADD CONSTRAINT fk_order_items_product_color
        FOREIGN KEY (product_color_id) REFERENCES product_colors(id) ON DELETE SET NULL;
      CREATE INDEX idx_order_items_product_color_id ON order_items(product_color_id);

      UPDATE order_items oi
      SET product_color_id = (
        SELECT pc.id
        FROM product_colors pc
        WHERE pc.product_id = oi.product_id
          AND lower(trim(pc.name)) = lower(trim(oi.color))
          AND pc.size_stock ? upper(trim(oi.size))
        ORDER BY pc.id
        LIMIT 1
      )
      WHERE oi.product_color_id IS NULL;

      UPDATE orders SET inventory_status = 'committed', payment_status = 'confirmed'
        WHERE status = 'paid';
      UPDATE orders SET inventory_status = 'released', payment_status = 'refunded'
        WHERE status = 'canceled';

      CREATE TABLE inventory_reservations (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id uuid NOT NULL,
        order_item_id integer NOT NULL UNIQUE,
        product_id integer NOT NULL,
        product_color_id integer,
        size varchar(20) NOT NULL,
        quantity integer NOT NULL,
        status varchar(20) NOT NULL DEFAULT 'active',
        expires_at timestamptz NOT NULL,
        committed_at timestamptz,
        released_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT ck_inventory_reservations_quantity CHECK (quantity > 0),
        CONSTRAINT ck_inventory_reservations_status
          CHECK (status IN ('active', 'committed', 'released', 'conflict')),
        CONSTRAINT fk_inventory_reservations_order FOREIGN KEY (order_id)
          REFERENCES orders(id) ON DELETE CASCADE,
        CONSTRAINT fk_inventory_reservations_order_item FOREIGN KEY (order_item_id)
          REFERENCES order_items(id) ON DELETE CASCADE,
        CONSTRAINT fk_inventory_reservations_product FOREIGN KEY (product_id)
          REFERENCES products(id) ON DELETE RESTRICT,
        CONSTRAINT fk_inventory_reservations_product_color FOREIGN KEY (product_color_id)
          REFERENCES product_colors(id) ON DELETE SET NULL
      );
      CREATE INDEX idx_inventory_reservations_order_id
        ON inventory_reservations(order_id);
      CREATE INDEX idx_inventory_reservations_variant
        ON inventory_reservations(product_id, product_color_id, size, status, expires_at);

      CREATE TABLE inventory_movements (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        idempotency_key varchar(180) NOT NULL UNIQUE,
        order_id uuid,
        order_item_id integer,
        product_id integer NOT NULL,
        product_color_id integer,
        size varchar(20) NOT NULL,
        quantity integer NOT NULL,
        type varchar(30) NOT NULL,
        reason text NOT NULL DEFAULT '',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT ck_inventory_movements_quantity CHECK (quantity <> 0),
        CONSTRAINT ck_inventory_movements_type
          CHECK (type IN ('sale', 'cancellation', 'return', 'manual_adjustment')),
        CONSTRAINT fk_inventory_movements_order FOREIGN KEY (order_id)
          REFERENCES orders(id) ON DELETE SET NULL,
        CONSTRAINT fk_inventory_movements_order_item FOREIGN KEY (order_item_id)
          REFERENCES order_items(id) ON DELETE SET NULL,
        CONSTRAINT fk_inventory_movements_product FOREIGN KEY (product_id)
          REFERENCES products(id) ON DELETE RESTRICT,
        CONSTRAINT fk_inventory_movements_product_color FOREIGN KEY (product_color_id)
          REFERENCES product_colors(id) ON DELETE SET NULL
      );
      CREATE INDEX idx_inventory_movements_order_id ON inventory_movements(order_id);
      CREATE INDEX idx_inventory_movements_product_id ON inventory_movements(product_id);
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE inventory_movements;
      DROP TABLE inventory_reservations;
      DROP INDEX idx_order_items_product_color_id;
      ALTER TABLE order_items DROP CONSTRAINT fk_order_items_product_color;
      ALTER TABLE order_items DROP COLUMN product_color_id;
      ALTER TABLE orders DROP CONSTRAINT ck_orders_payment_status;
      ALTER TABLE orders DROP CONSTRAINT ck_orders_inventory_status;
      ALTER TABLE orders DROP CONSTRAINT ck_orders_status;
      ALTER TABLE orders
        DROP COLUMN refunded_at,
        DROP COLUMN refund_requested_at,
        DROP COLUMN stock_conflict_reason,
        DROP COLUMN payment_status,
        DROP COLUMN inventory_status,
        ADD CONSTRAINT ck_orders_status CHECK (status IN ('pending', 'paid', 'canceled'));
    `);
  }
}
