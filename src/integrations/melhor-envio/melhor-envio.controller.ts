import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Param,
  ParseUUIDPipe,
  Query,
  Redirect,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { ManagerGuard } from '../../auth/guards/manager.guard';
import { AuthenticatedUser } from '../../auth/auth.types';
import { MelhorEnvioService } from './melhor-envio.service';
import { ShippingQuoteDto } from './dto/shipping-quote.dto';
import { GenerateShipmentDto } from './dto/generate-shipment.dto';

@Controller('integrations/melhor-envio')
@ApiTags('Melhor Envio')
export class MelhorEnvioController {
  constructor(private readonly melhorEnvio: MelhorEnvioService) {}

  @Get('status')
  @UseGuards(ManagerGuard)
  status() {
    return this.melhorEnvio.status();
  }

  @Get('oauth/authorize')
  @UseGuards(ManagerGuard)
  @Redirect()
  authorize(@CurrentUser() user: AuthenticatedUser) {
    return { url: this.melhorEnvio.authorizationUrl(user), statusCode: 302 };
  }

  @Get('oauth/callback')
  callback(@Query('code') code?: string, @Query('state') state?: string) {
    if (!code || !state) {
      throw new BadRequestException('Code e state são obrigatórios.');
    }
    return this.melhorEnvio.completeAuthorization(code, state);
  }

  @Post('quote')
  quote(@Body() dto: ShippingQuoteDto) {
    return this.melhorEnvio.quote(dto);
  }

  @Get('orders/:id/shipments')
  @UseGuards(ManagerGuard)
  shipments(@Param('id', ParseUUIDPipe) id: string) {
    return this.melhorEnvio.listShipments(id);
  }

  @Post('orders/:id/shipments')
  @UseGuards(ManagerGuard)
  generateShipments(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: GenerateShipmentDto,
  ) {
    return this.melhorEnvio.createShipments(id, dto);
  }
}
