import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class UploadConcessionariaDto {
  @IsString()
  @IsNotEmpty()
  cooperadoId: string;

  @IsString()
  @IsNotEmpty()
  arquivoBase64: string;

  @IsString()
  @IsNotEmpty()
  tipoArquivo: 'pdf' | 'imagem';

  @IsString()
  @IsNotEmpty()
  mesReferencia: string; // '2026-03'

  @IsString()
  @IsOptional()
  ucId?: string;
}
