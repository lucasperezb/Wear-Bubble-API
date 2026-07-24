import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeletionReportEntity } from '../account/entities/deletion-report.entity';
import { ProfileEntity } from '../account/entities/profile.entity';
import { AddressEntity } from '../account/entities/address.entity';
import { CouponEntity } from '../coupons/entities/coupon.entity';
import { EventEntity } from '../events/entities/event.entity';
import { LeadEntity } from '../leads/entities/lead.entity';
import { OrderEntity } from '../orders/entities/order.entity';
import { ProductEntity } from '../products/entities/product.entity';
import { UsersModule } from '../users/users.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [
    UsersModule,
    TypeOrmModule.forFeature([
      ProductEntity,
      OrderEntity,
      EventEntity,
      LeadEntity,
      CouponEntity,
      DeletionReportEntity,
      ProfileEntity,
      AddressEntity,
    ]),
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
