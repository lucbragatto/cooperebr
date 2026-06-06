'use client';

/**
 * D-FISCAL-2.4.4d (02/06/2026) — Tela admin de cobranças consolidadas do
 * Caso 1 (empresa cooperada paga total pelo consumo dos membros + UC própria).
 *
 * Padrão UX (01/06):
 *  - Página própria (gestão financeira → não cabe em Dialog).
 *  - Tabela: competência · valor · status · natureza · ações.
 *  - Dialog Tipo C pra "Gerar agora" (seletor mês ≤ corrente) + "Estornar" (motivo).
 *  - <select> NATIVO (regra 19/05) — sem Shadcn Select dentro do Dialog.
 *  - HelpBox obrigatório no topo (regra 19/05).
 *  - Sem otimista — é dinheiro: loading → sucesso atualiza; erro mostra mensagem.
 *
 * Endpoints (D-FISCAL-2.4.4b/d):
 *   GET   /convenios/:id/cobrancas-consolidadas
 *   POST  /convenios/:id/cobrancas-consolidadas/gerar?mesReferencia=YYYY-MM
 *   POST  /convenios/:id/cobrancas-consolidadas/:cobrancaId/estornar
 */

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { HelpBox } from '@/components/ui/help-box';
import { ArrowLeft, Loader2, RefreshCw, RotateCcw, AlertTriangle, CheckCircle, Send } from 'lucide-react';

type StatusCob = 'PENDENTE' | 'A_VENCER' | 'PAGO' | 'CANCELADO' | 'VENCIDO';
// Sprint Financeiro F1 (04/06/2026) — estado da emissão no gateway
type StatusEmissao = 'AGUARDANDO_EMISSAO' | 'EMITIDO' | 'FALHA_EMISSAO';

const RETRY_MAX = 5;

interface CobrancaConsolidada {
  id: string;
  mesReferencia: number;
  anoReferencia: number;
  valorBruto: string;
  valorDesconto: string;
  valorLiquido: string;
  valorPago: string | null;
  status: StatusCob;
  dataVencimento: string;
  dataPagamento: string | null;
  createdAt: string;
  // Fatia 0.4 — clube discriminado (valorLiquido inclui clube; carve-out abaixo).
  valorMensalidadeClube?: string | null;
  planoClubeId?: string | null;
  // Sprint F1 — emissão
  statusEmissao: StatusEmissao | null;
  tentativasEmissao: number;
  ultimoErroEmissao: string | null;
  ultimaTentativaEmissaoEm: string | null;
}

const STATUS_LABEL: Record<StatusCob, { texto: string; cor: string }> = {
  PENDENTE: { texto: 'Pendente', cor: 'bg-gray-100 text-gray-700 border-gray-300' },
  A_VENCER: { texto: 'A vencer', cor: 'bg-blue-100 text-blue-700 border-blue-300' },
  PAGO: { texto: 'Paga', cor: 'bg-green-100 text-green-700 border-green-300' },
  CANCELADO: { texto: 'Cancelada', cor: 'bg-red-100 text-red-700 border-red-300' },
  VENCIDO: { texto: 'Vencida', cor: 'bg-amber-100 text-amber-700 border-amber-300' },
};

const EMISSAO_LABEL: Record<StatusEmissao, { texto: (n: number) => string; cor: string }> = {
  AGUARDANDO_EMISSAO: {
    texto: (n) => (n > 0 ? `Emitindo... ${n}/${RETRY_MAX}` : 'Aguardando emissão'),
    cor: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  },
  EMITIDO: {
    texto: () => 'Emitida',
    cor: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  },
  FALHA_EMISSAO: {
    texto: () => `Falha na emissão (${RETRY_MAX}×)`,
    cor: 'bg-red-100 text-red-700 border-red-300',
  },
};

function mesNome(mes: number): string {
  const nomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return nomes[mes - 1] ?? String(mes);
}

function moeda(v: string | number | null): string {
  const n = typeof v === 'string' ? Number(v) : (v ?? 0);
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function dataBr(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR');
}

export default function CobrancasConsolidadasPage() {
  const params = useParams();
  const router = useRouter();
  const convenioId = params.id as string;

  const [convenio, setConvenio] = useState<{ empresaNome: string; naturezaAtoCooperativo: string | null; pagador: string } | null>(null);
  const [cobrancas, setCobrancas] = useState<CobrancaConsolidada[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  // Dialog gerar
  const [gerarOpen, setGerarOpen] = useState(false);
  const [mesEscolhido, setMesEscolhido] = useState<string>('');
  const [gerando, setGerando] = useState(false);
  const [gerarErro, setGerarErro] = useState<string | null>(null);
  // D-FISCAL-2.4.4f — feedback estruturado (CRIADA/JA_EXISTE/SEM_MEMBROS)
  const [gerarInfo, setGerarInfo] = useState<
    | { kind: 'CRIADA'; valor: number; cobrancaId: string }
    | { kind: 'JA_EXISTE'; cobrancaId: string }
    | { kind: 'SEM_MEMBROS' }
    | null
  >(null);

  // Dialog estornar
  const [estornarOpen, setEstornarOpen] = useState(false);
  const [estornarAlvo, setEstornarAlvo] = useState<CobrancaConsolidada | null>(null);
  const [motivoEstorno, setMotivoEstorno] = useState('');
  const [estornando, setEstornando] = useState(false);
  const [estornoErro, setEstornoErro] = useState<string | null>(null);

  // Sprint F1 — reemissão por cobrança
  const [reemitindoId, setReemitindoId] = useState<string | null>(null);
  const [reemitirErro, setReemitirErro] = useState<{ cobrancaId: string; msg: string } | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const [convResp, cobResp] = await Promise.all([
        api.get<{ empresaNome: string; naturezaAtoCooperativo: string | null; pagador: string }>(`/convenios/${convenioId}`),
        api.get<CobrancaConsolidada[]>(`/convenios/${convenioId}/cobrancas-consolidadas`),
      ]);
      setConvenio(convResp.data);
      setCobrancas(cobResp.data ?? []);
    } catch (err: any) {
      setErro(err?.response?.data?.message ?? err?.message ?? 'Erro ao carregar dados');
    } finally {
      setCarregando(false);
    }
  }, [convenioId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Gera lista de meses pra dropdown (últimos 12 + corrente)
  const mesesOpcoes = (() => {
    const opcoes: { value: string; label: string }[] = [];
    const hoje = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
      const ano = d.getFullYear();
      const mes = d.getMonth() + 1;
      opcoes.push({
        value: `${ano}-${String(mes).padStart(2, '0')}`,
        label: `${mesNome(mes)}/${ano}`,
      });
    }
    return opcoes;
  })();

  async function gerarManual() {
    if (!mesEscolhido) {
      setGerarErro('Selecione o mês de referência.');
      return;
    }
    setGerando(true);
    setGerarErro(null);
    setGerarInfo(null);
    try {
      // D-FISCAL-2.4.4f — surfacear response.data.status com banner claro.
      // CRIADA → fecha dialog + recarrega + banner verde.
      // JA_EXISTE / SEM_MEMBROS → mantém dialog ABERTO + banner info.
      const resp = await api.post<
        | { status: 'CRIADA'; cobrancaId: string; valorBruto: number; valorLiquido: number }
        | { status: 'JA_EXISTE'; cobrancaId: string }
        | { status: 'SEM_MEMBROS'; convenioId: string }
      >(`/convenios/${convenioId}/cobrancas-consolidadas/gerar?mesReferencia=${mesEscolhido}`);
      const data = resp.data;
      if (data.status === 'CRIADA') {
        setGerarInfo({ kind: 'CRIADA', valor: Number(data.valorLiquido), cobrancaId: data.cobrancaId });
        setGerarOpen(false);
        setMesEscolhido('');
        await carregar();
      } else if (data.status === 'JA_EXISTE') {
        setGerarInfo({ kind: 'JA_EXISTE', cobrancaId: data.cobrancaId });
        await carregar();
      } else if (data.status === 'SEM_MEMBROS') {
        setGerarInfo({ kind: 'SEM_MEMBROS' });
      }
    } catch (err: any) {
      setGerarErro(err?.response?.data?.message ?? err?.message ?? 'Erro ao gerar cobrança consolidada');
    } finally {
      setGerando(false);
    }
  }

  function abrirEstorno(cob: CobrancaConsolidada) {
    setEstornarAlvo(cob);
    setMotivoEstorno('');
    setEstornoErro(null);
    setEstornarOpen(true);
  }

  async function reemitir(cob: CobrancaConsolidada) {
    setReemitindoId(cob.id);
    setReemitirErro(null);
    try {
      await api.post(
        `/convenios/${convenioId}/cobrancas-consolidadas/${cob.id}/reemitir`,
      );
      await carregar();
    } catch (err: any) {
      setReemitirErro({
        cobrancaId: cob.id,
        msg: err?.response?.data?.message ?? err?.message ?? 'Erro ao reemitir',
      });
    } finally {
      setReemitindoId(null);
    }
  }

  async function confirmarEstorno() {
    if (!estornarAlvo) return;
    setEstornando(true);
    setEstornoErro(null);
    try {
      await api.post(
        `/convenios/${convenioId}/cobrancas-consolidadas/${estornarAlvo.id}/estornar`,
        { motivo: motivoEstorno.trim() || undefined },
      );
      setEstornarOpen(false);
      setEstornarAlvo(null);
      setMotivoEstorno('');
      await carregar();
    } catch (err: any) {
      setEstornoErro(err?.response?.data?.message ?? err?.message ?? 'Erro ao estornar');
    } finally {
      setEstornando(false);
    }
  }

  if (carregando && !convenio) {
    return (
      <div className="p-6 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
      </div>
    );
  }

  if (convenio && convenio.pagador !== 'EMPRESA') {
    return (
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Link href={`/dashboard/convenios/${convenioId}`}>
            <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <h1 className="text-xl font-bold">Cobranças consolidadas</h1>
        </div>
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <div>
            Este convênio tem <strong>pagador = {convenio.pagador}</strong>, não EMPRESA.
            Cobranças consolidadas (Caso 1) só se aplicam a convênios com <strong>pagador=EMPRESA</strong>
            (empresa cooperada paga total pelo consumo dos membros + UC própria).
            Edite o convênio para alterar o pagador, se for o caso.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href={`/dashboard/convenios/${convenioId}`}>
            <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold">Cobranças consolidadas</h1>
            <p className="text-xs text-muted-foreground">
              {convenio?.empresaNome ?? '...'} ·{' '}
              <span className="font-medium">
                Natureza: {convenio?.naturezaAtoCooperativo ?? 'Não definida'}
              </span>
            </p>
          </div>
        </div>
        <Button
          variant="default"
          size="sm"
          onClick={() => { setGerarOpen(true); setGerarErro(null); setGerarInfo(null); }}
          title="Força a geração da consolidada de um mês (o cron gera automático no dia configurado)"
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          <RefreshCw className="h-4 w-4 mr-1" />
          Gerar agora
        </Button>
      </div>

      <HelpBox id="convenios-consolidadas-explicacao" titulo="Como funcionam as cobranças consolidadas">
        <p>
          A empresa cooperada deste convênio (pagador = EMPRESA) paga <strong>uma única cobrança por mês</strong>
          pelo consumo de todos os membros custeados — e da própria UC, se a empresa tiver instalação.
          Os membros <strong>não recebem cobrança individual</strong> (suprimida na origem).
        </p>
        <ul className="list-disc list-inside mt-2">
          <li><strong>Geração automática:</strong> roda diariamente às 04h e dispara pros convênios cujo dia configurado for hoje. Sempre gera o <strong>mês fechado anterior</strong> (faturas dos membros já chegaram).</li>
          <li><strong>Gerar agora:</strong> força a geração manual de um mês (≤ corrente). Idempotente — se já existir, retorna a existente.</li>
          <li><strong>Estornar:</strong> reverte a cobrança e o lançamento contábil do convênio. Bloqueado se o mês contábil já estiver <strong>FECHADO</strong> — reabra a apuração primeiro.</li>
          <li><strong>Natureza fiscal:</strong> o lançamento contábil usa a natureza configurada no convênio (Auxiliar / Próprio / Não-Cooperativo), não o padrão de cobrança individual.</li>
        </ul>
        <div className="mt-3 pt-3 border-t border-blue-200">
          <p className="font-semibold mb-1">Estado da emissão no gateway (Asaas/Banestes)</p>
          <p>
            Depois que a cobrança é gerada aqui, o sistema tenta <strong>emitir o documento de
            pagamento</strong> (boleto/PIX) no gateway configurado. Esse estado é separado do status
            da cobrança em si.
          </p>
          <ul className="list-disc list-inside mt-1.5">
            <li>
              <span className="inline-block px-1.5 py-0.5 rounded border bg-yellow-100 text-yellow-800 border-yellow-300 text-[10px] font-medium">
                Emitindo... N/5
              </span>{' '}
              — em retry automático a cada 30min (cap 5 tentativas). Ex: gateway temporariamente fora.
            </li>
            <li>
              <span className="inline-block px-1.5 py-0.5 rounded border bg-emerald-100 text-emerald-700 border-emerald-300 text-[10px] font-medium">
                Emitida
              </span>{' '}
              — empresa tem documento de pagamento disponível.
            </li>
            <li>
              <span className="inline-block px-1.5 py-0.5 rounded border bg-red-100 text-red-700 border-red-300 text-[10px] font-medium">
                Falha na emissão (5×)
              </span>{' '}
              — admin precisa intervir. Verifique a forma de pagamento da empresa (Asaas configurado?
              PIX/boleto?) e clique em <strong>Tentar de novo</strong> pra reiniciar o ciclo.
            </li>
          </ul>
        </div>
      </HelpBox>

      {erro && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-900 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <div>{erro}</div>
        </div>
      )}

      {/* D-FISCAL-2.4.4f — banner verde CRIADA (no main page, depois que dialog fechou) */}
      {gerarInfo?.kind === 'CRIADA' && (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900 flex items-start gap-2">
          <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0 text-emerald-600" />
          <div className="flex-1">
            <strong>Cobrança consolidada gerada — {moeda(gerarInfo.valor)}</strong> (líquido).
            <span className="block text-xs opacity-70 mt-0.5">id={gerarInfo.cobrancaId}</span>
          </div>
          <button
            type="button"
            onClick={() => setGerarInfo(null)}
            className="text-emerald-700 hover:text-emerald-900 text-xs"
            aria-label="Dispensar"
          >
            ✕
          </button>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {carregando ? 'Carregando...' : `${cobrancas.length} cobrança${cobrancas.length === 1 ? '' : 's'}`}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {cobrancas.length === 0 && !carregando ? (
            <div className="px-6 py-12 text-center text-sm text-muted-foreground">
              Nenhuma cobrança consolidada gerada ainda. Use <strong>Gerar agora</strong> para criar
              manualmente o primeiro mês ou aguarde o cron rodar no dia configurado do convênio.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Competência</TableHead>
                  <TableHead className="text-right">Valor bruto</TableHead>
                  <TableHead className="text-right">Desconto</TableHead>
                  <TableHead className="text-right">Valor a pagar</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cobrancas.map((c) => {
                  const st = STATUS_LABEL[c.status] ?? { texto: c.status, cor: 'bg-gray-100' };
                  const podeEstornar = c.status !== 'CANCELADO';
                  const em = c.statusEmissao;
                  const emLabel = em ? EMISSAO_LABEL[em] : null;
                  // Tentar de novo: visível em FALHA_EMISSAO (cap atingido) OU AGUARDANDO_EMISSAO travada (>=1 tentativa registrada)
                  const podeReemitir =
                    em === 'FALHA_EMISSAO' ||
                    (em === 'AGUARDANDO_EMISSAO' && c.tentativasEmissao > 0);
                  const reemitindoEsta = reemitindoId === c.id;
                  const erroEsta = reemitirErro?.cobrancaId === c.id ? reemitirErro.msg : null;
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">
                        {mesNome(c.mesReferencia)}/{c.anoReferencia}
                      </TableCell>
                      <TableCell className="text-right font-mono">{moeda(c.valorBruto)}</TableCell>
                      <TableCell className="text-right font-mono text-gray-500">
                        {Number(c.valorDesconto) > 0 ? `- ${moeda(c.valorDesconto)}` : '—'}
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold">
                        {moeda(c.valorLiquido)}
                        {Number(c.valorMensalidadeClube ?? 0) > 0 && (
                          <div className="text-[10px] text-amber-700 font-normal whitespace-nowrap">
                            Energia {moeda(Number(c.valorLiquido) - Number(c.valorMensalidadeClube ?? 0))} ·
                            {' '}Clube {moeda(c.valorMensalidadeClube ?? 0)}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-gray-600">
                        {dataBr(c.dataVencimento)}
                        {c.dataPagamento && (
                          <div className="text-green-700">Paga: {dataBr(c.dataPagamento)}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Badge variant="outline" className={st.cor}>{st.texto}</Badge>
                          {emLabel && (
                            <Badge
                              variant="outline"
                              className={`${emLabel.cor} text-[10px] w-fit`}
                              title={
                                c.ultimoErroEmissao
                                  ? `Último erro: ${c.ultimoErroEmissao}`
                                  : 'Estado da emissão no gateway de pagamento'
                              }
                            >
                              {emLabel.texto(c.tentativasEmissao)}
                            </Badge>
                          )}
                          {erroEsta && (
                            <div className="text-[10px] text-red-700 bg-red-50 border border-red-200 rounded px-1.5 py-0.5">
                              {erroEsta}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1 flex-wrap">
                          {podeReemitir && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => reemitir(c)}
                              disabled={reemitindoEsta}
                              className="text-amber-700 hover:bg-amber-50"
                              title={
                                em === 'FALHA_EMISSAO'
                                  ? `Reseta tentativas e tenta emitir de novo no gateway. ${
                                      c.ultimoErroEmissao ? `Último erro: ${c.ultimoErroEmissao}` : ''
                                    }`
                                  : 'Reset e nova tentativa imediata (não espera o cron 30min)'
                              }
                            >
                              {reemitindoEsta ? (
                                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                              ) : (
                                <Send className="h-3.5 w-3.5 mr-1" />
                              )}
                              Tentar de novo
                            </Button>
                          )}
                          {podeEstornar && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => abrirEstorno(c)}
                              className="text-red-700 hover:bg-red-50"
                              title={c.status === 'PAGO'
                                ? 'Reverte pagamento + deleta lançamentos contábeis'
                                : 'Cancela a cobrança'}
                            >
                              <RotateCcw className="h-3.5 w-3.5 mr-1" />
                              Estornar
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog Gerar agora */}
      <Dialog open={gerarOpen} onOpenChange={(o) => !gerando && setGerarOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Gerar cobrança consolidada</DialogTitle>
            <DialogDescription>
              Escolha o mês de referência. Idempotente — se já existir, retorna a cobrança existente sem duplicar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <label className="block text-sm font-medium">Mês de referência</label>
            <select
              value={mesEscolhido}
              onChange={(e) => setMesEscolhido(e.target.value)}
              disabled={gerando}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">— selecione um mês —</option>
              {mesesOpcoes.map((op) => (
                <option key={op.value} value={op.value}>{op.label}</option>
              ))}
            </select>
            {gerarErro && (
              <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">
                {gerarErro}
              </div>
            )}
            {/* D-FISCAL-2.4.4f — banner JA_EXISTE (azul) — dialog mantém-se aberto */}
            {gerarInfo?.kind === 'JA_EXISTE' && (
              <div className="text-xs text-blue-800 bg-blue-50 border border-blue-200 rounded p-3 flex items-start gap-2">
                <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0 text-blue-600" />
                <div>
                  <strong>Cobrança já existia pra esse mês — não duplicou.</strong>
                  <div className="opacity-70 mt-0.5">id={gerarInfo.cobrancaId}</div>
                </div>
              </div>
            )}
            {/* D-FISCAL-2.4.4f — banner SEM_MEMBROS (amber) — só ocorre em CONSUMO_REAL */}
            {gerarInfo?.kind === 'SEM_MEMBROS' && (
              <div className="text-xs text-amber-900 bg-amber-50 border border-amber-300 rounded p-3 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0 text-amber-600" />
                <div>
                  <strong>Convênio sem membros ativos — nada gerado.</strong>
                  <div className="opacity-80 mt-1">
                    Cadastre cooperados como membros custeados deste convênio via
                    {' '}<a href="/dashboard/cooperados/novo" className="underline font-medium" target="_blank">/dashboard/cooperados/novo</a>
                    {' '}(toggle &quot;Custeado por convênio&quot; no Step 3).
                  </div>
                  <div className="opacity-70 mt-1 text-[11px]">
                    Dica: se quiser cobrança fixa SEM membros (pacote pré-pago), edite o convênio e
                    troque a base pra <strong>ALOCACAO_FIXA</strong> com <strong>kWh alocado mensal</strong>.
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGerarOpen(false)} disabled={gerando}>
              {gerarInfo ? 'Fechar' : 'Cancelar'}
            </Button>
            <Button
              onClick={gerarManual}
              disabled={gerando || !mesEscolhido}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {gerando ? (
                <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Gerando...</>
              ) : (
                <><CheckCircle className="h-4 w-4 mr-1" /> Gerar</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Estornar */}
      <Dialog open={estornarOpen} onOpenChange={(o) => !estornando && setEstornarOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Estornar cobrança consolidada</DialogTitle>
            <DialogDescription>
              {estornarAlvo && (
                <>
                  Competência <strong>{mesNome(estornarAlvo.mesReferencia)}/{estornarAlvo.anoReferencia}</strong> ·{' '}
                  Valor <strong>{moeda(estornarAlvo.valorLiquido)}</strong> ·{' '}
                  Status atual <strong>{STATUS_LABEL[estornarAlvo.status]?.texto ?? estornarAlvo.status}</strong>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="text-xs bg-amber-50 border border-amber-200 rounded p-2 text-amber-900">
              {estornarAlvo?.status === 'PAGO' ? (
                <>
                  <strong>Reverte o pagamento:</strong> status volta pra A_VENCER, zera data/valor pago,
                  deleta o lançamento de caixa e o lançamento contábil do convênio.
                </>
              ) : (
                <>
                  <strong>Cancela a cobrança</strong> (status → CANCELADO) e cancela o lançamento previsto de caixa.
                </>
              )}{' '}
              Bloqueado se o mês contábil estiver <strong>FECHADO</strong>.
            </div>
            <label className="block text-sm font-medium">Motivo (opcional)</label>
            <textarea
              value={motivoEstorno}
              onChange={(e) => setMotivoEstorno(e.target.value)}
              disabled={estornando}
              rows={3}
              placeholder="Ex: cálculo incorreto · convênio rescindido · re-emissão necessária"
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            {estornoErro && (
              <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">
                {estornoErro}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEstornarOpen(false)} disabled={estornando}>
              Cancelar
            </Button>
            <Button
              onClick={confirmarEstorno}
              disabled={estornando}
              className="bg-red-600 hover:bg-red-700"
            >
              {estornando ? (
                <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Estornando...</>
              ) : (
                <><RotateCcw className="h-4 w-4 mr-1" /> Confirmar estorno</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
