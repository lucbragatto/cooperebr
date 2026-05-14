'use client';

import { useEffect, useState } from 'react';
import { Users, DollarSign, AlertTriangle, Sun, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import api from '@/lib/api';

interface KPIs {
  membrosAtivos: number;
  membrosTotal: number;
  inadimplentes: number;
  receitaMes: number;
  usinasTotal: number;
  capacidadeKwh: number;
}

export default function ParceiroDashboardPage() {
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    async function carregar() {
      try {
        const [dashRes, usinasRes] = await Promise.allSettled([
          api.get('/cooperativas/meu-dashboard'),
          api.get('/usinas'),
        ]);

        const dash = dashRes.status === 'fulfilled' ? dashRes.value.data : null;
        const usinas = usinasRes.status === 'fulfilled' ? usinasRes.value.data : [];
        const usinasArr = Array.isArray(usinas) ? usinas : usinas?.data ?? [];

        setKpis({
          membrosAtivos: dash?.membrosAtivos ?? 0,
          membrosTotal: dash?.membrosTotal ?? 0,
          inadimplentes: dash?.inadimplentes ?? 0,
          receitaMes: dash?.receitaMes ?? 0,
          usinasTotal: usinasArr.length,
          capacidadeKwh: usinasArr.reduce((acc: number, u: any) => acc + (Number(u.capacidadeKwh) || 0), 0),
        });
      } catch {
        // silently ignore
      } finally {
        setCarregando(false);
      }
    }
    carregar();
  }, []);

  if (carregando) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard do Parceiro</h1>
        <p className="text-sm text-gray-500 mt-1">Visão geral da sua cooperativa</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Membros Ativos</CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis?.membrosAtivos ?? 0}</div>
            <p className="text-xs text-gray-500 mt-1">de {kpis?.membrosTotal ?? 0} total</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Inadimplência</CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis?.inadimplentes ?? 0}</div>
            <p className="text-xs text-gray-500 mt-1">membros inadimplentes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Receita do Mês</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              R$ {(kpis?.receitaMes ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-gray-500 mt-1">cobranças recebidas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Usinas</CardTitle>
            <Sun className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis?.usinasTotal ?? 0}</div>
            <p className="text-xs text-gray-500 mt-1">
              {(kpis?.capacidadeKwh ?? 0).toLocaleString('pt-BR')} kWh capacidade
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <a href="/dashboard/cooperados" className="block p-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-50 text-blue-600">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <p className="font-medium text-sm">Gerenciar Membros</p>
                <p className="text-xs text-gray-500">Ver lista e status</p>
              </div>
            </div>
          </a>
        </Card>
        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <a href="/parceiro/financeiro" className="block p-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-green-50 text-green-600">
                <DollarSign className="w-5 h-5" />
              </div>
              <div>
                <p className="font-medium text-sm">Financeiro</p>
                <p className="text-xs text-gray-500">Contas e repasses</p>
              </div>
            </div>
          </a>
        </Card>
        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <a href="/parceiro/usinas" className="block p-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-amber-50 text-amber-600">
                <Sun className="w-5 h-5" />
              </div>
              <div>
                <p className="font-medium text-sm">Usinas</p>
                <p className="text-xs text-gray-500">Produção e alertas</p>
              </div>
            </div>
          </a>
        </Card>
      </div>
    </div>
  );
}
