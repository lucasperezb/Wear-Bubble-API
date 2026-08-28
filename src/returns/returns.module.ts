import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailModule } from '../email/email.module';
import { OrdersModule } from '../orders/orders.module';
import { PaymentsModule } from '../payments/payments.module';
import { CreditsModule } from '../credits/credits.module';
import { ReturnEventEntity } from './entities/return-event.entity';
import { ReturnItemEntity } from './entities/return-item.entity';
import { ReturnRequestEntity } from './entities/return-request.entity';
import { StoreCreditEntity } from './entities/store-credit.entity';
import { ReturnsController } from './returns.controller';
import { ReturnsService } from './returns.service';
import { InventoryModule } from '../inventory/inventory.module';
import { MelhorEnvioModule } from '../integrations/melhor-envio/melhor-envio.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ReturnRequestEntity,
      ReturnItemEntity,
      ReturnEventEntity,
      StoreCreditEntity,
    ]),
    OrdersModule,
    PaymentsModule,
    CreditsModule,
    EmailModule,
    InventoryModule,
    MelhorEnvioModule,
  ],
  controllers: [ReturnsController],
  providers: [ReturnsService],
  exports: [ReturnsService],
})
export class ReturnsModule {}
