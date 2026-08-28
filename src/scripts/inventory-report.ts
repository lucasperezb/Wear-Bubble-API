import dataSource from '../persistence/typeorm.data-source';

async function run() {
  await dataSource.initialize();
  const divergences = await dataSource.query<Array<Record<string, unknown>>>(`
    SELECT
      product.id,
      product.name,
      product.stock AS physical_total,
      variant.variant_total,
      product.stock - variant.variant_total AS difference
    FROM products product
    JOIN LATERAL (
      SELECT COALESCE(SUM(size_entry.value::integer), 0)::integer AS variant_total
      FROM product_colors color
      CROSS JOIN LATERAL jsonb_each_text(color.size_stock) size_entry
      WHERE color.product_id = product.id
    ) variant ON true
    WHERE EXISTS (
      SELECT 1 FROM product_colors color
      WHERE color.product_id = product.id
        AND color.size_stock <> '{}'::jsonb
    )
      AND product.stock <> variant.variant_total
    ORDER BY product.id
  `);
  const legacyPaidOrders = await dataSource.query<
    Array<Record<string, unknown>>
  >(`
    SELECT order_row.id, order_row.number, order_row.paid_at
    FROM orders order_row
    WHERE order_row.status = 'paid'
      AND NOT EXISTS (
        SELECT 1 FROM inventory_movements movement
        WHERE movement.order_id = order_row.id AND movement.type = 'sale'
      )
    ORDER BY order_row.paid_at DESC NULLS LAST
  `);
  process.stdout.write(
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        divergences,
        legacyPaidOrders,
      },
      null,
      2,
    )}\n`,
  );
}

void run()
  .catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack : error}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (dataSource.isInitialized) await dataSource.destroy();
  });
