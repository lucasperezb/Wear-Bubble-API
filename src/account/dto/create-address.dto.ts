import {
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateAddressDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  label?: string;

  @IsString()
  @MaxLength(12)
  @Matches(/^\d{5}-?\d{3}$/, { message: 'CEP inválido.' })
  cep: string;

  @IsString()
  @MaxLength(255)
  street: string;

  @IsString()
  @MaxLength(120)
  neighborhood: string;

  @IsString()
  @MaxLength(30)
  number: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  reference?: string;

  @IsString()
  @MaxLength(120)
  city: string;

  @IsString()
  @MaxLength(2)
  @Matches(/^[A-Z]{2}$/, { message: 'Estado deve conter uma UF válida.' })
  state: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
