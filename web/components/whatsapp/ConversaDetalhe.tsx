'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ArrowLeft, Check, CheckCheck, Loader2, Send, User,
} from 'lucide-react';

interface Mensagem {
  id: string;
  telefone: string;
  direcao: string;
  tipo: string;
  conteudo: string | null;
  status: string;
  enviadaEm: string;
}

interface ConversaDetalheProps {
  telefone: string;
  onVoltar: () => void;
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'LIDA':
      return <CheckCheck className="h-3 w-3 text-blue-500" />;
    case 'ENTREGUE':
      return <CheckCheck className="h-3 w-3 text-gray-400" />;
    case 'ENVIADA':
      return <Check className="h-3 w-3 text-gray-400" />;
    case 'FALHOU':
      return <span className="text-[10px] text-red-500">falhou</span>;
    default:
      return null;
  }
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const hoje = new Date();
  if (d.toDateString() === hoje.toDateString()) return 'Hoje';
  const ontem = new Date(hoje);
  ontem.setDate(ontem.getDate() - 1);
  if (d.toDateString() === ontem.toDateString()) return 'Ontem';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function ConversaDetalhe({ telefone, onVoltar }: ConversaDetalheProps) {
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [loading, setLoading] = useState(true);
  const [textoNovo, setTextoNovo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchMensagens = useCallback(async () => {
    try {
      const { data } = await api.get<Mensagem[]>(`/whatsapp/historico/${telefone}`);
      setMensagens(data);
    } catch {
      setMensagens([]);
    } finally {
      setLoading(false);
    }
  }, [telefone]);

  useEffect(() => {
    fetchMensagens();
    const interval = setInterval(fetchMensagens, 10000);
    return () => clearInterval(interval);
  }, [fetchMensagens]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [mensagens]);

  async function enviarMensagem() {
    if (!textoNovo.trim()) return;
    setEnviando(true);
    try {
      await api.post('/whatsapp/enviar-mensagem', { telefone, texto: textoNovo.trim() });
      setTextoNovo('');
      await fetchMensagens();
    } catch {
      // silently fail
    } finally {
      setEnviando(false);
    }
  }

  const telefoneFormatado = telefone.replace(/(\d{2})(\d{2})(\d{5})(\d{4})/, '+$1 ($2) $3-$4');

  // Group messages by date
  const groupedByDate: { date: string; msgs: Mensagem[] }[] = [];
  let lastDate = '';
  for (const msg of mensagens) {
    const d = formatDate(msg.enviadaEm);
    if (d !== lastDate) {
      groupedByDate.push({ date: d, msgs: [] });
      lastDate = d;
    }
    groupedByDate[groupedByDate.length - 1].msgs.push(msg);
  }

  return (
    <div className="flex flex-col h-[600px] border border-gray-200 rounded-xl bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-green-600 text-white">
        <button onClick={onVoltar} className="hover:bg-green-700 rounded p-1 transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="w-8 h-8 rounded-full bg-green-700 flex items-center justify-center text-sm font-bold">
          <User className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-semibold">{telefoneFormatado}</p>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-1 bg-[#e5ddd5]">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : mensagens.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">
            Nenhuma mensagem encontrada
          </div>
        ) : (
          groupedByDate.map((group) => (
            <div key={group.date}>
              <div className="flex justify-center my-2">
                <span className="bg-white/80 text-gray-600 text-[10px] px-3 py-1 rounded-full shadow-sm">
                  {group.date}
                </span>
              </div>
              {group.msgs.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.direcao === 'SAIDA' ? 'justify-end' : 'justify-start'} mb-1`}
                >
                  <div
                    className={`max-w-[75%] rounded-lg px-3 py-1.5 shadow-sm text-sm ${
                      msg.direcao === 'SAIDA'
                        ? 'bg-[#dcf8c6] text-gray-800 rounded-tr-none'
                        : 'bg-white text-gray-800 rounded-tl-none'
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{msg.conteudo ?? ''}</p>
                    <div className={`flex items-center gap-1 mt-0.5 ${msg.direcao === 'SAIDA' ? 'justify-end' : ''}`}>
                      <span className="text-[10px] text-gray-500">{formatTime(msg.enviadaEm)}</span>
                      {msg.direcao === 'SAIDA' && <StatusIcon status={msg.status} />}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 border-t border-gray-200">
        <Input
          value={textoNovo}
          onChange={(e) => setTextoNovo(e.target.value)}
          placeholder="Digite uma mensagem..."
          className="flex-1 text-sm"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              enviarMensagem();
            }
          }}
          disabled={enviando}
        />
        <Button
          size="sm"
          onClick={enviarMensagem}
          disabled={enviando || !textoNovo.trim()}
          className="bg-green-600 hover:bg-green-700"
        >
          {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
