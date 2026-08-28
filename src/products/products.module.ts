import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductColorEntity } from './entities/product-color.entity';
import { ProductEntity } from './entities/product.entity';
import { ProductImageEntity } from './entities/product-image.entity';
import { ProductShowcaseEntity } from './entities/product-showcase.entity';
import { ProductImageStorageService } from './product-image-storage.service';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { InventoryModule } from '../inventory/inventory.module';

@Module({
  imports: [
    InventoryModule,
    TypeOrmModule.forFeature([
      ProductEntity,
      ProductColorEntity,
      ProductImageEntity,
      ProductShowcaseEntity,
    ]),
  ],
  controllers: [ProductsController],
  providers: [ProductsService, ProductImageStorageService],
  exports: [ProductsService],
})
export class ProductsModule {}
