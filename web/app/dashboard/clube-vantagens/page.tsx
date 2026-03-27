'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Zap, DollarSign, TrendingUp, Trophy, ArrowRight } from 'lucide-react';
import BadgeNivelClube from '@/components/BadgeNivelClube';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import Link from 'next/link';

interface Analytics {
  totalMembros: number;
  indicadosAtivosTotal: number;
  receitaGerada: number;
  kwhIndicadoTotal: number;
  distribuicaoPorNivel: { nivel: string; count: number }[];
  top10: {
    posicao: number;
    cooperadoId: string;
    nome: string;
    nivelAtual: string;
    kwhAcumulado: number;
    indicadosAtivos: number;
  }[];
}

interface EvolucaoMes {
  mes: string;
  BRONZE: number;
  PRATA: number;
  OURO: number;
  DIAMANTE: number;
}

interface EtapaFunil {
  etapa: string;
  valor: number;
  percentual: number;
}

interface FunilData {
  funil: EtapaFunil[];
  taxaConversaoGeral: number;
}

const NIVEL_COLORS: Record<string, string> = {
  BRONZE: '#d97706',
  PRATA: '#6b7280',
  OURO: '#eab308',
  DIAMANTE: '#3b82f6',
};

function heatmapColor(pct: number): string {
  if (pct >= 75) return 'bg-green-500 text-white';
  if (pct >= 50) return 'bg-green-300 text-green-900';
  if (pct >= 25) return 'bg-yellow-300 text-yellow-900';
  if (pct >= 10) return 'bg-orange-300 text-orange-900';
  return 'bg-red-200 text-red-900';
}

export default function ClubeVantagensAnalyticsPage() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [evolucao, setEvolucao] = useState<EvolucaoMes[]>([]);
  const [funil, setFunil] = useState<FunilData | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => {
    Promise.all([
      api.get<Analytics>('/clube-vantagens/analytics'),
      api.get<EvolucaoMes[]>('/clube-vantagens/analytics/mensal?meses=6'),
      api.get<FunilData>('/clube-vantagens/analytics/funil'),
    ])
      .then(([a, e, f]) => {
        setAnalytics(a.data);
        setEvolucao(e.data);
        setFunil(f.data);
      })
      .catch(() => setErro('Erro ao carregar dados do Clube de Vantagens. Verifique sua conexão e tente novamente.'))
      .finally(() => setCarregando(false));
  }, []);

  if (carregando) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><CardContent className="p-6"><div className="h-12 bg-gray-200 animate-pulse rounded" /></CardContent></Card>
          ))}
        </div>
      </div>
    );
  }

  if (erro) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
        <p className="font-medium">Falha ao carregar</p>
        <p className="text-sm mt-1">{erro}</p>
      </div>
    );
  }

  const pieData = (analytics?.distribuicaoPorNivel ?? []).map(d => ({ name: d.nivel, value: d.count }));

  const evolucaoData = evolucao.map(e => ({
    mes: e.mes.slice(5), // MM
    ...e,
  }));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Trophy className="h-6 w-6 text-yellow-500" />
          <h2 className="text-2xl font-bold text-gray-800">Clube de Vantagens</h2>
        </div>
        <Link href="/dashboard/clube-vantagens/config" className="text-sm text-blue-600 hover:underline">
          Configurar
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-gray-500 text-sm mb-2"><Users className="h-4 w-4" /> Membros no Clube</div>
            <span className="text-3xl font-bold text-gray-900">{analytics?.totalMembros ?? 0}</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-gray-500 text-sm mb-2"><TrendingUp className="h-4 w-4" /> Indicados Ativos</div>
            <span className="text-3xl font-bold text-gray-900">{analytics?.indicadosAtivosTotal ?? 0}</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-gray-500 text-sm mb-2"><DollarSign className="h-4 w-4" /> Receita Gerada</div>
            <span className="text-3xl font-bold text-gray-900">R$ {(analytics?.receitaGerada ?? 0).toFixed(2)}</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-gray-500 text-sm mb-2"><Zap className="h-4 w-4" /> kWh Indicado Total</div>
            <span className="text-3xl font-bold text-gray-900">{(analytics?.kwhIndicadoTotal ?? 0).toFixed(0)}</span>
          </CardContent>
        </Card>
      </div>

      {/* Linha 2: Distribuição + Evolução mensal */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Distribuição por nível */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Distribuição por Nível</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length === 0 ? (
              <div className="text-center text-gray-400 py-8">Sem dados</div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, value }) => `${name} (${value})`}
                  >
                    {pieData.map((entry) => (
                      <Cell key={entry.name} fill={NIVEL_COLORS[entry.name] ?? '#94a3b8'} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Evolução mensal */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Promoções por Mês</CardTitle>
          </CardHeader>
          <CardContent>
            {evolucaoData.length === 0 ? (
              <div className="text-center text-gray-400 py-8">Sem dados</div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={evolucaoData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="BRONZE" fill={NIVEL_COLORS.BRONZE} stackId="a" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="PRATA" fill={NIVEL_COLORS.PRATA} stackId="a" />
                  <Bar dataKey="OURO" fill={NIVEL_COLORS.OURO} stackId="a" />
                  <Bar dataKey="DIAMANTE" fill={NIVEL_COLORS.DIAMANTE} stackId="a" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Linha 3: Top 10 + Funil */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 10 indicadores */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-yellow-500" /> Top 10 Indicadores
              </span>
              <Link href="/dashboard/clube-vantagens/ranking" className="text-xs text-blue-600 hover:underline">
                Ver ranking completo →
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {(analytics?.top10 ?? []).length === 0 ? (
                <div className="text-center text-gray-400 py-8">Sem indicadores</div>
              ) : (
                (analytics?.top10 ?? []).map(item => (
                  <div key={item.cooperadoId} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="w-6 text-center text-sm font-bold text-gray-400">{item.posicao}</span>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-gray-800 truncate block">{item.nome}</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <BadgeNivelClube nivel={item.nivelAtual} compact />
                        <span className="text-xs text-gray-500">{item.indicadosAtivos} indicados</span>
                      </div>
                    </div>
                    <span className="text-sm font-medium text-gray-700">{item.kwhAcumulado.toFixed(0)} kWh</span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Mapa de calor: Funil de conversão */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> Funil de Conversão
              {funil && (
                <Badge variant="outline" className="ml-auto text-xs">
                  Conversão geral: {funil.taxaConversaoGeral}%
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!funil || funil.funil.length === 0 ? (
              <div className="text-center text-gray-400 py-8">Sem dados de funil</div>
            ) : (
              <div className="space-y-2">
                {funil.funil.map((etapa, i) => (
                  <div key={i} className="flex items-center gap-3">
                    {i > 0 && (
                      <div className="flex items-center justify-center w-5">
                        <ArrowRight className="h-3 w-3 text-gray-400" />
                      </div>
                    )}
                    {i === 0 && <div className="w-5" />}
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-gray-700">{etapa.etapa}</span>
                        <span className="text-xs font-bold text-gray-900">{etapa.valor.toLocaleString()}</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-6 overflow-hidden">
                        <div
                          className={`h-6 rounded-full flex items-center justify-center text-xs font-semibold ${heatmapColor(etapa.percentual)}`}
                          style={{ width: `${Math.max(etapa.percentual, 5)}%`, transition: 'width 0.5s ease' }}
                        >
                          {etapa.percentual}%
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
