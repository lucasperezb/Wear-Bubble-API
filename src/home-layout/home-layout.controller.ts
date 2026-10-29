import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiForbiddenResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuth } from '../auth/decorators/api-auth.decorator';
import { ManagerGuard } from '../auth/guards/manager.guard';
import { UpdateHomeLayoutDto } from './dto/update-home-layout.dto';
import { HomeLayoutService } from './home-layout.service';

@Controller('home-layout')
@ApiTags('Home layout')
export class HomeLayoutController {
  constructor(private readonly layout: HomeLayoutService) {}

  /** Público: a loja decide o tema e a página inicial por aqui. */
  @Get()
  get() {
    return this.layout.get();
  }

  /** Gerente: salva as peças do layout de verão e/ou publica um layout. */
  @Patch()
  @UseGuards(ManagerGuard)
  @ApiAuth()
  @ApiForbiddenResponse({ description: 'Acesso restrito ao gerente.' })
  update(@Body() dto: UpdateHomeLayoutDto) {
    return this.layout.update(dto);
  }
}
