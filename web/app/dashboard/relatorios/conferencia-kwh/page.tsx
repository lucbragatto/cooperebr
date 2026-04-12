'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Zap, Filter, Loader2, TrendingUp, TrendingDown, CheckCircle } from 'lucide-react';

const cls = 'w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500 bg-white';

interface ConferenciaItem {
  cooperadoId: string;
  nome: string;
  ucNumero: string | null;
  kwhContratado: number;
  kwhCompensado: number;
  diferenca: number;
  status: 'OK' | 'EXCEDENTE' | 'DEFICIT';
}

interface ConferenciaData {
  competencia: string;
  totalCooperados: number;
  totalKwhContratado: number;
  totalKwhCompensado: number;
  resumo: { ok: number; excedente: number; deficit: number };
  itens: ConferenciaItem[];
}

function formatKwh(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function statusBadge(status: ConferenciaItem['status']) {
  switch (status) {
    case 'OK':
      return <Badge className="bg-green-100 text-green-700 border-green-200">OK</Badge>;
    case 'EXCEDENTE':
      return <Badge className="bg-blue-100 text-blue-700 border-blue-200">Excedente</Badge>;
    case 'DEFICIT':
      return <Badge className="bg-red-100 text-red-700 border-red-200">Deficit</Badge>;
  }
}

function competenciaAtual(): string {
  const now = new Date();
  const m = now.getMonth() + 1;
  return `${now.getFullYear()}-${m < 10 ? '0' + m : m}`;
}

export default function ConferenciaKwhPage() {
  const [dados, setDados] = useState<ConferenciaData | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [competencia, setCompetencia] = useState(competenciaAtual());

  useEffect(() => {
    buscar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function buscar() {
    setCarregando(true);
    const params = new URLSearchParams();
    if (competencia) params.set('competencia', competencia);
    api.get(`/relatorios/conferencia-kwh?${params.toString()}`)
      .then((r) => setDados(r.data))
      .catch(() => {})
      .finally(() => setCarregando(false));
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Zap className="h-6 w-6 text-yellow-600" />
        <h2 className="text-2xl font-bold text-gray-800">Conferencia kWh: Contratado vs Compensado</h2>
      </div>

      {/* Filtros */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="h-4 w-4" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-gray-500 mb-0.5 block">Competencia (mes)</label>
              <input
                type="month"
                className={cls}
                value={competencia}
                onChange={(e) => setCompetencia(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={buscar} disabled={carregando} className="w-full">
                {carregando && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                Consultar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {carregando ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="pt-6">
                  <Skeleton className="h-3 w-24 mb-2" />
                  <Skeleton className="h-8 w-36" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : dados && (
        <>
          {/* Cards de resumo */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <Zap className="h-4 w-4 text-yellow-600" />
                  <span className="text-xs text-yellow-600 font-medium">Total Contratado</span>
                </div>
                <p className="text-2xl font-bold text-gray-800">{formatKwh(dados.totalKwhContratado)} kWh</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{dados.totalCooperados} cooperados</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="h-4 w-4 text-blue-600" />
                  <span className="text-xs text-blue-600 font-medium">Total Compensado</span>
                </div>
                <p className="text-2xl font-bold text-gray-800">{formatKwh(dados.totalKwhCompensado)} kWh</p>
              </CardContent>
            </Card>
            <Card className="border-green-200 bg-green-50">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-xs text-green-600 font-medium">OK</span>
                </div>
                <p className="text-2xl font-bold text-green-800">{dados.resumo.ok}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 pb-4">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="flex items-center gap-1 mb-1">
                      <TrendingUp className="h-3 w-3 text-blue-600" />
                      <span className="text-[10px] text-blue-600 font-medium">Excedente</span>
                    </div>
                    <p className="text-xl font-bold text-blue-800">{dados.resumo.excedente}</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-1 mb-1">
                      <TrendingDown className="h-3 w-3 text-red-600" />
                      <span className="text-[10px] text-red-600 font-medium">Deficit</span>
                    </div>
                    <p className="text-xl font-bold text-red-800">{dados.resumo.deficit}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tabela detalhada */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Detalhamento por Cooperado</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cooperado</TableHead>
                    <TableHead>UC</TableHead>
                    <TableHead className="text-right">kWh Contratado</TableHead>
                    <TableHead className="text-right">kWh Compensado</TableHead>
                    <TableHead className="text-right">Diferenca</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dados.itens.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-gray-400 py-8">
                        Nenhum dado encontrado para esta competencia
                      </TableCell>
                    </TableRow>
                  ) : (
                    dados.itens.map((item) => (
                      <TableRow
                        key={item.cooperadoId}
                        className={
                          item.status === 'DEFICIT' ? 'bg-red-50' :
                          item.status === 'EXCEDENTE' ? 'bg-blue-50' : ''
                        }
                      >
                        <TableCell className="font-medium">{item.nome}</TableCell>
                        <TableCell className="text-gray-500 text-sm">{item.ucNumero ?? '—'}</TableCell>
                        <TableCell className="text-right">{formatKwh(item.kwhContratado)}</TableCell>
                        <TableCell className="text-right">{formatKwh(item.kwhCompensado)}</TableCell>
                        <TableCell className={`text-right font-medium ${
                          item.diferenca > 0 ? 'text-blue-700' :
                          item.diferenca < 0 ? 'text-red-700' : 'text-gray-600'
                        }`}>
                          {item.diferenca > 0 ? '+' : ''}{formatKwh(item.diferenca)}
                        </TableCell>
                        <TableCell className="text-center">{statusBadge(item.status)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
