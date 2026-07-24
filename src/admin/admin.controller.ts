import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiForbiddenResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuth } from '../auth/decorators/api-auth.decorator';
import { ManagerGuard } from '../auth/guards/manager.guard';
import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(ManagerGuard)
@ApiTags('Admin')
@ApiAuth()
@ApiForbiddenResponse({ description: 'Acesso restrito ao gerente.' })
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('db')
  databaseDump() {
    return this.admin.databaseDump();
  }
}
