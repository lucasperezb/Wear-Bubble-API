import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiForbiddenResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuth } from '../auth/decorators/api-auth.decorator';
import { ManagerGuard } from '../auth/guards/manager.guard';
import { UpdatePromotionSettingsDto } from './dto/update-promotion-settings.dto';
import { PromotionsService } from './promotions.service';

@Controller('promotions')
@ApiTags('Promotions')
export class PromotionsController {
  constructor(private readonly promotions: PromotionsService) {}

  /** Público: a loja precisa das faixas para mostrar o desconto no carrinho. */
  @Get('settings')
  settings() {
    return this.promotions.getSettings();
  }

  @Patch('admin/settings')
  @UseGuards(ManagerGuard)
  @ApiAuth()
  @ApiForbiddenResponse({ description: 'Acesso restrito ao gerente.' })
  updateSettings(@Body() dto: UpdatePromotionSettingsDto) {
    return this.promotions.updateSettings(dto);
  }
}
