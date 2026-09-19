import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { UpdatePromotionSettingsDto } from './dto/update-promotion-settings.dto';
import { PromotionSettingsEntity } from './entities/promotion-settings.entity';
import { PromotionsService } from './promotions.service';

function makeService(row: Partial<PromotionSettingsEntity> | null) {
  const saved: PromotionSettingsEntity[] = [];
  const repo = {
    findOneBy: jest.fn(async () => (saved.length ? saved[saved.length - 1] : row)),
    create: jest.fn((value: PromotionSettingsEntity) => value),
    save: jest.fn(async (value: PromotionSettingsEntity) => {
      saved.push(value);
      return value;
    }),
  };
  return { service: new PromotionsService(repo as never), repo, saved };
}

const storedRow: Partial<PromotionSettingsEntity> = {
  id: 1,
  individualEnabled: true,
  progressiveEnabled: false,
  progressiveTiers: [10, 20, 30, 30],
  progressiveExtendLast: true,
  progressiveStack: true,
};

describe('PromotionsService.updateSettings', () => {
  it('liga o progressivo mantendo as faixas salvas quando o corpo traz só enabled', async () => {
    const { service, saved } = makeService(storedRow);
    // O pipe de validação entrega uma instância da classe: com target ES2022
    // os campos opcionais existem como undefined.
    const dto = plainToInstance(UpdatePromotionSettingsDto, {
      progressive: { enabled: true },
    });

    const result = await service.updateSettings(dto);

    expect(saved[0].progressiveTiers).toEqual([10, 20, 30, 30]);
    expect(saved[0].progressiveStack).toBe(true);
    expect(saved[0].progressiveExtendLast).toBe(true);
    expect(result.progressive.enabled).toBe(true);
  });

  it('salva as faixas sem alterar a chave de ativação', async () => {
    const { service, saved } = makeService({ ...storedRow, progressiveEnabled: true });
    const dto = plainToInstance(UpdatePromotionSettingsDto, {
      progressive: { tiers: [15, 25], extendLast: false, stackWithOtherDiscounts: false },
    });

    await service.updateSettings(dto);

    expect(saved[0].progressiveEnabled).toBe(true);
    expect(saved[0].progressiveTiers).toEqual([15, 25]);
    expect(saved[0].progressiveStack).toBe(false);
  });

  it('recusa ligar o progressivo sem nenhuma faixa maior que zero', async () => {
    const { service } = makeService({ ...storedRow, progressiveTiers: [0, 0] });
    const dto = plainToInstance(UpdatePromotionSettingsDto, {
      progressive: { enabled: true },
    });

    await expect(service.updateSettings(dto)).rejects.toBeInstanceOf(BadRequestException);
  });
});
