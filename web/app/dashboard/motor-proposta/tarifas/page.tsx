'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { CheckCircle, Loader2, Plus, XCircle } from 'lucide-react';

interface Tarifa {
  id: string;
  concessionaria: string;
  dataVigencia: string;
  tusdAnterior: number;
  tusdNova: number;
  teAnterior: number;
  teNova: number;
  percentualAnunciado: number;
  percentualApurado: number;
  percentualAplicado: number;
  observacoes: string | null;
  createdAt: string;
}

const cls = 'w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500';
const lbl = 'block text-xs font-medium text-gray-600 mb-1';

function fmt5(v: number | undefined | null) {
  if (v == null) return '—';
  return Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 5, maximumFractionDigits: 5 });
}

const emptyForm = {
  concessionaria: '',
  dataVigencia: '',
  tusdAnterior: '',
  tusdNova: '',
  teAnterior: '',
  teNova: '',
  percentualAnunciado: '',
  percentualApurado: '',
  percentualAplicado: '',
  observacoes: '',
};

export default function TarifasPage() {
  const [tarifas, setTarifas] = useState<Tarifa[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [salvando, setSalvando] = useState(false);
  const [toast, setToast] = useState<{ tipo: 'sucesso' | 'erro'; msg: string } | null>(null);

  function showToast(tipo: 'sucesso' | 'erro', msg: string) {
    setToast({ tipo, msg });
    setTimeout(() => setToast(null), 3000);
  }

  useEffect(() => {
    api.get<Tarifa[]>('/motor-proposta/tarifa-concessionaria')
      .then(r => setTarifas(r.data))
      .finally(() => setLoading(false));
  }, []);

  function set(k: keyof typeof emptyForm, v: string) {
    setForm(p => ({ ...p, [k]: v }));
  }

  // Calcula percentualApurado automaticamente
  const tusdAnt = Number(form.tusdAnterior) || 0;
  const tusdNov = Number(form.tusdNova) || 0;
  const teAnt = Number(form.teAnterior) || 0;
  const teNov = Number(form.teNova) || 0;
  const tarifaAntiga = tusdAnt + teAnt;
  const tarifaNova = tusdNov + teNov;
  const apuradoAuto = tarifaAntiga > 0 ? ((tarifaNova - tarifaAntiga) / tarifaAntiga) * 100 : 0;

  async function salvar() {
    setSalvando(true);
    try {
      const payload = {
        concessionaria: form.concessionaria,
        dataVigencia: form.dataVigencia,
        tusdAnterior: Number(form.tusdAnterior),
        tusdNova: Number(form.tusdNova),
        teAnterior: Number(form.teAnterior),
        teNova: Number(form.teNova),
        percentualAnunciado: Number(form.percentualAnunciado),
        percentualApurado: apuradoAuto,
        percentualAplicado: Number(form.percentualAplicado),
        observacoes: form.observacoes || undefined,
      };
      const { data } = await api.post<Tarifa>('/motor-proposta/tarifa-concessionaria', payload);
      setTarifas(p => [data, ...p]);
      setSheetOpen(false);
      setForm(emptyForm);
      showToast('sucesso', 'Tarifa cadastrada com sucesso.');
    } catch {
      showToast('erro', 'Erro ao cadastrar tarifa.');
    } finally {
      setSalvando(false);
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

      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">Tarifas da Concessionária</h2>
        <Button size="sm" onClick={() => { setForm(emptyForm); setSheetOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />Nova tarifa
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-gray-400 text-sm">Carregando...</div>
          ) : tarifas.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">Nenhuma tarifa cadastrada ainda.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Concessionária</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Vigência</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500">TUSD ant.</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500">TUSD nova</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500">TE ant.</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500">TE nova</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500">% Anunc.</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500">% Apur.</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500">% Aplic.</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {tarifas.map(t => (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{t.concessionaria}</td>
                    <td className="px-4 py-3 text-gray-500">{new Date(t.dataVigencia).toLocaleDateString('pt-BR')}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs">{fmt5(t.tusdAnterior)}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-green-700">{fmt5(t.tusdNova)}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs">{fmt5(t.teAnterior)}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-green-700">{fmt5(t.teNova)}</td>
                    <td className="px-4 py-3 text-right">{fmt5(t.percentualAnunciado)}%</td>
                    <td className="px-4 py-3 text-right">{fmt5(t.percentualApurado)}%</td>
                    <td className="px-4 py-3 text-right font-medium">{fmt5(t.percentualAplicado)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader><SheetTitle>Nova Tarifa da Concessionária</SheetTitle></SheetHeader>
          <div className="mt-6 space-y-4">
            <div>
              <label className={lbl}>Concessionária</label>
              <input className={cls} value={form.concessionaria} onChange={e => set('concessionaria', e.target.value)} placeholder="Ex: CELPE, COELBA..." />
            </div>
            <div>
              <label className={lbl}>Data de vigência</label>
              <input type="date" className={cls} value={form.dataVigencia} onChange={e => set('dataVigencia', e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>TUSD anterior (R$/kWh)</label>
                <input type="number" step="0.00001" className={cls} value={form.tusdAnterior} onChange={e => set('tusdAnterior', e.target.value)} />
              </div>
              <div>
                <label className={lbl}>TUSD nova (R$/kWh)</label>
                <input type="number" step="0.00001" className={cls} value={form.tusdNova} onChange={e => set('tusdNova', e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>TE anterior (R$/kWh)</label>
                <input type="number" step="0.00001" className={cls} value={form.teAnterior} onChange={e => set('teAnterior', e.target.value)} />
              </div>
              <div>
                <label className={lbl}>TE nova (R$/kWh)</label>
                <input type="number" step="0.00001" className={cls} value={form.teNova} onChange={e => set('teNova', e.target.value)} />
              </div>
            </div>
            {(tusdAnt > 0 || teAnt > 0) && (tarifaNova > 0) && (
              <div className="bg-blue-50 border border-blue-200 rounded-md px-3 py-2 text-xs text-blue-800">
                % Apurado automático: <strong>{apuradoAuto.toLocaleString('pt-BR', { minimumFractionDigits: 5, maximumFractionDigits: 5 })}%</strong>
                {' '}(de R$ {fmt5(tarifaAntiga)} para R$ {fmt5(tarifaNova)})
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>% Anunciado pela conc.</label>
                <input type="number" step="0.00001" className={cls} value={form.percentualAnunciado} onChange={e => set('percentualAnunciado', e.target.value)} />
              </div>
              <div>
                <label className={lbl}>% Aplicado nos contratos</label>
                <input type="number" step="0.00001" className={cls} value={form.percentualAplicado} onChange={e => set('percentualAplicado', e.target.value)} />
              </div>
            </div>
            <div>
              <label className={lbl}>Observações (opcional)</label>
              <textarea className={cls} rows={3} value={form.observacoes} onChange={e => set('observacoes', e.target.value)} />
            </div>
          </div>
          <SheetFooter className="mt-6 flex gap-2">
            <Button
              onClick={salvar}
              disabled={salvando || !form.concessionaria || !form.dataVigencia}
              className="flex-1"
            >
              {salvando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Cadastrar
            </Button>
            <Button variant="outline" onClick={() => setSheetOpen(false)}>Cancelar</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
