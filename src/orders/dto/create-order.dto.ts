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
  @IsBoolean()
  bundle?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  coupon?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  creditCode?: string | null;
}
