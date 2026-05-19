'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { CheckCheck, RotateCcw, Send } from 'lucide-react';
import { PhoneFrame } from './PhoneFrame';

interface MensagemSimulacao {
  tipo?: 'TEXTO' | 'IMAGEM' | 'AUDIO' | string;
  conteudo: string;
  modeloId?: string | null;
  modeloNome?: string | null;
}

interface RespostaSimular {
  estadoInicial: string;
  estadoFinal: string;
  transicionou: boolean;
  gatilhoAvaliado?: string | null;
  motivoFallback?: string | null;
  mensagensEnviadas?: MensagemSimulacao[];
  acaoAutomatica?: string | null;
}

interface BolhaHistorico {
  role: 'bot' | 'user' | 'sistema';
  conteudo: string;
  timestamp: Date;
}

interface SimuladorCelularProps {
  cooperativaId?: string | null;
  etapaInicial?: string;
  onFechar: () => void;
}

function formatarHora(d: Date): string {
  return d.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  });
}

export function SimuladorCelular({
  cooperativaId = null,
  etapaInicial = 'INICIAL',
  onFechar,
}: SimuladorCelularProps) {
  const [historico, setHistorico] = useState<BolhaHistorico[]>([]);
  const [estadoAtual, setEstadoAtual] = useState<string>(etapaInicial);
  const [inputUsuario, setInputUsuario] = useState('');
  const [loading, setLoading] = useState(false);
  const [encerrado, setEncerrado] = useState(false);
  const [acoesAutomaticas, setAcoesAutomaticas] = useState<string[]>([]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const iniciadoRef = useRef(false);

  const simular = useCallback(
    async (mensagem: string) => {
      setLoading(true);
      try {
        const { data } = await api.post<RespostaSimular>('/whatsapp/simular', {
          mensagem,
          cooperativaId: cooperativaId ?? null,
          estadoInicial: estadoAtual,
        });

        const novasBolhas: BolhaHistorico[] = (data.mensagensEnviadas ?? []).map(
          (m) => ({
            role: 'bot',
            conteudo: m.conteudo,
            timestamp: new Date(),
          }),
        );

        if (!data.transicionou && data.motivoFallback) {
          novasBolhas.push({
            role: 'sistema',
            conteudo: `[sistema] ${data.motivoFallback}`,
            timestamp: new Date(),
          });
        }

        setHistorico((prev) => [...prev, ...novasBolhas]);
        if (data.transicionou) {
          setEstadoAtual(data.estadoFinal);
        }
        if (data.acaoAutomatica) {
          setAcoesAutomaticas((prev) => [...prev, data.acaoAutomatica as string]);
        }
      } catch (err) {
        setHistorico((prev) => [
          ...prev,
          {
            role: 'sistema',
            conteudo: '[sistema] Erro ao chamar /whatsapp/simular',
            timestamp: new Date(),
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [cooperativaId, estadoAtual],
  );

  // Boas-vindas ao montar
  useEffect(() => {
    if (iniciadoRef.current) return;
    iniciadoRef.current = true;
    simular('início');
  }, [simular]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [historico, loading]);

  const handleEnviar = () => {
    if (!inputUsuario.trim() || loading || encerrado) return;
    const mensagem = inputUsuario.trim();
    setHistorico((prev) => [
      ...prev,
      { role: 'user', conteudo: mensagem, timestamp: new Date() },
    ]);
    setInputUsuario('');
    simular(mensagem);
  };

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleEnviar();
    }
  };

  const handleReiniciar = () => {
    setHistorico([]);
    setEstadoAtual(etapaInicial);
    setEncerrado(false);
    setAcoesAutomaticas([]);
    iniciadoRef.current = false;
    // Reinicia via efeito (useEffect detecta iniciadoRef = false → chama simular)
    setTimeout(() => {
      if (!iniciadoRef.current) {
        iniciadoRef.current = true;
        simular('início');
      }
    }, 0);
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onFechar(); }}>
      <DialogContent className="max-w-fit p-6">
        <div className="flex gap-6 items-start">
          {/* Lado esquerdo: PhoneFrame + Input */}
          <div className="w-[280px] flex flex-col gap-2">
            <PhoneFrame nomeContato="Assis" subtitulo={estadoAtual}>
              <div ref={scrollRef} className="flex flex-col gap-2 h-full">
                {historico.map((b, i) => {
                  if (b.role === 'sistema') {
                    return (
                      <div
                        key={i}
                        className="self-center bg-yellow-50 border border-yellow-200 text-yellow-800 text-xs rounded px-2 py-1 max-w-[90%] italic"
                      >
                        {b.conteudo}
                      </div>
                    );
                  }
                  const isBot = b.role === 'bot';
                  return (
                    <div
                      key={i}
                      className={`flex flex-col ${isBot ? 'self-start' : 'self-end'} max-w-[85%]`}
                    >
                      <div
                        className={
                          isBot
                            ? 'bg-white rounded-tr-xl rounded-br-xl rounded-tl-sm p-2 text-sm shadow-sm whitespace-pre-wrap'
                            : 'bg-[#DCF8C6] rounded-tl-xl rounded-bl-xl rounded-tr-sm p-2 text-sm shadow-sm whitespace-pre-wrap'
                        }
                      >
                        {b.conteudo}
                      </div>
                      <div
                        className={`text-[10px] text-gray-400 mt-0.5 ${isBot ? 'text-left' : 'text-right flex justify-end items-center gap-0.5'}`}
                      >
                        <span>{formatarHora(b.timestamp)}</span>
                        {!isBot && <CheckCheck className="w-3 h-3 text-blue-500" />}
                      </div>
                    </div>
                  );
                })}

                {loading && (
                  <div className="self-start bg-white rounded-tr-xl rounded-br-xl rounded-tl-sm p-2 px-3 shadow-sm">
                    <span className="text-gray-400 animate-pulse text-sm">···</span>
                  </div>
                )}
              </div>
            </PhoneFrame>

            <div className="flex gap-1">
              <Input
                value={inputUsuario}
                onChange={(e) => setInputUsuario(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Digite sua resposta..."
                disabled={loading || encerrado}
                className="text-sm"
              />
              <Button
                size="sm"
                onClick={handleEnviar}
                disabled={loading || encerrado || !inputUsuario.trim()}
                className="bg-green-600 hover:bg-green-700 text-white shrink-0"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Lado direito: painel de estado */}
          <div className="w-64 self-start space-y-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Estado atual</CardTitle>
              </CardHeader>
              <CardContent>
                <Badge variant="outline" className="font-mono text-xs">
                  {estadoAtual}
                </Badge>
                <p className="text-xs text-gray-500 mt-2">
                  Simulação in-memory — zero side effects (não cria conversa, não
                  envia WhatsApp real, não conta usos).
                </p>
              </CardContent>
            </Card>

            {acoesAutomaticas.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Ações reportadas</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="text-xs space-y-1">
                    {acoesAutomaticas.map((a, i) => (
                      <li key={i} className="text-purple-700">⚡ {a}</li>
                    ))}
                  </ul>
                  <p className="text-[10px] text-gray-400 mt-2 italic">
                    Em simulação, ações são apenas reportadas — nunca executadas.
                  </p>
                </CardContent>
              </Card>
            )}

            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleReiniciar}
                disabled={loading}
              >
                <RotateCcw className="w-4 h-4 mr-1" /> Reiniciar
              </Button>
              <Button variant="outline" size="sm" onClick={onFechar}>
                Fechar
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
