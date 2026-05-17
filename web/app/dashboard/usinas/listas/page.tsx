'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { useTipoParceiro } from '@/hooks/useTipoParceiro';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { AlertTriangle, Download, Loader2, Plus, ListChecks } from 'lucide-react';
import StatusEnvioBadge, { type StatusEnvio } from '@/components/envio-lista/StatusEnvioBadge';
import ContadorCooperados from '@/components/envio-lista/ContadorCooperados';

interface UsinaResumo {
  id: string;
  nome: string;
  apelidoInterno: string | null;
  cidade: string;
  estado: string;
  capacidadeKwh: number;
  totalAlocado: number;
  totalCooperados: number;
  excedida: boolean;
}

interface EnvioRow {
  id: string;
  numeroInterno: string;
  status: StatusEnvio;
  usina: { id: string; nome: string; apelidoInterno: string | null };
  geradaEm: string;
  validadaEm: string | null;
  enviadaEm: string | null;
  canalEnvio: string | null;
  protocoloEm: string | null;
  numeroProtocoloConcessionaria: string | null;
  liberadaEm: string | null;
  counts: { pendente: number; homologado: number; rejeitado: number; total: number };
}

const STATUS_ENVIO_OPCOES: StatusEnvio[] = [
  'RASCUNHO',
  'VALIDADA',
  'PRONTA_PARA_ENVIO',
  'ENVIADA',
  'PROTOCOLADA',
  'HOMOLOGADO_PARCIAL',
  'HOMOLOGADO_TOTAL',
  'REJEITADA',
  'CANCELADA',
];

function fmtDateTime(s: string | null): string {
  if (!s) return '—';
  try { return new Date(s).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }); }
  catch { return '—'; }
}

export default function ListasConcessionariaPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { tipoMembroPlural } = useTipoParceiro();

  const tabFromUrl = (searchParams?.get('tab') === 'envios' ? 'envios' : 'visao') as 'visao' | 'envios';
  const [tab, setTab] = useState<'visao' | 'envios'>(tabFromUrl);

  // VISÃO GERAL
  const [usinas, setUsinas] = useState<UsinaResumo[]>([]);
  const [carregandoUsinas, setCarregandoUsinas] = useState(true);
  const [baixando, setBaixando] = useState<string | null>(null);

  // ENVIOS
  const [envios, setEnvios] = useState<EnvioRow[]>([]);
  const [carregandoEnvios, setCarregandoEnvios] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState<StatusEnvio | ''>('');
  const [filtroUsinaId, setFiltroUsinaId] = useState('');
  const [filtroSearch, setFiltroSearch] = useState('');
  const [filtroGeradaDe, setFiltroGeradaDe] = useState('');
  const [filtroGeradaAte, setFiltroGeradaAte] = useState('');
  const [pageEnvios, setPageEnvios] = useState(1);
  const [totalEnvios, setTotalEnvios] = useState(0);

  const carregarUsinas = useCallback(async () => {
    setCarregandoUsinas(true);
    try {
      const { data: listaUsinas } = await api.get('/usinas');
      const resumos: UsinaResumo[] = [];
      for (const u of listaUsinas) {
        try {
          const { data } = await api.get(`/migracoes-usina/lista-concessionaria/${u.id}`);
          const cap = Number(u.capacidadeKwh ?? 0);
          resumos.push({
            id: u.id,
            nome: u.nome,
            apelidoInterno: u.apelidoInterno ?? null,
            cidade: u.cidade ?? '',
            estado: u.estado ?? '',
            capacidadeKwh: cap,
            totalAlocado: data.totalKwh ?? 0,
            totalCooperados: data.totalCooperados ?? 0,
            excedida: cap > 0 && (data.totalKwh ?? 0) > cap,
          });
        } catch {
          resumos.push({
            id: u.id, nome: u.nome,
            apelidoInterno: u.apelidoInterno ?? null,
            cidade: u.cidade ?? '', estado: u.estado ?? '',
            capacidadeKwh: Number(u.capacidadeKwh ?? 0),
            totalAlocado: 0, totalCooperados: 0, excedida: false,
          });
        }
      }
      setUsinas(resumos);
    } finally {
      setCarregandoUsinas(false);
    }
  }, []);

  const carregarEnvios = useCallback(async () => {
    setCarregandoEnvios(true);
    try {
      const params: any = { page: pageEnvios, pageSize: 25 };
      if (filtroStatus) params.status = filtroStatus;
      if (filtroUsinaId) params.usinaId = filtroUsinaId;
      if (filtroSearch) params.search = filtroSearch;
      if (filtroGeradaDe) params.geradaDe = new Date(filtroGeradaDe).toISOString();
      if (filtroGeradaAte) params.geradaAte = new Date(filtroGeradaAte).toISOString();
      const { data } = await api.get('/envios-lista', { params });
      setEnvios(data.registros || []);
      setTotalEnvios(data.total ?? 0);
    } catch {
      setEnvios([]);
      setTotalEnvios(0);
    } finally {
      setCarregandoEnvios(false);
    }
  }, [pageEnvios, filtroStatus, filtroUsinaId, filtroSearch, filtroGeradaDe, filtroGeradaAte]);

  useEffect(() => { carregarUsinas(); }, [carregarUsinas]);
  useEffect(() => {
    if (tab === 'envios') carregarEnvios();
  }, [tab, carregarEnvios]);

  function trocarTab(t: 'visao' | 'envios') {
    setTab(t);
    const url = t === 'envios' ? '/dashboard/usinas/listas?tab=envios' : '/dashboard/usinas/listas';
    router.replace(url);
  }

  async function baixarCSV(usinaId: string, nomeUsina: string) {
    setBaixando(usinaId);
    try {
      const { data } = await api.get(`/migracoes-usina/lista-concessionaria/${usinaId}`);
      const csv = data.csv as string;
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lista-${nomeUsina.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Erro ao baixar lista.');
    } finally {
      setBaixando(null);
    }
  }

  const totalPages = useMemo(() => Math.max(1, Math.ceil(totalEnvios / 25)), [totalEnvios]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-800">Listas para Concessionária</h2>
      </div>

      {/* TABS */}
      <div className="border-b mb-6">
        <nav className="flex gap-1" aria-label="Tabs">
          <button
            type="button"
            onClick={() => trocarTab('visao')}
            className={`px-4 py-2 text-sm font-medium border-b-2 ${tab === 'visao' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            Visão geral
          </button>
          <button
            type="button"
            onClick={() => trocarTab('envios')}
            className={`px-4 py-2 text-sm font-medium border-b-2 flex items-center gap-1.5 ${tab === 'envios' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            <ListChecks className="h-4 w-4" />
            Envios
          </button>
        </nav>
      </div>

      {tab === 'visao' && (
        <>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-gray-500">Capacidade vs alocação por usina. Use "+ Novo envio" para gerar lista pra concessionária.</p>
            <Button size="sm" variant="outline" onClick={carregarUsinas} disabled={carregandoUsinas}>
              {carregandoUsinas && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Atualizar
            </Button>
          </div>

          {carregandoUsinas && <p className="text-gray-500">Carregando usinas...</p>}

          {!carregandoUsinas && usinas.length === 0 && (
            <p className="text-gray-400">Nenhuma usina cadastrada.</p>
          )}

          {usinas.filter((u) => u.excedida).length > 0 && (
            <div className="mb-4 space-y-2">
              {usinas.filter((u) => u.excedida).map((u) => (
                <div key={u.id} className="flex items-start gap-2 p-3 rounded-lg text-sm bg-red-50 text-red-800 border border-red-200">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    <strong>{u.nome}</strong>: capacidade excedida — {u.totalAlocado.toLocaleString('pt-BR')} kWh alocados de {u.capacidadeKwh.toLocaleString('pt-BR')} kWh.
                  </span>
                </div>
              ))}
            </div>
          )}

          {!carregandoUsinas && usinas.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Todas as Usinas</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Usina</TableHead>
                      <TableHead>Cidade/UF</TableHead>
                      <TableHead>Capacidade (kWh)</TableHead>
                      <TableHead>Alocado (kWh)</TableHead>
                      <TableHead>% Uso</TableHead>
                      <TableHead>{tipoMembroPlural}</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usinas.map((u) => {
                      const pct = u.capacidadeKwh > 0
                        ? Math.round((u.totalAlocado / u.capacidadeKwh) * 1000) / 10
                        : 0;
                      return (
                        <TableRow key={u.id}>
                          <TableCell className="font-medium">
                            <div>{u.nome}</div>
                            {u.apelidoInterno && <div className="text-[10px] text-gray-400 font-mono">{u.apelidoInterno}</div>}
                          </TableCell>
                          <TableCell>{u.cidade}/{u.estado}</TableCell>
                          <TableCell>{u.capacidadeKwh.toLocaleString('pt-BR')}</TableCell>
                          <TableCell>{u.totalAlocado.toLocaleString('pt-BR')}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="w-16 bg-gray-200 rounded-full h-1.5">
                                <div
                                  className={`h-1.5 rounded-full ${pct > 100 ? 'bg-red-600' : pct > 80 ? 'bg-yellow-500' : 'bg-green-600'}`}
                                  style={{ width: `${Math.min(pct, 100)}%` }}
                                />
                              </div>
                              <span className="text-xs">{pct.toFixed(1)}%</span>
                            </div>
                          </TableCell>
                          <TableCell>{u.totalCooperados}</TableCell>
                          <TableCell>
                            {u.excedida ? (
                              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-800">Excedida</span>
                            ) : pct > 80 ? (
                              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-yellow-100 text-yellow-800">Alta ocupação</span>
                            ) : (
                              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-800">OK</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-1 justify-end">
                              {u.totalCooperados === 0 ? (
                                <Button
                                  size="sm"
                                  disabled
                                  title="Sem cooperados alocados"
                                >
                                  <Plus className="h-3.5 w-3.5 mr-1" />Novo envio
                                </Button>
                              ) : (
                                <Link href={`/dashboard/listas-concessionaria/novo?usinaId=${u.id}`}>
                                  <Button size="sm" title="Criar novo envio à concessionária">
                                    <Plus className="h-3.5 w-3.5 mr-1" />Novo envio
                                  </Button>
                                </Link>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={baixando === u.id}
                                title="Baixar CSV bruto da alocação atual"
                                onClick={() => baixarCSV(u.id, u.nome)}
                              >
                                {baixando === u.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {tab === 'envios' && (
        <>
          {/* Filtros */}
          <Card className="mb-4">
            <CardContent className="pt-4">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-sm">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Status</label>
                  <select
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                    value={filtroStatus}
                    onChange={(e) => { setFiltroStatus(e.target.value as StatusEnvio | ''); setPageEnvios(1); }}
                  >
                    <option value="">Todos</option>
                    {STATUS_ENVIO_OPCOES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Usina</label>
                  <select
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                    value={filtroUsinaId}
                    onChange={(e) => { setFiltroUsinaId(e.target.value); setPageEnvios(1); }}
                  >
                    <option value="">Todas</option>
                    {usinas.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Gerada de</label>
                  <Input type="date" value={filtroGeradaDe} onChange={(e) => { setFiltroGeradaDe(e.target.value); setPageEnvios(1); }} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Gerada até</label>
                  <Input type="date" value={filtroGeradaAte} onChange={(e) => { setFiltroGeradaAte(e.target.value); setPageEnvios(1); }} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Busca (nº interno ou protocolo)</label>
                  <Input
                    type="text"
                    placeholder="LIST-... ou EDP-..."
                    value={filtroSearch}
                    onChange={(e) => { setFiltroSearch(e.target.value); setPageEnvios(1); }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span>Envios registrados ({totalEnvios})</span>
                <Button size="sm" variant="outline" onClick={carregarEnvios} disabled={carregandoEnvios}>
                  {carregandoEnvios && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                  Atualizar
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nº Interno</TableHead>
                    <TableHead>Usina</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Gerada em</TableHead>
                    <TableHead>Enviada em</TableHead>
                    <TableHead>Canal</TableHead>
                    <TableHead>Protocolo</TableHead>
                    <TableHead>Cooperados</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {carregandoEnvios ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-6 text-gray-400">
                      <Loader2 className="h-4 w-4 inline mr-2 animate-spin" />Carregando...
                    </TableCell></TableRow>
                  ) : envios.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-6 text-gray-400">
                      Nenhum envio encontrado com os filtros atuais.
                    </TableCell></TableRow>
                  ) : (
                    envios.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell>
                          <Link href={`/dashboard/listas-concessionaria/${e.id}`} className="text-blue-600 hover:underline font-mono text-xs">
                            {e.numeroInterno}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <div>{e.usina.nome}</div>
                          {e.usina.apelidoInterno && <div className="text-[10px] text-gray-400 font-mono">{e.usina.apelidoInterno}</div>}
                        </TableCell>
                        <TableCell><StatusEnvioBadge status={e.status} /></TableCell>
                        <TableCell className="text-xs">{fmtDateTime(e.geradaEm)}</TableCell>
                        <TableCell className="text-xs">{fmtDateTime(e.enviadaEm)}</TableCell>
                        <TableCell>
                          {e.canalEnvio ? (
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">{e.canalEnvio}</span>
                          ) : <span className="text-xs text-gray-400">—</span>}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{e.numeroProtocoloConcessionaria || '—'}</TableCell>
                        <TableCell><ContadorCooperados counts={e.counts} /></TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 mt-4 text-sm">
              <Button size="sm" variant="outline" disabled={pageEnvios <= 1} onClick={() => setPageEnvios((p) => p - 1)}>Anterior</Button>
              <span className="text-gray-500">Página {pageEnvios} de {totalPages}</span>
              <Button size="sm" variant="outline" disabled={pageEnvios >= totalPages} onClick={() => setPageEnvios((p) => p + 1)}>Próxima</Button>
            </div>
          )}
        </>
      )}

    </div>
  );
}
