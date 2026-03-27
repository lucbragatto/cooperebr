'use client';

import { useEffect, useState } from 'react';
import { Loader2, DollarSign, TrendingUp, TrendingDown, ArrowUpRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import api from '@/lib/api';

export default function ParceiroFinanceiroPage() {
  const [cobrancas, setCobrancas] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    async function carregar() {
      try {
        const { data } = await api.get('/cobrancas');
        setCobrancas(Array.isArray(data) ? data : data?.data ?? []);
      } catch {
        // ignore
      } finally {
        setCarregando(false);
      }
    }
    carregar();
  }, []);

  const recebido = cobrancas
    .filter((c) => c.status === 'PAGO')
    .reduce((acc, c) => acc + Number(c.valorLiquido ?? c.valor ?? 0), 0);
  const pendente = cobrancas
    .filter((c) => c.status === 'A_VENCER')
    .reduce((acc, c) => acc + Number(c.valorLiquido ?? c.valor ?? 0), 0);
  const vencido = cobrancas
    .filter((c) => c.status === 'VENCIDO')
    .reduce((acc, c) => acc + Number(c.valorLiquido ?? c.valor ?? 0), 0);

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
        <h1 className="text-2xl font-bold text-gray-900">Financeiro</h1>
        <p className="text-sm text-gray-500 mt-1">Visão financeira do parceiro</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Recebido</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700">
              R$ {recebido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">A Receber</CardTitle>
            <DollarSign className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700">
              R$ {pendente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Vencido</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700">
              R$ {vencido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de cobranças */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Cobranças Recentes</CardTitle>
        </CardHeader>
        <CardContent>
          {cobrancas.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">Nenhuma cobrança encontrada.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="py-2 pr-4">Membro</th>
                    <th className="py-2 pr-4">Ref.</th>
                    <th className="py-2 pr-4">Valor</th>
                    <th className="py-2 pr-4">Vencimento</th>
                    <th className="py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {cobrancas.slice(0, 20).map((c: any) => (
                    <tr key={c.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="py-2 pr-4 max-w-[180px] truncate">
                        {c.cooperado?.nomeCompleto ?? c.cooperadoId?.slice(0, 8) ?? '-'}
                      </td>
                      <td className="py-2 pr-4">{c.mesReferencia}/{c.anoReferencia}</td>
                      <td className="py-2 pr-4">
                        R$ {Number(c.valorLiquido ?? c.valor ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-2 pr-4">
                        {c.dataVencimento ? new Date(c.dataVencimento).toLocaleDateString('pt-BR') : '-'}
                      </td>
                      <td className="py-2">
                        <Badge className={
                          c.status === 'PAGO' ? 'bg-green-100 text-green-700' :
                          c.status === 'VENCIDO' ? 'bg-red-100 text-red-700' :
                          c.status === 'A_VENCER' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-500'
                        }>
                          {c.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
