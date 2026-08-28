import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CouponsModule } from '../coupons/coupons.module';
import { ProductsModule } from '../products/products.module';
import { CreditsModule } from '../credits/credits.module';
import { InventoryModule } from '../inventory/inventory.module';
import { EmailModule } from '../email/email.module';
import { OrderCounterEntity } from './entities/order-counter.entity';
import { OrderItemEntity } from './entities/order-item.entity';
import { OrderEntity } from './entities/order.entity';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OrderEntity,
      OrderItemEntity,
      OrderCounterEntity,
    ]),
    ProductsModule,
    CouponsModule,
    CreditsModule,
    InventoryModule,
    EmailModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
