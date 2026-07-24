import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductsModule } from '../products/products.module';
import { EventEntity } from './entities/event.entity';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';

@Module({
  imports: [TypeOrmModule.forFeature([EventEntity]), ProductsModule],
  controllers: [EventsController],
  providers: [EventsService],
})
export class EventsModule {}
