'use client';

/**
 * Sprint Clube P1 — Fase 2 Bloco 4 (11/06/2026).
 *
 * Pagina dedicada de COMPRA DE TOKENS pra empresa cooperada PJ.
 * Padrao UX Tipo B (entidade inteira = pagina propria) ja consolidado
 * no projeto (config CooperToken, edicao de plano, etc).
 *
 * Guards:
 *  - Client: verifica /auth/me → tipoPessoa=PJ + status compatible.
 *    Se PF, mostra orientacao "esta tela eh so pra empresas cooperadas (PJ)".
 *  - Backend: endpoint POST /cooper-token/cooperado/comprar reforca com
 *    ForbiddenException (defense in depth).
 *
 * Fluxo:
 *  1. Form com quantidade + formaPagamento (PIX/BOLETO).
 *  2. Preview do valor R$ (quantidade × valorTokenReais, da config).
 *  3. Submit → API → backend cria CooperTokenCompra + emite Asaas + linka.
 *  4. Sucesso: exibe link Asaas + QR PIX + linha digitavel pra pagamento.
 *  5. Token chega ao saldo quando Asaas webhook confirmar (processarPagamentoCompraPj).
 *
 * Help inline azul (regra UX 19/05).
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ArrowLeft,
  Coins,
  Info,
  AlertTriangle,
  Loader2,
  Copy,
  ExternalLink,
} from 'lucide-react';

interface AuthMe {
  cooperadoId?: string;
  tipoPessoa?: 'PF' | 'PJ' | string;
  nome?: string;
  perfil?: string;
}

interface CompraResponse {
  compraId: string;
  quantidade: number;
  valorTokenReais: number;
  valorTotal: number;
  formaPagamento: 'PIX' | 'BOLETO';
  status: string;
  asaasId: string;
  linkPagamento: string | null;
  pixQrCode: string | null;
  pixCopiaECola: string | null;
  linhaDigitavel: string | null;
  vencimento: string;
}

function brl(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function ComprarTokensPage() {
  const [me, setMe] = useState<AuthMe | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [valorTokenReais, setValorTokenReais] = useState<number>(0.45);

  const [quantidadeStr, setQuantidadeStr] = useState('');
  const [formaPagamento, setFormaPagamento] = useState<'PIX' | 'BOLETO'>('PIX');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [resultado, setResultado] = useState<CompraResponse | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [meRes, configRes] = await Promise.all([
          api.get('/auth/me'),
          // GET /cooper-token/admin/config eh ADMIN-only — pra portal vamos
          // tentar via saldo do cooperado pra extrair valorTokenReais.
          api.get('/cooper-token/saldo').catch(() => ({ data: null })),
        ]);
        setMe(meRes.data);
        // valorTokenReais via configCooperToken (se vier no payload do saldo)
        // — fallback 0.45. O backend tambem ratifica no servidor.
        const v = configRes?.data?.config?.valorTokenReais;
        if (typeof v === 'number' && v > 0) setValorTokenReais(v);
      } catch {
        // silencioso — UI mostra fallback de carregamento
      } finally {
        setCarregando(false);
      }
    })();
  }, []);

  const quantidade = parseFloat(quantidadeStr.replace(',', '.'));
  const valorTotal =
    Number.isFinite(quantidade) && quantidade > 0
      ? Math.round(quantidade * valorTokenReais * 100) / 100
      : 0;

  async function handleComprar(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    if (!Number.isFinite(quantidade) || quantidade <= 0) {
      setErro('Informe uma quantidade maior que zero.');
      return;
    }
    if (!['PIX', 'BOLETO'].includes(formaPagamento)) {
      setErro('Forma de pagamento invalida.');
      return;
    }
    setEnviando(true);
    try {
      const { data } = await api.post<CompraResponse>(
        '/cooper-token/cooperado/comprar',
        { quantidade, formaPagamento },
      );
      setResultado(data);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ??
        err?.message ??
        'Erro ao processar compra';
      setErro(Array.isArray(msg) ? msg.join(', ') : String(msg));
    } finally {
      setEnviando(false);
    }
  }

  function copiar(texto: string) {
    navigator.clipboard.writeText(texto).catch(() => undefined);
  }

  if (carregando) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-cyan-700" />
      </div>
    );
  }

  const isPJ = (me?.tipoPessoa ?? '').toUpperCase() === 'PJ';

  return (
    <div className="space-y-6 max-w-3xl">
      <Link href="/portal/tokens" className="inline-block">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Voltar aos meus CooperTokens
        </Button>
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Coins className="h-6 w-6 text-amber-600" />
          Comprar CooperTokens
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Empresa cooperada compra tokens para distribuir aos funcionários ou usar em parceiros do Clube.
        </p>
      </div>

      {/* Help inline azul (regra UX 19/05) */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 flex gap-3">
        <Info className="h-5 w-5 text-blue-700 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-900">
          <p className="font-semibold mb-1">Como funciona</p>
          <p>
            Você informa a quantidade de tokens e a forma de pagamento. A cooperativa
            emite uma cobrança via Asaas. Após o pagamento, os tokens são creditados
            automaticamente no seu saldo (geralmente em minutos).
          </p>
          <p className="mt-2">
            <strong>Taxa de emissão:</strong> a cooperativa aplica uma pequena taxa
            de operação (default 2%) sobre os tokens emitidos — o valor pago é o
            cheio; o saldo recebido já vem líquido da taxa.
          </p>
        </div>
      </div>

      {/* Guard PF — orientação amigável */}
      {!isPJ && (
        <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded">
          <p className="text-sm font-semibold text-amber-900 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> Esta tela é só para empresas cooperadas
          </p>
          <p className="text-xs text-amber-800 mt-1">
            Pessoas físicas recebem tokens automaticamente por outros caminhos
            (excedente de geração, bônus de indicação, sobra). Esta página é para
            empresas cooperadas (PJ) que querem comprar tokens diretamente para
            distribuir ou usar em parceiros do Clube.
          </p>
          <p className="text-xs text-amber-800 mt-2">
            Se você é cooperado pessoa jurídica e está vendo essa mensagem, confira
            o seu cadastro ou entre em contato com a cooperativa.
          </p>
        </div>
      )}

      {/* Form de compra — só renderiza pra PJ */}
      {isPJ && !resultado && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nova compra</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleComprar} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="quantidade">Quantidade de tokens</Label>
                  <Input
                    id="quantidade"
                    type="number"
                    step="0.0001"
                    min="0.0001"
                    value={quantidadeStr}
                    onChange={(e) => setQuantidadeStr(e.target.value)}
                    placeholder="Ex: 100"
                    disabled={enviando}
                  />
                </div>
                <div>
                  <Label htmlFor="formaPagamento">Forma de pagamento</Label>
                  <select
                    id="formaPagamento"
                    value={formaPagamento}
                    onChange={(e) => setFormaPagamento(e.target.value as 'PIX' | 'BOLETO')}
                    disabled={enviando}
                    className="w-full mt-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="PIX">PIX</option>
                    <option value="BOLETO">Boleto</option>
                  </select>
                </div>
              </div>

              {/* Preview do total */}
              {valorTotal > 0 && (
                <div className="rounded border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">
                  <p>
                    <strong>{quantidade.toLocaleString('pt-BR')} CooperTokens</strong>{' '}
                    × {brl(valorTokenReais)} = <strong>{brl(valorTotal)}</strong>
                  </p>
                  <p className="text-xs text-emerald-700 mt-1">
                    Valor a pagar via {formaPagamento}. O saldo creditado vem líquido
                    da Taxa de Operação configurada pela cooperativa.
                  </p>
                </div>
              )}

              {erro && (
                <p className="rounded bg-red-50 border border-red-300 p-3 text-sm text-red-700">
                  {erro}
                </p>
              )}

              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={enviando || !Number.isFinite(quantidade) || quantidade <= 0}
                  className="bg-cyan-700 hover:bg-cyan-800"
                >
                  {enviando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Comprar {valorTotal > 0 && `(${brl(valorTotal)})`}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Resultado da compra — exibe link Asaas + QR/boleto */}
      {resultado && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-emerald-700">
              ✓ Compra criada — agora é só pagar
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded border border-slate-200 bg-slate-50 p-3 text-sm">
              <p>
                <strong>Compra:</strong> {resultado.quantidade} CooperTokens · {brl(resultado.valorTotal)} via {resultado.formaPagamento}
              </p>
              <p className="text-xs text-slate-600 mt-1">
                Vencimento: {new Date(resultado.vencimento).toLocaleDateString('pt-BR')}
              </p>
            </div>

            {resultado.linkPagamento && (
              <a
                href={resultado.linkPagamento}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm font-medium text-cyan-700 hover:text-cyan-900 hover:underline"
              >
                <ExternalLink className="h-4 w-4" />
                Abrir link de pagamento Asaas
              </a>
            )}

            {resultado.formaPagamento === 'PIX' && resultado.pixCopiaECola && (
              <div>
                <Label>PIX copia-e-cola</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    readOnly
                    value={resultado.pixCopiaECola}
                    className="font-mono text-xs"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => copiar(resultado.pixCopiaECola!)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {resultado.formaPagamento === 'PIX' && resultado.pixQrCode && (
              <div>
                <Label>QR Code PIX</Label>
                <div className="mt-2 inline-block rounded border border-slate-200 bg-white p-3">
                  <img
                    src={`data:image/png;base64,${resultado.pixQrCode}`}
                    alt="QR Code PIX"
                    className="h-48 w-48"
                  />
                </div>
              </div>
            )}

            {resultado.formaPagamento === 'BOLETO' && resultado.linhaDigitavel && (
              <div>
                <Label>Linha digitável do boleto</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    readOnly
                    value={resultado.linhaDigitavel}
                    className="font-mono text-xs"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => copiar(resultado.linhaDigitavel!)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            <div className="rounded bg-blue-50 border border-blue-200 p-3 text-sm text-blue-900">
              <p className="font-semibold mb-1">O que vai acontecer agora?</p>
              <ol className="list-decimal list-inside space-y-1 text-xs">
                <li>Pague a cobrança via {resultado.formaPagamento}.</li>
                <li>O Asaas confirma o pagamento (geralmente em poucos minutos no PIX; até 2 dias úteis no boleto).</li>
                <li>Os tokens são creditados automaticamente no seu saldo (já descontada a Taxa de Operação).</li>
                <li>Você pode acompanhar pelo seu saldo em <strong>Meus CooperTokens</strong>.</li>
              </ol>
            </div>

            <div className="flex justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setResultado(null);
                  setQuantidadeStr('');
                }}
              >
                Nova compra
              </Button>
              <Link href="/portal/tokens">
                <Button size="sm" className="bg-cyan-700 hover:bg-cyan-800">
                  Ver meu saldo
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
