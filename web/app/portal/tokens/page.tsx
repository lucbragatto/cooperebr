'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PinInput } from '@/components/ui/pin-input';
import { QRCodeSVG } from 'qrcode.react';
import { Coins, QrCode, Timer, Receipt, ArrowDownCircle, ShoppingCart, ShieldCheck, AlertCircle, Banknote, KeyRound } from 'lucide-react';

interface CobrancaPendente {
  id: string;
  mesReferencia: number;
  anoReferencia: number;
  valorBruto: number;
  valorLiquido: number;
  status: string;
  dataVencimento: string;
  tokenDescontoQt: number | null;
  tokenDescontoReais: number | null;
}

export default function PortalTokensPage() {
  const [saldo, setSaldo] = useState<number>(0);
  const [carregando, setCarregando] = useState(true);
  // Sprint Clube P1 — Fase 2 Bloco 4 (11/06/2026): link condicional pro
  // /portal/comprar-tokens só renderiza pra empresa cooperada (PJ).
  const [tipoPessoa, setTipoPessoa] = useState<string>('PF');
  // F6 Bloco C.2 (13/06/2026): card condicional "Resgatar em R$ via PIX"
  // pra ehEstabelecimento. Lê de /cooperados/meu-perfil (já retorna
  // ehEstabelecimento) + /meu-perfil/dados-bancarios (status pixChave).
  //
  // Sprint D2 (16/06/2026): card também aparece pra cooperado comum quando
  // a flag tenant Cooperativa.saqueColaboradorAtivo está ON
  // (saqueColaboradorAtivo no perfil; flag dual com env SAQUE_COLABORADOR_
  // PRODUCAO_LIBERADO validado server-side no solicitarResgate).
  const [ehEstabelecimento, setEhEstabelecimento] = useState(false);
  const [saqueColaboradorAtivo, setSaqueColaboradorAtivo] = useState(false);
  const [pixCadastrado, setPixCadastrado] = useState(false);
  const [quantidade, setQuantidade] = useState('');
  const [gerando, setGerando] = useState(false);
  const [qrToken, setQrToken] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [erro, setErro] = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Estado para usar tokens na fatura
  const [cobrancas, setCobrancas] = useState<CobrancaPendente[]>([]);
  const [carregandoCobrancas, setCarregandoCobrancas] = useState(true);
  const [modalCobranca, setModalCobranca] = useState<CobrancaPendente | null>(null);
  const [tokensParaUsar, setTokensParaUsar] = useState('');
  const [aplicando, setAplicando] = useState(false);
  const [erroFatura, setErroFatura] = useState('');
  const [sucessoFatura, setSucessoFatura] = useState('');

  // F4 Bloco D (12/06/2026) — etapa de PIN antes de confirmar `usarNaFatura`.
  // Estado: 'form' (preenche quantidade) → 'pin' (PIN 6 dígitos) → POST.
  type EtapaFatura = 'form' | 'pin';
  const [etapaFatura, setEtapaFatura] = useState<EtapaFatura>('form');
  const [pin, setPin] = useState('');
  const [pinErro, setPinErro] = useState<{
    motivo: 'PIN_NAO_DEFINIDO' | 'PIN_BLOQUEADO' | 'PIN_INCORRETO' | 'EXCEDE_LIMITE' | 'GENERICO';
    mensagem: string;
    desbloqueiaEm?: string;
  } | null>(null);

  const carregarDados = useCallback(async () => {
    try {
      const [saldoRes, cobrancasRes, meRes, meuPerfilRes, pixStatusRes] = await Promise.all([
        api.get('/cooper-token/saldo'),
        api.get('/cooper-token/cobrancas-pendentes'),
        // Sprint Clube P1 — Fase 2 Bloco 4: discrimina PJ pra link de compra.
        api.get('/auth/me').catch(() => ({ data: null })),
        // F6 Bloco C.2 (13/06/2026): ehEstabelecimento vem do perfil.
        api.get('/cooperados/meu-perfil').catch(() => ({ data: null })),
        // F6 Bloco C.2: status PIX pra decidir CTA do card resgate.
        api.get('/meu-perfil/dados-bancarios').catch(() => ({ data: null })),
      ]);
      setSaldo(Number(saldoRes.data.saldoDisponivel));
      setCobrancas(cobrancasRes.data);
      if (meRes?.data?.tipoPessoa) {
        setTipoPessoa(String(meRes.data.tipoPessoa).toUpperCase());
      }
      if (meuPerfilRes?.data) {
        setEhEstabelecimento(!!meuPerfilRes.data.ehEstabelecimento);
        // Sprint D2 (16/06/2026): flag tenant pra saque colaborador comum.
        setSaqueColaboradorAtivo(!!meuPerfilRes.data.saqueColaboradorAtivo);
      }
      if (pixStatusRes?.data) {
        setPixCadastrado(!!pixStatusRes.data.temPixCadastrado);
      }
    } catch {
      // silently fail
    } finally {
      setCarregando(false);
      setCarregandoCobrancas(false);
    }
  }, []);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  const limparTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return limparTimer;
  }, [limparTimer]);

  useEffect(() => {
    if (countdown <= 0 && qrToken) {
      setQrToken('');
      limparTimer();
    }
  }, [countdown, qrToken, limparTimer]);

  async function handleGerar(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    setQrToken('');
    limparTimer();

    const qtd = parseFloat(quantidade);
    if (!qtd || qtd <= 0) {
      setErro('Quantidade deve ser maior que zero');
      return;
    }
    if (qtd > saldo) {
      setErro(`Saldo insuficiente. Disponível: ${saldo}`);
      return;
    }

    setGerando(true);
    try {
      const res = await api.post('/cooper-token/gerar-qr-pagamento', {
        quantidade: qtd,
      });
      setQrToken(res.data.qrToken);
      setCountdown(res.data.expiresIn);

      timerRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err: any) {
      setErro(err.response?.data?.message ?? 'Erro ao gerar QR Code');
    } finally {
      setGerando(false);
    }
  }

  /**
   * F4 Bloco D (12/06/2026) — Etapa 1: validação local + transição pra PIN.
   * Validações que NÃO precisam de backend (quantidade, saldo). Se OK,
   * abre a etapa de PIN. O POST com PIN vai em `confirmarComPin`.
   */
  function prepararUsarNaFatura() {
    if (!modalCobranca) return;
    setErroFatura('');
    setSucessoFatura('');
    setPinErro(null);

    const qtd = parseFloat(tokensParaUsar);
    if (!qtd || qtd <= 0) {
      setErroFatura('Quantidade deve ser maior que zero');
      return;
    }
    if (qtd > saldo) {
      setErroFatura(`Saldo insuficiente. Disponível: ${saldo.toFixed(4)}`);
      return;
    }
    setPin('');
    setEtapaFatura('pin');
  }

  /**
   * F4 Bloco D — Etapa 2: confirma com PIN. Traduz erros do backend pra
   * mensagens humanas:
   *  - 400 PIN_NAO_DEFINIDO → link pra /portal/seguranca/definir-pin
   *  - 403 PIN_BLOQUEADO → mostra desbloqueiaEm formatado
   *  - 403 PIN_INCORRETO → mensagem clara + permitir retry
   *  - 400 EXCEDE_LIMITE_* → mensagem específica do limite
   *  - Outros → mensagem genérica
   */
  async function confirmarComPin() {
    if (!modalCobranca) return;
    setPinErro(null);
    if (!/^\d{6}$/.test(pin)) {
      setPinErro({ motivo: 'PIN_INCORRETO', mensagem: 'Digite os 6 dígitos do PIN.' });
      return;
    }

    const qtd = parseFloat(tokensParaUsar);
    setAplicando(true);
    try {
      const res = await api.post('/cooper-token/usar-na-fatura', {
        cobrancaId: modalCobranca.id,
        quantidadeTokens: qtd,
        pin,
      });
      setSucessoFatura(
        `Desconto de R$ ${res.data.desconto.toFixed(2)} aplicado! Novo valor: R$ ${res.data.novoValor.toFixed(2)} (${res.data.tokensUsados.toFixed(4)} tokens usados)`,
      );
      // Reset completo
      setModalCobranca(null);
      setTokensParaUsar('');
      setPin('');
      setEtapaFatura('form');
      await carregarDados();
    } catch (err: any) {
      const msg: string = err.response?.data?.message ?? 'Erro ao aplicar tokens';
      if (/PIN ainda não foi definido|PIN_NAO_DEFINIDO|defina .*PIN/i.test(msg)) {
        setPinErro({
          motivo: 'PIN_NAO_DEFINIDO',
          mensagem: 'PIN ainda não foi configurado. Configure no portal de segurança antes de operar.',
        });
      } else if (/PIN bloqueado|PIN_BLOQUEADO/i.test(msg)) {
        // Tenta extrair ISO date da mensagem ("PIN bloqueado ... após 2026-...T...")
        const match = msg.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[\d.Z+-:]*)/);
        const desbloqueiaEm = match?.[1];
        setPinErro({
          motivo: 'PIN_BLOQUEADO',
          mensagem: 'PIN bloqueado por excesso de tentativas.',
          desbloqueiaEm,
        });
        setPin('');
      } else if (/PIN incorreto|PIN_INCORRETO/i.test(msg)) {
        setPinErro({
          motivo: 'PIN_INCORRETO',
          mensagem: 'PIN incorreto. Tente novamente.',
        });
        setPin('');
      } else if (/excede o limite por transação|Limite diário|excede limite/i.test(msg)) {
        setPinErro({
          motivo: 'EXCEDE_LIMITE',
          mensagem: msg, // mensagem do backend já é detalhada e humana
        });
      } else {
        setPinErro({ motivo: 'GENERICO', mensagem: msg });
      }
    } finally {
      setAplicando(false);
    }
  }

  function cancelarModal() {
    setModalCobranca(null);
    setTokensParaUsar('');
    setPin('');
    setEtapaFatura('form');
    setErroFatura('');
    setPinErro(null);
  }

  function formatTime(seconds: number) {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('pt-BR');
  }

  if (carregando) {
    return <p className="text-muted-foreground text-center py-8">Carregando...</p>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Meus CooperTokens</h1>

      {/* Ajuda contextual (regra de help inline) */}
      <div className="bg-blue-50 border border-blue-200 text-blue-800 rounded-lg p-3 text-sm space-y-1">
        <p><strong>O que são CooperTokens?</strong> São seu benefício de fidelidade na cooperativa.</p>
        <p>Use para <strong>abater sua fatura de energia</strong> (abaixo) ou <strong>pagar em parceiros do Clube</strong> (gerando um QR Code).</p>
        <p className="text-blue-700"><strong>Importante:</strong> CooperTokens valem <strong>desconto</strong> — não viram dinheiro para você. Ex.: usar 50 CooperTokens abate o valor equivalente na sua próxima fatura.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5" /> Saldo Disponivel
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold text-green-600">
            {saldo.toFixed(4)} CooperTokens
          </p>
        </CardContent>
      </Card>

      {/* Sprint Clube P1 — Fase 2 Bloco 4 (11/06/2026): link de compra
          condicional pra empresa cooperada (PJ). Cooperados PF recebem
          tokens por outros caminhos (excedente, indicação, sobra). */}
      {tipoPessoa === 'PJ' && (
        <Card className="border-cyan-300 bg-cyan-50/40">
          <CardContent className="p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-cyan-100 p-2.5">
                <ShoppingCart className="h-5 w-5 text-cyan-700" />
              </div>
              <div>
                <p className="font-semibold text-cyan-900">Comprar CooperTokens</p>
                <p className="text-xs text-cyan-800">
                  Empresa cooperada pode comprar tokens via PIX/boleto para distribuir ou usar em parceiros do Clube.
                </p>
              </div>
            </div>
            <Link href="/portal/comprar-tokens">
              <Button size="sm" className="bg-cyan-700 hover:bg-cyan-800 shrink-0">
                Comprar
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* F6 Bloco C.2 (13/06/2026): card condicional Estabelecimento.
          Sprint D2 (16/06/2026): card também aparece pra cooperado comum
          quando saqueColaboradorAtivo=true (flag tenant). Server-side, o
          solicitarResgate revalida o gate dual (flag + env produção). */}
      {(ehEstabelecimento || saqueColaboradorAtivo) && (
        <Card className={pixCadastrado ? 'border-green-300 bg-green-50/40' : 'border-amber-300 bg-amber-50/40'}>
          <CardContent className="p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={`rounded-lg p-2.5 ${pixCadastrado ? 'bg-green-100' : 'bg-amber-100'}`}>
                {pixCadastrado ? (
                  <Banknote className="h-5 w-5 text-green-700" />
                ) : (
                  <KeyRound className="h-5 w-5 text-amber-700" />
                )}
              </div>
              <div>
                <p className={`font-semibold ${pixCadastrado ? 'text-green-900' : 'text-amber-900'}`}>
                  {pixCadastrado ? 'Resgatar em R$ via PIX' : 'Cadastre seu PIX para resgatar'}
                </p>
                <p className={`text-xs ${pixCadastrado ? 'text-green-800' : 'text-amber-800'}`}>
                  {pixCadastrado
                    ? ehEstabelecimento
                      ? 'Você é Estabelecimento do Clube. Solicite a liquidação dos tokens em R$ via PIX (recibo emitido pela cooperativa após aprovação).'
                      : 'Sua cooperativa habilitou saque de tokens em R$ via PIX. Solicite a liquidação (recibo emitido após aprovação).'
                    : 'Cadastre sua chave PIX — necessária pra receber resgates em R$.'}
                </p>
              </div>
            </div>
            <Link href={pixCadastrado ? '/portal/resgatar-tokens' : '/portal/seguranca/dados-bancarios'}>
              <Button
                size="sm"
                className={
                  pixCadastrado
                    ? 'bg-green-700 hover:bg-green-800 shrink-0'
                    : 'bg-amber-700 hover:bg-amber-800 shrink-0'
                }
              >
                {pixCadastrado ? 'Resgatar' : 'Cadastrar PIX'}
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Seção: Usar tokens na fatura */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" /> Abater minha fatura com CooperTokens
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sucessoFatura && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded text-sm mb-4">
              {sucessoFatura}
            </div>
          )}

          {carregandoCobrancas ? (
            <p className="text-muted-foreground text-sm">Carregando faturas...</p>
          ) : cobrancas.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Nenhuma fatura pendente para abatimento.
            </p>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground mb-2">
                Selecione uma fatura para aplicar o desconto com seus tokens:
              </p>
              {cobrancas.map(c => (
                <div
                  key={c.id}
                  className="flex items-center justify-between border rounded-lg p-3"
                >
                  <div>
                    <p className="font-medium text-sm">
                      {String(c.mesReferencia).padStart(2, '0')}/{c.anoReferencia}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Vence: {formatDate(c.dataVencimento)} | Status:{' '}
                      <span
                        className={
                          c.status === 'VENCIDO'
                            ? 'text-red-600 font-medium'
                            : 'text-amber-600 font-medium'
                        }
                      >
                        {c.status === 'A_VENCER' ? 'A vencer' : 'Vencido'}
                      </span>
                    </p>
                    {Number(c.tokenDescontoReais ?? 0) > 0 && (
                      <p className="text-xs text-green-600">
                        Desconto token ja aplicado: R$ {Number(c.tokenDescontoReais).toFixed(2)}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-bold">R$ {Number(c.valorLiquido).toFixed(2)}</p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-1"
                      onClick={() => {
                        setModalCobranca(c);
                        setTokensParaUsar('');
                        setErroFatura('');
                        setSucessoFatura('');
                      }}
                      disabled={saldo <= 0}
                    >
                      <ArrowDownCircle className="h-3 w-3 mr-1" />
                      Usar tokens
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Modal inline de confirmação — F4 Bloco D: 2 etapas (form → pin) */}
          {modalCobranca && (
            <div className="mt-4 border-2 border-primary rounded-lg p-4 bg-primary/5">
              <h3 className="font-semibold mb-2">
                Aplicar tokens na fatura{' '}
                {String(modalCobranca.mesReferencia).padStart(2, '0')}/
                {modalCobranca.anoReferencia}
              </h3>
              <p className="text-sm text-muted-foreground mb-3">
                Valor atual: <strong>R$ {Number(modalCobranca.valorLiquido).toFixed(2)}</strong>
                {' | '}Saldo: <strong>{saldo.toFixed(4)} CooperTokens</strong>
              </p>

              {/* ───── ETAPA 1: form (quantidade) ───── */}
              {etapaFatura === 'form' && (
                <>
                  {erroFatura && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm mb-3">
                      {erroFatura}
                    </div>
                  )}

                  <div className="flex gap-2 items-end">
                    <div className="flex-1 max-w-xs">
                      <Label>Quantidade de tokens</Label>
                      <Input
                        type="number"
                        min={0.0001}
                        step={0.0001}
                        max={saldo}
                        value={tokensParaUsar}
                        onChange={e => setTokensParaUsar(e.target.value)}
                        placeholder="Ex: 5.0"
                      />
                    </div>
                    <Button onClick={prepararUsarNaFatura}>
                      Continuar
                    </Button>
                    <Button variant="ghost" onClick={cancelarModal}>
                      Cancelar
                    </Button>
                  </div>
                </>
              )}

              {/* ───── ETAPA 2: PIN ───── */}
              {etapaFatura === 'pin' && (
                <div className="space-y-4">
                  {/* Help inline contextual (regra UX 19/05) */}
                  <div className="bg-blue-50 border border-blue-200 text-blue-900 rounded-md p-3 text-xs space-y-1">
                    <p className="font-medium flex items-center gap-1">
                      <ShieldCheck className="h-3.5 w-3.5" /> Confirmação com PIN
                    </p>
                    <p>
                      Para sua segurança, operações com tokens exigem o PIN de 6 dígitos. Esse PIN é diferente da sua senha.
                    </p>
                    <p>
                      Ainda não tem PIN?{' '}
                      <Link
                        href="/portal/seguranca/definir-pin"
                        className="underline font-medium"
                      >
                        Defina agora
                      </Link>
                      .
                    </p>
                  </div>

                  <div className="text-sm">
                    Você vai usar <strong>{parseFloat(tokensParaUsar || '0').toFixed(4)} CooperTokens</strong>{' '}
                    para abater a fatura{' '}
                    <strong>
                      {String(modalCobranca.mesReferencia).padStart(2, '0')}/
                      {modalCobranca.anoReferencia}
                    </strong>
                    .
                  </div>

                  <div>
                    <Label className="block mb-2 text-sm">PIN de 6 dígitos</Label>
                    <PinInput
                      value={pin}
                      onChange={(v) => {
                        setPin(v);
                        if (pinErro?.motivo === 'PIN_INCORRETO') setPinErro(null);
                      }}
                      erro={
                        pinErro?.motivo === 'PIN_INCORRETO' ||
                        pinErro?.motivo === 'PIN_BLOQUEADO' ||
                        pinErro?.motivo === 'PIN_NAO_DEFINIDO'
                      }
                      disabled={aplicando || pinErro?.motivo === 'PIN_BLOQUEADO' || pinErro?.motivo === 'PIN_NAO_DEFINIDO'}
                    />
                  </div>

                  {pinErro && (
                    <div className="bg-red-50 border border-red-200 text-red-800 rounded-md p-3 text-sm space-y-2">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                        <div className="space-y-1 flex-1">
                          <p className="font-medium">{pinErro.mensagem}</p>
                          {pinErro.motivo === 'PIN_NAO_DEFINIDO' && (
                            <Link
                              href="/portal/seguranca/definir-pin"
                              className="text-red-900 underline text-xs font-semibold inline-block"
                            >
                              Configurar PIN agora →
                            </Link>
                          )}
                          {pinErro.motivo === 'PIN_BLOQUEADO' && pinErro.desbloqueiaEm && (
                            <p className="text-xs">
                              Tente novamente após{' '}
                              <strong>
                                {new Date(pinErro.desbloqueiaEm).toLocaleString('pt-BR', {
                                  dateStyle: 'short',
                                  timeStyle: 'short',
                                })}
                              </strong>
                              .
                            </p>
                          )}
                          {pinErro.motivo === 'EXCEDE_LIMITE' && (
                            <p className="text-xs">
                              Ajuste o limite em{' '}
                              <Link
                                href="/portal/seguranca"
                                className="underline font-semibold"
                              >
                                /portal/seguranca
                              </Link>{' '}
                              ou peça ao admin pra elevar o teto.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button
                      onClick={confirmarComPin}
                      disabled={
                        aplicando ||
                        pin.length !== 6 ||
                        pinErro?.motivo === 'PIN_BLOQUEADO' ||
                        pinErro?.motivo === 'PIN_NAO_DEFINIDO'
                      }
                    >
                      {aplicando ? 'Confirmando...' : 'Confirmar com PIN'}
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setEtapaFatura('form');
                        setPin('');
                        setPinErro(null);
                      }}
                      disabled={aplicando}
                    >
                      Voltar
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={cancelarModal}
                      disabled={aplicando}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" /> Pagar em parceiro do Clube (QR Code)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleGerar} className="space-y-4">
            {erro && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
                {erro}
              </div>
            )}
            <div className="max-w-xs">
              <Label>Quantidade de tokens</Label>
              <Input
                type="number"
                min={0.0001}
                step={0.0001}
                value={quantidade}
                onChange={e => setQuantidade(e.target.value)}
                placeholder="Ex: 10.5"
                required
              />
              <p className="text-xs text-muted-foreground mt-1">
                Taxa da rede: 1% retida em CooperTokens nesta operação
              </p>
            </div>
            <Button type="submit" disabled={gerando}>
              {gerando ? 'Gerando...' : 'Gerar QR Code'}
            </Button>
          </form>

          {qrToken && countdown > 0 && (
            <div className="mt-6 flex flex-col items-center gap-4">
              <div className="bg-white p-4 rounded-lg border">
                <QRCodeSVG value={qrToken} size={256} level="M" />
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Timer className="h-4 w-4" />
                <span
                  className={
                    countdown <= 60
                      ? 'text-red-600 font-bold'
                      : 'text-muted-foreground'
                  }
                >
                  Expira em {formatTime(countdown)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground text-center max-w-sm">
                Apresente este QR Code ao parceiro do Clube para usar seus
                CooperTokens como desconto.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
