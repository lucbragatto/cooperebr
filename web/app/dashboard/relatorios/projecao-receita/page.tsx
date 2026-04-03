'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { TrendingUp, TrendingDown, Loader2, DollarSign, Zap, BarChart3 } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

const cls = 'w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500 bg-white';

const mesesNome = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function formatarMoeda(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

interface ProjecaoItem {
  mes: number;
  anoReferencia: number;
  receitaProjetada: number;
  kwhProjetado: number;
  qtdContratos: number;
}

interface UsinaItem {
  usinaId: string;
  usinaNome: string;
  receitaTotal: number;
  kwhTotal: number;
  qtdContratos: number;
}

interface DadosProjecao {
  mesesProjetados: number;
  projecao: ProjecaoItem[];
  porUsina: UsinaItem[];
}

function CustomDualTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; color: string; dataKey: string }>; label?: string }) {
  if (!active || !payload) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
      <p className="text-sm font-medium text-gray-700 mb-1">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} className="text-sm" style={{ color: entry.color }}>
          {entry.name}: {entry.dataKey === 'receita'
            ? formatarMoeda(entry.value)
            : `${entry.value.toLocaleString('pt-BR')} kWh`}
        </p>
      ))}
    </div>
  );
}

export default function ProjecaoReceitaPage() {
  const [dados, setDados] = useState<DadosProjecao | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [meses, setMeses] = useState('6');

  useEffect(() => {
    buscar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function buscar() {
    setCarregando(true);
    api.get(`/relatorios/projecao-receita?meses=${meses}`)
      .then((r) => setDados(r.data))
      .catch(() => {})
      .finally(() => setCarregando(false));
  }

  const chartData = dados?.projecao?.map((p) => ({
    label: `${mesesNome[p.mes]}/${p.anoReferencia}`,
    receita: p.receitaProjetada,
    kwh: p.kwhProjetado,
  })) ?? [];

  const totalReceita = dados?.projecao?.reduce((s, p) => s + p.receitaProjetada, 0) ?? 0;
  const totalKwh = dados?.projecao?.reduce((s, p) => s + p.kwhProjetado, 0) ?? 0;
  const ticketMedio = dados?.projecao && dados.projecao.length > 0
    ? totalReceita / dados.projecao.reduce((s, p) => s + p.qtdContratos, 0)
    : 0;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <TrendingUp className="h-6 w-6 text-green-600" />
        <h2 className="text-2xl font-bold text-gray-800">Projecao de Receita</h2>
      </div>

      {/* Controles */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-end gap-4">
            <div>
              <label className="text-xs text-gray-500 mb-0.5 block">Meses a projetar</label>
              <select className={cls} value={meses} onChange={(e) => setMeses(e.target.value)}>
                <option value="3">3 meses</option>
                <option value="6">6 meses</option>
                <option value="12">12 meses</option>
              </select>
            </div>
            <Button onClick={buscar} disabled={carregando}>
              {carregando && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Projetar
            </Button>
          </div>
        </CardContent>
      </Card>

      {carregando ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="pt-6">
                  <Skeleton className="h-3 w-24 mb-2" />
                  <Skeleton className="h-8 w-36" />
                </CardContent>
              </Card>
            ))}
          </div>
          <Card><CardContent className="pt-6"><Skeleton className="h-[320px] w-full" /></CardContent></Card>
        </div>
      ) : dados && (
        <>
          {/* KPIs aprimorados */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <Card className="border-green-200 bg-green-50">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="h-4 w-4 text-green-600" />
                  <span className="text-xs text-green-600 font-medium">Receita Projetada Total</span>
                </div>
                <p className="text-3xl font-bold text-green-800">{formatarMoeda(totalReceita)}</p>
              </CardContent>
            </Card>
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <Zap className="h-4 w-4 text-blue-600" />
                  <span className="text-xs text-blue-600 font-medium">kWh Projetado Total</span>
                </div>
                <p className="text-3xl font-bold text-blue-800">{totalKwh.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <BarChart3 className="h-4 w-4 text-purple-600" />
                  <span className="text-xs text-purple-600 font-medium">Ticket Medio / Contrato</span>
                </div>
                <p className="text-3xl font-bold text-purple-800">
                  {isFinite(ticketMedio) ? formatarMoeda(ticketMedio) : '—'}
                </p>
                <p className="text-[10px] text-gray-400 mt-0.5">Media mensal por contrato</p>
              </CardContent>
            </Card>
          </div>

          {/* Gráfico dual-axis */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-base">Receita (R$) e Geracao (kWh) Projetadas</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis
                    yAxisId="receita"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                    stroke="#16a34a"
                  />
                  <YAxis
                    yAxisId="kwh"
                    orientation="right"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                    stroke="#2563eb"
                  />
                  <Tooltip content={<CustomDualTooltip />} />
                  <Legend />
                  <Line
                    yAxisId="receita"
                    type="monotone"
                    dataKey="receita"
                    stroke="#16a34a"
                    strokeWidth={2.5}
                    name="Receita (R$)"
                    dot={{ r: 4, fill: '#16a34a' }}
                  />
                  <Line
                    yAxisId="kwh"
                    type="monotone"
                    dataKey="kwh"
                    stroke="#2563eb"
                    strokeWidth={2.5}
                    name="kWh Projetado"
                    dot={{ r: 4, fill: '#2563eb' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Tabela mês a mês com crescimento % */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-base">Detalhamento Mensal</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mes</TableHead>
                    <TableHead className="text-right">Receita Projetada</TableHead>
                    <TableHead className="text-center">Var. %</TableHead>
                    <TableHead className="text-right">kWh Projetado</TableHead>
                    <TableHead className="text-center">Contratos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dados.projecao.map((p, idx) => {
                    const prev = idx > 0 ? dados.projecao[idx - 1] : null;
                    const variacao = prev && prev.receitaProjetada > 0
                      ? ((p.receitaProjetada - prev.receitaProjetada) / prev.receitaProjetada) * 100
                      : null;

                    return (
                      <TableRow key={`${p.mes}-${p.anoReferencia}`}>
                        <TableCell className="font-medium">{mesesNome[p.mes]}/{p.anoReferencia}</TableCell>
                        <TableCell className="text-right font-medium">{formatarMoeda(p.receitaProjetada)}</TableCell>
                        <TableCell className="text-center">
                          {variacao !== null ? (
                            <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${variacao >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {variacao >= 0 ? (
                                <TrendingUp className="h-3 w-3" />
                              ) : (
                                <TrendingDown className="h-3 w-3" />
                              )}
                              {variacao >= 0 ? '+' : ''}{variacao.toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">{p.kwhProjetado.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</TableCell>
                        <TableCell className="text-center">{p.qtdContratos}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Breakdown por Usina */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Breakdown por Usina</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usina</TableHead>
                    <TableHead className="text-right">Receita Total Projetada</TableHead>
                    <TableHead className="text-right">kWh Total</TableHead>
                    <TableHead className="text-center">Contratos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dados.porUsina.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center text-gray-400 py-4">Nenhum dado</TableCell></TableRow>
                  ) : (
                    dados.porUsina.map((u) => (
                      <TableRow key={u.usinaId}>
                        <TableCell className="font-medium">{u.usinaNome}</TableCell>
                        <TableCell className="text-right font-medium">{formatarMoeda(u.receitaTotal)}</TableCell>
                        <TableCell className="text-right">{u.kwhTotal.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</TableCell>
                        <TableCell className="text-center">{u.qtdContratos}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
