'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { DollarSign, Download, TrendingUp, TrendingDown, ArrowUpDown } from 'lucide-react';

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

export default function FinanceiroPage() {
  const [competencia, setCompetencia] = useState(competenciaAtual());
  const [dados, setDados] = useState<any>(null);
  const [carregando, setCarregando] = useState(true);
  const [tab, setTab] = useState<'entradas' | 'saidas' | 'resumo'>('resumo');

  useEffect(() => {
    setCarregando(true);
    api.get(`/financeiro/livro-caixa?competencia=${competencia}`)
      .then((r) => setDados(r.data))
      .catch(() => setDados(null))
      .finally(() => setCarregando(false));
  }, [competencia]);

  function exportarCsv() {
    if (!dados) return;
    const all = [...(dados.entradas || []), ...(dados.saidas || [])];
    const escapeCsv = (v: string) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = 'Tipo,Descricao,Valor,Categoria,Cooperado,Vencimento,Pagamento,Status';
    const rows = all.map((t: any) =>
      [t.tipo, t.descricao, Number(t.valor).toFixed(2), t.categoriaNome ?? '', t.cooperado ?? '', formatarData(t.dataVencimento), formatarData(t.dataPagamento), t.status].map(escapeCsv).join(',')
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

  const maxHistorico = dados?.historico?.length
    ? Math.max(...dados.historico.flatMap((h: any) => [h.receitas, h.despesas]), 1)
    : 1;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <DollarSign className="h-6 w-6 text-green-600" />
          <h2 className="text-2xl font-bold text-gray-800">Livro Caixa</h2>
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

      {carregando && <p className="text-gray-500">Carregando...</p>}

      {dados && (
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
                  <span className="text-xs text-gray-500">Total Saídas</span>
                </div>
                <p className="text-xl font-bold text-red-700">{formatarMoeda(dados.totalDespesas)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center gap-2 mb-1">
                  <ArrowUpDown className="h-4 w-4 text-blue-600" />
                  <span className="text-xs text-gray-500">Saldo do Mês</span>
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
                  <span className="text-xs text-gray-500">Transações</span>
                </div>
                <p className="text-xl font-bold text-gray-800">
                  {(dados.entradas?.length || 0) + (dados.saidas?.length || 0)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Gráfico barras últimos 6 meses */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-base">Últimos 6 Meses</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-3 h-40">
                {dados.historico?.map((h: any) => (
                  <div key={h.competencia} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full flex gap-0.5 items-end justify-center" style={{ height: '120px' }}>
                      <div
                        className="w-5 bg-green-500 rounded-t"
                        style={{ height: `${Math.max((h.receitas / maxHistorico) * 120, 2)}px` }}
                        title={`Receitas: ${formatarMoeda(h.receitas)}`}
                      />
                      <div
                        className="w-5 bg-red-400 rounded-t"
                        style={{ height: `${Math.max((h.despesas / maxHistorico) * 120, 2)}px` }}
                        title={`Despesas: ${formatarMoeda(h.despesas)}`}
                      />
                    </div>
                    <span className="text-[10px] text-gray-500">{formatarCompetencia(h.competencia)}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-center gap-6 mt-3">
                <span className="flex items-center gap-1 text-xs text-gray-500">
                  <span className="w-3 h-3 bg-green-500 rounded" /> Receitas
                </span>
                <span className="flex items-center gap-1 text-xs text-gray-500">
                  <span className="w-3 h-3 bg-red-400 rounded" /> Despesas
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Tabs */}
          <div className="flex gap-1 mb-4">
            {(['resumo', 'entradas', 'saidas'] as const).map((t) => (
              <Button
                key={t}
                size="sm"
                variant={tab === t ? 'default' : 'outline'}
                onClick={() => setTab(t)}
              >
                {t === 'resumo' ? 'Resumo' : t === 'entradas' ? `Entradas (${dados.entradas?.length || 0})` : `Saídas (${dados.saidas?.length || 0})`}
              </Button>
            ))}
          </div>

          {/* Tabela */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Cooperado</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Pagamento</TableHead>
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
                          <TableCell colSpan={6} className="text-center text-gray-400 py-6">
                            Nenhuma transação no período
                          </TableCell>
                        </TableRow>
                      );
                    }

                    return itens.map((t: any, i: number) => (
                      <TableRow key={`${t.id}-${i}`}>
                        <TableCell className="font-medium max-w-[240px] truncate">{t.descricao}</TableCell>
                        <TableCell>
                          <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">{t.categoriaNome}</span>
                        </TableCell>
                        <TableCell>{t.cooperado || '—'}</TableCell>
                        <TableCell>{formatarData(t.dataVencimento)}</TableCell>
                        <TableCell>{formatarData(t.dataPagamento)}</TableCell>
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
