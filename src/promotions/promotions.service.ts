import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UpdatePromotionSettingsDto } from './dto/update-promotion-settings.dto';
import { PromotionSettingsEntity } from './entities/promotion-settings.entity';
import {
  defaultPromotionSettings,
  normalizeTiers,
  PromotionSettings,
} from './progressive-discount';

@Injectable()
export class PromotionsService {
  constructor(
    @InjectRepository(PromotionSettingsEntity)
    private readonly settings: Repository<PromotionSettingsEntity>,
  ) {}

  async getSettings(): Promise<PromotionSettings> {
    const row = await this.settings.findOneBy({ id: 1 });
    if (!row) return defaultPromotionSettings;
    return {
      individualEnabled: row.individualEnabled !== false,
      progressive: {
        enabled: row.progressiveEnabled === true,
        tiers: normalizeTiers(row.progressiveTiers),
        extendLast: row.progressiveExtendLast !== false,
        stackWithOtherDiscounts: row.progressiveStack === true,
      },
    };
  }

  async updateSettings(dto: UpdatePromotionSettingsDto) {
    const current = await this.getSettings();
    // Só sobrescreve o que veio no corpo: com target ES2022 os campos
    // opcionais do DTO existem como undefined e um spread direto apagaria
    // as faixas salvas ao ligar/desligar o progressivo.
    const patch = dto.progressive || {};
    const progressive = { ...current.progressive };
    if (patch.enabled !== undefined) progressive.enabled = Boolean(patch.enabled);
    if (patch.tiers !== undefined) progressive.tiers = patch.tiers;
    if (patch.extendLast !== undefined)
      progressive.extendLast = Boolean(patch.extendLast);
    if (patch.stackWithOtherDiscounts !== undefined)
      progressive.stackWithOtherDiscounts = Boolean(patch.stackWithOtherDiscounts);
    progressive.tiers = normalizeTiers(progressive.tiers);
    if (progressive.enabled && !progressive.tiers.some((pct) => pct > 0))
      throw new BadRequestException(
        'Informe pelo menos uma faixa com desconto antes de ligar o progressivo.',
      );
    await this.settings.save(
      this.settings.create({
        id: 1,
        individualEnabled:
          dto.individualEnabled === undefined
            ? current.individualEnabled
            : Boolean(dto.individualEnabled),
        progressiveEnabled: Boolean(progressive.enabled),
        progressiveTiers: progressive.tiers,
        progressiveExtendLast: progressive.extendLast !== false,
        progressiveStack: progressive.stackWithOtherDiscounts === true,
      }),
    );
    return this.getSettings();
  }
}
