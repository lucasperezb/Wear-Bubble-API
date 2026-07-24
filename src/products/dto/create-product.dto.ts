import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsHexColor,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class ProductColorDto {
  @IsString()
  @MaxLength(100)
  n: string;

  @IsHexColor()
  h: string;
}

export class CreateProductDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  id?: number;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  cat?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  sub?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  tag?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  icon?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(5)
  rating?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  reviews?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  stock?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sizes?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(180)
  material?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pair?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sports?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductColorDto)
  colors?: ProductColorDto[];

  @IsOptional()
  @IsString()
  desc?: string;

  @IsOptional()
  @IsString()
  image?: string | null;
}
