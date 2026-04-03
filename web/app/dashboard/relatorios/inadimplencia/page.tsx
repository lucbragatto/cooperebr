'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { getUsuario } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { AlertTriangle, Filter, Loader2, Users, DollarSign, Percent } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

const cls = 'w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500 bg-white';

function formatarMoeda(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

interface UsinaInadimplencia {
  usinaId: string;
  usinaNome: string;
  valor: number;
  qtd: number;
}

interface TipoCooperado {
  tipo: string;
  valor: number;
  qtd: number;
}

interface FaixaKwh {
  faixa: string;
  valor: number;
  qtd: number;
}

interface Top10Item {
  cooperadoId: string;
  nome: string;
  valor: number;
  qtdCobrancas: number;
  diasAtraso?: number;
}

interface DadosInadimplencia {
  totalValor: number;
  totalQtd: number;
  totalCooperados?: number;
  percentualCarteira?: number;
  porUsina: UsinaInadimplencia[];
  porTipoCooperado: TipoCooperado[];
  porFaixaKwh: FaixaKwh[];
  top10Inadimplentes: Top10Item[];
}

interface UsinaOption {
  id: string;
  nome: string;
}

interface CooperativaOption {
  id: string;
  nome: string;
}

function CustomBarTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
      <p className="text-sm font-medium text-gray-700 mb-1">{label}</p>
      <p className="text-sm text-red-600 font-medium">{formatarMoeda(payload[0].value)}</p>
    </div>
  );
}

export default function InadimplenciaPage() {
  const [dados, setDados] = useState<DadosInadimplencia | null>(null);
  const [carregando, setCarregando] = useState(true);

  // Filtros
  const [usinas, setUsinas] = useState<UsinaOption[]>([]);
  const [cooperativas, setCooperativas] = useState<CooperativaOption[]>([]);
  const [filtroUsina, setFiltroUsina] = useState('');
  const [filtroCooperativa, setFiltroCooperativa] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');

  useEffect(() => {
    api.get('/usinas').then((r) => setUsinas(r.data || [])).catch(() => {});
    const usuario = getUsuario() as { perfil?: string; cooperativaId?: string; cooperativaNome?: string } | null;
    if (usuario?.perfil === 'SUPER_ADMIN') {
      api.get('/cooperativas').then((r) => setCooperativas(r.data || [])).catch(() => {});
    } else if (usuario?.cooperativaId) {
      setCooperativas([{ id: usuario.cooperativaId, nome: usuario.cooperativaNome ?? 'Minha cooperativa' }]);
    }
  }, []);

  useEffect(() => {
    buscar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function buscar() {
    setCarregando(true);
    const params = new URLSearchParams();
    if (filtroUsina) params.set('usinaId', filtroUsina);
    if (filtroCooperativa) params.set('cooperativaId', filtroCooperativa);
    if (filtroTipo) params.set('tipoCooperado', filtroTipo);
    api.get(`/relatorios/inadimplencia?${params.toString()}`)
      .then((r) => setDados(r.data))
      .catch(() => {})
      .finally(() => setCarregando(false));
  }

  // Dados para gráfico de barras por usina
  const chartDataUsina = dados?.porUsina?.map((u) => ({
    name: u.usinaNome.length > 20 ? u.usinaNome.substring(0, 20) + '...' : u.usinaNome,
    valor: u.valor,
    qtd: u.qtd,
  })) ?? [];

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <AlertTriangle className="h-6 w-6 text-red-600" />
        <h2 className="text-2xl font-bold text-gray-800">Inadimplencia Estratificada</h2>
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
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="text-xs text-gray-500 mb-0.5 block">Usina</label>
              <select className={cls} value={filtroUsina} onChange={(e) => setFiltroUsina(e.target.value)}>
                <option value="">Todas</option>
                {usinas.map((u) => (
                  <option key={u.id} value={u.id}>{u.nome}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-0.5 block">Parceiro</label>
              <select className={cls} value={filtroCooperativa} onChange={(e) => setFiltroCooperativa(e.target.value)}>
                <option value="">Todos</option>
                {cooperativas.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-0.5 block">Tipo Cooperado</label>
              <select className={cls} value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
                <option value="">Todos</option>
                <option value="COM_UC">Com UC</option>
                <option value="SEM_UC">Sem UC</option>
                <option value="GERADOR">Gerador</option>
                <option value="CARREGADOR_VEICULAR">Carregador Veicular</option>
                <option value="USUARIO_CARREGADOR">Usuario Carregador</option>
              </select>
            </div>
            <div className="flex items-end">
              <Button onClick={buscar} disabled={carregando} className="w-full">
                {carregando && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                Filtrar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {carregando ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
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
          {/* Cards de resumo no topo */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <Card className="border-red-200 bg-red-50">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="h-4 w-4 text-red-600" />
                  <span className="text-xs text-red-600 font-medium">Total Inadimplente</span>
                </div>
                <p className="text-3xl font-bold text-red-800">{formatarMoeda(dados.totalValor)}</p>
                <p className="text-[10px] text-red-500 mt-0.5">{dados.totalQtd} cobrancas vencidas</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="h-4 w-4 text-orange-600" />
                  <span className="text-xs text-orange-600 font-medium">Cooperados Inadimplentes</span>
                </div>
                <p className="text-3xl font-bold text-orange-800">
                  {dados.totalCooperados ?? dados.top10Inadimplentes.length}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <Percent className="h-4 w-4 text-gray-600" />
                  <span className="text-xs text-gray-600 font-medium">% da Carteira</span>
                </div>
                <p className="text-3xl font-bold text-gray-800">
                  {dados.percentualCarteira !== undefined
                    ? `${dados.percentualCarteira.toFixed(1)}%`
                    : '—'}
                </p>
                <p className="text-[10px] text-gray-400 mt-0.5">Valor inadimplente / total faturado</p>
              </CardContent>
            </Card>
          </div>

          {/* Gráfico de barras: inadimplência por usina */}
          {chartDataUsina.length > 0 && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-base">Inadimplencia por Usina</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={chartDataUsina} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip content={<CustomBarTooltip />} />
                    <Bar dataKey="valor" name="Valor Inadimplente" fill="#dc2626" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Por Usina (tabela) */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-base">Por Usina</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usina</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-center">Qtd</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dados.porUsina.length === 0 ? (
                    <TableRow><TableCell colSpan={3} className="text-center text-gray-400 py-4">Nenhum dado</TableCell></TableRow>
                  ) : (
                    dados.porUsina.map((u) => (
                      <TableRow key={u.usinaId}>
                        <TableCell className="font-medium">{u.usinaNome}</TableCell>
                        <TableCell className="text-right text-red-700 font-medium">{formatarMoeda(u.valor)}</TableCell>
                        <TableCell className="text-center">{u.qtd}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Por Tipo Cooperado + Por Faixa kWh */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Por Tipo de Cooperado</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="text-center">Qtd</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dados.porTipoCooperado.map((t) => (
                      <TableRow key={t.tipo}>
                        <TableCell className="font-medium">{t.tipo.replace(/_/g, ' ')}</TableCell>
                        <TableCell className="text-right text-red-700">{formatarMoeda(t.valor)}</TableCell>
                        <TableCell className="text-center">{t.qtd}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Por Faixa de kWh Contratado</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Faixa</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="text-center">Qtd</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dados.porFaixaKwh.map((f) => (
                      <TableRow key={f.faixa}>
                        <TableCell className="font-medium">{f.faixa} kWh</TableCell>
                        <TableCell className="text-right text-red-700">{formatarMoeda(f.valor)}</TableCell>
                        <TableCell className="text-center">{f.qtd}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* Top 10 com highlight >60 dias */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top 10 Maiores Inadimplentes</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead className="text-right">Valor Total</TableHead>
                    <TableHead className="text-center">Cobrancas</TableHead>
                    <TableHead className="text-center">Atraso</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dados.top10Inadimplentes.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center text-gray-400 py-4">Nenhum inadimplente</TableCell></TableRow>
                  ) : (
                    dados.top10Inadimplentes.map((c, i) => {
                      const diasAtraso = c.diasAtraso ?? 0;
                      const isCritico = diasAtraso > 60;
                      return (
                        <TableRow
                          key={c.cooperadoId}
                          className={isCritico ? 'bg-red-50' : ''}
                        >
                          <TableCell className="font-bold text-gray-500">{i + 1}</TableCell>
                          <TableCell className="font-medium">
                            {c.nome}
                            {isCritico && (
                              <Badge className="ml-2 bg-red-100 text-red-700 border-red-200 text-[10px]">
                                Critico
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className={`text-right font-medium ${isCritico ? 'text-red-800' : 'text-red-700'}`}>
                            {formatarMoeda(c.valor)}
                          </TableCell>
                          <TableCell className="text-center">{c.qtdCobrancas}</TableCell>
                          <TableCell className="text-center">
                            {diasAtraso > 0 ? (
                              <span className={`text-xs font-medium ${
                                diasAtraso > 60 ? 'text-red-700' :
                                diasAtraso > 30 ? 'text-orange-600' :
                                'text-yellow-600'
                              }`}>
                                {diasAtraso} dias
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
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
