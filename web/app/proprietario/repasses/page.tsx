'use client';

import { useEffect, useState } from 'react';
import { Loader2, DollarSign, Info, Filter } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import api from '@/lib/api';

interface Repasse {
  usinaId: string;
  usinaNome: string;
  mes: string;
  competencia: string;
  kwhGerado: number;
  valor: number | null;
  formula: string;
  fonteTarifa: string | null;
  motivo?: string;
  status: string;
}

interface Response {
  repasses: Repasse[];
  totalYTD: number;
  filtros: any;
}

function fmtMoney(v: number | null): string {
  if (v === null) return '—';
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtKwh(v: number): string {
  return `${v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} kWh`;
}

export default function ProprietarioRepassesPage() {
  const [data, setData] = useState<Response | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    api
      .get<Response>('/proprietario/repasses')
      .then((r) => setData(r.data))
      .catch(() => setData({ repasses: [], totalYTD: 0, filtros: {} }))
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
        <h1 className="text-2xl font-bold text-gray-900">Repasses</h1>
        <p className="text-sm text-gray-500 mt-1">Histórico cronológico de todos os repasses calculados</p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-md p-3 flex gap-2">
        <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <strong>Valores previstos.</strong> Pagamentos reais conforme contrato bilateral. Cálculo respeita
          a fórmula cadastrada por usina (FIXO / PERCENTUAL / HIBRIDO).
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-green-600" />
              Total YTD ({new Date().getFullYear()})
            </CardTitle>
            <span className="text-xl font-bold text-green-700">{fmtMoney(data?.totalYTD ?? 0)}</span>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Histórico</CardTitle>
        </CardHeader>
        <CardContent>
          {!data || data.repasses.length === 0 ? (
            <div className="text-center py-12">
              <DollarSign className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">Nenhum repasse registrado ainda.</p>
              <p className="text-gray-400 text-xs mt-1">Os repasses aparecem aqui conforme a geração mensal é registrada.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Período</TableHead>
                  <TableHead>Usina</TableHead>
                  <TableHead className="text-right">kWh Gerado</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Fonte tarifa</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.repasses.map((r, i) => (
                  <TableRow key={`${r.usinaId}-${r.competencia}-${i}`}>
                    <TableCell className="font-medium">{r.mes}</TableCell>
                    <TableCell>{r.usinaNome}</TableCell>
                    <TableCell className="text-right">{fmtKwh(r.kwhGerado)}</TableCell>
                    <TableCell className="text-right font-semibold text-green-700">
                      {fmtMoney(r.valor)}
                      {r.motivo && <p className="text-[10px] text-orange-600 mt-0.5">{r.motivo}</p>}
                    </TableCell>
                    <TableCell>
                      <Badge className={r.status === 'PAGO' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}>
                        {r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-gray-500">
                      {r.fonteTarifa ?? '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
