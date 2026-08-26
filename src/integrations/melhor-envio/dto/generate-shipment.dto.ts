import { IsOptional, Matches } from 'class-validator';

export class GenerateShipmentDto {
  @IsOptional()
  @Matches(/^\d{44}$/, { message: 'Chave da NF-e deve conter 44 dígitos.' })
  invoiceKey?: string;
}
