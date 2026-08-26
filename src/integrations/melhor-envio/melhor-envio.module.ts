import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MelhorEnvioCredentialEntity } from './entities/melhor-envio-credential.entity';
import { MelhorEnvioController } from './melhor-envio.controller';
import { MelhorEnvioService } from './melhor-envio.service';
import { ProductsModule } from '../../products/products.module';
import { EmailModule } from '../../email/email.module';
import { OrderEntity } from '../../orders/entities/order.entity';
import { OrderShipmentEntity } from './entities/order-shipment.entity';
import { MelhorEnvioWebhookEventEntity } from './entities/melhor-envio-webhook-event.entity';
import { MelhorEnvioWebhookController } from './melhor-envio-webhook.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MelhorEnvioCredentialEntity,
      OrderShipmentEntity,
      MelhorEnvioWebhookEventEntity,
      OrderEntity,
    ]),
    ProductsModule,
    EmailModule,
  ],
  controllers: [MelhorEnvioController, MelhorEnvioWebhookController],
  providers: [MelhorEnvioService],
  exports: [MelhorEnvioService],
})
export class MelhorEnvioModule {}
