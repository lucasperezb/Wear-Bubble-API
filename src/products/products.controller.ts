import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiForbiddenResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuth } from '../auth/decorators/api-auth.decorator';
import { ManagerGuard } from '../auth/guards/manager.guard';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { UpdateProductImageDto } from './dto/update-product-image.dto';
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

  @Delete(':id')
  @UseGuards(ManagerGuard)
  @ApiAuth()
  @ApiForbiddenResponse({ description: 'Acesso restrito ao gerente.' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.products.remove(id);
  }
}
