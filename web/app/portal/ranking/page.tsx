'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import BadgeNivelClube from '@/components/BadgeNivelClube';
import { Trophy, Medal, Star } from 'lucide-react';

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
  top10: RankingItem[];
  cooperadoLogado: {
    posicao: number | null;
    nivelAtual?: string;
    kwhAcumulado?: number;
    indicadosAtivos?: number;
    progressoRelativo?: number;
  } | null;
}

const POSICAO_ICONS = [
  <Trophy key="1" className="h-5 w-5 text-yellow-500" />,
  <Medal key="2" className="h-5 w-5 text-gray-400" />,
  <Medal key="3" className="h-5 w-5 text-amber-600" />,
];

export default function RankingPage() {
  const [ranking, setRanking] = useState<RankingData | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    api.get<RankingData>('/clube-vantagens/ranking')
      .then(r => setRanking(r.data))
      .finally(() => setCarregando(false));
  }, []);

  if (carregando) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-16 bg-gray-100 animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  if (!ranking || ranking.top10.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Trophy className="h-12 w-12 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">O ranking ainda nao possui participantes.</p>
          <p className="text-sm text-gray-400">Indique amigos para aparecer aqui!</p>
        </CardContent>
      </Card>
    );
  }

  const logado = ranking.cooperadoLogado;
  const logadoNoTop = logado?.posicao && logado.posicao <= 10;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Trophy className="h-6 w-6 text-yellow-500" />
        <h2 className="text-2xl font-bold text-gray-800">Ranking de Indicadores</h2>
      </div>

      {/* Posicao do cooperado logado */}
      {logado && logado.posicao && !logadoNoTop && (
        <Card className="mb-6 border-blue-200 bg-blue-50/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm">
                  {logado.posicao}
                </div>
                <div>
                  <span className="font-medium text-gray-800">Sua posicao</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    {logado.nivelAtual && <BadgeNivelClube nivel={logado.nivelAtual} compact />}
                    <span className="text-sm text-gray-500">{logado.kwhAcumulado?.toFixed(0)} kWh</span>
                  </div>
                </div>
              </div>
              <div className="w-32 h-2 bg-blue-200 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full" style={{ width: `${logado.progressoRelativo ?? 0}%` }} />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top 10 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium text-gray-600 flex items-center gap-2">
            <Star className="h-4 w-4 text-yellow-500" /> Top 10 Indicadores
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {ranking.top10.map(item => {
              const isLogado = logado && logado.posicao === item.posicao;
              return (
                <div
                  key={item.cooperadoId}
                  className={`flex items-center gap-4 px-4 py-3 ${isLogado ? 'bg-blue-50' : ''}`}
                >
                  {/* Posicao */}
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center font-bold text-sm flex-shrink-0">
                    {item.posicao <= 3 ? POSICAO_ICONS[item.posicao - 1] : item.posicao}
                  </div>

                  {/* Nome + badge */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-800 truncate">{item.nome}</span>
                      {isLogado && <span className="text-xs text-blue-600 font-medium">(voce)</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <BadgeNivelClube nivel={item.nivelAtual} compact />
                      <span className="text-xs text-gray-500">{item.indicadosAtivos} indicados ativos</span>
                    </div>
                  </div>

                  {/* kWh + barra */}
                  <div className="text-right flex-shrink-0 w-40">
                    <div className="text-sm font-medium text-gray-800">{item.kwhAcumulado.toFixed(0)} kWh</div>
                    <div className="w-full h-1.5 bg-gray-200 rounded-full mt-1 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${item.posicao === 1 ? 'bg-yellow-400' : item.posicao <= 3 ? 'bg-blue-400' : 'bg-gray-400'}`}
                        style={{ width: `${item.progressoRelativo}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
