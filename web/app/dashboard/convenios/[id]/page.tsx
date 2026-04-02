'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, UserPlus, Trash2, RefreshCw, TrendingUp, Users, Percent } from 'lucide-react';
import Link from 'next/link';

const tipoLabels: Record<string, string> = {
  CONDOMINIO: 'Condomínio', ADMINISTRADORA: 'Administradora', ASSOCIACAO: 'Associação',
  SINDICATO: 'Sindicato', EMPRESA: 'Empresa', CLUBE: 'Clube', OUTRO: 'Outro',
};

export default function ConvenioDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [convenio, setConvenio] = useState<any>(null);
  const [carregando, setCarregando] = useState(true);
  const [addCooperadoId, setAddCooperadoId] = useState('');
  const [addMatricula, setAddMatricula] = useState('');
  const [recalculando, setRecalculando] = useState(false);

  function carregar() {
    setCarregando(true);
    api.get(`/convenios/${id}`)
      .then(r => setConvenio(r.data))
      .finally(() => setCarregando(false));
  }

  useEffect(() => { carregar(); }, [id]);

  async function adicionarMembro() {
    if (!addCooperadoId.trim()) return;
    try {
      await api.post(`/convenios/${id}/membros`, {
        cooperadoId: addCooperadoId.trim(),
        matricula: addMatricula.trim() || undefined,
      });
      setAddCooperadoId('');
      setAddMatricula('');
      carregar();
    } catch (err: any) {
      alert(err.response?.data?.message ?? 'Erro ao adicionar membro');
    }
  }

  async function removerMembro(cooperadoId: string, nome: string) {
    if (!confirm(`Desligar "${nome}" do convênio?`)) return;
    try {
      await api.delete(`/convenios/${id}/membros/${cooperadoId}`);
      carregar();
    } catch (err: any) {
      alert(err.response?.data?.message ?? 'Erro ao remover membro');
    }
  }

  async function recalcular() {
    setRecalculando(true);
    try {
      await api.post(`/convenios/${id}/recalcular`);
      carregar();
    } catch (err: any) {
      alert(err.response?.data?.message ?? 'Erro ao recalcular');
    } finally {
      setRecalculando(false);
    }
  }

  if (carregando) return <p className="text-center py-8">Carregando...</p>;
  if (!convenio) return <p className="text-center py-8">Convênio não encontrado</p>;

  const config = convenio.configBeneficio ?? {};
  const faixas = config.faixas ?? [];
  const membrosAtivos = convenio.cooperados?.filter((m: any) => m.ativo) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/convenios">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{convenio.empresaNome}</h1>
            <p className="text-muted-foreground">{convenio.numero} - {tipoLabels[convenio.tipo] ?? convenio.tipo}</p>
          </div>
        </div>
        <Badge className={convenio.status === 'ATIVO' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
          {convenio.status}
        </Badge>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{convenio.membrosAtivosCache}</p>
                <p className="text-sm text-muted-foreground">Membros Ativos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">Faixa {convenio.faixaAtualIndex + 1}</p>
                <p className="text-sm text-muted-foreground">de {faixas.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Percent className="h-8 w-8 text-purple-500" />
              <div>
                <p className="text-2xl font-bold">{Number(convenio.descontoMembrosAtual).toFixed(1)}%</p>
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
                <p className="text-2xl font-bold">{Number(convenio.descontoConveniadoAtual).toFixed(1)}%</p>
                <p className="text-sm text-muted-foreground">Desc. Conveniado</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Conveniado */}
      {convenio.conveniado && (
        <Card>
          <CardHeader><CardTitle>Conveniado (Representante)</CardTitle></CardHeader>
          <CardContent>
            <p><strong>{convenio.conveniado.nomeCompleto}</strong> ({convenio.conveniado.cpf})</p>
            <p className="text-sm text-muted-foreground">{convenio.conveniado.email} - Tipo: {convenio.conveniado.tipoCooperado}</p>
          </CardContent>
        </Card>
      )}

      {/* Faixas de desconto */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Faixas Progressivas</CardTitle>
            <Button variant="outline" size="sm" onClick={recalcular} disabled={recalculando}>
              <RefreshCw className={`h-4 w-4 mr-1 ${recalculando ? 'animate-spin' : ''}`} />
              Recalcular
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {faixas.length === 0 ? (
            <p className="text-muted-foreground">Nenhuma faixa configurada</p>
          ) : (
            <div className="space-y-2">
              {faixas.map((f: any, i: number) => (
                <div
                  key={i}
                  className={`flex items-center gap-4 p-3 rounded-lg border ${i === convenio.faixaAtualIndex ? 'bg-blue-50 border-blue-300' : 'bg-gray-50'}`}
                >
                  <Badge variant={i === convenio.faixaAtualIndex ? 'default' : 'outline'}>
                    Faixa {i + 1}
                  </Badge>
                  <span className="text-sm">
                    {f.minMembros}-{f.maxMembros ?? '+'} membros
                  </span>
                  <span className="text-sm font-mono">
                    Membros: {f.descontoMembros}% | Conveniado: {f.descontoConveniado}%
                  </span>
                  {i === convenio.faixaAtualIndex && (
                    <Badge className="bg-blue-100 text-blue-800">ATUAL</Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Membros */}
      <Card>
        <CardHeader>
          <CardTitle>Membros ({membrosAtivos.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Input
              placeholder="ID do cooperado"
              value={addCooperadoId}
              onChange={e => setAddCooperadoId(e.target.value)}
              className="w-64"
            />
            <Input
              placeholder="Matrícula (opcional)"
              value={addMatricula}
              onChange={e => setAddMatricula(e.target.value)}
              className="w-48"
            />
            <Button onClick={adicionarMembro}>
              <UserPlus className="h-4 w-4 mr-1" /> Adicionar
            </Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>CPF</TableHead>
                <TableHead>Matrícula</TableHead>
                <TableHead>Data Adesão</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Desc. Override</TableHead>
                <TableHead>Indicação</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {convenio.cooperados?.map((m: any) => (
                <TableRow key={m.id} className={!m.ativo ? 'opacity-50' : ''}>
                  <TableCell className="font-medium">{m.cooperado.nomeCompleto}</TableCell>
                  <TableCell className="font-mono text-sm">{m.cooperado.cpf}</TableCell>
                  <TableCell>{m.matricula ?? '-'}</TableCell>
                  <TableCell className="text-sm">{m.dataAdesao ? new Date(m.dataAdesao).toLocaleDateString('pt-BR') : '-'}</TableCell>
                  <TableCell>
                    <Badge variant={m.ativo ? 'default' : 'secondary'}>{m.status}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {m.descontoOverride != null ? `${Number(m.descontoOverride).toFixed(1)}%` : '-'}
                  </TableCell>
                  <TableCell>
                    {m.indicacao ? <Badge variant="outline" className="text-xs">{m.indicacao.status}</Badge> : '-'}
                  </TableCell>
                  <TableCell>
                    {m.ativo && (
                      <Button variant="ghost" size="icon" onClick={() => removerMembro(m.cooperadoId, m.cooperado.nomeCompleto)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Histórico de faixas */}
      {convenio.historicoFaixas?.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Histórico de Progressão</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Faixa</TableHead>
                  <TableHead>Membros</TableHead>
                  <TableHead>Desc. Anterior</TableHead>
                  <TableHead>Desc. Novo</TableHead>
                  <TableHead>Motivo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {convenio.historicoFaixas.map((h: any) => (
                  <TableRow key={h.id}>
                    <TableCell className="text-sm">{new Date(h.createdAt).toLocaleDateString('pt-BR')}</TableCell>
                    <TableCell>
                      {h.faixaAnteriorIdx + 1} → {h.faixaNovaIdx + 1}
                    </TableCell>
                    <TableCell>{h.membrosAtivos}</TableCell>
                    <TableCell className="font-mono">{Number(h.descontoAnterior).toFixed(1)}%</TableCell>
                    <TableCell className="font-mono">{Number(h.descontoNovo).toFixed(1)}%</TableCell>
                    <TableCell><Badge variant="outline">{h.motivo}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
