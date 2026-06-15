'use client';

/**
 * M39 (16/06/2026) — Redesenho da tela /dashboard/cooper-token/enviar.
 *
 * Antes: 1 destinatário por confirm + GET /saldo (HTTP 400 pro admin)
 * + "Seu Saldo: 0" semanticamente errado.
 *
 * Agora: 2 etapas (seleção + confirmação), tabela editável de
 * destinatários, filtro opcional por convênio + busca por nome/email,
 * valor "Iguais a X" + ajuste individual, prévia COMPLETA com lista +
 * total ANTES do OTP, link pra estorno.
 *
 * Backend: POST /cooper-token/admin/emitir-lote (PREVIEW/CONFIRM).
 * Tier ALTO (>R$50 no total) exige OTP único antes do CONFIRM.
 *
 * SEM GET /saldo — admin emite, não debita (banner explica).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { PinInput } from '@/components/ui/pin-input';
import { HelpBox } from '@/components/ui/help-box';
import {
  ArrowLeft,
  Coins,
  Send,
  ShieldCheck,
  AlertCircle,
  Loader2,
  CheckCircle2,
  History,
  Search,
} from 'lucide-react';

interface Cooperado {
  id: string;
  nomeCompleto: string;
  email: string;
}

interface Convenio {
  id: string;
  numero: string;
  empresaNome: string;
  status: string;
}

interface Linha {
  cooperado: Cooperado;
  selecionado: boolean;
  quantidade: string;
}

type Etapa = 'selecao' | 'confirmacao';

export default function EnviarTokensPage() {
  // ── Carga inicial ──
  const [convenios, setConvenios] = useState<Convenio[]>([]);
  const [convenioFiltro, setConvenioFiltro] = useState<string>(''); // '' = todos
  const [busca, setBusca] = useState('');
  const [cooperadosResultado, setCooperadosResultado] = useState<Cooperado[]>([]);
  const [carregandoBusca, setCarregandoBusca] = useState(false);

  // ── Linhas selecionadas / quantidades ──
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [quantidadeIgual, setQuantidadeIgual] = useState('');
  const [descricao, setDescricao] = useState('');

  // ── Etapa + envio ──
  const [etapa, setEtapa] = useState<Etapa>('selecao');
  const [preview, setPreview] = useState<any>(null); // resposta do PREVIEW
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState<any>(null);

  // ── OTP (só pra tier ALTO) ──
  const [otpDesafioId, setOtpDesafioId] = useState('');
  const [otpCodigo, setOtpCodigo] = useState('');
  const [solicitandoOtp, setSolicitandoOtp] = useState(false);

  // ── Idempotency-key estável por sessão de confirmação ──
  const clientRequestIdRef = useRef<string | null>(null);

  // ── Load: convênios da cooperativa (pra filtro) ──
  useEffect(() => {
    api
      .get('/convenios', { params: { limit: 100 } })
      .then((r) => {
        const data = Array.isArray(r.data) ? r.data : r.data.data ?? [];
        setConvenios(data);
      })
      .catch(() => {
        // silencioso — filtro é opcional
      });
  }, []);

  // ── Buscar cooperados (filtro convênio + busca por nome/email) ──
  async function buscarCooperados() {
    setCarregandoBusca(true);
    setErro('');
    try {
      if (convenioFiltro) {
        // Caminho 1: membros de um convênio específico
        const { data } = await api.get(
          `/cooper-token/empresa/convenio/${convenioFiltro}/membros-disponiveis`,
        );
        const ativos = (data?.membros?.ativos ?? []) as Array<{
          cooperadoId: string;
          nomeCompleto: string;
          email: string;
        }>;
        let filtrados = ativos.map((m) => ({
          id: m.cooperadoId,
          nomeCompleto: m.nomeCompleto,
          email: m.email,
        }));
        if (busca.trim()) {
          const t = busca.trim().toLowerCase();
          filtrados = filtrados.filter(
            (c) =>
              c.nomeCompleto.toLowerCase().includes(t) ||
              c.email.toLowerCase().includes(t),
          );
        }
        setCooperadosResultado(filtrados);
      } else {
        // Caminho 2: lista universal do tenant (busca por nome/email)
        if (busca.trim().length < 2) {
          setErro('Digite ao menos 2 caracteres pra buscar (ou selecione um convênio).');
          setCooperadosResultado([]);
          return;
        }
        const { data } = await api.get('/cooperados', {
          params: { search: busca.trim(), limit: 50 },
        });
        const lista: Cooperado[] = Array.isArray(data) ? data : data.items ?? data.data ?? [];
        setCooperadosResultado(lista);
      }
    } catch (err: any) {
      setErro(err.response?.data?.message ?? 'Erro ao buscar cooperados');
      setCooperadosResultado([]);
    } finally {
      setCarregandoBusca(false);
    }
  }

  function adicionarLinha(cooperado: Cooperado) {
    if (linhas.find((l) => l.cooperado.id === cooperado.id)) return;
    setLinhas((ls) => [...ls, { cooperado, selecionado: true, quantidade: '' }]);
  }

  function adicionarTodos() {
    const novos = cooperadosResultado.filter(
      (c) => !linhas.find((l) => l.cooperado.id === c.id),
    );
    if (novos.length === 0) return;
    setLinhas((ls) => [
      ...ls,
      ...novos.map((c) => ({ cooperado: c, selecionado: true, quantidade: '' })),
    ]);
  }

  function removerLinha(cooperadoId: string) {
    setLinhas((ls) => ls.filter((l) => l.cooperado.id !== cooperadoId));
  }

  function togglarSelecao(cooperadoId: string) {
    setLinhas((ls) =>
      ls.map((l) =>
        l.cooperado.id === cooperadoId ? { ...l, selecionado: !l.selecionado } : l,
      ),
    );
  }

  function setQuantidade(cooperadoId: string, valor: string) {
    setLinhas((ls) =>
      ls.map((l) =>
        l.cooperado.id === cooperadoId
          ? { ...l, quantidade: valor, selecionado: true }
          : l,
      ),
    );
  }

  function aplicarIgualEmTodos() {
    const q = parseFloat(quantidadeIgual);
    if (!q || q <= 0) {
      setErro('Quantidade igual deve ser > 0');
      return;
    }
    setErro('');
    setLinhas((ls) =>
      ls.map((l) => (l.selecionado ? { ...l, quantidade: String(q) } : l)),
    );
  }

  function limparTudo() {
    setLinhas([]);
    setQuantidadeIgual('');
    setDescricao('');
    setErro('');
  }

  // ── Totais derivados ──
  const linhasValidas = useMemo(
    () => linhas.filter((l) => l.selecionado && parseFloat(l.quantidade) > 0),
    [linhas],
  );
  const totalQuantidade = useMemo(
    () =>
      Math.round(
        linhasValidas.reduce((s, l) => s + (parseFloat(l.quantidade) || 0), 0) * 10000,
      ) / 10000,
    [linhasValidas],
  );
  const valorTotalReaisEstimado = preview?.preview?.resumo?.valorTotalReais ?? null;
  const tier = preview?.preview?.resumo?.tier ?? null;

  // ── PREVIEW (servidor calcula soma/valor/tier + alertas) ──
  async function fazerPreview() {
    setErro('');
    setPreview(null);
    if (linhasValidas.length === 0) {
      setErro('Selecione pelo menos 1 cooperado com quantidade > 0.');
      return;
    }
    setEnviando(true);
    try {
      if (!clientRequestIdRef.current) {
        clientRequestIdRef.current = crypto.randomUUID();
      }
      const { data } = await api.post('/cooper-token/admin/emitir-lote', {
        distribuicoes: linhasValidas.map((l) => ({
          destinatarioCooperadoId: l.cooperado.id,
          quantidade: parseFloat(l.quantidade),
        })),
        descricao: descricao || undefined,
        clientRequestId: clientRequestIdRef.current,
        modo: 'PREVIEW',
      });
      setPreview(data);
      setEtapa('confirmacao');
    } catch (err: any) {
      setErro(err.response?.data?.message ?? 'Erro ao fazer prévia');
    } finally {
      setEnviando(false);
    }
  }

  // ── Solicitar OTP (só tier ALTO) ──
  async function solicitarOtp() {
    setSolicitandoOtp(true);
    setErro('');
    try {
      const { data } = await api.post('/cooper-token/otp-step-up', {
        motivo: 'TOKEN_TRANSACAO_STEP_UP',
      });
      setOtpDesafioId(data.desafioId);
    } catch (err: any) {
      setErro(err.response?.data?.message ?? 'Erro ao solicitar OTP');
    } finally {
      setSolicitandoOtp(false);
    }
  }

  // ── CONFIRM ──
  async function confirmar() {
    setErro('');
    if (tier === 'ALTO' && (!otpDesafioId || otpCodigo.length !== 6)) {
      setErro('Tier ALTO exige OTP válido (6 dígitos).');
      return;
    }
    setEnviando(true);
    try {
      const { data } = await api.post('/cooper-token/admin/emitir-lote', {
        distribuicoes: linhasValidas.map((l) => ({
          destinatarioCooperadoId: l.cooperado.id,
          quantidade: parseFloat(l.quantidade),
        })),
        descricao: descricao || undefined,
        clientRequestId: clientRequestIdRef.current,
        modo: 'CONFIRM',
        otpDesafioId: tier === 'ALTO' ? otpDesafioId : undefined,
        otpCodigo: tier === 'ALTO' ? otpCodigo : undefined,
      });
      setSucesso(data.resultado);
      clientRequestIdRef.current = null;
    } catch (err: any) {
      setErro(err.response?.data?.message ?? 'Erro ao confirmar emissão');
    } finally {
      setEnviando(false);
    }
  }

  function novoLote() {
    setSucesso(null);
    setPreview(null);
    setEtapa('selecao');
    setLinhas([]);
    setQuantidadeIgual('');
    setDescricao('');
    setOtpDesafioId('');
    setOtpCodigo('');
    setErro('');
  }

  // ── UI: pós-sucesso ──
  if (sucesso) {
    return (
      <div className="space-y-6 max-w-3xl">
        <Link href="/dashboard/clube" className="inline-block">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Voltar ao Clube
          </Button>
        </Link>

        <Card className="border-green-300 bg-green-50">
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-10 w-10 text-green-600 shrink-0" />
              <div>
                <h2 className="text-xl font-bold text-green-900">
                  Emissão confirmada!
                </h2>
                <p className="text-sm text-green-800">
                  Lote <code className="bg-green-100 px-1 rounded">{sucesso.loteId?.slice(0, 8)}</code> · {sucesso.totalEmitido} CooperTokens emitidos · R$ {Number(sucesso.valorTotalReais ?? 0).toFixed(2)}
                </p>
              </div>
            </div>
            <div className="text-sm text-green-800">
              <p className="font-medium mb-1">
                {sucesso.destinatarios?.length} destinatário(s) receberam o crédito:
              </p>
              <ul className="text-xs space-y-0.5 max-h-40 overflow-y-auto bg-white border border-green-200 rounded p-2">
                {(sucesso.destinatarios ?? []).map((d: any, idx: number) => (
                  <li key={idx}>
                    • {d.nomeCompleto} — {d.quantidade} CooperTokens
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex gap-2">
              <Button onClick={novoLote}>
                <Send className="h-4 w-4 mr-1" /> Emitir novo lote
              </Button>
              <Link href="/dashboard/cooper-token/lotes-emitidos">
                <Button variant="outline">
                  <History className="h-4 w-4 mr-1" /> Ver lotes (estorno)
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
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
            <Coins className="h-6 w-6 text-amber-600" /> Emitir CooperTokens em Lote
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            A cooperativa cria CooperTokens novos no ecossistema (passivo
            tokens a resgatar) e distribui pra N destinatários num único lote.
          </p>
        </div>
        <Link href="/dashboard/cooper-token/lotes-emitidos">
          <Button variant="outline" size="sm">
            <History className="h-4 w-4 mr-1" /> Lotes emitidos (estorno)
          </Button>
        </Link>
      </div>

      <HelpBox id="emitir-lote-help" titulo="Como funciona a emissão admin">
        <p>
          Diferente do <em>portal do membro</em>, aqui você (admin) <strong>EMITE</strong>{' '}
          CooperTokens NOVOS — não transfere saldo próprio. Cada lote escritura:
        </p>
        <ul className="list-disc list-inside mt-1 ml-1 space-y-0.5 text-sm">
          <li>1 entry de crédito por destinatário no ledger (rastreabilidade auditável)</li>
          <li>1 lançamento contábil agregado (D Despesa de Bonificação / C Passivo Tokens)</li>
          <li>Idempotente: re-envio do mesmo lote não credita 2×</li>
        </ul>
        <p className="mt-2">
          Lotes podem ser <strong>estornados</strong> com 1 clique (a página
          de lotes mostra todos). Tier ALTO (R$50+) exige OTP único.
        </p>
      </HelpBox>

      {etapa === 'selecao' && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Search className="h-4 w-4" /> Encontrar destinatários
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="filtro-convenio" className="text-xs">
                    Filtrar por convênio (opcional)
                  </Label>
                  <select
                    id="filtro-convenio"
                    value={convenioFiltro}
                    onChange={(e) => setConvenioFiltro(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm mt-1"
                  >
                    <option value="">Todos os cooperados (busca por nome/email)</option>
                    {convenios.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.numero} — {c.empresaNome}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="busca-coop" className="text-xs">
                    Busca por nome ou email
                  </Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      id="busca-coop"
                      value={busca}
                      onChange={(e) => setBusca(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && buscarCooperados()}
                      placeholder={convenioFiltro ? '(opcional)' : 'Mín 2 chars'}
                    />
                    <Button
                      onClick={buscarCooperados}
                      disabled={carregandoBusca}
                      variant="outline"
                    >
                      {carregandoBusca ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Search className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              {erro && etapa === 'selecao' && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  {erro}
                </div>
              )}

              {cooperadosResultado.length > 0 && (
                <div className="border rounded-lg">
                  <div className="flex items-center justify-between px-3 py-2 border-b bg-gray-50">
                    <p className="text-sm font-medium">
                      {cooperadosResultado.length} cooperado(s) encontrado(s)
                    </p>
                    <Button size="sm" variant="outline" onClick={adicionarTodos}>
                      Adicionar todos
                    </Button>
                  </div>
                  <div className="max-h-60 overflow-y-auto divide-y">
                    {cooperadosResultado.map((c) => {
                      const jaAdicionado = linhas.find((l) => l.cooperado.id === c.id);
                      return (
                        <div
                          key={c.id}
                          className="flex items-center justify-between px-3 py-2 hover:bg-gray-50"
                        >
                          <div className="text-sm">
                            <p className="font-medium">{c.nomeCompleto}</p>
                            <p className="text-xs text-gray-500">{c.email}</p>
                          </div>
                          <Button
                            size="sm"
                            variant={jaAdicionado ? 'ghost' : 'outline'}
                            disabled={!!jaAdicionado}
                            onClick={() => adicionarLinha(c)}
                          >
                            {jaAdicionado ? '✓ Já no lote' : '+ Adicionar'}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <CardTitle className="text-base">
                  Lote em construção · {linhas.length} cooperado(s)
                </CardTitle>
                {linhas.length > 0 && (
                  <Button size="sm" variant="ghost" onClick={limparTudo}>
                    Limpar tudo
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {linhas.length === 0 ? (
                <p className="text-sm text-gray-500 italic">
                  Use a busca acima pra adicionar cooperados ao lote.
                </p>
              ) : (
                <>
                  <div className="flex items-end gap-2 p-3 bg-blue-50 border border-blue-200 rounded">
                    <div className="flex-1">
                      <Label htmlFor="qtd-igual" className="text-xs">
                        Quantidade igual a todos selecionados
                      </Label>
                      <Input
                        id="qtd-igual"
                        type="number"
                        step="0.0001"
                        min="0"
                        value={quantidadeIgual}
                        onChange={(e) => setQuantidadeIgual(e.target.value)}
                        placeholder="Ex: 100"
                        className="mt-1"
                      />
                    </div>
                    <Button onClick={aplicarIgualEmTodos} variant="outline">
                      Aplicar
                    </Button>
                  </div>

                  <div className="border rounded-lg overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-gray-50 text-left text-xs text-gray-600">
                          <th className="px-3 py-2 w-10">Sel.</th>
                          <th className="px-3 py-2">Cooperado</th>
                          <th className="px-3 py-2 w-32">Quantidade</th>
                          <th className="px-3 py-2 w-16"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {linhas.map((l) => (
                          <tr key={l.cooperado.id} className="border-b last:border-b-0">
                            <td className="px-3 py-2">
                              <Checkbox
                                checked={l.selecionado}
                                onCheckedChange={() => togglarSelecao(l.cooperado.id)}
                              />
                            </td>
                            <td className="px-3 py-2">
                              <p className="font-medium">{l.cooperado.nomeCompleto}</p>
                              <p className="text-xs text-gray-500">{l.cooperado.email}</p>
                            </td>
                            <td className="px-3 py-2">
                              <Input
                                type="number"
                                step="0.0001"
                                min="0"
                                value={l.quantidade}
                                onChange={(e) =>
                                  setQuantidade(l.cooperado.id, e.target.value)
                                }
                                placeholder="0"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => removerLinha(l.cooperado.id)}
                              >
                                ×
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div>
                    <Label htmlFor="descricao" className="text-xs">
                      Descrição do lote (opcional — vai pro ledger de cada destinatário)
                    </Label>
                    <Textarea
                      id="descricao"
                      value={descricao}
                      onChange={(e) => setDescricao(e.target.value)}
                      placeholder="Ex: Bonificação 13º semestre 2026"
                      rows={2}
                      className="mt-1"
                    />
                  </div>

                  <div className="bg-amber-50 border border-amber-200 rounded p-3 flex items-center justify-between text-sm">
                    <span className="text-amber-900">
                      <strong>{linhasValidas.length}</strong> selecionado(s) · total a emitir:{' '}
                      <strong>{totalQuantidade.toFixed(4)} CooperTokens</strong>
                    </span>
                    <Button
                      onClick={fazerPreview}
                      disabled={enviando || linhasValidas.length === 0}
                    >
                      {enviando ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      ) : (
                        <Send className="h-4 w-4 mr-1" />
                      )}
                      Pré-visualizar
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {etapa === 'confirmacao' && preview && (
        <Card className="border-amber-300">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-amber-600" /> Confirmar emissão
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded p-4">
              <p className="text-base text-amber-900">
                A cooperativa vai <strong>EMITIR {totalQuantidade.toFixed(4)} CooperTokens</strong>{' '}
                {valorTotalReaisEstimado != null && (
                  <span>(estimado R$ {Number(valorTotalReaisEstimado).toFixed(2)})</span>
                )}{' '}
                pra <strong>{linhasValidas.length} cooperado(s)</strong> selecionado(s).
              </p>
              {tier && (
                <p className="text-xs text-amber-800 mt-1">
                  Tier: <strong>{tier}</strong>
                  {tier === 'ALTO' && ' — OTP obrigatório antes do CONFIRM'}
                </p>
              )}
            </div>

            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">
                Destinatários do lote ({linhasValidas.length}):
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
                    {linhasValidas.map((l) => (
                      <tr key={l.cooperado.id} className="border-b last:border-b-0">
                        <td className="px-3 py-2">
                          <p className="font-medium">{l.cooperado.nomeCompleto}</p>
                          <p className="text-xs text-gray-500">{l.cooperado.email}</p>
                        </td>
                        <td className="px-3 py-2 text-right font-mono">
                          {parseFloat(l.quantidade).toFixed(4)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {preview.preview?.alertas?.length > 0 && (
              <div className="space-y-2">
                {preview.preview.alertas.map((a: any, idx: number) => (
                  <div
                    key={idx}
                    className={`border rounded p-2 text-sm flex items-start gap-2 ${
                      a.severidade === 'bloqueante'
                        ? 'bg-red-50 border-red-200 text-red-800'
                        : 'bg-yellow-50 border-yellow-200 text-yellow-800'
                    }`}
                  >
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>
                      <strong>{a.codigo}:</strong> {a.mensagem}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {tier === 'ALTO' && (
              <div className="border border-amber-300 bg-white rounded p-3 space-y-3">
                <div className="text-sm text-amber-900">
                  <p className="font-medium">Tier ALTO exige OTP único</p>
                  <p className="text-xs">
                    Como o valor total passa R$50, solicite um código de
                    autenticação adicional pra confirmar.
                  </p>
                </div>
                {!otpDesafioId ? (
                  <Button
                    onClick={solicitarOtp}
                    disabled={solicitandoOtp}
                    variant="outline"
                    size="sm"
                  >
                    {solicitandoOtp ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : (
                      <ShieldCheck className="h-4 w-4 mr-1" />
                    )}
                    Solicitar OTP
                  </Button>
                ) : (
                  <div>
                    <Label className="text-xs">Código OTP (6 dígitos)</Label>
                    <PinInput value={otpCodigo} onChange={setOtpCodigo} />
                  </div>
                )}
              </div>
            )}

            {erro && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm flex items-start gap-2">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                {erro}
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setEtapa('selecao')}>
                Voltar
              </Button>
              <Button
                onClick={confirmar}
                disabled={
                  enviando ||
                  (tier === 'ALTO' && (!otpDesafioId || otpCodigo.length !== 6))
                }
              >
                {enviando ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                )}
                Confirmar emissão
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
