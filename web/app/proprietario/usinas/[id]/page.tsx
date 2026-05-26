'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Loader2,
  Sun,
  ArrowLeft,
  AlertTriangle,
  Info,
  Download,
  Users,
  FileText,
  BarChart3,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from 'recharts';
import api from '@/lib/api';

interface DetalheUsinaResponse {
  usina: any;
  geracaoHistorica12m: Array<{ mes: string; competencia: string; kwhGerado: number; kwhProjetado: number }>;
  repassesHistoricos: Array<{
    mes: string;
    competencia: string;
    kwhGerado: number;
    valor: number | null;
    formula: string;
    fonteTarifa: string | null;
    motivo?: string;
    status: string;
  }>;
  cooperadosAnonimizados: {
    total: number;
    kwhContratadoTotal: number;
    ocupacaoPercentual: number;
    lista: Array<{ apelido: string; kwhContratado: number; percentualUsina: number }>;
  };
  contratos: Array<any>;
  alertas: Array<any>;
  responsabilidadeDespesas: Record<string, string>;
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

export default function DetalheUsinaPage() {
  const params = useParams();
  const usinaId = params?.id as string;
  const [data, setData] = useState<DetalheUsinaResponse | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!usinaId) return;
    api
      .get<DetalheUsinaResponse>(`/proprietario/usinas/${usinaId}`)
      .then((r) => setData(r.data))
      .catch((e: any) => setErro(e?.response?.data?.message ?? 'Falha ao carregar detalhe.'))
      .finally(() => setCarregando(false));
  }, [usinaId]);

  function baixarRelatorioPdf(mesAno: string) {
    const url = `/api/proprietario/relatorios/${usinaId}/${mesAno}`;
    window.open(url, '_blank');
  }

  if (carregando) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-amber-600 animate-spin" />
      </div>
    );
  }

  if (erro || !data) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <p className="text-red-600 text-sm">{erro ?? 'Sem dados.'}</p>
          <Link href="/proprietario" className="text-blue-600 text-sm mt-2 inline-block">← Voltar</Link>
        </CardContent>
      </Card>
    );
  }

  const { usina, geracaoHistorica12m, repassesHistoricos, cooperadosAnonimizados, contratos, alertas, responsabilidadeDespesas } = data;
  const mesAtual = new Date().toISOString().slice(0, 7);
  const mesAnterior = (() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 7);
  })();

  return (
    <div className="space-y-6">
      {/* Header com botão voltar */}
      <div className="flex items-center justify-between">
        <div>
          <Link href="/proprietario" className="text-sm text-amber-600 hover:underline inline-flex items-center gap-1">
            <ArrowLeft className="w-3 h-3" /> Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-2 flex items-center gap-2">
            <Sun className="w-6 h-6 text-amber-500" />
            {usina.nome}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {usina.cidade}/{usina.estado} • {usina.distribuidora} • {usina.capacidadeKwh.toLocaleString('pt-BR')} kWh/mês
          </p>
        </div>
        <div className="flex flex-col gap-2 items-end">
          <Badge className={STATUS_OP_COR[usina.statusOperacional] ?? 'bg-gray-100'}>
            {usina.statusOperacional.replace(/_/g, ' ')}
          </Badge>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => baixarRelatorioPdf(mesAnterior)}>
              <Download className="w-3 h-3 mr-1" /> PDF {mesAnterior}
            </Button>
          </div>
        </div>
      </div>

      {/* Help inline */}
      <div className="bg-blue-50 border border-blue-200 rounded-md p-3 flex gap-2">
        <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <strong>Drill-down completo:</strong> gráfico de 12 meses (gerado vs projetado), repasses históricos
          calculados conforme contrato ({usina.formaPagamentoDono ?? 'não definido'}), cooperados anonimizados
          (LGPD), contratos vinculados e alertas de monitoramento.
        </div>
      </div>

      {/* Gráfico 12 meses geração */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-amber-500" />
            Geração últimos 12 meses
          </CardTitle>
        </CardHeader>
        <CardContent>
          {geracaoHistorica12m.length === 0 ? (
            <p className="text-gray-500 text-sm py-8 text-center">Sem geração registrada nos últimos 12 meses.</p>
          ) : (
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer>
                <BarChart data={geracaoHistorica12m}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                  <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(v: number) => v.toLocaleString('pt-BR') + ' kWh'}
                    labelStyle={{ color: '#92400e', fontWeight: 600 }}
                  />
                  <Legend />
                  <ReferenceLine
                    y={usina.capacidadeKwh}
                    stroke="#dc2626"
                    strokeDasharray="3 3"
                    label={{ value: 'Capacidade', fontSize: 10, fill: '#dc2626', position: 'insideTopRight' }}
                  />
                  <Bar dataKey="kwhGerado" fill="#f59e0b" name="Gerado" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Repasses históricos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Repasses Históricos</CardTitle>
        </CardHeader>
        <CardContent>
          {repassesHistoricos.length === 0 ? (
            <p className="text-gray-500 text-sm py-4">Sem repasses registrados.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mês</TableHead>
                  <TableHead className="text-right">kWh Gerado</TableHead>
                  <TableHead className="text-right">Repasse Previsto</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>PDF</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...repassesHistoricos].reverse().map((r) => (
                  <TableRow key={r.competencia}>
                    <TableCell className="font-medium">{r.mes}</TableCell>
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
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => baixarRelatorioPdf(r.competencia)}>
                        <Download className="w-3 h-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Cooperados anonimizados */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-500" />
            Cooperados Alocados (anonimizado)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <p className="text-xs text-gray-500">Total cooperados</p>
              <p className="text-xl font-bold">{cooperadosAnonimizados.total}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">kWh contratado total</p>
              <p className="text-xl font-bold">{fmtKwh(cooperadosAnonimizados.kwhContratadoTotal)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Ocupação</p>
              <p className="text-xl font-bold">{cooperadosAnonimizados.ocupacaoPercentual}%</p>
            </div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded p-2 mb-3 text-xs text-blue-800">
            <strong>LGPD:</strong> nomes reais não são exibidos — apenas apelido sequencial.
          </div>
          {cooperadosAnonimizados.lista.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Apelido</TableHead>
                  <TableHead className="text-right">kWh Contratado</TableHead>
                  <TableHead className="text-right">% Usina</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cooperadosAnonimizados.lista.slice(0, 20).map((c) => (
                  <TableRow key={c.apelido}>
                    <TableCell className="font-medium">{c.apelido}</TableCell>
                    <TableCell className="text-right">{fmtKwh(c.kwhContratado)}</TableCell>
                    <TableCell className="text-right">{c.percentualUsina}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Matriz responsabilidade despesas */}
      {Object.keys(responsabilidadeDespesas || {}).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Matriz de Responsabilidade de Despesas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-gray-500 mb-2">Quem paga cada categoria conforme contrato bilateral.</p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Responsável</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(responsabilidadeDespesas).map(([cat, resp]) => (
                  <TableRow key={cat}>
                    <TableCell className="font-medium">{cat.replace(/_/g, ' ')}</TableCell>
                    <TableCell>
                      <Badge variant={resp === 'PROPRIETARIO' ? 'default' : 'outline'}>{resp}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Contratos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-4 h-4 text-purple-500" />
            Contratos de Uso ({contratos.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {contratos.length === 0 ? (
            <p className="text-gray-500 text-sm py-4">Nenhum contrato vinculado.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">kWh/mês</TableHead>
                  <TableHead className="text-right">% Usina</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contratos.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.numero}</TableCell>
                    <TableCell><Badge>{c.status}</Badge></TableCell>
                    <TableCell className="text-right">{fmtKwh(c.kwhContrato)}</TableCell>
                    <TableCell className="text-right">{c.percentualUsina}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Alertas */}
      {alertas.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-500" />
              Alertas Recentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {alertas.map((a) => (
                <li key={a.id} className="flex items-start gap-2 border-l-2 border-orange-400 pl-3">
                  <div className="flex-1">
                    <p className="font-medium">{a.tipo.replace(/_/g, ' ')}</p>
                    <p className="text-xs text-gray-600">{a.descricao}</p>
                  </div>
                  <Badge variant="outline">{a.estado}</Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
