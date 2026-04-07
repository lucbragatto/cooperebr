'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { QRCodeSVG } from 'qrcode.react';
import { Coins, QrCode, Timer, Receipt, ArrowDownCircle } from 'lucide-react';

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

  const carregarDados = useCallback(async () => {
    try {
      const [saldoRes, cobrancasRes] = await Promise.all([
        api.get('/cooper-token/saldo'),
        api.get('/cooper-token/cobrancas-pendentes'),
      ]);
      setSaldo(Number(saldoRes.data.saldoDisponivel));
      setCobrancas(cobrancasRes.data);
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

  async function handleUsarNaFatura() {
    if (!modalCobranca) return;
    setErroFatura('');
    setSucessoFatura('');

    const qtd = parseFloat(tokensParaUsar);
    if (!qtd || qtd <= 0) {
      setErroFatura('Quantidade deve ser maior que zero');
      return;
    }
    if (qtd > saldo) {
      setErroFatura(`Saldo insuficiente. Disponível: ${saldo.toFixed(4)}`);
      return;
    }

    setAplicando(true);
    try {
      const res = await api.post('/cooper-token/usar-na-fatura', {
        cobrancaId: modalCobranca.id,
        quantidadeTokens: qtd,
      });
      setSucessoFatura(
        `Desconto de R$ ${res.data.desconto.toFixed(2)} aplicado! Novo valor: R$ ${res.data.novoValor.toFixed(2)} (${res.data.tokensUsados.toFixed(4)} tokens usados)`,
      );
      setModalCobranca(null);
      setTokensParaUsar('');
      // Recarregar dados
      await carregarDados();
    } catch (err: any) {
      setErroFatura(err.response?.data?.message ?? 'Erro ao aplicar tokens');
    } finally {
      setAplicando(false);
    }
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
      <h1 className="text-2xl font-bold">Usar Tokens</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5" /> Saldo Disponivel
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold text-green-600">
            {saldo.toFixed(4)} CTK
          </p>
        </CardContent>
      </Card>

      {/* Seção: Usar tokens na fatura */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" /> Usar Tokens na Fatura
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

          {/* Modal inline de confirmação */}
          {modalCobranca && (
            <div className="mt-4 border-2 border-primary rounded-lg p-4 bg-primary/5">
              <h3 className="font-semibold mb-2">
                Aplicar tokens na fatura{' '}
                {String(modalCobranca.mesReferencia).padStart(2, '0')}/
                {modalCobranca.anoReferencia}
              </h3>
              <p className="text-sm text-muted-foreground mb-3">
                Valor atual: <strong>R$ {Number(modalCobranca.valorLiquido).toFixed(2)}</strong>
                {' | '}Saldo: <strong>{saldo.toFixed(4)} CTK</strong>
              </p>

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
                <Button onClick={handleUsarNaFatura} disabled={aplicando}>
                  {aplicando ? 'Aplicando...' : 'Confirmar'}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setModalCobranca(null)}
                  disabled={aplicando}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" /> Gerar QR Code para Usar Tokens
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
                Taxa: 1% retida na transferencia
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
                Apresente este QR Code ao parceiro para que ele escaneie e
                processe o pagamento.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
