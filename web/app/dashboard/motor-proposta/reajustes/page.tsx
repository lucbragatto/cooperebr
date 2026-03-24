'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { ArrowLeft, CheckCircle, Loader2, Play, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useTipoParceiro } from '@/hooks/useTipoParceiro';

interface Tarifa {
  id: string;
  concessionaria: string;
  dataVigencia: string;
  tusdNova: number;
  teNova: number;
  percentualAplicado: number;
}

interface HistoricoReajuste {
  id: string;
  dataAplicacao: string;
  indiceUtilizado: string;
  percentualIndice: number;
  percentualAnunciado: number;
  percentualApurado: number;
  percentualAplicado: number;
  diferencaConc: number;
  cooperadosAfetados: number;
  valorMedioAnterior: number;
  valorMedioNovo: number;
  impactoMensalTotal: number;
  createdAt: string;
  tarifa: Tarifa;
}

interface SimulacaoResult {
  cooperadosAfetados: number;
  valorMedioAnterior: number;
  valorMedioNovo: number;
  fatorReajuste: number;
  impactoMensalTotal: number;
  percentualAplicado: number;
  contratos: Array<{
    cooperadoId: string;
    nome: string;
    kwhContrato: number;
    valorAnterior: number;
    valorNovo: number;
    impacto: number;
  }>;
}

const cls = 'w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500';
const lbl = 'block text-xs font-medium text-gray-600 mb-1';

function fmt5(v: number | undefined | null) {
  if (v == null) return '—';
  return Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 5, maximumFractionDigits: 5 });
}

function fmtBRL(v: number | undefined | null) {
  if (v == null) return '—';
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function ReajustesPage() {
  const { tipoMembro, tipoMembroPlural } = useTipoParceiro();
  const [historico, setHistorico] = useState<HistoricoReajuste[]>([]);
  const [tarifas, setTarifas] = useState<Tarifa[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [simulacao, setSimulacao] = useState<SimulacaoResult | null>(null);
  const [simulando, setSimulando] = useState(false);
  const [aplicando, setAplicando] = useState(false);
  const [dialogConfirm, setDialogConfirm] = useState(false);
  const [form, setForm] = useState({ tarifaId: '', indiceUtilizado: 'IPCA', percentualIndice: '' });
  const [toast, setToast] = useState<{ tipo: 'sucesso' | 'erro'; msg: string } | null>(null);

  function showToast(tipo: 'sucesso' | 'erro', msg: string) {
    setToast({ tipo, msg });
    setTimeout(() => setToast(null), 3000);
  }

  useEffect(() => {
    Promise.all([
      api.get<HistoricoReajuste[]>('/motor-proposta/historico-reajustes'),
      api.get<Tarifa[]>('/motor-proposta/tarifa-concessionaria'),
    ]).then(([h, t]) => {
      setHistorico(h.data);
      setTarifas(t.data);
    }).finally(() => setLoading(false));
  }, []);

  async function simular() {
    if (!form.tarifaId) return;
    setSimulando(true);
    setSimulacao(null);
    try {
      const { data } = await api.post<SimulacaoResult>('/motor-proposta/simular-reajuste', {
        tarifaId: form.tarifaId,
        indiceUtilizado: form.indiceUtilizado,
        percentualIndice: Number(form.percentualIndice),
      });
      setSimulacao(data);
    } catch {
      showToast('erro', 'Erro ao simular reajuste.');
    } finally {
      setSimulando(false);
    }
  }

  async function aplicar() {
    setAplicando(true);
    try {
      const { data } = await api.post<HistoricoReajuste>('/motor-proposta/aplicar-reajuste', {
        tarifaId: form.tarifaId,
        indiceUtilizado: form.indiceUtilizado,
        percentualIndice: Number(form.percentualIndice),
      });
      setHistorico(p => [data, ...p]);
      setDialogConfirm(false);
      setSheetOpen(false);
      setSimulacao(null);
      setForm({ tarifaId: '', indiceUtilizado: 'IPCA', percentualIndice: '' });
      showToast('sucesso', 'Reajuste aplicado com sucesso.');
    } catch {
      showToast('erro', 'Erro ao aplicar reajuste.');
    } finally {
      setAplicando(false);
    }
  }

  return (
    <div className="space-y-6">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg border text-sm font-medium shadow-lg ${toast.tipo === 'sucesso' ? 'bg-green-50 text-green-800 border-green-200' : 'bg-red-50 text-red-800 border-red-200'}`}>
          {toast.tipo === 'sucesso' ? <CheckCircle className="inline h-4 w-4 mr-2" /> : <XCircle className="inline h-4 w-4 mr-2" />}
          {toast.msg}
        </div>
      )}

      <Link href="/dashboard/motor-proposta" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 transition-colors">
        <ArrowLeft className="h-4 w-4" />Voltar
      </Link>

      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">Histórico de Reajustes</h2>
        <Button size="sm" onClick={() => { setForm({ tarifaId: tarifas[0]?.id ?? '', indiceUtilizado: 'IPCA', percentualIndice: '' }); setSimulacao(null); setSheetOpen(true); }}>
          <Play className="h-4 w-4 mr-2" />Simular reajuste
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-gray-400 text-sm">Carregando...</div>
          ) : historico.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">Nenhum reajuste aplicado ainda.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Data</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Concessionária</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Índice</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500">% Índice</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500">% Aplicado</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500">{tipoMembroPlural}</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500">Impacto mensal</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {historico.map(h => (
                  <tr key={h.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">{new Date(h.dataAplicacao).toLocaleDateString('pt-BR')}</td>
                    <td className="px-4 py-3 font-medium">{h.tarifa?.concessionaria ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{h.indiceUtilizado}</td>
                    <td className="px-4 py-3 text-right">{fmt5(h.percentualIndice)}%</td>
                    <td className="px-4 py-3 text-right font-medium text-orange-700">{fmt5(h.percentualAplicado)}%</td>
                    <td className="px-4 py-3 text-right">{h.cooperadosAfetados}</td>
                    <td className="px-4 py-3 text-right text-red-700">{fmtBRL(h.impactoMensalTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Sheet open={sheetOpen} onOpenChange={v => { setSheetOpen(v); if (!v) setSimulacao(null); }}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader><SheetTitle>Simular Reajuste</SheetTitle></SheetHeader>
          <div className="mt-6 space-y-4">
            <div>
              <label className={lbl}>Tarifa base</label>
              <select className={cls} value={form.tarifaId} onChange={e => setForm(p => ({ ...p, tarifaId: e.target.value }))}>
                <option value="">Selecione...</option>
                {tarifas.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.concessionaria} — {new Date(t.dataVigencia).toLocaleDateString('pt-BR')} (TUSD+TE: {fmt5(Number(t.tusdNova) + Number(t.teNova))})
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Índice utilizado</label>
                <select className={cls} value={form.indiceUtilizado} onChange={e => setForm(p => ({ ...p, indiceUtilizado: e.target.value }))}>
                  <option value="IPCA">IPCA</option>
                  <option value="IGPM">IGP-M</option>
                  <option value="SELIC">SELIC</option>
                  <option value="PERSONALIZADO">Personalizado</option>
                </select>
              </div>
              <div>
                <label className={lbl}>% do índice</label>
                <input type="number" step="0.00001" className={cls} value={form.percentualIndice} onChange={e => setForm(p => ({ ...p, percentualIndice: e.target.value }))} placeholder="Ex: 4.62" />
              </div>
            </div>

            <Button onClick={simular} disabled={simulando || !form.tarifaId} className="w-full" variant="outline">
              {simulando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
              Simular
            </Button>

            {simulacao && (
              <div className="space-y-3 border-t pt-4">
                <CardHeader className="px-0 pb-2"><CardTitle className="text-sm font-semibold text-gray-700">Resultado da simulação</CardTitle></CardHeader>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-gray-50 rounded p-2">
                    <p className="text-xs text-gray-500">{tipoMembroPlural} afetados</p>
                    <p className="font-bold text-lg">{simulacao.cooperadosAfetados}</p>
                  </div>
                  <div className="bg-gray-50 rounded p-2">
                    <p className="text-xs text-gray-500">Impacto mensal total</p>
                    <p className="font-bold text-lg text-red-700">{fmtBRL(simulacao.impactoMensalTotal)}</p>
                  </div>
                  <div className="bg-gray-50 rounded p-2">
                    <p className="text-xs text-gray-500">Tarifa anterior (R$/kWh)</p>
                    <p className="font-mono text-sm">{fmt5(simulacao.valorMedioAnterior)}</p>
                  </div>
                  <div className="bg-gray-50 rounded p-2">
                    <p className="text-xs text-gray-500">Tarifa nova (R$/kWh)</p>
                    <p className="font-mono text-sm text-orange-700">{fmt5(simulacao.valorMedioNovo)}</p>
                  </div>
                </div>

                {simulacao.contratos.length > 0 && (
                  <div className="max-h-60 overflow-y-auto border rounded">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 border-b sticky top-0">
                        <tr>
                          <th className="text-left px-3 py-2 font-medium text-gray-500">{tipoMembro}</th>
                          <th className="text-right px-3 py-2 font-medium text-gray-500">kWh</th>
                          <th className="text-right px-3 py-2 font-medium text-gray-500">Ant.</th>
                          <th className="text-right px-3 py-2 font-medium text-gray-500">Novo</th>
                          <th className="text-right px-3 py-2 font-medium text-gray-500">Impacto</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {simulacao.contratos.map(c => (
                          <tr key={c.cooperadoId} className="hover:bg-gray-50">
                            <td className="px-3 py-2">{c.nome}</td>
                            <td className="px-3 py-2 text-right">{c.kwhContrato.toLocaleString('pt-BR')}</td>
                            <td className="px-3 py-2 text-right">{fmtBRL(c.valorAnterior)}</td>
                            <td className="px-3 py-2 text-right">{fmtBRL(c.valorNovo)}</td>
                            <td className="px-3 py-2 text-right text-red-600">{fmtBRL(c.impacto)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
          <SheetFooter className="mt-6 flex gap-2">
            {simulacao && (
              <Button onClick={() => setDialogConfirm(true)} className="flex-1 bg-orange-600 hover:bg-orange-700">
                Aplicar reajuste
              </Button>
            )}
            <Button variant="outline" onClick={() => setSheetOpen(false)}>Fechar</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Dialog open={dialogConfirm} onOpenChange={setDialogConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar aplicação do reajuste?</DialogTitle>
            <DialogDescription>
              Esta ação registrará o reajuste no histórico e afetará {simulacao?.cooperadosAfetados ?? 0} {tipoMembroPlural.toLowerCase()},
              com impacto mensal estimado de {fmtBRL(simulacao?.impactoMensalTotal)}.
              Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogConfirm(false)}>Cancelar</Button>
            <Button onClick={aplicar} disabled={aplicando} className="bg-orange-600 hover:bg-orange-700">
              {aplicando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Confirmar reajuste
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
