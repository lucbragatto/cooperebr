'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Loader2,
  Sun,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  CalendarClock,
  Zap,
  Info,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import api from '@/lib/api';

interface UsinaResumo {
  id: string;
  nome: string;
  apelidoInterno: string | null;
  cidade: string;
  estado: string;
  statusHomologacao: string;
  statusOperacional: string;
  capacidadeKwh: number;
  kwhGeradoMes: number;
  ocupacao: number;
  repasseMesAtual: { valor: number | null; formula: string; motivo?: string; fonteTarifa: string | null };
  repasseYTD: number;
  visualStatus: 'ok' | 'atencao' | 'critico';
  alertasAtivos: number;
}

interface DashboardResponse {
  kpisTop: {
    receberEsseMes: number;
    statusPagamentoMesAtual: string;
    usinasOk: number;
    usinasAtencao: number;
    usinasCritico: number;
    totalYTD: number;
    contratosVencendo30d: number;
  };
  usinas: UsinaResumo[];
  ultimaAtualizacao: string;
}

const STATUS_OP_COR: Record<string, string> = {
  OPERANDO: 'bg-green-100 text-green-700',
  MANUTENCAO_PLANEJADA: 'bg-blue-100 text-blue-700',
  MANUTENCAO_EMERGENCIAL: 'bg-orange-100 text-orange-700',
  DESLIGADA: 'bg-gray-200 text-gray-700',
  OFFLINE: 'bg-red-100 text-red-700',
};

const VISUAL_BORDER: Record<string, string> = {
  ok: 'border-l-4 border-l-green-500',
  atencao: 'border-l-4 border-l-yellow-500',
  critico: 'border-l-4 border-l-red-500',
};

function fmtMoney(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—';
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtKwh(v: number): string {
  return `${v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} kWh`;
}

export default function ProprietarioDashboardPage() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<DashboardResponse>('/proprietario/dashboard')
      .then((r) => setData(r.data))
      .catch((e: any) => setErro(e?.response?.data?.message ?? 'Falha ao carregar dashboard.'))
      .finally(() => setCarregando(false));
  }, []);

  if (carregando) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-amber-600 animate-spin" />
      </div>
    );
  }

  if (erro || !data) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <p className="text-red-600 text-sm">{erro ?? 'Sem dados disponíveis.'}</p>
        </CardContent>
      </Card>
    );
  }

  const { kpisTop, usinas } = data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard do Proprietário</h1>
        <p className="text-sm text-gray-500 mt-1">
          Visão consolidada das suas usinas em {new Date().toLocaleDateString('pt-BR')}
        </p>
      </div>

      {/* Help inline */}
      <div className="bg-blue-50 border border-blue-200 rounded-md p-3 flex gap-2">
        <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <strong>Como ler:</strong> "Receber esse mês" é o repasse previsto conforme contrato (fórmula
          aplicada visível no detalhe). Status das usinas combina monitoramento técnico + operacional.
          Valores reais de pagamento dependem do contrato bilateral.
        </div>
      </div>

      {/* 5 KPIs grandes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Receber esse mês</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700">{fmtMoney(kpisTop.receberEsseMes)}</div>
            <p className="text-xs text-gray-500 mt-1">previsto pra este mês</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Pagamento</CardTitle>
            <CalendarClock className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <Badge className="bg-amber-100 text-amber-800">{kpisTop.statusPagamentoMesAtual}</Badge>
            <p className="text-xs text-gray-500 mt-2">conforme contrato bilateral</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Status técnico usinas</CardTitle>
            <Sun className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 items-baseline">
              <span className="text-green-700 font-bold text-lg">{kpisTop.usinasOk}</span>
              <span className="text-xs text-gray-500">ok</span>
              <span className="text-yellow-600 font-bold">{kpisTop.usinasAtencao}</span>
              <span className="text-xs text-gray-500">atenção</span>
              <span className="text-red-600 font-bold">{kpisTop.usinasCritico}</span>
              <span className="text-xs text-gray-500">crítico</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Total YTD</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700">{fmtMoney(kpisTop.totalYTD)}</div>
            <p className="text-xs text-gray-500 mt-1">acumulado {new Date().getFullYear()}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Contratos a vencer</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-700">{kpisTop.contratosVencendo30d}</div>
            <p className="text-xs text-gray-500 mt-1">próximos 30 dias</p>
          </CardContent>
        </Card>
      </div>

      {/* Grid de cards por usina */}
      <div>
        <h2 className="text-lg font-semibold mb-3 text-gray-700">Suas Usinas</h2>
        {usinas.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12 text-gray-500 text-sm">
              Nenhuma usina vinculada ao seu perfil.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {usinas.map((u) => (
              <Link key={u.id} href={`/proprietario/usinas/${u.id}`}>
                <Card className={`${VISUAL_BORDER[u.visualStatus]} hover:shadow-md transition-shadow cursor-pointer`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Sun className="w-4 h-4 text-amber-500" />
                        {u.nome}
                      </CardTitle>
                      <Badge className={STATUS_OP_COR[u.statusOperacional] ?? 'bg-gray-100'}>
                        {u.statusOperacional.replace(/_/g, ' ')}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-500">{u.cidade}/{u.estado}</p>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-gray-500 text-xs flex items-center gap-1"><Zap className="w-3 h-3" /> Geração mês</p>
                        <p className="font-semibold">{fmtKwh(u.kwhGeradoMes)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs">Repasse previsto</p>
                        <p className="font-semibold text-green-700">{fmtMoney(u.repasseMesAtual.valor)}</p>
                        {u.repasseMesAtual.motivo && (
                          <p className="text-[10px] text-orange-600 mt-1">{u.repasseMesAtual.motivo}</p>
                        )}
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs">Ocupação contratos</p>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-200 rounded h-2 overflow-hidden">
                            <div
                              className={`h-full ${
                                u.ocupacao >= 80 ? 'bg-green-500' : u.ocupacao >= 50 ? 'bg-yellow-500' : 'bg-red-400'
                              }`}
                              style={{ width: `${u.ocupacao}%` }}
                            />
                          </div>
                          <span className="text-xs font-semibold">{u.ocupacao}%</span>
                        </div>
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs">YTD</p>
                        <p className="font-semibold">{fmtMoney(u.repasseYTD)}</p>
                      </div>
                    </div>
                    {u.alertasAtivos > 0 && (
                      <div className="mt-3 text-xs text-orange-600 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> {u.alertasAtivos} alerta(s) ativo(s)
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400 text-right">
        Última atualização: {new Date(data.ultimaAtualizacao).toLocaleString('pt-BR')}
      </p>
    </div>
  );
}
