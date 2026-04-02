'use client';

import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  CheckCircle, XCircle, FileText, Upload, Loader2, AlertTriangle, BarChart3, Filter,
} from 'lucide-react';
import RelatorioFaturaCooperado from '@/components/RelatorioFaturaCooperado';

interface FaturaItem {
  id: string;
  cooperadoId: string;
  cooperado: { id: string; nomeCompleto: string; email: string; telefone: string | null };
  uc: { id: string; numeroUC: string; distribuidora: string } | null;
  dadosExtraidos: any;
  analise: any;
  mesReferencia: string | null;
  statusRevisao: string;
  cobrancaGeradaId: string | null;
  status: string;
  createdAt: string;
}

interface Metricas {
  pendentes: number;
  autoAprovados: number;
  aprovados: number;
  semFatura: number;
  total: number;
}

const STATUS_COLORS: Record<string, string> = {
  AUTO_APROVADO: 'bg-green-100 text-green-800 border-green-200',
  APROVADO: 'bg-green-100 text-green-800 border-green-200',
  PENDENTE_REVISAO: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  REJEITADO: 'bg-red-100 text-red-800 border-red-200',
};

const STATUS_LABEL: Record<string, string> = {
  AUTO_APROVADO: 'Auto-aprovado',
  APROVADO: 'Aprovado',
  PENDENTE_REVISAO: 'Pendente Revisão',
  REJEITADO: 'Rejeitado',
};

export default function CentralFaturasPage() {
  const [faturas, setFaturas] = useState<FaturaItem[]>([]);
  const [metricas, setMetricas] = useState<Metricas>({ pendentes: 0, autoAprovados: 0, aprovados: 0, semFatura: 0, total: 0 });
  const [carregando, setCarregando] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState('');
  const [filtroMes, setFiltroMes] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [detalheFatura, setDetalheFatura] = useState<FaturaItem | null>(null);
  const [relatorioData, setRelatorioData] = useState<any>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const buscar = useCallback(async () => {
    setCarregando(true);
    try {
      const params = new URLSearchParams();
      if (filtroStatus) params.set('status', filtroStatus);
      if (filtroMes) params.set('mesReferencia', filtroMes);
      params.set('limit', '50');
      const { data } = await api.get(`/faturas/central?${params.toString()}`);
      setFaturas(data.faturas);
      setMetricas(data.metricas);
    } catch {
      // silently ignore
    } finally {
      setCarregando(false);
    }
  }, [filtroStatus, filtroMes]);

  useEffect(() => { buscar(); }, [buscar]);

  async function aprovar(faturaId: string) {
    setActionLoading(faturaId);
    try {
      await api.patch(`/faturas/${faturaId}/aprovar`);
      buscar();
    } catch {
      // silently ignore
    } finally {
      setActionLoading(null);
    }
  }

  async function rejeitar(faturaId: string) {
    setActionLoading(faturaId);
    try {
      await api.patch(`/faturas/${faturaId}/rejeitar`);
      buscar();
    } catch {
      // silently ignore
    } finally {
      setActionLoading(null);
    }
  }

  async function abrirDetalhe(fatura: FaturaItem) {
    setDetalheFatura(fatura);
    try {
      const { data } = await api.get(`/faturas/${fatura.id}/relatorio`);
      setRelatorioData(data);
    } catch {
      setRelatorioData(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <FileText className="h-5 w-5" />Central de Faturas
        </h1>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <FileText className="h-5 w-5 text-blue-700" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Total faturado</p>
                <p className="text-xl font-bold text-gray-800">{metricas.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-green-700" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Aprovados</p>
                <p className="text-xl font-bold text-green-700">{metricas.aprovados + metricas.autoAprovados}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-yellow-700" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Revisar</p>
                <p className="text-xl font-bold text-yellow-700">{metricas.pendentes}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <XCircle className="h-5 w-5 text-red-700" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Sem fatura</p>
                <p className="text-xl font-bold text-red-700">{metricas.semFatura}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3">
        <Filter className="h-4 w-4 text-gray-400" />
        <input
          type="month"
          value={filtroMes}
          onChange={(e) => setFiltroMes(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        <select
          value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <option value="">Todos status</option>
          <option value="PENDENTE_REVISAO">Pendente Revisão</option>
          <option value="AUTO_APROVADO">Auto-aprovado</option>
          <option value="APROVADO">Aprovado</option>
          <option value="REJEITADO">Rejeitado</option>
        </select>
      </div>

      {/* Tabela */}
      <Card>
        <CardContent className="p-0">
          {carregando ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : faturas.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <FileText className="h-8 w-8 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">Nenhuma fatura encontrada.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs text-gray-500 font-medium">Nome</th>
                    <th className="px-4 py-3 text-left text-xs text-gray-500 font-medium">UC</th>
                    <th className="px-4 py-3 text-left text-xs text-gray-500 font-medium">Mês</th>
                    <th className="px-4 py-3 text-right text-xs text-gray-500 font-medium">kWh Inj.</th>
                    <th className="px-4 py-3 text-right text-xs text-gray-500 font-medium">kWh Comp.</th>
                    <th className="px-4 py-3 text-right text-xs text-gray-500 font-medium">Saldo</th>
                    <th className="px-4 py-3 text-right text-xs text-gray-500 font-medium">Diverg.</th>
                    <th className="px-4 py-3 text-left text-xs text-gray-500 font-medium">Cobrança</th>
                    <th className="px-4 py-3 text-left text-xs text-gray-500 font-medium">Status</th>
                    <th className="px-4 py-3 text-center text-xs text-gray-500 font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {faturas.map((f) => {
                    const d = f.dadosExtraidos;
                    const a = f.analise as any;
                    return (
                      <tr
                        key={f.id}
                        className="border-t hover:bg-gray-50 cursor-pointer"
                        onClick={() => abrirDetalhe(f)}
                      >
                        <td className="px-4 py-2 font-medium">{f.cooperado.nomeCompleto}</td>
                        <td className="px-4 py-2 text-xs text-gray-600">{f.uc?.numeroUC ?? d?.numeroUC ?? '—'}</td>
                        <td className="px-4 py-2">{f.mesReferencia ?? '—'}</td>
                        <td className="px-4 py-2 text-right">{Number(a?.kwhInjetado ?? d?.creditosRecebidosKwh ?? 0).toFixed(0)}</td>
                        <td className="px-4 py-2 text-right">{Number(a?.kwhCompensado ?? d?.creditosRecebidosKwh ?? 0).toFixed(0)}</td>
                        <td className="px-4 py-2 text-right">{Number(a?.saldoAtual ?? d?.saldoTotalKwh ?? 0).toFixed(0)}</td>
                        <td className="px-4 py-2 text-right">
                          {a?.divergenciaPerc != null ? (
                            <span className={`text-xs font-medium ${
                              a.divergenciaPerc < 5 ? 'text-green-600' : a.divergenciaPerc < 15 ? 'text-yellow-600' : 'text-red-600'
                            }`}>
                              {a.divergenciaPerc.toFixed(1)}%
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-2">
                          {f.cobrancaGeradaId ? (
                            <Badge variant="outline" className="text-xs bg-green-50 text-green-700">Gerada</Badge>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-2">
                          <Badge variant="outline" className={`text-xs ${STATUS_COLORS[f.statusRevisao] ?? ''}`}>
                            {STATUS_LABEL[f.statusRevisao] ?? f.statusRevisao}
                          </Badge>
                        </td>
                        <td className="px-4 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                          {f.statusRevisao === 'PENDENTE_REVISAO' && (
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs text-green-700 border-green-300 hover:bg-green-50"
                                disabled={actionLoading === f.id}
                                onClick={() => aprovar(f.id)}
                              >
                                {actionLoading === f.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3 mr-1" />}
                                Aprovar
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs text-red-600 border-red-300 hover:bg-red-50"
                                disabled={actionLoading === f.id}
                                onClick={() => rejeitar(f.id)}
                              >
                                <XCircle className="h-3 w-3 mr-1" />
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de detalhe */}
      <Dialog open={!!detalheFatura} onOpenChange={(open) => { if (!open) { setDetalheFatura(null); setRelatorioData(null); } }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Detalhe da Fatura — {detalheFatura?.cooperado.nomeCompleto}
            </DialogTitle>
          </DialogHeader>

          {detalheFatura && (
            <div className="space-y-4">
              {/* Dados extraídos */}
              <Card>
                <CardHeader><CardTitle className="text-sm">Dados da Concessionária</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                    <div><span className="text-xs text-gray-500">UC</span><p className="font-medium">{detalheFatura.uc?.numeroUC ?? detalheFatura.dadosExtraidos?.numeroUC ?? '—'}</p></div>
                    <div><span className="text-xs text-gray-500">Distribuidora</span><p className="font-medium">{detalheFatura.dadosExtraidos?.distribuidora ?? '—'}</p></div>
                    <div><span className="text-xs text-gray-500">Consumo kWh</span><p className="font-medium">{detalheFatura.dadosExtraidos?.consumoAtualKwh ?? '—'}</p></div>
                    <div><span className="text-xs text-gray-500">Total pago</span><p className="font-medium">R$ {Number(detalheFatura.dadosExtraidos?.totalAPagar ?? 0).toFixed(2)}</p></div>
                    <div><span className="text-xs text-gray-500">kWh Compensados</span><p className="font-medium">{Number(detalheFatura.dadosExtraidos?.creditosRecebidosKwh ?? 0)}</p></div>
                    <div><span className="text-xs text-gray-500">Saldo kWh</span><p className="font-medium">{Number(detalheFatura.dadosExtraidos?.saldoTotalKwh ?? 0)}</p></div>
                  </div>
                </CardContent>
              </Card>

              {/* Análise */}
              {detalheFatura.analise && (
                <Card>
                  <CardHeader><CardTitle className="text-sm">Análise vs Contrato</CardTitle></CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                      <div><span className="text-xs text-gray-500">kWh Esperado (contrato)</span><p className="font-medium">{(detalheFatura.analise as any).kwhEsperado}</p></div>
                      <div><span className="text-xs text-gray-500">kWh Compensado</span><p className="font-medium">{(detalheFatura.analise as any).kwhCompensado}</p></div>
                      <div>
                        <span className="text-xs text-gray-500">Divergência</span>
                        <p className={`font-medium ${
                          (detalheFatura.analise as any).divergenciaPerc < 5 ? 'text-green-600' :
                          (detalheFatura.analise as any).divergenciaPerc < 15 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {(detalheFatura.analise as any).divergenciaPerc?.toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Relatório completo */}
              {relatorioData && <RelatorioFaturaCooperado relatorio={relatorioData} />}

              {/* Ações */}
              {detalheFatura.statusRevisao === 'PENDENTE_REVISAO' && (
                <div className="flex gap-3 pt-2">
                  <Button
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                    onClick={async () => {
                      await aprovar(detalheFatura.id);
                      setDetalheFatura(null);
                      setRelatorioData(null);
                    }}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />Aprovar
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 text-red-600 border-red-300 hover:bg-red-50"
                    onClick={async () => {
                      await rejeitar(detalheFatura.id);
                      setDetalheFatura(null);
                      setRelatorioData(null);
                    }}
                  >
                    <XCircle className="h-4 w-4 mr-2" />Rejeitar
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
