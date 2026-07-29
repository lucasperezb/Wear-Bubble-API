import { ArrayMaxSize, IsArray, IsUUID } from 'class-validator';

export class ReorderProductImagesDto {
  @IsArray()
  @ArrayMaxSize(8)
  @IsUUID('4', { each: true })
  imageIds: string[];
}
