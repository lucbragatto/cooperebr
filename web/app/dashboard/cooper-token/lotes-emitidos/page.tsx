'use client';

/**
 * M39 (16/06/2026) — Lista de lotes emitidos pela cooperativa.
 *
 * Cada linha mostra: data, # destinatários, soma quantidade, estornado?
 * Click → modal de confirmação de estorno (mostra LISTA COMPLETA dos
 * destinatários + total ANTES de habilitar o botão "Estornar").
 *
 * Bloqueios:
 * - Motivo obrigatório (≥10 chars) — admin justifica reversão de passivo
 * - Confirmação dupla (checkbox + texto explícito) ANTES do botão habilitar
 *
 * Endpoint backend:
 *   GET   /cooper-token/admin/lotes-emitidos
 *   GET   /cooper-token/admin/lotes-emitidos/:loteId  (detalhe pra modal)
 *   POST  /cooper-token/admin/emitir-lote/:loteId/estornar
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { HelpBox } from '@/components/ui/help-box';
import {
  ArrowLeft,
  Coins,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Undo2,
  History,
} from 'lucide-react';

interface LoteItem {
  loteId: string;
  totalDestinatarios: number;
  somaQuantidade: number;
  emitidoEm: string;
  estornado: boolean;
  estornadoEm: string | null;
}

interface LoteDetalhe {
  loteId: string;
  totalDestinatarios: number;
  somaQuantidade: number;
  valorTotalReais: number;
  valorTokenReais: number;
  emitidoEm: string;
  estornado: boolean;
  estornadoEm: string | null;
  estornoDescricao: string | null;
  destinatarios: Array<{
    cooperadoId: string;
    nomeCompleto: string;
    email: string | null;
    quantidade: number;
    ledgerId: string;
  }>;
}

export default function LotesEmitidosPage() {
  const [lotes, setLotes] = useState<LoteItem[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  // Modal de estorno
  const [loteAtivo, setLoteAtivo] = useState<LoteDetalhe | null>(null);
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [confirmado, setConfirmado] = useState(false);
  const [estornando, setEstornando] = useState(false);
  const [sucessoEstorno, setSucessoEstorno] = useState<any>(null);

  useEffect(() => {
    carregar();
  }, []);

  async function carregar() {
    setCarregando(true);
    setErro('');
    try {
      const { data } = await api.get('/cooper-token/admin/lotes-emitidos', {
        params: { page: 1, limit: 50 },
      });
      setLotes(data.items ?? []);
    } catch (err: any) {
      setErro(err.response?.data?.message ?? 'Erro ao carregar lotes');
    } finally {
      setCarregando(false);
    }
  }

  async function abrirEstorno(loteId: string) {
    setCarregandoDetalhe(true);
    setMotivo('');
    setConfirmado(false);
    setSucessoEstorno(null);
    setErro('');
    try {
      const { data } = await api.get(`/cooper-token/admin/lotes-emitidos/${loteId}`);
      setLoteAtivo(data);
    } catch (err: any) {
      setErro(err.response?.data?.message ?? 'Erro ao carregar detalhe do lote');
    } finally {
      setCarregandoDetalhe(false);
    }
  }

  function fecharModal() {
    setLoteAtivo(null);
    setMotivo('');
    setConfirmado(false);
    setSucessoEstorno(null);
    setErro('');
  }

  async function confirmarEstorno() {
    if (!loteAtivo) return;
    if (motivo.trim().length < 10) {
      setErro('Motivo do estorno obrigatório (mínimo 10 caracteres).');
      return;
    }
    if (!confirmado) {
      setErro('Marque a confirmação antes de estornar.');
      return;
    }
    setEstornando(true);
    setErro('');
    try {
      const { data } = await api.post(
        `/cooper-token/admin/emitir-lote/${loteAtivo.loteId}/estornar`,
        { motivo: motivo.trim(), confirmado: true },
      );
      setSucessoEstorno(data);
      // Recarregar lista (lote já volta como estornado=true)
      await carregar();
    } catch (err: any) {
      setErro(err.response?.data?.message ?? 'Erro ao estornar lote');
    } finally {
      setEstornando(false);
    }
  }

  function fmtData(iso: string): string {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <Link href="/dashboard/clube" className="inline-block">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Voltar ao Clube
        </Button>
      </Link>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <History className="h-6 w-6 text-amber-600" /> Lotes de Emissão Admin
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Histórico de emissões em lote da cooperativa. Cada linha pode
            ser <strong>estornada</strong> com confirmação explícita.
          </p>
        </div>
        <Link href="/dashboard/cooper-token/enviar">
          <Button>
            <Coins className="h-4 w-4 mr-1" /> Nova emissão
          </Button>
        </Link>
      </div>

      <HelpBox id="lotes-estorno-help" titulo="Como o estorno funciona">
        <p>
          Ao estornar um lote, o sistema:
        </p>
        <ul className="list-disc list-inside mt-1 ml-1 space-y-0.5 text-sm">
          <li>Debita o saldo dos destinatários (até o limite do saldo atual — se já gastaram, debita só o que tem)</li>
          <li>Cria entries <code>ESTORNO_BONIFICACAO_ADMIN</code> no ledger (NUNCA apaga o crédito original — trilha auditável)</li>
          <li>Lança a reversão contábil (D Passivo / C Reversão Despesa de Bonificação)</li>
          <li>Idempotente: estornar 2× o mesmo lote não faz dobro</li>
        </ul>
      </HelpBox>

      {erro && !loteAtivo && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          {erro}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {carregando ? 'Carregando…' : `${lotes.length} lote(s)`}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {carregando ? (
            <div className="text-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-400" />
            </div>
          ) : lotes.length === 0 ? (
            <p className="text-center py-8 text-gray-500 text-sm">
              Nenhum lote emitido ainda.{' '}
              <Link href="/dashboard/cooper-token/enviar" className="text-blue-600 hover:underline">
                Emita o primeiro
              </Link>
              .
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr className="text-left text-xs text-gray-600">
                  <th className="px-4 py-2">Lote</th>
                  <th className="px-4 py-2">Emitido em</th>
                  <th className="px-4 py-2 text-right">Destinatários</th>
                  <th className="px-4 py-2 text-right">Total emitido</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {lotes.map((l) => (
                  <tr key={l.loteId} className="border-b last:border-b-0 hover:bg-gray-50">
                    <td className="px-4 py-2">
                      <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">
                        {l.loteId.slice(0, 8)}
                      </code>
                    </td>
                    <td className="px-4 py-2 text-xs">{fmtData(l.emitidoEm)}</td>
                    <td className="px-4 py-2 text-right">{l.totalDestinatarios}</td>
                    <td className="px-4 py-2 text-right font-mono">
                      {l.somaQuantidade.toFixed(4)}
                    </td>
                    <td className="px-4 py-2">
                      {l.estornado ? (
                        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                          Estornado{' '}
                          {l.estornadoEm
                            ? new Date(l.estornadoEm).toLocaleDateString('pt-BR')
                            : ''}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                          Ativo
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {!l.estornado && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => abrirEstorno(l.loteId)}
                        >
                          <Undo2 className="h-3 w-3 mr-1" /> Estornar
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Modal de estorno ─────────────────────────────────────────────── */}
      {loteAtivo && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={fecharModal}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {sucessoEstorno ? (
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-10 w-10 text-green-600 shrink-0" />
                  <div>
                    <h2 className="text-xl font-bold text-green-900">
                      Estorno concluído!
                    </h2>
                    <p className="text-sm text-gray-600">
                      Lote {loteAtivo.loteId.slice(0, 8)} estornado · {sucessoEstorno.totalEstornado} CooperTokens revertidos
                    </p>
                  </div>
                </div>
                <Button onClick={fecharModal} className="w-full">
                  Fechar
                </Button>
              </div>
            ) : (
              <>
                <div className="p-6 border-b">
                  <h2 className="text-lg font-bold flex items-center gap-2">
                    <Undo2 className="h-5 w-5 text-amber-600" />
                    Estornar lote {loteAtivo.loteId.slice(0, 8)}
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Operação reverte o passivo de N pessoas. Confirme antes.
                  </p>
                </div>

                <div className="p-6 space-y-4">
                  {/* Resumo do lote */}
                  <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm">
                    <p className="text-amber-900">
                      <strong>{loteAtivo.totalDestinatarios}</strong> destinatário(s) ·{' '}
                      <strong>{loteAtivo.somaQuantidade.toFixed(4)} CooperTokens</strong> ·{' '}
                      <strong>R$ {loteAtivo.valorTotalReais.toFixed(2)}</strong>
                    </p>
                    <p className="text-xs text-amber-800 mt-1">
                      Emitido em {fmtData(loteAtivo.emitidoEm)}
                    </p>
                  </div>

                  {/* Lista completa dos destinatários */}
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">
                      Destinatários que terão saldo revertido:
                    </p>
                    <div className="border rounded-lg max-h-60 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr className="text-left text-xs text-gray-600">
                            <th className="px-3 py-2">Cooperado</th>
                            <th className="px-3 py-2 text-right">Quantidade</th>
                          </tr>
                        </thead>
                        <tbody>
                          {loteAtivo.destinatarios.map((d) => (
                            <tr key={d.cooperadoId} className="border-b last:border-b-0">
                              <td className="px-3 py-2">
                                <p className="font-medium">{d.nomeCompleto}</p>
                                {d.email && (
                                  <p className="text-xs text-gray-500">{d.email}</p>
                                )}
                              </td>
                              <td className="px-3 py-2 text-right font-mono">
                                {d.quantidade.toFixed(4)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Motivo (obrigatório, mín 10 chars) */}
                  <div>
                    <label className="text-xs font-medium text-gray-700">
                      Motivo do estorno (mínimo 10 caracteres) <span className="text-red-600">*</span>
                    </label>
                    <Textarea
                      value={motivo}
                      onChange={(e) => setMotivo(e.target.value)}
                      placeholder="Ex: Lote emitido em duplicidade — colaboradores corretos serão re-bonificados em novo lote."
                      rows={3}
                      className="mt-1"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {motivo.length}/10 caracteres
                    </p>
                  </div>

                  {/* Confirmação explícita */}
                  <div className="bg-red-50 border border-red-200 rounded p-3">
                    <label className="flex items-start gap-2 cursor-pointer">
                      <Checkbox
                        checked={confirmado}
                        onCheckedChange={(v) => setConfirmado(v === true)}
                        className="mt-0.5"
                      />
                      <span className="text-sm text-red-900">
                        Confirmo que estou revertendo o passivo de{' '}
                        <strong>{loteAtivo.totalDestinatarios} cooperado(s)</strong>,
                        debitando <strong>{loteAtivo.somaQuantidade.toFixed(4)} CooperTokens</strong>{' '}
                        do saldo deles e gerando o lançamento contábil de
                        reversão. A operação é registrada com trilha
                        auditável (não apaga o crédito original).
                      </span>
                    </label>
                  </div>

                  {erro && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                      {erro}
                    </div>
                  )}
                </div>

                <div className="p-6 border-t flex gap-2 justify-end">
                  <Button variant="ghost" onClick={fecharModal} disabled={estornando}>
                    Cancelar
                  </Button>
                  <Button
                    onClick={confirmarEstorno}
                    disabled={estornando || motivo.trim().length < 10 || !confirmado}
                    variant="destructive"
                  >
                    {estornando ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : (
                      <Undo2 className="h-4 w-4 mr-1" />
                    )}
                    Estornar lote
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {carregandoDetalhe && !loteAtivo && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl p-6 flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin" />
            Carregando detalhes do lote…
          </div>
        </div>
      )}
    </div>
  );
}
