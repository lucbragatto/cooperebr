export class ProcessarFaturaDto {
  cooperadoId!: string;
  ucId?: string;
  arquivoBase64!: string;
  tipoArquivo!: 'pdf' | 'imagem';
}
