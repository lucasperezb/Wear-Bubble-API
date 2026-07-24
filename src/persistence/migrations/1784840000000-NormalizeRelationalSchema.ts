import { MigrationInterface, QueryRunner } from 'typeorm';

export class NormalizeRelationalSchema1784840000000 implements MigrationInterface {
  name = 'NormalizeRelationalSchema1784840000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users
        ADD COLUMN email varchar(255),
        ADD COLUMN password_hash varchar(255),
        ADD COLUMN role varchar(20),
        ADD COLUMN marketing_opt_in boolean;

      UPDATE users SET
        email = lower(data->>'email'),
        password_hash = data->>'passwordHash',
        role = COALESCE(data->>'role', 'customer'),
        marketing_opt_in = COALESCE((data->>'marketingOptIn')::boolean, false),
        created_at = COALESCE(to_timestamp((data->>'createdAt')::double precision / 1000), created_at);

      ALTER TABLE users
        ALTER COLUMN email SET NOT NULL,
        ALTER COLUMN password_hash SET NOT NULL,
        ALTER COLUMN role SET NOT NULL,
        ALTER COLUMN role SET DEFAULT 'customer',
        ALTER COLUMN marketing_opt_in SET NOT NULL,
        ALTER COLUMN marketing_opt_in SET DEFAULT false,
        ADD CONSTRAINT uq_users_email UNIQUE (email),
        ADD CONSTRAINT ck_users_role CHECK (role IN ('customer', 'manager'));

      ALTER TABLE profiles
        ADD COLUMN name varchar(150),
        ADD COLUMN email varchar(255),
        ADD COLUMN phone varchar(30),
        ADD COLUMN cep varchar(12),
        ADD COLUMN street varchar(255),
        ADD COLUMN number varchar(30),
        ADD COLUMN reference varchar(255),
        ADD COLUMN city varchar(120);

      UPDATE profiles SET
        name = COALESCE(data->>'name', ''),
        email = COALESCE(data->>'email', ''),
        phone = COALESCE(data->>'phone', ''),
        cep = COALESCE(data->>'cep', ''),
        street = COALESCE(data->>'street', ''),
        number = COALESCE(data->>'number', ''),
        reference = COALESCE(data->>'reference', ''),
        city = COALESCE(data->>'city', '');

      ALTER TABLE profiles
        ALTER COLUMN name SET NOT NULL,
        ALTER COLUMN email SET NOT NULL,
        ALTER COLUMN phone SET NOT NULL,
        ALTER COLUMN phone SET DEFAULT '',
        ALTER COLUMN cep SET NOT NULL,
        ALTER COLUMN cep SET DEFAULT '',
        ALTER COLUMN street SET NOT NULL,
        ALTER COLUMN street SET DEFAULT '',
        ALTER COLUMN number SET NOT NULL,
        ALTER COLUMN number SET DEFAULT '',
        ALTER COLUMN reference SET NOT NULL,
        ALTER COLUMN reference SET DEFAULT '',
        ALTER COLUMN city SET NOT NULL,
        ALTER COLUMN city SET DEFAULT '',
        ADD CONSTRAINT fk_profiles_user FOREIGN KEY (uid) REFERENCES users(uid) ON DELETE CASCADE;

      ALTER TABLE products
        ADD COLUMN name varchar(180),
        ADD COLUMN cat varchar(100),
        ADD COLUMN sub varchar(100),
        ADD COLUMN price numeric(12,2),
        ADD COLUMN tag varchar(100),
        ADD COLUMN icon varchar(80),
        ADD COLUMN rating numeric(3,2),
        ADD COLUMN reviews integer,
        ADD COLUMN stock integer,
        ADD COLUMN active boolean,
        ADD COLUMN sizes text[],
        ADD COLUMN material varchar(180),
        ADD COLUMN pair_id integer,
        ADD COLUMN sports text[],
        ADD COLUMN description text,
        ADD COLUMN image text;

      UPDATE products SET
        name = COALESCE(data->>'name', ''),
        cat = COALESCE(data->>'cat', ''),
        sub = COALESCE(data->>'sub', ''),
        price = COALESCE((data->>'price')::numeric, 0),
        tag = COALESCE(data->>'tag', ''),
        icon = COALESCE(data->>'icon', ''),
        rating = COALESCE((data->>'rating')::numeric, 0),
        reviews = COALESCE((data->>'reviews')::integer, 0),
        stock = COALESCE((data->>'stock')::integer, 0),
        active = COALESCE((data->>'active')::boolean, true),
        sizes = ARRAY(SELECT jsonb_array_elements_text(COALESCE(data->'sizes', '[]'::jsonb))),
        material = COALESCE(data->>'material', ''),
        sports = ARRAY(SELECT jsonb_array_elements_text(COALESCE(data->'sports', '[]'::jsonb))),
        description = COALESCE(data->>'desc', ''),
        image = NULLIF(data->>'image', '');

      UPDATE products product SET pair_id = (product.data->>'pair')::integer
      WHERE product.data->>'pair' ~ '^[0-9]+$'
        AND EXISTS (SELECT 1 FROM products pair WHERE pair.id = (product.data->>'pair')::integer);

      ALTER TABLE products
        ALTER COLUMN name SET NOT NULL,
        ALTER COLUMN cat SET NOT NULL,
        ALTER COLUMN sub SET NOT NULL,
        ALTER COLUMN sub SET DEFAULT '',
        ALTER COLUMN price SET NOT NULL,
        ALTER COLUMN tag SET NOT NULL,
        ALTER COLUMN tag SET DEFAULT '',
        ALTER COLUMN icon SET NOT NULL,
        ALTER COLUMN icon SET DEFAULT '',
        ALTER COLUMN rating SET NOT NULL,
        ALTER COLUMN rating SET DEFAULT 0,
        ALTER COLUMN reviews SET NOT NULL,
        ALTER COLUMN reviews SET DEFAULT 0,
        ALTER COLUMN stock SET NOT NULL,
        ALTER COLUMN stock SET DEFAULT 0,
        ALTER COLUMN active SET NOT NULL,
        ALTER COLUMN active SET DEFAULT true,
        ALTER COLUMN sizes SET NOT NULL,
        ALTER COLUMN sizes SET DEFAULT '{}',
        ALTER COLUMN material SET NOT NULL,
        ALTER COLUMN material SET DEFAULT '',
        ALTER COLUMN sports SET NOT NULL,
        ALTER COLUMN sports SET DEFAULT '{}',
        ALTER COLUMN description SET NOT NULL,
        ALTER COLUMN description SET DEFAULT '',
        ADD CONSTRAINT fk_products_pair FOREIGN KEY (pair_id) REFERENCES products(id) ON DELETE SET NULL,
        ADD CONSTRAINT ck_products_stock CHECK (stock >= 0);

      CREATE TABLE product_colors (
        id integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
        product_id integer NOT NULL,
        name varchar(100) NOT NULL,
        hex varchar(20) NOT NULL,
        position smallint NOT NULL DEFAULT 0,
        CONSTRAINT fk_product_colors_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      );

      INSERT INTO product_colors (product_id, name, hex, position)
      SELECT product.id, color.value->>'n', color.value->>'h', color.ordinality - 1
      FROM products product
      CROSS JOIN LATERAL jsonb_array_elements(COALESCE(product.data->'colors', '[]'::jsonb))
        WITH ORDINALITY AS color(value, ordinality);

      CREATE INDEX idx_product_colors_product_id ON product_colors(product_id);

      ALTER TABLE coupons
        ADD COLUMN pct numeric(5,2),
        ADD COLUMN active boolean,
        ADD COLUMN expires_at timestamptz,
        ADD COLUMN max_uses integer,
        ADD COLUMN min_subtotal numeric(12,2),
        ADD COLUMN assigned_to varchar(255),
        ADD COLUMN uses integer;

      UPDATE coupons SET
        pct = COALESCE((data->>'pct')::numeric, 0),
        active = COALESCE((data->>'active')::boolean, true),
        expires_at = CASE WHEN data->>'expiresAt' IS NULL THEN NULL ELSE to_timestamp((data->>'expiresAt')::double precision / 1000) END,
        max_uses = (data->>'maxUses')::integer,
        min_subtotal = COALESCE((data->>'minSubtotal')::numeric, 0),
        assigned_to = COALESCE(data->>'assignedTo', ''),
        uses = COALESCE((data->>'uses')::integer, 0),
        created_at = COALESCE(to_timestamp((data->>'createdAt')::double precision / 1000), created_at);

      ALTER TABLE coupons
        ALTER COLUMN pct SET NOT NULL,
        ALTER COLUMN active SET NOT NULL,
        ALTER COLUMN active SET DEFAULT true,
        ALTER COLUMN min_subtotal SET NOT NULL,
        ALTER COLUMN min_subtotal SET DEFAULT 0,
        ALTER COLUMN assigned_to SET NOT NULL,
        ALTER COLUMN assigned_to SET DEFAULT '',
        ALTER COLUMN uses SET NOT NULL,
        ALTER COLUMN uses SET DEFAULT 0,
        ADD CONSTRAINT ck_coupons_pct CHECK (pct >= 0 AND pct <= 100),
        ADD CONSTRAINT ck_coupons_uses CHECK (uses >= 0);

      ALTER TABLE orders
        ADD COLUMN customer_uid uuid,
        ADD COLUMN number varchar(30),
        ADD COLUMN ordered_at timestamptz,
        ADD COLUMN total numeric(12,2),
        ADD COLUMN method varchar(40),
        ADD COLUMN coupon_code varchar(80),
        ADD COLUMN coupon_pct numeric(5,2),
        ADD COLUMN status varchar(20),
        ADD COLUMN ship_stage smallint,
        ADD COLUMN gateway varchar(40),
        ADD COLUMN pagbank_checkout_id varchar(120),
        ADD COLUMN pagbank_payment_id varchar(120),
        ADD COLUMN tracking varchar(160),
        ADD COLUMN paid_at timestamptz;

      UPDATE orders order_row SET
        customer_uid = CASE
          WHEN order_row.data->>'customerId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            AND EXISTS (SELECT 1 FROM users WHERE uid = (order_row.data->>'customerId')::uuid)
          THEN (order_row.data->>'customerId')::uuid ELSE NULL END,
        number = order_row.data->>'number',
        ordered_at = to_timestamp((order_row.data->>'date')::double precision / 1000),
        total = COALESCE((order_row.data->>'total')::numeric, 0),
        method = COALESCE(order_row.data->>'method', ''),
        coupon_code = CASE
          WHEN EXISTS (SELECT 1 FROM coupons WHERE code = order_row.data->>'coupon')
          THEN order_row.data->>'coupon' ELSE NULL END,
        coupon_pct = COALESCE((order_row.data->>'couponPct')::numeric, 0),
        status = COALESCE(order_row.data->>'status', 'pending'),
        ship_stage = COALESCE((order_row.data->>'shipStage')::smallint, 0),
        gateway = NULLIF(order_row.data->>'gateway', ''),
        pagbank_checkout_id = NULLIF(order_row.data->>'pagbankCheckoutId', ''),
        pagbank_payment_id = NULLIF(order_row.data->>'pagbankPaymentId', ''),
        tracking = NULLIF(order_row.data->>'tracking', ''),
        paid_at = CASE WHEN order_row.data->>'paidAt' IS NULL THEN NULL ELSE to_timestamp((order_row.data->>'paidAt')::double precision / 1000) END;

      ALTER TABLE orders
        ALTER COLUMN number SET NOT NULL,
        ALTER COLUMN ordered_at SET NOT NULL,
        ALTER COLUMN total SET NOT NULL,
        ALTER COLUMN method SET NOT NULL,
        ALTER COLUMN coupon_pct SET NOT NULL,
        ALTER COLUMN coupon_pct SET DEFAULT 0,
        ALTER COLUMN status SET NOT NULL,
        ALTER COLUMN status SET DEFAULT 'pending',
        ALTER COLUMN ship_stage SET NOT NULL,
        ALTER COLUMN ship_stage SET DEFAULT 0,
        ADD CONSTRAINT uq_orders_number UNIQUE (number),
        ADD CONSTRAINT fk_orders_customer FOREIGN KEY (customer_uid) REFERENCES users(uid) ON DELETE SET NULL,
        ADD CONSTRAINT fk_orders_coupon FOREIGN KEY (coupon_code) REFERENCES coupons(code) ON DELETE SET NULL,
        ADD CONSTRAINT ck_orders_status CHECK (status IN ('pending', 'paid', 'canceled')),
        ADD CONSTRAINT ck_orders_ship_stage CHECK (ship_stage BETWEEN 0 AND 5);

      CREATE INDEX idx_orders_customer_uid ON orders(customer_uid);
      CREATE INDEX idx_orders_coupon_code ON orders(coupon_code);
      CREATE INDEX idx_orders_ordered_at ON orders(ordered_at DESC);

      CREATE TABLE order_items (
        id integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
        order_id uuid NOT NULL,
        product_id integer,
        product_name varchar(180) NOT NULL,
        size varchar(20) NOT NULL,
        quantity integer NOT NULL,
        unit_price numeric(12,2) NOT NULL,
        CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
        CONSTRAINT fk_order_items_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
        CONSTRAINT ck_order_items_quantity CHECK (quantity > 0)
      );

      INSERT INTO order_items (order_id, product_id, product_name, size, quantity, unit_price)
      SELECT order_row.id,
        CASE WHEN product.id IS NOT NULL THEN product.id ELSE NULL END,
        COALESCE(item.value->>'name', ''),
        COALESCE(item.value->>'size', 'U'),
        GREATEST(COALESCE((item.value->>'qty')::integer, 1), 1),
        COALESCE((item.value->>'price')::numeric, 0)
      FROM orders order_row
      CROSS JOIN LATERAL jsonb_array_elements(COALESCE(order_row.data->'items', '[]'::jsonb)) AS item(value)
      LEFT JOIN products product ON product.id = (item.value->>'pid')::integer;

      CREATE INDEX idx_order_items_order_id ON order_items(order_id);
      CREATE INDEX idx_order_items_product_id ON order_items(product_id);

      ALTER TABLE events
        ADD COLUMN type varchar(80),
        ADD COLUMN product_id integer,
        ADD COLUMN occurred_at timestamptz,
        ADD COLUMN actor_uid uuid,
        ADD COLUMN actor_label varchar(120);

      UPDATE events event_row SET
        type = COALESCE(event_row.data->>'type', 'click'),
        product_id = CASE
          WHEN event_row.data->>'pid' ~ '^[0-9]+$'
            AND EXISTS (SELECT 1 FROM products WHERE id = (event_row.data->>'pid')::integer)
          THEN (event_row.data->>'pid')::integer ELSE NULL END,
        occurred_at = COALESCE(to_timestamp((event_row.data->>'ts')::double precision / 1000), event_row.created_at),
        actor_uid = CASE
          WHEN event_row.data->>'actor' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            AND EXISTS (SELECT 1 FROM users WHERE uid = (event_row.data->>'actor')::uuid)
          THEN (event_row.data->>'actor')::uuid ELSE NULL END,
        actor_label = COALESCE(event_row.data->>'actor', 'guest');

      ALTER TABLE events
        ALTER COLUMN type SET NOT NULL,
        ALTER COLUMN occurred_at SET NOT NULL,
        ALTER COLUMN actor_label SET NOT NULL,
        ALTER COLUMN actor_label SET DEFAULT 'guest',
        ADD CONSTRAINT fk_events_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
        ADD CONSTRAINT fk_events_actor FOREIGN KEY (actor_uid) REFERENCES users(uid) ON DELETE SET NULL;

      CREATE INDEX idx_events_product_id ON events(product_id);
      CREATE INDEX idx_events_actor_uid ON events(actor_uid);
      CREATE INDEX idx_events_occurred_at ON events(occurred_at DESC);

      ALTER TABLE leads
        ADD COLUMN email varchar(255),
        ADD COLUMN consent boolean,
        ADD COLUMN source varchar(80),
        ADD COLUMN joined_at timestamptz,
        ADD COLUMN user_uid uuid;

      UPDATE leads lead SET
        email = lower(lead.data->>'email'),
        consent = COALESCE((lead.data->>'consent')::boolean, true),
        source = COALESCE(lead.data->>'source', 'clube'),
        joined_at = COALESCE(to_timestamp((lead.data->>'joinedAt')::double precision / 1000), lead.created_at),
        user_uid = (SELECT uid FROM users WHERE email = lower(lead.data->>'email') LIMIT 1);

      ALTER TABLE leads
        ALTER COLUMN email SET NOT NULL,
        ALTER COLUMN consent SET NOT NULL,
        ALTER COLUMN consent SET DEFAULT true,
        ALTER COLUMN source SET NOT NULL,
        ALTER COLUMN source SET DEFAULT 'clube',
        ALTER COLUMN joined_at SET NOT NULL,
        ADD CONSTRAINT uq_leads_email UNIQUE (email),
        ADD CONSTRAINT fk_leads_user FOREIGN KEY (user_uid) REFERENCES users(uid) ON DELETE SET NULL;

      CREATE INDEX idx_leads_user_uid ON leads(user_uid);

      ALTER TABLE deletion_reports
        ADD COLUMN requested_at timestamptz,
        ADD COLUMN masked_id varchar(30);

      UPDATE deletion_reports SET
        requested_at = COALESCE(to_timestamp((data->>'date')::double precision / 1000), created_at),
        masked_id = COALESCE(data->>'maskedId', '');

      ALTER TABLE deletion_reports
        ALTER COLUMN requested_at SET NOT NULL,
        ALTER COLUMN masked_id SET NOT NULL;

      ALTER TABLE users DROP COLUMN data;
      ALTER TABLE profiles DROP COLUMN data;
      ALTER TABLE products DROP COLUMN data;
      ALTER TABLE coupons DROP COLUMN data;
      ALTER TABLE orders DROP COLUMN data;
      ALTER TABLE events DROP COLUMN data;
      ALTER TABLE leads DROP COLUMN data;
      ALTER TABLE deletion_reports DROP COLUMN data;
      DROP TABLE email_indexes;
    `);
  }

  down(): Promise<void> {
    return Promise.reject(
      new Error(
        'Esta migration normaliza dados relacionais e deve ser revertida por backup do PostgreSQL.',
      ),
    );
  }
}
