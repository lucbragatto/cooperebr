'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { TrendingUp, Loader2 } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

const cls = 'w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500 bg-white';

const mesesNome = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export default function ProjecaoReceitaPage() {
  const [dados, setDados] = useState<any>(null);
  const [carregando, setCarregando] = useState(true);
  const [meses, setMeses] = useState('6');

  useEffect(() => {
    buscar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function buscar() {
    setCarregando(true);
    api.get(`/relatorios/projecao-receita?meses=${meses}`)
      .then((r) => setDados(r.data))
      .catch(() => {})
      .finally(() => setCarregando(false));
  }

  const chartData = dados?.projecao?.map((p: any) => ({
    label: `${mesesNome[p.mes]}/${p.anoReferencia}`,
    receita: p.receitaProjetada,
    kwh: p.kwhProjetado,
  })) ?? [];

  const totalReceita = dados?.projecao?.reduce((s: number, p: any) => s + p.receitaProjetada, 0) ?? 0;
  const totalKwh = dados?.projecao?.reduce((s: number, p: any) => s + p.kwhProjetado, 0) ?? 0;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <TrendingUp className="h-6 w-6 text-green-600" />
        <h2 className="text-2xl font-bold text-gray-800">Projecao de Receita</h2>
      </div>

      {/* Controles */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-end gap-4">
            <div>
              <label className="text-xs text-gray-500 mb-0.5 block">Meses a projetar</label>
              <select className={cls} value={meses} onChange={(e) => setMeses(e.target.value)}>
                <option value="3">3 meses</option>
                <option value="6">6 meses</option>
                <option value="12">12 meses</option>
              </select>
            </div>
            <Button onClick={buscar} disabled={carregando}>
              {carregando && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Projetar
            </Button>
          </div>
        </CardContent>
      </Card>

      {carregando && <p className="text-gray-500">Carregando...</p>}

      {dados && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs text-green-600 font-medium">Receita Projetada Total</p>
                <p className="text-3xl font-bold text-green-800">R$ {totalReceita.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs text-blue-600 font-medium">kWh Projetado Total</p>
                <p className="text-3xl font-bold text-blue-800">{totalKwh.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs text-gray-600 font-medium">Meses Projetados</p>
                <p className="text-3xl font-bold text-gray-800">{dados.mesesProjetados}</p>
              </CardContent>
            </Card>
          </div>

          {/* Gráfico */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-base">Receita Projetada (R$)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis />
                  <Tooltip
                    formatter={(value: any, name: any) => [
                      name === 'receita'
                        ? `R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                        : `${Number(value).toLocaleString('pt-BR')} kWh`,
                      name === 'receita' ? 'Receita' : 'kWh',
                    ]}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="receita" stroke="#16a34a" strokeWidth={2} name="Receita (R$)" dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="kwh" stroke="#2563eb" strokeWidth={2} name="kWh" dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Tabela mês a mês */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-base">Detalhamento Mensal</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mês</TableHead>
                    <TableHead>Receita Projetada</TableHead>
                    <TableHead>kWh Projetado</TableHead>
                    <TableHead>Contratos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dados.projecao.map((p: any) => (
                    <TableRow key={`${p.mes}-${p.anoReferencia}`}>
                      <TableCell className="font-medium">{mesesNome[p.mes]}/{p.anoReferencia}</TableCell>
                      <TableCell>R$ {p.receitaProjetada.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell>{p.kwhProjetado.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</TableCell>
                      <TableCell>{p.qtdContratos}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Breakdown por Usina */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Breakdown por Usina</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usina</TableHead>
                    <TableHead>Receita Total Projetada</TableHead>
                    <TableHead>kWh Total</TableHead>
                    <TableHead>Contratos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dados.porUsina.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center text-gray-400 py-4">Nenhum dado</TableCell></TableRow>
                  ) : (
                    dados.porUsina.map((u: any) => (
                      <TableRow key={u.usinaId}>
                        <TableCell className="font-medium">{u.usinaNome}</TableCell>
                        <TableCell>R$ {u.receitaTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                        <TableCell>{u.kwhTotal.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</TableCell>
                        <TableCell>{u.qtdContratos}</TableCell>
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
