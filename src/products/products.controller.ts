import {
  Body,
  Controller,
  Delete,
  UploadedFiles,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiForbiddenResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuth } from '../auth/decorators/api-auth.decorator';
import { ManagerGuard } from '../auth/guards/manager.guard';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { UpdateProductImageDto } from './dto/update-product-image.dto';
import { ReorderProductImagesDto } from './dto/reorder-product-images.dto';
import { BundleSelectionDto } from './dto/bundle-selection.dto';
import { ProductsService } from './products.service';

@Controller('products')
@ApiTags('Products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  list() {
    return this.products.listActive();
  }

  @Post()
  @UseGuards(ManagerGuard)
  @ApiAuth()
  @ApiForbiddenResponse({ description: 'Acesso restrito ao gerente.' })
  create(@Body() dto: CreateProductDto) {
    return this.products.create(dto);
  }

  @Patch('bundle-selection')
  @UseGuards(ManagerGuard)
  @ApiAuth()
  @ApiForbiddenResponse({ description: 'Acesso restrito ao gerente.' })
  saveBundleSelection(@Body() dto: BundleSelectionDto) {
    return this.products.saveBundleSelection(dto.bottomIds, dto.topIds);
  }

  @Patch(':id')
  @UseGuards(ManagerGuard)
  @ApiAuth()
  @ApiForbiddenResponse({ description: 'Acesso restrito ao gerente.' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateProductDto) {
    return this.products.update(id, dto);
  }

  @Post(':id/image')
  @UseGuards(ManagerGuard)
  @ApiAuth()
  @ApiForbiddenResponse({ description: 'Acesso restrito ao gerente.' })
  image(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProductImageDto,
  ) {
    return this.products.updateImage(id, dto.image);
  }

  @Post(':id/images')
  @UseGuards(ManagerGuard)
  @ApiAuth()
  @UseInterceptors(
    FilesInterceptor('images', 8, {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024, files: 8 },
    }),
  )
  uploadImages(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.products.uploadImages(id, files || []);
  }

  @Patch(':id/images/order')
  @UseGuards(ManagerGuard)
  @ApiAuth()
  reorderImages(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReorderProductImagesDto,
  ) {
    return this.products.reorderImages(id, dto.imageIds);
  }

  @Patch(':id/images/:imageId/primary')
  @UseGuards(ManagerGuard)
  @ApiAuth()
  setPrimaryImage(
    @Param('id', ParseIntPipe) id: number,
    @Param('imageId') imageId: string,
  ) {
    return this.products.setPrimaryImage(id, imageId);
  }

  @Delete(':id/images/:imageId')
  @UseGuards(ManagerGuard)
  @ApiAuth()
  removeImage(
    @Param('id', ParseIntPipe) id: number,
    @Param('imageId') imageId: string,
  ) {
    return this.products.removeImage(id, imageId);
  }

  @Delete(':id')
  @UseGuards(ManagerGuard)
  @ApiAuth()
  @ApiForbiddenResponse({ description: 'Acesso restrito ao gerente.' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.products.remove(id);
  }
}
