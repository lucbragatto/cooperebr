'use client';

/**
 * D-novo-BH BH.3 (M37, 29/05/2026) — Tela admin de despesas operacionais.
 *
 * Padrão UX Dual 17/05 Tipo B: atributo de entidade inteira (despesas
 * operacionais da usina) → página própria.
 *
 * 4 tabs filtradas por status workflow + KPIs topo clicáveis + Dialog
 * lançamento direto (admin) + ações inline (aprovar/rejeitar/resolver).
 */

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Info,
  Plus,
  Loader2,
  Check,
  X,
  ExternalLink,
  AlertTriangle,
  Mail,
  Clock,
  CheckCircle,
  XCircle,
  Bell,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
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
import { DialogLancarDespesa, CATEGORIAS } from '@/components/despesas/DialogLancarDespesa';
import api from '@/lib/api';

interface Despesa {
  id: string;
  dataOcorrencia: string | null;
  categoria: string;
  valor: number | string;
  descricao: string;
  quemPagouTipo: string | null;
  quemPagouNome: string | null;
  tratamento: string | null;
  comprovante: string | null;
  statusAprovacao: 'PROPOSTA' | 'APROVADA' | 'REJEITADA';
  statusResolucao: 'PENDENTE' | 'RESOLVIDA';
  aprovadoEm: string | null;
  resolvidoEm: string | null;
  rejeitadoMotivo: string | null;
  createdAt: string;
  usina?: { id: string; nome: string };
  propostoPor?: { id: string; nome: string };
  aprovadoPor?: { id: string; nome: string };
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

function labelCategoria(cat: string): string {
  return cat.replace(/_/g, ' ');
}

export default function UsinaDespesasPage() {
  const params = useParams();
  const router = useRouter();
  const usinaId = params?.id as string;

  const [usina, setUsina] = useState<{ nome: string; apelidoInterno: string | null } | null>(null);
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [tab, setTab] = useState<'pendentes' | 'ativas' | 'resolvidas' | 'rejeitadas'>('pendentes');

  const [filtroAvancado, setFiltroAvancado] = useState(false);
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [filtroTratamento, setFiltroTratamento] = useState('');
  const [filtroDataInicio, setFiltroDataInicio] = useState('');
  const [filtroDataFim, setFiltroDataFim] = useState('');

  const [bannerHelpFechado, setBannerHelpFechado] = useState(false);
  const [acaoErro, setAcaoErro] = useState('');

  // Dialogs aprovar/rejeitar/resolver
  const [despesaAprovar, setDespesaAprovar] = useState<Despesa | null>(null);
  const [despesaRejeitar, setDespesaRejeitar] = useState<Despesa | null>(null);
  const [despesaResolver, setDespesaResolver] = useState<Despesa | null>(null);
  const [motivoRejeicao, setMotivoRejeicao] = useState('');
  const [observacaoResolucao, setObservacaoResolucao] = useState('');
  const [acaoSalvando, setAcaoSalvando] = useState(false);

  useEffect(() => {
    const hide = typeof window !== 'undefined' ? localStorage.getItem('bh3_banner_hidden') : null;
    if (hide === '1') setBannerHelpFechado(true);
  }, []);

  function fecharBannerHelp() {
    setBannerHelpFechado(true);
    if (typeof window !== 'undefined') localStorage.setItem('bh3_banner_hidden', '1');
  }

  async function carregar() {
    if (!usinaId) return;
    setCarregando(true);
    try {
      const params: Record<string, string> = { usinaId };
      if (filtroCategoria) params.categoria = filtroCategoria;
      if (filtroTratamento) params.tratamento = filtroTratamento;
      if (filtroDataInicio) params.dataInicio = filtroDataInicio;
      if (filtroDataFim) params.dataFim = filtroDataFim;
      const qs = new URLSearchParams(params).toString();

      const [rD, rU] = await Promise.all([
        api.get<Despesa[]>(`/contas-pagar/operacionais?${qs}`),
        usina ? Promise.resolve(null) : api.get<{ nome: string; apelidoInterno: string | null }>(`/usinas/${usinaId}`),
      ]);
      setDespesas(rD.data);
      if (rU) setUsina({ nome: rU.data.nome, apelidoInterno: rU.data.apelidoInterno });
    } catch (e: any) {
      setAcaoErro(e?.response?.data?.message ?? 'Erro ao carregar despesas.');
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    if (!usinaId) return;
    carregar();
  }, [usinaId, filtroCategoria, filtroTratamento, filtroDataInicio, filtroDataFim]);

  // ─── Filtragem por tab ───────────────────────────────────────────

  const pendentes = useMemo(() => despesas.filter((d) => d.statusAprovacao === 'PROPOSTA'), [despesas]);
  const ativas = useMemo(
    () => despesas.filter((d) => d.statusAprovacao === 'APROVADA' && d.statusResolucao === 'PENDENTE'),
    [despesas],
  );
  const resolvidas = useMemo(() => despesas.filter((d) => d.statusResolucao === 'RESOLVIDA'), [despesas]);
  const rejeitadas = useMemo(() => despesas.filter((d) => d.statusAprovacao === 'REJEITADA'), [despesas]);

  function sumValor(list: Despesa[]): number {
    return list.reduce((s, d) => s + Number(d.valor), 0);
  }

  // Para tab "Resolvidas no mês": filtra resolvidoEm no mês atual
  const resolvidasMes = useMemo(() => {
    const now = new Date();
    return resolvidas.filter((d) => {
      if (!d.resolvidoEm) return false;
      const r = new Date(d.resolvidoEm);
      return r.getMonth() === now.getMonth() && r.getFullYear() === now.getFullYear();
    });
  }, [resolvidas]);

  // Rejeitadas últimos 30d
  const rejeitadas30d = useMemo(() => {
    const limite = new Date();
    limite.setDate(limite.getDate() - 30);
    return rejeitadas.filter((d) => d.aprovadoEm && new Date(d.aprovadoEm) >= limite);
  }, [rejeitadas]);

  const tabsListagem: Record<typeof tab, Despesa[]> = {
    pendentes,
    ativas,
    resolvidas,
    rejeitadas,
  };

  // ─── Ações inline ────────────────────────────────────────────────

  async function aprovar() {
    if (!despesaAprovar) return;
    setAcaoSalvando(true);
    setAcaoErro('');
    try {
      await api.put(`/contas-pagar/${despesaAprovar.id}/aprovar`, {});
      setDespesaAprovar(null);
      await carregar();
    } catch (e: any) {
      setAcaoErro(e?.response?.data?.message ?? 'Erro ao aprovar.');
    } finally {
      setAcaoSalvando(false);
    }
  }

  async function rejeitar() {
    if (!despesaRejeitar) return;
    if (motivoRejeicao.trim().length < 5) {
      setAcaoErro('Motivo deve ter ao menos 5 caracteres.');
      return;
    }
    setAcaoSalvando(true);
    setAcaoErro('');
    try {
      await api.put(`/contas-pagar/${despesaRejeitar.id}/rejeitar`, { motivo: motivoRejeicao.trim() });
      setDespesaRejeitar(null);
      setMotivoRejeicao('');
      await carregar();
    } catch (e: any) {
      setAcaoErro(e?.response?.data?.message ?? 'Erro ao rejeitar.');
    } finally {
      setAcaoSalvando(false);
    }
  }

  async function resolver() {
    if (!despesaResolver) return;
    setAcaoSalvando(true);
    setAcaoErro('');
    try {
      const body = observacaoResolucao.trim() ? { observacao: observacaoResolucao.trim() } : {};
      await api.put(`/contas-pagar/${despesaResolver.id}/resolver`, body);
      setDespesaResolver(null);
      setObservacaoResolucao('');
      await carregar();
    } catch (e: any) {
      setAcaoErro(e?.response?.data?.message ?? 'Erro ao resolver.');
    } finally {
      setAcaoSalvando(false);
    }
  }

  // ─── Render ──────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/dashboard/usinas/${usinaId}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Voltar
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-800">
            Despesas operacionais{usina?.nome ? ` — ${usina.nome}` : ''}
          </h1>
          {usina?.apelidoInterno && (
            <p className="text-xs text-gray-500 mt-0.5">apelido: {usina.apelidoInterno}</p>
          )}
        </div>
        <DialogLancarDespesa
          usinaId={usinaId}
          modo="admin-lancar"
          onSuccess={carregar}
          triggerNode={
            <Button className="bg-amber-600 hover:bg-amber-700">
              <Plus className="w-4 h-4 mr-1" />
              Lançar despesa
            </Button>
          }
        />
      </div>

      {/* Banner help dispensável */}
      {!bannerHelpFechado && (
        <div className="bg-blue-50 border border-blue-200 rounded-md p-3 flex gap-2 items-start">
          <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800 flex-1">
            <strong>Despesas operacionais</strong> registram eventos reais (troca de inversor, manutenção,
            vandalismo, IPTU...). O proprietário pode propor despesas pelo portal dele — você aprova ou rejeita
            aqui. Despesas APROVADAS com tratamento <strong>DESCONTO_NO_REPASSE</strong> serão abatidas no
            próximo repasse mensal (BH.5).
          </div>
          <button onClick={fecharBannerHelp} className="text-blue-600 hover:text-blue-800 shrink-0" aria-label="Fechar">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {acaoErro && (
        <div className="bg-red-50 border border-red-200 rounded-md p-2 text-sm text-red-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          {acaoErro}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          ativo={tab === 'pendentes'}
          onClick={() => setTab('pendentes')}
          icon={<Clock className="w-4 h-4 text-yellow-600" />}
          label="Pendentes aprovação"
          quantidade={pendentes.length}
          total={fmtMoney(sumValor(pendentes))}
        />
        <KpiCard
          ativo={tab === 'ativas'}
          onClick={() => setTab('ativas')}
          icon={<Bell className="w-4 h-4 text-blue-600" />}
          label="Ativas"
          quantidade={ativas.length}
          total={fmtMoney(sumValor(ativas))}
        />
        <KpiCard
          ativo={tab === 'resolvidas'}
          onClick={() => setTab('resolvidas')}
          icon={<CheckCircle className="w-4 h-4 text-green-600" />}
          label="Resolvidas no mês"
          quantidade={resolvidasMes.length}
          total={fmtMoney(sumValor(resolvidasMes))}
        />
        <KpiCard
          ativo={tab === 'rejeitadas'}
          onClick={() => setTab('rejeitadas')}
          icon={<XCircle className="w-4 h-4 text-red-600" />}
          label="Rejeitadas (30d)"
          quantidade={rejeitadas30d.length}
          total={fmtMoney(sumValor(rejeitadas30d))}
        />
      </div>

      {/* Filtros avançados */}
      <Card>
        <CardHeader className="pb-2">
          <button
            onClick={() => setFiltroAvancado((v) => !v)}
            className="text-sm text-amber-700 hover:underline text-left"
          >
            {filtroAvancado ? '− Esconder filtros avançados' : '+ Filtros avançados'}
          </button>
        </CardHeader>
        {filtroAvancado && (
          <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-0">
            <div className="space-y-1">
              <Label>Categoria</Label>
              <select
                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm"
                value={filtroCategoria}
                onChange={(e) => setFiltroCategoria(e.target.value)}
              >
                <option value="">Todas</option>
                {CATEGORIAS.map((c) => (
                  <option key={c} value={c}>{labelCategoria(c)}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Tratamento</Label>
              <select
                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm"
                value={filtroTratamento}
                onChange={(e) => setFiltroTratamento(e.target.value)}
              >
                <option value="">Todos</option>
                <option value="REEMBOLSO">Reembolso</option>
                <option value="DESCONTO_NO_REPASSE">Desconto no repasse</option>
                <option value="ASSUMIDO">Assumido</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label>Data início</Label>
              <Input type="date" value={filtroDataInicio} onChange={(e) => setFiltroDataInicio(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Data fim</Label>
              <Input type="date" value={filtroDataFim} onChange={(e) => setFiltroDataFim(e.target.value)} />
            </div>
            <div className="md:col-span-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setFiltroCategoria('');
                  setFiltroTratamento('');
                  setFiltroDataInicio('');
                  setFiltroDataFim('');
                }}
              >
                Limpar filtros
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Tabs */}
      <TabsCustom
        tabs={[
          { value: 'pendentes', label: 'Pendentes aprovação', badge: pendentes.length > 0 ? String(pendentes.length) : undefined },
          { value: 'ativas', label: 'Ativas', badge: ativas.length > 0 ? String(ativas.length) : undefined },
          { value: 'resolvidas', label: 'Resolvidas' },
          { value: 'rejeitadas', label: 'Rejeitadas' },
        ]}
        activeValue={tab}
        onChange={(v) => setTab(v as typeof tab)}
      >
        <TabContent value="pendentes">
          <ListaDespesas
            carregando={carregando}
            lista={tabsListagem.pendentes}
            emptyText="Nenhuma despesa aguardando aprovação. ✓"
            modo="pendentes"
            onAprovar={(d) => setDespesaAprovar(d)}
            onRejeitar={(d) => setDespesaRejeitar(d)}
            onResolver={() => {}}
          />
        </TabContent>
        <TabContent value="ativas">
          <ListaDespesas
            carregando={carregando}
            lista={tabsListagem.ativas}
            emptyText="Nenhuma despesa ativa no momento."
            modo="ativas"
            onAprovar={() => {}}
            onRejeitar={() => {}}
            onResolver={(d) => setDespesaResolver(d)}
          />
        </TabContent>
        <TabContent value="resolvidas">
          <ListaDespesas
            carregando={carregando}
            lista={tabsListagem.resolvidas}
            emptyText="Nenhuma despesa resolvida ainda."
            modo="resolvidas"
            onAprovar={() => {}}
            onRejeitar={() => {}}
            onResolver={() => {}}
          />
        </TabContent>
        <TabContent value="rejeitadas">
          <ListaDespesas
            carregando={carregando}
            lista={tabsListagem.rejeitadas}
            emptyText="Nenhuma despesa rejeitada nos últimos 30 dias."
            modo="rejeitadas"
            onAprovar={() => {}}
            onRejeitar={() => {}}
            onResolver={() => {}}
          />
        </TabContent>
      </TabsCustom>

      {/* Dialogs ação */}
      <Dialog open={!!despesaAprovar} onOpenChange={(v) => !v && setDespesaAprovar(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Aprovar despesa</DialogTitle></DialogHeader>
          {despesaAprovar && (
            <div className="space-y-2 text-sm">
              <p><strong>Categoria:</strong> {labelCategoria(despesaAprovar.categoria)}</p>
              <p><strong>Valor:</strong> {fmtMoney(despesaAprovar.valor)}</p>
              <p><strong>Tratamento:</strong> {despesaAprovar.tratamento}</p>
              <p className="text-gray-600">{despesaAprovar.descricao}</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDespesaAprovar(null)}>Cancelar</Button>
            <Button onClick={aprovar} disabled={acaoSalvando} className="bg-green-600 hover:bg-green-700">
              {acaoSalvando ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Check className="w-4 h-4 mr-1" />}
              Confirmar aprovação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!despesaRejeitar} onOpenChange={(v) => !v && (setDespesaRejeitar(null), setMotivoRejeicao(''))}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rejeitar despesa</DialogTitle></DialogHeader>
          {despesaRejeitar && (
            <div className="space-y-3 text-sm">
              <p className="text-gray-600">
                {labelCategoria(despesaRejeitar.categoria)} — {fmtMoney(despesaRejeitar.valor)}
              </p>
              <div className="space-y-1">
                <Label htmlFor="motivoRejeicao">Motivo da rejeição *</Label>
                <textarea
                  id="motivoRejeicao"
                  className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm"
                  rows={3}
                  minLength={5}
                  maxLength={500}
                  value={motivoRejeicao}
                  onChange={(e) => setMotivoRejeicao(e.target.value)}
                  placeholder="Ex: Faltou anexar nota fiscal. Tente novamente."
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDespesaRejeitar(null); setMotivoRejeicao(''); }}>Cancelar</Button>
            <Button onClick={rejeitar} disabled={acaoSalvando} className="bg-red-600 hover:bg-red-700">
              {acaoSalvando ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <X className="w-4 h-4 mr-1" />}
              Confirmar rejeição
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!despesaResolver} onOpenChange={(v) => !v && (setDespesaResolver(null), setObservacaoResolucao(''))}>
        <DialogContent>
          <DialogHeader><DialogTitle>Marcar como resolvida</DialogTitle></DialogHeader>
          {despesaResolver && (
            <div className="space-y-3 text-sm">
              <p className="text-gray-600">
                {labelCategoria(despesaResolver.categoria)} — {fmtMoney(despesaResolver.valor)} — {despesaResolver.tratamento}
              </p>
              <div className="space-y-1">
                <Label htmlFor="observacao">Observação (opcional)</Label>
                <textarea
                  id="observacao"
                  className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm"
                  rows={3}
                  maxLength={500}
                  value={observacaoResolucao}
                  onChange={(e) => setObservacaoResolucao(e.target.value)}
                  placeholder="Ex: Reembolso pago via PIX em 29/05/2026."
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDespesaResolver(null); setObservacaoResolucao(''); }}>Cancelar</Button>
            <Button onClick={resolver} disabled={acaoSalvando} className="bg-green-600 hover:bg-green-700">
              {acaoSalvando ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CheckCircle className="w-4 h-4 mr-1" />}
              Confirmar resolução
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Sub-componentes ───────────────────────────────────────────────

function KpiCard({
  ativo,
  onClick,
  icon,
  label,
  quantidade,
  total,
}: {
  ativo: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  quantidade: number;
  total: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-left rounded-md border p-3 transition-all ${
        ativo
          ? 'border-amber-500 bg-amber-50 shadow-sm'
          : 'border-gray-200 bg-white hover:border-amber-300 hover:bg-amber-50/30'
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

function ListaDespesas({
  carregando,
  lista,
  emptyText,
  modo,
  onAprovar,
  onRejeitar,
  onResolver,
}: {
  carregando: boolean;
  lista: Despesa[];
  emptyText: string;
  modo: 'pendentes' | 'ativas' | 'resolvidas' | 'rejeitadas';
  onAprovar: (d: Despesa) => void;
  onRejeitar: (d: Despesa) => void;
  onResolver: (d: Despesa) => void;
}) {
  if (carregando) {
    return (
      <Card>
        <CardContent className="py-6 space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-6 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (lista.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-12 text-gray-500 text-sm">
          {emptyText}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="overflow-x-auto">
          <Table className="min-w-[800px]">
            <TableHeader>
              <TableRow>
                <TableHead>Data ocorrência</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Tratamento</TableHead>
                <TableHead>Quem pagou</TableHead>
                <TableHead>Proposto por</TableHead>
                <TableHead>Comprovante</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lista.map((d) => (
                <TableRow key={d.id} className="hover:bg-amber-50/30">
                  <TableCell className="text-xs">{fmtDate(d.dataOcorrencia)}</TableCell>
                  <TableCell>
                    <p className="text-sm">{d.categoria.replace(/_/g, ' ')}</p>
                    <p className="text-[10px] text-gray-500 truncate max-w-[200px]" title={d.descricao}>
                      {d.descricao}
                    </p>
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {fmtMoney(d.valor)}
                  </TableCell>
                  <TableCell>
                    {d.tratamento && (
                      <Badge className={`text-[10px] ${TRATAMENTO_COR[d.tratamento] ?? 'bg-gray-100'}`}>
                        {d.tratamento.replace(/_/g, ' ')}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">
                    {d.quemPagouTipo}
                    {d.quemPagouNome && <p className="text-[10px] text-gray-500">{d.quemPagouNome}</p>}
                  </TableCell>
                  <TableCell className="text-xs">{d.propostoPor?.nome ?? '—'}</TableCell>
                  <TableCell>
                    {d.comprovante ? (
                      <a
                        href={d.comprovante}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline inline-flex items-center gap-1 text-xs"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Ver
                      </a>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {modo === 'pendentes' && (
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="outline" onClick={() => onAprovar(d)} className="border-green-300 text-green-700 hover:bg-green-50">
                          <Check className="w-3 h-3" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => onRejeitar(d)} className="border-red-300 text-red-700 hover:bg-red-50">
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                    {modo === 'ativas' && (
                      <Button size="sm" variant="outline" onClick={() => onResolver(d)} className="border-green-300 text-green-700 hover:bg-green-50">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Resolvida
                      </Button>
                    )}
                    {modo === 'resolvidas' && (
                      <Badge className="bg-green-100 text-green-700 text-[10px]">
                        Resolvida {d.resolvidoEm ? fmtDate(d.resolvidoEm) : ''}
                      </Badge>
                    )}
                    {modo === 'rejeitadas' && (
                      <div className="text-right text-xs">
                        <Badge className="bg-red-100 text-red-700 text-[10px]">
                          Rejeitada {d.aprovadoEm ? fmtDate(d.aprovadoEm) : ''}
                        </Badge>
                        {d.rejeitadoMotivo && (
                          <p className="text-[10px] text-gray-500 mt-1 max-w-[150px] truncate" title={d.rejeitadoMotivo}>
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
