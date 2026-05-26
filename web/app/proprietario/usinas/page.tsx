'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Sun, MapPin, Zap, DollarSign, AlertTriangle } from 'lucide-react';
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
  repasseMesAtual: { valor: number | null; motivo?: string };
  repasseYTD: number;
  visualStatus: 'ok' | 'atencao' | 'critico';
  alertasAtivos: number;
}

interface DashboardResponse {
  usinas: UsinaResumo[];
}

const STATUS_OP_COR: Record<string, string> = {
  OPERANDO: 'bg-green-100 text-green-700',
  MANUTENCAO_PLANEJADA: 'bg-blue-100 text-blue-700',
  MANUTENCAO_EMERGENCIAL: 'bg-orange-100 text-orange-700',
  DESLIGADA: 'bg-gray-200 text-gray-700',
  OFFLINE: 'bg-red-100 text-red-700',
};

function fmtMoney(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—';
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtKwh(v: number): string {
  return `${v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} kWh`;
}

export default function ProprietarioUsinasPage() {
  const [usinas, setUsinas] = useState<UsinaResumo[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    api
      .get<DashboardResponse>('/proprietario/dashboard')
      .then((r) => setUsinas(r.data.usinas ?? []))
      .catch(() => setUsinas([]))
      .finally(() => setCarregando(false));
  }, []);

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
        <h1 className="text-2xl font-bold text-gray-900">Minhas Usinas</h1>
        <p className="text-sm text-gray-500 mt-1">{usinas.length} usina(s) — clique pra ver detalhe</p>
      </div>

      {usinas.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12 text-gray-500 text-sm">
            Nenhuma usina vinculada ao seu perfil.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {usinas.map((u) => (
            <Link key={u.id} href={`/proprietario/usinas/${u.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Sun className="w-5 h-5 text-amber-500" />
                      {u.nome}
                    </CardTitle>
                    <Badge className={STATUS_OP_COR[u.statusOperacional] ?? 'bg-gray-100'}>
                      {u.statusOperacional.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500 flex items-center gap-1 mb-1"><MapPin className="w-3 h-3" /> Localização</p>
                      <p className="font-semibold">{u.cidade}/{u.estado}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 flex items-center gap-1 mb-1"><Zap className="w-3 h-3" /> Geração mês</p>
                      <p className="font-semibold">{fmtKwh(u.kwhGeradoMes)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 flex items-center gap-1 mb-1"><DollarSign className="w-3 h-3" /> Repasse mês</p>
                      <p className="font-semibold text-green-700">{fmtMoney(u.repasseMesAtual.valor)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 mb-1">Ocupação</p>
                      <p className="font-semibold">{u.ocupacao}%</p>
                    </div>
                    <div>
                      <p className="text-gray-500 mb-1">YTD</p>
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
  );
}
