import { IsString, IsIn } from 'class-validator';

export type TipoDocumentoUpload =
  | 'RG_FRENTE'
  | 'RG_VERSO'
  | 'CNH_FRENTE'
  | 'CNH_VERSO'
  | 'CONTRATO_SOCIAL';

export class UploadDocumentoDto {
  @IsString()
  cooperadoId!: string;

  @IsIn(['RG_FRENTE', 'RG_VERSO', 'CNH_FRENTE', 'CNH_VERSO', 'CONTRATO_SOCIAL'])
  tipoDocumento!: TipoDocumentoUpload;

  @IsString()
  arquivoBase64!: string;

  @IsIn(['pdf', 'imagem'])
  tipoArquivo!: 'pdf' | 'imagem';
}
