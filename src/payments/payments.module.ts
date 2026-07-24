import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProfileEntity } from '../account/entities/profile.entity';
import { AddressEntity } from '../account/entities/address.entity';
import { EmailModule } from '../email/email.module';
import { OrdersModule } from '../orders/orders.module';
import { ProductsModule } from '../products/products.module';
import { UsersModule } from '../users/users.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [
    OrdersModule,
    ProductsModule,
    EmailModule,
    UsersModule,
    TypeOrmModule.forFeature([ProfileEntity, AddressEntity]),
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService],
})
export class PaymentsModule {}
