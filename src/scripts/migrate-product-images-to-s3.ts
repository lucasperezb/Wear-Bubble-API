import 'dotenv/config';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import dataSource from '../persistence/typeorm.data-source';
import { ProductEntity } from '../products/entities/product.entity';
import { ProductImageEntity } from '../products/entities/product-image.entity';

async function main() {
  const bucket = required('S3_STORAGE_BUCKET');
  const publicBaseUrl = required('S3_PUBLIC_BASE_URL').replace(/\/$/, '');
  const region = process.env.AWS_REGION || 'sa-east-1';
  const dryRun = process.env.MIGRATION_DRY_RUN === 'true';
  const s3 = new S3Client({ region });

  await dataSource.initialize();
  const images = await dataSource.getRepository(ProductImageEntity).find();
  const migratable = images.filter(
    (image) => image.storagePath && !image.url.startsWith(publicBaseUrl),
  );
  console.log(
    JSON.stringify({ event: 's3.migration.start', count: migratable.length, dryRun }),
  );

  for (const [index, image] of migratable.entries()) {
    const response = await fetch(image.url);
    if (!response.ok)
      throw new Error(`Falha ao baixar ${image.url}: HTTP ${response.status}`);
    const body = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get('content-type') || 'image/webp';
    const nextUrl = `${publicBaseUrl}/${image.storagePath}`;

    if (!dryRun) {
      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: image.storagePath!,
          Body: body,
          ContentType: contentType,
          CacheControl: 'public, max-age=31536000, immutable',
        }),
      );
      await dataSource.transaction(async (manager) => {
        await manager.update(ProductImageEntity, image.id, { url: nextUrl });
        if (image.isPrimary)
          await manager.update(ProductEntity, image.productId, {
            image: nextUrl,
          });
      });
    }
    console.log(
      JSON.stringify({
        event: 's3.migration.progress',
        current: index + 1,
        total: migratable.length,
        path: image.storagePath,
      }),
    );
  }
  console.log(JSON.stringify({ event: 's3.migration.complete', dryRun }));
}

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Configure ${name}.`);
  return value;
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (dataSource.isInitialized) await dataSource.destroy();
  });
