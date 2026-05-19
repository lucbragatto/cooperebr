import { IsOptional, IsString, MaxLength } from 'class-validator';

export class DescartarAlocacaoDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  motivo?: string;
}
