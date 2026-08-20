import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HeroConfigEntity } from './entities/hero-config.entity';
import { HeroSlideEntity } from './entities/hero-slide.entity';
import { HeroController } from './hero.controller';
import { HeroImageStorageService } from './hero-image-storage.service';
import { HeroService } from './hero.service';

@Module({
  imports: [TypeOrmModule.forFeature([HeroConfigEntity, HeroSlideEntity])],
  controllers: [HeroController],
  providers: [HeroService, HeroImageStorageService],
  exports: [HeroService],
})
export class HeroModule {}
