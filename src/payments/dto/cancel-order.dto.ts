import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class CancelOrderDto {
  @ApiPropertyOptional({
    description:
      'true quando o gerente fará (ou já fez) o estorno manualmente fora do sistema; a API cancela o pedido sem pedir estorno ao Asaas.',
  })
  @IsOptional()
  @IsBoolean()
  refundedExternally?: boolean;
}
