'use client';

/**
 * D-FISCAL-2.5 (02/06/2026) — Lente fiscal READ-ONLY sobre os ContratoConvenio
 * legados (CRUD real em /dashboard/convenios).
 *
 * Substitui o antigo CRUD do model `Convenio` (CT.2/CT.6 — modelo separado que
 * ficou redundante após D-FISCAL-2 consolidar a classificação fiscal no
 * legado ContratoConvenio + flag `geraLancamentoContabil`).
 *
 * Esta tela:
 *   - NÃO cria, NÃO edita, NÃO remove.
 *   - Mostra a classificação fiscal (natureza, fluxo, gera lançamento, pagador)
 *     de cada ContratoConvenio do tenant.
 *   - Botão por linha redireciona pro CRUD real (/dashboard/convenios/[id]/editar).
 *   - Filtros: natureza fiscal + geraLancamentoContabil + pagador.
 *
 * O ConveniosCtController foi DEPRECATED (1 sprint) e será removido. O endpoint
 * de movimentos contábeis ATIVO continua em /convenios/:id/movimentos-contabeis
 * (D-FISCAL-2.2 + roteamento 2.4.4c) — esse é do legado e NÃO sai do ar.
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { FileCheck, Pencil, ExternalLink, Eye } from 'lucide-react';

type ContratoConvenioLente = {
  id: string;
  numero: string;
  empresaNome: string;
  tipo: string;
  status: string;
  pagador: string | null;
  naturezaAtoCooperativo: string | null;
  fluxoFinanceiro: string | null;
  geraLancamentoContabil: boolean;
  membrosAtivosCache: number;
};

const NATUREZA_LABEL: Record<string, string> = {
  PROPRIO: 'PRÓPRIO (Art. 79)',
  AUXILIAR: 'AUXILIAR (Art. 88)',
  NAO_COOPERATIVO: 'NÃO-COOP (Art. 86)',
};
const NATUREZA_COLOR: Record<string, string> = {
  PROPRIO: 'bg-emerald-50 text-emerald-800 border-emerald-300',
  AUXILIAR: 'bg-cyan-50 text-cyan-800 border-cyan-300',
  NAO_COOPERATIVO: 'bg-amber-50 text-amber-800 border-amber-300',
};
const FLUXO_LABEL: Record<string, string> = {
  INGRESSO_CUSTEIO_AUXILIAR: 'Ingresso (custeio)',
  REPASSE_PROVEDOR_EXTERNO: 'Repasse (saída)',
  CUSTO_OPERACIONAL_INTERNO: 'Custo interno',
};
const PAGADOR_LABEL: Record<string, string> = {
  CADA_MEMBRO: 'Cada membro',
  EMPRESA: 'Empresa (Caso 1)',
};

export default function LenteFiscalConveniosPage() {
  const [convenios, setConvenios] = useState<ContratoConvenioLente[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');

  // Filtros
  const [filtroNatureza, setFiltroNatureza] = useState<string>('todos');
  const [filtroGeraLanc, setFiltroGeraLanc] = useState<string>('todos');
  const [filtroPagador, setFiltroPagador] = useState<string>('todos');

  async function carregar() {
    setLoading(true);
    setErro('');
    try {
      // GET /convenios retorna { data, total } do ContratoConvenio legado
      const { data } = await api.get('/convenios', { params: { limit: 200 } });
      setConvenios(data.data ?? []);
    } catch (err: any) {
      setErro(err?.response?.data?.message || 'Falha ao carregar convênios');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  const filtrados = useMemo(() => {
    return convenios.filter((c) => {
      if (filtroNatureza !== 'todos') {
        if (filtroNatureza === 'sem_classificacao') {
          if (c.naturezaAtoCooperativo) return false;
        } else if (c.naturezaAtoCooperativo !== filtroNatureza) {
          return false;
        }
      }
      if (filtroGeraLanc !== 'todos') {
        const target = filtroGeraLanc === 'sim';
        if (c.geraLancamentoContabil !== target) return false;
      }
      if (filtroPagador !== 'todos') {
        if ((c.pagador ?? 'CADA_MEMBRO') !== filtroPagador) return false;
      }
      return true;
    });
  }, [convenios, filtroNatureza, filtroGeraLanc, filtroPagador]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <FileCheck className="h-6 w-6 text-cyan-700" />
            Convênios — Lente Fiscal
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Classificação fiscal (Art. 79/86/88 Lei 5.764/71) dos convênios ativos do tenant
          </p>
        </div>
        <Link href="/dashboard/convenios">
          <Button variant="outline" className="border-cyan-300 text-cyan-700 hover:bg-cyan-50">
            <ExternalLink className="h-4 w-4 mr-1.5" />
            Ir pro CRUD de Convênios
          </Button>
        </Link>
      </div>

      {/* Banner read-only */}
      <div className="bg-amber-50 border-l-4 border-amber-400 p-4 rounded text-sm text-amber-900">
        <p className="font-semibold mb-1">Lente fiscal read-only</p>
        <p>
          Esta tela <strong>não</strong> cria, edita ou remove convênios. Use o menu principal{' '}
          <Link href="/dashboard/convenios" className="underline font-medium">
            Convênios
          </Link>{' '}
          pra criar/editar/remover — a classificação fiscal é configurada no bloco{' '}
          <em>Classificação fiscal</em> da página de edição.
        </p>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">
                Natureza fiscal
              </label>
              <select
                value={filtroNatureza}
                onChange={(e) => setFiltroNatureza(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              >
                <option value="todos">Todos</option>
                <option value="PROPRIO">PRÓPRIO (Art. 79)</option>
                <option value="AUXILIAR">AUXILIAR (Art. 88)</option>
                <option value="NAO_COOPERATIVO">NÃO-COOP (Art. 86)</option>
                <option value="sem_classificacao">Sem classificação</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">
                Gera lançamento contábil?
              </label>
              <select
                value={filtroGeraLanc}
                onChange={(e) => setFiltroGeraLanc(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              >
                <option value="todos">Todos</option>
                <option value="sim">Sim</option>
                <option value="nao">Não</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Pagador</label>
              <select
                value={filtroPagador}
                onChange={(e) => setFiltroPagador(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              >
                <option value="todos">Todos</option>
                <option value="CADA_MEMBRO">Cada membro</option>
                <option value="EMPRESA">Empresa (Caso 1 custeio)</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      {erro && (
        <div className="bg-red-50 border-l-4 border-red-500 p-3 text-sm text-red-700 rounded">
          {erro}
        </div>
      )}

      {loading ? (
        <p className="text-center text-sm text-gray-500 py-8">Carregando…</p>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {filtrados.length} convênio(s){' '}
              {filtrados.length !== convenios.length && (
                <span className="text-gray-400 font-normal text-xs">
                  ({convenios.length} no total — filtrados {convenios.length - filtrados.length})
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filtrados.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">
                Nenhum convênio bate com os filtros.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Pagador</TableHead>
                    <TableHead>Natureza ato coop</TableHead>
                    <TableHead>Fluxo financeiro</TableHead>
                    <TableHead className="text-center">Gera lançamento?</TableHead>
                    <TableHead className="text-center">Membros</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtrados.map((c) => (
                    <TableRow key={c.id} className="hover:bg-gray-50">
                      <TableCell>
                        <div className="font-medium">{c.empresaNome}</div>
                        <div className="text-xs text-gray-500 font-mono">{c.numero}</div>
                      </TableCell>
                      <TableCell className="text-xs">{c.tipo}</TableCell>
                      <TableCell className="text-xs">
                        {PAGADOR_LABEL[c.pagador ?? 'CADA_MEMBRO'] ?? c.pagador ?? '—'}
                      </TableCell>
                      <TableCell>
                        {c.naturezaAtoCooperativo ? (
                          <Badge
                            variant="outline"
                            className={
                              NATUREZA_COLOR[c.naturezaAtoCooperativo] ??
                              'bg-gray-50 text-gray-700 border-gray-300'
                            }
                          >
                            {NATUREZA_LABEL[c.naturezaAtoCooperativo] ?? c.naturezaAtoCooperativo}
                          </Badge>
                        ) : (
                          <span className="text-xs text-gray-400 italic">não classificado</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {c.fluxoFinanceiro ? FLUXO_LABEL[c.fluxoFinanceiro] ?? c.fluxoFinanceiro : '—'}
                      </TableCell>
                      <TableCell className="text-center">
                        {c.geraLancamentoContabil ? (
                          <Badge className="bg-emerald-100 text-emerald-800">Sim</Badge>
                        ) : (
                          <Badge variant="outline" className="bg-gray-50 text-gray-500">
                            Não
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center text-xs">{c.membrosAtivosCache}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            c.status === 'ATIVO'
                              ? 'bg-green-50 text-green-800 border-green-300'
                              : 'bg-gray-50 text-gray-600 border-gray-300'
                          }
                        >
                          {c.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Link href={`/dashboard/convenios/${c.id}`}>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-gray-700 hover:bg-gray-100"
                              title="Ver detalhe"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                          <Link href={`/dashboard/convenios/${c.id}/editar`}>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-cyan-700 hover:bg-cyan-50"
                              title="Editar no CRUD"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </Link>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
