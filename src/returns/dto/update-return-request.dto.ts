import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateReturnRequestDto {
  @IsOptional()
  @IsIn([
    'approved',
    'awaiting_posting',
    'returning',
    'received',
    'inspecting',
    'rejected',
    'canceled',
  ])
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  publicNote?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  postingCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  returnTracking?: string;

  @IsOptional()
  @IsDateString()
  postingExpiresAt?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  itemId?: number;

  @IsOptional()
  @IsIn(['pending', 'resellable', 'damaged'])
  condition?: 'pending' | 'resellable' | 'damaged';
}

export class ResolveReturnRequestDto {
  @IsIn(['credit', 'refund'])
  resolution: 'credit' | 'refund';

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  publicNote?: string;
}
