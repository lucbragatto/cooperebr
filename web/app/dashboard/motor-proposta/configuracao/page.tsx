'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, CheckCircle, Loader2, XCircle } from 'lucide-react';
import Link from 'next/link';

interface Config {
  fonteKwh: string;
  thresholdOutlier: number;
  acaoOutlier: string;
  baseDesconto: string;
  descontoPadrao: number;
  descontoMinimo: number;
  descontoMaximo: number;
  acaoResultadoAcima: string;
  acaoResultadoAbaixo: string;
  indicesCorrecao: string[];
  combinacaoIndices: string;
  limiteReajusteConces: boolean;
  diaAplicacaoAnual: number;
  mesAplicacaoAnual: number;
  aplicacaoCorrecao: string;
  aprovarManualmente: boolean;
}

const defaultConfig: Config = {
  fonteKwh: 'MES_RECENTE', thresholdOutlier: 1.5, acaoOutlier: 'OFERECER_OPCAO',
  baseDesconto: 'TARIFA_UNIT', descontoPadrao: 20, descontoMinimo: 15, descontoMaximo: 30,
  acaoResultadoAcima: 'AUMENTAR_DESCONTO', acaoResultadoAbaixo: 'USAR_FATURA',
  indicesCorrecao: ['IPCA'], combinacaoIndices: 'MAIOR', limiteReajusteConces: true,
  diaAplicacaoAnual: 1, mesAplicacaoAnual: 1, aplicacaoCorrecao: 'GERAL', aprovarManualmente: true,
};

const cls = 'w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500';
const lbl = 'block text-xs font-medium text-gray-600 mb-1';

export default function ConfiguracaoMotorPage() {
  const [form, setForm] = useState<Config>(defaultConfig);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [toast, setToast] = useState<{ tipo: 'sucesso' | 'erro'; msg: string } | null>(null);

  useEffect(() => {
    api.get<Config>('/motor-proposta/configuracao')
      .then(r => setForm({ ...defaultConfig, ...r.data }))
      .finally(() => setLoading(false));
  }, []);

  function set<K extends keyof Config>(k: K, v: Config[K]) {
    setForm(p => ({ ...p, [k]: v }));
  }

  function toggleIndice(idx: string) {
    setForm(p => ({
      ...p,
      indicesCorrecao: p.indicesCorrecao.includes(idx)
        ? p.indicesCorrecao.filter(i => i !== idx)
        : [...p.indicesCorrecao, idx],
    }));
  }

  async function salvar() {
    setSalvando(true);
    try {
      await api.put('/motor-proposta/configuracao', form);
      setToast({ tipo: 'sucesso', msg: 'Configuração salva com sucesso.' });
    } catch {
      setToast({ tipo: 'erro', msg: 'Erro ao salvar configuração.' });
    } finally {
      setSalvando(false);
      setTimeout(() => setToast(null), 3000);
    }
  }

  if (loading) return <div className="p-8 text-gray-400">Carregando configuração...</div>;

  return (
    <div className="max-w-3xl space-y-6">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg border text-sm font-medium shadow-lg ${toast.tipo === 'sucesso' ? 'bg-green-50 text-green-800 border-green-200' : 'bg-red-50 text-red-800 border-red-200'}`}>
          {toast.tipo === 'sucesso' ? <CheckCircle className="inline h-4 w-4 mr-2" /> : <XCircle className="inline h-4 w-4 mr-2" />}
          {toast.msg}
        </div>
      )}

      <Link href="/dashboard/motor-proposta" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 transition-colors">
        <ArrowLeft className="h-4 w-4" />Voltar
      </Link>

      <h2 className="text-2xl font-bold text-gray-800">Configuração do Motor</h2>

      {/* Bloco 1 */}
      <Card>
        <CardHeader><CardTitle className="text-sm font-semibold text-gray-700">Bloco 1 — Fonte do kWh</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Fonte do kWh</label>
              <select className={cls} value={form.fonteKwh} onChange={e => set('fonteKwh', e.target.value)}>
                <option value="MES_RECENTE">Mês mais recente</option>
                <option value="MEDIA_12M">Média 12 meses</option>
                <option value="MEDIA_PONDERADA">Média ponderada</option>
              </select>
            </div>
            <div>
              <label className={lbl}>Ação em caso de outlier</label>
              <select className={cls} value={form.acaoOutlier} onChange={e => set('acaoOutlier', e.target.value)}>
                <option value="OFERECER_OPCAO">Oferecer opção ao admin</option>
                <option value="MAIOR_RETORNO">Usar maior retorno</option>
                <option value="MES_RECENTE">Usar mês recente</option>
              </select>
            </div>
          </div>
          <div className="max-w-xs">
            <label className={lbl}>Threshold outlier (ex: 1,50000)</label>
            <input className={cls} type="number" step="0.00001" value={form.thresholdOutlier} onChange={e => set('thresholdOutlier', Number(e.target.value))} />
            <p className="text-xs text-gray-400 mt-1">Mês é outlier quando kWh recente &gt; média × threshold</p>
          </div>
        </CardContent>
      </Card>

      {/* Bloco 2 */}
      <Card>
        <CardHeader><CardTitle className="text-sm font-semibold text-gray-700">Bloco 2 — Desconto</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className={lbl}>Base de cálculo do desconto</label>
            <select className={cls} value={form.baseDesconto} onChange={e => set('baseDesconto', e.target.value)}>
              <option value="TARIFA_UNIT">Tarifa unitária (TUSD + TE)</option>
              <option value="VALOR_TOTAL">Valor total da fatura</option>
            </select>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={lbl}>Desconto padrão (%)</label>
              <input className={cls} type="number" step="0.00001" value={form.descontoPadrao} onChange={e => set('descontoPadrao', Number(e.target.value))} />
            </div>
            <div>
              <label className={lbl}>Desconto mínimo (%)</label>
              <input className={cls} type="number" step="0.00001" value={form.descontoMinimo} onChange={e => set('descontoMinimo', Number(e.target.value))} />
            </div>
            <div>
              <label className={lbl}>Desconto máximo (%)</label>
              <input className={cls} type="number" step="0.00001" value={form.descontoMaximo} onChange={e => set('descontoMaximo', Number(e.target.value))} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bloco 3 */}
      <Card>
        <CardHeader><CardTitle className="text-sm font-semibold text-gray-700">Bloco 3 — Comparação com a média da cooperativa</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Ação quando resultado acima da média</label>
              <select className={cls} value={form.acaoResultadoAcima} onChange={e => set('acaoResultadoAcima', e.target.value)}>
                <option value="AUMENTAR_DESCONTO">Aumentar desconto</option>
                <option value="MANTER_DESCONTO">Manter desconto padrão</option>
              </select>
            </div>
            <div>
              <label className={lbl}>Ação quando resultado abaixo da média</label>
              <select className={cls} value={form.acaoResultadoAbaixo} onChange={e => set('acaoResultadoAbaixo', e.target.value)}>
                <option value="USAR_FATURA">Usar fatura (manter resultado)</option>
                <option value="AJUSTAR_MEDIA">Ajustar para a média</option>
                <option value="ALERTAR_ADMIN">Alertar administrador</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bloco 4 */}
      <Card>
        <CardHeader><CardTitle className="text-sm font-semibold text-gray-700">Bloco 4 — Correção anual</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <div>
            <label className={lbl}>Índices de correção</label>
            <div className="flex gap-4 mt-1">
              {['IPCA', 'IGPM', 'SELIC', 'PERSONALIZADO'].map(idx => (
                <label key={idx} className="flex items-center gap-2 cursor-pointer text-sm">
                  <input type="checkbox" checked={form.indicesCorrecao.includes(idx)} onChange={() => toggleIndice(idx)} className="accent-green-600" />
                  {idx}
                </label>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Combinação dos índices</label>
              <select className={cls} value={form.combinacaoIndices} onChange={e => set('combinacaoIndices', e.target.value)}>
                <option value="MAIOR">Usar o maior</option>
                <option value="SOMAR">Somar todos</option>
                <option value="APENAS_UM">Usar apenas um</option>
              </select>
            </div>
            <div>
              <label className={lbl}>Aplicação da correção</label>
              <select className={cls} value={form.aplicacaoCorrecao} onChange={e => set('aplicacaoCorrecao', e.target.value)}>
                <option value="GERAL">Geral (todos os contratos)</option>
                <option value="INDIVIDUAL">Individual</option>
                <option value="GRUPO">Por grupo</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Data de aplicação anual</label>
              <div className="flex gap-2">
                <input className={cls} type="number" min={1} max={31} placeholder="Dia" value={form.diaAplicacaoAnual} onChange={e => set('diaAplicacaoAnual', Number(e.target.value))} />
                <input className={cls} type="number" min={1} max={12} placeholder="Mês" value={form.mesAplicacaoAnual} onChange={e => set('mesAplicacaoAnual', Number(e.target.value))} />
              </div>
            </div>
          </div>
          <div className="flex gap-8">
            <label className="flex items-center gap-3 cursor-pointer">
              <div onClick={() => set('limiteReajusteConces', !form.limiteReajusteConces)} className={`w-10 h-6 rounded-full transition-colors relative cursor-pointer ${form.limiteReajusteConces ? 'bg-green-600' : 'bg-gray-300'}`}>
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.limiteReajusteConces ? 'translate-x-5' : 'translate-x-1'}`} />
              </div>
              <span className="text-sm text-gray-700">Limitar ao reajuste da concessionária</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <div onClick={() => set('aprovarManualmente', !form.aprovarManualmente)} className={`w-10 h-6 rounded-full transition-colors relative cursor-pointer ${form.aprovarManualmente ? 'bg-green-600' : 'bg-gray-300'}`}>
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.aprovarManualmente ? 'translate-x-5' : 'translate-x-1'}`} />
              </div>
              <span className="text-sm text-gray-700">Aprovar reajustes manualmente</span>
            </label>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={salvar} disabled={salvando} size="lg">
          {salvando ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Salvando...</> : 'Salvar configuração'}
        </Button>
      </div>
    </div>
  );
}
