import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class ShippingQuoteItemDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pid: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  qty: number;
}

export class ShippingQuoteDto {
  @Matches(/^\d{5}-?\d{3}$/, { message: 'CEP de destino inválido.' })
  postalCode: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ShippingQuoteItemDto)
  items: ShippingQuoteItemDto[];
}
