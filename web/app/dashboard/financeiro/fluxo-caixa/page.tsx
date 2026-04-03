'use client';

import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  LineChart as LineChartIcon, ArrowDownCircle, ArrowUpCircle, Wallet, TrendingUp,
} from 'lucide-react';
import {
  Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ComposedChart, ReferenceLine,
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
  categoriaNome?: string;
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

interface CategoriaResumo {
  nome: string;
  entradas: number;
  saidas: number;
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
      const lancamentosPromises = comps.map((c) =>
        api.get(`/financeiro/lancamentos?competencia=${c}`).then((r) => r.data).catch(() => [])
      );
      const cobrancasPromise = api.get('/cobrancas').then((r) => r.data).catch(() => []);

      const [lancamentosResults, cobrancasData] = await Promise.all([
        Promise.all(lancamentosPromises),
        cobrancasPromise,
      ]);

      // Mapear cobranças como lançamentos RECEITA
      const cobrancasComoLancamentos: Lancamento[] = (cobrancasData as Array<{
        id: string;
        mesReferencia?: number;
        anoReferencia?: number;
        status: string;
        contrato?: { cooperado?: { nome?: string } };
        valorLiquido: number;
        dataVencimento: string;
        dataPagamento?: string | null;
      }>)
        .filter((c) => c.mesReferencia && c.anoReferencia)
        .map((c) => {
          const comp = `${c.anoReferencia}-${String(c.mesReferencia).padStart(2, '0')}`;
          let status = 'PREVISTO';
          if (c.status === 'PAGO' || c.status === 'CONFIRMADO') status = 'REALIZADO';
          else if (c.status === 'VENCIDO') status = 'VENCIDO';
          const nomeCooperado = c.contrato?.cooperado?.nome || 'Cooperado';
          return {
            id: `cob-${c.id}`,
            descricao: `Cobranca — ${nomeCooperado}`,
            tipo: 'RECEITA',
            valor: Number(c.valorLiquido),
            status,
            dataVencimento: c.dataVencimento,
            dataPagamento: c.dataPagamento || null,
            competencia: comp,
          };
        })
        .filter((l) => comps.includes(l.competencia));

      setLancamentos([...lancamentosResults.flat(), ...cobrancasComoLancamentos]);
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

  // Saldo acumulado + linha de tendência
  let saldoAcum = 0;
  const dadosComSaldo = dadosGrafico.map((d) => {
    saldoAcum += d.receitas - d.despesas;
    return { ...d, saldo: saldoAcum };
  });

  // Resumo por categoria
  const categorias: Record<string, CategoriaResumo> = {};
  for (const l of lancamentosMes) {
    const nome = l.categoriaNome || (l.tipo === 'RECEITA' ? 'Receitas (geral)' : 'Despesas (geral)');
    if (!categorias[nome]) {
      categorias[nome] = { nome, entradas: 0, saidas: 0 };
    }
    if (l.tipo === 'RECEITA') {
      categorias[nome].entradas += Number(l.valor);
    } else {
      categorias[nome].saidas += Number(l.valor);
    }
  }
  const resumoCategorias = Object.values(categorias).sort((a, b) => (b.entradas + b.saidas) - (a.entradas + a.saidas));

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

  // Saldo do mês anterior para Saldo Inicial
  const lancamentosMesAnterior = lancamentos.filter((l) => l.competencia === navMes(competencia, -1));
  const saldoInicial = lancamentosMesAnterior.reduce((s, l) => {
    return s + (l.tipo === 'RECEITA' ? Number(l.valor) : -Number(l.valor));
  }, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <LineChartIcon className="h-6 w-6 text-green-600" />
          <h2 className="text-2xl font-bold text-gray-800">Fluxo de Caixa</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setCompetencia(navMes(competencia, -1))}>&larr;</Button>
          <span className="text-sm font-medium px-3">{formatComp(competencia)}</span>
          <Button variant="outline" size="sm" onClick={() => setCompetencia(navMes(competencia, 1))}>&rarr;</Button>
        </div>
      </div>

      {/* Cards KPI */}
      {carregando ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-4 pb-3 px-4">
                <Skeleton className="h-3 w-20 mb-2" />
                <Skeleton className="h-6 w-28" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2 mb-1">
                <Wallet className="h-4 w-4 text-gray-500" />
                <span className="text-xs text-gray-500">Saldo Inicial</span>
              </div>
              <p className={`text-xl font-bold ${saldoInicial >= 0 ? 'text-gray-700' : 'text-red-700'}`}>
                {formatarMoeda(saldoInicial)}
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">Baseado no mes anterior</p>
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
                <span className="text-xs text-gray-500">Total Saidas</span>
              </div>
              <p className="text-xl font-bold text-red-700">{formatarMoeda(totalSaidas)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-4 w-4 text-green-600" />
                <span className="text-xs text-gray-500">Saldo Final Projetado</span>
              </div>
              <p className={`text-xl font-bold ${saldoFinal + saldoInicial >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                {formatarMoeda(saldoFinal + saldoInicial)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {carregando ? (
        <Card><CardContent className="pt-6"><Skeleton className="h-[280px] w-full" /></CardContent></Card>
      ) : (
        <>
          {/* Gráfico com cores verdes + tooltip aprimorado */}
          {dadosComSaldo.length > 0 && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-base">Receitas x Despesas por Semana</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <ComposedChart data={dadosComSaldo}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="semana" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <ReferenceLine y={0} stroke="#9ca3af" strokeDasharray="3 3" />
                    <Bar dataKey="receitas" name="Receitas" fill="#16a34a" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="despesas" name="Despesas" fill="#dc2626" radius={[4, 4, 0, 0]} />
                    <Line
                      type="monotone"
                      dataKey="saldo"
                      name="Saldo Acumulado"
                      stroke="#15803d"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: '#15803d' }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>

                {/* Legenda clara previsto vs realizado */}
                <div className="flex items-center gap-6 mt-3 pt-3 border-t border-gray-100">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px]">Realizado</Badge>
                    <span className="text-xs text-gray-500">Pagamento confirmado</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-gray-500 border-dashed border-gray-300 text-[10px]">Previsto</Badge>
                    <span className="text-xs text-gray-500">Aguardando pagamento (exibido com transparencia na tabela)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px]">Vencido</Badge>
                    <span className="text-xs text-gray-500">Passou da data de vencimento</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Resumo por categoria */}
          {resumoCategorias.length > 0 && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-base">Resumo por Categoria</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Categoria</TableHead>
                      <TableHead className="text-right">Entradas (+)</TableHead>
                      <TableHead className="text-right">Saidas (-)</TableHead>
                      <TableHead className="text-right">Saldo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {resumoCategorias.map((cat) => {
                      const saldo = cat.entradas - cat.saidas;
                      return (
                        <TableRow key={cat.nome}>
                          <TableCell className="font-medium">{cat.nome}</TableCell>
                          <TableCell className="text-right text-green-700">
                            {cat.entradas > 0 ? formatarMoeda(cat.entradas) : '—'}
                          </TableCell>
                          <TableCell className="text-right text-red-700">
                            {cat.saidas > 0 ? formatarMoeda(cat.saidas) : '—'}
                          </TableCell>
                          <TableCell className={`text-right font-medium ${saldo >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                            {formatarMoeda(saldo)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Tabela diária */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Movimentacao Diaria</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Descricao</TableHead>
                    <TableHead className="text-right">Entrada (+)</TableHead>
                    <TableHead className="text-right">Saida (-)</TableHead>
                    <TableHead className="text-right">Saldo do Dia</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tabelaDiaria.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-gray-400 py-6">
                        Nenhuma movimentacao no periodo
                      </TableCell>
                    </TableRow>
                  ) : (
                    tabelaDiaria.map((l, i) => {
                      const isVencido = l.status !== 'REALIZADO' && l.dataVencimento && new Date(l.dataVencimento) < new Date();
                      return (
                        <TableRow
                          key={`${l.id}-${i}`}
                          className={l.status === 'PREVISTO' && !isVencido ? 'opacity-60' : ''}
                        >
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
                            {l.status === 'REALIZADO' ? (
                              <Badge className="bg-green-100 text-green-700 border-green-200">Realizado</Badge>
                            ) : isVencido ? (
                              <Badge className="bg-red-100 text-red-700 border-red-200">Vencido</Badge>
                            ) : (
                              <Badge variant="outline" className="text-gray-500 border-dashed border-gray-300">Previsto</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
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
