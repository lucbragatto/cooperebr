'use client';

import { useEffect, useState } from 'react';
import { getUsuario } from '@/lib/auth';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Percent,
  Calendar,
  Zap,
  AlertTriangle,
  FileWarning,
  DollarSign,
  MessageCircle,
} from 'lucide-react';

interface Resumo {
  descontoAtual: number | null;
  proximoVencimento: string | null;
  statusConta: string;
  kwhAlocados: number;
  documentosPendentes: number;
  faturasPendentes: number;
}

interface MeuPerfil {
  id: string;
  nomeCompleto: string;
  codigoIndicacao?: string;
  resumo: Resumo;
}

const STATUS_LABEL: Record<string, string> = {
  PENDENTE: 'Pendente',
  ATIVO: 'Ativo',
  ATIVO_RECEBENDO_CREDITOS: 'Recebendo créditos',
  SUSPENSO: 'Suspenso',
  ENCERRADO: 'Encerrado',
  APROVADO: 'Aprovado',
};

const STATUS_COLOR: Record<string, string> = {
  ATIVO: 'text-green-700',
  ATIVO_RECEBENDO_CREDITOS: 'text-green-700',
  APROVADO: 'text-blue-600',
  PENDENTE: 'text-yellow-600',
  SUSPENSO: 'text-red-600',
  ENCERRADO: 'text-gray-500',
};

export default function PortalInicioPage() {
  const [perfil, setPerfil] = useState<MeuPerfil | null>(null);
  const [carregando, setCarregando] = useState(true);
  const usuario = getUsuario();

  useEffect(() => {
    api
      .get('/cooperados/meu-perfil')
      .then((res) => setPerfil(res.data))
      .catch(() => {})
      .finally(() => setCarregando(false));
  }, []);

  if (carregando) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 bg-gray-200 animate-pulse rounded-xl" />
        ))}
      </div>
    );
  }

  const r = perfil?.resumo;
  const nome = perfil?.nomeCompleto?.split(' ')[0] ?? usuario?.nome?.split(' ')[0] ?? 'Membro';
  const alertas = (r?.documentosPendentes ?? 0) + (r?.faturasPendentes ?? 0);

  // Link de indicação via WhatsApp
  const linkIndicacao = typeof window !== 'undefined'
    ? `${window.location.origin}/entrar?ref=${perfil?.codigoIndicacao ?? perfil?.id ?? ''}`
    : '';
  const textoWhatsapp = encodeURIComponent(
    `Olá! Quer economizar na conta de luz? Participe da nossa cooperativa de energia solar! Acesse: ${linkIndicacao}`
  );
  const linkWhatsapp = `https://wa.me/?text=${textoWhatsapp}`;

  return (
    <div className="space-y-4">
      {/* Boas-vindas */}
      <Card>
        <CardContent className="pt-4">
          <h2 className="text-xl font-bold text-gray-800">Olá, {nome}!</h2>
          <p className="text-sm text-gray-500 mt-1">Bem-vindo ao seu painel.</p>
        </CardContent>
      </Card>

      {/* Resumo */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
            Resumo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-start gap-2">
              <Percent className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-500">Desconto</p>
                <p className="text-lg font-bold text-gray-800">
                  {r?.descontoAtual != null ? `${r.descontoAtual}%` : '—'}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Calendar className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-500">Próx. vencimento</p>
                <p className="text-sm font-semibold text-gray-800">
                  {r?.proximoVencimento
                    ? new Date(r.proximoVencimento).toLocaleDateString('pt-BR')
                    : '—'}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2 col-span-2">
              <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-500">Status</p>
                <p className={`text-sm font-semibold ${STATUS_COLOR[r?.statusConta ?? ''] ?? 'text-gray-600'}`}>
                  {STATUS_LABEL[r?.statusConta ?? ''] ?? r?.statusConta ?? '—'}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Créditos */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
              <Zap className="w-5 h-5 text-green-700" />
            </div>
            <div>
              <p className="text-xs text-gray-500">kWh alocados este mês</p>
              <p className="text-2xl font-bold text-gray-800">
                {r?.kwhAlocados ? r.kwhAlocados.toLocaleString('pt-BR') : '0'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alertas */}
      {alertas > 0 && (
        <Card className="ring-red-200 bg-red-50/50">
          <CardContent className="pt-4">
            <div className="space-y-2">
              {(r?.documentosPendentes ?? 0) > 0 && (
                <div className="flex items-center gap-2">
                  <FileWarning className="w-4 h-4 text-red-500" />
                  <span className="text-sm text-red-700">
                    {r!.documentosPendentes} documento(s) pendente(s)
                  </span>
                  <span className="ml-auto bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {r!.documentosPendentes}
                  </span>
                </div>
              )}
              {(r?.faturasPendentes ?? 0) > 0 && (
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-red-500" />
                  <span className="text-sm text-red-700">
                    {r!.faturasPendentes} fatura(s) em aberto
                  </span>
                  <span className="ml-auto bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {r!.faturasPendentes}
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Ação rápida: WhatsApp */}
      <a
        href={linkWhatsapp}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 w-full h-12 text-base font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
      >
        <MessageCircle className="w-5 h-5" />
        Enviar convite pelo WhatsApp
      </a>
    </div>
  );
}
