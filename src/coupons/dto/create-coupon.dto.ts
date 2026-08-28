import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateCouponDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  code: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(99)
  pct?: number;

  @IsOptional()
  @IsBoolean()
  minimumCharge?: boolean;

  @IsOptional()
  @IsBoolean()
  freeShipping?: boolean;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  expiresAt?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxUses?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxUsesPerCustomer?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minSubtotal?: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  assignedTo?: string;
}
