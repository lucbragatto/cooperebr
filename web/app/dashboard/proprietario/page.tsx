'use client';

/**
 * Sub-Sprint F.5b (M33, 27/05/2026 noite).
 *
 * Dashboard Hierárquico Super Admin — Grid de cards-resumo (1 por cooperativa).
 * Consome GET /admin/proprietarios/cooperativas (F.5a backend).
 *
 * Card inteiro clicável → /dashboard/proprietario/[cooperativaId].
 *
 * Acesso: SUPER_ADMIN apenas (guard via useEffect — redirect pra /dashboard se
 * outro perfil).
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Info,
  Building2,
  Sun,
  Users,
  Zap,
  DollarSign,
  Mail,
  Clock,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { getUsuario } from '@/lib/auth';
import api from '@/lib/api';

interface CooperativaCard {
  cooperativaId: string;
  nome: string;
  cnpj: string;
  tipoParceiro: 'COOPERATIVA' | 'CONSORCIO' | 'ASSOCIACAO' | 'CONDOMINIO';
  statusSaas: string | null;
  planoSaas: { id: string; nome: string; mensalidadeBase: number } | null;
  usinasComProprietario: number;
  usinasTotal: number;
  proprietariosUnicos: number;
  totalYtdAgregado: number;
  capacidadeTotalKwp: number;
  statusOk: number;
  statusAtencao: number;
  statusCritico: number;
  convitesPendentes: number;
  contratosVencendo30d: number;
}

const TIPO_LABEL: Record<string, string> = {
  COOPERATIVA: 'Cooperativa',
  CONSORCIO: 'Consórcio',
  ASSOCIACAO: 'Associação',
  CONDOMINIO: 'Condomínio',
};

const PLANO_COR: Record<string, string> = {
  OURO: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  PRATA: 'bg-gray-100 text-gray-700 border-gray-300',
  BRONZE: 'bg-orange-100 text-orange-800 border-orange-300',
};

const STATUS_SAAS_COR: Record<string, string> = {
  ATIVO: 'bg-green-100 text-green-700',
  TRIAL: 'bg-blue-100 text-blue-700',
  SUSPENSO: 'bg-red-100 text-red-700',
  CANCELADO: 'bg-gray-200 text-gray-600',
};

function fmtMoney(v: number): string {
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtKwp(v: number): string {
  return `${v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} kWp`;
}

export default function DashboardProprietarioGridPage() {
  const router = useRouter();
  const [data, setData] = useState<CooperativaCard[] | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    // Guard SUPER_ADMIN
    const u = getUsuario();
    if (u && u.perfil !== 'SUPER_ADMIN') {
      router.replace('/dashboard');
      return;
    }

    api
      .get<CooperativaCard[]>('/admin/proprietarios/cooperativas')
      .then((r) => setData(r.data))
      .catch((e: any) => setErro(e?.response?.data?.message ?? 'Falha ao carregar dashboard.'))
      .finally(() => setCarregando(false));
  }, [router]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Sun className="h-6 w-6 text-yellow-500" />
        <h1 className="text-2xl font-bold text-gray-800">Portal Proprietário — Visão Hierárquica</h1>
      </div>

      {/* Help inline (regra 19/05) */}
      <div className="bg-blue-50 border border-blue-200 rounded-md p-3 flex gap-2">
        <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <strong>Visão hierárquica de proprietários por parceiro.</strong> Cada card mostra os
          indicadores agregados de uma cooperativa. Clique num card pra ver a tabela detalhada
          das usinas e seus proprietários — e impersonar como Super Admin pra inspecionar o portal.
        </div>
      </div>

      {carregando && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-2/3" />
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-8 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!carregando && erro && (
        <Card>
          <CardContent className="text-center py-12">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
            <p className="text-red-600 text-sm">{erro}</p>
          </CardContent>
        </Card>
      )}

      {!carregando && !erro && data && data.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">Nenhuma cooperativa cadastrada ainda.</p>
          </CardContent>
        </Card>
      )}

      {!carregando && !erro && data && data.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.map((c) => (
            <Card
              key={c.cooperativaId}
              className="hover:shadow-lg hover:border-amber-300 transition-all cursor-pointer"
              onClick={() => router.push(`/dashboard/proprietario/${c.cooperativaId}`)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-amber-600 shrink-0" />
                    <span className="truncate">{c.nome}</span>
                  </CardTitle>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <Badge variant="outline" className="text-[10px]">
                    {TIPO_LABEL[c.tipoParceiro] ?? c.tipoParceiro}
                  </Badge>
                  {c.planoSaas && (
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${PLANO_COR[c.planoSaas.nome] ?? ''}`}
                    >
                      {c.planoSaas.nome}
                    </Badge>
                  )}
                  {c.statusSaas && (
                    <Badge className={`text-[10px] ${STATUS_SAAS_COR[c.statusSaas] ?? 'bg-gray-100'}`}>
                      {c.statusSaas}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Indicadores principais */}
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      <Sun className="w-3 h-3" /> Usinas
                    </p>
                    <p className="font-semibold">
                      {c.usinasComProprietario} <span className="text-gray-400">/ {c.usinasTotal}</span>
                    </p>
                    <p className="text-[10px] text-gray-400">com proprietário</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      <Users className="w-3 h-3" /> Proprietários
                    </p>
                    <p className="font-semibold">{c.proprietariosUnicos}</p>
                    <p className="text-[10px] text-gray-400">únicos</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      <Zap className="w-3 h-3" /> Capacidade
                    </p>
                    <p className="font-semibold">{fmtKwp(c.capacidadeTotalKwp)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      <DollarSign className="w-3 h-3 text-green-600" /> YTD
                    </p>
                    <p className="font-semibold text-green-700">{fmtMoney(c.totalYtdAgregado)}</p>
                  </div>
                </div>

                {/* Semáforo saúde técnica */}
                <div className="flex gap-3 text-xs pt-2 border-t">
                  <span className="flex items-center gap-1 text-green-700">
                    <CheckCircle className="w-3 h-3" />
                    <strong>{c.statusOk}</strong> OK
                  </span>
                  <span className="flex items-center gap-1 text-yellow-600">
                    <AlertTriangle className="w-3 h-3" />
                    <strong>{c.statusAtencao}</strong> atenção
                  </span>
                  <span className="flex items-center gap-1 text-red-600">
                    <AlertCircle className="w-3 h-3" />
                    <strong>{c.statusCritico}</strong> crítico
                  </span>
                </div>

                {/* Badges contextuais (só se > 0) */}
                {(c.convitesPendentes > 0 || c.contratosVencendo30d > 0) && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {c.convitesPendentes > 0 && (
                      <Badge className="bg-amber-100 text-amber-800 text-[10px] flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        {c.convitesPendentes} convite(s) pendente(s)
                      </Badge>
                    )}
                    {c.contratosVencendo30d > 0 && (
                      <Badge className="bg-red-100 text-red-700 text-[10px] flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {c.contratosVencendo30d} contrato(s) vencendo 30d
                      </Badge>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
