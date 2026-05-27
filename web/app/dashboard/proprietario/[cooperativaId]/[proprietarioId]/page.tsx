'use client';

/**
 * Sub-Sprint F.6b Etapa C (M34, 28/05/2026).
 *
 * N3 — Cards de usinas de UM proprietário específico (Caminho A/B/SEM_PROPRIETARIO).
 * Consome GET /admin/proprietarios/cooperativas/:coopId/proprietarios/:propId/usinas.
 *
 * Tabs custom: "Usinas" (ativa) + "Carregadores" (em breve, disabled).
 *
 * Caso SEM_PROPRIETARIO: cards de usina mostram botão "Cadastrar proprietário"
 * direcionando pra /dashboard/usinas/[id]/proprietario (tela admin M30/M31).
 *
 * Acesso: SUPER_ADMIN + ADMIN (sua propria coop). Click na usina → N4
 * /dashboard/usinas/[id] (tela admin existente — reuso máximo).
 */

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Info,
  Sun,
  AlertCircle,
  AlertTriangle,
  Mail,
  Users,
  Zap,
  DollarSign,
  UserPlus,
  Bell,
  Battery,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { TabsCustom, TabContent } from '@/components/ui/tabs-custom';
import { getUsuario } from '@/lib/auth';
import api from '@/lib/api';

interface UsinaCard {
  usinaId: string;
  nome: string;
  apelidoInterno: string | null;
  statusOperacional: string;
  statusHomologacao: string;
  potenciaKwp: number;
  capacidadeKwh: number;
  contratoArrendamento: string;
  ytdRepasse: number;
  conviteStatus: 'USADO' | 'PENDENTE' | 'EXPIRADO' | 'NAO_CONVIDADO' | 'NA';
  alertas: number;
}

interface Response {
  cooperativa: { id: string; nome: string; tipoParceiro: string };
  proprietario: {
    proprietarioId: string;
    caminho: 'COOPERADO' | 'EMAIL' | 'ORFAO';
    nome: string;
    tipo: 'PF' | 'PJ' | 'INDEFINIDO';
    emailMascarado: string | null;
  };
  usinas: UsinaCard[];
}

const STATUS_OP_COR: Record<string, string> = {
  OPERANDO: 'bg-green-100 text-green-700',
  MANUTENCAO_PLANEJADA: 'bg-yellow-100 text-yellow-700',
  MANUTENCAO_EMERGENCIAL: 'bg-orange-100 text-orange-700',
  DESLIGADA: 'bg-gray-200 text-gray-700',
  OFFLINE: 'bg-red-100 text-red-700',
};

const CONVITE_COR: Record<string, string> = {
  USADO: 'bg-green-100 text-green-700',
  PENDENTE: 'bg-yellow-100 text-yellow-700',
  EXPIRADO: 'bg-red-100 text-red-700',
  NAO_CONVIDADO: 'bg-gray-100 text-gray-500',
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

function fmtKwh(v: number): string {
  return `${v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} kWh/mês`;
}

export default function DashboardUsinasDoProprietarioPage() {
  const params = useParams();
  const router = useRouter();
  const cooperativaId = params?.cooperativaId as string;
  // Next.js já decoda params automaticamente — proprietarioId vem como 'e-demo@example.com'
  const proprietarioId = params?.proprietarioId as string;

  const [data, setData] = useState<Response | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [perfil, setPerfil] = useState<string | null>(null);
  const [tabAtiva, setTabAtiva] = useState<'usinas' | 'carregadores'>('usinas');

  useEffect(() => {
    const u = getUsuario();
    if (!u) {
      router.replace('/login');
      return;
    }

    if (u.perfil === 'ADMIN' && (u as any).cooperativaId !== cooperativaId) {
      router.replace(`/dashboard/proprietario/${(u as any).cooperativaId}`);
      return;
    }

    if (!['SUPER_ADMIN', 'ADMIN'].includes(u.perfil)) {
      router.replace('/dashboard');
      return;
    }

    setPerfil(u.perfil);

    if (!cooperativaId || !proprietarioId) return;

    // Frontend precisa re-encodar email pra URL — axios geralmente já encoda mas
    // garantimos aqui pois proprietarioId pode vir já decodado do params
    const propIdParaUrl = encodeURIComponent(proprietarioId);

    api
      .get<Response>(
        `/admin/proprietarios/cooperativas/${cooperativaId}/proprietarios/${propIdParaUrl}/usinas`,
      )
      .then((r) => setData(r.data))
      .catch((e: any) => setErro(e?.response?.data?.message ?? 'Falha ao carregar usinas.'))
      .finally(() => setCarregando(false));
  }, [cooperativaId, proprietarioId, router]);

  const isSuperAdmin = perfil === 'SUPER_ADMIN';
  const isOrfa = data?.proprietario.caminho === 'ORFAO';

  const tabs = [
    { value: 'usinas', label: 'Usinas' },
    { value: 'carregadores', label: 'Carregadores', disabled: true, badge: 'Em breve' },
  ];

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Link
        href={`/dashboard/proprietario/${cooperativaId}`}
        className="text-sm text-amber-600 hover:underline inline-flex items-center gap-1"
      >
        <ArrowLeft className="w-4 h-4" />
        {isSuperAdmin
          ? `Voltar pra ${data?.cooperativa.nome ?? 'cooperativa'}`
          : 'Voltar'}
      </Link>

      {/* Header */}
      <div className="flex items-center gap-3">
        {isOrfa ? (
          <AlertTriangle className="h-6 w-6 text-orange-500" />
        ) : (
          <Users className="h-6 w-6 text-amber-600" />
        )}
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            {isOrfa
              ? '⚠️ Usinas sem proprietário cadastrado'
              : data?.proprietario.nome ?? 'Carregando...'}
          </h1>
          {!isOrfa && data?.proprietario && (
            <div className="flex flex-wrap gap-1.5 mt-1">
              <Badge className={`text-[10px] ${TIPO_COR[data.proprietario.tipo]}`}>
                {data.proprietario.tipo}
              </Badge>
              {data.proprietario.emailMascarado && (
                <Badge variant="outline" className="text-[10px] text-gray-600 flex items-center gap-1">
                  <Mail className="w-3 h-3" />
                  {data.proprietario.emailMascarado}
                </Badge>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Help inline contextual */}
      <div className="bg-blue-50 border border-blue-200 rounded-md p-3 flex gap-2">
        <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          {isOrfa ? (
            <>
              <strong>Usinas desta cooperativa sem proprietário cadastrado.</strong>{' '}
              Cada card tem o botão "Cadastrar proprietário" que leva pra tela admin de
              vinculação. Após cadastrar, a usina sai daqui e vira card próprio na N2.
            </>
          ) : (
            <>
              <strong>Usinas que {data?.proprietario.nome} administra nesta cooperativa.</strong>{' '}
              Clique num card pra ver detalhes técnicos completos da usina (N4).
            </>
          )}
        </div>
      </div>

      {/* Loading state */}
      {carregando && (
        <Card>
          <CardContent className="py-6 space-y-3">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
      )}

      {!carregando && erro && (
        <Card>
          <CardContent className="text-center py-12">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
            <p className="text-red-600 text-sm">{erro}</p>
          </CardContent>
        </Card>
      )}

      {!carregando && data && (
        <TabsCustom
          tabs={tabs}
          activeValue={tabAtiva}
          onChange={(v) => setTabAtiva(v as 'usinas' | 'carregadores')}
        >
          <TabContent value="usinas">
            {data.usinas.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <Sun className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm">
                    Este proprietário não tem usinas registradas nesta cooperativa.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.usinas.map((u) => (
                  <Card
                    key={u.usinaId}
                    className="hover:shadow-lg hover:border-amber-300 transition-all cursor-pointer"
                    onClick={() => router.push(`/dashboard/usinas/${u.usinaId}`)}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Sun className="w-4 h-4 text-amber-500 shrink-0" />
                          <span className="truncate">{u.nome}</span>
                        </CardTitle>
                        <Badge
                          className={`text-[10px] ${STATUS_OP_COR[u.statusOperacional] ?? 'bg-gray-100'}`}
                        >
                          {u.statusOperacional.replace(/_/g, ' ')}
                        </Badge>
                      </div>
                      {u.apelidoInterno && (
                        <p className="text-[10px] text-gray-400 mt-0.5">{u.apelidoInterno}</p>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div>
                          <p className="text-xs text-gray-500 flex items-center gap-1">
                            <Zap className="w-3 h-3" /> Potência
                          </p>
                          <p className="font-semibold text-xs">{fmtKwp(u.potenciaKwp)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Capacidade</p>
                          <p className="font-semibold text-xs">{fmtKwh(u.capacidadeKwh)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 flex items-center gap-1">
                            <DollarSign className="w-3 h-3 text-green-600" /> YTD
                          </p>
                          <p className="font-semibold text-green-700 text-xs">
                            {fmtMoney(u.ytdRepasse)}
                          </p>
                        </div>
                      </div>

                      <div className="pt-2 border-t space-y-2">
                        <p className="text-xs text-gray-600">
                          <strong>Contrato:</strong> {u.contratoArrendamento}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {u.conviteStatus !== 'NA' && (
                            <Badge className={`text-[10px] ${CONVITE_COR[u.conviteStatus]}`}>
                              {u.conviteStatus.replace(/_/g, ' ')}
                            </Badge>
                          )}
                          {u.alertas > 0 && (
                            <Badge className="bg-red-100 text-red-700 text-[10px] flex items-center gap-1">
                              <Bell className="w-3 h-3" />
                              {u.alertas} alerta(s)
                            </Badge>
                          )}
                        </div>
                      </div>

                      {isOrfa && (
                        <div className="pt-2 border-t">
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full border-orange-300 text-orange-700 hover:bg-orange-50"
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/dashboard/usinas/${u.usinaId}/proprietario`);
                            }}
                          >
                            <UserPlus className="w-3 h-3 mr-1" />
                            Cadastrar proprietário
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabContent>

          <TabContent value="carregadores">
            <Card>
              <CardContent className="text-center py-16">
                <Battery className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-700 mb-2">Carregadores — Em breve</h3>
                <p className="text-sm text-gray-500 max-w-md mx-auto">
                  Quando carregadores veiculares forem cadastrados pra este proprietário,
                  aparecerão aqui com a mesma estrutura visual das usinas. Lógica idêntica:
                  cards clicáveis, status operacional, métricas de uso.
                </p>
              </CardContent>
            </Card>
          </TabContent>
        </TabsCustom>
      )}
    </div>
  );
}
