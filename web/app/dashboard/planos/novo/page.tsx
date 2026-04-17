'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import type { ModeloCobranca, TipoCampanha, PlanoBaseCalculo, ReferenciaValor, ComponenteCustom } from '@/types';
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
    descontoBase: 20,
    temPromocao: false,
    descontoPromocional: 0,
    mesesPromocao: 0,
    publico: true,
    tipoCampanha: 'PADRAO' as TipoCampanha,
    dataInicioVigencia: '',
    dataFimVigencia: '',
    baseCalculo: 'KWH_CHEIO' as PlanoBaseCalculo,
    componentesCustom: [] as ComponenteCustom[],
    referenciaValor: 'MEDIA_3M' as ReferenciaValor,
    fatorIncremento: '',
    mostrarDiscriminado: true,
    // CooperToken
    cooperTokenAtivo: false,
    tokenOpcaoCooperado: 'AMBAS' as 'OPCAO_A' | 'OPCAO_B' | 'AMBAS',
    tokenValorTipo: 'KWH_APURADO' as 'FIXO' | 'KWH_APURADO',
    tokenValorFixo: '',
    tokenDescontoMaxPerc: '',
    tokenExpiracaoMeses: '',
  });

  async function salvar() {
    if (!form.nome.trim()) {
      setMensagem('O nome é obrigatório.');
      return;
    }
    if (!form.descontoBase || form.descontoBase < 1 || form.descontoBase > 100) {
      setMensagem('Desconto base é obrigatório (entre 1% e 100%).');
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
      payload.baseCalculo = form.baseCalculo;
      payload.componentesCustom = form.baseCalculo === 'CUSTOM' ? form.componentesCustom : [];
      payload.referenciaValor = form.referenciaValor;
      payload.fatorIncremento = form.fatorIncremento !== '' ? parseFloat(form.fatorIncremento as string) : null;
      payload.mostrarDiscriminado = form.mostrarDiscriminado;
      // CooperToken
      payload.cooperTokenAtivo = form.cooperTokenAtivo;
      if (form.cooperTokenAtivo) {
        payload.tokenOpcaoCooperado = form.tokenOpcaoCooperado;
        payload.tokenValorTipo = form.tokenValorTipo;
        payload.tokenValorFixo = form.tokenValorTipo === 'FIXO' && form.tokenValorFixo !== '' ? parseFloat(String(form.tokenValorFixo)) : null;
        payload.tokenDescontoMaxPerc = form.tokenDescontoMaxPerc !== '' ? parseFloat(String(form.tokenDescontoMaxPerc)) : null;
        payload.tokenExpiracaoMeses = form.tokenExpiracaoMeses !== '' ? parseInt(String(form.tokenExpiracaoMeses)) : null;
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
            <label className={labelClass}>Desconto Base (%) *</label>
            <input
              className={inputClass}
              type="number"
              min={1}
              max={100}
              step={0.01}
              required
              value={form.descontoBase}
              onChange={(e) => setForm({ ...form, descontoBase: parseFloat(e.target.value) || 0 })}
            />
            <p className="text-xs text-gray-400 mt-0.5">Desconto aplicado pelo motor de proposta (obrigatório, 1-100%)</p>
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

        </CardContent>
      </Card>

      {/* Base de Cálculo */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Configuração Base de Cálculo</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-6">
          <div>
            <label className={labelClass}>Base de Cálculo</label>
            <select
              className={inputClass}
              value={form.baseCalculo}
              onChange={(e) => setForm({ ...form, baseCalculo: e.target.value as PlanoBaseCalculo })}
            >
              <option value="KWH_CHEIO">kWh Cheio (todos componentes)</option>
              <option value="SEM_TRIBUTO">Sem Tributos (TUSD + TE)</option>
              <option value="COM_ICMS">Com ICMS (TUSD + TE + ICMS)</option>
              <option value="CUSTOM">Personalizado</option>
            </select>
          </div>

          <div>
            <label className={labelClass}>Referência de Valor</label>
            <select
              className={inputClass}
              value={form.referenciaValor}
              onChange={(e) => setForm({ ...form, referenciaValor: e.target.value as ReferenciaValor })}
            >
              <option value="ULTIMA_FATURA">Última Fatura</option>
              <option value="MEDIA_3M">Média 3 meses</option>
              <option value="MEDIA_6M">Média 6 meses</option>
              <option value="MEDIA_12M">Média 12 meses</option>
            </select>
          </div>

          {form.baseCalculo === 'CUSTOM' && (
            <div className="col-span-2">
              <label className={labelClass}>Componentes (selecione os que compõem a base)</label>
              <div className="flex flex-wrap gap-3 mt-1">
                {(['TUSD', 'TE', 'ICMS', 'PIS_COFINS', 'CIP'] as ComponenteCustom[]).map((comp) => (
                  <label key={comp} className="flex items-center gap-1.5 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={form.componentesCustom.includes(comp)}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? [...form.componentesCustom, comp]
                          : form.componentesCustom.filter((c) => c !== comp);
                        setForm({ ...form, componentesCustom: next as ComponenteCustom[] });
                      }}
                      className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                    />
                    {comp.replace('_', '/')}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className={labelClass}>Fator de Incremento (%)</label>
            <input
              className={inputClass}
              type="number"
              step={0.01}
              placeholder="Opcional — ex: 5.00"
              value={form.fatorIncremento}
              onChange={(e) => setForm({ ...form, fatorIncremento: e.target.value })}
            />
            <p className="text-xs text-gray-400 mt-0.5">% adicional sobre a base de kWh (deixe vazio para ignorar)</p>
          </div>

          <div className="flex items-center gap-3 self-end pb-1">
            <Toggle
              checked={form.mostrarDiscriminado}
              onChange={(v) => setForm((prev) => ({ ...prev, mostrarDiscriminado: v }))}
            />
            <span className="text-sm text-gray-700">Mostrar componentes discriminados ao cooperado</span>
          </div>

        </CardContent>
      </Card>

      {/* CooperToken */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>CooperToken</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-6">
          <div className="col-span-2 flex items-center gap-3">
            <Toggle
              checked={form.cooperTokenAtivo}
              onChange={(v) => setForm((prev) => ({ ...prev, cooperTokenAtivo: v }))}
            />
            <span className="text-sm text-gray-700">Ativar CooperToken</span>
          </div>

          {form.cooperTokenAtivo && (
            <>
              <div>
                <label className={labelClass}>Opção do cooperado</label>
                <select
                  className={inputClass}
                  value={form.tokenOpcaoCooperado}
                  onChange={(e) => setForm({ ...form, tokenOpcaoCooperado: e.target.value as 'OPCAO_A' | 'OPCAO_B' | 'AMBAS' })}
                >
                  <option value="OPCAO_A">Opção A (desconto na cobrança)</option>
                  <option value="OPCAO_B">Opção B (cashback/crédito)</option>
                  <option value="AMBAS">Ambas (cooperado escolhe)</option>
                </select>
              </div>

              <div>
                <label className={labelClass}>Tipo de valor do token</label>
                <select
                  className={inputClass}
                  value={form.tokenValorTipo}
                  onChange={(e) => setForm({ ...form, tokenValorTipo: e.target.value as 'FIXO' | 'KWH_APURADO' })}
                >
                  <option value="KWH_APURADO">kWh Apurado (variável)</option>
                  <option value="FIXO">Valor Fixo (R$)</option>
                </select>
              </div>

              {form.tokenValorTipo === 'FIXO' && (
                <div>
                  <label className={labelClass}>Valor fixo do token (R$)</label>
                  <input
                    className={inputClass}
                    type="number"
                    min={0}
                    step={0.0001}
                    placeholder="Ex: 0.5000"
                    value={form.tokenValorFixo}
                    onChange={(e) => setForm({ ...form, tokenValorFixo: e.target.value })}
                  />
                </div>
              )}

              <div>
                <label className={labelClass}>Desconto máximo via token (%)</label>
                <input
                  className={inputClass}
                  type="number"
                  min={0}
                  max={100}
                  step={0.01}
                  placeholder="Ex: 10.00"
                  value={form.tokenDescontoMaxPerc}
                  onChange={(e) => setForm({ ...form, tokenDescontoMaxPerc: e.target.value })}
                />
              </div>

              <div>
                <label className={labelClass}>Meses para expiração</label>
                <input
                  className={inputClass}
                  type="number"
                  min={1}
                  step={1}
                  placeholder="Ex: 12"
                  value={form.tokenExpiracaoMeses}
                  onChange={(e) => setForm({ ...form, tokenExpiracaoMeses: e.target.value })}
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
