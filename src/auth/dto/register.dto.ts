import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  Matches,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsString()
  @MaxLength(150)
  @Matches(/^[\p{L}\s.'-]+$/u, {
    message: 'Nome contem caracteres invalidos.',
  })
  name: string;

  @IsEmail()
  @MaxLength(255)
  email: string;

  @IsString()
  @MinLength(6)
  @MaxLength(72)
  password: string;

  @IsOptional()
  @IsBoolean()
  marketing?: boolean;
}
