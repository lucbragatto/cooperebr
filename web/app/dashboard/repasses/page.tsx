'use client';

/**
 * D-novo-AN AN.3 (M42, 2026-05-30) — Tela admin Repasses GLOBAL (cross-usinas).
 *
 * Análogo a /dashboard/usinas/[id]/repasses mas sem filtro de usina fixo.
 * Adiciona coluna "Usina" e filtro select por usina.
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  Loader2,
  Wallet,
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

interface UsinaOption {
  id: string;
  nome: string;
}

export default function RepassesGlobalPage() {
  const [repasses, setRepasses] = useState<Repasse[]>([]);
  const [usinas, setUsinas] = useState<UsinaOption[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  const [usinaFiltro, setUsinaFiltro] = useState('');
  const [statusFiltro, setStatusFiltro] = useState<StatusRepasse | ''>('');

  const [repasseSelecionado, setRepasseSelecionado] = useState<Repasse | null>(null);
  const [dialogTipo, setDialogTipo] = useState<'marcar-pago' | 'cancelar' | null>(null);

  async function carregar() {
    setErro('');
    try {
      const r = await api.get<Repasse[]>('/repasses', {
        params: {
          usinaId: usinaFiltro || undefined,
          status: statusFiltro || undefined,
        },
      });
      setRepasses(r.data);
    } catch (e: any) {
      setErro(e?.response?.data?.message ?? 'Erro ao carregar repasses.');
    }
  }

  useEffect(() => {
    // Carrega opções de usina pra o select
    api
      .get<UsinaOption[]>('/usinas')
      .then((r) => setUsinas(r.data ?? []))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    setCarregando(true);
    carregar().finally(() => setCarregando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usinaFiltro, statusFiltro]);

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

    const atrasados = pendentes.filter((r) => r.atrasado);

    return {
      pendentesCount: pendentes.length,
      pendentesTotal: totalPendente,
      pagosMesCount: pagosMes.length,
      pagosMesTotal: totalPagosMes,
      atrasadosCount: atrasados.length,
      atrasadosTotal: atrasados.reduce((s, r) => s + r.valorLiquido, 0),
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
        <Wallet className="h-7 w-7 text-amber-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Repasses (todas as usinas)</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Visão consolidada cross-usinas do parceiro. Para gerenciar uma usina específica, acesse{' '}
            <strong>Usinas → Detalhe → Repasses</strong>.
          </p>
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
          titulo="Pagos no mês atual"
          icone={<CheckCircle2 className="h-5 w-5 text-green-600" />}
          valor={`${kpis.pagosMesCount} repasse(s)`}
          subValor={fmtMoney(kpis.pagosMesTotal)}
          cor="bg-green-50 border-green-200"
        />
        <KpiCard
          titulo="Atrasados (PENDENTE > 30 dias)"
          icone={<AlertTriangle className="h-5 w-5 text-red-600" />}
          valor={`${kpis.atrasadosCount} repasse(s)`}
          subValor={fmtMoney(kpis.atrasadosTotal)}
          cor="bg-red-50 border-red-200"
        />
      </div>

      {/* Filtros */}
      <div className="flex gap-3 items-center flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Usina:</label>
          <select
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm min-w-[200px]"
            value={usinaFiltro}
            onChange={(e) => setUsinaFiltro(e.target.value)}
          >
            <option value="">Todas</option>
            {usinas.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nome}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
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
      </div>

      {/* Tabela */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Repasses ({repasses.length})</CardTitle>
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
              Nenhum repasse com os filtros atuais.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[1000px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Usina</TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead className="text-right">Bruto</TableHead>
                    <TableHead className="text-right">Abatido</TableHead>
                    <TableHead className="text-right">Líquido</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Método</TableHead>
                    <TableHead>Data pgto</TableHead>
                    <TableHead>Compr.</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {repasses.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <Link
                          href={`/dashboard/usinas/${r.usinaId}/repasses`}
                          className="text-amber-700 hover:underline text-sm"
                        >
                          {r.usinaNome ?? r.usinaId.slice(0, 8)}
                        </Link>
                      </TableCell>
                      <TableCell className="font-medium text-sm">
                        {fmtPeriodo(r.periodoInicio, r.periodoFim)}
                      </TableCell>
                      <TableCell className="text-right text-sm">{fmtMoney(r.valorBruto)}</TableCell>
                      <TableCell className="text-right text-sm text-blue-700">
                        {r.totalDespesasAbatidas > 0 ? fmtMoney(r.totalDespesasAbatidas) : '—'}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-green-700">
                        {fmtMoney(r.valorLiquido)}
                      </TableCell>
                      <TableCell>
                        <Badge className={STATUS_BADGE[r.status]}>{r.status}</Badge>
                        {r.atrasado && (
                          <Badge className="ml-1 bg-red-100 text-red-700 border-red-300 text-[10px]">
                            ATRASADO
                          </Badge>
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
                              Pago
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
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

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
