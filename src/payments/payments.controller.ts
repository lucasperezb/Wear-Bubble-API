import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  Post,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiForbiddenResponse, ApiHeader, ApiTags } from '@nestjs/swagger';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { ApiAuth } from '../auth/decorators/api-auth.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { ManagerGuard } from '../auth/guards/manager.guard';
import { CreateCheckoutDto } from './dto/create-checkout.dto';
import { PaymentWebhookDto } from './dto/payment-webhook.dto';
import { PaymentsService } from './payments.service';

@Controller('payment')
@ApiTags('Payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get('status/:orderId')
  @Throttle({ default: { limit: 40, ttl: 60_000 } })
  status(@Param('orderId', ParseUUIDPipe) orderId: string) {
    return this.payments.status(orderId);
  }

  @Post('checkout')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  checkout(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Body() dto: CreateCheckoutDto,
    @Req() req: Request,
  ) {
    return this.payments.checkout(
      user,
      dto,
      req.ip || req.socket.remoteAddress || '',
    );
  }

  @Post('orders/:orderId/cancel')
  @UseGuards(ManagerGuard)
  @ApiAuth()
  @ApiForbiddenResponse({ description: 'Acesso restrito ao gerente.' })
  cancelOrder(@Param('orderId', ParseUUIDPipe) orderId: string) {
    return this.payments.cancelOrder(orderId);
  }

  @Post('webhook/asaas')
  @SkipThrottle()
  @HttpCode(HttpStatus.OK)
  @ApiHeader({
    name: 'asaas-access-token',
    description: 'Token de autenticação configurado no webhook do Asaas.',
    required: true,
  })
  asaasWebhook(
    @Body() dto: PaymentWebhookDto,
    @Headers('asaas-access-token') token?: string,
  ) {
    return this.payments.asaasWebhook(dto, token);
  }
}
