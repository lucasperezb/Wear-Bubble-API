import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiForbiddenResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuth } from '../auth/decorators/api-auth.decorator';
import { ManagerGuard } from '../auth/guards/manager.guard';
import { CouponsService } from './coupons.service';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';

@Controller('coupons')
@ApiTags('Coupons')
export class CouponsController {
  constructor(private readonly coupons: CouponsService) {}

  @Get(':code')
  get(@Param('code') code: string) {
    return this.coupons.validate(code);
  }

  @Get()
  @UseGuards(ManagerGuard)
  @ApiAuth()
  @ApiForbiddenResponse({ description: 'Acesso restrito ao gerente.' })
  list() {
    return this.coupons.list();
  }

  @Post()
  @UseGuards(ManagerGuard)
  @ApiAuth()
  @ApiForbiddenResponse({ description: 'Acesso restrito ao gerente.' })
  create(@Body() dto: CreateCouponDto) {
    return this.coupons.create(dto);
  }

  @Patch(':code')
  @UseGuards(ManagerGuard)
  @ApiAuth()
  @ApiForbiddenResponse({ description: 'Acesso restrito ao gerente.' })
  update(@Param('code') code: string, @Body() dto: UpdateCouponDto) {
    return this.coupons.update(code, dto);
  }

  @Delete(':code')
  @UseGuards(ManagerGuard)
  @ApiAuth()
  @ApiForbiddenResponse({ description: 'Acesso restrito ao gerente.' })
  remove(@Param('code') code: string) {
    return this.coupons.remove(code);
  }
}
