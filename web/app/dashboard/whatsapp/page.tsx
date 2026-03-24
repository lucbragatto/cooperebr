'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft, CheckCircle2, Loader2, MessageCircle, Wifi, WifiOff,
  Send, Gift, RefreshCw, Users, Clock, PlugZap,
  MessagesSquare, History, List,
} from 'lucide-react';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import DisparoSeletivo from '@/components/DisparoSeletivo';
import ConversaDetalhe from '@/components/whatsapp/ConversaDetalhe';
import HistoricoMensagens from '@/components/whatsapp/HistoricoMensagens';
import GerenciarListas from '@/components/whatsapp/GerenciarListas';

const WHATSAPP_SERVICE_URL = process.env.NEXT_PUBLIC_WHATSAPP_URL ?? 'http://localhost:3002';

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

interface MensagemHistorico {
  id: string;
  telefone: string;
  direcao: string;
  conteudo: string | null;
  status: string;
  enviadaEm: string;
}

type AbaAtiva = 'disparos' | 'conversas' | 'historico' | 'listas';

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

const abas: { id: AbaAtiva; label: string; icon: React.ElementType }[] = [
  { id: 'disparos', label: 'Disparos', icon: Send },
  { id: 'conversas', label: 'Conversas', icon: MessagesSquare },
  { id: 'historico', label: 'Histórico', icon: History },
  { id: 'listas', label: 'Listas', icon: List },
];

export default function WhatsAppPage() {
  const [abaAtiva, setAbaAtiva] = useState<AbaAtiva>('disparos');

  // Status Baileys
  const [status, setStatus] = useState<StatusBaileys | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [reconnecting, setReconnecting] = useState(false);

  // Conversas
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [loadingConversas, setLoadingConversas] = useState(true);
  const [conversaSelecionada, setConversaSelecionada] = useState<string | null>(null);

  // Disparos
  const [mesReferencia, setMesReferencia] = useState('');

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

  // Buscar conversas via API backend
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

  const carregarDados = useCallback(async () => {
    setLoadingStatus(true);
    setLoadingConversas(true);
    await Promise.all([fetchStatus(), fetchConversas()]);
  }, [fetchStatus, fetchConversas]);

  useEffect(() => {
    fetchStatus();
    fetchConversas();
  }, [fetchStatus, fetchConversas]);

  // Auto-refresh when not connected
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    const isConn = status?.status === 'connected';
    if (!isConn) {
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

  async function reconnect() {
    setReconnecting(true);
    try {
      await axios.post(`${WHATSAPP_SERVICE_URL}/reconnect`);
      setTimeout(() => { fetchStatus(); setReconnecting(false); }, 2000);
    } catch {
      setReconnecting(false);
    }
  }

  async function dispararCobrancas(params: { modo: string; parceiroId?: string; telefones?: string[] }) {
    const { data } = await api.post<ResultadoDisparo>('/whatsapp/disparar-cobrancas', {
      mesReferencia: mesReferencia || undefined,
      ...params,
    });
    return data;
  }

  async function dispararMLM(params: { modo: string; parceiroId?: string; telefones?: string[] }) {
    const { data } = await api.post<ResultadoDisparo>('/whatsapp/disparar-convites-indicacao', params);
    return data;
  }

  function handleUsarListaNoDisparo(telefones: string[], _nomeLista: string) {
    setAbaAtiva('disparos');
    // The user can see the list was loaded — they use DisparoSeletivo's lista mode
  }

  const isConnected = status?.status === 'connected';
  const conversasAtivas = conversas.filter(c => c.estado !== 'CONCLUIDO' && c.estado !== 'INICIAL');
  const conversasHoje = conversas.filter(c => {
    const d = new Date(c.updatedAt);
    const hoje = new Date();
    return d.toDateString() === hoje.toDateString();
  });
  const statusInfo = statusLabels[status?.status ?? ''] ?? { label: status?.status ?? 'Verificando...', color: 'text-gray-500' };

  // Group conversas by phone for the Conversas tab (unique phones with latest message)
  const conversasPorTelefone = conversas.reduce<Record<string, Conversa>>((acc, c) => {
    if (!acc[c.telefone] || new Date(c.updatedAt) > new Date(acc[c.telefone].updatedAt)) {
      acc[c.telefone] = c;
    }
    return acc;
  }, {});
  const listaConversas = Object.values(conversasPorTelefone).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );

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

      {/* Status cards */}
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
                <Button variant="outline" size="sm" onClick={reconnect} disabled={reconnecting} title="Reconectar">
                  {reconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlugZap className="h-4 w-4" />}
                </Button>
              )}
            </div>
            {status?.qrCode && !isConnected && (
              <div className="mt-4 flex flex-col items-center gap-2">
                <p className="text-xs text-gray-500">Escaneie o QR Code com o WhatsApp:</p>
                <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
                  <QRCodeSVG value={status.qrCode} size={220} level="M" />
                </div>
                <p className="text-[10px] text-gray-400 animate-pulse">Atualizando automaticamente...</p>
              </div>
            )}
            {isConnected && !loadingStatus && (
              <div className="mt-3 flex items-center gap-2 p-2 bg-green-50 rounded-lg border border-green-200">
                <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                <p className="text-xs text-green-700 font-medium">WhatsApp conectado e pronto para uso!</p>
              </div>
            )}
          </CardContent>
        </Card>

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

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-0 -mb-px">
          {abas.map((aba) => {
            const Icon = aba.icon;
            const ativa = abaAtiva === aba.id;
            return (
              <button
                key={aba.id}
                onClick={() => { setAbaAtiva(aba.id); setConversaSelecionada(null); }}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  ativa
                    ? 'border-green-600 text-green-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="h-4 w-4" />
                {aba.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab content */}
      {abaAtiva === 'disparos' && (
        <div className="space-y-4">
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
        </div>
      )}

      {abaAtiva === 'conversas' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Lista de conversas */}
          <div className={`space-y-1 ${conversaSelecionada ? 'hidden md:block' : ''}`}>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold text-gray-700">Conversas</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingConversas ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                  </div>
                ) : listaConversas.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">Nenhuma conversa.</p>
                ) : (
                  <div className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
                    {listaConversas.map((c) => {
                      const est = estadoLabel[c.estado] || { label: c.estado, color: 'bg-gray-100 text-gray-600' };
                      const selecionada = conversaSelecionada === c.telefone;
                      const telefoneFormatado = c.telefone.replace(/(\d{2})(\d{2})(\d{5})(\d{4})/, '+$1 ($2) $3-$4');
                      const inicial = c.telefone.slice(-2);

                      return (
                        <button
                          key={c.id}
                          onClick={() => setConversaSelecionada(c.telefone)}
                          className={`w-full flex items-center gap-3 py-3 px-2 text-left transition-colors rounded ${
                            selecionada ? 'bg-green-50' : 'hover:bg-gray-50'
                          }`}
                        >
                          <div className="w-9 h-9 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-xs font-bold shrink-0">
                            {inicial}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">{telefoneFormatado}</p>
                            <p className="text-[10px] text-gray-400">{tempoAtras(c.updatedAt)} atrás</p>
                          </div>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${est.color}`}>
                            {est.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Detalhe da conversa */}
          <div className="md:col-span-2">
            {conversaSelecionada ? (
              <ConversaDetalhe
                telefone={conversaSelecionada}
                onVoltar={() => setConversaSelecionada(null)}
              />
            ) : (
              <Card>
                <CardContent className="py-16 text-center">
                  <MessagesSquare className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-500">Selecione uma conversa para ver as mensagens</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {abaAtiva === 'historico' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <History className="h-4 w-4" /> Histórico de mensagens
            </CardTitle>
          </CardHeader>
          <CardContent>
            <HistoricoMensagens />
          </CardContent>
        </Card>
      )}

      {abaAtiva === 'listas' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <List className="h-4 w-4" /> Listas de contatos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <GerenciarListas onUsarNoDisparo={handleUsarListaNoDisparo} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
