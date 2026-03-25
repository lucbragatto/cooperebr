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
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

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

export default function PortalIndicacoesPage() {
  const [dados, setDados] = useState<PerfilIndicacao | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    api
      .get('/cooperados/meu-perfil')
      .then((res) => setDados(res.data))
      .catch(() => {})
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

  const linkConvite =
    typeof window !== 'undefined'
      ? `${window.location.origin}/entrar?ref=${dados?.codigoIndicacao ?? dados?.id ?? ''}`
      : '';

  const textoWhatsapp = encodeURIComponent(
    `Olá! Quer economizar na conta de luz com energia solar? Cadastre-se na cooperativa: ${linkConvite}`,
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
      <h1 className="text-lg font-bold text-gray-800">Indicações</h1>

      {/* QR Code + Link */}
      <Card>
        <CardContent className="pt-5 pb-5">
          <div className="flex flex-col items-center text-center">
            <div className="bg-white p-3 rounded-xl border border-gray-200 mb-3">
              <QRCodeSVG value={linkConvite} size={140} level="M" />
            </div>
            <p className="text-sm text-gray-600 mb-3">
              Compartilhe seu link e ganhe benefícios!
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

      {/* Benefício atual */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center flex-shrink-0">
              <Gift className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Benefício por indicações</p>
              <p className="text-xl font-bold text-gray-800">
                R$ {totalBeneficio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

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
                Nenhuma indicação ainda. Compartilhe seu link!
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
