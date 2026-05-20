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
  modeloId?: string | null;
  modeloNome?: string | null;
  // backend retorna o texto renderizado em "texto" (motor.SimulacaoMensagem.texto)
  texto: string;
  variaveisUsadas?: Record<string, string>;
}

interface GatilhoResumo {
  resposta: string;
  proximoEstado: string;
}

interface EtapaResumo {
  id: string;
  nome: string;
  estado: string;
  escopo: 'TENANT' | 'GLOBAL';
  modeloMensagemId: string | null;
  acaoAutomatica: string | null;
  gatilhos: GatilhoResumo[];
}

interface RespostaSimular {
  estadoInicial: string;
  estadoFinal: string;
  transicionou: boolean;
  gatilhoAvaliado?: string | null;
  motivoFallback?: string | null;
  mensagensEnviadas?: MensagemSimulacao[];
  acaoAutomatica?: string | null;
  etapaAtual: EtapaResumo | null;
  etapaProxima: EtapaResumo | null;
  mensagemEtapaAtual: string | null;
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
  const [etapaAtualResumo, setEtapaAtualResumo] = useState<EtapaResumo | null>(null);
  const [etapaProximaResumo, setEtapaProximaResumo] = useState<EtapaResumo | null>(null);
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

        // backend retorna campo "texto" (Fase A: type alinhado com o motor)
        const novasBolhas: BolhaHistorico[] = (data.mensagensEnviadas ?? []).map(
          (m) => ({
            role: 'bot',
            conteudo: m.texto,
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
        // Fase A: atualizar painel de estado com etapa que o motor de fato selecionou
        setEtapaAtualResumo(data.etapaAtual ?? null);
        setEtapaProximaResumo(data.etapaProxima ?? null);
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

  // Bolha inicial de orientacao + carrega resumo da etapa atual (sem simular gatilho fake).
  // Antes (bug latente): chamava simular('inicio') -> motor avaliava gatilho INICIO,
  // nunca casava, sempre caia em fallback "Nenhum gatilho bateu" -> bolha amarela confusa.
  useEffect(() => {
    if (iniciadoRef.current) return;
    iniciadoRef.current = true;
    setHistorico([
      {
        role: 'sistema',
        conteudo:
          '[sistema] Simulador pronto. Digite o que o cooperado responderia ao bot e veja como o fluxo reage. Zero side effects.',
        timestamp: new Date(),
      },
    ]);
    // Carrega resumo da etapa inicial via ping (motor retorna etapaAtual mesmo sem gatilho casar).
    (async () => {
      try {
        const { data } = await api.post<RespostaSimular>('/whatsapp/simular', {
          mensagem: '__simulador_ping__',
          cooperativaId: cooperativaId ?? null,
          estadoInicial: etapaInicial,
        });
        setEtapaAtualResumo(data.etapaAtual ?? null);
        if (!data.etapaAtual) {
          setHistorico((prev) => [
            ...prev,
            {
              role: 'sistema',
              conteudo: `[sistema] Nenhuma etapa dinâmica ativa para o estado "${etapaInicial}". Cooperado cairia no fallback hardcoded.`,
              timestamp: new Date(),
            },
          ]);
        } else if (data.mensagemEtapaAtual) {
          // Sub-debito UX: bolha inicial do bot mostra a mensagem da etapa atual
          // (o que o cooperado veria ao entrar). Elimina "digitei e nao sei o que aconteceu".
          setHistorico((prev) => [
            ...prev,
            {
              role: 'bot',
              conteudo: data.mensagemEtapaAtual as string,
              timestamp: new Date(),
            },
          ]);
        }
      } catch {
        // usuario ainda pode interagir — apenas sem o resumo
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    setHistorico([
      {
        role: 'sistema',
        conteudo:
          '[sistema] Simulador reiniciado. Digite o que o cooperado responderia ao bot.',
        timestamp: new Date(),
      },
    ]);
    setEstadoAtual(etapaInicial);
    setEncerrado(false);
    setAcoesAutomaticas([]);
    setEtapaProximaResumo(null);
    // Recarrega resumo da etapa inicial via ping (mesmo padrao do mount)
    (async () => {
      try {
        const { data } = await api.post<RespostaSimular>('/whatsapp/simular', {
          mensagem: '__simulador_ping__',
          cooperativaId: cooperativaId ?? null,
          estadoInicial: etapaInicial,
        });
        setEtapaAtualResumo(data.etapaAtual ?? null);
        if (data.etapaAtual && data.mensagemEtapaAtual) {
          setHistorico((prev) => [
            ...prev,
            {
              role: 'bot',
              conteudo: data.mensagemEtapaAtual as string,
              timestamp: new Date(),
            },
          ]);
        }
      } catch {
        // ignora
      }
    })();
  };

  const handleAtalho = (resposta: string) => {
    if (loading || encerrado) return;
    setHistorico((prev) => [
      ...prev,
      { role: 'user', conteudo: resposta, timestamp: new Date() },
    ]);
    simular(resposta);
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onFechar(); }}>
      <DialogContent className="max-w-fit p-6">
        <div className="flex gap-6 items-start">
          {/* Lado esquerdo: PhoneFrame + Input */}
          <div className="w-[280px] flex flex-col gap-2">
            <PhoneFrame
              nomeContato="Assis"
              subtitulo={etapaAtualResumo ? `${etapaAtualResumo.nome} · ${estadoAtual}` : estadoAtual}
            >
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

            {/* Sub-debito UX: atalhos clicaveis pros gatilhos literais da etapa atual.
                Wildcard "*" nao vira botao porque significa "qualquer texto".
                Micro-help acima (regra regra_help_automatico_paginas_19_05). */}
            {etapaAtualResumo?.gatilhos &&
              etapaAtualResumo.gatilhos.filter((g) => g.resposta !== '*').length > 0 && (
                <div className="flex flex-col gap-1">
                  <p className="text-[10px] text-muted-foreground">
                    Clique numa resposta abaixo ou digite a sua no campo.
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {etapaAtualResumo.gatilhos
                      .filter((g) => g.resposta !== '*')
                      .map((g, i) => (
                        <Button
                          key={`atalho-${i}`}
                          size="sm"
                          variant="outline"
                          disabled={loading || encerrado}
                          onClick={() => handleAtalho(g.resposta)}
                          className="text-xs h-7 px-2"
                          title={`Envia "${g.resposta}" → ${g.proximoEstado}`}
                        >
                          {g.resposta}
                        </Button>
                      ))}
                  </div>
                </div>
              )}
          </div>

          {/* Lado direito: painel de estado */}
          <div className="w-64 self-start space-y-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Estado atual</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Estado</p>
                  <Badge variant="outline" className="font-mono text-xs">
                    {estadoAtual}
                  </Badge>
                </div>

                {etapaAtualResumo ? (
                  <div className="pt-1 border-t">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">
                      Etapa em uso
                    </p>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-medium text-gray-800">
                        {etapaAtualResumo.nome}
                      </span>
                      <Badge
                        variant={etapaAtualResumo.escopo === 'TENANT' ? 'default' : 'secondary'}
                        className="text-[10px] px-1.5 py-0"
                      >
                        {etapaAtualResumo.escopo === 'TENANT' ? 'do parceiro' : 'global'}
                      </Badge>
                    </div>
                  </div>
                ) : (
                  <div className="pt-1 border-t">
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                      ⚠️ Nenhuma etapa ativa para este estado. Crie/ative uma etapa em
                      &quot;Fluxo do Bot&quot;.
                    </p>
                  </div>
                )}

                {etapaProximaResumo && (
                  <div className="pt-1 border-t">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">
                      Transicionou para
                    </p>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm text-gray-700">{etapaProximaResumo.nome}</span>
                      <Badge
                        variant={etapaProximaResumo.escopo === 'TENANT' ? 'default' : 'secondary'}
                        className="text-[10px] px-1.5 py-0"
                      >
                        {etapaProximaResumo.escopo === 'TENANT' ? 'do parceiro' : 'global'}
                      </Badge>
                    </div>
                  </div>
                )}

                {/* Sub-debito UX: lista de respostas aceitas pela etapa atual.
                    Wildcard "*" vira "qualquer texto". Vazio = etapa cai em fallback. */}
                {etapaAtualResumo && (
                  <div className="pt-1 border-t">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">
                      Respostas que o bot aceita
                    </p>
                    {etapaAtualResumo.gatilhos && etapaAtualResumo.gatilhos.length > 0 ? (
                      <ul className="space-y-1">
                        {etapaAtualResumo.gatilhos.map((g, i) => (
                          <li key={`gatilho-${i}`} className="flex items-center gap-1.5 text-xs">
                            <Badge variant="outline" className="font-mono text-[10px] px-1.5 py-0">
                              {g.resposta === '*' ? 'qualquer texto' : g.resposta}
                            </Badge>
                            <span className="text-gray-400">→</span>
                            <span className="font-mono text-gray-700 text-[11px]">
                              {g.proximoEstado}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                        ⚠️ Esta etapa não tem gatilhos — qualquer resposta cai em fallback hardcoded.
                      </p>
                    )}
                  </div>
                )}

                <p className="text-[10px] text-muted-foreground border-t pt-2 italic">
                  Simulação in-memory — não envia WhatsApp real, não cria conversa,
                  não conta usos.
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
