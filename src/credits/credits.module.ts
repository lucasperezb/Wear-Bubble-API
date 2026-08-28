import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StoreCreditEntity } from '../returns/entities/store-credit.entity';
import { StoreCreditAllocationEntity } from './entities/store-credit-allocation.entity';
import { CreditsController } from './credits.controller';
import { CreditsService } from './credits.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([StoreCreditEntity, StoreCreditAllocationEntity]),
  ],
  controllers: [CreditsController],
  providers: [CreditsService],
  exports: [CreditsService],
})
export class CreditsModule {}
