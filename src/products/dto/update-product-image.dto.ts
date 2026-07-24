import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateProductImageDto {
  @IsString()
  @IsNotEmpty()
  image: string;
}
