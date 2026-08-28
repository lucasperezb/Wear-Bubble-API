import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateShipStageDto {
  @IsIn([0, 1, 2, 3, 4, 5])
  shipStage: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  tracking?: string;
}
