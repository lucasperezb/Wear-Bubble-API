import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiForbiddenResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuth } from '../auth/decorators/api-auth.decorator';
import { ManagerGuard } from '../auth/guards/manager.guard';
import { CreateHeroSlideDto } from './dto/create-hero-slide.dto';
import { ReorderHeroSlidesDto } from './dto/reorder-hero-slides.dto';
import { UpdateHeroSettingsDto } from './dto/update-hero-settings.dto';
import { UpdateHeroSlideDto } from './dto/update-hero-slide.dto';
import { HeroService } from './hero.service';

const imageInterceptor = FileInterceptor('image', {
  storage: memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
});

@Controller('hero')
@ApiTags('Hero')
export class HeroController {
  constructor(private readonly hero: HeroService) {}

  @Get()
  publicConfig() {
    return this.hero.publicConfig();
  }

  @Get('admin')
  @UseGuards(ManagerGuard)
  @ApiAuth()
  @ApiForbiddenResponse({ description: 'Acesso restrito ao gerente.' })
  adminConfig() {
    return this.hero.adminConfig();
  }

  @Patch('admin/settings')
  @UseGuards(ManagerGuard)
  @ApiAuth()
  updateSettings(@Body() dto: UpdateHeroSettingsDto) {
    return this.hero.setEnabled(dto.enabled);
  }

  @Post('admin/slides')
  @UseGuards(ManagerGuard)
  @ApiAuth()
  @UseInterceptors(imageInterceptor)
  createSlide(
    @UploadedFile() image: Express.Multer.File | undefined,
    @Body() dto: CreateHeroSlideDto,
  ) {
    return this.hero.createSlide(image, dto);
  }

  @Patch('admin/slides/order')
  @UseGuards(ManagerGuard)
  @ApiAuth()
  reorder(@Body() dto: ReorderHeroSlidesDto) {
    return this.hero.reorder(dto.slideIds);
  }

  @Patch('admin/slides/:id')
  @UseGuards(ManagerGuard)
  @ApiAuth()
  updateSlide(@Param('id') id: string, @Body() dto: UpdateHeroSlideDto) {
    return this.hero.updateSlide(id, dto);
  }

  @Post('admin/slides/:id/image')
  @UseGuards(ManagerGuard)
  @ApiAuth()
  @UseInterceptors(imageInterceptor)
  replaceImage(
    @Param('id') id: string,
    @UploadedFile() image: Express.Multer.File | undefined,
  ) {
    return this.hero.replaceImage(id, image);
  }

  @Delete('admin/slides/:id')
  @UseGuards(ManagerGuard)
  @ApiAuth()
  remove(@Param('id') id: string) {
    return this.hero.remove(id);
  }
}
