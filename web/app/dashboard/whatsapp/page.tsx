'use client';

import { useEffect, useRef, useState } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft, FileUp, Loader2, MessageCircle, Upload, Wifi, WifiOff,
  Send, Gift, RefreshCw, Users, Clock,
} from 'lucide-react';
import Link from 'next/link';

interface ResultadoSimulacao {
  sucesso: boolean;
  mensagemWhatsApp: string;
  propostaId?: string;
  dadosExtraidos?: Record<string, unknown>;
}

interface StatusBaileys {
  status: string;
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
  // Status Baileys
  const [status, setStatus] = useState<StatusBaileys | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  // Conversas
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [loadingConversas, setLoadingConversas] = useState(true);

  // Disparos
  const [disparandoCobrancas, setDisparandoCobrancas] = useState(false);
  const [resultadoCobrancas, setResultadoCobrancas] = useState<ResultadoDisparo | null>(null);
  const [disparandoMLM, setDisparandoMLM] = useState(false);
  const [resultadoMLM, setResultadoMLM] = useState<ResultadoDisparo | null>(null);
  const [mesReferencia, setMesReferencia] = useState('');

  // Simulação manual
  const [telefone, setTelefone] = useState('');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<ResultadoSimulacao | null>(null);
  const [erro, setErro] = useState('');
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Confirmações
  const [confirmCobranca, setConfirmCobranca] = useState(false);
  const [confirmMLM, setConfirmMLM] = useState(false);

  useEffect(() => {
    carregarDados();
  }, []);

  async function carregarDados() {
    setLoadingStatus(true);
    setLoadingConversas(true);
    try {
      const [statusRes, conversasRes] = await Promise.all([
        api.get<StatusBaileys>('/whatsapp/status').catch(() => ({ data: { status: 'erro' } as StatusBaileys })),
        api.get<Conversa[]>('/whatsapp/conversas').catch(() => ({ data: [] as Conversa[] })),
      ]);
      setStatus(statusRes.data);
      setConversas(conversasRes.data);
    } finally {
      setLoadingStatus(false);
      setLoadingConversas(false);
    }
  }

  // Disparar cobranças
  async function dispararCobrancas() {
    setDisparandoCobrancas(true);
    setResultadoCobrancas(null);
    try {
      const { data } = await api.post<ResultadoDisparo>('/whatsapp/disparar-cobrancas', {
        mesReferencia: mesReferencia || undefined,
      });
      setResultadoCobrancas(data);
    } catch {
      setResultadoCobrancas({ total: 0, enviados: 0, erros: -1 });
    } finally {
      setDisparandoCobrancas(false);
      setConfirmCobranca(false);
    }
  }

  // Disparar convites MLM
  async function dispararMLM() {
    setDisparandoMLM(true);
    setResultadoMLM(null);
    try {
      const { data } = await api.post<ResultadoDisparo>('/whatsapp/disparar-convites-indicacao');
      setResultadoMLM(data);
    } catch {
      setResultadoMLM({ total: 0, enviados: 0, erros: -1 });
    } finally {
      setDisparandoMLM(false);
      setConfirmMLM(false);
    }
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
  const conversasAtivas = conversas.filter(c => c.estado !== 'CONCLUIDO' && c.estado !== 'INICIAL');
  const conversasHoje = conversas.filter(c => {
    const d = new Date(c.updatedAt);
    const hoje = new Date();
    return d.toDateString() === hoje.toDateString();
  });

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
                <p className={`text-xs font-semibold ${isConnected ? 'text-green-600' : 'text-red-500'}`}>
                  {loadingStatus ? 'Verificando...' : isConnected ? 'Conectado' : status?.status === 'awaiting_qr' ? 'Aguardando QR Code' : 'Desconectado'}
                </p>
              </div>
            </div>
            {status?.qrCode && !isConnected && (
              <div className="mt-3 p-2 bg-gray-50 rounded text-center">
                <p className="text-xs text-gray-500 mb-1">Escaneie com WhatsApp:</p>
                <pre className="text-[6px] leading-none font-mono whitespace-pre overflow-auto max-h-32">{status.qrCode}</pre>
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
        {/* Disparar cobranças */}
        <Card>
          <CardHeader><CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2"><Send className="h-4 w-4" /> Disparar cobranças do mês</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className={lbl}>Mês/Ano referência (opcional)</label>
              <input className={cls} value={mesReferencia} onChange={e => setMesReferencia(e.target.value)} placeholder="03/2026 (vazio = mês atual)" />
            </div>
            {!confirmCobranca ? (
              <Button onClick={() => setConfirmCobranca(true)} disabled={disparandoCobrancas || !isConnected} className="w-full" variant="outline">
                <Send className="h-4 w-4 mr-2" />Disparar cobranças via WhatsApp
              </Button>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-orange-600 font-medium">Tem certeza? Isso enviará mensagens para todos os cooperados com cobranças pendentes.</p>
                <div className="flex gap-2">
                  <Button onClick={dispararCobrancas} disabled={disparandoCobrancas} className="flex-1" variant="default">
                    {disparandoCobrancas ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Enviando...</> : 'Confirmar envio'}
                  </Button>
                  <Button onClick={() => setConfirmCobranca(false)} variant="ghost" className="flex-1">Cancelar</Button>
                </div>
              </div>
            )}
            {resultadoCobrancas && (
              <div className={`text-xs p-2 rounded ${resultadoCobrancas.erros === -1 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>
                {resultadoCobrancas.erros === -1
                  ? 'Erro ao disparar cobranças. Verifique os logs.'
                  : `Resultado: ${resultadoCobrancas.enviados} enviados de ${resultadoCobrancas.total} | ${resultadoCobrancas.erros} erros`}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Disparar convites MLM */}
        <Card>
          <CardHeader><CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2"><Gift className="h-4 w-4" /> Enviar convites de indicação</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-gray-500">Envia mensagem com link personalizado de indicação para todos os cooperados ativos com contrato.</p>
            {!confirmMLM ? (
              <Button onClick={() => setConfirmMLM(true)} disabled={disparandoMLM || !isConnected} className="w-full" variant="outline">
                <Gift className="h-4 w-4 mr-2" />Enviar convites MLM
              </Button>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-orange-600 font-medium">Tem certeza? Isso enviará convites para todos os cooperados ativos.</p>
                <div className="flex gap-2">
                  <Button onClick={dispararMLM} disabled={disparandoMLM} className="flex-1" variant="default">
                    {disparandoMLM ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Enviando...</> : 'Confirmar envio'}
                  </Button>
                  <Button onClick={() => setConfirmMLM(false)} variant="ghost" className="flex-1">Cancelar</Button>
                </div>
              </div>
            )}
            {resultadoMLM && (
              <div className={`text-xs p-2 rounded ${resultadoMLM.erros === -1 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>
                {resultadoMLM.erros === -1
                  ? 'Erro ao enviar convites. Verifique os logs.'
                  : `Resultado: ${resultadoMLM.enviados} enviados de ${resultadoMLM.total} | ${resultadoMLM.erros} erros`}
              </div>
            )}
          </CardContent>
        </Card>
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
