import { IsString, IsOptional, IsIn } from 'class-validator';

export class ProcessarFaturaDto {
  @IsString()
  cooperadoId!: string;

  @IsOptional()
  @IsString()
  ucId?: string;

  @IsOptional()
  @IsString()
  planoId?: string;

  @IsString()
  arquivoBase64!: string;

  @IsIn(['pdf', 'imagem'])
  tipoArquivo!: 'pdf' | 'imagem';
}
