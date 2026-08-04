import { Type } from 'class-transformer';
import { IsOptional, IsString, ValidateNested } from 'class-validator';

export class AsaasWebhookPaymentDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @IsString()
  externalReference?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  billingType?: string;
}

export class PaymentWebhookDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @IsString()
  event?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => AsaasWebhookPaymentDto)
  payment?: AsaasWebhookPaymentDto;
}
