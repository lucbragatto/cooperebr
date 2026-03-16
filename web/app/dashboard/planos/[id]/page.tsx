'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import type { Plano, ModeloCobranca, TipoCampanha } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Pencil } from 'lucide-react';

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

const modeloLabel: Record<string, string> = {
  FIXO_MENSAL: 'Fixo Mensal',
  CREDITOS_COMPENSADOS: 'Créditos Compensados',
  CREDITOS_DINAMICO: 'Créditos Dinâmico',
};

const modeloClass: Record<string, string> = {
  FIXO_MENSAL: 'bg-blue-100 text-blue-700 border-blue-200',
  CREDITOS_COMPENSADOS: 'bg-green-100 text-green-700 border-green-200',
  CREDITOS_DINAMICO: 'bg-purple-100 text-purple-700 border-purple-200',
};

function Campo({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className="text-sm font-medium text-gray-800">{value ?? '—'}</p>
    </div>
  );
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('pt-BR');
}

const inputClass =
  'w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500';
const labelClass = 'text-xs text-gray-500 mb-0.5 block';

export default function PlanoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [plano, setPlano] = useState<Plano | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [modoEdicao, setModoEdicao] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [togglingAtivo, setTogglingAtivo] = useState(false);

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

  useEffect(() => {
    api.get<Plano>(`/planos/${id}`)
      .then((r) => {
        setPlano(r.data);
        initForm(r.data);
      })
      .catch(() => setErro('Plano não encontrado.'))
      .finally(() => setCarregando(false));
  }, [id]);

  function initForm(p: Plano) {
    setForm({
      nome: p.nome,
      descricao: p.descricao ?? '',
      modeloCobranca: p.modeloCobranca,
      descontoBase: Number(p.descontoBase),
      temPromocao: p.temPromocao,
      descontoPromocional: Number(p.descontoPromocional ?? 0),
      mesesPromocao: p.mesesPromocao ?? 0,
      publico: p.publico,
      tipoCampanha: p.tipoCampanha,
      dataInicioVigencia: p.dataInicioVigencia
        ? p.dataInicioVigencia.substring(0, 10)
        : '',
      dataFimVigencia: p.dataFimVigencia
        ? p.dataFimVigencia.substring(0, 10)
        : '',
    });
  }

  function iniciarEdicao() {
    if (!plano) return;
    initForm(plano);
    setMensagem('');
    setModoEdicao(true);
  }

  function cancelar() {
    setModoEdicao(false);
    setMensagem('');
  }

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
        descricao: form.descricao || null,
        modeloCobranca: form.modeloCobranca,
        descontoBase: form.descontoBase,
        temPromocao: form.temPromocao,
        publico: form.publico,
        tipoCampanha: form.tipoCampanha,
      };
      if (form.temPromocao) {
        payload.descontoPromocional = form.descontoPromocional;
        payload.mesesPromocao = form.mesesPromocao;
      } else {
        payload.descontoPromocional = null;
        payload.mesesPromocao = null;
      }
      if (form.tipoCampanha === 'CAMPANHA') {
        payload.dataInicioVigencia = form.dataInicioVigencia || null;
        payload.dataFimVigencia = form.dataFimVigencia || null;
      } else {
        payload.dataInicioVigencia = null;
        payload.dataFimVigencia = null;
      }
      const { data } = await api.put<Plano>(`/planos/${id}`, payload);
      setPlano(data);
      setModoEdicao(false);
      setMensagem('Salvo com sucesso!');
    } catch {
      setMensagem('Erro ao salvar. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

  async function toggleAtivo() {
    if (!plano) return;
    setTogglingAtivo(true);
    setMensagem('');
    try {
      const { data } = await api.put<Plano>(`/planos/${id}`, { ativo: !plano.ativo });
      setPlano(data);
      setMensagem(data.ativo ? 'Plano ativado.' : 'Plano desativado.');
    } catch {
      setMensagem('Erro ao alterar status. Tente novamente.');
    } finally {
      setTogglingAtivo(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        <h2 className="text-2xl font-bold text-gray-800">Detalhe do Plano</h2>
        {plano && !modoEdicao && (
          <div className="ml-auto flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={toggleAtivo}
              disabled={togglingAtivo}
            >
              {togglingAtivo ? 'Aguarde...' : plano.ativo ? 'Desativar' : 'Ativar'}
            </Button>
            <Button size="sm" variant="outline" onClick={iniciarEdicao}>
              <Pencil className="h-4 w-4 mr-2" />
              Editar
            </Button>
          </div>
        )}
      </div>

      {carregando && <p className="text-gray-500">Carregando...</p>}
      {erro && <p className="text-red-500">{erro}</p>}
      {mensagem && (
        <p className={`mb-4 text-sm ${mensagem.startsWith('Erro') ? 'text-red-500' : 'text-green-600'}`}>
          {mensagem}
        </p>
      )}

      {plano && !modoEdicao && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{plano.nome}</span>
              <div className="flex items-center gap-2">
                {plano.tipoCampanha === 'CAMPANHA' && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border bg-orange-100 text-orange-700 border-orange-200">
                    CAMPANHA
                  </span>
                )}
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${modeloClass[plano.modeloCobranca]}`}
                >
                  {modeloLabel[plano.modeloCobranca]}
                </span>
                <Badge variant={plano.ativo ? 'default' : 'secondary'}>
                  {plano.ativo ? 'Ativo' : 'Inativo'}
                </Badge>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-6">
            <Campo label="ID" value={plano.id} />
            <Campo label="Desconto Base" value={`${Number(plano.descontoBase).toFixed(2)}%`} />
            <Campo label="Descrição" value={plano.descricao} />
            <Campo label="Público" value={plano.publico ? 'Sim' : 'Não'} />
            <Campo label="Tem Promoção" value={plano.temPromocao ? 'Sim' : 'Não'} />
            {plano.temPromocao && (
              <>
                <Campo label="Desconto Promocional" value={`${Number(plano.descontoPromocional).toFixed(2)}%`} />
                <Campo label="Duração Promoção" value={`${plano.mesesPromocao} meses`} />
              </>
            )}
            <Campo label="Tipo" value={plano.tipoCampanha === 'CAMPANHA' ? 'Campanha' : 'Padrão'} />
            {plano.tipoCampanha === 'CAMPANHA' && (
              <>
                <Campo label="Início Vigência" value={formatDate(plano.dataInicioVigencia)} />
                <Campo label="Fim Vigência" value={formatDate(plano.dataFimVigencia)} />
              </>
            )}
            <Campo label="Criado em" value={new Date(plano.createdAt).toLocaleString('pt-BR')} />
            <Campo label="Atualizado em" value={new Date(plano.updatedAt).toLocaleString('pt-BR')} />
          </CardContent>
        </Card>
      )}

      {plano && modoEdicao && (
        <Card>
          <CardHeader>
            <CardTitle>Editar Plano</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-6">
            <div className="col-span-2">
              <label className={labelClass}>Nome *</label>
              <input
                className={inputClass}
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
              />
            </div>

            <div className="col-span-2">
              <label className={labelClass}>Descrição</label>
              <textarea
                className={`${inputClass} resize-none h-20`}
                value={form.descricao}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
              />
            </div>

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
                    onChange={(e) => setForm({ ...form, descontoPromocional: parseFloat(e.target.value) || 0 })}
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
                    onChange={(e) => setForm({ ...form, mesesPromocao: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </>
            )}

            <div className="col-span-2 flex items-center gap-3">
              <Toggle
                checked={form.publico}
                onChange={(v) => setForm((prev) => ({ ...prev, publico: v }))}
              />
              <span className="text-sm text-gray-700">Plano público? (visível na captação)</span>
            </div>

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

            <div className="col-span-2 flex gap-3 mt-2">
              <Button onClick={salvar} disabled={salvando}>
                {salvando ? 'Salvando...' : 'Salvar'}
              </Button>
              <Button variant="outline" onClick={cancelar} disabled={salvando}>
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
