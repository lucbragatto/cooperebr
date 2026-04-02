'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, TrendingUp, Percent, Target } from 'lucide-react';

export default function PortalConvenioPage() {
  const [convenios, setConvenios] = useState<any[]>([]);
  const [dashboard, setDashboard] = useState<any>(null);
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    api.get('/convenios/meus')
      .then(r => {
        setConvenios(r.data);
        if (r.data.length > 0) {
          setSelecionado(r.data[0].id);
        }
      })
      .finally(() => setCarregando(false));
  }, []);

  useEffect(() => {
    if (!selecionado) return;
    api.get(`/convenios/meus/${selecionado}/dashboard`)
      .then(r => setDashboard(r.data));
  }, [selecionado]);

  if (carregando) return <p className="text-center py-8 text-muted-foreground">Carregando...</p>;

  if (convenios.length === 0) {
    return (
      <div className="text-center py-16">
        <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Nenhum convênio encontrado</h2>
        <p className="text-muted-foreground">Você não é conveniado de nenhum convênio ativo.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Meu Convênio</h1>

      {convenios.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {convenios.map((c: any) => (
            <button
              key={c.id}
              className={`px-4 py-2 rounded-lg border ${selecionado === c.id ? 'bg-blue-50 border-blue-300' : 'bg-white'}`}
              onClick={() => setSelecionado(c.id)}
            >
              {c.empresaNome}
              {c.tierMinimoClube && (
                <Badge className="ml-2 text-xs" variant="outline">{c.tierMinimoClube}</Badge>
              )}
            </button>
          ))}
        </div>
      )}

      {dashboard && (
        <>
          {/* Cards de resumo */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <Users className="h-8 w-8 text-blue-500" />
                  <div>
                    <p className="text-2xl font-bold">{dashboard.membrosAtivos}</p>
                    <p className="text-sm text-muted-foreground">Membros Ativos</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            {dashboard.faixaAtual && (
              <>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <TrendingUp className="h-8 w-8 text-green-500" />
                      <div>
                        <p className="text-2xl font-bold">Faixa {dashboard.faixaAtual.index + 1}</p>
                        <p className="text-sm text-muted-foreground">Faixa Atual</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <Percent className="h-8 w-8 text-purple-500" />
                      <div>
                        <p className="text-2xl font-bold">{dashboard.faixaAtual.descontoMembros}%</p>
                        <p className="text-sm text-muted-foreground">Desc. Membros</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <Percent className="h-8 w-8 text-orange-500" />
                      <div>
                        <p className="text-2xl font-bold">{dashboard.faixaAtual.descontoConveniado}%</p>
                        <p className="text-sm text-muted-foreground">Seu Desconto</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>

          {/* Progresso para próxima faixa */}
          {dashboard.proximaFaixa && (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Target className="h-5 w-5" /> Próxima Faixa</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm mb-2">
                  Faltam <strong>{dashboard.proximaFaixa.membrosNecessarios}</strong> membro(s) para a próxima faixa:
                  <strong> {dashboard.proximaFaixa.descontoMembros}%</strong> para membros e
                  <strong> {dashboard.proximaFaixa.descontoConveniado}%</strong> para você.
                </p>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-blue-500 h-3 rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, (dashboard.membrosAtivos / dashboard.proximaFaixa.minMembros) * 100)}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {dashboard.membrosAtivos} / {dashboard.proximaFaixa.minMembros} membros
                </p>
              </CardContent>
            </Card>
          )}

          {/* Lista de membros */}
          <Card>
            <CardHeader><CardTitle>Membros do Convênio</CardTitle></CardHeader>
            <CardContent>
              {dashboard.membros.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">Nenhum membro ainda</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Matrícula</TableHead>
                      <TableHead>Data Adesão</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dashboard.membros.map((m: any) => (
                      <TableRow key={m.id}>
                        <TableCell className="font-medium">{m.nome}</TableCell>
                        <TableCell>{m.matricula ?? '-'}</TableCell>
                        <TableCell className="text-sm">
                          {m.dataAdesao ? new Date(m.dataAdesao).toLocaleDateString('pt-BR') : '-'}
                        </TableCell>
                        <TableCell><Badge variant="outline">{m.status}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Histórico */}
          {dashboard.historicoFaixas?.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Histórico de Progressão</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Faixa</TableHead>
                      <TableHead>Membros</TableHead>
                      <TableHead>Desconto</TableHead>
                      <TableHead>Motivo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dashboard.historicoFaixas.map((h: any) => (
                      <TableRow key={h.id}>
                        <TableCell className="text-sm">{new Date(h.createdAt).toLocaleDateString('pt-BR')}</TableCell>
                        <TableCell>{h.faixaAnteriorIdx + 1} → {h.faixaNovaIdx + 1}</TableCell>
                        <TableCell>{h.membrosAtivos}</TableCell>
                        <TableCell className="font-mono">{Number(h.descontoNovo).toFixed(1)}%</TableCell>
                        <TableCell><Badge variant="outline">{h.motivo}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
