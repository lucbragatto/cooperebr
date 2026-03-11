'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Zap, Sun, CreditCard } from 'lucide-react';

interface KPIs {
  totalCooperados: number;
  totalUcs: number;
  totalUsinas: number;
  cobrancasPendentes: number;
}

export default function DashboardPage() {
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    async function buscarDados() {
      try {
        const [cooperados, ucs, usinas, cobrancas] = await Promise.all([
          api.get('/cooperados'),
          api.get('/ucs'),
          api.get('/usinas'),
          api.get('/cobrancas'),
        ]);
        setKpis({
          totalCooperados: cooperados.data.length,
          totalUcs: ucs.data.length,
          totalUsinas: usinas.data.length,
          cobrancasPendentes: cobrancas.data.filter(
            (c: { status: string }) => c.status === 'PENDENTE',
          ).length,
        });
      } finally {
        setCarregando(false);
      }
    }
    buscarDados();
  }, []);

  const cards = [
    { label: 'Total Cooperados', icon: Users, value: kpis?.totalCooperados, color: 'text-blue-600' },
    { label: 'Total UCs', icon: Zap, value: kpis?.totalUcs, color: 'text-yellow-600' },
    { label: 'Total Usinas', icon: Sun, value: kpis?.totalUsinas, color: 'text-green-600' },
    { label: 'Cobranças Pendentes', icon: CreditCard, value: kpis?.cobrancasPendentes, color: 'text-red-600' },
  ];

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Dashboard</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(({ label, icon: Icon, value, color }) => (
          <Card key={label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">{label}</CardTitle>
              <Icon className={`h-5 w-5 ${color}`} />
            </CardHeader>
            <CardContent>
              {carregando ? (
                <div className="h-8 w-16 bg-gray-200 animate-pulse rounded" />
              ) : (
                <p className="text-3xl font-bold text-gray-800">{value ?? 0}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
