'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart3, Printer, Settings, TrendingUp, Zap } from 'lucide-react';

interface DashStats {
  mediaCooperativaKwh: number;
  propostasPendentes: number;
  propostasAceitasNoMes: number;
  tarifaVigente: number | null;
  ultimasPropostas: Array<{
    id: string;
    status: string;
    mesReferencia: string;
    kwhContrato: number;
    economiaMensal: number;
    createdAt: string;
    cooperado: { nomeCompleto: string };
    plano: { nome: string } | null;
  }>;
}

const statusColors: Record<string, string> = {
  PENDENTE: 'bg-yellow-100 text-yellow-800',
  ACEITA: 'bg-green-100 text-green-800',
  RECUSADA: 'bg-red-100 text-red-800',
  EXPIRADA: 'bg-gray-100 text-gray-800',
};

function fmt5(v: number | undefined | null) {
  if (v == null) return '—';
  return Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 5, maximumFractionDigits: 5 });
}

function fmtBRL(v: number | undefined | null) {
  if (v == null) return '—';
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function MotorPropostaPage() {
  const [stats, setStats] = useState<DashStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<DashStats>('/motor-proposta').then(r => setStats(r.data)).finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">Motor de Proposta</h2>
        <div className="flex gap-2">
          <Link href="/dashboard/motor-proposta/tarifas"><Button variant="outline" size="sm"><TrendingUp className="h-4 w-4 mr-2" />Tarifas</Button></Link>
          <Link href="/dashboard/motor-proposta/reajustes"><Button variant="outline" size="sm"><BarChart3 className="h-4 w-4 mr-2" />Reajustes</Button></Link>
          <Link href="/dashboard/motor-proposta/configuracao"><Button variant="outline" size="sm"><Settings className="h-4 w-4 mr-2" />Configuração</Button></Link>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-gray-500 font-medium uppercase tracking-wide">Média cooperativa</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-gray-900">{loading ? '...' : `R$ ${fmt5(stats?.mediaCooperativaKwh)}`}</p><p className="text-xs text-gray-400 mt-1">por kWh</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-gray-500 font-medium uppercase tracking-wide">Propostas pendentes</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-yellow-700">{loading ? '...' : stats?.propostasPendentes ?? 0}</p><p className="text-xs text-gray-400 mt-1">aguardando aceite</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-gray-500 font-medium uppercase tracking-wide">Aceitas no mês</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-green-700">{loading ? '...' : stats?.propostasAceitasNoMes ?? 0}</p><p className="text-xs text-gray-400 mt-1">este mês</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-gray-500 font-medium uppercase tracking-wide">Tarifa vigente</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-gray-900">{loading ? '...' : stats?.tarifaVigente ? `R$ ${fmt5(stats.tarifaVigente)}` : '—'}</p><p className="text-xs text-gray-400 mt-1">TUSD + TE (R$/kWh)</p></CardContent>
        </Card>
      </div>

      {/* Últimas propostas */}
      <Card>
        <CardHeader><CardTitle className="text-sm font-semibold text-gray-700">Últimas propostas geradas</CardTitle></CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-gray-400 text-sm">Carregando...</div>
          ) : !stats?.ultimasPropostas?.length ? (
            <div className="p-8 text-center text-gray-400 text-sm">Nenhuma proposta gerada ainda.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Cooperado</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Referência</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500">kWh contrato</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500">Economia/mês</th>
                  <th className="text-center px-4 py-2.5 text-xs font-medium text-gray-500">Status</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {stats.ultimasPropostas.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{p.cooperado.nomeCompleto}</td>
                    <td className="px-4 py-3 text-gray-500">{p.mesReferencia}</td>
                    <td className="px-4 py-3 text-right">{fmt5(p.kwhContrato)}</td>
                    <td className="px-4 py-3 text-right text-green-700 font-medium">{fmtBRL(p.economiaMensal)}</td>
                    <td className="px-4 py-3 text-center"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[p.status] ?? 'bg-gray-100 text-gray-600'}`}>{p.status}</span></td>
                    <td className="px-4 py-3 text-right space-x-1">
                      <Button variant="ghost" size="sm" onClick={async () => {
                        try {
                          const r = await api.get(`/motor-proposta/proposta/${p.id}/html`, { responseType: 'text' });
                          const blob = new Blob([r.data], { type: 'text/html' });
                          const url = URL.createObjectURL(blob);
                          window.open(url, '_blank');
                        } catch { alert('Erro ao carregar proposta'); }
                      }}>
                        <Printer className="h-3.5 w-3.5 mr-1" />Ver / Imprimir
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
