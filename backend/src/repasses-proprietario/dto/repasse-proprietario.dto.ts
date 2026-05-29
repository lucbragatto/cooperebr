import {
  MetodoPagamentoRepasse,
  StatusRepasseProprietario,
} from '@prisma/client';

/**
 * Envelope de retorno do RepasseProprietarioService.
 *
 * Convertemos `Decimal` do Prisma para `number` aqui pra simplificar o
 * consumo em frontend (axios/JSON serialização sem perda de precisão pra
 * valores monetários `(10,2)`).
 *
 * Campo `atrasado` é derivado em runtime — NÃO persiste no banco. Regra:
 * `status === PENDENTE && periodoFim < (hoje - 30d)`.
 */
export interface RepasseProprietarioDto {
  id: string;
  cooperativaId: string;
  usinaId: string;
  usinaNome?: string;
  proprietarioUsuarioId: string | null;
  proprietarioNome?: string | null;
  periodoInicio: Date;
  periodoFim: Date;
  valorBruto: number;
  totalDespesasAbatidas: number;
  valorLiquido: number;
  status: StatusRepasseProprietario;
  metodoPagamento: MetodoPagamentoRepasse | null;
  dataPagamento: Date | null;
  comprovante: string | null;
  observacao: string | null;
  registradoPorUsuarioId: string | null;
  registradoPorNome?: string | null;
  canceladoPorUsuarioId: string | null;
  canceladoEm: Date | null;
  motivoCancelamento: string | null;
  createdAt: Date;
  updatedAt: Date;
  /** Derivado em runtime: PENDENTE + periodoFim > 30d atrás. */
  atrasado: boolean;
}
