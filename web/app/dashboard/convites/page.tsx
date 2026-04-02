'use client';

import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  UserPlus, Clock, CheckCircle, XCircle, Send, Settings, Loader2, ChevronLeft, ChevronRight,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ConviteRow {
  id: string;
  nomeConvidado: string;
  telefoneConvidado: string;
  dataConvite: string;
  status: string;
  tentativasLembrete: number;
  ultimoLembrete: string | null;
  indicadoPor: string;
}

interface Stats {
  total: number;
  pendentes: number;
  lembretes: number;
  cadastrados: number;
  convertidos: number;
  expirados: number;
  cancelados: number;
  taxaConversao: number;
}

interface ConfigLembretes {
  cooldownDias: number;
  maxTentativas: number;
  habilitado: boolean;
}

interface DashboardResponse {
  convites: ConviteRow[];
  total: number;
  page: number;
  totalPages: number;
}

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  PENDENTE: { label: 'Pendente', className: 'bg-yellow-100 text-yellow-800' },
  LEMBRETE_ENVIADO: { label: 'Lembrete enviado', className: 'bg-blue-100 text-blue-800' },
  CADASTRADO: { label: 'Cadastrado', className: 'bg-green-100 text-green-800' },
  CONVERTIDO: { label: 'Convertido', className: 'bg-emerald-100 text-emerald-800' },
  EXPIRADO: { label: 'Expirado', className: 'bg-gray-100 text-gray-800' },
  CANCELADO: { label: 'Cancelado', className: 'bg-red-100 text-red-800' },
};

const PERIODOS = [
  { label: 'Todos', value: '' },
  { label: '7 dias', value: '7' },
  { label: '30 dias', value: '30' },
  { label: '90 dias', value: '90' },
];

export default function ConvitesDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [config, setConfig] = useState<ConfigLembretes>({ cooldownDias: 3, maxTentativas: 3, habilitado: true });
  const [filtroStatus, setFiltroStatus] = useState('');
  const [filtroPeriodo, setFiltroPeriodo] = useState('');
  const [page, setPage] = useState(1);
  const [carregando, setCarregando] = useState(true);
  const [salvandoConfig, setSalvandoConfig] = useState(false);
  const [reenviando, setReenviando] = useState<string | null>(null);
  const [mostrarConfig, setMostrarConfig] = useState(false);

  const carregarStats = useCallback(async () => {
    try {
      const { data } = await api.get<Stats>('/convite-indicacao/stats');
      setStats(data);
    } catch { /* ignore */ }
  }, []);

  const carregarConvites = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filtroStatus) params.set('status', filtroStatus);
      if (filtroPeriodo) params.set('periodo', filtroPeriodo);
      params.set('page', String(page));
      const { data } = await api.get<DashboardResponse>(`/convite-indicacao/dashboard?${params}`);
      setData(data);
    } catch { /* ignore */ }
  }, [filtroStatus, filtroPeriodo, page]);

  const carregarConfig = useCallback(async () => {
    try {
      const { data } = await api.get<ConfigLembretes>('/convite-indicacao/config-lembretes');
      setConfig(data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    Promise.all([carregarStats(), carregarConvites(), carregarConfig()])
      .finally(() => setCarregando(false));
  }, [carregarStats, carregarConvites, carregarConfig]);

  useEffect(() => { carregarConvites(); }, [carregarConvites]);

  async function salvarConfig() {
    setSalvandoConfig(true);
    try {
      const { data } = await api.put<ConfigLembretes>('/convite-indicacao/config-lembretes', config);
      setConfig(data);
    } catch { /* ignore */ }
    setSalvandoConfig(false);
  }

  async function reenviarLembrete(conviteId: string) {
    setReenviando(conviteId);
    try {
      await api.post(`/convite-indicacao/${conviteId}/reenviar`);
      await Promise.all([carregarConvites(), carregarStats()]);
    } catch { /* ignore */ }
    setReenviando(null);
  }

  if (carregando) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-green-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Convites de Indicacao</h1>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setMostrarConfig(!mostrarConfig)}
          className="gap-2"
        >
          <Settings className="h-4 w-4" />
          Config. Lembretes
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={Send} label="Total enviados" value={stats.total} color="blue" />
          <StatCard icon={Clock} label="Pendentes" value={stats.pendentes + stats.lembretes} color="yellow" />
          <StatCard icon={CheckCircle} label="Convertidos" value={stats.cadastrados + stats.convertidos} color="green" />
          <StatCard icon={XCircle} label="Expirados" value={stats.expirados} color="gray" />
        </div>
      )}

      {/* Config Lembretes */}
      {mostrarConfig && (
        <Card>
          <CardContent className="pt-5 space-y-4">
            <h3 className="font-semibold text-gray-800">Configuracoes de Lembretes</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm text-gray-600 block mb-1">Cooldown entre lembretes (dias)</label>
                <Input
                  type="number"
                  min={1}
                  value={config.cooldownDias}
                  onChange={(e) => setConfig({ ...config, cooldownDias: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="text-sm text-gray-600 block mb-1">Max tentativas</label>
                <Input
                  type="number"
                  min={1}
                  value={config.maxTentativas}
                  onChange={(e) => setConfig({ ...config, maxTentativas: Number(e.target.value) })}
                />
              </div>
              <div className="flex items-end gap-3">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={config.habilitado}
                    onCheckedChange={(v) => setConfig({ ...config, habilitado: v })}
                  />
                  <span className="text-sm text-gray-700">
                    {config.habilitado ? 'Habilitado' : 'Desabilitado'}
                  </span>
                </div>
              </div>
            </div>
            <Button
              size="sm"
              onClick={salvarConfig}
              disabled={salvandoConfig}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {salvandoConfig && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Salvar
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <select
          className="border rounded-md px-3 py-1.5 text-sm"
          value={filtroStatus}
          onChange={(e) => { setFiltroStatus(e.target.value); setPage(1); }}
        >
          <option value="">Todos os status</option>
          {Object.entries(STATUS_BADGES).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <select
          className="border rounded-md px-3 py-1.5 text-sm"
          value={filtroPeriodo}
          onChange={(e) => { setFiltroPeriodo(e.target.value); setPage(1); }}
        >
          {PERIODOS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
      </div>

      {/* Tabela */}
      <Card>
        <CardContent className="pt-0 px-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Telefone</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Indicado por</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Data envio</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Tentativas</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Ultimo lembrete</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {data?.convites.map((c) => {
                  const badge = STATUS_BADGES[c.status] ?? { label: c.status, className: 'bg-gray-100 text-gray-800' };
                  return (
                    <tr key={c.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono">{c.telefoneConvidado}</td>
                      <td className="px-4 py-3">{c.indicadoPor}</td>
                      <td className="px-4 py-3">{new Date(c.dataConvite).toLocaleDateString('pt-BR')}</td>
                      <td className="px-4 py-3">
                        <Badge className={badge.className}>{badge.label}</Badge>
                      </td>
                      <td className="px-4 py-3 text-center">{c.tentativasLembrete}</td>
                      <td className="px-4 py-3">
                        {c.ultimoLembrete
                          ? new Date(c.ultimoLembrete).toLocaleDateString('pt-BR')
                          : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {(c.status === 'PENDENTE' || c.status === 'LEMBRETE_ENVIADO') && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={reenviando === c.id}
                            onClick={() => reenviarLembrete(c.id)}
                            className="gap-1"
                          >
                            {reenviando === c.id
                              ? <Loader2 className="h-3 w-3 animate-spin" />
                              : <Send className="h-3 w-3" />}
                            Reenviar
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {(!data || data.convites.length === 0) && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                      Nenhum convite encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Paginacao */}
          {data && data.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <span className="text-sm text-gray-600">
                Pagina {data.page} de {data.totalPages} ({data.total} registros)
              </span>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page >= (data?.totalPages ?? 1)}
                  onClick={() => setPage(page + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof Send;
  label: string;
  value: number;
  color: string;
}) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-700',
    yellow: 'bg-yellow-50 text-yellow-700',
    green: 'bg-green-50 text-green-700',
    gray: 'bg-gray-50 text-gray-700',
  };

  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorMap[color] ?? colorMap.gray}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-800">{value}</p>
            <p className="text-xs text-gray-500">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
