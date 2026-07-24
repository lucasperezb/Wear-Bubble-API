import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductRecord } from './product.types';
import { seedProducts } from './product.seed';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductColorEntity } from './entities/product-color.entity';
import { ProductEntity } from './entities/product.entity';

@Injectable()
export class ProductsService implements OnModuleInit {
  constructor(
    @InjectRepository(ProductEntity)
    private readonly products: Repository<ProductEntity>,
    @InjectRepository(ProductColorEntity)
    private readonly colors: Repository<ProductColorEntity>,
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
      stock: Number(dto.stock) || 0,
      active: dto.active !== false,
      sizes: Array.isArray(dto.sizes) ? dto.sizes : ['P', 'M', 'G'],
      material: dto.material || '',
      pair: Number(dto.pair) || 0,
      sports: Array.isArray(dto.sports) ? dto.sports : [],
      colors: Array.isArray(dto.colors) ? dto.colors : [],
      desc: dto.desc || '',
      image: dto.image || null,
    };
    const saved = await this.products.save(this.createEntity(data));
    return this.toRecord(saved);
  }

  async update(id: number, dto: UpdateProductDto) {
    const row = await this.products.findOneBy({ id });
    if (!row) throw new NotFoundException('Produto nao encontrado.');
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
    if ('pair' in dto) row.pairId = dto.pair ? Number(dto.pair) : null;
    if ('colors' in dto) {
      await this.colors.delete({ productId: id });
      row.colors = this.createColors(
        id,
        Array.isArray(dto.colors) ? dto.colors : [],
      );
    }
    await this.products.save(row);
    return this.toRecord(row);
  }

  async updateImage(id: number, image?: string) {
    if (!image) throw new NotFoundException('Imagem ausente.');
    await this.update(id, { image });
    return { id, image };
  }

  async remove(id: number) {
    const result = await this.products.delete({ id });
    return { removed: result.affected || 0 };
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
      sports: row.sports,
      colors: (row.colors || [])
        .sort((a, b) => a.position - b.position)
        .map((color) => ({ n: color.name, h: color.hex })),
      desc: row.desc,
      image: row.image,
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
      sports: data.sports,
      colors: this.createColors(data.id, data.colors),
      desc: data.desc,
      image: data.image || null,
    });
  }

  private createColors(productId: number, colors: ProductRecord['colors']) {
    return colors.map((color, position) =>
      this.colors.create({
        productId,
        name: color.n,
        hex: color.h,
        position,
      }),
    );
  }
}
