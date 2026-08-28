import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderItemEntity } from '../orders/entities/order-item.entity';
import { OrderEntity } from '../orders/entities/order.entity';
import { ProductColorEntity } from '../products/entities/product-color.entity';
import { ProductEntity } from '../products/entities/product.entity';
import { InventoryMovementEntity } from './entities/inventory-movement.entity';
import { InventoryReservationEntity } from './entities/inventory-reservation.entity';
import { InventoryService } from './inventory.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OrderEntity,
      OrderItemEntity,
      ProductEntity,
      ProductColorEntity,
      InventoryReservationEntity,
      InventoryMovementEntity,
    ]),
  ],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
