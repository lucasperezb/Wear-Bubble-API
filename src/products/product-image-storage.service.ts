import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { AppConfigService } from '../config/config.service';

const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

@Injectable()
export class ProductImageStorageService {
  private bucketReady = false;

  constructor(private readonly config: AppConfigService) {}

  async upload(productId: number, file: Express.Multer.File) {
    if (!allowedTypes.has(file.mimetype))
      throw new BadRequestException(
        'Envie imagens nos formatos JPEG, PNG ou WebP.',
      );
    if (!file.buffer?.length)
      throw new BadRequestException('O arquivo de imagem está vazio.');

    const client = this.client();
    await this.ensureBucket(client);
    const path = `products/${productId}/${randomUUID()}.webp`;
    const optimized = await sharp(file.buffer)
      .rotate()
      .resize({
        width: 1600,
        height: 2000,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 84 })
      .toBuffer();
    const { error } = await client.storage
      .from(this.config.supabaseStorageBucket)
      .upload(path, optimized, {
        contentType: 'image/webp',
        cacheControl: '31536000',
        upsert: false,
      });
    if (error)
      throw new ServiceUnavailableException(
        `Não foi possível armazenar a imagem: ${error.message}`,
      );
    const { data } = client.storage
      .from(this.config.supabaseStorageBucket)
      .getPublicUrl(path);
    return { path, url: data.publicUrl };
  }

  async remove(paths: string[]) {
    const filtered = paths.filter(Boolean);
    if (!filtered.length || !this.config.supabaseStorageConfigured) return;
    const { error } = await this.client()
      .storage.from(this.config.supabaseStorageBucket)
      .remove(filtered);
    if (error)
      console.error(`Falha ao remover imagem do Storage: ${error.message}`);
  }

  private client(): SupabaseClient {
    if (!this.config.supabaseStorageConfigured)
      throw new ServiceUnavailableException(
        'Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY para enviar imagens.',
      );
    return createClient(
      this.config.supabaseUrl,
      this.config.supabaseServiceRoleKey,
      {
        auth: { persistSession: false, autoRefreshToken: false },
      },
    );
  }

  private async ensureBucket(client: SupabaseClient) {
    if (this.bucketReady) return;
    const bucket = this.config.supabaseStorageBucket;
    const { data, error } = await client.storage.getBucket(bucket);
    if (error || !data) {
      const { error: createError } = await client.storage.createBucket(bucket, {
        public: true,
        fileSizeLimit: 5 * 1024 * 1024,
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
      });
      if (createError && !createError.message.toLowerCase().includes('exist'))
        throw new ServiceUnavailableException(
          `Não foi possível criar o bucket de imagens: ${createError.message}`,
        );
    } else if (!data.public) {
      const { error: updateError } = await client.storage.updateBucket(bucket, {
        public: true,
        fileSizeLimit: 5 * 1024 * 1024,
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
      });
      if (updateError)
        throw new ServiceUnavailableException(
          `Não foi possível publicar o bucket de imagens: ${updateError.message}`,
        );
    }
    this.bucketReady = true;
  }
}
