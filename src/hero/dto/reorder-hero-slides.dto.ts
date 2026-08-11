import { ArrayMaxSize, IsArray, IsUUID } from 'class-validator';

export class ReorderHeroSlidesDto {
  @IsArray()
  @ArrayMaxSize(8)
  @IsUUID('4', { each: true })
  slideIds: string[];
}
