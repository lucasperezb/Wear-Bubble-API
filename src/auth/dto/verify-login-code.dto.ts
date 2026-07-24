import { IsEmail, IsString, Matches, MaxLength } from 'class-validator';

export class VerifyLoginCodeDto {
  @IsEmail()
  @MaxLength(255)
  email: string;

  @IsString()
  @Matches(/^\d{6}$/)
  code: string;
}
