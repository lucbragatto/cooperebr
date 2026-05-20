'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { CheckCheck } from 'lucide-react';
import { PhoneFrame } from './PhoneFrame';

interface PreviewModeloResponse {
  encontrado: boolean;
  modeloId: string;
  modeloNome: string | null;
  categoria: string | null;
  texto: string | null;
  variaveisUsadas: Record<string, string>;
  escopo: 'TENANT' | 'GLOBAL' | null;
}

interface PreviewModeloProps {
  modeloId: string;
  cooperativaId?: string | null;
  onFechar: () => void;
}

function formatarHoraNow(): string {
  return new Date().toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  });
}

/**
 * Modal de pré-visualização isolada de modelo de mensagem.
 *
 * Bate em POST /whatsapp/preview-modelo (backend Fase C), que renderiza
 * o template com as variáveis do tenant logado sem disparar fluxo nem
 * incrementar contador de uso. Mostra a mensagem dentro do PhoneFrame
 * como o cooperado veria, mais o painel lateral com variáveis efetivamente
 * substituídas.
 *
 * Não recebe input do usuário — é só visualização. Diferente do
 * SimuladorCelular, que é interativo.
 */
export function PreviewModelo({
  modeloId,
  cooperativaId = null,
  onFechar,
}: PreviewModeloProps) {
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [resposta, setResposta] = useState<PreviewModeloResponse | null>(null);

  useEffect(() => {
    let cancelado = false;
    setLoading(true);
    setErro(null);
    api
      .post<PreviewModeloResponse>('/whatsapp/preview-modelo', {
        modeloId,
        cooperativaId,
      })
      .then((r) => {
        if (cancelado) return;
        setResposta(r.data);
        if (!r.data.encontrado) {
          setErro('Modelo não encontrado ou fora do escopo do seu tenant.');
        }
      })
      .catch(() => {
        if (cancelado) return;
        setErro('Erro ao buscar pré-visualização do modelo.');
      })
      .finally(() => {
        if (!cancelado) setLoading(false);
      });

    return () => {
      cancelado = true;
    };
  }, [modeloId, cooperativaId]);

  // Variáveis que de fato apareceram no texto renderizado (filtrar só as usadas)
  const variaveisRelevantes = (() => {
    if (!resposta?.variaveisUsadas) return [] as Array<[string, string]>;
    return Object.entries(resposta.variaveisUsadas).filter(
      ([, v]) => typeof v === 'string' && v.length > 0,
    );
  })();

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onFechar(); }}>
      <DialogContent className="max-w-fit p-6">
        <div className="flex gap-6 items-start">
          {/* PhoneFrame com a mensagem renderizada */}
          <div className="w-[280px]">
            <PhoneFrame
              nomeContato="Assis"
              subtitulo={resposta?.modeloNome ?? 'Pré-visualização'}
            >
              {loading && (
                <div className="self-start bg-white rounded-tr-xl rounded-br-xl rounded-tl-sm p-2 px-3 shadow-sm">
                  <span className="text-gray-400 animate-pulse text-sm">···</span>
                </div>
              )}

              {erro && (
                <div className="self-center bg-red-50 border border-red-200 text-red-700 text-xs rounded px-2 py-1 max-w-[90%] italic">
                  {erro}
                </div>
              )}

              {resposta?.texto && (
                <div className="flex flex-col self-start max-w-[85%]">
                  <div className="bg-white rounded-tr-xl rounded-br-xl rounded-tl-sm p-2 text-sm shadow-sm whitespace-pre-wrap">
                    {resposta.texto}
                  </div>
                  <div className="text-[10px] text-gray-400 mt-0.5 text-left flex items-center gap-0.5">
                    <span>{formatarHoraNow()}</span>
                    <CheckCheck className="w-3 h-3 text-blue-500" />
                  </div>
                </div>
              )}
            </PhoneFrame>
          </div>

          {/* Painel lateral: info do modelo + variáveis usadas */}
          <div className="w-64 self-start space-y-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Modelo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {resposta?.modeloNome && (
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">
                      Nome
                    </p>
                    <p className="text-sm font-medium">{resposta.modeloNome}</p>
                  </div>
                )}
                {resposta?.categoria && (
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">
                      Categoria
                    </p>
                    <Badge variant="outline" className="text-xs">{resposta.categoria}</Badge>
                  </div>
                )}
                {resposta?.escopo && (
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">
                      Escopo
                    </p>
                    <Badge
                      variant={resposta.escopo === 'TENANT' ? 'default' : 'secondary'}
                      className="text-[10px] px-1.5 py-0"
                    >
                      {resposta.escopo === 'TENANT' ? 'do parceiro' : 'global'}
                    </Badge>
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground border-t pt-2 italic">
                  Pré-visualização — não envia WhatsApp real, não conta usos,
                  não persiste nada.
                </p>
              </CardContent>
            </Card>

            {variaveisRelevantes.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Variáveis substituídas</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="text-xs space-y-1 max-h-48 overflow-y-auto">
                    {variaveisRelevantes.map(([k, v]) => (
                      <li key={k} className="flex items-baseline gap-1">
                        <code className="text-purple-700 font-mono text-[10px]">
                          {`{{${k}}}`}
                        </code>
                        <span className="text-gray-400">→</span>
                        <span className="truncate text-gray-700">{v}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-[10px] text-muted-foreground mt-2 italic">
                    Variáveis que apareceram com valor não-vazio. Vars vazias
                    foram omitidas.
                  </p>
                </CardContent>
              </Card>
            )}

            <Button variant="outline" size="sm" onClick={onFechar} className="w-full">
              Fechar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
