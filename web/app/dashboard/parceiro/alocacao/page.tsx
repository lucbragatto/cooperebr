'use client';

import { useCallback, useEffect, useMemo, useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Loader2, Pencil, Plus, Sparkles, Trash2 } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────
// Tipos compartilhados
// ─────────────────────────────────────────────────────────────────────────

type ClasseGd = 'GD_I' | 'GD_II' | 'GD_III';

interface UsinaRow {
  id: string;
  nome: string;
  apelidoInterno: string | null;
  capacidadeKwh: number | null;
  classeGdAnotada: ClasseGd | null;
  cooperativaId: string | null;
  contratos: { percentualUsina: number | null }[];
}

interface AlocacaoSnapshotMini {
  contratosAvaliados: number;
  realocacoesSugeridas: number;
  custoTotalAntesProxy: number;
  custoTotalDepoisProxy: number;
  economiaTotalProxy: number;
}

interface AlocacaoRow {
  id: string;
  calculadaEm: string;
  status: 'SUGERIDA' | 'APROVADA_PARCIAL' | 'APROVADA_TOTAL' | 'DESCARTADA';
  snapshot: AlocacaoSnapshotMini;
  aprovadasContratoIds: string[];
  aplicadaEm: string | null;
}

interface PoliticaRow {
  id: string;
  nome: string;
  faixaMin: number;
  faixaMax: number | null;
  classeGdPreferida: ClasseGd | null;
  usinasElegiveis: string[];
  prioridade: number;
  ativa: boolean;
}

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────

const CLASSE_GD_OPCOES: ClasseGd[] = ['GD_I', 'GD_II', 'GD_III'];

function fmtDateTime(s: string | null | undefined): string {
  if (!s) return '—';
  try {
    return new Date(s).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return '—';
  }
}

function statusBadge(status: AlocacaoRow['status']): { label: string; color: string } {
  const map: Record<AlocacaoRow['status'], { label: string; color: string }> = {
    SUGERIDA: { label: 'Sugerida', color: 'bg-blue-100 text-blue-800' },
    APROVADA_PARCIAL: { label: 'Aprov. parcial', color: 'bg-yellow-100 text-yellow-800' },
    APROVADA_TOTAL: { label: 'Aprov. total', color: 'bg-green-100 text-green-800' },
    DESCARTADA: { label: 'Descartada', color: 'bg-gray-200 text-gray-700' },
  };
  return map[status];
}

// ─────────────────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────────────────

function AlocacaoContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabFromUrl = (searchParams?.get('tab') as 'estado' | 'sugestoes' | 'politicas') || 'estado';
  const [tab, setTab] = useState<'estado' | 'sugestoes' | 'politicas'>(tabFromUrl);
  const [erro, setErro] = useState('');

  useEffect(() => {
    const novo = new URLSearchParams(searchParams?.toString() ?? '');
    novo.set('tab', tab);
    router.replace(`/dashboard/parceiro/alocacao?${novo.toString()}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  return (
    <div className="container mx-auto py-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Alocação Multi-Usina</h1>
      </div>

      <div className="border-b flex gap-1">
        {(
          [
            ['estado', 'Estado atual'],
            ['sugestoes', 'Sugestões'],
            ['politicas', 'Políticas'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === key
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {erro && (
        <Card className="border-red-300 bg-red-50">
          <CardContent className="text-red-700 py-3">{erro}</CardContent>
        </Card>
      )}

      {tab === 'estado' && <AbaEstadoAtual onErro={setErro} />}
      {tab === 'sugestoes' && <AbaSugestoes onErro={setErro} />}
      {tab === 'politicas' && <AbaPoliticas onErro={setErro} />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// ABA 1 — Estado atual (tabela usinas + classeGdAnotada inline Tipo A)
// ─────────────────────────────────────────────────────────────────────────

function AbaEstadoAtual({ onErro }: { onErro: (msg: string) => void }) {
  const router = useRouter();
  const [usinas, setUsinas] = useState<UsinaRow[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [simulando, setSimulando] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [filtroSemClasse, setFiltroSemClasse] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const { data } = await api.get('/usinas');
      setUsinas(data ?? []);
    } catch (err: any) {
      onErro(err.response?.data?.message ?? 'Falha ao carregar usinas.');
    } finally {
      setCarregando(false);
    }
  }, [onErro]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const usinasFiltradas = useMemo(() => {
    if (!filtroSemClasse) return usinas;
    return usinas.filter((u) => !u.classeGdAnotada);
  }, [usinas, filtroSemClasse]);

  async function salvarClasseGd(usinaId: string, novaClasse: ClasseGd | null) {
    setEditandoId(null);
    const original = usinas.find((u) => u.id === usinaId);
    if (!original) return;
    // Otimistic UI
    setUsinas((prev) =>
      prev.map((u) => (u.id === usinaId ? { ...u, classeGdAnotada: novaClasse } : u)),
    );
    try {
      await api.put(`/usinas/${usinaId}`, { classeGdAnotada: novaClasse });
    } catch (err: any) {
      // Reverte
      setUsinas((prev) =>
        prev.map((u) =>
          u.id === usinaId ? { ...u, classeGdAnotada: original.classeGdAnotada } : u,
        ),
      );
      onErro(err.response?.data?.message ?? 'Falha ao salvar classe GD.');
    }
  }

  async function simular() {
    setSimulando(true);
    try {
      const { data } = await api.post('/alocacao/simular');
      router.push(`/dashboard/parceiro/alocacao/${data.id}`);
    } catch (err: any) {
      onErro(err.response?.data?.message ?? 'Falha ao simular alocação.');
    } finally {
      setSimulando(false);
    }
  }

  function calcularOcupacao(u: UsinaRow): number {
    if (!u.capacidadeKwh) return 0;
    return u.contratos.reduce((acc, c) => acc + Number(c.percentualUsina ?? 0), 0);
  }

  if (carregando) {
    return (
      <Card>
        <CardContent className="py-12 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Estado atual das usinas</CardTitle>
          <p className="text-sm text-gray-500 mt-1">
            Clique no lápis pra editar classe GD da usina (Tipo A inline).
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={filtroSemClasse} onCheckedChange={setFiltroSemClasse} />
            Só sem classeGdAnotada
          </label>
          <Button onClick={simular} disabled={simulando}>
            {simulando ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            Simular realocação
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usina</TableHead>
              <TableHead>Apelido</TableHead>
              <TableHead className="text-right">Capacidade (kWh/mês)</TableHead>
              <TableHead className="text-right">% Ocupada</TableHead>
              <TableHead className="text-right">Cooperados</TableHead>
              <TableHead>Classe GD</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {usinasFiltradas.map((u) => {
              const ocupacao = calcularOcupacao(u);
              return (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.nome}</TableCell>
                  <TableCell className="text-gray-500">{u.apelidoInterno ?? '—'}</TableCell>
                  <TableCell className="text-right">
                    {u.capacidadeKwh ? u.capacidadeKwh.toLocaleString('pt-BR') : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <span
                      className={
                        ocupacao > 90
                          ? 'text-red-600 font-semibold'
                          : ocupacao > 70
                            ? 'text-yellow-700'
                            : ''
                      }
                    >
                      {ocupacao.toFixed(2)}%
                    </span>
                  </TableCell>
                  <TableCell className="text-right">{u.contratos.length}</TableCell>
                  <TableCell>
                    {editandoId === u.id ? (
                      <Select
                        defaultValue={u.classeGdAnotada ?? undefined}
                        onValueChange={(val) => salvarClasseGd(u.id, val as ClasseGd)}
                      >
                        <SelectTrigger className="w-28 h-8">
                          <SelectValue placeholder="—" />
                        </SelectTrigger>
                        <SelectContent>
                          {CLASSE_GD_OPCOES.map((cg) => (
                            <SelectItem key={cg} value={cg}>
                              {cg.replace('_', ' ')}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <button
                        onClick={() => setEditandoId(u.id)}
                        className="group inline-flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-50 text-sm"
                      >
                        <span className={u.classeGdAnotada ? '' : 'text-gray-400 italic'}>
                          {u.classeGdAnotada ? u.classeGdAnotada.replace('_', ' ') : 'sem classe'}
                        </span>
                        <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-60" />
                      </button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// ABA 2 — Sugestões (lista de AlocacaoOtima)
// ─────────────────────────────────────────────────────────────────────────

function AbaSugestoes({ onErro }: { onErro: (msg: string) => void }) {
  const [alocacoes, setAlocacoes] = useState<AlocacaoRow[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState<string>('');

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const { data } = await api.get('/alocacao', {
        params: filtroStatus ? { status: filtroStatus } : {},
      });
      setAlocacoes(data ?? []);
    } catch (err: any) {
      onErro(err.response?.data?.message ?? 'Falha ao carregar alocações.');
    } finally {
      setCarregando(false);
    }
  }, [filtroStatus, onErro]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Sugestões de realocação</CardTitle>
        <Select value={filtroStatus || 'all'} onValueChange={(v) => setFiltroStatus(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Todos os status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="SUGERIDA">Sugerida</SelectItem>
            <SelectItem value="APROVADA_PARCIAL">Aprov. parcial</SelectItem>
            <SelectItem value="APROVADA_TOTAL">Aprov. total</SelectItem>
            <SelectItem value="DESCARTADA">Descartada</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {carregando ? (
          <div className="py-12 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : alocacoes.length === 0 ? (
          <p className="text-gray-500 py-8 text-center">
            Nenhuma sugestão encontrada. Use "Simular realocação" na aba Estado atual.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Avaliados</TableHead>
                <TableHead className="text-right">Realocações</TableHead>
                <TableHead className="text-right">Economia proxy</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {alocacoes.map((a) => {
                const badge = statusBadge(a.status);
                return (
                  <TableRow key={a.id}>
                    <TableCell>{fmtDateTime(a.calculadaEm)}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${badge.color}`}>
                        {badge.label}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">{a.snapshot.contratosAvaliados}</TableCell>
                    <TableCell className="text-right">{a.snapshot.realocacoesSugeridas}</TableCell>
                    <TableCell className="text-right">{a.snapshot.economiaTotalProxy}</TableCell>
                    <TableCell>
                      <Link
                        href={`/dashboard/parceiro/alocacao/${a.id}`}
                        className="text-blue-600 hover:underline text-sm"
                      >
                        Ver detalhes
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// ABA 3 — Políticas (CRUD)
// ─────────────────────────────────────────────────────────────────────────

function AbaPoliticas({ onErro }: { onErro: (msg: string) => void }) {
  const [politicas, setPoliticas] = useState<PoliticaRow[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [dialogNova, setDialogNova] = useState(false);
  const [novaNome, setNovaNome] = useState('');
  const [novaFaixaMin, setNovaFaixaMin] = useState('0');
  const [novaFaixaMax, setNovaFaixaMax] = useState('');
  const [novaClasseGd, setNovaClasseGd] = useState<string>('');
  const [novaPrioridade, setNovaPrioridade] = useState('10');
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const { data } = await api.get('/politicas-alocacao');
      setPoliticas(data ?? []);
    } catch (err: any) {
      onErro(err.response?.data?.message ?? 'Falha ao carregar políticas.');
    } finally {
      setCarregando(false);
    }
  }, [onErro]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function criar() {
    setSalvando(true);
    try {
      await api.post('/politicas-alocacao', {
        nome: novaNome,
        faixaMin: Number(novaFaixaMin),
        faixaMax: novaFaixaMax ? Number(novaFaixaMax) : null,
        classeGdPreferida: novaClasseGd || null,
        prioridade: Number(novaPrioridade),
      });
      setDialogNova(false);
      setNovaNome('');
      setNovaFaixaMin('0');
      setNovaFaixaMax('');
      setNovaClasseGd('');
      setNovaPrioridade('10');
      await carregar();
    } catch (err: any) {
      onErro(err.response?.data?.message ?? 'Falha ao criar política.');
    } finally {
      setSalvando(false);
    }
  }

  async function alternarAtiva(p: PoliticaRow) {
    try {
      await api.patch(`/politicas-alocacao/${p.id}`, { ativa: !p.ativa });
      await carregar();
    } catch (err: any) {
      onErro(err.response?.data?.message ?? 'Falha ao atualizar política.');
    }
  }

  async function remover(p: PoliticaRow) {
    if (!confirm(`Remover política "${p.nome}"?`)) return;
    try {
      await api.delete(`/politicas-alocacao/${p.id}`);
      await carregar();
    } catch (err: any) {
      onErro(err.response?.data?.message ?? 'Falha ao remover política.');
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Políticas de alocação</CardTitle>
        <Button onClick={() => setDialogNova(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nova política
        </Button>
        <Dialog open={dialogNova} onOpenChange={setDialogNova}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova política de alocação</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">Nome</label>
                <Input value={novaNome} onChange={(e) => setNovaNome(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Faixa mín (kWh/mês)</label>
                  <Input
                    type="number"
                    value={novaFaixaMin}
                    onChange={(e) => setNovaFaixaMin(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Faixa máx (kWh/mês, vazio = sem teto)</label>
                  <Input
                    type="number"
                    value={novaFaixaMax}
                    onChange={(e) => setNovaFaixaMax(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Classe GD preferida</label>
                  <Select value={novaClasseGd || 'none'} onValueChange={(v) => setNovaClasseGd(v === 'none' ? '' : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— (qualquer)</SelectItem>
                      {CLASSE_GD_OPCOES.map((cg) => (
                        <SelectItem key={cg} value={cg}>
                          {cg.replace('_', ' ')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Prioridade</label>
                  <Input
                    type="number"
                    value={novaPrioridade}
                    onChange={(e) => setNovaPrioridade(e.target.value)}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogNova(false)}>
                Cancelar
              </Button>
              <Button onClick={criar} disabled={salvando || !novaNome}>
                {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Criar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {carregando ? (
          <div className="py-12 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead className="text-right">Faixa</TableHead>
                <TableHead>Classe preferida</TableHead>
                <TableHead className="text-right">Prioridade</TableHead>
                <TableHead className="text-right">Ativa</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {politicas.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.nome}</TableCell>
                  <TableCell className="text-right">
                    {p.faixaMin} – {p.faixaMax ?? '∞'}
                  </TableCell>
                  <TableCell>{p.classeGdPreferida?.replace('_', ' ') ?? '—'}</TableCell>
                  <TableCell className="text-right">{p.prioridade}</TableCell>
                  <TableCell className="text-right">
                    <Switch checked={p.ativa} onCheckedChange={() => alternarAtiva(p)} />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => remover(p)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Page wrapper (Suspense pra useSearchParams)
// ─────────────────────────────────────────────────────────────────────────

export default function AlocacaoPage() {
  return (
    <Suspense
      fallback={
        <div className="p-12 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      }
    >
      <AlocacaoContent />
    </Suspense>
  );
}
