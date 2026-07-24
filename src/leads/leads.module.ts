import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeadEntity } from './entities/lead.entity';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';

@Module({
  imports: [TypeOrmModule.forFeature([LeadEntity])],
  controllers: [LeadsController],
  providers: [LeadsService],
})
export class LeadsModule {}
