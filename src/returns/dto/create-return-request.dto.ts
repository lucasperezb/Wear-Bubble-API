import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateReturnItemDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  orderItemId: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  quantity: number;
}

export class CreateReturnRequestDto {
  @IsUUID()
  orderId: string;

  @IsIn(['exchange', 'return', 'defect'])
  kind: 'exchange' | 'return' | 'defect';

  @IsIn([
    'size_small',
    'size_large',
    'fit',
    'expectation',
    'wrong_product',
    'defect',
    'withdrawal',
    'other',
  ])
  reason: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  details?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateReturnItemDto)
  items: CreateReturnItemDto[];
}
