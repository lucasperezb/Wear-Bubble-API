import { IsBoolean } from 'class-validator';

export class UpdateHeroSettingsDto {
  @IsBoolean()
  enabled: boolean;
}
