import { IsEmail, MaxLength } from 'class-validator';

export class RequestLoginCodeDto {
  @IsEmail()
  @MaxLength(255)
  email: string;
}
