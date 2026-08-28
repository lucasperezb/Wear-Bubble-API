import { IsNotEmpty, IsString, IsUrl } from 'class-validator';

export class UpdateProductImageDto {
  @IsString()
  @IsNotEmpty()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  image: string;
}
