import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiAuth } from '../auth/decorators/api-auth.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { AuthGuard } from '../auth/guards/auth.guard';
import { CreditsService } from './credits.service';

@Controller('credits')
export class CreditsController {
  constructor(private readonly credits: CreditsService) {}

  @Get('balance')
  @UseGuards(AuthGuard)
  @ApiAuth()
  balance(@CurrentUser() user: AuthenticatedUser) {
    return this.credits.balance(user.uid);
  }

  @Get(':code')
  @UseGuards(AuthGuard)
  @ApiAuth()
  validate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('code') code: string,
  ) {
    return this.credits.validate(user.uid, code);
  }
}
