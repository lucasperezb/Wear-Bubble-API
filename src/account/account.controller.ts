import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { ApiAuth } from '../auth/decorators/api-auth.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthGuard } from '../auth/guards/auth.guard';
import { AuthenticatedUser } from '../auth/auth.types';
import { AccountService } from './account.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

@Controller('account')
@UseGuards(AuthGuard)
@ApiTags('Account')
@ApiAuth()
export class AccountController {
  constructor(private readonly account: AccountService) {}

  @Get()
  get(@CurrentUser() user: AuthenticatedUser) {
    return this.account.get(user.uid);
  }

  @Patch()
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateAccountDto,
  ) {
    return this.account.update(user.uid, dto);
  }

  @Get('addresses')
  addresses(@CurrentUser() user: AuthenticatedUser) {
    return this.account.listAddresses(user.uid);
  }

  @Post('addresses')
  createAddress(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAddressDto,
  ) {
    return this.account.createAddress(user.uid, dto);
  }

  @Patch('addresses/:id')
  updateAddress(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAddressDto,
  ) {
    return this.account.updateAddress(user.uid, id, dto);
  }

  @Delete('addresses/:id')
  deleteAddress(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.account.deleteAddress(user.uid, id);
  }

  @Post('delete')
  delete(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.account.delete(user.uid, res);
  }
}
