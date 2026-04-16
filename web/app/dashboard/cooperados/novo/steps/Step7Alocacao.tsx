'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  CheckCircle, Clock, Loader2, MapPin, RefreshCw, Send, User, Zap, FileText, ExternalLink,
} from 'lucide-react';
import type { Step2Data } from './Step2Dados';
import type { Step4Data } from './Step4Proposta';

interface CooperadoStatus {
  id: string;
  nomeCompleto: string;
  status: string;
}

interface PropostaStatus {
  id: string;
  status: string;
  tokenAssinatura: string | null;
  termoAdesaoAssinadoEm: string | null;
  procuracaoAssinadaEm: string | null;
  contratos: Array<{
    id: string;
    numero: string;
    status: string;
    usinaId: string | null;
    usina?: { nome: string } | null;
  }>;
}

interface ListaEsperaEntry {
  id: string;
  cooperadoId: string;
  status: string;
  posicao: number;
  contrato: { numero: string; status: string } | null;
}

interface UsinaDisponivel {
  id: string;
  nome: string;
  cidade: string;
  estado: string;
  distribuidora: string | null;
  capacidadeKwh: number | null;
  statusHomologacao: string;
}

interface Step7Props {
  dadosPessoais: Step2Data;
  propostaData: Step4Data;
  tipoMembro: string;
}

export default function Step7Alocacao({ dadosPessoais, propostaData, tipoMembro }: Step7Props) {
  const router = useRouter();
  const cooperadoId = dadosPessoais.cooperadoId;
  const propostaId = propostaData.propostaId;

  const [carregando, setCarregando] = useState(true);
  const [cooperado, setCooperado] = useState<CooperadoStatus | null>(null);
  const [proposta, setProposta] = useState<PropostaStatus | null>(null);
  const [listaEspera, setListaEspera] = useState<ListaEsperaEntry | null>(null);
  const [erro, setErro] = useState('');

  // Alocação
  const [usinas, setUsinas] = useState<UsinaDisponivel[]>([]);
  const [usinaSelecionada, setUsinaSelecionada] = useState('');
  const [alocando, setAlocando] = useState(false);

  // Reenvio
  const [reenviando, setReenviando] = useState(false);
  const [linkReenviado, setLinkReenviado] = useState('');

  const buscarStatus = useCallback(async () => {
    if (!cooperadoId || !propostaId) return;
    setCarregando(true);
    setErro('');
    try {
      const [coopRes, histRes, leRes] = await Promise.all([
        api.get<CooperadoStatus>(`/cooperados/${cooperadoId}`),
        api.get<PropostaStatus[]>(`/motor-proposta/historico/${cooperadoId}`),
        api.get<ListaEsperaEntry[]>('/motor-proposta/lista-espera').catch(() => ({ data: [] as ListaEsperaEntry[] })),
      ]);
      setCooperado(coopRes.data);
      const minhaProposta = histRes.data.find(p => p.id === propostaId) ?? histRes.data[0] ?? null;
      setProposta(minhaProposta);
      const minhaEspera = leRes.data.find(e => e.cooperadoId === cooperadoId && e.status === 'AGUARDANDO') ?? null;
      setListaEspera(minhaEspera);
    } catch {
      setErro('Erro ao carregar status. Clique em Atualizar para tentar novamente.');
    } finally {
      setCarregando(false);
    }
  }, [cooperadoId, propostaId]);

  useEffect(() => {
    buscarStatus();
  }, [buscarStatus]);

  // Buscar usinas quando em lista de espera
  useEffect(() => {
    if (!listaEspera) return;
    api.get<UsinaDisponivel[]>('/usinas').then(r => {
      const compat = r.data.filter(u =>
        u.statusHomologacao === 'HOMOLOGADA' || u.statusHomologacao === 'EM_PRODUCAO',
      );
      setUsinas(compat);
      if (compat.length > 0) setUsinaSelecionada(compat[0].id);
    }).catch(() => {});
  }, [listaEspera]);

  // Assinatura
  const ambosAssinados = !!(proposta?.termoAdesaoAssinadoEm && proposta?.procuracaoAssinadaEm);
  const contrato = proposta?.contratos?.[0] ?? null;
  const contratoAtivo = contrato && contrato.status !== 'LISTA_ESPERA';
  const tudo_concluido = ambosAssinados && contratoAtivo;

  // Confetti
  useEffect(() => {
    if (!tudo_concluido) return;
    (async () => {
      try {
        const confetti = (await import('canvas-confetti')).default;
        const fim = Date.now() + 3000;
        const frame = () => {
          confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0 }, colors: ['#22c55e', '#16a34a', '#4ade80', '#fbbf24', '#3b82f6'] });
          confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#22c55e', '#16a34a', '#4ade80', '#fbbf24', '#3b82f6'] });
          if (Date.now() < fim) requestAnimationFrame(frame);
        };
        frame();
      } catch {}
    })();
  }, [tudo_concluido]);

  async function reenviarLink() {
    setReenviando(true);
    setLinkReenviado('');
    try {
      const { data: resp } = await api.post<{ link?: string }>(`/motor-proposta/proposta/${propostaId}/enviar-assinatura`);
      if (resp.link) setLinkReenviado(resp.link);
      await buscarStatus();
    } catch {
      setErro('Erro ao reenviar link de assinatura.');
    } finally {
      setReenviando(false);
    }
  }

  async function alocarUsina() {
    if (!listaEspera || !usinaSelecionada) return;
    setAlocando(true);
    setErro('');
    try {
      await api.post(`/motor-proposta/lista-espera/${listaEspera.id}/alocar`, { usinaId: usinaSelecionada });
      setListaEspera(null);
      await buscarStatus();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setErro(msg || 'Erro ao alocar em usina.');
    } finally {
      setAlocando(false);
    }
  }

  const statusLabel: Record<string, string> = {
    PENDENTE: 'Pendente',
    PENDENTE_VALIDACAO: 'Pendente validação',
    PENDENTE_DOCUMENTOS: 'Aguardando documentos',
    APROVADO: 'Aprovado',
    ATIVO: 'Ativo',
    SUSPENSO: 'Suspenso',
    ENCERRADO: 'Encerrado',
  };

  const statusColor: Record<string, string> = {
    PENDENTE: 'bg-gray-100 text-gray-700',
    PENDENTE_VALIDACAO: 'bg-amber-100 text-amber-700',
    PENDENTE_DOCUMENTOS: 'bg-amber-100 text-amber-700',
    APROVADO: 'bg-blue-100 text-blue-700',
    ATIVO: 'bg-green-100 text-green-700',
    SUSPENSO: 'bg-red-100 text-red-700',
    ENCERRADO: 'bg-gray-100 text-gray-600',
  };

  if (carregando) {
    return (
      <div className="text-center py-12 space-y-4">
        <Loader2 className="h-8 w-8 text-green-600 mx-auto animate-spin" />
        <p className="text-sm text-gray-500">Carregando status...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-800 mb-1">Acompanhamento</h2>
          <p className="text-sm text-gray-500">Status consolidado do cadastro de {dadosPessoais.nomeCompleto}.</p>
        </div>
        <Button variant="outline" size="sm" onClick={buscarStatus} disabled={carregando}>
          <RefreshCw className="h-4 w-4 mr-2" /> Atualizar
        </Button>
      </div>

      {erro && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{erro}</div>}

      {/* 1. Status do cooperado */}
      <div className="border rounded-lg p-4 flex items-center gap-3">
        <User className="h-5 w-5 text-gray-600" />
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-800">{cooperado?.nomeCompleto ?? dadosPessoais.nomeCompleto}</p>
          <p className="text-xs text-gray-500">Status do cooperado</p>
        </div>
        <span className={`text-xs font-medium px-3 py-1 rounded-full ${statusColor[cooperado?.status ?? ''] ?? 'bg-gray-100 text-gray-600'}`}>
          {statusLabel[cooperado?.status ?? ''] ?? cooperado?.status ?? 'Desconhecido'}
        </span>
      </div>

      {/* 2. Status da assinatura */}
      <div className={`border rounded-lg p-4 space-y-3 ${ambosAssinados ? 'border-green-200 bg-green-50' : 'border-amber-200'}`}>
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-gray-600" />
          <h3 className="text-sm font-semibold text-gray-800">Assinatura</h3>
        </div>

        {ambosAssinados ? (
          <div className="flex items-center gap-2 text-sm text-green-700">
            <CheckCircle className="h-4 w-4" />
            <span className="font-medium">Termo e procuração assinados</span>
          </div>
        ) : (
          <>
            <div className="space-y-1 text-sm">
              <div className="flex items-center gap-2">
                {proposta?.termoAdesaoAssinadoEm
                  ? <><CheckCircle className="h-3 w-3 text-green-600" /> <span className="text-green-700">Termo assinado em {new Date(proposta.termoAdesaoAssinadoEm).toLocaleDateString('pt-BR')}</span></>
                  : <><Clock className="h-3 w-3 text-amber-500" /> <span className="text-amber-700">Termo pendente</span></>
                }
              </div>
              <div className="flex items-center gap-2">
                {proposta?.procuracaoAssinadaEm
                  ? <><CheckCircle className="h-3 w-3 text-green-600" /> <span className="text-green-700">Procuração assinada em {new Date(proposta.procuracaoAssinadaEm).toLocaleDateString('pt-BR')}</span></>
                  : <><Clock className="h-3 w-3 text-amber-500" /> <span className="text-amber-700">Procuração pendente</span></>
                }
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={reenviarLink} disabled={reenviando}>
              {reenviando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Reenviar link de assinatura
            </Button>
            {linkReenviado && (
              <div className="bg-gray-50 border border-gray-200 rounded-md p-2">
                <p className="text-xs text-gray-500 mb-1">Link reenviado:</p>
                <code className="text-xs text-gray-700 break-all">{linkReenviado}</code>
              </div>
            )}
          </>
        )}
      </div>

      {/* 3. Contrato / Alocação */}
      <div className={`border rounded-lg p-4 space-y-3 ${
        contratoAtivo ? 'border-green-200 bg-green-50' : listaEspera ? 'border-amber-200 bg-amber-50' : 'border-gray-200'
      }`}>
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-gray-600" />
          <h3 className="text-sm font-semibold text-gray-800">Contrato e usina</h3>
        </div>

        {contratoAtivo && (
          <div className="flex items-center gap-2 text-sm text-green-700">
            <CheckCircle className="h-4 w-4" />
            <span className="font-medium">
              Contrato #{contrato.numero} — {contrato.status === 'ATIVO' ? 'Ativo' : 'Pendente ativação'}
              {contrato.usina ? ` — Usina: ${contrato.usina.nome}` : ''}
            </span>
          </div>
        )}

        {listaEspera && (
          <>
            <div className="flex items-center gap-2 text-sm text-amber-700">
              <MapPin className="h-4 w-4" />
              <span>Lista de espera — posição {listaEspera.posicao}</span>
            </div>
            {usinas.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-gray-500">Alocar manualmente em usina:</p>
                <div className="flex gap-2">
                  <select
                    value={usinaSelecionada}
                    onChange={e => setUsinaSelecionada(e.target.value)}
                    className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    {usinas.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.nome} — {u.cidade}/{u.estado} ({u.capacidadeKwh?.toLocaleString('pt-BR') ?? '?'} kWh)
                      </option>
                    ))}
                  </select>
                  <Button size="sm" onClick={alocarUsina} disabled={alocando}>
                    {alocando ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Alocar'}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}

        {!contratoAtivo && !listaEspera && contrato && contrato.status === 'LISTA_ESPERA' && (
          <div className="text-sm text-amber-700">
            <Clock className="h-4 w-4 inline mr-1" />
            Contrato #{contrato.numero} em lista de espera. Clique em &quot;Atualizar&quot; para verificar alocação.
          </div>
        )}

        {!contrato && (
          <div className="text-sm text-gray-500">
            Nenhum contrato criado. Verifique se o cooperado tem UC cadastrada.
          </div>
        )}
      </div>

      {/* Conclusão */}
      {tudo_concluido && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-5 text-center space-y-2">
          <p className="text-2xl">🎉</p>
          <p className="text-lg font-bold text-green-700">Cadastro completo!</p>
          <p className="text-sm text-green-600">
            {dadosPessoais.nomeCompleto} está com contrato ativo e documentos assinados.
          </p>
        </div>
      )}

      {/* Ações finais */}
      <div className="flex gap-3 pt-2">
        <Button onClick={() => router.push(`/dashboard/cooperados/${cooperadoId}`)} className="flex-1">
          <ExternalLink className="h-4 w-4 mr-2" />
          Ver perfil completo
        </Button>
        <Button variant="outline" onClick={() => router.push('/dashboard/cooperados/novo')} className="flex-1">
          Cadastrar outro
        </Button>
      </div>
    </div>
  );
}
