'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Globe, Loader2, Bell, TrendingUp, Star } from 'lucide-react';

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
  const cor = score >= 8 ? 'bg-green-100 text-green-800' : score >= 5 ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-600';
  return <Badge className={`${cor} font-bold`}>{score}</Badge>;
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

  const fmt = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Globe className="h-6 w-6 text-green-600" />
        <h2 className="text-2xl font-bold text-gray-800">Expansão &amp; Investidores</h2>
      </div>

      {carregando && <p className="text-gray-500">Carregando...</p>}

      {dados && (
        <>
          {/* KPI destaque */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <Card className="border-green-200 bg-green-50">
              <CardContent className="pt-6">
                <p className="text-sm text-green-700 font-medium">Demanda Reprimida Total</p>
                <p className="text-2xl font-bold text-green-800">R$ {fmt(dados.totalReceitaLatente)}/ano</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-gray-500">Total de Distribuidoras</p>
                <p className="text-2xl font-bold text-gray-800">{dados.resumo.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-gray-500">Total de Leads</p>
                <p className="text-2xl font-bold text-gray-800">
                  {dados.resumo.reduce((s, r) => s + r.totalLeads, 0)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Tabela */}
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
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-center">Total Leads</TableHead>
                    <TableHead className="text-center">Confirmados</TableHead>
                    <TableHead className="text-right">Economia/mês média</TableHead>
                    <TableHead className="text-right">Receita Latente/ano</TableHead>
                    <TableHead className="text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dados.resumo.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-gray-400 py-8">
                        Nenhum lead de expansão registrado ainda.
                      </TableCell>
                    </TableRow>
                  )}
                  {dados.resumo.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{r.distribuidora}</TableCell>
                      <TableCell>{r.estado}</TableCell>
                      <TableCell className="text-center">{r.totalLeads}</TableCell>
                      <TableCell className="text-center">{r.confirmados}</TableCell>
                      <TableCell className="text-right">R$ {fmt(r.economiaMesMedia)}</TableCell>
                      <TableCell className="text-right font-semibold text-green-700">
                        R$ {fmt(r.receitaLatenteAnual)}
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
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          {/* Leads individuais com score */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="h-5 w-5 text-yellow-500" />
                Leads — Score de Propensão
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
                    <TableHead className="text-center">Intenção</TableHead>
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
                        {l.valorFatura ? `R$ ${fmt(Number(l.valorFatura))}` : '—'}
                      </TableCell>
                      <TableCell className="text-center">
                        {l.intencaoConfirmada ? (
                          <Badge className="bg-green-100 text-green-700">Sim</Badge>
                        ) : (
                          <Badge variant="outline" className="text-gray-400">Não</Badge>
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
