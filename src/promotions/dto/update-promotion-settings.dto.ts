import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  PROGRESSIVE_MAX_PCT,
  PROGRESSIVE_MAX_TIERS,
} from '../progressive-discount';

export class UpdateProgressiveSettingsDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(PROGRESSIVE_MAX_TIERS)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(PROGRESSIVE_MAX_PCT, { each: true })
  tiers?: number[];

  @IsOptional()
  @IsBoolean()
  extendLast?: boolean;

  @IsOptional()
  @IsBoolean()
  stackWithOtherDiscounts?: boolean;
}

export class UpdatePromotionSettingsDto {
  @IsOptional()
  @IsBoolean()
  individualEnabled?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateProgressiveSettingsDto)
  progressive?: UpdateProgressiveSettingsDto;
}
