import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

export class PaymentChargeDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @IsUUID()
  reference_id?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

export class PaymentWebhookDto {
  @IsOptional()
  @IsUUID()
  orderId?: string;

  @IsOptional()
  @IsUUID()
  reference_id?: string;

  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsBoolean()
  paid?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaymentChargeDto)
  charges?: PaymentChargeDto[];
}
