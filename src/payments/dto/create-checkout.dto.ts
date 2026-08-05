import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Max,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';
import { OrderItemDto } from '../../orders/dto/create-order.dto';

export class CheckoutCustomerDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  @Matches(/^[\p{L}\s.'-]+$/u, {
    message: 'Nome contém caracteres inválidos.',
  })
  name: string;

  @IsEmail()
  @MaxLength(255)
  email: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(18)
  @Matches(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/, {
    message: 'CPF deve estar no formato 000.000.000-00.',
  })
  taxId: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  @Matches(/^$|^\(\d{2}\) \d{4,5}-\d{4}$/, {
    message: 'Telefone deve estar no formato (00) 00000-0000.',
  })
  phone?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(12)
  @Matches(/^\d{5}-?\d{3}$/, { message: 'CEP inválido.' })
  cep: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  street: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  neighborhood?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  number: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  reference?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  city: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2)
  @Matches(/^[A-Z]{2}$/, { message: 'Estado deve conter uma UF válida.' })
  state: string;
}

export class CheckoutCardDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  holderName: string;

  @IsString()
  @Matches(/^\d{13,19}$/, { message: 'Número do cartão inválido.' })
  number: string;

  @IsString()
  @Matches(/^(0[1-9]|1[0-2])$/, { message: 'Mês de validade inválido.' })
  expiryMonth: string;

  @IsString()
  @Matches(/^\d{4}$/, { message: 'Ano de validade inválido.' })
  expiryYear: string;

  @IsString()
  @Matches(/^\d{3,4}$/, { message: 'CVV inválido.' })
  ccv: string;
}

export class CreateCheckoutDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @IsOptional()
  @IsIn(['Pix', 'Cartao de credito', 'Cartão de crédito', 'card', 'pix'])
  method?: 'Pix' | 'Cartao de credito' | 'Cartão de crédito' | 'card' | 'pix';

  @IsOptional()
  @IsString()
  @MaxLength(80)
  coupon?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  creditCode?: string | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => CheckoutCardDto)
  card?: CheckoutCardDto;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  installments?: number;

  @IsOptional()
  @IsUUID()
  existingOrderId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  shippingQuoteToken?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CheckoutCustomerDto)
  customer?: CheckoutCustomerDto;
}
