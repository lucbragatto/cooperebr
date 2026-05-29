'use client';

/**
 * D-novo-AN AN.3 (M42, 2026-05-30) — Tela admin Repasses por usina.
 *
 * Padrão UX Dual 17/05 Tipo B: lista da entidade Repasse de uma usina → página
 * própria. Dialogs Tipo C pra "Marcar pago" + "Cancelar" (ações focadas).
 */

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Info,
  Loader2,
  XCircle,
  Wallet,
  ExternalLink,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import api from '@/lib/api';
import { DialogMarcarPago } from '@/components/repasses/DialogMarcarPago';
import { DialogCancelar } from '@/components/repasses/DialogCancelar';
import {
  fmtDate,
  fmtMoney,
  fmtPeriodo,
  STATUS_BADGE,
  type Repasse,
  type StatusRepasse,
} from '@/components/repasses/types';

export default function RepassesUsinaPage() {
  const params = useParams();
  const router = useRouter();
  const usinaId = params?.id as string;

  const [nomeUsina, setNomeUsina] = useState('');
  const [repasses, setRepasses] = useState<Repasse[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  const [statusFiltro, setStatusFiltro] = useState<StatusRepasse | ''>('');
  const [repasseSelecionado, setRepasseSelecionado] = useState<Repasse | null>(null);
  const [dialogTipo, setDialogTipo] = useState<'marcar-pago' | 'cancelar' | null>(null);

  async function carregar() {
    setErro('');
    try {
      const r = await api.get<Repasse[]>('/repasses', {
        params: { usinaId, status: statusFiltro || undefined },
      });
      setRepasses(r.data);
    } catch (e: any) {
      setErro(e?.response?.data?.message ?? 'Erro ao carregar repasses.');
    }
  }

  useEffect(() => {
    if (!usinaId) return;
    api
      .get<{ nome: string }>(`/usinas/${usinaId}`)
      .then((r) => setNomeUsina(r.data.nome ?? ''))
      .catch(() => undefined);
  }, [usinaId]);

  useEffect(() => {
    if (!usinaId) return;
    setCarregando(true);
    carregar().finally(() => setCarregando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usinaId, statusFiltro]);

  const kpis = useMemo(() => {
    const pendentes = repasses.filter((r) => r.status === 'PENDENTE');
    const totalPendente = pendentes.reduce((s, r) => s + r.valorLiquido, 0);

    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);
    const pagosMes = repasses.filter(
      (r) => r.status === 'PAGO' && r.dataPagamento && new Date(r.dataPagamento) >= inicioMes,
    );
    const totalPagosMes = pagosMes.reduce((s, r) => s + r.valorLiquido, 0);

    const trinta = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const cancelados30 = repasses.filter(
      (r) => r.status === 'CANCELADO' && r.canceladoEm && new Date(r.canceladoEm) >= trinta,
    );

    return {
      pendentesCount: pendentes.length,
      pendentesTotal: totalPendente,
      pagosMesCount: pagosMes.length,
      pagosMesTotal: totalPagosMes,
      cancelados30Count: cancelados30.length,
    };
  }, [repasses]);

  const sucesso = () => {
    setDialogTipo(null);
    setRepasseSelecionado(null);
    carregar();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/dashboard/usinas/${usinaId}`)}
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Voltar
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Wallet className="h-6 w-6 text-amber-600" />
            Repasses ao proprietário
          </h1>
          {nomeUsina && <p className="text-sm text-gray-500 mt-0.5">{nomeUsina}</p>}
        </div>
      </div>

      {/* Banner help */}
      <div className="bg-blue-50 border border-blue-200 rounded-md p-3 flex gap-2 text-sm text-blue-900">
        <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <strong>Repasses do parceiro pro proprietário da usina.</strong> O cron mensal
          (dia 1, 03:00) cria automaticamente um repasse <strong>PENDENTE</strong> refletindo
          o aluguel do mês anterior, descontando despesas <strong>DESCONTO_NO_REPASSE</strong>
          aprovadas do período. Quando o pagamento real acontecer, marque como{' '}
          <strong>pago</strong> com método + data + comprovante. A ação resolve as despesas
          abatidas automaticamente.
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard
          titulo="Pendentes"
          icone={<Clock className="h-5 w-5 text-yellow-600" />}
          valor={`${kpis.pendentesCount} repasse(s)`}
          subValor={fmtMoney(kpis.pendentesTotal)}
          cor="bg-yellow-50 border-yellow-200"
        />
        <KpiCard
          titulo="Pagos no mês"
          icone={<CheckCircle2 className="h-5 w-5 text-green-600" />}
          valor={`${kpis.pagosMesCount} repasse(s)`}
          subValor={fmtMoney(kpis.pagosMesTotal)}
          cor="bg-green-50 border-green-200"
        />
        <KpiCard
          titulo="Cancelados (30d)"
          icone={<XCircle className="h-5 w-5 text-gray-500" />}
          valor={`${kpis.cancelados30Count} repasse(s)`}
          subValor=""
          cor="bg-gray-50 border-gray-200"
        />
      </div>

      {/* Filtros */}
      <div className="flex gap-2 items-center">
        <label className="text-sm text-gray-600">Status:</label>
        <select
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
          value={statusFiltro}
          onChange={(e) => setStatusFiltro(e.target.value as StatusRepasse | '')}
        >
          <option value="">Todos</option>
          <option value="PENDENTE">Pendente</option>
          <option value="PAGO">Pago</option>
          <option value="CANCELADO">Cancelado</option>
        </select>
      </div>

      {/* Tabela */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico ({repasses.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {carregando ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-amber-600" />
            </div>
          ) : erro ? (
            <p className="text-sm text-red-600">{erro}</p>
          ) : repasses.length === 0 ? (
            <div className="text-center py-10 text-sm text-gray-500">
              <Wallet className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              {statusFiltro
                ? `Nenhum repasse com status ${statusFiltro}.`
                : 'Nenhum repasse registrado ainda. O cron mensal cria automaticamente no dia 1.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[900px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Período</TableHead>
                    <TableHead className="text-right">Bruto</TableHead>
                    <TableHead className="text-right">Despesas abatidas</TableHead>
                    <TableHead className="text-right">Líquido</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Método</TableHead>
                    <TableHead>Data pgto</TableHead>
                    <TableHead>Comprovante</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {repasses.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{fmtPeriodo(r.periodoInicio, r.periodoFim)}</TableCell>
                      <TableCell className="text-right">{fmtMoney(r.valorBruto)}</TableCell>
                      <TableCell className="text-right text-blue-700">
                        {r.totalDespesasAbatidas > 0 ? fmtMoney(r.totalDespesasAbatidas) : '—'}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-green-700">
                        {fmtMoney(r.valorLiquido)}
                      </TableCell>
                      <TableCell>
                        <Badge className={STATUS_BADGE[r.status]}>{r.status}</Badge>
                        {r.atrasado && (
                          <Badge className="ml-1 bg-red-100 text-red-700 border-red-300">ATRASADO</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">{r.metodoPagamento ?? '—'}</TableCell>
                      <TableCell className="text-xs">{fmtDate(r.dataPagamento)}</TableCell>
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
                      <TableCell className="text-right">
                        {r.status === 'PENDENTE' && (
                          <div className="flex gap-1 justify-end">
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700 h-7 text-xs px-2"
                              onClick={() => {
                                setRepasseSelecionado(r);
                                setDialogTipo('marcar-pago');
                              }}
                            >
                              Marcar pago
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-red-300 text-red-700 hover:bg-red-50 h-7 text-xs px-2"
                              onClick={() => {
                                setRepasseSelecionado(r);
                                setDialogTipo('cancelar');
                              }}
                            >
                              Cancelar
                            </Button>
                          </div>
                        )}
                        {r.status === 'CANCELADO' && r.motivoCancelamento && (
                          <span className="text-xs text-gray-500" title={r.motivoCancelamento}>
                            ℹ️
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      {repasseSelecionado && dialogTipo === 'marcar-pago' && (
        <DialogMarcarPago
          repasse={repasseSelecionado}
          open
          onOpenChange={(v) => !v && setDialogTipo(null)}
          onSuccess={sucesso}
        />
      )}
      {repasseSelecionado && dialogTipo === 'cancelar' && (
        <DialogCancelar
          repasse={repasseSelecionado}
          open
          onOpenChange={(v) => !v && setDialogTipo(null)}
          onSuccess={sucesso}
        />
      )}
    </div>
  );
}

function KpiCard({
  titulo,
  icone,
  valor,
  subValor,
  cor,
}: {
  titulo: string;
  icone: React.ReactNode;
  valor: string;
  subValor: string;
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
        {subValor && <p className="text-sm text-gray-600 mt-0.5">{subValor}</p>}
      </CardContent>
    </Card>
  );
}
