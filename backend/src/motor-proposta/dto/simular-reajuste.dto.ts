import { IsString, IsNumber } from 'class-validator';

export class SimularReajusteDto {
  @IsString()
  tarifaId!: string;

  @IsString()
  indiceUtilizado!: string;

  @IsNumber()
  percentualIndice!: number;
}
