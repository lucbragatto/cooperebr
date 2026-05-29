/**
 * D-novo-AN AN.3 (M42, 30/05/2026) — Tipos compartilhados das telas de repasse.
 *
 * Espelha o `RepasseProprietarioDto` do backend mantendo Decimal já como
 * `number` (axios JSON serializa de Decimal pra number nativo).
 */

export type StatusRepasse = 'PENDENTE' | 'PAGO' | 'CANCELADO';
export type MetodoPagamentoRepasse = 'PIX' | 'TED' | 'MANUAL' | 'OUTRO';

export interface Repasse {
  id: string;
  cooperativaId: string;
  usinaId: string;
  usinaNome?: string;
  proprietarioUsuarioId: string | null;
  proprietarioNome?: string | null;
  periodoInicio: string;
  periodoFim: string;
  valorBruto: number;
  totalDespesasAbatidas: number;
  valorLiquido: number;
  status: StatusRepasse;
  metodoPagamento: MetodoPagamentoRepasse | null;
  dataPagamento: string | null;
  comprovante: string | null;
  observacao: string | null;
  registradoPorUsuarioId: string | null;
  registradoPorNome?: string | null;
  canceladoPorUsuarioId: string | null;
  canceladoEm: string | null;
  motivoCancelamento: string | null;
  createdAt: string;
  updatedAt: string;
  atrasado: boolean;
}

export const STATUS_BADGE: Record<StatusRepasse, string> = {
  PENDENTE: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  PAGO: 'bg-green-100 text-green-800 border-green-300',
  CANCELADO: 'bg-gray-100 text-gray-600 border-gray-300',
};

export const METODOS: { value: MetodoPagamentoRepasse; label: string }[] = [
  { value: 'PIX', label: 'PIX' },
  { value: 'TED', label: 'TED' },
  { value: 'MANUAL', label: 'Manual (boleto/depósito)' },
  { value: 'OUTRO', label: 'Outro (especificar)' },
];

export function fmtMoney(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—';
  return `R$ ${v.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function fmtDate(s: string | null | undefined): string {
  if (!s) return '—';
  try {
    return new Date(s).toLocaleDateString('pt-BR');
  } catch {
    return '—';
  }
}

export function fmtPeriodo(inicio: string, fim: string): string {
  try {
    const d = new Date(fim);
    return `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  } catch {
    return '—';
  }
}
