'use client';

import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  LineChart as LineChartIcon, ArrowDownCircle, ArrowUpCircle, Wallet, TrendingUp,
} from 'lucide-react';
import {
  BarChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ComposedChart,
} from 'recharts';

interface Lancamento {
  id: string;
  descricao: string;
  tipo: string;
  valor: number;
  status: string;
  dataVencimento: string;
  dataPagamento: string | null;
  competencia: string;
}

function formatarMoeda(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function formatarData(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('pt-BR');
}

function getWeekOfMonth(dateStr: string): number {
  const d = new Date(dateStr);
  return Math.ceil(d.getDate() / 7);
}

function navMes(comp: string, offset: number): string {
  const [a, m] = comp.split('-').map(Number);
  const d = new Date(a, m - 1 + offset, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatComp(comp: string): string {
  const [ano, mes] = comp.split('-');
  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${meses[Number(mes) - 1]}/${ano}`;
}

export default function FluxoCaixaPage() {
  const now = new Date();
  const compAtual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [competencia, setCompetencia] = useState(compAtual);
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      // Buscar 3 meses: anterior, atual, próximo
      const comps = [navMes(competencia, -1), competencia, navMes(competencia, 1)];
      const promises = comps.map((c) =>
        api.get(`/financeiro/lancamentos?competencia=${c}`).then((r) => r.data).catch(() => [])
      );
      const results = await Promise.all(promises);
      setLancamentos(results.flat());
    } catch {
      setLancamentos([]);
    } finally {
      setCarregando(false);
    }
  }, [competencia]);

  useEffect(() => { carregar(); }, [carregar]);

  // Filtrar só o mês selecionado para exibição principal
  const lancamentosMes = lancamentos.filter((l) => l.competencia === competencia);

  // Dados para gráfico de barras empilhadas por semana
  const semanas = [1, 2, 3, 4, 5];
  const dadosGrafico = semanas.map((sem) => {
    const doSemana = lancamentosMes.filter((l) => l.dataVencimento && getWeekOfMonth(l.dataVencimento) === sem);
    const receitas = doSemana.filter((l) => l.tipo === 'RECEITA').reduce((s, l) => s + Number(l.valor), 0);
    const despesas = doSemana.filter((l) => l.tipo === 'DESPESA').reduce((s, l) => s + Number(l.valor), 0);
    return { semana: `Sem ${sem}`, receitas, despesas };
  }).filter((d) => d.receitas > 0 || d.despesas > 0);

  // Saldo acumulado
  let saldoAcum = 0;
  const dadosComSaldo = dadosGrafico.map((d) => {
    saldoAcum += d.receitas - d.despesas;
    return { ...d, saldo: saldoAcum };
  });

  // Tabela diária
  const porDia = lancamentosMes
    .filter((l) => l.dataVencimento)
    .sort((a, b) => a.dataVencimento.localeCompare(b.dataVencimento));

  let saldoDiario = 0;
  const tabelaDiaria = porDia.map((l) => {
    const entrada = l.tipo === 'RECEITA' ? Number(l.valor) : 0;
    const saida = l.tipo === 'DESPESA' ? Number(l.valor) : 0;
    saldoDiario += entrada - saida;
    return { ...l, entrada, saida, saldoDia: saldoDiario };
  });

  // Cards
  const totalEntradas = lancamentosMes.filter((l) => l.tipo === 'RECEITA').reduce((s, l) => s + Number(l.valor), 0);
  const totalSaidas = lancamentosMes.filter((l) => l.tipo === 'DESPESA').reduce((s, l) => s + Number(l.valor), 0);
  const saldoFinal = totalEntradas - totalSaidas;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <LineChartIcon className="h-6 w-6 text-purple-600" />
          <h2 className="text-2xl font-bold text-gray-800">Fluxo de Caixa</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setCompetencia(navMes(competencia, -1))}>&larr;</Button>
          <span className="text-sm font-medium px-3">{formatComp(competencia)}</span>
          <Button variant="outline" size="sm" onClick={() => setCompetencia(navMes(competencia, 1))}>&rarr;</Button>
        </div>
      </div>

      {/* Cards KPI */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <Wallet className="h-4 w-4 text-gray-500" />
              <span className="text-xs text-gray-500">Saldo Inicial</span>
            </div>
            <p className="text-xl font-bold text-gray-700">R$ 0,00</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <ArrowDownCircle className="h-4 w-4 text-green-600" />
              <span className="text-xs text-gray-500">Total Entradas</span>
            </div>
            <p className="text-xl font-bold text-green-700">{formatarMoeda(totalEntradas)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <ArrowUpCircle className="h-4 w-4 text-red-600" />
              <span className="text-xs text-gray-500">Total Saídas</span>
            </div>
            <p className="text-xl font-bold text-red-700">{formatarMoeda(totalSaidas)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-purple-600" />
              <span className="text-xs text-gray-500">Saldo Final Projetado</span>
            </div>
            <p className={`text-xl font-bold ${saldoFinal >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              {formatarMoeda(saldoFinal)}
            </p>
          </CardContent>
        </Card>
      </div>

      {carregando ? (
        <p className="text-gray-500">Carregando...</p>
      ) : (
        <>
          {/* Gráfico */}
          {dadosComSaldo.length > 0 && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-base">Receitas × Despesas por Semana</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <ComposedChart data={dadosComSaldo}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="semana" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v) => formatarMoeda(Number(v))} />
                    <Legend />
                    <Bar dataKey="receitas" name="Receitas" fill="#22c55e" stackId="a" />
                    <Bar dataKey="despesas" name="Despesas" fill="#ef4444" stackId="a" />
                    <Line type="monotone" dataKey="saldo" name="Saldo Acumulado" stroke="#8b5cf6" strokeWidth={2} dot />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Tabela diária */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Movimentação Diária</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right">Entrada (+)</TableHead>
                    <TableHead className="text-right">Saída (-)</TableHead>
                    <TableHead className="text-right">Saldo do Dia</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tabelaDiaria.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-gray-400 py-6">
                        Nenhuma movimentação no período
                      </TableCell>
                    </TableRow>
                  ) : (
                    tabelaDiaria.map((l, i) => (
                      <TableRow key={`${l.id}-${i}`} className={l.status === 'PREVISTO' ? 'opacity-60' : ''}>
                        <TableCell>{formatarData(l.dataVencimento)}</TableCell>
                        <TableCell className="max-w-[240px] truncate">{l.descricao}</TableCell>
                        <TableCell className="text-right text-green-700 font-medium">
                          {l.entrada > 0 ? formatarMoeda(l.entrada) : ''}
                        </TableCell>
                        <TableCell className="text-right text-red-700 font-medium">
                          {l.saida > 0 ? formatarMoeda(l.saida) : ''}
                        </TableCell>
                        <TableCell className={`text-right font-medium ${l.saldoDia >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                          {formatarMoeda(l.saldoDia)}
                        </TableCell>
                        <TableCell>
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            l.status === 'REALIZADO' ? 'bg-green-100 text-green-700' :
                            'bg-gray-100 text-gray-500 border border-dashed border-gray-300'
                          }`}>
                            {l.status === 'REALIZADO' ? 'Realizado' : 'Previsto'}
                          </span>
                        </TableCell>
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
