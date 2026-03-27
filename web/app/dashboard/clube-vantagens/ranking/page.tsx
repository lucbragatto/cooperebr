'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Zap, Users } from 'lucide-react';
import BadgeNivelClube from '@/components/BadgeNivelClube';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

type Periodo = 'mes' | 'ano' | 'total';

interface RankingItem {
  posicao: number;
  cooperadoId: string;
  nome: string;
  nivelAtual: string;
  kwhAcumulado: number;
  indicadosAtivos: number;
  beneficioPercentual: number;
  progressoRelativo: number;
}

interface RankingData {
  periodo?: string;
  top10: RankingItem[];
  cooperadoLogado?: {
    posicao: number | null;
    nivelAtual?: string;
    kwhAcumulado?: number;
    indicadosAtivos?: number;
  } | null;
}

const POSICAO_ICONS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };
const NIVEL_COLORS: Record<string, string> = {
  BRONZE: '#d97706', PRATA: '#6b7280', OURO: '#eab308', DIAMANTE: '#3b82f6',
};

export default function RankingPage() {
  const [periodo, setPeriodo] = useState<Periodo>('total');
  const [data, setData] = useState<RankingData | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    setCarregando(true);
    api.get<RankingData>(`/clube-vantagens/ranking?periodo=${periodo}`)
      .then(r => setData(r.data))
      .finally(() => setCarregando(false));
  }, [periodo]);

  const chartData = (data?.top10 ?? []).map(item => ({
    name: item.nome.split(' ')[0], // primeiro nome apenas
    kWh: item.kwhAcumulado,
    nivel: item.nivelAtual,
  }));

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Trophy className="h-6 w-6 text-yellow-500" />
        <h2 className="text-2xl font-bold text-gray-800">Ranking de Indicadores</h2>
      </div>

      {/* Seletor de período */}
      <div className="flex gap-2 mb-6">
        {(['mes', 'ano', 'total'] as Periodo[]).map(p => (
          <button
            key={p}
            onClick={() => setPeriodo(p)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              periodo === p
                ? 'bg-blue-600 text-white shadow'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {p === 'mes' ? '📅 Este mês' : p === 'ano' ? '📆 Este ano' : '🏆 Acumulado'}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico de barras */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-4 w-4 text-yellow-500" /> kWh por Indicador
            </CardTitle>
          </CardHeader>
          <CardContent>
            {carregando ? (
              <div className="h-64 bg-gray-100 animate-pulse rounded" />
            ) : chartData.length === 0 ? (
              <div className="text-center text-gray-400 py-12">Nenhum dado no período</div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData} layout="vertical" margin={{ left: 40, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={60} />
                  <Tooltip formatter={(v: any) => [`${Number(v).toFixed(0)} kWh`, 'kWh']} />
                  <Bar dataKey="kWh" radius={[0, 4, 4, 0]}>
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={NIVEL_COLORS[entry.nivel] ?? '#94a3b8'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Tabela ranking */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Trophy className="h-4 w-4 text-yellow-500" /> Top 10
              <Badge variant="outline" className="ml-auto text-xs capitalize">{periodo === 'mes' ? 'Mês' : periodo === 'ano' ? 'Ano' : 'Total'}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {carregando ? (
              <div className="p-4 space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-10 bg-gray-100 animate-pulse rounded" />
                ))}
              </div>
            ) : (data?.top10 ?? []).length === 0 ? (
              <div className="text-center text-gray-400 py-8">Nenhum indicador neste período</div>
            ) : (
              <div className="divide-y">
                {(data?.top10 ?? []).map(item => (
                  <div key={item.cooperadoId} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
                    <span className="w-8 text-center text-lg">
                      {POSICAO_ICONS[item.posicao] ?? <span className="text-sm font-bold text-gray-400">{item.posicao}</span>}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-gray-800 truncate">{item.nome}</span>
                        <BadgeNivelClube nivel={item.nivelAtual} compact />
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" /> {item.indicadosAtivos} indicados
                        </span>
                        <span>{item.beneficioPercentual}% benefício</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-gray-800">{item.kwhAcumulado.toFixed(0)} kWh</div>
                      {/* Barra de progresso relativo */}
                      <div className="mt-1 w-20 bg-gray-100 rounded-full h-1.5">
                        <div
                          className="h-1.5 rounded-full bg-blue-500"
                          style={{ width: `${item.progressoRelativo}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Posição do cooperado logado */}
      {data?.cooperadoLogado && data.cooperadoLogado.posicao && (
        <Card className="mt-6 border-blue-200 bg-blue-50">
          <CardContent className="p-4 flex items-center gap-4">
            <span className="text-3xl font-black text-blue-700">#{data.cooperadoLogado.posicao}</span>
            <div>
              <p className="text-sm font-semibold text-blue-800">Sua posição no ranking</p>
              <div className="flex items-center gap-3 text-xs text-blue-600 mt-0.5">
                {data.cooperadoLogado.nivelAtual && <BadgeNivelClube nivel={data.cooperadoLogado.nivelAtual} compact />}
                <span>{data.cooperadoLogado.kwhAcumulado?.toFixed(0) ?? 0} kWh acumulado</span>
                <span>{data.cooperadoLogado.indicadosAtivos ?? 0} indicados ativos</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
