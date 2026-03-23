'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Users,
  Zap,
  Sun,
  CreditCard,
  AlertTriangle,
  FileText,
  Clock,
  UserPlus,
  Plus,
  ArrowRight,
  DollarSign,
  Gauge,
  TrendingUp,
  ChevronRight,
} from 'lucide-react';
import type { Cooperado, Cobranca, Ocorrencia, Usina, Contrato } from '@/types';

interface DashboardData {
  // Alert cards
  cooperadosProntos: number;
  docsPendentes: number;
  cobrancasVencendoHoje: number;
  cobrancasVencidas: number;
  propostasPendentes: number;
  ocorrenciasAbertas: number;
  // KPI cards
  totalCooperadosAtivos: number;
  receitaMensal: number;
  kwhTotalContratado: number;
  ocupacaoMediaUsinas: number;
}

function SkeletonCard() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="h-4 w-24 bg-gray-200 animate-pulse rounded" />
        <div className="h-5 w-5 bg-gray-200 animate-pulse rounded" />
      </CardHeader>
      <CardContent>
        <div className="h-8 w-16 bg-gray-200 animate-pulse rounded" />
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    async function buscarDados() {
      try {
        const [cooperadosRes, cobrancasRes, ocorrenciasRes, usinasRes, contratosRes, propostasRes] =
          await Promise.all([
            api.get('/cooperados'),
            api.get('/cobrancas'),
            api.get('/ocorrencias'),
            api.get('/usinas'),
            api.get('/contratos'),
            api.get('/motor-proposta').catch(() => ({ data: { propostas: [] } })),
          ]);

        const cooperados: Cooperado[] = cooperadosRes.data;
        const cobrancas: Cobranca[] = cobrancasRes.data;
        const ocorrencias: Ocorrencia[] = ocorrenciasRes.data;
        const usinas: Usina[] = usinasRes.data;
        const contratos: Contrato[] = contratosRes.data;
        const propostas = propostasRes.data?.propostas ?? propostasRes.data ?? [];

        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const amanha = new Date(hoje);
        amanha.setDate(amanha.getDate() + 1);
        const depoisDeAmanha = new Date(hoje);
        depoisDeAmanha.setDate(depoisDeAmanha.getDate() + 2);

        const mesAtual = hoje.getMonth() + 1;
        const anoAtual = hoje.getFullYear();

        // Cooperados prontos = PENDENTE (com docs aprovados, esperando ativação)
        const cooperadosProntos = cooperados.filter(
          (c) => c.status === 'PENDENTE',
        ).length;

        // Docs pendentes = cooperados que podem ter documentos pendentes
        const docsPendentes = 0; // Sem endpoint direto; placeholder

        // Cobranças vencendo hoje/amanhã
        const cobrancasVencendoHoje = cobrancas.filter((c) => {
          if (c.status !== 'PENDENTE') return false;
          const venc = new Date(c.dataVencimento);
          venc.setHours(0, 0, 0, 0);
          return venc >= hoje && venc < depoisDeAmanha;
        }).length;

        // Cobranças vencidas
        const cobrancasVencidas = cobrancas.filter(
          (c) => c.status === 'VENCIDO',
        ).length;

        // Propostas pendentes
        const propostasPendentes = Array.isArray(propostas)
          ? propostas.filter(
              (p: { status?: string }) => p.status === 'PENDENTE',
            ).length
          : 0;

        // Ocorrências abertas
        const ocorrenciasAbertas = ocorrencias.filter(
          (o) => o.status === 'ABERTA' || o.status === 'EM_ANDAMENTO',
        ).length;

        // KPIs
        const totalCooperadosAtivos = cooperados.filter(
          (c) => c.status === 'ATIVO',
        ).length;

        const receitaMensal = cobrancas
          .filter(
            (c) =>
              c.status === 'PAGO' &&
              c.mesReferencia === mesAtual &&
              c.anoReferencia === anoAtual,
          )
          .reduce((acc, c) => acc + Number(c.valorLiquido), 0);

        const contratosAtivos = contratos.filter((c) => c.status === 'ATIVO');
        const kwhTotalContratado = contratosAtivos.reduce(
          (acc, c) => acc + Number((c as unknown as { kwhContratoMensal?: number }).kwhContratoMensal ?? 0),
          0,
        );

        // Ocupação média das usinas
        let ocupacaoMedia = 0;
        if (usinas.length > 0) {
          const usinasComCapacidade = usinas.filter(
            (u) => u.capacidadeKwh && Number(u.capacidadeKwh) > 0,
          );
          if (usinasComCapacidade.length > 0) {
            const totalCapacidade = usinasComCapacidade.reduce(
              (acc, u) => acc + Number(u.capacidadeKwh),
              0,
            );
            // kWh contratado / capacidade total
            ocupacaoMedia =
              totalCapacidade > 0
                ? Math.min(100, (kwhTotalContratado / totalCapacidade) * 100)
                : 0;
          }
        }

        setData({
          cooperadosProntos,
          docsPendentes,
          cobrancasVencendoHoje,
          cobrancasVencidas,
          propostasPendentes,
          ocorrenciasAbertas,
          totalCooperadosAtivos,
          receitaMensal,
          kwhTotalContratado,
          ocupacaoMediaUsinas: Math.round(ocupacaoMedia),
        });
      } finally {
        setCarregando(false);
      }
    }
    buscarDados();
  }, []);

  const alertCards = [
    {
      label: 'Membros prontos pra ativar',
      value: data?.cooperadosProntos ?? 0,
      icon: Users,
      href: '/dashboard/cooperados?filter=pronto',
      color: 'border-l-yellow-500',
      iconColor: 'text-yellow-600',
      badgeVariant: 'outline' as const,
    },
    {
      label: 'Cobranças vencendo hoje/amanhã',
      value: data?.cobrancasVencendoHoje ?? 0,
      icon: Clock,
      href: '/dashboard/cobrancas?filter=vencendo',
      color: 'border-l-orange-500',
      iconColor: 'text-orange-600',
      badgeVariant: 'outline' as const,
    },
    {
      label: 'Cobranças vencidas',
      value: data?.cobrancasVencidas ?? 0,
      icon: CreditCard,
      href: '/dashboard/cobrancas?filter=vencidas',
      color: 'border-l-red-500',
      iconColor: 'text-red-600',
      badgeVariant: 'destructive' as const,
    },
    {
      label: 'Propostas aguardando',
      value: data?.propostasPendentes ?? 0,
      icon: FileText,
      href: '/dashboard/motor-proposta',
      color: 'border-l-blue-500',
      iconColor: 'text-blue-600',
      badgeVariant: 'outline' as const,
    },
    {
      label: 'Ocorrências abertas',
      value: data?.ocorrenciasAbertas ?? 0,
      icon: AlertTriangle,
      href: '/dashboard/ocorrencias',
      color: 'border-l-amber-500',
      iconColor: 'text-amber-600',
      badgeVariant: 'outline' as const,
    },
  ];

  const kpiCards = [
    {
      label: 'Membros Ativos',
      value: data?.totalCooperadosAtivos ?? 0,
      format: (v: number) => v.toString(),
      icon: Users,
      iconColor: 'text-green-600',
    },
    {
      label: 'Receita Mensal',
      value: data?.receitaMensal ?? 0,
      format: (v: number) =>
        v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
      icon: DollarSign,
      iconColor: 'text-emerald-600',
    },
    {
      label: 'kWh Contratado',
      value: data?.kwhTotalContratado ?? 0,
      format: (v: number) =>
        v > 0
          ? `${v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} kWh`
          : '0 kWh',
      icon: Zap,
      iconColor: 'text-yellow-600',
    },
    {
      label: 'Ocupação Usinas',
      value: data?.ocupacaoMediaUsinas ?? 0,
      format: (v: number) => `${v}%`,
      icon: Gauge,
      iconColor: 'text-blue-600',
    },
  ];

  const quickAccessCards = [
    {
      label: 'Novo Membro',
      icon: UserPlus,
      href: '/dashboard/cooperados/novo',
      color: 'text-green-600',
    },
    {
      label: 'Nova Usina',
      icon: Sun,
      href: '/dashboard/usinas/novo',
      color: 'text-yellow-600',
    },
    {
      label: 'Gerar Proposta',
      icon: TrendingUp,
      href: '/dashboard/motor-proposta',
      color: 'text-blue-600',
    },
    {
      label: 'Ver Cobranças',
      icon: CreditCard,
      href: '/dashboard/cobrancas',
      color: 'text-purple-600',
    },
  ];

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold text-gray-800">Dashboard</h2>

      {/* Alert/Action Cards */}
      <section>
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Ações Pendentes
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {alertCards.map(
            ({ label, value, icon: Icon, href, color, iconColor, badgeVariant }) =>
              carregando ? (
                <SkeletonCard key={label} />
              ) : (
                <Link key={label} href={href}>
                  <Card
                    className={`border-l-4 ${color} hover:shadow-md transition-shadow cursor-pointer group`}
                  >
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-xs font-medium text-gray-500 leading-tight">
                        {label}
                      </CardTitle>
                      <Icon className={`h-4 w-4 ${iconColor} shrink-0`} />
                    </CardHeader>
                    <CardContent className="flex items-center justify-between">
                      <span className="text-2xl font-bold text-gray-800">
                        {value}
                      </span>
                      {value > 0 && (
                        <Badge variant={badgeVariant} className="text-[10px]">
                          {value > 0 ? 'Pendente' : ''}
                        </Badge>
                      )}
                      <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-gray-500 transition-colors" />
                    </CardContent>
                  </Card>
                </Link>
              ),
          )}
        </div>
      </section>

      {/* KPI Cards */}
      <section>
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Indicadores
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpiCards.map(({ label, value, format, icon: Icon, iconColor }) =>
            carregando ? (
              <SkeletonCard key={label} />
            ) : (
              <Card key={label}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-gray-500">
                    {label}
                  </CardTitle>
                  <Icon className={`h-5 w-5 ${iconColor}`} />
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-gray-800">
                    {format(value)}
                  </p>
                </CardContent>
              </Card>
            ),
          )}
        </div>
      </section>

      {/* Quick Access Cards */}
      <section>
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Acesso Rápido
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {quickAccessCards.map(({ label, icon: Icon, href, color }) => (
            <Link key={label} href={href}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer group">
                <CardContent className="flex flex-col items-center justify-center py-6 gap-3">
                  <div
                    className={`h-10 w-10 rounded-full bg-gray-50 flex items-center justify-center group-hover:scale-110 transition-transform`}
                  >
                    <Icon className={`h-5 w-5 ${color}`} />
                  </div>
                  <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
                    {label}
                  </span>
                  <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-gray-500 transition-colors" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
