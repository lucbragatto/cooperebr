'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft, CheckCircle2, FileUp, Loader2, MessageCircle, Upload, Wifi, WifiOff,
  Send, Gift, RefreshCw, Users, Clock, PlugZap,
} from 'lucide-react';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import DisparoSeletivo from '@/components/DisparoSeletivo';

const WHATSAPP_SERVICE_URL = process.env.NEXT_PUBLIC_WHATSAPP_URL ?? 'http://localhost:3002';

interface ResultadoSimulacao {
  sucesso: boolean;
  mensagemWhatsApp: string;
  propostaId?: string;
  dadosExtraidos?: Record<string, unknown>;
}

interface StatusBaileys {
  status: 'awaiting_qr' | 'connected' | 'disconnected' | 'failed' | string;
  qrCode?: string;
}

interface Conversa {
  id: string;
  telefone: string;
  estado: string;
  cooperadoId?: string;
  updatedAt: string;
}

interface ResultadoDisparo {
  total: number;
  enviados: number;
  erros: number;
}

const cls = 'w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500';
const lbl = 'block text-xs font-medium text-gray-600 mb-1';

const estadoLabel: Record<string, { label: string; color: string }> = {
  INICIAL: { label: 'Inicial', color: 'bg-gray-100 text-gray-600' },
  AGUARDANDO_CONFIRMACAO_DADOS: { label: 'Aguard. Dados', color: 'bg-yellow-100 text-yellow-700' },
  AGUARDANDO_CONFIRMACAO_PROPOSTA: { label: 'Aguard. Proposta', color: 'bg-blue-100 text-blue-700' },
  AGUARDANDO_CONFIRMACAO_CADASTRO: { label: 'Aguard. Cadastro', color: 'bg-purple-100 text-purple-700' },
  CONCLUIDO: { label: 'Concluído', color: 'bg-green-100 text-green-700' },
};

const statusLabels: Record<string, { label: string; color: string }> = {
  connected: { label: 'Conectado', color: 'text-green-600' },
  awaiting_qr: { label: 'Aguardando QR Code', color: 'text-yellow-600' },
  disconnected: { label: 'Desconectado', color: 'text-red-500' },
  failed: { label: 'Falhou', color: 'text-red-500' },
};

function tempoAtras(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

export default function WhatsAppPage() {
  // Status Baileys (direto do serviço WhatsApp :3002)
  const [status, setStatus] = useState<StatusBaileys | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [reconnecting, setReconnecting] = useState(false);

  // Conversas
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [loadingConversas, setLoadingConversas] = useState(true);

  // Disparos
  const [mesReferencia, setMesReferencia] = useState('');

  // Simulação manual
  const [telefone, setTelefone] = useState('');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<ResultadoSimulacao | null>(null);
  const [erro, setErro] = useState('');
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Auto-refresh ref
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Buscar status direto do serviço WhatsApp (:3002)
  const fetchStatus = useCallback(async () => {
    try {
      const { data } = await axios.get<StatusBaileys>(`${WHATSAPP_SERVICE_URL}/status`);
      setStatus(data);
      return data;
    } catch {
      setStatus({ status: 'disconnected' });
      return null;
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  // Buscar conversas via API backend (:3000)
  const fetchConversas = useCallback(async () => {
    try {
      const { data } = await api.get<Conversa[]>('/whatsapp/conversas');
      setConversas(data);
    } catch {
      setConversas([]);
    } finally {
      setLoadingConversas(false);
    }
  }, []);

  // Carregar tudo
  const carregarDados = useCallback(async () => {
    setLoadingStatus(true);
    setLoadingConversas(true);
    await Promise.all([fetchStatus(), fetchConversas()]);
  }, [fetchStatus, fetchConversas]);

  // Auto-refresh: poll a cada 5s enquanto não conectado
  useEffect(() => {
    fetchStatus();
    fetchConversas();
  }, [fetchStatus, fetchConversas]);

  useEffect(() => {
    // Limpa intervalo anterior
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    const isConnected = status?.status === 'connected';

    if (!isConnected) {
      intervalRef.current = setInterval(async () => {
        const data = await fetchStatus();
        if (data?.status === 'connected' && intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }, 5000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [status?.status, fetchStatus]);

  // Reconectar
  async function reconnect() {
    setReconnecting(true);
    try {
      await axios.post(`${WHATSAPP_SERVICE_URL}/reconnect`);
      // Aguarda um momento para o serviço iniciar reconexão
      setTimeout(() => {
        fetchStatus();
        setReconnecting(false);
      }, 2000);
    } catch {
      setReconnecting(false);
    }
  }

  // Disparar cobranças (com filtro seletivo)
  async function dispararCobrancas(params: { modo: string; parceiroId?: string; telefones?: string[] }) {
    const { data } = await api.post<ResultadoDisparo>('/whatsapp/disparar-cobrancas', {
      mesReferencia: mesReferencia || undefined,
      ...params,
    });
    return data;
  }

  // Disparar convites MLM (com filtro seletivo)
  async function dispararMLM(params: { modo: string; parceiroId?: string; telefones?: string[] }) {
    const { data } = await api.post<ResultadoDisparo>('/whatsapp/disparar-convites-indicacao', params);
    return data;
  }

  // Simulação manual
  function handleFile(file: File) {
    setArquivo(file);
    setErro('');
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDrag(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }

  function toBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function simular() {
    if (!arquivo) { setErro('Selecione um arquivo de fatura.'); return; }
    if (!telefone.trim()) { setErro('Informe o número de telefone.'); return; }
    setErro('');
    setLoading(true);
    setResultado(null);
    try {
      const arquivoBase64 = await toBase64(arquivo);
      const tipoArquivo = arquivo.type === 'application/pdf' ? 'pdf' : 'imagem';
      const { data } = await api.post<ResultadoSimulacao>('/whatsapp/processar-fatura', {
        arquivoBase64,
        tipoArquivo,
        telefone: telefone.trim(),
      });
      setResultado(data);
    } catch {
      setErro('Erro ao processar. Verifique o arquivo e tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  const isConnected = status?.status === 'connected';
  const isAwaitingQr = status?.status === 'awaiting_qr';
  const conversasAtivas = conversas.filter(c => c.estado !== 'CONCLUIDO' && c.estado !== 'INICIAL');
  const conversasHoje = conversas.filter(c => {
    const d = new Date(c.updatedAt);
    const hoje = new Date();
    return d.toDateString() === hoje.toDateString();
  });
  const statusInfo = statusLabels[status?.status ?? ''] ?? { label: status?.status ?? 'Verificando...', color: 'text-gray-500' };

  return (
    <div className="space-y-6">
      <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 transition-colors">
        <ArrowLeft className="h-4 w-4" />Voltar
      </Link>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <MessageCircle className="h-6 w-6 text-green-600" />
          <h2 className="text-2xl font-bold text-gray-800">Painel WhatsApp</h2>
        </div>
        <Button variant="outline" size="sm" onClick={carregarDados} disabled={loadingStatus}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loadingStatus ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Cards de status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Status Baileys */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {loadingStatus ? (
                  <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                ) : isConnected ? (
                  <Wifi className="h-5 w-5 text-green-600" />
                ) : (
                  <WifiOff className="h-5 w-5 text-red-500" />
                )}
                <div>
                  <p className="text-sm font-medium text-gray-700">Status Baileys</p>
                  <p className={`text-xs font-semibold ${statusInfo.color}`}>
                    {loadingStatus ? 'Verificando...' : statusInfo.label}
                  </p>
                </div>
              </div>
              {!isConnected && !loadingStatus && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={reconnect}
                  disabled={reconnecting}
                  title="Reconectar WhatsApp"
                >
                  {reconnecting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <PlugZap className="h-4 w-4" />
                  )}
                </Button>
              )}
            </div>

            {/* QR Code renderizado como imagem */}
            {status?.qrCode && !isConnected && (
              <div className="mt-4 flex flex-col items-center gap-2">
                <p className="text-xs text-gray-500">Escaneie o QR Code com o WhatsApp:</p>
                <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
                  <QRCodeSVG value={status.qrCode} size={220} level="M" />
                </div>
                <p className="text-[10px] text-gray-400 animate-pulse">Atualizando automaticamente...</p>
              </div>
            )}

            {/* Mensagem de sucesso quando conectado */}
            {isConnected && !loadingStatus && (
              <div className="mt-3 flex items-center gap-2 p-2 bg-green-50 rounded-lg border border-green-200">
                <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                <p className="text-xs text-green-700 font-medium">WhatsApp conectado e pronto para uso!</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Conversas ativas */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-gray-700">Conversas ativas</p>
                <p className="text-2xl font-bold text-blue-600">{conversasAtivas.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Mensagens hoje */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-sm font-medium text-gray-700">Interações hoje</p>
                <p className="text-2xl font-bold text-purple-600">{conversasHoje.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Ações de disparo */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <DisparoSeletivo
          titulo="Disparar cobranças do mês"
          icon={Send}
          isConnected={isConnected}
          onDisparo={dispararCobrancas}
        >
          <div>
            <label className={lbl}>Mês/Ano referência (opcional)</label>
            <input className={cls} value={mesReferencia} onChange={e => setMesReferencia(e.target.value)} placeholder="03/2026 (vazio = mês atual)" />
          </div>
        </DisparoSeletivo>

        <DisparoSeletivo
          titulo="Enviar convites de indicação"
          descricao="Envia mensagem com link personalizado de indicação para cooperados ativos com contrato."
          icon={Gift}
          isConnected={isConnected}
          onDisparo={dispararMLM}
        />
      </div>

      {/* Conversas recentes */}
      {conversas.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm font-semibold text-gray-700">Conversas recentes</CardTitle></CardHeader>
          <CardContent>
            <div className="divide-y divide-gray-100">
              {conversas.slice(0, 20).map(c => {
                const est = estadoLabel[c.estado] || { label: c.estado, color: 'bg-gray-100 text-gray-600' };
                return (
                  <div key={c.id} className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-3">
                      <MessageCircle className="h-4 w-4 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-800">{c.telefone}</p>
                        <p className="text-xs text-gray-400">{tempoAtras(c.updatedAt)} atrás</p>
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${est.color}`}>{est.label}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Simulação manual */}
      <Card>
        <CardHeader><CardTitle className="text-sm font-semibold text-gray-700">Simulação manual (teste)</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-gray-500">Teste o fluxo de processamento de fatura como se fosse recebido pelo WhatsApp.</p>
          <div>
            <label className={lbl}>Telefone do remetente</label>
            <input className={cls} value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="(27) 99999-0000" />
          </div>

          <div>
            <label className={lbl}>Fatura (PDF ou imagem)</label>
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={onDrop}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                drag ? 'border-green-500 bg-green-50' : arquivo ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
              }`}
            >
              <input ref={fileRef} type="file" accept=".pdf,image/*" className="hidden" onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
              {arquivo ? (
                <div className="space-y-1">
                  <FileUp className="h-6 w-6 text-green-600 mx-auto" />
                  <p className="text-sm font-medium text-green-800">{arquivo.name}</p>
                  <p className="text-xs text-green-600">{(arquivo.size / 1024).toFixed(0)} KB</p>
                </div>
              ) : (
                <div className="space-y-1">
                  <Upload className="h-6 w-6 text-gray-400 mx-auto" />
                  <p className="text-sm text-gray-600">Arraste ou <span className="text-green-700 font-medium">clique para selecionar</span></p>
                </div>
              )}
            </div>
          </div>

          {erro && <p className="text-sm text-red-600">{erro}</p>}

          <Button onClick={simular} disabled={loading} className="w-full">
            {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processando fatura com IA...</> : <><MessageCircle className="h-4 w-4 mr-2" />Simular processamento</>}
          </Button>
        </CardContent>
      </Card>

      {resultado && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-green-600" />Mensagem que seria enviada
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`rounded-xl p-4 text-sm whitespace-pre-wrap leading-relaxed ${
                resultado.sucesso ? 'bg-green-50 border border-green-200 text-gray-800' : 'bg-red-50 border border-red-200 text-red-800'
              }`}>
                {resultado.mensagemWhatsApp}
              </div>
            </CardContent>
          </Card>

          {resultado.dadosExtraidos && (
            <Card>
              <CardHeader><CardTitle className="text-sm font-semibold text-gray-700">Dados extraídos</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {Object.entries(resultado.dadosExtraidos)
                    .filter(([k]) => k !== 'historicoConsumo')
                    .map(([key, val]) => (
                      <div key={key} className="flex justify-between gap-2 border-b border-gray-100 py-1.5">
                        <span className="text-gray-500 text-xs">{key}</span>
                        <span className="text-gray-900 text-xs font-medium text-right truncate max-w-[200px]">
                          {typeof val === 'object' ? JSON.stringify(val) : String(val ?? '—')}
                        </span>
                      </div>
                    ))}
                </div>
                {Array.isArray((resultado.dadosExtraidos as Record<string, unknown>).historicoConsumo) && (
                  <div className="mt-4">
                    <p className="text-xs font-medium text-gray-600 mb-2">Histórico de consumo</p>
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <div className="grid grid-cols-3 gap-2 px-3 py-1.5 bg-gray-50 border-b text-xs font-medium text-gray-500">
                        <div>Mês</div><div className="text-right">kWh</div><div className="text-right">R$</div>
                      </div>
                      {((resultado.dadosExtraidos as Record<string, unknown>).historicoConsumo as Array<{ mesAno: string; consumoKwh: number; valorRS: number }>).map((h, i) => (
                        <div key={i} className="grid grid-cols-3 gap-2 px-3 py-1.5 border-b border-gray-100 last:border-0 text-xs">
                          <div>{h.mesAno}</div>
                          <div className="text-right">{h.consumoKwh}</div>
                          <div className="text-right">{h.valorRS > 0 ? `R$ ${h.valorRS.toFixed(2)}` : '—'}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
