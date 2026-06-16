'use client';

/**
 * Sprint Clube P1 — F6 Bloco C.1 (13/06/2026).
 *
 * Tela do cooperado-estabelecimento solicitar resgate de tokens em R$ via
 * PIX. Padrão UX Tipo B (página própria) — mesma família do F2
 * /portal/comprar-tokens e F3 /conveniada/.../distribuir-tokens.
 *
 * Fluxo:
 *  1. Carrega me + status PIX + saldo tokens em paralelo.
 *  2. Guard ehEstabelecimento=false → empty-state amber CTA "Fale com admin".
 *  3. Guard !pixChave → empty-state amber CTA "Cadastre PIX" →
 *     /portal/seguranca/dados-bancarios.
 *  4. Form: quantidade tokens + observação opcional → botão Continuar.
 *  5. Tier ALTO (R$ > 50): cria OtpDesafio via POST /cooper-token/otp-step-up
 *     (não implementado nesta versão; mostra mensagem caso necessário).
 *  6. Modal PIN: PinInput → POST /cooper-token/empresa/resgatar com
 *     clientRequestId useRef padrão F4 C.2.
 *  7. Sucesso → recarrega lista + saldo.
 *  8. Lista "Meus resgates" via GET /cooper-token/empresa/meus-resgates
 *     com botão Cancelar nos PENDENTE_APROVACAO_COOP.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PinInput } from '@/components/ui/pin-input';
import { HelpBox } from '@/components/ui/help-box';
import {
  ArrowLeft,
  Coins,
  ShieldCheck,
  AlertCircle,
  Loader2,
  CheckCircle2,
  KeyRound,
  Receipt,
  Clock,
  Banknote,
  X,
} from 'lucide-react';

interface MeResponse {
  id: string;
  ehEstabelecimento: boolean;
  // Sprint D2 (16/06/2026): flag tenant pra saque colaborador comum.
  saqueColaboradorAtivo: boolean;
  status: string;
}

interface DadosBancariosStatus {
  temPixCadastrado: boolean;
  pixChaveMascarada: string | null;
  pixTipo: string | null;
}

interface SaldoResponse {
  saldoDisponivel: number;
  saldoBloqueadoResgate?: number;
}

interface ResgateRecibo {
  id: string;
  numeroRecibo: string;
  status:
    | 'PENDENTE_APROVACAO_COOP'
    | 'APROVADO_PIX_DISPARADO'
    | 'PAGO_RECIBO_EMITIDO'
    | 'RECUSADO'
    | 'CANCELADO'
    | 'FALHA_PIX';
  valorBrutoTokens: string | number;
  valorBrutoReais: string | number;
  valorLiquidoReais: string | number;
  observacao: string | null;
  motivoRecusa: string | null;
  motivoFalha: string | null;
  pixChave: string;
  pixTipo: string;
  createdAt: string;
}

interface ListaResponse {
  items: ResgateRecibo[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

type Etapa = 'form' | 'pin';
type ErroMotivo =
  | 'PIN_NAO_DEFINIDO'
  | 'PIN_BLOQUEADO'
  | 'PIN_INCORRETO'
  | 'EXCEDE_LIMITE'
  | 'SALDO_INSUFICIENTE'
  | 'OTP_REQUERIDO'
  | 'GENERICO';

interface ErroState {
  motivo: ErroMotivo;
  mensagem: string;
  desbloqueiaEm?: string;
}

const STATUS_ROTULOS: Record<ResgateRecibo['status'], { label: string; cor: string }> = {
  PENDENTE_APROVACAO_COOP: { label: 'Aguardando aprovação', cor: 'bg-amber-100 text-amber-900' },
  APROVADO_PIX_DISPARADO: { label: 'PIX enviado, aguardando confirmação', cor: 'bg-blue-100 text-blue-900' },
  PAGO_RECIBO_EMITIDO: { label: 'Pago — recibo emitido', cor: 'bg-green-100 text-green-900' },
  RECUSADO: { label: 'Recusado', cor: 'bg-red-100 text-red-900' },
  CANCELADO: { label: 'Cancelado', cor: 'bg-gray-200 text-gray-900' },
  FALHA_PIX: { label: 'Falha no PIX — tokens devolvidos', cor: 'bg-red-100 text-red-900' },
};

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

export default function ResgatarTokensPage() {
  const [carregando, setCarregando] = useState(true);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [pixStatus, setPixStatus] = useState<DadosBancariosStatus | null>(null);
  const [saldo, setSaldo] = useState<SaldoResponse | null>(null);
  const [config, setConfig] = useState<{ valorTokenReais: number } | null>(null);
  const [lista, setLista] = useState<ListaResponse | null>(null);

  const [quantidade, setQuantidade] = useState('');
  const [observacao, setObservacao] = useState('');
  const [etapa, setEtapa] = useState<Etapa>('form');
  const [pin, setPin] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [sucesso, setSucesso] = useState('');
  const [erro, setErro] = useState<ErroState | null>(null);

  // F6 C.1 — idempotency-key padrão F4 C.2: estável por sessão de
  // confirmação. Regenera só em sucesso ou cancelar (retry idempotente).
  const clientRequestIdRef = useRef<string | null>(null);

  async function carregarTudo() {
    try {
      const [meR, pixR, saldoR, listaR] = await Promise.all([
        api.get('/cooperados/meu-perfil'),
        api.get('/meu-perfil/dados-bancarios'),
        api.get('/cooper-token/saldo'),
        api.get('/cooper-token/empresa/meus-resgates?limit=10'),
      ]);
      setMe({
        id: meR.data.id,
        ehEstabelecimento: !!meR.data.ehEstabelecimento,
        // Sprint D2 (16/06/2026): flag tenant pra saque colaborador.
        saqueColaboradorAtivo: !!meR.data.saqueColaboradorAtivo,
        status: meR.data.status ?? 'ATIVO',
      });
      setPixStatus(pixR.data);
      setSaldo(saldoR.data);
      // valorTokenReais vem no payload do saldo quando config existe
      if (saldoR.data?.config?.valorTokenReais) {
        setConfig({ valorTokenReais: Number(saldoR.data.config.valorTokenReais) });
      } else {
        setConfig({ valorTokenReais: 0.45 });
      }
      setLista(listaR.data);
    } catch {
      // tela mostra empty-state genérico
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregarTudo();
  }, []);

  const totaisCalc = useMemo(() => {
    const q = parseFloat(quantidade) || 0;
    const valorToken = config?.valorTokenReais ?? 0.45;
    const valorReais = Math.round(q * valorToken * 100) / 100;
    const tier: 'BAIXO' | 'ALTO' = valorReais > 50 ? 'ALTO' : 'BAIXO';
    return { q, valorReais, tier };
  }, [quantidade, config]);

  function abrirPin() {
    setErro(null);
    if (!totaisCalc.q || totaisCalc.q <= 0) {
      setErro({ motivo: 'GENERICO', mensagem: 'Informe uma quantidade maior que zero.' });
      return;
    }
    if (saldo && totaisCalc.q > Number(saldo.saldoDisponivel)) {
      setErro({
        motivo: 'SALDO_INSUFICIENTE',
        mensagem: `Saldo insuficiente. Disponível: ${num(saldo.saldoDisponivel)} tokens.`,
      });
      return;
    }
    if (!clientRequestIdRef.current) {
      clientRequestIdRef.current = crypto.randomUUID();
    }
    setEtapa('pin');
  }

  function voltarParaForm() {
    setEtapa('form');
    setPin('');
    setErro(null);
    // NÃO regenera clientRequestId — voltar é continuação da mesma sessão.
  }

  function cancelarTudo() {
    setEtapa('form');
    setPin('');
    setErro(null);
    setSucesso('');
    clientRequestIdRef.current = null; // nova sessão
  }

  async function confirmarComPin() {
    setErro(null);
    if (!/^\d{6}$/.test(pin)) {
      setErro({ motivo: 'PIN_INCORRETO', mensagem: 'Digite os 6 dígitos do PIN.' });
      return;
    }
    if (!clientRequestIdRef.current) {
      clientRequestIdRef.current = crypto.randomUUID();
    }

    setEnviando(true);
    try {
      const r = await api.post('/cooper-token/empresa/resgatar', {
        quantidade: totaisCalc.q,
        pin,
        clientRequestId: clientRequestIdRef.current,
        observacao: observacao.trim() || undefined,
      });
      const idempotente = r.data?.idempotente === true;
      setSucesso(
        idempotente
          ? `Solicitação já existia (${r.data.recibo?.numeroRecibo}) — sem novo bloqueio.`
          : `Resgate ${r.data.recibo?.numeroRecibo} solicitado! Aguardando aprovação da cooperativa.`,
      );
      // Sucesso → próxima sessão começa fresca.
      clientRequestIdRef.current = null;
      setPin('');
      setQuantidade('');
      setObservacao('');
      setEtapa('form');
      await carregarTudo();
    } catch (err: any) {
      const msg: string = err?.response?.data?.message ?? 'Erro ao solicitar resgate.';
      if (/PIN.*não foi definido|PIN_NAO_DEFINIDO/i.test(msg)) {
        setErro({
          motivo: 'PIN_NAO_DEFINIDO',
          mensagem: 'PIN não foi configurado. Defina antes de solicitar resgate.',
        });
      } else if (/PIN bloqueado|PIN_BLOQUEADO/i.test(msg)) {
        const match = msg.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[\d.Z+-:]*)/);
        setErro({
          motivo: 'PIN_BLOQUEADO',
          mensagem: 'PIN bloqueado por excesso de tentativas.',
          desbloqueiaEm: match?.[1],
        });
        setPin('');
      } else if (/PIN incorreto|PIN_INCORRETO/i.test(msg)) {
        setErro({ motivo: 'PIN_INCORRETO', mensagem: 'PIN incorreto. Tente novamente.' });
        setPin('');
      } else if (/excede.*limite|Limite/i.test(msg)) {
        setErro({ motivo: 'EXCEDE_LIMITE', mensagem: msg });
      } else if (/Saldo insuficiente/i.test(msg)) {
        setErro({ motivo: 'SALDO_INSUFICIENTE', mensagem: msg });
      } else if (/OTP|tier ALTO/i.test(msg)) {
        setErro({
          motivo: 'OTP_REQUERIDO',
          mensagem:
            'Resgates acima de R$ 50 exigem confirmação por OTP (em breve). Por ora, divida em valores menores.',
        });
      } else {
        setErro({ motivo: 'GENERICO', mensagem: msg });
      }
    } finally {
      setEnviando(false);
    }
  }

  async function cancelarResgate(id: string, numeroRecibo: string) {
    if (!confirm(`Cancelar o resgate ${numeroRecibo}? Os tokens serão devolvidos ao seu saldo.`)) {
      return;
    }
    try {
      await api.post(`/cooper-token/empresa/resgates/${id}/cancelar`);
      setSucesso(`Resgate ${numeroRecibo} cancelado. Tokens devolvidos ao saldo disponível.`);
      await carregarTudo();
    } catch (err: any) {
      const msg: string = err?.response?.data?.message ?? 'Erro ao cancelar.';
      alert(msg);
    }
  }

  if (carregando) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
      </div>
    );
  }

  // ─── Guards ───────────────────────────────────────────────────────────
  // Sprint D2 (16/06/2026): libera tela se cooperado é Estabelecimento OU
  // se a cooperativa habilitou saqueColaboradorAtivo (flag tenant).
  // Server-side, solicitarResgate revalida o gate dual (flag + env produção).
  if (me && !me.ehEstabelecimento && !me.saqueColaboradorAtivo) {
    return (
      <div className="space-y-4">
        <Link
          href="/portal/tokens"
          className="text-xs text-muted-foreground hover:underline flex items-center gap-1"
        >
          <ArrowLeft className="h-3 w-3" /> Voltar a Meus Tokens
        </Link>
        <Card className="border-amber-300 bg-amber-50/50">
          <CardContent className="p-6 space-y-3">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-6 w-6 text-amber-700 shrink-0 mt-0.5" />
              <div className="space-y-2">
                <p className="font-semibold text-amber-900">
                  Resgate em R$ via PIX bloqueado
                </p>
                <p className="text-sm text-amber-900">
                  Disponível pra cooperados-Estabelecimento do Clube ou pra
                  cooperados de cooperativas que habilitaram saque de tokens
                  em R$ pra colaboradores (com parecer de conformidade).
                </p>
                <p className="text-sm text-amber-900">
                  Fale com o admin da cooperativa pra habilitar essa função.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (pixStatus && !pixStatus.temPixCadastrado) {
    return (
      <div className="space-y-4">
        <Link
          href="/portal/tokens"
          className="text-xs text-muted-foreground hover:underline flex items-center gap-1"
        >
          <ArrowLeft className="h-3 w-3" /> Voltar a Meus Tokens
        </Link>
        <Card className="border-amber-300 bg-amber-50/50">
          <CardContent className="p-6 space-y-3">
            <div className="flex items-start gap-3">
              <KeyRound className="h-6 w-6 text-amber-700 shrink-0 mt-0.5" />
              <div className="space-y-3 flex-1">
                <p className="font-semibold text-amber-900">Cadastre sua chave PIX</p>
                <p className="text-sm text-amber-900">
                  Pra resgatar tokens em R$, a cooperativa precisa saber pra qual chave PIX
                  enviar o dinheiro. A chave é cadastrada uma vez só e fica protegida por
                  PIN (regra anti-fraude).
                </p>
                <Link href="/portal/seguranca/dados-bancarios">
                  <Button className="bg-amber-700 hover:bg-amber-800">
                    Cadastrar chave PIX →
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Página completa ──────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <Link
        href="/portal/tokens"
        className="text-xs text-muted-foreground hover:underline flex items-center gap-1"
      >
        <ArrowLeft className="h-3 w-3" /> Voltar a Meus Tokens
      </Link>

      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Banknote className="h-6 w-6 text-green-700" /> Resgatar tokens em R$
          </h1>
          <p className="text-sm text-muted-foreground">
            Solicite a liquidação dos seus CooperTokens em R$ via PIX
          </p>
        </div>
        <Card className="px-4 py-3 bg-green-50 border-green-200">
          <div className="flex items-center gap-2 text-green-900">
            <Coins className="h-5 w-5" />
            <div>
              <p className="text-xs">Saldo disponível</p>
              <p className="text-xl font-bold">{num(saldo?.saldoDisponivel ?? 0)}</p>
              {!!Number(saldo?.saldoBloqueadoResgate ?? 0) && (
                <p className="text-xs text-amber-700">
                  + {num(saldo?.saldoBloqueadoResgate ?? 0)} bloqueado (resgate em curso)
                </p>
              )}
            </div>
          </div>
        </Card>
      </div>

      <HelpBox id="resgatar-tokens-help" titulo="Como funciona o resgate">
        <p>
          <strong>1.</strong> Você solicita o resgate de uma quantidade de CooperTokens.
          Os tokens saem do seu saldo disponível e ficam <strong>bloqueados</strong>{' '}
          aguardando aprovação.
        </p>
        <p>
          <strong>2.</strong> A cooperativa revisa e aprova manualmente (pode levar
          horas dependendo do horário). Ao aprovar, dispara o PIX na chave cadastrada.
        </p>
        <p>
          <strong>3.</strong> Se a cooperativa <strong>recusar</strong> ou se o PIX{' '}
          <strong>falhar</strong>, os tokens voltam pro seu saldo automaticamente (sem perda).
        </p>
        <p>
          <strong>Vocabulário:</strong> isso é uma <em>liquidação</em> de voucher com
          recibo — não é venda/recompra. A cooperativa quita um passivo que ela mesma
          emitiu quando você acumulou CooperTokens (Art. 79 Lei 5.764/71).
        </p>
      </HelpBox>

      {pixStatus?.pixChaveMascarada && (
        <Card>
          <CardContent className="p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <KeyRound className="h-5 w-5 text-gray-600" />
              <div>
                <p className="text-xs text-muted-foreground">Chave PIX cadastrada</p>
                <p className="font-medium">
                  {pixStatus.pixTipo}:{' '}
                  <span className="font-mono">{pixStatus.pixChaveMascarada}</span>
                </p>
              </div>
            </div>
            <Link href="/portal/seguranca/dados-bancarios">
              <Button size="sm" variant="outline">
                Alterar
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {sucesso && (
        <div className="bg-green-50 border border-green-200 text-green-800 rounded-md p-3 flex items-start gap-2 text-sm">
          <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="font-medium">{sucesso}</p>
          </div>
          <button
            onClick={() => setSucesso('')}
            className="text-green-700 hover:text-green-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ─── Form ou Etapa PIN ─── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" /> Nova solicitação de resgate
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {etapa === 'form' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="quantidade">Quantidade de tokens</Label>
                <Input
                  id="quantidade"
                  type="number"
                  min={0.0001}
                  step={0.0001}
                  max={Number(saldo?.saldoDisponivel ?? 0)}
                  value={quantidade}
                  onChange={(e) => setQuantidade(e.target.value)}
                  placeholder="Ex: 100"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="obs">Observação (opcional)</Label>
                <Textarea
                  id="obs"
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  placeholder="Vai aparecer no recibo e no extrato bancário"
                  rows={2}
                />
              </div>

              {totaisCalc.q > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-sm space-y-1">
                  <p>
                    <strong>{num(totaisCalc.q)} CooperTokens</strong> ={' '}
                    <strong>{brl(totaisCalc.valorReais)}</strong>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Taxa de resgate: <strong>0%</strong> (taxa zero por design v1).
                  </p>
                  {totaisCalc.tier === 'ALTO' && (
                    <p className="text-xs text-amber-700">
                      ⚠️ Valor &gt; R$ 50 exige confirmação por OTP (etapa em breve).
                    </p>
                  )}
                </div>
              )}

              {erro && (
                <div className="bg-red-50 border border-red-200 text-red-800 rounded-md p-3 text-sm flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <p>{erro.mensagem}</p>
                </div>
              )}

              <div className="flex gap-2 justify-end">
                <Button onClick={abrirPin} disabled={!totaisCalc.q || totaisCalc.q <= 0}>
                  Continuar →
                </Button>
              </div>
            </>
          )}

          {etapa === 'pin' && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 text-blue-900 rounded-md p-3 text-xs space-y-1">
                <p className="font-medium flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5" /> Confirmação com PIN
                </p>
                <p>
                  Você vai solicitar resgate de <strong>{num(totaisCalc.q)} CooperTokens</strong>{' '}
                  (= {brl(totaisCalc.valorReais)}) para a chave PIX{' '}
                  <strong>{pixStatus?.pixChaveMascarada}</strong>.
                </p>
                <p>
                  A cooperativa precisa aprovar — você acompanha a evolução abaixo em
                  "Meus resgates".
                </p>
              </div>

              <div>
                <Label className="block mb-2 text-sm">PIN de 6 dígitos</Label>
                <PinInput
                  value={pin}
                  onChange={(v) => {
                    setPin(v);
                    if (erro?.motivo === 'PIN_INCORRETO') setErro(null);
                  }}
                  erro={
                    erro?.motivo === 'PIN_INCORRETO' ||
                    erro?.motivo === 'PIN_BLOQUEADO' ||
                    erro?.motivo === 'PIN_NAO_DEFINIDO'
                  }
                  disabled={
                    enviando ||
                    erro?.motivo === 'PIN_BLOQUEADO' ||
                    erro?.motivo === 'PIN_NAO_DEFINIDO'
                  }
                />
              </div>

              {erro && (
                <div className="bg-red-50 border border-red-200 text-red-800 rounded-md p-3 text-sm space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    <div className="space-y-1 flex-1">
                      <p className="font-medium">{erro.mensagem}</p>
                      {erro.motivo === 'PIN_NAO_DEFINIDO' && (
                        <Link
                          href="/portal/seguranca/definir-pin"
                          className="text-red-900 underline text-xs font-semibold inline-block"
                        >
                          Configurar PIN agora →
                        </Link>
                      )}
                      {erro.motivo === 'PIN_BLOQUEADO' && erro.desbloqueiaEm && (
                        <p className="text-xs">
                          Tente novamente após{' '}
                          <strong>{formatarData(erro.desbloqueiaEm)}</strong>.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-2 justify-end pt-2">
                <Button variant="ghost" onClick={cancelarTudo} disabled={enviando}>
                  Cancelar tudo
                </Button>
                <Button variant="outline" onClick={voltarParaForm} disabled={enviando}>
                  Voltar
                </Button>
                <Button
                  onClick={confirmarComPin}
                  disabled={
                    enviando ||
                    pin.length !== 6 ||
                    erro?.motivo === 'PIN_BLOQUEADO' ||
                    erro?.motivo === 'PIN_NAO_DEFINIDO'
                  }
                >
                  {enviando ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <ShieldCheck className="h-4 w-4 mr-2" />
                  )}
                  {enviando ? 'Solicitando...' : 'Confirmar com PIN'}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Meus resgates ─── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" /> Meus resgates ({lista?.total ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!lista || lista.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum resgate ainda. Solicite o primeiro acima.
            </p>
          ) : (
            <div className="space-y-2">
              {lista.items.map((r) => {
                const rotulo = STATUS_ROTULOS[r.status];
                const podeCancelar = r.status === 'PENDENTE_APROVACAO_COOP';
                return (
                  <div
                    key={r.id}
                    className="border rounded-lg p-3 flex flex-wrap items-center gap-3 justify-between"
                  >
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium font-mono text-sm">{r.numeroRecibo}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${rotulo.cor}`}>
                          {rotulo.label}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {num(r.valorBrutoTokens)} tokens = {brl(r.valorLiquidoReais)} ·{' '}
                        {formatarData(r.createdAt)}
                      </p>
                      {r.observacao && (
                        <p className="text-xs text-gray-700 italic">"{r.observacao}"</p>
                      )}
                      {r.motivoRecusa && (
                        <p className="text-xs text-red-700">
                          <strong>Motivo da recusa:</strong> {r.motivoRecusa}
                        </p>
                      )}
                      {r.motivoFalha && (
                        <p className="text-xs text-red-700">
                          <strong>Falha:</strong> {r.motivoFalha}
                        </p>
                      )}
                    </div>
                    {podeCancelar && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => cancelarResgate(r.id, r.numeroRecibo)}
                      >
                        <X className="h-3 w-3 mr-1" /> Cancelar
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
