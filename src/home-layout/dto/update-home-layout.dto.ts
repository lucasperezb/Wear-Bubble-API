import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  BF_HERO_SLOTS,
  BF_MAX_OFFERS,
  BF_TRAINING_SLOTS,
  HOME_LAYOUTS,
  MAX_NEWS_PRODUCTS,
  STORY_IMAGE_SLOTS,
} from '../home-layout.types';
import type { HomeLayoutKey } from '../home-layout.types';

export class StoryImageDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  productId?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  color?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(30)
  imageIndex?: number;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  label?: string;
}

export class FizzLayoutDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  heroProductId?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  heroColor?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  sideProductId?: number | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_NEWS_PRODUCTS)
  @IsInt({ each: true })
  @Min(1, { each: true })
  newsProductIds?: number[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(STORY_IMAGE_SLOTS)
  @ValidateNested({ each: true })
  @Type(() => StoryImageDto)
  storyImages?: StoryImageDto[];
}

export class BlackFridayPieceDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  productId?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  color?: string;
}

export class BlackFridayTrainingDto extends BlackFridayPieceDto {
  @IsOptional()
  @IsString()
  @MaxLength(30)
  sport?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  line?: string;
}

export class BlackFridayLayoutDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(90)
  maxPct?: number;

  @IsOptional()
  @IsISO8601({ strict: true })
  endsAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(220)
  heroText?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(BF_HERO_SLOTS)
  @ValidateNested({ each: true })
  @Type(() => BlackFridayPieceDto)
  hero?: BlackFridayPieceDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(BF_MAX_OFFERS)
  @IsInt({ each: true })
  @Min(1, { each: true })
  offerProductIds?: number[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(BF_TRAINING_SLOTS)
  @ValidateNested({ each: true })
  @Type(() => BlackFridayTrainingDto)
  trainings?: BlackFridayTrainingDto[];
}

export class UpdateHomeLayoutDto {
  /** Layout no ar. Mandar só `fizz` salva as peças sem publicar. */
  @IsOptional()
  @IsIn(HOME_LAYOUTS)
  active?: HomeLayoutKey;

  @IsOptional()
  @ValidateNested()
  @Type(() => FizzLayoutDto)
  fizz?: FizzLayoutDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => BlackFridayLayoutDto)
  blackFriday?: BlackFridayLayoutDto;
}
