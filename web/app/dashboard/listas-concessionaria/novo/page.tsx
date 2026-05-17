'use client';

import { useEffect, useState, useMemo, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, Loader2, AlertTriangle } from 'lucide-react';

interface CooperadoElegivel {
  cooperadoId: string;
  contratoId: string;
  nome: string;
  cpf: string;
  ucNumero: string;
  kwhContrato: number;
  percentualUsina: number;
  statusContrato: string;
  jaEnviado: boolean;
  ultimoEnvioStatus: string | null;
  ultimoEnvioNumero: string | null;
  ultimoEnvioId: string | null;
  homologado: boolean;
}

interface UsinaInfo {
  id: string;
  nome: string;
  apelidoInterno: string | null;
  capacidadeKwh: number;
}

function NovoEnvioContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const usinaId = searchParams?.get('usinaId') ?? '';

  const [carregando, setCarregando] = useState(true);
  const [criando, setCriando] = useState(false);
  const [usina, setUsina] = useState<UsinaInfo | null>(null);
  const [elegiveis, setElegiveis] = useState<CooperadoElegivel[]>([]);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [erro, setErro] = useState('');
  const [filtroNaoEnviados, setFiltroNaoEnviados] = useState(false);
  const [filtroPendentes, setFiltroPendentes] = useState(false);

  const recarregar = useCallback(async () => {
    if (!usinaId) {
      setErro('usinaId não informado na URL.');
      setCarregando(false);
      return;
    }
    setCarregando(true);
    setErro('');
    try {
      const { data } = await api.get('/envios-lista/cooperados-elegiveis', { params: { usinaId } });
      setUsina(data.usina);
      setElegiveis(data.cooperados || []);
    } catch (e: any) {
      setErro(e?.response?.data?.message || 'Erro ao carregar cooperados elegíveis.');
    } finally {
      setCarregando(false);
    }
  }, [usinaId]);

  useEffect(() => { recarregar(); }, [recarregar]);

  const visiveis = useMemo(() => {
    return elegiveis.filter((c) => {
      if (filtroNaoEnviados && c.jaEnviado) return false;
      if (filtroPendentes && c.statusContrato !== 'PENDENTE_ATIVACAO') return false;
      return true;
    });
  }, [elegiveis, filtroNaoEnviados, filtroPendentes]);

  const visiveisIds = useMemo(() => new Set(visiveis.map((c) => c.cooperadoId)), [visiveis]);
  const headerCheckState = useMemo(() => {
    const selecionadosVisiveis = visiveis.filter((c) => selecionados.has(c.cooperadoId)).length;
    if (selecionadosVisiveis === 0) return 'none' as const;
    if (selecionadosVisiveis === visiveis.length) return 'all' as const;
    return 'some' as const;
  }, [visiveis, selecionados]);

  function toggleTodos() {
    const novo = new Set(selecionados);
    if (headerCheckState === 'all') {
      for (const id of visiveisIds) novo.delete(id);
    } else {
      for (const id of visiveisIds) novo.add(id);
    }
    setSelecionados(novo);
  }

  function toggle(id: string) {
    const novo = new Set(selecionados);
    if (novo.has(id)) novo.delete(id);
    else novo.add(id);
    setSelecionados(novo);
  }

  async function criar() {
    if (selecionados.size === 0) return;
    setCriando(true);
    setErro('');
    try {
      const { data } = await api.post('/envios-lista', {
        usinaId,
        cooperadoIds: Array.from(selecionados),
      });
      router.push(`/dashboard/listas-concessionaria/${data.id}`);
    } catch (e: any) {
      setErro(e?.response?.data?.message || 'Erro ao criar rascunho.');
      setCriando(false);
    }
  }

  return (
    <div className="pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <Link href="/dashboard/usinas/listas">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />Voltar
          </Button>
        </Link>
        <h2 className="text-2xl font-bold text-gray-800">Novo envio para concessionária</h2>
      </div>

      {usina && (
        <div className="text-sm text-gray-600 mb-6 flex flex-wrap gap-x-4 gap-y-1">
          <span className="font-medium">{usina.nome}</span>
          {usina.apelidoInterno && <span className="text-gray-500">· apelido: <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{usina.apelidoInterno}</code></span>}
          <span className="text-gray-500">· capacidade: {usina.capacidadeKwh.toLocaleString('pt-BR')} kWh</span>
        </div>
      )}

      {erro && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded p-3 flex items-start gap-2 mb-4">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{erro}</span>
        </div>
      )}

      {/* Filtros */}
      <Card className="mb-4">
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-6 text-sm text-gray-700">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={filtroNaoEnviados} onChange={(e) => setFiltroNaoEnviados(e.target.checked)} />
              Apenas não-enviados ainda
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={filtroPendentes} onChange={(e) => setFiltroPendentes(e.target.checked)} />
              Apenas Pendentes (PENDENTE_ATIVACAO)
            </label>
            <Button size="sm" variant="outline" onClick={recarregar} disabled={carregando} className="ml-auto">
              {carregando && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Atualizar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabela elegíveis */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cooperados elegíveis</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={headerCheckState === 'all'}
                    onCheckedChange={toggleTodos}
                    aria-label="Selecionar todos visíveis"
                    className={headerCheckState === 'some' ? 'opacity-70' : ''}
                  />
                </TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>UC</TableHead>
                <TableHead>kWh contratado</TableHead>
                <TableHead>% Usina</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Último envio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {carregando ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-gray-400">
                    <Loader2 className="h-4 w-4 animate-spin inline mr-2" />Carregando elegíveis...
                  </TableCell>
                </TableRow>
              ) : visiveis.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-gray-400">
                    {elegiveis.length === 0
                      ? 'Nenhum cooperado elegível para esta usina.'
                      : 'Nenhum cooperado corresponde aos filtros atuais.'}
                  </TableCell>
                </TableRow>
              ) : (
                visiveis.map((c) => (
                  <TableRow key={c.cooperadoId} className={selecionados.has(c.cooperadoId) ? 'bg-blue-50' : ''}>
                    <TableCell>
                      <Checkbox
                        checked={selecionados.has(c.cooperadoId)}
                        onCheckedChange={() => toggle(c.cooperadoId)}
                        aria-label={`Selecionar ${c.nome}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{c.nome}</TableCell>
                    <TableCell>{c.ucNumero || '—'}</TableCell>
                    <TableCell>{c.kwhContrato.toLocaleString('pt-BR')}</TableCell>
                    <TableCell>{c.percentualUsina.toFixed(2)}%</TableCell>
                    <TableCell>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${c.statusContrato === 'ATIVO' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                        {c.statusContrato === 'ATIVO' ? 'Ativo' : 'Pend. Ativação'}
                      </span>
                    </TableCell>
                    <TableCell>
                      {c.jaEnviado && c.ultimoEnvioId ? (
                        <Link
                          href={`/dashboard/listas-concessionaria/${c.ultimoEnvioId}`}
                          className="text-[11px] text-blue-600 hover:underline"
                          title={`Status individual: ${c.ultimoEnvioStatus}`}
                        >
                          {c.ultimoEnvioNumero} <span className="text-gray-400">({c.ultimoEnvioStatus})</span>
                        </Link>
                      ) : (
                        <span className="text-[11px] text-gray-400">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Footer fixo */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-md py-3 px-6 z-30 flex items-center justify-between">
        <span className="text-sm text-gray-600">
          <strong>{selecionados.size}</strong> selecionado{selecionados.size === 1 ? '' : 's'}
          <span className="text-gray-400"> / {visiveis.length} visíve{visiveis.length === 1 ? 'l' : 'is'} ({elegiveis.length} total elegível)</span>
        </span>
        <div className="flex gap-2">
          <Link href="/dashboard/usinas/listas">
            <Button variant="outline" disabled={criando}>Cancelar</Button>
          </Link>
          <Button onClick={criar} disabled={criando || selecionados.size === 0}>
            {criando && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Criar rascunho{selecionados.size > 0 ? ` (${selecionados.size})` : ''}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function NovoEnvioPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>}>
      <NovoEnvioContent />
    </Suspense>
  );
}
