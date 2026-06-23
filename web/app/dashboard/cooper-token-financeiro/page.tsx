'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Wallet, TrendingUp, TrendingDown, Coins, DollarSign, Users, ArrowLeft,
  AlertTriangle, Hourglass,
} from 'lucide-react';
// Sprint Clube P1 — Fase 1.1 (10/06/2026): botao "Voltar ao Clube" consistente.
import Link from 'next/link';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';

function fmt(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—';
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtToken(v: number): string {
  return Number.isInteger(v) ? v.toLocaleString('pt-BR') : v.toFixed(4);
}

interface Financeiro {
  passivoTotal: number;
  receitaParceiros: number;
  custoResgates: number;
  receitaExpiracao: number;
  tokensCirculacao: number;
  tokensResgatados: number;
  tokensExpirados: number;
  valorTokenReais: number;
  periodo: string;
  ano: number;
  mes: number;
}

interface FluxoMes {
  mes: string;
  emitido: number;
  resgatado: number;
  expirado: number;
  compraParceiro: number;
}

interface RendimentoCooperado {
  cooperadoId: string;
  nomeCompleto: string;
  email: string;
  tokensUsados: number;
  economiaReais: number;
}

type Periodo = 'mes' | 'trimestre' | 'ano';
type Aba = 'resumo' | 'passivo';

// Sprint M52a Bloco E (23/06/2026) — payload do endpoint passivo-detalhado.
// Re-review orquestrador 23/06: SUPER_ADMIN cross-tenant retorna valor R$ null
// (não pode-se misturar valorToken de tenants diferentes). Frontend mostra
// só face quando valorReais === null.
interface PassivoDetalhado {
  valorTokenReais: number | null;
  precisaoCrossTenant: string | null;
  passivoTotalFace: number;
  passivoTotalReais: number | null;
  decomposicao: {
    disponivel: { face: number; reais: number | null };
    pendente: { face: number; reais: number | null };
    bloqueadoResgate: { face: number; reais: number | null };
  };
  forecastExpiracao: Array<{
    janela: string;
    tokensAExpirar: number;
    valorReais: number | null;
  }>;
  topCooperados: Array<{
    cooperadoId: string;
    nomeCompleto: string;
    email: string;
    saldoDisponivel: number;
    saldoPendente: number;
    saldoBloqueadoResgate: number;
    faceTotal: number;
    valorReais: number | null;
  }>;
}

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function CustomTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ value: number; name: string; color: string }>;
  label?: string;
}) {
  if (!active || !payload) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
      <p className="text-sm font-medium text-gray-700 mb-1">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} className="text-xs" style={{ color: entry.color }}>
          {entry.name}: {fmt(entry.value)}
        </p>
      ))}
    </div>
  );
}

export default function CooperTokenFinanceiroPage() {
  const now = new Date();
  const [periodo, setPeriodo] = useState<Periodo>('mes');
  const [ano, setAno] = useState(now.getFullYear());
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [financeiro, setFinanceiro] = useState<Financeiro | null>(null);
  const [fluxo, setFluxo] = useState<FluxoMes[]>([]);
  const [ranking, setRanking] = useState<RendimentoCooperado[]>([]);
  const [passivo, setPassivo] = useState<PassivoDetalhado | null>(null);
  const [aba, setAba] = useState<Aba>('resumo');
  const [loading, setLoading] = useState(true);
  // Re-review orquestrador 23/06 (code MEDIUM + financeiro P3-04):
  // Promise.allSettled em vez de allSettled silencioso — uma falha de
  // endpoint não derruba os outros 3 + exibe banner ao usuário.
  const [erros, setErros] = useState<string[]>([]);

  const carregarDados = useCallback(async () => {
    setLoading(true);
    setErros([]);
    const resultados = await Promise.allSettled([
      api.get<Financeiro>('/cooper-token/admin/financeiro', {
        params: { periodo, ano, mes },
      }),
      api.get<FluxoMes[]>('/cooper-token/admin/fluxo-caixa'),
      api.get<RendimentoCooperado[]>('/cooper-token/admin/rendimento-cooperados', {
        params: { limit: 10 },
      }),
      api.get<PassivoDetalhado>('/cooper-token/admin/passivo-detalhado'),
    ]);
    const rotulos = ['Resumo financeiro', 'Fluxo de caixa', 'Ranking cooperados', 'Passivo detalhado'];
    const novosErros: string[] = [];
    resultados.forEach((r, i) => {
      if (r.status === 'fulfilled') {
        if (i === 0) setFinanceiro((r.value as { data: Financeiro }).data);
        if (i === 1) setFluxo((r.value as { data: FluxoMes[] }).data);
        if (i === 2) setRanking((r.value as { data: RendimentoCooperado[] }).data);
        if (i === 3) setPassivo((r.value as { data: PassivoDetalhado }).data);
      } else {
        novosErros.push(rotulos[i]);
      }
    });
    setErros(novosErros);
    setLoading(false);
  }, [periodo, ano, mes]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Sprint Clube P1 — Fase 1.1: voltar ao hub do Clube. */}
      <Link href="/dashboard/clube" className="inline-block">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Voltar ao Clube
        </Button>
      </Link>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Financeiro Tokens</h1>
          <p className="text-sm text-gray-500">
            Analise o impacto financeiro do CooperToken
          </p>
        </div>
      </div>

      {erros.length > 0 && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          Falha ao carregar: <strong>{erros.join(', ')}</strong>. As demais
          seções foram carregadas normalmente. Tente recarregar a página em
          alguns instantes ou contate o suporte se persistir.
        </div>
      )}

      {/* Sprint M52a Bloco E (23/06/2026) — abas Resumo × Passivo & Forecast. */}
      <div className="flex gap-1 border-b border-gray-200">
        <button
          onClick={() => setAba('resumo')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            aba === 'resumo'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Resumo
        </button>
        <button
          onClick={() => setAba('passivo')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            aba === 'passivo'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Passivo & Forecast
        </button>
      </div>

      {aba === 'passivo' && passivo && (
        <PassivoForecastSection passivo={passivo} />
      )}

      {aba === 'resumo' && (
        <>
      {/* Filtros */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1">
          {(['mes', 'trimestre', 'ano'] as Periodo[]).map((p) => (
            <Button
              key={p}
              variant={periodo === p ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPeriodo(p)}
            >
              {p === 'mes' ? 'Mês' : p === 'trimestre' ? 'Trimestre' : 'Ano'}
            </Button>
          ))}
        </div>

        {periodo !== 'ano' && (
          <select
            value={mes}
            onChange={(e) => setMes(Number(e.target.value))}
            className="border rounded px-2 py-1 text-sm"
          >
            {MESES.map((m, i) => (
              <option key={i} value={i + 1}>{m}</option>
            ))}
          </select>
        )}

        <select
          value={ano}
          onChange={(e) => setAno(Number(e.target.value))}
          className="border rounded px-2 py-1 text-sm"
        >
          {[2024, 2025, 2026, 2027].map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </div>

      {/* Cards KPI */}
      {financeiro && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Passivo Total</CardTitle>
              <Wallet className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{fmt(financeiro.passivoTotal)}</div>
              <p className="text-xs text-gray-400 mt-1">
                {fmtToken(financeiro.tokensCirculacao)} tokens em circulacao
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Receita Parceiros</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{fmt(financeiro.receitaParceiros)}</div>
              <p className="text-xs text-gray-400 mt-1">Compras de tokens no periodo</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Custo Resgates</CardTitle>
              <TrendingDown className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{fmt(financeiro.custoResgates)}</div>
              <p className="text-xs text-gray-400 mt-1">
                {fmtToken(financeiro.tokensResgatados)} tokens resgatados
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Receita Expiracao</CardTitle>
              <Coins className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">{fmt(financeiro.receitaExpiracao)}</div>
              <p className="text-xs text-gray-400 mt-1">
                {fmtToken(financeiro.tokensExpirados)} tokens expirados
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Grafico Fluxo de Caixa */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Fluxo de Caixa — Tokens (12 meses)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {fluxo.length === 0 ? (
            <p className="text-sm text-gray-400 py-10 text-center">Sem dados no periodo.</p>
          ) : (
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={fluxo}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar dataKey="emitido" fill="#10b981" name="Emitido (R$)" />
                <Bar dataKey="resgatado" fill="#f59e0b" name="Resgatado (R$)" />
                <Bar dataKey="compraParceiro" fill="#3b82f6" name="Compra Parceiro (R$)" />
                <Bar dataKey="expirado" fill="#8b5cf6" name="Expirado (R$)" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Tabela Top Cooperados */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Users className="h-4 w-4" />
            Top 10 Cooperados — Economia via Tokens
          </CardTitle>
        </CardHeader>
        <CardContent>
          {ranking.length === 0 ? (
            <p className="text-sm text-gray-400 py-6 text-center">Nenhum cooperado com resgates.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Cooperado</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-right">Tokens Usados</TableHead>
                  <TableHead className="text-right">Economia (R$)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ranking.map((r, i) => (
                  <TableRow key={r.cooperadoId}>
                    <TableCell className="font-medium text-gray-500">{i + 1}</TableCell>
                    <TableCell className="font-medium">{r.nomeCompleto}</TableCell>
                    <TableCell className="text-gray-500 text-sm">{r.email}</TableCell>
                    <TableCell className="text-right font-mono">{fmtToken(r.tokensUsados)}</TableCell>
                    <TableCell className="text-right font-mono text-green-600">{fmt(r.economiaReais)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
        </>
      )}
    </div>
  );
}

// Sprint M52a Bloco E (23/06/2026) — aba dedicada Passivo & Forecast.
function PassivoForecastSection({ passivo }: { passivo: PassivoDetalhado }) {
  return (
    <div className="space-y-6">
      {/* KPIs decompostos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Passivo Total (2.3.01)</CardTitle>
            <Wallet className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{fmt(passivo.passivoTotalReais)}</div>
            <p className="text-xs text-gray-400 mt-1">
              {passivo.valorTokenReais !== null
                ? `${fmtToken(passivo.passivoTotalFace)} tokens (face) × ${fmt(passivo.valorTokenReais)}`
                : `${fmtToken(passivo.passivoTotalFace)} tokens (face) — taxa varia entre tenants`}
            </p>
            {passivo.precisaoCrossTenant && (
              <p className="text-xs text-amber-600 mt-1 italic">{passivo.precisaoCrossTenant}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Disponível</CardTitle>
            <Coins className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{fmt(passivo.decomposicao.disponivel.reais)}</div>
            <p className="text-xs text-gray-400 mt-1">
              {fmtToken(passivo.decomposicao.disponivel.face)} tokens líquidos circulando
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Pendente</CardTitle>
            <Hourglass className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{fmt(passivo.decomposicao.pendente.reais)}</div>
            <p className="text-xs text-gray-400 mt-1">
              {fmtToken(passivo.decomposicao.pendente.face)} aguardando ativação do cooperado
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Bloqueado (Resgate)</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{fmt(passivo.decomposicao.bloqueadoResgate.reais)}</div>
            <p className="text-xs text-gray-400 mt-1">
              {fmtToken(passivo.decomposicao.bloqueadoResgate.face)} aguardando PIX-out
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Forecast de expiração */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <TrendingDown className="h-4 w-4" />
            Forecast de Expiração — tokens caducando por janela
          </CardTitle>
          <p className="text-xs text-gray-500 mt-1">
            Quando expirar, o saldo bonificado vira receita 1.2.02 (sem caixa); o saldo pago vira receita de quebra.
          </p>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Janela</TableHead>
                <TableHead className="text-right">Tokens a expirar (face)</TableHead>
                <TableHead className="text-right">Valor (R$)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {passivo.forecastExpiracao.map((f) => (
                <TableRow key={f.janela}>
                  <TableCell className="font-medium">Próximos {f.janela}</TableCell>
                  <TableCell className="text-right font-mono">{fmtToken(f.tokensAExpirar)}</TableCell>
                  <TableCell className="text-right font-mono text-purple-600">{fmt(f.valorReais)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Top 10 concentração de passivo */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Users className="h-4 w-4" />
            Top 10 — concentração do Passivo por Cooperado
          </CardTitle>
        </CardHeader>
        <CardContent>
          {passivo.topCooperados.length === 0 ? (
            <p className="text-sm text-gray-400 py-6 text-center">Nenhum saldo de token no momento.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Cooperado</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-right">Disponível</TableHead>
                  <TableHead className="text-right">Pendente</TableHead>
                  <TableHead className="text-right">Bloqueado</TableHead>
                  <TableHead className="text-right">Face Total</TableHead>
                  <TableHead className="text-right">Valor (R$)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {passivo.topCooperados.map((c, i) => (
                  <TableRow key={c.cooperadoId}>
                    <TableCell className="font-medium text-gray-500">{i + 1}</TableCell>
                    <TableCell className="font-medium">{c.nomeCompleto}</TableCell>
                    <TableCell className="text-gray-500 text-sm">{c.email}</TableCell>
                    <TableCell className="text-right font-mono">{fmtToken(c.saldoDisponivel)}</TableCell>
                    <TableCell className="text-right font-mono">{fmtToken(c.saldoPendente)}</TableCell>
                    <TableCell className="text-right font-mono">{fmtToken(c.saldoBloqueadoResgate)}</TableCell>
                    <TableCell className="text-right font-mono font-semibold">{fmtToken(c.faceTotal)}</TableCell>
                    <TableCell className="text-right font-mono text-red-600">{fmt(c.valorReais)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
