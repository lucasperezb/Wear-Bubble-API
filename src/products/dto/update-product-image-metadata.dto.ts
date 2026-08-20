import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateProductImageMetadataDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  colorName?: string | null;
}
