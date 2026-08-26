import {
  Controller,
  Headers,
  HttpCode,
  Post,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { MelhorEnvioService } from './melhor-envio.service';

@Controller('webhooks/melhor-envio')
@ApiTags('Melhor Envio Webhook')
export class MelhorEnvioWebhookController {
  constructor(private readonly melhorEnvio: MelhorEnvioService) {}

  @Post()
  @HttpCode(200)
  webhook(
    @Req() request: RawBodyRequest<Request>,
    @Headers('x-me-signature') signature?: string,
  ) {
    return this.melhorEnvio.handleWebhook(
      request.rawBody || Buffer.from(JSON.stringify(request.body || {})),
      signature,
    );
  }
}
