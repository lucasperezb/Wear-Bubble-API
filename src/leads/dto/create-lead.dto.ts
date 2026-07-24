import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateLeadDto {
  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  source?: string;
}
