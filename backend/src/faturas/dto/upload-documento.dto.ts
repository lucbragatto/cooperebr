export type TipoDocumentoUpload =
  | 'RG_FRENTE'
  | 'RG_VERSO'
  | 'CNH_FRENTE'
  | 'CNH_VERSO'
  | 'CONTRATO_SOCIAL';

export class UploadDocumentoDto {
  cooperadoId!: string;
  tipoDocumento!: TipoDocumentoUpload;
  arquivoBase64!: string;
  tipoArquivo!: 'pdf' | 'imagem';
}
