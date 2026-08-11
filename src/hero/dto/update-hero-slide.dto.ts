import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class UpdateHeroSlideDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Matches(/^(#|\/(?!\/)|https?:\/\/)/i, {
    message: 'use um link iniciado por #, /, http:// ou https://',
  })
  linkUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  altText?: string;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  active?: boolean;
}
