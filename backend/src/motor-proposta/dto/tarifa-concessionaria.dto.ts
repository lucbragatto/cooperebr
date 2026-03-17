export class TarifaConcessionariaDto {
  concessionaria!: string;
  dataVigencia!: string;
  tusdAnterior!: number;
  tusdNova!: number;
  teAnterior!: number;
  teNova!: number;
  percentualAnunciado!: number;
  percentualApurado!: number;
  percentualAplicado!: number;
  observacoes?: string;
}
