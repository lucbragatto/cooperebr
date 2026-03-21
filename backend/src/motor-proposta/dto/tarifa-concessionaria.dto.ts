import { IsString, IsNumber, IsOptional } from 'class-validator';

export class TarifaConcessionariaDto {
  @IsString()
  concessionaria!: string;

  @IsString()
  dataVigencia!: string;

  @IsNumber()
  tusdAnterior!: number;

  @IsNumber()
  tusdNova!: number;

  @IsNumber()
  teAnterior!: number;

  @IsNumber()
  teNova!: number;

  @IsNumber()
  percentualAnunciado!: number;

  @IsNumber()
  percentualApurado!: number;

  @IsNumber()
  percentualAplicado!: number;

  @IsOptional() @IsString()
  observacoes?: string;
}
