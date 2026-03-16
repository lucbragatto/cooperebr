'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import type { ModeloCobranca, TipoCampanha } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 ${
        checked ? 'bg-green-600' : 'bg-gray-200'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

const inputClass =
  'w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500';
const labelClass = 'text-xs text-gray-500 mb-0.5 block';

export default function NovoPlanoPage() {
  const router = useRouter();
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState('');

  const [form, setForm] = useState({
    nome: '',
    descricao: '',
    modeloCobranca: 'FIXO_MENSAL' as ModeloCobranca,
    descontoBase: 0,
    temPromocao: false,
    descontoPromocional: 0,
    mesesPromocao: 0,
    publico: true,
    tipoCampanha: 'PADRAO' as TipoCampanha,
    dataInicioVigencia: '',
    dataFimVigencia: '',
  });

  async function salvar() {
    if (!form.nome.trim()) {
      setMensagem('O nome é obrigatório.');
      return;
    }
    setSalvando(true);
    setMensagem('');
    try {
      const payload: Record<string, unknown> = {
        nome: form.nome,
        modeloCobranca: form.modeloCobranca,
        descontoBase: form.descontoBase,
        temPromocao: form.temPromocao,
        publico: form.publico,
        tipoCampanha: form.tipoCampanha,
      };
      if (form.descricao.trim()) payload.descricao = form.descricao;
      if (form.temPromocao) {
        payload.descontoPromocional = form.descontoPromocional;
        payload.mesesPromocao = form.mesesPromocao;
      }
      if (form.tipoCampanha === 'CAMPANHA') {
        if (form.dataInicioVigencia) payload.dataInicioVigencia = form.dataInicioVigencia;
        if (form.dataFimVigencia) payload.dataFimVigencia = form.dataFimVigencia;
      }
      await api.post('/planos', payload);
      router.push('/dashboard/planos');
    } catch {
      setMensagem('Erro ao salvar. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        <h2 className="text-2xl font-bold text-gray-800">Novo Plano</h2>
      </div>

      {mensagem && (
        <p className={`mb-4 text-sm ${mensagem.startsWith('Erro') ? 'text-red-500' : 'text-green-600'}`}>
          {mensagem}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Dados do Plano</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-6">
          {/* Nome */}
          <div className="col-span-2">
            <label className={labelClass}>Nome *</label>
            <input
              className={inputClass}
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
            />
          </div>

          {/* Descrição */}
          <div className="col-span-2">
            <label className={labelClass}>Descrição</label>
            <textarea
              className={`${inputClass} resize-none h-20`}
              value={form.descricao}
              onChange={(e) => setForm({ ...form, descricao: e.target.value })}
            />
          </div>

          {/* Modelo de Cobrança */}
          <div>
            <label className={labelClass}>Modelo de Cobrança</label>
            <select
              className={inputClass}
              value={form.modeloCobranca}
              onChange={(e) => setForm({ ...form, modeloCobranca: e.target.value as ModeloCobranca })}
            >
              <option value="FIXO_MENSAL">Fixo Mensal</option>
              <option value="CREDITOS_COMPENSADOS">Créditos Compensados</option>
              <option value="CREDITOS_DINAMICO">Créditos Dinâmico</option>
            </select>
          </div>

          {/* Desconto Base */}
          <div>
            <label className={labelClass}>Desconto Base (%)</label>
            <input
              className={inputClass}
              type="number"
              min={0}
              max={100}
              step={0.01}
              value={form.descontoBase}
              onChange={(e) => setForm({ ...form, descontoBase: parseFloat(e.target.value) || 0 })}
            />
          </div>

          {/* Toggle Promoção */}
          <div className="col-span-2 flex items-center gap-3">
            <Toggle
              checked={form.temPromocao}
              onChange={(v) => setForm((prev) => ({ ...prev, temPromocao: v }))}
            />
            <span className="text-sm text-gray-700">Tem período promocional?</span>
          </div>

          {form.temPromocao && (
            <>
              <div>
                <label className={labelClass}>Desconto Promocional (%)</label>
                <input
                  className={inputClass}
                  type="number"
                  min={0}
                  max={100}
                  step={0.01}
                  value={form.descontoPromocional}
                  onChange={(e) => setForm((prev) => ({ ...prev, descontoPromocional: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              <div>
                <label className={labelClass}>Duração (meses)</label>
                <input
                  className={inputClass}
                  type="number"
                  min={1}
                  step={1}
                  value={form.mesesPromocao}
                  onChange={(e) => setForm((prev) => ({ ...prev, mesesPromocao: parseInt(e.target.value) || 0 }))}
                />
              </div>
            </>
          )}

          {/* Toggle Público */}
          <div className="col-span-2 flex items-center gap-3">
            <Toggle
              checked={form.publico}
              onChange={(v) => setForm((prev) => ({ ...prev, publico: v }))}
            />
            <span className="text-sm text-gray-700">Plano público? (visível na captação)</span>
          </div>

          {/* Tipo Campanha */}
          <div>
            <label className={labelClass}>Tipo</label>
            <select
              className={inputClass}
              value={form.tipoCampanha}
              onChange={(e) => setForm({ ...form, tipoCampanha: e.target.value as TipoCampanha })}
            >
              <option value="PADRAO">Padrão</option>
              <option value="CAMPANHA">Campanha</option>
            </select>
          </div>

          {form.tipoCampanha === 'CAMPANHA' && (
            <>
              <div>
                <label className={labelClass}>Data Início Vigência</label>
                <input
                  className={inputClass}
                  type="date"
                  value={form.dataInicioVigencia}
                  onChange={(e) => setForm({ ...form, dataInicioVigencia: e.target.value })}
                />
              </div>
              <div>
                <label className={labelClass}>Data Fim Vigência</label>
                <input
                  className={inputClass}
                  type="date"
                  value={form.dataFimVigencia}
                  onChange={(e) => setForm({ ...form, dataFimVigencia: e.target.value })}
                />
              </div>
            </>
          )}

          {/* Actions */}
          <div className="col-span-2 flex gap-3 mt-2">
            <Button onClick={salvar} disabled={salvando}>
              {salvando ? 'Salvando...' : 'Salvar'}
            </Button>
            <Button variant="outline" onClick={() => router.back()} disabled={salvando}>
              Cancelar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
