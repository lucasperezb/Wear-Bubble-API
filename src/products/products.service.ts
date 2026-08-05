import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { In, Repository } from 'typeorm';
import { ProductRecord } from './product.types';
import { seedProducts } from './product.seed';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductColorEntity } from './entities/product-color.entity';
import { ProductEntity } from './entities/product.entity';
import { ProductImageEntity } from './entities/product-image.entity';
import { ProductImageStorageService } from './product-image-storage.service';

@Injectable()
export class ProductsService implements OnModuleInit {
  constructor(
    @InjectRepository(ProductEntity)
    private readonly products: Repository<ProductEntity>,
    @InjectRepository(ProductColorEntity)
    private readonly colors: Repository<ProductColorEntity>,
    @InjectRepository(ProductImageEntity)
    private readonly images: Repository<ProductImageEntity>,
    private readonly imageStorage: ProductImageStorageService,
  ) {}

  async onModuleInit() {
    if (await this.products.count()) return;
    for (const data of seedProducts)
      await this.products.save(this.createEntity({ ...data, pair: 0 }));
    for (const data of seedProducts)
      if (data.pair)
        await this.products.update({ id: data.id }, { pairId: data.pair });
  }

  async listActive() {
    return (await this.products.find({ order: { id: 'ASC' } }))
      .filter((product) => product.active)
      .map((product) => this.toRecord(product));
  }

  async create(dto: CreateProductDto) {
    const existing = await this.products.find();
    const ids = existing.map((product) => product.id);
    const colors = Array.isArray(dto.colors) ? dto.colors : [];
    const variantStock = this.variantStock(colors);
    const wanted = Number(dto.id);
    const id =
      wanted && !ids.includes(wanted)
        ? wanted
        : (ids.length ? Math.max(...ids) : 0) + 1;
    const data: ProductRecord = {
      id,
      name: String(dto.name || 'Novo produto'),
      cat: dto.cat || 'Top',
      sub: dto.sub || '',
      price: Number(dto.price) || 0,
      tag: dto.tag || '',
      icon: dto.icon || 'top',
      rating: Number(dto.rating) || 5,
      reviews: Number(dto.reviews) || 0,
      stock: variantStock ?? (Number(dto.stock) || 0),
      active: dto.active !== false,
      sizes: Array.isArray(dto.sizes) ? dto.sizes : ['P', 'M', 'G'],
      material: dto.material || '',
      pair: Number(dto.pair) || 0,
      bundlePosition: 0,
      sports: Array.isArray(dto.sports) ? dto.sports : [],
      colors,
      desc: dto.desc || '',
      image: dto.image || null,
      images: [],
    };
    const saved = await this.products.save(this.createEntity(data));
    return this.toRecord(saved);
  }

  async update(id: number, dto: UpdateProductDto) {
    const row = await this.products.findOneBy({ id });
    if (!row) throw new NotFoundException('Produto não encontrado.');
    const previousCategory = row.cat;
    const allowed = [
      'name',
      'cat',
      'sub',
      'price',
      'stock',
      'tag',
      'sports',
      'material',
      'active',
      'rating',
      'reviews',
      'sizes',
      'icon',
      'desc',
      'image',
    ] as const;
    for (const key of allowed)
      if (key in dto) (row as any)[key] = (dto as any)[key];
    if ('cat' in dto && dto.cat !== previousCategory) row.bundlePosition = null;
    if ('pair' in dto) row.pairId = dto.pair ? Number(dto.pair) : null;
    if ('colors' in dto) {
      const colors = Array.isArray(dto.colors) ? dto.colors : [];
      await this.colors.delete({ productId: id });
      row.colors = this.createColors(id, colors);
      const variantStock = this.variantStock(colors);
      if (variantStock !== null) row.stock = variantStock;
    }
    await this.products.save(row);
    return this.toRecord(row);
  }

  async saveBundleSelection(bottomIds: number[], topIds: number[]) {
    const ids = [...bottomIds, ...topIds];
    if (new Set(ids).size !== 6)
      throw new BadRequestException('Selecione seis produtos diferentes.');
    const selected = await this.products.find({ where: { id: In(ids) } });
    if (selected.length !== 6)
      throw new BadRequestException('Um dos produtos selecionados não existe.');
    const byId = new Map(selected.map((product) => [product.id, product]));
    const invalidBottom = bottomIds.some(
      (id) => byId.get(id)?.cat !== 'Parte de baixo',
    );
    const invalidTop = topIds.some((id) => byId.get(id)?.cat !== 'Top');
    if (invalidBottom || invalidTop)
      throw new BadRequestException(
        'Escolha três partes de baixo e três tops nas categorias corretas.',
      );
    if (selected.some((product) => !product.active || product.stock <= 0))
      throw new BadRequestException(
        'Os produtos da vitrine devem estar ativos e com estoque.',
      );

    await this.products.manager.transaction(async (manager) => {
      await manager
        .createQueryBuilder()
        .update(ProductEntity)
        .set({ bundlePosition: null })
        .execute();
      for (const [position, id] of bottomIds.entries())
        await manager.update(
          ProductEntity,
          { id },
          { bundlePosition: position + 1 },
        );
      for (const [position, id] of topIds.entries())
        await manager.update(
          ProductEntity,
          { id },
          { bundlePosition: position + 1 },
        );
    });
    return this.listActive();
  }

  async updateImage(id: number, image?: string) {
    if (!image) throw new NotFoundException('Imagem ausente.');
    await this.update(id, { image });
    const existing = await this.images.findOne({
      where: { productId: id, isPrimary: true },
    });
    if (existing) {
      existing.url = image;
      existing.storagePath = null;
      await this.images.save(existing);
    } else {
      await this.images.save(
        this.images.create({
          id: randomUUID(),
          productId: id,
          storagePath: null,
          url: image,
          altText: '',
          position: 0,
          isPrimary: true,
        }),
      );
    }
    return { id, image };
  }

  async remove(id: number) {
    const paths = (
      await this.images.find({ where: { productId: id } })
    ).flatMap((image) => (image.storagePath ? [image.storagePath] : []));
    const result = await this.products.delete({ id });
    await this.imageStorage.remove(paths);
    return { removed: result.affected || 0 };
  }

  async uploadImages(id: number, files: Express.Multer.File[]) {
    const product = await this.getProductOrThrow(id);
    if (!files.length) throw new BadRequestException('Selecione uma imagem.');
    const existing = await this.images.find({
      where: { productId: id },
      order: { position: 'ASC' },
    });
    if (existing.length + files.length > 8)
      throw new BadRequestException(
        'Cada produto pode ter no máximo 8 imagens.',
      );

    const uploaded: Array<{ path: string; url: string }> = [];
    try {
      for (const file of files)
        uploaded.push(await this.imageStorage.upload(id, file));
      const hasPrimary = existing.some((image) => image.isPrimary);
      await this.images.save(
        uploaded.map((stored, index) =>
          this.images.create({
            id: randomUUID(),
            productId: id,
            storagePath: stored.path,
            url: stored.url,
            altText: product.name,
            position: existing.length + index,
            isPrimary: !hasPrimary && index === 0,
          }),
        ),
      );
      await this.syncLegacyImage(id);
      return this.getRecord(id);
    } catch (error) {
      await this.imageStorage.remove(uploaded.map((item) => item.path));
      throw error;
    }
  }

  async setPrimaryImage(productId: number, imageId: string) {
    await this.getOwnedImage(productId, imageId);
    await this.images.update({ productId }, { isPrimary: false });
    await this.images.update({ id: imageId, productId }, { isPrimary: true });
    await this.syncLegacyImage(productId);
    return this.getRecord(productId);
  }

  async reorderImages(productId: number, imageIds: string[]) {
    await this.getProductOrThrow(productId);
    const current = await this.images.find({ where: { productId } });
    const currentIds = new Set(current.map((image) => image.id));
    if (
      current.length !== imageIds.length ||
      imageIds.some((id) => !currentIds.has(id))
    )
      throw new BadRequestException(
        'A ordem precisa conter todas as imagens do produto.',
      );
    await Promise.all(
      imageIds.map((id, position) =>
        this.images.update({ id, productId }, { position }),
      ),
    );
    return this.getRecord(productId);
  }

  async removeImage(productId: number, imageId: string) {
    const image = await this.getOwnedImage(productId, imageId);
    await this.images.delete({ id: imageId, productId });
    if (image.isPrimary) {
      const replacement = await this.images.findOne({
        where: { productId },
        order: { position: 'ASC' },
      });
      if (replacement) {
        replacement.isPrimary = true;
        await this.images.save(replacement);
      }
    }
    await this.normalizePositions(productId);
    await this.syncLegacyImage(productId);
    if (image.storagePath) await this.imageStorage.remove([image.storagePath]);
    return this.getRecord(productId);
  }

  findEntity(id: number) {
    return this.products.findOneBy({ id });
  }

  saveEntity(row: ProductEntity) {
    return this.products.save(row);
  }

  toRecord(row: ProductEntity): ProductRecord {
    return {
      id: row.id,
      name: row.name,
      cat: row.cat,
      sub: row.sub,
      price: row.price,
      tag: row.tag,
      icon: row.icon,
      rating: row.rating,
      reviews: row.reviews,
      stock: row.stock,
      active: row.active,
      sizes: row.sizes,
      material: row.material,
      pair: row.pairId || 0,
      bundlePosition: row.bundlePosition || 0,
      sports: row.sports,
      colors: (row.colors || [])
        .sort((a, b) => a.position - b.position)
        .map((color) => ({
          n: color.name,
          h: color.hex,
          sizes: Object.entries(color.sizeStock || {}).map(([size, q]) => ({
            size,
            q: Math.max(0, Number(q) || 0),
          })),
        })),
      desc: row.desc,
      image: this.sortedImages(row)[0]?.url || row.image,
      images: this.sortedImages(row).map((image) => ({
        id: image.id,
        url: image.url,
        altText: image.altText,
        position: image.position,
        isPrimary: image.isPrimary,
      })),
    };
  }

  private createEntity(data: ProductRecord) {
    return this.products.create({
      id: data.id,
      name: data.name,
      cat: data.cat,
      sub: data.sub,
      price: data.price,
      tag: data.tag,
      icon: data.icon,
      rating: data.rating,
      reviews: data.reviews,
      stock: data.stock,
      active: data.active,
      sizes: data.sizes,
      material: data.material,
      pairId: data.pair || null,
      bundlePosition: data.bundlePosition || null,
      sports: data.sports,
      colors: this.createColors(data.id, data.colors),
      desc: data.desc,
      image: data.image || null,
      images: [],
    });
  }

  private createColors(productId: number, colors: ProductRecord['colors']) {
    return colors.map((color, position) =>
      this.colors.create({
        productId,
        name: color.n,
        hex: color.h,
        position,
        sizeStock: Object.fromEntries(
          (color.sizes || []).map((item) => [
            String(item.size).trim().toUpperCase(),
            Math.max(0, Number(item.q) || 0),
          ]),
        ),
      }),
    );
  }

  private variantStock(colors: ProductRecord['colors']) {
    const entries = colors.flatMap((color) => color.sizes || []);
    if (!entries.length) return null;
    return entries.reduce(
      (total, item) => total + Math.max(0, Number(item.q) || 0),
      0,
    );
  }

  private sortedImages(row: ProductEntity) {
    return [...(row.images || [])].sort(
      (a, b) =>
        Number(b.isPrimary) - Number(a.isPrimary) || a.position - b.position,
    );
  }

  private async getProductOrThrow(id: number) {
    const product = await this.products.findOneBy({ id });
    if (!product) throw new NotFoundException('Produto não encontrado.');
    return product;
  }

  private async getOwnedImage(productId: number, imageId: string) {
    const image = await this.images.findOneBy({ id: imageId, productId });
    if (!image) throw new NotFoundException('Imagem não encontrada.');
    return image;
  }

  private async getRecord(productId: number) {
    return this.toRecord(await this.getProductOrThrow(productId));
  }

  private async normalizePositions(productId: number) {
    const images = await this.images.find({
      where: { productId },
      order: { position: 'ASC' },
    });
    await Promise.all(
      images.map((image, position) =>
        this.images.update({ id: image.id }, { position }),
      ),
    );
  }

  private async syncLegacyImage(productId: number) {
    const primary =
      (await this.images.findOne({
        where: { productId, isPrimary: true },
      })) ||
      (await this.images.findOne({
        where: { productId },
        order: { position: 'ASC' },
      }));
    await this.products.update(
      { id: productId },
      { image: primary?.url || null },
    );
  }
}
