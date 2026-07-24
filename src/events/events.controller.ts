import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiForbiddenResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuth } from '../auth/decorators/api-auth.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ManagerGuard } from '../auth/guards/manager.guard';
import { AuthenticatedUser } from '../auth/auth.types';
import { CreateEventDto } from './dto/create-event.dto';
import { EventsService } from './events.service';

@Controller('events')
@ApiTags('Events')
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Body() dto: CreateEventDto,
  ) {
    return this.events.create(user?.uid || 'anon', dto);
  }

  @Get()
  @UseGuards(ManagerGuard)
  @ApiAuth()
  @ApiForbiddenResponse({ description: 'Acesso restrito ao gerente.' })
  list() {
    return this.events.list();
  }
}
