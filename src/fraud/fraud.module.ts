import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderEntity } from '../orders/entities/order.entity';
import { CardAttemptEntity } from './entities/card-attempt.entity';
import { FraudService } from './fraud.service';

@Module({
  imports: [TypeOrmModule.forFeature([CardAttemptEntity, OrderEntity])],
  providers: [FraudService],
  exports: [FraudService],
})
export class FraudModule {}
