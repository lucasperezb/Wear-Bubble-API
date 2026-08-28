import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiForbiddenResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuth } from '../auth/decorators/api-auth.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthGuard } from '../auth/guards/auth.guard';
import { ManagerGuard } from '../auth/guards/manager.guard';
import { AuthenticatedUser } from '../auth/auth.types';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderAddressDto } from './dto/update-order-address.dto';
import { UpdateShipStageDto } from './dto/update-ship-stage.dto';
import { OrdersService } from './orders.service';

@Controller('orders')
@ApiTags('Orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  @UseGuards(AuthGuard)
  @ApiAuth()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateOrderDto) {
    return this.orders.create(user.uid, dto);
  }

  @Get('mine')
  @UseGuards(AuthGuard)
  @ApiAuth()
  mine(@CurrentUser() user: AuthenticatedUser) {
    return this.orders.listMine(user.uid);
  }

  @Get()
  @UseGuards(ManagerGuard)
  @ApiAuth()
  @ApiForbiddenResponse({ description: 'Acesso restrito ao gerente.' })
  list() {
    return this.orders.listAll();
  }

  @Patch(':id/address')
  @UseGuards(ManagerGuard)
  @ApiAuth()
  @ApiForbiddenResponse({ description: 'Acesso restrito ao gerente.' })
  updateAddress(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrderAddressDto,
  ) {
    return this.orders.updateAddress(id, dto);
  }

  @Patch(':id/ship-stage')
  @UseGuards(ManagerGuard)
  @ApiAuth()
  @ApiForbiddenResponse({ description: 'Acesso restrito ao gerente.' })
  updateShipStage(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateShipStageDto,
  ) {
    return this.orders.updateShipStage(id, dto);
  }

  @Delete(':id')
  @UseGuards(ManagerGuard)
  @ApiAuth()
  @ApiForbiddenResponse({ description: 'Acesso restrito ao gerente.' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.orders.deleteOrder(id);
    return { deleted: true };
  }
}
