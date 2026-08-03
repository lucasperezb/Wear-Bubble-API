import {
  Body,
  Controller,
  Get,
  Headers,
  ParseUUIDPipe,
  Post,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiForbiddenResponse, ApiHeader, ApiTags } from '@nestjs/swagger';
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

  @Get('public-key')
  publicKey() {
    return this.payments.publicKey();
  }

  @Get('status/:orderId')
  status(@Param('orderId', ParseUUIDPipe) orderId: string) {
    return this.payments.status(orderId);
  }

  @Post('checkout')
  checkout(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Body() dto: CreateCheckoutDto,
  ) {
    return this.payments.checkout(user, dto);
  }

  @Post('orders/:orderId/cancel')
  @UseGuards(ManagerGuard)
  @ApiAuth()
  @ApiForbiddenResponse({ description: 'Acesso restrito ao gerente.' })
  cancelOrder(@Param('orderId', ParseUUIDPipe) orderId: string) {
    return this.payments.cancelOrder(orderId);
  }

  @Post('webhook/pagbank')
  @ApiHeader({
    name: 'x-authenticity-token',
    description: 'Assinatura SHA-256 enviada pelo PagBank.',
    required: true,
  })
  pagbankWebhook(
    @Body() dto: PaymentWebhookDto,
    @Req() req: { rawBody?: Buffer },
    @Headers('x-authenticity-token') signature?: string,
  ) {
    return this.payments.pagbankWebhook(dto, req.rawBody, signature);
  }
}
