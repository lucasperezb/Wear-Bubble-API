import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class OrderItemDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pid: number;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  size?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  color?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  qty?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  bundle?: string | null;
}

export class CreateOrderDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @IsOptional()
  @IsIn(['Pix', 'Cartao de credito', 'Cartão de crédito'])
  method?: 'Pix' | 'Cartao de credito' | 'Cartão de crédito';

  @IsOptional()
  @IsString()
  @MaxLength(80)
  coupon?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  creditCode?: string | null;

  /**
   * true quando a sacola exibiu frete grátis. Se o frete deixou de ser
   * grátis (ex.: virada do fim da campanha), o pedido é recusado antes de
   * ser criado, para o cliente nunca pagar um frete que não viu.
   */
  @IsOptional()
  @IsBoolean()
  expectedFreeShipping?: boolean;
}
