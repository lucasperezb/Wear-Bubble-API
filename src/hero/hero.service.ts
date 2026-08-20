import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { Repository } from 'typeorm';
import { CreateHeroSlideDto } from './dto/create-hero-slide.dto';
import { UpdateHeroSlideDto } from './dto/update-hero-slide.dto';
import { HeroConfigEntity } from './entities/hero-config.entity';
import { HeroSlideEntity } from './entities/hero-slide.entity';
import { HeroImageStorageService } from './hero-image-storage.service';

@Injectable()
export class HeroService {
  constructor(
    @InjectRepository(HeroConfigEntity)
    private readonly config: Repository<HeroConfigEntity>,
    @InjectRepository(HeroSlideEntity)
    private readonly slides: Repository<HeroSlideEntity>,
    private readonly imageStorage: HeroImageStorageService,
  ) {}

  async publicConfig() {
    const setting = await this.config.findOneBy({ id: 1 });
    const slides = await this.slides.find({
      where: { active: true },
      order: { position: 'ASC', createdAt: 'ASC' },
    });
    return this.toConfig(Boolean(setting?.enabled), slides);
  }

  async adminConfig() {
    const setting = await this.config.findOneBy({ id: 1 });
    const slides = await this.slides.find({
      order: { position: 'ASC', createdAt: 'ASC' },
    });
    return this.toConfig(Boolean(setting?.enabled), slides);
  }

  async setEnabled(enabled: boolean) {
    if (enabled && !(await this.slides.count({ where: { active: true } })))
      throw new BadRequestException(
        'Adicione e ative pelo menos um slide antes de ligar o carrossel.',
      );
    await this.config.save(
      this.config.create({ id: 1, enabled: Boolean(enabled) }),
    );
    return this.adminConfig();
  }

  async createSlide(
    file: Express.Multer.File | undefined,
    dto: CreateHeroSlideDto,
  ) {
    if (!file)
      throw new BadRequestException('Selecione uma imagem para o slide.');
    if ((await this.slides.count()) >= 8)
      throw new BadRequestException(
        'O carrossel pode ter no máximo 8 imagens.',
      );
    const stored = await this.imageStorage.upload(file);
    try {
      const last = await this.slides.findOne({
        order: { position: 'DESC' },
      });
      await this.slides.save(
        this.slides.create({
          id: randomUUID(),
          storagePath: stored.path,
          imageUrl: stored.url,
          linkUrl: dto.linkUrl,
          altText: dto.altText?.trim() || 'Campanha Wear Bubble',
          active: dto.active !== false,
          position: (last?.position ?? -1) + 1,
        }),
      );
      return this.adminConfig();
    } catch (error) {
      await this.imageStorage.remove([stored.path]);
      throw error;
    }
  }

  async updateSlide(id: string, dto: UpdateHeroSlideDto) {
    const slide = await this.getSlide(id);
    if (dto.linkUrl !== undefined) slide.linkUrl = dto.linkUrl;
    if (dto.altText !== undefined)
      slide.altText = dto.altText.trim() || 'Campanha Wear Bubble';
    if (dto.active !== undefined) slide.active = dto.active;
    await this.slides.save(slide);
    return this.adminConfig();
  }

  async replaceImage(id: string, file?: Express.Multer.File) {
    if (!file)
      throw new BadRequestException('Selecione uma imagem para o slide.');
    const slide = await this.getSlide(id);
    const previousPath = slide.storagePath;
    const stored = await this.imageStorage.upload(file);
    try {
      slide.storagePath = stored.path;
      slide.imageUrl = stored.url;
      await this.slides.save(slide);
      await this.imageStorage.remove([previousPath]);
      return this.adminConfig();
    } catch (error) {
      await this.imageStorage.remove([stored.path]);
      throw error;
    }
  }

  async reorder(slideIds: string[]) {
    const existing = await this.slides.find();
    if (
      slideIds.length !== existing.length ||
      new Set(slideIds).size !== existing.length ||
      slideIds.some((id) => !existing.some((slide) => slide.id === id))
    )
      throw new BadRequestException(
        'A ordem enviada não contém todos os slides.',
      );
    await this.slides.manager.transaction(async (manager) => {
      for (const [position, id] of slideIds.entries())
        await manager.update(HeroSlideEntity, { id }, { position });
    });
    return this.adminConfig();
  }

  async remove(id: string) {
    const slide = await this.getSlide(id);
    await this.slides.delete({ id });
    await this.imageStorage.remove([slide.storagePath]);
    const remaining = await this.slides.find({ order: { position: 'ASC' } });
    await this.slides.manager.transaction(async (manager) => {
      for (const [position, item] of remaining.entries())
        await manager.update(HeroSlideEntity, { id: item.id }, { position });
    });
    return this.adminConfig();
  }

  private async getSlide(id: string) {
    const slide = await this.slides.findOneBy({ id });
    if (!slide) throw new NotFoundException('Slide não encontrado.');
    return slide;
  }

  private toConfig(enabled: boolean, slides: HeroSlideEntity[]) {
    return {
      enabled,
      slides: slides.map((slide) => ({
        id: slide.id,
        imageUrl: slide.imageUrl,
        linkUrl: slide.linkUrl,
        altText: slide.altText,
        position: slide.position,
        active: slide.active,
      })),
    };
  }
}
