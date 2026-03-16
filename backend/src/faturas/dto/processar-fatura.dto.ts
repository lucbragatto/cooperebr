export class ProcessarFaturaDto {
  cooperadoId!: string;
  ucId?: string;
  planoId?: string;
  arquivoBase64!: string;
  tipoArquivo!: 'pdf' | 'imagem';
}
