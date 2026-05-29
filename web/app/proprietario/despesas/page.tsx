'use client';

/**
 * D-novo-BH BH.4 (M37, 29/05/2026) — Portal proprietário, lista despesas.
 *
 * Consome GET /contas-pagar/proprietario (BH.2, respeita flag visibilidade).
 * Workflow: proprietário propõe (PROPOSTA) → admin aprova/rejeita → admin resolve.
 *
 * Sem ações (read-only proprietário). Botão "+ Propor despesa" → /nova.
 */

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Plus, Receipt, Info, Clock, CheckCircle, XCircle, AlertCircle, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TabsCustom, TabContent } from '@/components/ui/tabs-custom';
import api from '@/lib/api';

interface Despesa {
  id: string;
  descricao: string;
  categoria: string;
  valor: number | string;
  dataOcorrencia: string | null;
  dataVencimento: string;
  tratamento: string | null;
  quemPagouTipo: string | null;
  quemPagouNome: string | null;
  statusAprovacao: 'PROPOSTA' | 'APROVADA' | 'REJEITADA';
  statusResolucao: 'PENDENTE' | 'RESOLVIDA';
  aprovadoEm: string | null;
  resolvidoEm: string | null;
  rejeitadoMotivo: string | null;
  comprovante: string | null;
  propostoPor?: { id: string; nome: string };
  aprovadoPor?: { id: string; nome: string };
  usina?: { id: string; nome: string; apelidoInterno: string | null };
}

const TRATAMENTO_COR: Record<string, string> = {
  REEMBOLSO: 'bg-yellow-100 text-yellow-800',
  DESCONTO_NO_REPASSE: 'bg-blue-100 text-blue-800',
  ASSUMIDO: 'bg-gray-100 text-gray-700',
};

function fmtMoney(v: number | string): string {
  const n = typeof v === 'number' ? v : Number(v);
  return `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(s: string | null): string {
  if (!s) return '—';
  try {
    return new Date(s).toLocaleDateString('pt-BR');
  } catch {
    return '—';
  }
}

export default function ProprietarioDespesasPage() {
  const router = useRouter();
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [flagAtiva, setFlagAtiva] = useState<boolean | null>(null);
  const [tab, setTab] = useState<'propostas' | 'aprovadas' | 'rejeitadas'>('aprovadas');

  useEffect(() => {
    Promise.all([
      api.get<Despesa[]>('/contas-pagar/proprietario'),
      api.get<{ proprietarioVeDespesas: boolean }>('/proprietario/meu-parceiro').catch(() => null),
    ])
      .then(([r, conf]) => {
        setDespesas(r.data ?? []);
        if (conf) setFlagAtiva(conf.data.proprietarioVeDespesas);
      })
      .catch(() => setDespesas([]))
      .finally(() => setCarregando(false));
  }, []);

  const propostas = useMemo(() => despesas.filter((d) => d.statusAprovacao === 'PROPOSTA'), [despesas]);
  const aprovadas = useMemo(() => despesas.filter((d) => d.statusAprovacao === 'APROVADA'), [despesas]);
  const rejeitadas = useMemo(() => despesas.filter((d) => d.statusAprovacao === 'REJEITADA'), [despesas]);

  function sumValor(list: Despesa[]): number {
    return list.reduce((s, d) => s + Number(d.valor), 0);
  }

  const resolvidasMes = useMemo(() => {
    const now = new Date();
    return aprovadas.filter((d) => {
      if (!d.resolvidoEm) return false;
      const r = new Date(d.resolvidoEm);
      return r.getMonth() === now.getMonth() && r.getFullYear() === now.getFullYear();
    });
  }, [aprovadas]);

  // Empty state quando flag=false
  if (!carregando && flagAtiva === false) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Despesas operacionais</h1>
        </div>
        <Card>
          <CardContent className="text-center py-12">
            <Receipt className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-700 font-medium">Visualização de despesas não habilitada pelo parceiro.</p>
            <p className="text-gray-500 text-sm mt-2 max-w-md mx-auto">
              Entre em contato com o admin da cooperativa pra ativar esta funcionalidade.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Minhas despesas operacionais</h1>
          <p className="text-sm text-gray-500 mt-1">
            Acompanhamento + propostas pra aprovação do admin do parceiro
          </p>
        </div>
        <Button onClick={() => router.push('/proprietario/despesas/nova')} className="bg-amber-600 hover:bg-amber-700">
          <Plus className="w-4 h-4 mr-1" />
          Propor despesa
        </Button>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-md p-3 flex gap-2">
        <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <strong>Workflow:</strong> você propõe → admin do parceiro aprova ou rejeita → admin marca como
          resolvida quando o tratamento contratual (reembolso, desconto, etc) for concluído. Despesas com
          tratamento <strong>DESCONTO_NO_REPASSE</strong> serão abatidas no seu próximo repasse mensal.
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiCard
          ativo={tab === 'propostas'}
          onClick={() => setTab('propostas')}
          icon={<Clock className="w-4 h-4 text-yellow-600" />}
          label="Minhas propostas pendentes"
          quantidade={propostas.length}
          total={fmtMoney(sumValor(propostas))}
        />
        <KpiCard
          ativo={tab === 'aprovadas'}
          onClick={() => setTab('aprovadas')}
          icon={<CheckCircle className="w-4 h-4 text-green-600" />}
          label="Aprovadas"
          quantidade={aprovadas.length}
          total={fmtMoney(sumValor(aprovadas))}
        />
        <KpiCard
          ativo={tab === 'rejeitadas'}
          onClick={() => setTab('rejeitadas')}
          icon={<XCircle className="w-4 h-4 text-red-600" />}
          label="Rejeitadas"
          quantidade={rejeitadas.length}
          total={fmtMoney(sumValor(rejeitadas))}
        />
      </div>
      <p className="text-xs text-gray-500">
        Resolvidas no mês atual: <strong>{resolvidasMes.length}</strong> ({fmtMoney(sumValor(resolvidasMes))})
      </p>

      <TabsCustom
        tabs={[
          { value: 'propostas', label: 'Minhas propostas', badge: propostas.length > 0 ? String(propostas.length) : undefined },
          { value: 'aprovadas', label: 'Aprovadas', badge: aprovadas.length > 0 ? String(aprovadas.length) : undefined },
          { value: 'rejeitadas', label: 'Rejeitadas' },
        ]}
        activeValue={tab}
        onChange={(v) => setTab(v as typeof tab)}
      >
        <TabContent value="propostas">
          <Lista carregando={carregando} lista={propostas} emptyText="Nenhuma proposta aguardando aprovação." />
        </TabContent>
        <TabContent value="aprovadas">
          <Lista carregando={carregando} lista={aprovadas} emptyText="Nenhuma despesa aprovada ainda." />
        </TabContent>
        <TabContent value="rejeitadas">
          <Lista carregando={carregando} lista={rejeitadas} emptyText="Nenhuma proposta rejeitada." mostrarMotivo />
        </TabContent>
      </TabsCustom>
    </div>
  );
}

function KpiCard({
  ativo, onClick, icon, label, quantidade, total,
}: {
  ativo: boolean; onClick: () => void; icon: React.ReactNode; label: string; quantidade: number; total: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-left rounded-md border p-3 transition-all ${
        ativo ? 'border-amber-500 bg-amber-50 shadow-sm' : 'border-gray-200 bg-white hover:border-amber-300 hover:bg-amber-50/30'
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <p className="text-xs text-gray-500">{label}</p>
      </div>
      <p className="text-xl font-bold text-gray-800">{quantidade}</p>
      <p className="text-xs text-gray-500">{total}</p>
    </button>
  );
}

function Lista({
  carregando, lista, emptyText, mostrarMotivo,
}: { carregando: boolean; lista: Despesa[]; emptyText: string; mostrarMotivo?: boolean }) {
  if (carregando) {
    return (
      <Card>
        <CardContent className="py-6 space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-6 w-full" />)}
        </CardContent>
      </Card>
    );
  }
  if (lista.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-12 text-gray-500 text-sm">{emptyText}</CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="overflow-x-auto">
          <Table className="min-w-[750px]">
            <TableHeader>
              <TableRow>
                <TableHead>Data ocorrência</TableHead>
                <TableHead>Usina</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Tratamento</TableHead>
                <TableHead>Comprovante</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lista.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="text-xs">{fmtDate(d.dataOcorrencia)}</TableCell>
                  <TableCell className="text-xs">{d.usina?.nome ?? '—'}</TableCell>
                  <TableCell>
                    <p className="text-sm">{d.categoria.replace(/_/g, ' ')}</p>
                    <p className="text-[10px] text-gray-500 truncate max-w-[200px]" title={d.descricao}>
                      {d.descricao}
                    </p>
                  </TableCell>
                  <TableCell className="text-right font-semibold">{fmtMoney(d.valor)}</TableCell>
                  <TableCell>
                    {d.tratamento && (
                      <Badge className={`text-[10px] ${TRATAMENTO_COR[d.tratamento] ?? 'bg-gray-100'}`}>
                        {d.tratamento.replace(/_/g, ' ')}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {d.comprovante ? (
                      <a href={d.comprovante} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs hover:underline">
                        {d.comprovante.startsWith('/uploads/')
                          ? <Badge className="bg-green-100 text-green-700 text-[10px]">📎</Badge>
                          : <Badge className="bg-blue-100 text-blue-700 text-[10px]">🔗</Badge>}
                      </a>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {d.statusAprovacao === 'PROPOSTA' && (
                      <Badge className="bg-yellow-100 text-yellow-700 text-[10px]">aguardando aprovação</Badge>
                    )}
                    {d.statusAprovacao === 'APROVADA' && d.statusResolucao === 'PENDENTE' && (
                      <Badge className="bg-blue-100 text-blue-700 text-[10px]">aprovada (pendente)</Badge>
                    )}
                    {d.statusAprovacao === 'APROVADA' && d.statusResolucao === 'RESOLVIDA' && (
                      <Badge className="bg-green-100 text-green-700 text-[10px]">resolvida</Badge>
                    )}
                    {d.statusAprovacao === 'REJEITADA' && (
                      <div className="text-right">
                        <Badge className="bg-red-100 text-red-700 text-[10px]">rejeitada</Badge>
                        {mostrarMotivo && d.rejeitadoMotivo && (
                          <p className="text-[10px] text-gray-500 mt-1 max-w-[150px]" title={d.rejeitadoMotivo}>
                            {d.rejeitadoMotivo}
                          </p>
                        )}
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
