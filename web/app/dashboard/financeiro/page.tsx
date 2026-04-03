'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  DollarSign, Download, TrendingUp, TrendingDown, ArrowUpDown,
  ArrowDownCircle, ArrowUpCircle, CheckCircle, LineChart, Wallet,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';

function competenciaAtual(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function formatarCompetencia(comp: string): string {
  const [ano, mes] = comp.split('-');
  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${meses[Number(mes) - 1]}/${ano}`;
}

function formatarMoeda(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarData(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('pt-BR');
}

interface ResumoFinanceiro {
  aReceberPrevisto: number;
  aPagarPrevisto: number;
  recebidoRealizado: number;
  pagoRealizado: number;
  saldoLiquido: number;
}

interface TransacaoItem {
  id: string;
  descricao: string;
  tipo: string;
  valor: number;
  status?: string;
  categoriaNome?: string;
  cooperado?: string;
  dataVencimento?: string;
  dataPagamento?: string | null;
}

interface HistoricoItem {
  competencia: string;
  receitas: number;
  despesas: number;
}

interface DadosLivroCaixa {
  totalEntradas: number;
  totalDespesas: number;
  totalAsaasRecebido: number;
  saldoMes: number;
  entradas: TransacaoItem[];
  saidas: TransacaoItem[];
  historico: HistoricoItem[];
}

function StatusBadge({ status, dataVencimento }: { status?: string; dataVencimento?: string }) {
  if (status === 'REALIZADO') {
    return <Badge className="bg-green-100 text-green-700 border-green-200">Realizado</Badge>;
  }
  if (dataVencimento) {
    const vencimento = new Date(dataVencimento);
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    if (vencimento < hoje) {
      return <Badge className="bg-red-100 text-red-700 border-red-200">Vencido</Badge>;
    }
  }
  return (
    <Badge variant="outline" className="text-gray-500 border-dashed border-gray-300">
      Previsto
    </Badge>
  );
}

function CardSkeleton() {
  return (
    <Card>
      <CardContent className="pt-4 pb-3 px-4">
        <div className="flex items-center gap-2 mb-2">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="h-6 w-28" />
      </CardContent>
    </Card>
  );
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; color: string }>; label?: string }) {
  if (!active || !payload) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
      <p className="text-sm font-medium text-gray-700 mb-1">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} className="text-sm" style={{ color: entry.color }}>
          {entry.name}: {formatarMoeda(entry.value)}
        </p>
      ))}
    </div>
  );
}

export default function FinanceiroPage() {
  const [competencia, setCompetencia] = useState(competenciaAtual());
  const [dados, setDados] = useState<DadosLivroCaixa | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [tab, setTab] = useState<'entradas' | 'saidas' | 'resumo'>('resumo');
  const [resumo, setResumo] = useState<ResumoFinanceiro | null>(null);
  const [carregandoResumo, setCarregandoResumo] = useState(true);

  useEffect(() => {
    setCarregando(true);
    api.get(`/financeiro/livro-caixa?competencia=${competencia}`)
      .then((r) => setDados(r.data))
      .catch(() => setDados(null))
      .finally(() => setCarregando(false));
  }, [competencia]);

  // Carregar resumo consolidado do mês atual
  useEffect(() => {
    setCarregandoResumo(true);
    const comp = competenciaAtual();
    Promise.all([
      api.get(`/financeiro/lancamentos?tipo=RECEITA&status=PREVISTO&competencia=${comp}`).catch(() => ({ data: [] })),
      api.get(`/financeiro/lancamentos?tipo=DESPESA&status=PREVISTO&competencia=${comp}`).catch(() => ({ data: [] })),
      api.get(`/financeiro/lancamentos?tipo=RECEITA&status=REALIZADO&competencia=${comp}`).catch(() => ({ data: [] })),
      api.get(`/financeiro/lancamentos?tipo=DESPESA&status=REALIZADO&competencia=${comp}`).catch(() => ({ data: [] })),
    ]).then(([recPrev, desPrev, recReal, desReal]) => {
      const aReceberPrevisto = (recPrev.data as TransacaoItem[]).reduce((s: number, l) => s + Number(l.valor), 0);
      const aPagarPrevisto = (desPrev.data as TransacaoItem[]).reduce((s: number, l) => s + Number(l.valor), 0);
      const recebidoRealizado = (recReal.data as TransacaoItem[]).reduce((s: number, l) => s + Number(l.valor), 0);
      const pagoRealizado = (desReal.data as TransacaoItem[]).reduce((s: number, l) => s + Number(l.valor), 0);
      setResumo({
        aReceberPrevisto,
        aPagarPrevisto,
        recebidoRealizado,
        pagoRealizado,
        saldoLiquido: (aReceberPrevisto + recebidoRealizado) - (aPagarPrevisto + pagoRealizado),
      });
    }).finally(() => setCarregandoResumo(false));
  }, []);

  function exportarCsv() {
    if (!dados) return;
    const all = [...(dados.entradas || []), ...(dados.saidas || [])];
    const escapeCsv = (v: string) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = 'Tipo,Descricao,Valor,Categoria,Cooperado,Vencimento,Pagamento,Status';
    const rows = all.map((t) =>
      [t.tipo, t.descricao, Number(t.valor).toFixed(2), t.categoriaNome ?? '', t.cooperado ?? '', formatarData(t.dataVencimento ?? null), formatarData(t.dataPagamento ?? null), t.status ?? ''].map(escapeCsv).join(',')
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `livro-caixa-${competencia}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Navegação de mês
  function mesPrev() {
    const [a, m] = competencia.split('-').map(Number);
    const d = new Date(a, m - 2, 1);
    setCompetencia(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  function mesNext() {
    const [a, m] = competencia.split('-').map(Number);
    const d = new Date(a, m, 1);
    setCompetencia(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  // Dados para Recharts
  const chartData = dados?.historico?.map((h) => ({
    name: formatarCompetencia(h.competencia),
    Receitas: h.receitas,
    Despesas: h.despesas,
  })) ?? [];

  // Totais para tabs
  const totalEntradas = dados?.entradas?.reduce((s, t) => s + Number(t.valor), 0) ?? 0;
  const totalSaidas = dados?.saidas?.reduce((s, t) => s + Number(t.valor), 0) ?? 0;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Wallet className="h-6 w-6 text-green-600" />
        <h2 className="text-2xl font-bold text-gray-800">Dashboard Financeiro</h2>
      </div>

      {/* Resumo consolidado */}
      {carregandoResumo ? (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          {Array.from({ length: 5 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : resumo && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2 mb-1">
                <ArrowDownCircle className="h-4 w-4 text-blue-600" />
                <span className="text-xs text-gray-500">A Receber (Previsto)</span>
              </div>
              <p className="text-lg font-bold text-blue-700">{formatarMoeda(resumo.aReceberPrevisto)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2 mb-1">
                <ArrowUpCircle className="h-4 w-4 text-red-600" />
                <span className="text-xs text-gray-500">A Pagar (Previsto)</span>
              </div>
              <p className="text-lg font-bold text-red-700">{formatarMoeda(resumo.aPagarPrevisto)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-xs text-gray-500">Recebido (Realizado)</span>
              </div>
              <p className="text-lg font-bold text-green-700">{formatarMoeda(resumo.recebidoRealizado)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle className="h-4 w-4 text-orange-600" />
                <span className="text-xs text-gray-500">Pago (Realizado)</span>
              </div>
              <p className="text-lg font-bold text-orange-700">{formatarMoeda(resumo.pagoRealizado)}</p>
            </CardContent>
          </Card>
          <Card className={resumo.saldoLiquido >= 0 ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="h-4 w-4 text-purple-600" />
                <span className="text-xs text-gray-500">Saldo Liquido Projetado</span>
              </div>
              <p className={`text-lg font-bold ${resumo.saldoLiquido >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                {formatarMoeda(resumo.saldoLiquido)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Links rápidos */}
      <div className="flex flex-wrap gap-2 mb-6">
        <Link href="/dashboard/financeiro/contas-receber">
          <Button variant="outline" size="sm">
            <ArrowDownCircle className="h-4 w-4 mr-1" /> Contas a Receber
          </Button>
        </Link>
        <Link href="/dashboard/financeiro/contas-pagar">
          <Button variant="outline" size="sm">
            <ArrowUpCircle className="h-4 w-4 mr-1" /> Contas a Pagar
          </Button>
        </Link>
        <Link href="/dashboard/financeiro/fluxo-caixa">
          <Button variant="outline" size="sm">
            <LineChart className="h-4 w-4 mr-1" /> Fluxo de Caixa
          </Button>
        </Link>
      </div>

      {/* Livro Caixa */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <DollarSign className="h-5 w-5 text-green-600" />
          <h3 className="text-lg font-bold text-gray-800">Livro Caixa</h3>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={mesPrev}>&larr;</Button>
          <span className="text-sm font-medium px-3">{formatarCompetencia(competencia)}</span>
          <Button variant="outline" size="sm" onClick={mesNext}>&rarr;</Button>
          <Button variant="outline" size="sm" onClick={exportarCsv} disabled={!dados}>
            <Download className="h-4 w-4 mr-1" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {carregando ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
          </div>
          <Card>
            <CardContent className="pt-6">
              <Skeleton className="h-[200px] w-full" />
            </CardContent>
          </Card>
        </div>
      ) : dados && (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                  <span className="text-xs text-gray-500">Total Entradas</span>
                </div>
                <p className="text-xl font-bold text-green-700">{formatarMoeda(dados.totalEntradas)}</p>
                {dados.totalAsaasRecebido > 0 && (
                  <p className="text-[10px] text-gray-400 mt-0.5">Asaas: {formatarMoeda(dados.totalAsaasRecebido)}</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingDown className="h-4 w-4 text-red-600" />
                  <span className="text-xs text-gray-500">Total Saidas</span>
                </div>
                <p className="text-xl font-bold text-red-700">{formatarMoeda(dados.totalDespesas)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center gap-2 mb-1">
                  <ArrowUpDown className="h-4 w-4 text-blue-600" />
                  <span className="text-xs text-gray-500">Saldo do Mes</span>
                </div>
                <p className={`text-xl font-bold ${dados.saldoMes >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                  {formatarMoeda(dados.saldoMes)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="h-4 w-4 text-purple-600" />
                  <span className="text-xs text-gray-500">Transacoes</span>
                </div>
                <p className="text-xl font-bold text-gray-800">
                  {(dados.entradas?.length || 0) + (dados.saidas?.length || 0)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Gráfico Recharts — últimos 6 meses */}
          {chartData.length > 0 && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-base">Ultimos 6 Meses</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Bar dataKey="Receitas" fill="#22c55e" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Despesas" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Tabs com totais */}
          <div className="flex gap-1 mb-4">
            <Button
              size="sm"
              variant={tab === 'resumo' ? 'default' : 'outline'}
              onClick={() => setTab('resumo')}
            >
              Resumo
              <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5">
                {(dados.entradas?.length || 0) + (dados.saidas?.length || 0)}
              </Badge>
            </Button>
            <Button
              size="sm"
              variant={tab === 'entradas' ? 'default' : 'outline'}
              onClick={() => setTab('entradas')}
            >
              Entradas
              <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 bg-green-100 text-green-700">
                {formatarMoeda(totalEntradas)}
              </Badge>
            </Button>
            <Button
              size="sm"
              variant={tab === 'saidas' ? 'default' : 'outline'}
              onClick={() => setTab('saidas')}
            >
              Saidas
              <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 bg-red-100 text-red-700">
                {formatarMoeda(totalSaidas)}
              </Badge>
            </Button>
          </div>

          {/* Tabela com status badge */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Descricao</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Cooperado</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Pagamento</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(() => {
                    const itens = tab === 'entradas'
                      ? dados.entradas
                      : tab === 'saidas'
                        ? dados.saidas
                        : [...(dados.entradas || []), ...(dados.saidas || [])];

                    if (!itens || itens.length === 0) {
                      return (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-gray-400 py-6">
                            Nenhuma transacao no periodo
                          </TableCell>
                        </TableRow>
                      );
                    }

                    return itens.map((t, i: number) => (
                      <TableRow key={`${t.id}-${i}`}>
                        <TableCell className="font-medium max-w-[240px] truncate">{t.descricao}</TableCell>
                        <TableCell>
                          <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">{t.categoriaNome}</span>
                        </TableCell>
                        <TableCell>{t.cooperado || '—'}</TableCell>
                        <TableCell>{formatarData(t.dataVencimento ?? null)}</TableCell>
                        <TableCell>{formatarData(t.dataPagamento ?? null)}</TableCell>
                        <TableCell>
                          <StatusBadge status={t.status} dataVencimento={t.dataVencimento} />
                        </TableCell>
                        <TableCell className={`text-right font-medium ${t.tipo === 'RECEITA' ? 'text-green-700' : 'text-red-700'}`}>
                          {t.tipo === 'RECEITA' ? '+' : '-'} {formatarMoeda(t.valor)}
                        </TableCell>
                      </TableRow>
                    ));
                  })()}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
