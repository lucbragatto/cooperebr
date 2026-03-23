import { IsString, IsOptional } from 'class-validator';

export class UploadModeloDto {
  @IsString()
  tipo: string; // CONTRATO | PROCURACAO

  @IsString()
  nome: string;

  @IsOptional()
  @IsString()
  cooperativaId?: string;
}
