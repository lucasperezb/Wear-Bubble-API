import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductEntity } from '../products/entities/product.entity';
import { HomeLayoutEntity } from './entities/home-layout.entity';
import { HomeLayoutController } from './home-layout.controller';
import { HomeLayoutService } from './home-layout.service';

@Module({
  imports: [TypeOrmModule.forFeature([HomeLayoutEntity, ProductEntity])],
  controllers: [HomeLayoutController],
  providers: [HomeLayoutService],
})
export class HomeLayoutModule {}
