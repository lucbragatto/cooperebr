'use client';

/**
 * Sub-Sprint F.6b Etapa B (M34, 28/05/2026).
 *
 * N2 — Cards de proprietários agrupados de uma cooperativa.
 * Consome shape novo de GET /admin/proprietarios/cooperativas/:id/usinas
 * (agora { cooperativa, proprietarios[] } por chave de dedupe).
 *
 * Card especial SEM_PROPRIETARIO destacado visualmente (border laranja
 * tracejado). Click no card → /dashboard/proprietario/[coopId]/[propId].
 *
 * Acesso: SUPER_ADMIN + ADMIN (sua propria coop). Bypass impersonate
 * removido em F.6a.
 */

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Info,
  Building2,
  AlertCircle,
  Sun,
  Users,
  Mail,
  Zap,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  HelpCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { getUsuario } from '@/lib/auth';
import api from '@/lib/api';

interface ProprietarioCard {
  proprietarioId: string;
  nome: string;
  tipo: 'PF' | 'PJ' | 'INDEFINIDO';
  emailMascarado: string | null;
  numeroUsinas: number;
  capacidadeTotalKwp: number;
  totalYtdAgregado: number;
  statusOk: number;
  statusAtencao: number;
  statusCritico: number;
  conviteStatusAgregado: 'USADO' | 'PENDENTE' | 'EXPIRADO' | 'NAO_CONVIDADO' | 'MIXED' | 'NA';
}

interface Response {
  cooperativa: { id: string; nome: string; tipoParceiro: string };
  proprietarios: ProprietarioCard[];
}

const CONVITE_LABEL: Record<string, string> = {
  USADO: 'Acesso ativo',
  PENDENTE: 'Convite pendente',
  EXPIRADO: 'Convite expirado',
  NAO_CONVIDADO: 'Não convidado',
  MIXED: 'Status misto',
  NA: '—',
};

const CONVITE_COR: Record<string, string> = {
  USADO: 'bg-green-100 text-green-700',
  PENDENTE: 'bg-yellow-100 text-yellow-700',
  EXPIRADO: 'bg-red-100 text-red-700',
  NAO_CONVIDADO: 'bg-gray-100 text-gray-500',
  MIXED: 'bg-blue-100 text-blue-700',
  NA: 'bg-gray-50 text-gray-400',
};

const TIPO_COR: Record<string, string> = {
  PF: 'bg-blue-100 text-blue-700',
  PJ: 'bg-purple-100 text-purple-700',
  INDEFINIDO: 'bg-gray-100 text-gray-500',
};

function fmtMoney(v: number): string {
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtKwp(v: number): string {
  return `${v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} kWp`;
}

export default function DashboardProprietariosPorCooperativaPage() {
  const params = useParams();
  const router = useRouter();
  const cooperativaId = params?.cooperativaId as string;

  const [data, setData] = useState<Response | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [perfil, setPerfil] = useState<string | null>(null);

  useEffect(() => {
    const u = getUsuario();
    if (!u) {
      router.replace('/login');
      return;
    }

    // ADMIN só sua propria cooperativaId
    if (u.perfil === 'ADMIN' && (u as any).cooperativaId !== cooperativaId) {
      router.replace(`/dashboard/proprietario/${(u as any).cooperativaId}`);
      return;
    }

    if (!['SUPER_ADMIN', 'ADMIN'].includes(u.perfil)) {
      router.replace('/dashboard');
      return;
    }

    setPerfil(u.perfil);

    if (!cooperativaId) return;

    api
      .get<Response>(`/admin/proprietarios/cooperativas/${cooperativaId}/usinas`)
      .then((r) => setData(r.data))
      .catch((e: any) => setErro(e?.response?.data?.message ?? 'Falha ao carregar proprietários.'))
      .finally(() => setCarregando(false));
  }, [cooperativaId, router]);

  const isSuperAdmin = perfil === 'SUPER_ADMIN';

  return (
    <div className="space-y-6">
      {isSuperAdmin && (
        <Link
          href="/dashboard/proprietario"
          className="text-sm text-amber-600 hover:underline inline-flex items-center gap-1"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar pra Visão Hierárquica
        </Link>
      )}

      <div className="flex items-center gap-3">
        <Building2 className="h-6 w-6 text-amber-600" />
        <h1 className="text-2xl font-bold text-gray-800">
          {isSuperAdmin
            ? data?.cooperativa.nome ?? 'Carregando...'
            : `Portal Proprietário — ${data?.cooperativa.nome ?? '...'}`}
        </h1>
      </div>

      {/* Help inline */}
      <div className="bg-blue-50 border border-blue-200 rounded-md p-3 flex gap-2">
        <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <strong>Cards por proprietário desta cooperativa.</strong> Clique pra ver as
          usinas de cada proprietário. Usinas sem proprietário cadastrado aparecem destacadas
          num card laranja — útil pra ver onboarding pendente.
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

      {!carregando && !erro && data && data.proprietarios.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">
              Nenhum proprietário ou usina cadastrada nesta cooperativa ainda.
            </p>
          </CardContent>
        </Card>
      )}

      {!carregando && !erro && data && data.proprietarios.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.proprietarios.map((p) => {
            const isOrfa = p.proprietarioId === 'SEM_PROPRIETARIO';
            // propId é URL-encoded ao navegar — encodeURIComponent garante '@' → '%40'
            const propIdEncoded = encodeURIComponent(p.proprietarioId);
            return (
              <Card
                key={p.proprietarioId}
                className={
                  isOrfa
                    ? 'border-2 border-dashed border-orange-300 bg-orange-50/30 hover:shadow-lg hover:border-orange-500 transition-all cursor-pointer'
                    : 'hover:shadow-lg hover:border-amber-300 transition-all cursor-pointer'
                }
                onClick={() =>
                  router.push(`/dashboard/proprietario/${cooperativaId}/${propIdEncoded}`)
                }
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      {isOrfa ? (
                        <AlertTriangle className="w-4 h-4 text-orange-500 shrink-0" />
                      ) : (
                        <Users className="w-4 h-4 text-amber-600 shrink-0" />
                      )}
                      <span className="truncate">{p.nome}</span>
                    </CardTitle>
                  </div>
                  {!isOrfa && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <Badge variant="outline" className={`text-[10px] ${TIPO_COR[p.tipo]}`}>
                        {p.tipo}
                      </Badge>
                      {p.emailMascarado && (
                        <Badge variant="outline" className="text-[10px] text-gray-600 flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {p.emailMascarado}
                        </Badge>
                      )}
                      <Badge
                        className={`text-[10px] ${CONVITE_COR[p.conviteStatusAgregado]}`}
                      >
                        {CONVITE_LABEL[p.conviteStatusAgregado]}
                      </Badge>
                    </div>
                  )}
                  {isOrfa && (
                    <p className="text-xs text-orange-700 mt-1">
                      Sem dono cadastrado — onboarding pendente
                    </p>
                  )}
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* KPIs */}
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <p className="text-xs text-gray-500 flex items-center gap-1">
                        <Sun className="w-3 h-3" /> Usinas
                      </p>
                      <p className="font-semibold">{p.numeroUsinas}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 flex items-center gap-1">
                        <Zap className="w-3 h-3" /> Capacidade
                      </p>
                      <p className="font-semibold">{fmtKwp(p.capacidadeTotalKwp)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 flex items-center gap-1">
                        <DollarSign className="w-3 h-3 text-green-600" /> YTD
                      </p>
                      <p className="font-semibold text-green-700 text-xs">
                        {fmtMoney(p.totalYtdAgregado)}
                      </p>
                    </div>
                  </div>

                  {/* Semáforo saúde */}
                  <div className="flex gap-3 text-xs pt-2 border-t">
                    <span className="flex items-center gap-1 text-green-700">
                      <CheckCircle className="w-3 h-3" />
                      <strong>{p.statusOk}</strong> OK
                    </span>
                    <span className="flex items-center gap-1 text-yellow-600">
                      <HelpCircle className="w-3 h-3" />
                      <strong>{p.statusAtencao}</strong> atenção
                    </span>
                    <span className="flex items-center gap-1 text-red-600">
                      <AlertCircle className="w-3 h-3" />
                      <strong>{p.statusCritico}</strong> crítico
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
