import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class ShipOrderDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(5)
  shipStage?: number;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  tracking?: string;
}
