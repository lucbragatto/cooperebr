import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CancelarEnvioDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  motivo?: string;
}
