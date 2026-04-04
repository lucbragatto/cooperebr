'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Users,
  Gift,
  Copy,
  Check,
  MessageCircle,
  UserPlus,
  Clock,
  CheckCircle,
  TrendingUp,
} from 'lucide-react';

import BadgeNivelClube from '@/components/BadgeNivelClube';

interface Indicacao {
  id: string;
  cooperadoIndicado: {
    nomeCompleto: string;
    status: string;
  };
  status: string;
  createdAt: string;
}

interface PerfilIndicacao {
  id: string;
  codigoIndicacao: string;
  indicacoesFeitas: Indicacao[];
  beneficiosIndicacao: {
    tipo: string;
    valorCalculado: number;
    status: string;
  }[];
}

interface Progressao {
  nivelAtual: string;
  kwhIndicadoAcumulado: number;
  indicadosAtivos: number;
  beneficioPercentualAtual: number;
}

const NIVEL_ORDEM: Record<string, number> = { BRONZE: 0, PRATA: 1, OURO: 2, DIAMANTE: 3 };
const NIVEIS = ['BRONZE', 'PRATA', 'OURO', 'DIAMANTE'];
const NIVEL_KWH_MIN: Record<string, number> = { BRONZE: 0, PRATA: 500, OURO: 2000, DIAMANTE: 5000 };
const NIVEL_KWH_MAX: Record<string, number> = { BRONZE: 500, PRATA: 2000, OURO: 5000, DIAMANTE: 10000 };

export default function PortalIndicacoesPage() {
  const [dados, setDados] = useState<PerfilIndicacao | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [copiado, setCopiado] = useState(false);
  const [linkConvite, setLinkConvite] = useState('');
  const [progressao, setProgressao] = useState<Progressao | null>(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    const progressaoPromise = api.get('/clube-vantagens/minha-progressao').then(r => r).catch(() => ({ data: null }));
    Promise.all([
      api.get('/cooperados/meu-perfil'),
      api.get('/indicacoes/meu-link').catch(() => ({ data: null })),
      progressaoPromise,
    ])
      .then(([perfilRes, linkRes, progRes]) => {
        setDados(perfilRes.data);
        if (progRes?.data) setProgressao(progRes.data);
        const codigo = linkRes?.data?.codigoIndicacao ?? linkRes?.data?.codigo;
        const linkBackend = linkRes?.data?.link;
        if (linkBackend) {
          setLinkConvite(linkBackend);
        } else if (codigo) {
          setLinkConvite(`${window.location.origin}/convite/${codigo}`);
        }
      })
      .catch(() => setErro('Erro ao carregar dados de indicaÃ§Ãµes. Tente novamente mais tarde.'))
      .finally(() => setCarregando(false));
  }, []);

  if (carregando) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-gray-200 animate-pulse rounded-xl" />
        ))}
      </div>
    );
  }

  if (erro) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
        <p className="font-medium">Falha ao carregar</p>
        <p className="text-sm mt-1">{erro}</p>
      </div>
    );
  }

  const textoWhatsapp = encodeURIComponent(
    `OlÃ¡! Quer economizar na conta de luz com energia solar? Cadastre-se na cooperativa: ${linkConvite}`,
  );
  const linkWhatsapp = `https://wa.me/?text=${textoWhatsapp}`;

  const copiarLink = () => {
    navigator.clipboard.writeText(linkConvite);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  const indicacoes = dados?.indicacoesFeitas ?? [];
  const beneficios = dados?.beneficiosIndicacao ?? [];
  const totalBeneficio = beneficios
    .filter((b) => b.status !== 'CANCELADO')
    .reduce((acc, b) => acc + Number(b.valorCalculado), 0);

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-gray-800">IndicaÃ§Ãµes</h1>

      {/* QR Code + Link */}
      <Card>
        <CardContent className="pt-5 pb-5">
          <div className="flex flex-col items-center text-center">
            <div className="bg-white p-3 rounded-xl border border-gray-200 mb-3">
              {linkConvite ? (
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(linkConvite)}`}
                  alt="QR Code do link de indicaÃ§Ã£o"
                  width={140}
                  height={140}
                />
              ) : (
                <div className="w-[140px] h-[140px] flex items-center justify-center text-xs text-gray-400 text-center p-2">
                  Link de convite nÃ£o disponÃ­vel para este perfil
                </div>
              )}
            </div>
            <p className="text-sm text-gray-600 mb-3">
              Compartilhe seu link e ganhe benefÃ­cios!
            </p>
            <div className="flex items-center gap-2 w-full bg-gray-50 rounded-lg px-3 py-2 mb-3">
              <p className="text-xs text-gray-500 truncate flex-1">{linkConvite}</p>
              <button
                onClick={copiarLink}
                className="text-green-600 hover:text-green-700 flex-shrink-0"
                title="Copiar link"
              >
                {copiado ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
            <a
              href={linkWhatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full h-12 text-base font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
            >
              <MessageCircle className="w-5 h-5" />
              Compartilhar pelo WhatsApp
            </a>
          </div>
        </CardContent>
      </Card>

      {/* BenefÃ­cio atual */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center flex-shrink-0">
              <Gift className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">BenefÃ­cio por indicaÃ§Ãµes</p>
              <p className="text-xl font-bold text-gray-800">
                R$ {totalBeneficio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Clube de Vantagens */}
      {progressao && (
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <TrendingUp className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-gray-500">Clube de Vantagens</p>
                <BadgeNivelClube
                  nivel={progressao.nivelAtual}
                  beneficioAtivo={progressao.beneficioPercentualAtual > 0}
                  indicados={progressao.indicadosAtivos}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center mb-3">
              <div className="bg-gray-50 rounded-lg p-2">
                <p className="text-lg font-bold text-gray-800">
                  {progressao.kwhIndicadoAcumulado.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                </p>
                <p className="text-[10px] text-gray-500">kWh acumulados</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-2">
                <p className="text-lg font-bold text-gray-800">{progressao.indicadosAtivos}</p>
                <p className="text-[10px] text-gray-500">Indicados ativos</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-2">
                <p className="text-lg font-bold text-gray-800">{progressao.beneficioPercentualAtual}%</p>
                <p className="text-[10px] text-gray-500">BenefÃ­cio</p>
              </div>
            </div>
            {/* Barra de progresso para prÃ³ximo nÃ­vel */}
            {NIVEL_ORDEM[progressao.nivelAtual] < 3 && (
              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>{progressao.nivelAtual}</span>
                  <span>{NIVEIS[NIVEL_ORDEM[progressao.nivelAtual] + 1]}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all"
                    style={{ width: `${Math.min(Math.max(((progressao.kwhIndicadoAcumulado - NIVEL_KWH_MIN[progressao.nivelAtual]) / (NIVEL_KWH_MAX[progressao.nivelAtual] - NIVEL_KWH_MIN[progressao.nivelAtual])) * 100, 0), 100)}%` }}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Lista de indicados */}
      <div>
        <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2">
          Seus indicados ({indicacoes.length})
        </h2>
        {indicacoes.length === 0 ? (
          <Card>
            <CardContent className="pt-6 pb-6 text-center">
              <UserPlus className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">
                Nenhuma indicaÃ§Ã£o ainda. Compartilhe seu link!
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {indicacoes.map((ind) => {
              const statusLabel =
                ind.status === 'PRIMEIRA_FATURA_PAGA'
                  ? 'Ativo'
                  : ind.status === 'CANCELADO'
                    ? 'Cancelado'
                    : 'Pendente';
              const StatusIcon =
                ind.status === 'PRIMEIRA_FATURA_PAGA' ? CheckCircle : Clock;
              const statusColor =
                ind.status === 'PRIMEIRA_FATURA_PAGA'
                  ? 'text-green-600'
                  : ind.status === 'CANCELADO'
                    ? 'text-gray-400'
                    : 'text-yellow-600';

              return (
                <Card key={ind.id}>
                  <CardContent className="pt-3 pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <Users className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">
                            {ind.cooperadoIndicado.nomeCompleto}
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(ind.createdAt).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <StatusIcon className={`w-3.5 h-3.5 ${statusColor}`} />
                        <span className={`text-xs font-medium ${statusColor}`}>
                          {statusLabel}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

