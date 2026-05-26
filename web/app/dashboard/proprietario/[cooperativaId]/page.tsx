'use client';

/**
 * Sub-Sprint F.5b Etapa B (M33, 27/05/2026 noite).
 *
 * Tabela detalhada das usinas+proprietários de UMA cooperativa.
 * Consome GET /admin/proprietarios/cooperativas/:cooperativaId/usinas.
 *
 * Linha clicável → /proprietario/usinas/[usinaId]?impersonate=true (Etapa C
 * banner). Acesso: SUPER_ADMIN apenas.
 */

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Info,
  Building2,
  Sun,
  Mail,
  AlertCircle,
  Users,
  DollarSign,
  Eye,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getUsuario } from '@/lib/auth';
import api from '@/lib/api';

interface UsinaRow {
  usinaId: string;
  nome: string;
  apelidoInterno: string | null;
  statusOperacional: string;
  statusHomologacao: string;
  potenciaKwp: number;
  capacidadeKwh: number;
  proprietarioNome: string | null;
  proprietarioEmail: string | null; // já mascarado no backend
  proprietarioEmailRaw: string | null; // não-mascarado, só usar em handlers
  temProprietario: boolean;
  contratoArrendamento: string;
  ytdRepasse: number;
  conviteStatus: 'NAO_CONVIDADO' | 'PENDENTE' | 'EXPIRADO' | 'USADO';
}

interface Response {
  cooperativa: { id: string; nome: string; tipoParceiro: string };
  usinas: UsinaRow[];
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
};

function fmtMoney(v: number): string {
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtKwp(v: number): string {
  return `${v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} kWp`;
}

export default function DashboardProprietarioCooperativaPage() {
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

    // F.5 M33 Etapa B (reversão decisão #4): ADMIN só pode ver sua propria.
    // SUPER_ADMIN: acesso global.
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
      .catch((e: any) => setErro(e?.response?.data?.message ?? 'Falha ao carregar tabela.'))
      .finally(() => setCarregando(false));
  }, [cooperativaId, router]);

  const isSuperAdmin = perfil === 'SUPER_ADMIN';

  const usinasComProprietario =
    data?.usinas.filter((u) => u.temProprietario).length ?? 0;
  const totalYtd =
    data?.usinas.reduce((s, u) => s + u.ytdRepasse, 0) ?? 0;

  return (
    <div className="space-y-6">
      {/* Breadcrumb — só pra SUPER_ADMIN (ADMIN não tem pra onde voltar) */}
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

      {/* Help inline (adapta texto por perfil) */}
      <div className="bg-blue-50 border border-blue-200 rounded-md p-3 flex gap-2">
        <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <strong>Lista de usinas com proprietários cadastrados.</strong>{' '}
          Clique numa linha pra ver o portal como o proprietário veria — você entra em modo
          impersonate e fica logado um banner azul durante a sessão.
        </div>
      </div>

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
        <>
          {/* Resumo agregado */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs text-gray-500 flex items-center gap-1">
                  <Sun className="w-3 h-3" /> Usinas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  {usinasComProprietario}
                  <span className="text-lg text-gray-400"> / {data.usinas.length}</span>
                </p>
                <p className="text-xs text-gray-500 mt-1">com proprietário / total</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs text-gray-500 flex items-center gap-1">
                  <Users className="w-3 h-3" /> Tipo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Badge variant="outline">{data.cooperativa.tipoParceiro}</Badge>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs text-gray-500 flex items-center gap-1">
                  <DollarSign className="w-3 h-3 text-green-600" /> Total YTD
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-green-700">{fmtMoney(totalYtd)}</p>
              </CardContent>
            </Card>
          </div>

          {/* Tabela */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Sun className="w-4 h-4 text-amber-500" />
                Usinas e Proprietários ({data.usinas.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.usinas.length === 0 ? (
                <div className="text-center py-12 text-gray-500 text-sm">
                  Nenhuma usina cadastrada nesta cooperativa.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table className="min-w-[900px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Usina</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Proprietário</TableHead>
                      <TableHead>Contrato Arrendamento</TableHead>
                      <TableHead className="text-right">YTD Repasse</TableHead>
                      <TableHead>Convite</TableHead>
                      <TableHead className="text-right">Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.usinas.map((u) => (
                      <TableRow
                        key={u.usinaId}
                        className={
                          u.temProprietario
                            ? 'hover:bg-amber-50 cursor-pointer'
                            : 'opacity-60'
                        }
                        onClick={() => {
                          if (u.temProprietario) {
                            router.push(
                              `/proprietario/usinas/${u.usinaId}?impersonate=true&cooperativaId=${cooperativaId}`,
                            );
                          }
                        }}
                      >
                        <TableCell className="font-medium">
                          <div>{u.nome}</div>
                          {u.apelidoInterno && (
                            <div className="text-[10px] text-gray-400">
                              {u.apelidoInterno}
                            </div>
                          )}
                          <div className="text-[10px] text-gray-400">
                            {fmtKwp(u.potenciaKwp)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={STATUS_OP_COR[u.statusOperacional] ?? 'bg-gray-100'}
                          >
                            {u.statusOperacional.replace(/_/g, ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {u.temProprietario ? (
                            <div>
                              <div className="text-sm">{u.proprietarioNome ?? '—'}</div>
                              <div className="text-xs text-gray-500 flex items-center gap-1">
                                <Mail className="w-3 h-3" />
                                {u.proprietarioEmail ?? '—'}
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400 italic">
                              sem proprietário
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">{u.contratoArrendamento}</TableCell>
                        <TableCell className="text-right font-semibold text-green-700">
                          {fmtMoney(u.ytdRepasse)}
                        </TableCell>
                        <TableCell>
                          <Badge className={CONVITE_COR[u.conviteStatus] ?? 'bg-gray-100'}>
                            {u.conviteStatus.replace(/_/g, ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {u.temProprietario && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-amber-700 border-amber-300"
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(
                                  `/proprietario/usinas/${u.usinaId}?impersonate=true&cooperativaId=${cooperativaId}`,
                                );
                              }}
                            >
                              <Eye className="w-3 h-3 mr-1" />
                              Impersonar
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
