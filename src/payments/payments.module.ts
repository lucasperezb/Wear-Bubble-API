import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProfileEntity } from '../account/entities/profile.entity';
import { AddressEntity } from '../account/entities/address.entity';
import { EmailModule } from '../email/email.module';
import { OrdersModule } from '../orders/orders.module';
import { UsersModule } from '../users/users.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { MelhorEnvioModule } from '../integrations/melhor-envio/melhor-envio.module';
import { InventoryModule } from '../inventory/inventory.module';

@Module({
  imports: [
    OrdersModule,
    EmailModule,
    UsersModule,
    MelhorEnvioModule,
    InventoryModule,
    TypeOrmModule.forFeature([ProfileEntity, AddressEntity]),
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
