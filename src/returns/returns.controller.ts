import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiAuth } from '../auth/decorators/api-auth.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { AuthGuard } from '../auth/guards/auth.guard';
import { ManagerGuard } from '../auth/guards/manager.guard';
import { CreateReturnRequestDto } from './dto/create-return-request.dto';
import {
  ResolveReturnRequestDto,
  UpdateReturnRequestDto,
} from './dto/update-return-request.dto';
import { ReturnsService } from './returns.service';

@Controller('returns')
export class ReturnsController {
  constructor(private readonly returns: ReturnsService) {}

  @Post()
  @UseGuards(AuthGuard)
  @ApiAuth()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateReturnRequestDto,
  ) {
    return this.returns.create(user.uid, dto);
  }

  @Get('mine')
  @UseGuards(AuthGuard)
  @ApiAuth()
  mine(@CurrentUser() user: AuthenticatedUser) {
    return this.returns.listMine(user.uid);
  }

  @Get('credits/mine')
  @UseGuards(AuthGuard)
  @ApiAuth()
  credits(@CurrentUser() user: AuthenticatedUser) {
    return this.returns.listCredits(user.uid);
  }

  @Post(':id/cancel')
  @UseGuards(AuthGuard)
  @ApiAuth()
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.returns.cancel(user.uid, id);
  }

  @Get()
  @UseGuards(ManagerGuard)
  @ApiAuth()
  all() {
    return this.returns.listAll();
  }

  @Patch(':id')
  @UseGuards(ManagerGuard)
  @ApiAuth()
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateReturnRequestDto,
  ) {
    return this.returns.update(id, dto);
  }

  @Post(':id/resolve')
  @UseGuards(ManagerGuard)
  @ApiAuth()
  resolve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResolveReturnRequestDto,
  ) {
    return this.returns.resolve(id, dto);
  }

  @Post(':id/reverse-shipment')
  @UseGuards(ManagerGuard)
  @ApiAuth()
  reverseShipment(@Param('id', ParseUUIDPipe) id: string) {
    return this.returns.issueReverseShipment(id);
  }
}
