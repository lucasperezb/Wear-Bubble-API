import { MigrationInterface, QueryRunner } from 'typeorm';

export class MelhorEnvioShipments1784864000000 implements MigrationInterface {
  name = 'MelhorEnvioShipments1784864000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE products
        ADD COLUMN weight numeric(8,3) NOT NULL DEFAULT 0.3,
        ADD COLUMN width integer NOT NULL DEFAULT 20,
        ADD COLUMN height integer NOT NULL DEFAULT 4,
        ADD COLUMN length integer NOT NULL DEFAULT 25;

      ALTER TABLE orders
        ADD COLUMN shipping_carrier_price numeric(12,2) NOT NULL DEFAULT 0,
        ADD COLUMN shipping_packages jsonb NOT NULL DEFAULT '[]'::jsonb;

      CREATE TABLE order_shipments (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id uuid NOT NULL,
        package_index smallint NOT NULL DEFAULT 0,
        provider_order_id varchar(120),
        status varchar(40) NOT NULL DEFAULT 'draft',
        service_id integer NOT NULL,
        service_name varchar(80) NOT NULL,
        carrier varchar(80) NOT NULL DEFAULT 'Correios',
        carrier_price numeric(12,2) NOT NULL DEFAULT 0,
        invoice_key varchar(60),
        volume jsonb NOT NULL,
        protocol varchar(120),
        authorization_code varchar(120),
        tracking varchar(160),
        tracking_url text,
        print_url text,
        last_error text,
        attempts integer NOT NULL DEFAULT 0,
        paid_at timestamptz,
        generated_at timestamptz,
        posted_at timestamptz,
        delivered_at timestamptz,
        canceled_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_order_shipments_order FOREIGN KEY (order_id)
          REFERENCES orders(id) ON DELETE CASCADE,
        CONSTRAINT uq_order_shipments_order_package UNIQUE (order_id, package_index)
      );
      CREATE UNIQUE INDEX uq_order_shipments_provider_order_id
        ON order_shipments(provider_order_id) WHERE provider_order_id IS NOT NULL;
      CREATE INDEX idx_order_shipments_status ON order_shipments(status);

      CREATE TABLE melhor_envio_webhook_events (
        id varchar(64) PRIMARY KEY,
        event varchar(60) NOT NULL,
        provider_order_id uuid,
        payload jsonb NOT NULL,
        processed_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE melhor_envio_webhook_events;
      DROP TABLE order_shipments;
      ALTER TABLE orders
        DROP COLUMN shipping_packages,
        DROP COLUMN shipping_carrier_price;
      ALTER TABLE products
        DROP COLUMN length,
        DROP COLUMN height,
        DROP COLUMN width,
        DROP COLUMN weight;
    `);
  }
}
