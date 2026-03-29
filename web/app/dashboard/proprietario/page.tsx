'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Zap, DollarSign, BarChart3, Sun } from 'lucide-react';

interface UsinaResumo {
  id: string;
  nome: string;
  potenciaKwp: number;
  capacidadeKwh: number;
  kwhGeradoMes: number;
  kwhContratadoTotal: number;
  ocupacao: number;
  receitaPrevista: number;
  cidade: string;
  estado: string;
}

interface Repasse {
  mes: string;
  kwhGerado: number;
  valorRepassado: number;
  status: string;
}

export default function ProprietarioDashboardPage() {
  const [usinas, setUsinas] = useState<UsinaResumo[]>([]);
  const [repasses, setRepasses] = useState<Repasse[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    api.get('/usinas/proprietario/dashboard')
      .then((r) => {
        setUsinas(r.data.usinas || []);
        setRepasses(r.data.repasses || []);
      })
      .catch(() => {})
      .finally(() => setCarregando(false));
  }, []);

  const fmt = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtKwh = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  const totalGeradoMes = usinas.reduce((s, u) => s + u.kwhGeradoMes, 0);
  const totalCapacidade = usinas.reduce((s, u) => s + u.capacidadeKwh, 0);
  const totalReceita = usinas.reduce((s, u) => s + u.receitaPrevista, 0);
  const ocupacaoMedia = usinas.length > 0 ? Math.round(usinas.reduce((s, u) => s + u.ocupacao, 0) / usinas.length) : 0;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Sun className="h-6 w-6 text-yellow-500" />
        <h2 className="text-2xl font-bold text-gray-800">Portal do Proprietário</h2>
      </div>

      {carregando && <p className="text-gray-500">Carregando...</p>}

      {!carregando && usinas.length === 0 && (
        <p className="text-gray-400">Nenhuma usina vinculada ao seu perfil de proprietário.</p>
      )}

      {!carregando && usinas.length > 0 && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {/* kWh gerado vs contratado */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="h-4 w-4 text-yellow-500" />
                  <p className="text-sm text-gray-500">Geração este mês</p>
                </div>
                <p className="text-2xl font-bold text-gray-800">{fmtKwh(totalGeradoMes)} kWh</p>
                <div className="mt-2">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>{fmtKwh(totalGeradoMes)} / {fmtKwh(totalCapacidade)} kWh</span>
                    <span>{totalCapacidade > 0 ? Math.round((totalGeradoMes / totalCapacidade) * 100) : 0}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-yellow-500 h-2 rounded-full transition-all"
                      style={{ width: `${totalCapacidade > 0 ? Math.min(100, (totalGeradoMes / totalCapacidade) * 100) : 0}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Receita prevista */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="h-4 w-4 text-green-600" />
                  <p className="text-sm text-gray-500">Receita prevista este mês</p>
                </div>
                <p className="text-2xl font-bold text-green-700">R$ {fmt(totalReceita)}</p>
              </CardContent>
            </Card>

            {/* Ocupação */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-2">
                  <BarChart3 className="h-4 w-4 text-blue-600" />
                  <p className="text-sm text-gray-500">Ocupação média</p>
                </div>
                <p className="text-2xl font-bold text-gray-800">{ocupacaoMedia}%</p>
                <div className="mt-2">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${ocupacaoMedia >= 80 ? 'bg-green-500' : ocupacaoMedia >= 50 ? 'bg-yellow-500' : 'bg-red-400'}`}
                      style={{ width: `${ocupacaoMedia}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Total usinas */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-2">
                  <Sun className="h-4 w-4 text-orange-500" />
                  <p className="text-sm text-gray-500">Usinas</p>
                </div>
                <p className="text-2xl font-bold text-gray-800">{usinas.length}</p>
                <p className="text-sm text-gray-400 mt-1">
                  {usinas.reduce((s, u) => s + u.potenciaKwp, 0).toFixed(1)} kWp total
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Detalhamento por usina */}
          {usinas.map((u) => (
            <Card key={u.id} className="mb-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Sun className="h-4 w-4 text-yellow-500" />
                  {u.nome}
                  <span className="text-sm font-normal text-gray-400">— {u.cidade}/{u.estado}</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">Gerado este mês</p>
                    <p className="font-semibold">{fmtKwh(u.kwhGeradoMes)} kWh</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Capacidade</p>
                    <p className="font-semibold">{fmtKwh(u.capacidadeKwh)} kWh</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Ocupação</p>
                    <p className="font-semibold">{u.ocupacao}%</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Receita prevista</p>
                    <p className="font-semibold text-green-700">R$ {fmt(u.receitaPrevista)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Histórico de repasses */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-green-600" />
                Histórico de Repasses (últimos 6 meses)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mês</TableHead>
                    <TableHead className="text-right">kWh Gerado</TableHead>
                    <TableHead className="text-right">Valor Repassado</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {repasses.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-gray-400 py-6">
                        Nenhum repasse registrado.
                      </TableCell>
                    </TableRow>
                  )}
                  {repasses.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{r.mes}</TableCell>
                      <TableCell className="text-right">{fmtKwh(r.kwhGerado)}</TableCell>
                      <TableCell className="text-right font-semibold text-green-700">R$ {fmt(r.valorRepassado)}</TableCell>
                      <TableCell className="text-center">
                        <Badge className={r.status === 'PAGO' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}>
                          {r.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
