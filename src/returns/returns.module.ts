import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailModule } from '../email/email.module';
import { OrdersModule } from '../orders/orders.module';
import { PaymentsModule } from '../payments/payments.module';
import { ProductsModule } from '../products/products.module';
import { CreditsModule } from '../credits/credits.module';
import { ReturnEventEntity } from './entities/return-event.entity';
import { ReturnItemEntity } from './entities/return-item.entity';
import { ReturnRequestEntity } from './entities/return-request.entity';
import { StoreCreditEntity } from './entities/store-credit.entity';
import { ReturnsController } from './returns.controller';
import { ReturnsService } from './returns.service';

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
    ProductsModule,
    CreditsModule,
    EmailModule,
  ],
  controllers: [ReturnsController],
  providers: [ReturnsService],
  exports: [ReturnsService],
})
export class ReturnsModule {}
