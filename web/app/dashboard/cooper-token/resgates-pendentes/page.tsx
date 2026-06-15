'use client';

/**
 * Sprint Clube P1 — F6 Bloco C.3 (13/06/2026).
 *
 * Tela do ADMIN aprovar/recusar resgates de tokens em R$ via PIX
 * solicitados por cooperados-estabelecimento (C.1).
 *
 * ═══ REFORÇO ANTI-FRAUDE (centro do C.3) ═══
 *
 * O Dialog de aprovação mostra:
 *  - valor R$ (líquido) que vai sair via PIX
 *  - chave PIX SNAPSHOT do recibo (NÃO da query — chave atual do
 *    cooperado pode ter mudado)
 *  - nome do estabelecimento
 *  - BANNER AMBER se a chave do cooperado foi alterada nas últimas 24h
 *    ANTES desta solicitação (api response `alteradaRecentemente=true`).
 *    NÃO bloqueia — só alerta o humano (fecha vetor sessão-sequestrada
 *    → redireciona-PIX → resgata).
 *
 * Lista paginada com filtros (status/valor/data). Default PENDENTE.
 *
 * Backend: GET /cooper-token/admin/resgates-pendentes +
 *          POST /cooper-token/admin/resgates/:id/aprovar
 *          POST /cooper-token/admin/resgates/:id/recusar
 */
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { HelpBox } from '@/components/ui/help-box';
import {
  Banknote,
  Check,
  X,
  AlertTriangle,
  Loader2,
  Filter,
  ChevronLeft,
  ChevronRight,
  Receipt,
  ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';

interface ResgateRecibo {
  id: string;
  numeroRecibo: string;
  status: string;
  valorBrutoTokens: string | number;
  valorBrutoReais: string | number;
  valorLiquidoReais: string | number;
  pixChave: string;
  pixTipo: string;
  observacao: string | null;
  createdAt: string;
  cooperadoEstabelecimento: {
    id: string;
    nomeCompleto: string;
    email: string;
    pixUltimaAlteracaoEm: string | null;
  };
  /** F6 C.3 — derivado pelo service: chave alterada <24h ANTES do recibo. */
  alteradaRecentemente: boolean;
}

interface ListaResponse {
  items: ResgateRecibo[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

const STATUS_OPCOES = [
  { value: 'PENDENTE_APROVACAO_COOP', label: 'Aguardando aprovação' },
  { value: 'APROVADO_PIX_DISPARADO', label: 'PIX disparado' },
  { value: 'PAGO_RECIBO_EMITIDO', label: 'Pago' },
  { value: 'RECUSADO', label: 'Recusado' },
  { value: 'CANCELADO', label: 'Cancelado' },
  { value: 'FALHA_PIX', label: 'Falha PIX' },
];

function brl(v: number | string): string {
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function num(v: number | string, casas = 4): string {
  return Number(v).toLocaleString('pt-BR', {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  });
}
function formatarData(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}
function mascarar(chave: string): string {
  if (chave.length <= 5) return '***';
  return `${chave.slice(0, 3)}***${chave.slice(-2)}`;
}

export default function ResgatesPendentesPage() {
  const [carregando, setCarregando] = useState(true);
  const [lista, setLista] = useState<ListaResponse | null>(null);

  const [statusFiltro, setStatusFiltro] = useState('PENDENTE_APROVACAO_COOP');
  const [valorMin, setValorMin] = useState('');
  const [valorMax, setValorMax] = useState('');
  const [page, setPage] = useState(1);

  const [dialog, setDialog] = useState<
    | { tipo: 'aprovar'; recibo: ResgateRecibo }
    | { tipo: 'recusar'; recibo: ResgateRecibo }
    | null
  >(null);
  const [motivoRecusa, setMotivoRecusa] = useState('');
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  async function carregar() {
    setCarregando(true);
    try {
      const params = new URLSearchParams();
      if (statusFiltro) params.set('status', statusFiltro);
      if (valorMin) params.set('valorMin', valorMin);
      if (valorMax) params.set('valorMax', valorMax);
      params.set('page', String(page));
      params.set('limit', '20');
      const r = await api.get<ListaResponse>(
        `/cooper-token/admin/resgates-pendentes?${params}`,
      );
      setLista(r.data);
    } catch (err: any) {
      setErro(err?.response?.data?.message ?? 'Erro ao carregar resgates.');
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
  }, [statusFiltro, page]);

  function aplicarFiltros() {
    setPage(1);
    carregar();
  }

  function abrirAprovar(recibo: ResgateRecibo) {
    setErro('');
    setSucesso('');
    setMotivoRecusa('');
    // alteradaRecentemente vem direto do item (derivado no service —
    // chave do REFORÇO ANTI-FRAUDE no Dialog abaixo).
    setDialog({ tipo: 'aprovar', recibo });
  }

  function abrirRecusar(recibo: ResgateRecibo) {
    setErro('');
    setSucesso('');
    setMotivoRecusa('');
    setDialog({ tipo: 'recusar', recibo });
  }

  function fecharDialog() {
    setDialog(null);
    setMotivoRecusa('');
    setErro('');
  }

  async function aprovar() {
    if (!dialog || dialog.tipo !== 'aprovar') return;
    setProcessando(true);
    setErro('');
    try {
      const r = await api.post(
        `/cooper-token/admin/resgates/${dialog.recibo.id}/aprovar`,
      );
      setSucesso(
        `Resgate ${dialog.recibo.numeroRecibo} aprovado. PIX disparado: ${r.data?.asaasTransferId ?? '(simulado)'} status=${r.data?.statusAsaas ?? 'pending'}.`,
      );
      fecharDialog();
      await carregar();
    } catch (err: any) {
      setErro(err?.response?.data?.message ?? 'Erro ao aprovar resgate.');
    } finally {
      setProcessando(false);
    }
  }

  async function recusar() {
    if (!dialog || dialog.tipo !== 'recusar') return;
    if (motivoRecusa.trim().length < 3) {
      setErro('Motivo da recusa precisa ter pelo menos 3 caracteres.');
      return;
    }
    setProcessando(true);
    setErro('');
    try {
      await api.post(
        `/cooper-token/admin/resgates/${dialog.recibo.id}/recusar`,
        { motivoRecusa: motivoRecusa.trim() },
      );
      setSucesso(
        `Resgate ${dialog.recibo.numeroRecibo} recusado. Tokens devolvidos ao saldo do estabelecimento.`,
      );
      fecharDialog();
      await carregar();
    } catch (err: any) {
      setErro(err?.response?.data?.message ?? 'Erro ao recusar resgate.');
    } finally {
      setProcessando(false);
    }
  }

  return (
    <div className="space-y-4 max-w-6xl">
      {/* Sprint Clube P1 — Fatia A v2 polish (15/06/2026): Voltar ao Clube. */}
      <Link href="/dashboard/clube" className="inline-block">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Voltar ao Clube
        </Button>
      </Link>
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Banknote className="h-6 w-6 text-green-700" /> Resgates de CooperTokens (PIX)
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Estabelecimentos do Clube solicitam liquidação de CooperTokens em R$ via PIX
        </p>
      </div>

      <HelpBox id="resgates-pendentes-help" titulo="Como aprovar com segurança">
        <p>
          Resgates aqui são <strong>liquidações</strong> de voucher (CooperToken) com{' '}
          <strong>recibo</strong> — cooperativa quita passivo que ela mesma emitiu (Art. 79
          Lei 5.764/71). NÃO é compra/recompra de moeda.
        </p>
        <p>
          Ao <strong>aprovar</strong>, o sistema dispara PIX via Asaas pra chave cadastrada
          do cooperado. Se o PIX falhar (chave inexistente, saldo Asaas, etc), tokens
          voltam automaticamente pro saldo do estabelecimento + status vira FALHA_PIX.
        </p>
        <p>
          Ao <strong>recusar</strong>, motivo é obrigatório e fica registrado no recibo +
          no extrato do cooperado.
        </p>
        <p>
          <strong>Anti-fraude:</strong> verifique se a chave PIX exibida bate com a
          informação que você tem do cooperado por outro canal. Se a chave foi alterada
          nas últimas 24h, um banner amber vai te alertar no Dialog de aprovação — não
          bloqueia, só pede atenção extra.
        </p>
      </HelpBox>

      {/* Filtros */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Filter className="h-4 w-4" /> Filtros
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div>
            <Label className="text-xs">Status</Label>
            <select
              value={statusFiltro}
              onChange={(e) => {
                setStatusFiltro(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {STATUS_OPCOES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-xs">Valor mín. (R$)</Label>
            <Input
              type="number"
              min={0}
              step={0.01}
              value={valorMin}
              onChange={(e) => setValorMin(e.target.value)}
              placeholder="0,00"
            />
          </div>
          <div>
            <Label className="text-xs">Valor máx. (R$)</Label>
            <Input
              type="number"
              min={0}
              step={0.01}
              value={valorMax}
              onChange={(e) => setValorMax(e.target.value)}
              placeholder="9999,99"
            />
          </div>
          <Button onClick={aplicarFiltros} size="sm">
            Aplicar filtros
          </Button>
        </CardContent>
      </Card>

      {/* Mensagens globais */}
      {sucesso && (
        <div className="bg-green-50 border border-green-200 text-green-800 rounded-md p-3 text-sm flex items-start justify-between gap-2">
          <p>{sucesso}</p>
          <button onClick={() => setSucesso('')} className="text-green-700">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {erro && !dialog && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-md p-3 text-sm flex items-start justify-between gap-2">
          <p>{erro}</p>
          <button onClick={() => setErro('')} className="text-red-700">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Lista */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" /> Resgates ({lista?.total ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {carregando ? (
            <div className="flex items-center gap-2 text-muted-foreground py-6 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
            </div>
          ) : !lista || lista.items.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Nenhum resgate com os filtros selecionados.
            </p>
          ) : (
            <div className="space-y-2">
              {lista.items.map((r) => (
                <div
                  key={r.id}
                  className="border rounded-lg p-3 flex flex-wrap items-start justify-between gap-3"
                >
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium font-mono text-sm">{r.numeroRecibo}</p>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                        {r.status.replace(/_/g, ' ').toLowerCase()}
                      </span>
                    </div>
                    <p className="text-sm">
                      <strong>{r.cooperadoEstabelecimento.nomeCompleto}</strong>{' '}
                      <span className="text-muted-foreground text-xs">
                        ({r.cooperadoEstabelecimento.email})
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {num(r.valorBrutoTokens)} tokens = {brl(r.valorLiquidoReais)} ·{' '}
                      {r.pixTipo}: <span className="font-mono">{mascarar(r.pixChave)}</span> ·{' '}
                      {formatarData(r.createdAt)}
                    </p>
                    {r.observacao && (
                      <p className="text-xs text-gray-700 italic">"{r.observacao}"</p>
                    )}
                  </div>
                  {r.status === 'PENDENTE_APROVACAO_COOP' && (
                    <div className="flex gap-2 shrink-0">
                      <Button
                        size="sm"
                        className="bg-green-700 hover:bg-green-800"
                        onClick={() => abrirAprovar(r)}
                      >
                        <Check className="h-3 w-3 mr-1" /> Aprovar
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => abrirRecusar(r)}>
                        <X className="h-3 w-3 mr-1" /> Recusar
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Paginação */}
          {lista && lista.pages > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-3 w-3 mr-1" /> Anterior
              </Button>
              <span className="text-xs text-muted-foreground">
                Página {lista.page} de {lista.pages}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= lista.pages}
                onClick={() => setPage((p) => p + 1)}
              >
                Próxima <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ═══ Dialog APROVAR ═══ */}
      {dialog?.tipo === 'aprovar' && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <Card className="max-w-lg w-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-900">
                <Check className="h-5 w-5" /> Aprovar resgate
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-gray-50 border rounded-md p-3 space-y-2 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Recibo</p>
                    <p className="font-mono font-medium">{dialog.recibo.numeroRecibo}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Estabelecimento</p>
                    <p className="font-medium">
                      {dialog.recibo.cooperadoEstabelecimento.nomeCompleto}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Valor (líquido R$)</p>
                    <p className="font-bold text-green-700">
                      {brl(dialog.recibo.valorLiquidoReais)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Tokens (bruto)</p>
                    <p className="font-medium">{num(dialog.recibo.valorBrutoTokens)}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground">Chave PIX destino</p>
                    {/* F6 C.4 P2 (14/06): chave PIX MASCARADA por design
                        anti-PII. Confirmação humana pelo TIPO + parcial. */}
                    <p className="font-mono">
                      {dialog.recibo.pixTipo}: {dialog.recibo.pixChave}
                    </p>
                    <p className="text-[10px] text-muted-foreground italic mt-1">
                      Chave parcial (anti-PII). Para confirmar a chave completa
                      antes de aprovar, contate o estabelecimento por outro canal.
                    </p>
                  </div>
                </div>
                {dialog.recibo.observacao && (
                  <p className="text-xs italic text-gray-700 pt-1 border-t">
                    Obs: "{dialog.recibo.observacao}"
                  </p>
                )}
              </div>

              {/* REFORÇO ANTI-FRAUDE: banner amber se chave alterada <24h
                  ANTES do recibo ser criado. Service deriva (single query,
                  sem N+1). NÃO bloqueia — só pede atenção extra ao humano. */}
              {dialog.recibo.alteradaRecentemente && (
                <div className="bg-amber-50 border-l-4 border-amber-500 rounded p-3">
                  <p className="font-semibold text-amber-900 flex items-center gap-1 text-sm">
                    <AlertTriangle className="h-4 w-4" /> Atenção: chave PIX alterada recentemente
                  </p>
                  <p className="text-xs text-amber-800 mt-1">
                    A chave PIX do estabelecimento foi alterada nas últimas 24 horas <strong>antes</strong>{' '}
                    deste pedido de resgate. Confirme por outro canal (telefone/email) que essa
                    é a chave correta antes de aprovar.
                  </p>
                  {dialog.recibo.cooperadoEstabelecimento.pixUltimaAlteracaoEm && (
                    <p className="text-xs text-amber-800 mt-1">
                      Última alteração da chave:{' '}
                      <strong>
                        {formatarData(dialog.recibo.cooperadoEstabelecimento.pixUltimaAlteracaoEm)}
                      </strong>
                    </p>
                  )}
                </div>
              )}

              <p className="text-sm text-gray-700">
                Ao aprovar, o sistema dispara PIX via Asaas pra essa chave. Se falhar,
                tokens voltam ao saldo do estabelecimento automaticamente.
              </p>

              {erro && (
                <div className="bg-red-50 border border-red-200 text-red-800 rounded-md p-3 text-sm">
                  {erro}
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={fecharDialog} disabled={processando}>
                  Cancelar
                </Button>
                <Button
                  className="bg-green-700 hover:bg-green-800"
                  onClick={aprovar}
                  disabled={processando}
                >
                  {processando ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Check className="h-4 w-4 mr-2" />
                  )}
                  Confirmar aprovação
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ═══ Dialog RECUSAR ═══ */}
      {dialog?.tipo === 'recusar' && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <Card className="max-w-lg w-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-900">
                <X className="h-5 w-5" /> Recusar resgate
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-gray-50 border rounded-md p-3 text-sm space-y-1">
                <p>
                  <strong>{dialog.recibo.numeroRecibo}</strong> —{' '}
                  {dialog.recibo.cooperadoEstabelecimento.nomeCompleto}
                </p>
                <p className="text-xs text-muted-foreground">
                  {num(dialog.recibo.valorBrutoTokens)} tokens = {brl(dialog.recibo.valorLiquidoReais)}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="motivo">
                  Motivo da recusa <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="motivo"
                  value={motivoRecusa}
                  onChange={(e) => setMotivoRecusa(e.target.value)}
                  placeholder="Ex: Estabelecimento não validou documentação de aceitação como parceiro do Clube."
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  O motivo fica registrado no recibo e aparece no extrato do estabelecimento.
                </p>
              </div>

              <p className="text-sm text-gray-700">
                Ao recusar, os {num(dialog.recibo.valorBrutoTokens)} tokens voltam ao saldo
                disponível do estabelecimento automaticamente (ledger ESTORNO_RESGATE_PIX).
              </p>

              {erro && (
                <div className="bg-red-50 border border-red-200 text-red-800 rounded-md p-3 text-sm">
                  {erro}
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={fecharDialog} disabled={processando}>
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  onClick={recusar}
                  disabled={processando || motivoRecusa.trim().length < 3}
                >
                  {processando ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <X className="h-4 w-4 mr-2" />
                  )}
                  Confirmar recusa
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
