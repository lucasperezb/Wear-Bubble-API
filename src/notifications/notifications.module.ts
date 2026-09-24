import { Module } from '@nestjs/common';
import { SaleNotifierService } from './sale-notifier.service';

@Module({
  providers: [SaleNotifierService],
  exports: [SaleNotifierService],
})
export class NotificationsModule {}
