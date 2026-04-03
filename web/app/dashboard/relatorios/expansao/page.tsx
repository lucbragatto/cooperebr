'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Globe, Loader2, Bell, TrendingUp, Star, DollarSign, Users } from 'lucide-react';

interface ResumoItem {
  distribuidora: string;
  estado: string;
  totalLeads: number;
  confirmados: number;
  economiaMesMedia: number;
  receitaLatenteAnual: number;
}

interface LeadItem {
  id: string;
  telefone: string;
  nomeCompleto?: string;
  distribuidora: string;
  estado?: string;
  valorFatura?: number;
  intencaoConfirmada: boolean;
  score: number;
  createdAt: string;
}

function ScoreBadge({ score }: { score: number }) {
  const config = score >= 8
    ? { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-300', stars: 3 }
    : score >= 5
      ? { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-300', stars: 2 }
      : { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-300', stars: 1 };

  return (
    <div className="flex items-center gap-1">
      <Badge className={`${config.bg} ${config.text} border ${config.border} font-bold text-sm px-2.5 py-0.5`}>
        {score}
      </Badge>
      <span className="text-yellow-500 text-xs">
        {'★'.repeat(config.stars)}{'☆'.repeat(3 - config.stars)}
      </span>
    </div>
  );
}

function formatarMoeda(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function ExpansaoPage() {
  const [dados, setDados] = useState<{ resumo: ResumoItem[]; totalReceitaLatente: number } | null>(null);
  const [leads, setLeads] = useState<LeadItem[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [notificando, setNotificando] = useState<string | null>(null);

  useEffect(() => {
    buscar();
  }, []);

  function buscar() {
    setCarregando(true);
    Promise.all([
      api.get('/lead-expansao/resumo-investidores'),
      api.get('/lead-expansao'),
    ])
      .then(([resumoRes, leadsRes]) => {
        setDados(resumoRes.data);
        setLeads(Array.isArray(leadsRes.data) ? leadsRes.data : []);
      })
      .catch(() => {})
      .finally(() => setCarregando(false));
  }

  async function notificar(distribuidora: string) {
    setNotificando(distribuidora);
    try {
      const res = await api.post(`/lead-expansao/notificar/${encodeURIComponent(distribuidora)}`);
      alert(`${res.data.notificados} lead(s) notificado(s) com sucesso!`);
      buscar();
    } catch {
      alert('Erro ao notificar leads.');
    } finally {
      setNotificando(null);
    }
  }

  const totalLeads = dados?.resumo.reduce((s, r) => s + r.totalLeads, 0) ?? 0;
  const totalConfirmados = dados?.resumo.reduce((s, r) => s + r.confirmados, 0) ?? 0;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Globe className="h-6 w-6 text-green-600" />
        <h2 className="text-2xl font-bold text-gray-800">Expansao &amp; Investidores</h2>
      </div>

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
        </div>
      ) : dados && (
        <>
          {/* KPI destaque — receita latente como principal */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <Card className="border-green-300 bg-gradient-to-br from-green-50 to-emerald-50 shadow-sm">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="h-5 w-5 text-green-600" />
                  <span className="text-sm text-green-700 font-semibold">Receita Latente Total</span>
                </div>
                <p className="text-3xl font-bold text-green-800">{formatarMoeda(dados.totalReceitaLatente)}</p>
                <p className="text-xs text-green-600 mt-1">Potencial anual de receita com leads confirmados</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <Globe className="h-4 w-4 text-blue-600" />
                  <span className="text-xs text-gray-500 font-medium">Distribuidoras</span>
                </div>
                <p className="text-2xl font-bold text-gray-800">{dados.resumo.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="h-4 w-4 text-purple-600" />
                  <span className="text-xs text-gray-500 font-medium">Total de Leads</span>
                </div>
                <p className="text-2xl font-bold text-gray-800">{totalLeads}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{totalConfirmados} confirmados ({totalLeads > 0 ? ((totalConfirmados / totalLeads) * 100).toFixed(0) : 0}%)</p>
              </CardContent>
            </Card>
          </div>

          {/* Tabela com progress bar de conversão */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
                Leads por Distribuidora
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Distribuidora</TableHead>
                    <TableHead>UF</TableHead>
                    <TableHead className="text-center">Conversao</TableHead>
                    <TableHead className="text-right">Economia/mes</TableHead>
                    <TableHead className="text-right">Receita Latente/ano</TableHead>
                    <TableHead className="text-center">Acoes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dados.resumo.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-gray-400 py-8">
                        Nenhum lead de expansao registrado ainda.
                      </TableCell>
                    </TableRow>
                  )}
                  {dados.resumo.map((r, i) => {
                    const conversionPct = r.totalLeads > 0 ? (r.confirmados / r.totalLeads) * 100 : 0;
                    return (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{r.distribuidora}</TableCell>
                        <TableCell>{r.estado}</TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1 min-w-[120px]">
                            <div className="flex justify-between text-[10px] text-gray-500">
                              <span>{r.confirmados}/{r.totalLeads}</span>
                              <span>{conversionPct.toFixed(0)}%</span>
                            </div>
                            <Progress
                              value={r.confirmados}
                              max={r.totalLeads}
                              className="h-1.5"
                            />
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{formatarMoeda(r.economiaMesMedia)}</TableCell>
                        <TableCell className="text-right font-semibold text-green-700">
                          {formatarMoeda(r.receitaLatenteAnual)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={r.confirmados === 0 || notificando === r.distribuidora}
                            onClick={() => notificar(r.distribuidora)}
                          >
                            {notificando === r.distribuidora ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Bell className="h-4 w-4 mr-1" />
                            )}
                            Notificar
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Leads individuais com score */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="h-5 w-5 text-yellow-500" />
                Leads — Score de Propensao
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-center">Score</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Distribuidora</TableHead>
                    <TableHead>UF</TableHead>
                    <TableHead className="text-right">Valor Fatura</TableHead>
                    <TableHead className="text-center">Intencao</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leads.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-gray-400 py-8">
                        Nenhum lead registrado.
                      </TableCell>
                    </TableRow>
                  )}
                  {leads.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="text-center"><ScoreBadge score={l.score} /></TableCell>
                      <TableCell className="font-medium">{l.nomeCompleto || '—'}</TableCell>
                      <TableCell>{l.telefone}</TableCell>
                      <TableCell>{l.distribuidora}</TableCell>
                      <TableCell>{l.estado || '—'}</TableCell>
                      <TableCell className="text-right">
                        {l.valorFatura ? formatarMoeda(Number(l.valorFatura)) : '—'}
                      </TableCell>
                      <TableCell className="text-center">
                        {l.intencaoConfirmada ? (
                          <Badge className="bg-green-100 text-green-700 border-green-200">Sim</Badge>
                        ) : (
                          <Badge variant="outline" className="text-gray-400">Nao</Badge>
                        )}
                      </TableCell>
                      <TableCell>{new Date(l.createdAt).toLocaleDateString('pt-BR')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
