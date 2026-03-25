'use client';

import { useEffect, useState } from 'react';
import { Loader2, Sun, DollarSign, Zap, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import api from '@/lib/api';
import type { MeResponse } from '@/types';

export default function ProprietarioDashboardPage() {
  const [usinas, setUsinas] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    async function carregar() {
      try {
        const { data: me } = await api.get<MeResponse>('/auth/me');
        if (me.usinasProprietario.length > 0) {
          const ids = me.usinasProprietario.map((u) => u.id);
          const { data: allUsinas } = await api.get('/usinas');
          const arr = Array.isArray(allUsinas) ? allUsinas : allUsinas?.data ?? [];
          setUsinas(arr.filter((u: any) => ids.includes(u.id)));
        }
      } catch {
        // ignore
      } finally {
        setCarregando(false);
      }
    }
    carregar();
  }, []);

  const producaoTotal = usinas.reduce(
    (acc, u) => acc + (Number(u.producaoMensalKwh) || 0),
    0,
  );
  const capacidadeTotal = usinas.reduce(
    (acc, u) => acc + (Number(u.capacidadeKwh) || 0),
    0,
  );
  const potenciaTotal = usinas.reduce(
    (acc, u) => acc + (Number(u.potenciaKwp) || 0),
    0,
  );

  if (carregando) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-amber-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard do Proprietário</h1>
        <p className="text-sm text-gray-500 mt-1">Visão geral das suas usinas</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Usinas</CardTitle>
            <Sun className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{usinas.length}</div>
            <p className="text-xs text-gray-500 mt-1">
              {potenciaTotal.toLocaleString('pt-BR')} kWp total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Produção Mensal</CardTitle>
            <Zap className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {producaoTotal.toLocaleString('pt-BR')}
            </div>
            <p className="text-xs text-gray-500 mt-1">kWh estimado</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Capacidade</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {capacidadeTotal.toLocaleString('pt-BR')}
            </div>
            <p className="text-xs text-gray-500 mt-1">kWh total</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Repasse do Mês</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ 0,00</div>
            <p className="text-xs text-gray-500 mt-1">aguardando cálculo</p>
          </CardContent>
        </Card>
      </div>

      {/* Lista de usinas resumo */}
      {usinas.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {usinas.map((u: any) => (
            <Card key={u.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-amber-50 text-amber-600">
                    <Sun className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{u.nome}</p>
                    <p className="text-xs text-gray-500">{u.cidade}/{u.estado}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-sm">{Number(u.potenciaKwp).toLocaleString('pt-BR')} kWp</p>
                    <p className="text-xs text-gray-500">{u.statusHomologacao?.replace(/_/g, ' ')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
