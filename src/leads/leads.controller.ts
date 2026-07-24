import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CreateLeadDto } from './dto/create-lead.dto';
import { LeadsService } from './leads.service';

@Controller('leads')
@ApiTags('Leads')
export class LeadsController {
  constructor(private readonly leads: LeadsService) {}

  @Post()
  create(@Body() dto: CreateLeadDto) {
    return this.leads.create(dto);
  }
}
