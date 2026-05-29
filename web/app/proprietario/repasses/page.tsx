'use client';

/**
 * Portal proprietário — Histórico de repasses.
 *
 * AN.3 (M42, 2026-05-30): refator pra consumir endpoint `/proprietario/repasses`
 * já estendido (AN.2) com `tipo: 'REAL' | 'PREVISTO_FALLBACK'` + colunas
 * `dataPagamento` / `metodoPagamento` / `comprovante` / `repasseId` quando
 * `tipo === 'REAL'`.
 *
 * Meses sem RepasseProprietario persistido (pré-AN ou sem cron rodar) caem
 * em fallback on-the-fly mantendo o comportamento BH.5 anterior.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  DollarSign,
  ExternalLink,
  Info,
  Loader2,
  XCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import api from '@/lib/api';

interface Repasse {
  usinaId: string;
  usinaNome: string;
  mes: string;
  competencia: string;
  kwhGerado: number;
  valor: number | null;
  valorBruto: number | null;
  totalDespesasAbatidas: number;
  formula: string | null;
  fonteTarifa: string | null;
  motivo: string | null;
  status: string;
  dataPagamento: string | null;
  metodoPagamento: string | null;
  comprovante: string | null;
  repasseId: string | null;
  tipo: 'REAL' | 'PREVISTO_FALLBACK';
}

interface Response {
  repasses: Repasse[];
  totalYTD: number;
  filtros: any;
}

function fmtMoney(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—';
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtKwh(v: number): string {
  return `${v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} kWh`;
}

function fmtDate(s: string | null): string {
  if (!s) return '—';
  try {
    return new Date(s).toLocaleDateString('pt-BR');
  } catch {
    return '—';
  }
}

const STATUS_BADGE: Record<string, string> = {
  PENDENTE: 'bg-yellow-100 text-yellow-700 border border-yellow-300',
  PAGO: 'bg-green-100 text-green-700 border border-green-300',
  CANCELADO: 'bg-gray-100 text-gray-600 border border-gray-300',
  PREVISTO: 'bg-blue-50 text-blue-700 border border-blue-200',
};

function StatusBadge({ tipo, status }: { tipo: Repasse['tipo']; status: string }) {
  const clsLabel = STATUS_BADGE[status] ?? 'bg-gray-100 text-gray-700';
  return (
    <div className="flex items-center gap-1">
      <Badge className={clsLabel}>{status}</Badge>
      {tipo === 'PREVISTO_FALLBACK' && (
        <span
          className="text-[10px] text-gray-400"
          title="Cálculo previsto — repasse real ainda não registrado pelo admin"
        >
          (previsto)
        </span>
      )}
    </div>
  );
}

export default function ProprietarioRepassesPage() {
  const [data, setData] = useState<Response | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    api
      .get<Response>('/proprietario/repasses')
      .then((r) => setData(r.data))
      .catch(() => setData({ repasses: [], totalYTD: 0, filtros: {} }))
      .finally(() => setCarregando(false));
  }, []);

  const kpis = useMemo(() => {
    const reps = data?.repasses ?? [];
    const previstoYTD = reps
      .filter((r) => r.valor !== null && r.valor !== undefined)
      .reduce((s, r) => s + (r.valor ?? 0), 0);
    const pagoYTD = reps
      .filter((r) => r.tipo === 'REAL' && r.status === 'PAGO')
      .reduce((s, r) => s + (r.valor ?? 0), 0);
    const pendentes = reps.filter((r) => r.tipo === 'REAL' && r.status === 'PENDENTE');

    return {
      previstoYTD: Math.round(previstoYTD * 100) / 100,
      pagoYTD: Math.round(pagoYTD * 100) / 100,
      pendentesCount: pendentes.length,
      pendentesTotal: pendentes.reduce((s, r) => s + (r.valor ?? 0), 0),
    };
  }, [data]);

  if (carregando) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-amber-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Repasses</h1>
        <p className="text-sm text-gray-500 mt-1">
          Histórico cronológico — valores reais registrados pelo admin do parceiro.
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-md p-3 flex gap-2">
        <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <strong>Status real</strong> reflete o que o admin do parceiro registrou.{' '}
          <span className="text-blue-700">PENDENTE</span> = aguardando pagamento.{' '}
          <span className="text-green-700">PAGO</span> = comprovante disponível.{' '}
          Meses sem repasse persistido ainda mostram <em>previsto</em> calculado on-the-fly.
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard
          titulo={`Previsto YTD ${new Date().getFullYear()}`}
          icone={<DollarSign className="h-5 w-5 text-blue-600" />}
          valor={fmtMoney(kpis.previstoYTD)}
          cor="bg-blue-50 border-blue-200"
        />
        <KpiCard
          titulo={`Recebido YTD ${new Date().getFullYear()}`}
          icone={<CheckCircle2 className="h-5 w-5 text-green-600" />}
          valor={fmtMoney(kpis.pagoYTD)}
          cor="bg-green-50 border-green-200"
        />
        <KpiCard
          titulo="Pendentes"
          icone={<Clock className="h-5 w-5 text-yellow-600" />}
          valor={`${kpis.pendentesCount} repasse(s)`}
          sub={fmtMoney(kpis.pendentesTotal)}
          cor="bg-yellow-50 border-yellow-200"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Histórico</CardTitle>
        </CardHeader>
        <CardContent>
          {!data || data.repasses.length === 0 ? (
            <div className="text-center py-12">
              <DollarSign className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">Nenhum repasse registrado ainda.</p>
              <p className="text-gray-400 text-xs mt-1">
                Os repasses aparecem aqui conforme a geração mensal é registrada.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[850px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Período</TableHead>
                    <TableHead>Usina</TableHead>
                    <TableHead className="text-right">kWh Gerado</TableHead>
                    <TableHead className="text-right">Valor previsto</TableHead>
                    <TableHead className="text-right">Valor pago</TableHead>
                    <TableHead>Data pgto</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Comprovante</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.repasses.map((r, i) => {
                    const isReal = r.tipo === 'REAL';
                    const pago = isReal && r.status === 'PAGO';
                    return (
                      <TableRow key={`${r.usinaId}-${r.competencia}-${i}`}>
                        <TableCell className="font-medium">{r.mes}</TableCell>
                        <TableCell>{r.usinaNome}</TableCell>
                        <TableCell className="text-right">{fmtKwh(r.kwhGerado)}</TableCell>
                        <TableCell className="text-right">
                          {fmtMoney(r.valor)}
                          {r.motivo && (
                            <p className="text-[10px] text-orange-600 mt-0.5">{r.motivo}</p>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-green-700">
                          {pago ? fmtMoney(r.valor) : '—'}
                        </TableCell>
                        <TableCell className="text-xs">{fmtDate(r.dataPagamento)}</TableCell>
                        <TableCell>
                          <StatusBadge tipo={r.tipo} status={r.status} />
                        </TableCell>
                        <TableCell>
                          {r.comprovante ? (
                            <a
                              href={r.comprovante}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-amber-700 hover:underline flex items-center gap-1"
                            >
                              <ExternalLink className="w-3 h-3" />
                              Ver
                            </a>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({
  titulo,
  icone,
  valor,
  sub,
  cor,
}: {
  titulo: string;
  icone: React.ReactNode;
  valor: string;
  sub?: string;
  cor: string;
}) {
  return (
    <Card className={`border ${cor}`}>
      <CardContent className="pt-4">
        <div className="flex items-center gap-2 mb-1">
          {icone}
          <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">{titulo}</span>
        </div>
        <p className="text-lg font-bold text-gray-900">{valor}</p>
        {sub && <p className="text-sm text-gray-600 mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}
