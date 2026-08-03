import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class UpdateAccountDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  @Matches(/^[\p{L}\s.'-]+$/u, {
    message: 'Nome contém caracteres inválidos.',
  })
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(18)
  @Matches(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/, {
    message: 'CPF deve estar no formato 000.000.000-00.',
  })
  taxId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  @Matches(/^$|^\(\d{2}\) \d{4,5}-\d{4}$/, {
    message: 'Telefone deve estar no formato (00) 00000-0000.',
  })
  phone?: string;
}
