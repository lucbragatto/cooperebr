'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import type { Plano, ModeloCobranca, TipoCampanha, PlanoBaseCalculo, ReferenciaValor, ComponenteCustom } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Pencil } from 'lucide-react';
import { getUsuario } from '@/lib/auth';
import PlanoSimulacao from '@/components/PlanoSimulacao';
import CombinacaoAtual from '@/components/CombinacaoAtual';

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

const baseCalculoLabel: Record<string, string> = {
  KWH_CHEIO: 'kWh Cheio (todos componentes)',
  SEM_TRIBUTO: 'Sem Tributos (TUSD + TE)',
  COM_ICMS: 'Com ICMS (TUSD + TE + ICMS)',
  CUSTOM: 'Personalizado',
};

const referenciaValorLabel: Record<string, string> = {
  ULTIMA_FATURA: 'Última Fatura',
  MEDIA_3M: 'Média 3 meses',
  MEDIA_6M: 'Média 6 meses',
  MEDIA_12M: 'Média 12 meses',
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
  const [perfil, setPerfil] = useState<string | null>(null);
  const [parceiros, setParceiros] = useState<{ id: string; nome: string }[]>([]);
  // Escopo do plano em edição: 'GLOBAL' ou ID. Só editável por SUPER_ADMIN.
  const [escopo, setEscopo] = useState<string>('GLOBAL');

  useEffect(() => {
    const u = getUsuario();
    setPerfil(u?.perfil ?? null);
    if (u?.perfil === 'SUPER_ADMIN') {
      api.get<{ id: string; nome: string }[]>('/cooperativas')
        .then((r) => setParceiros(r.data ?? []))
        .catch(() => {});
    }
  }, []);

  const [form, setForm] = useState({
    nome: '',
    descricao: '',
    modeloCobranca: 'FIXO_MENSAL' as ModeloCobranca,
    descontoBase: 0,
    kwhContratoMensal: 500,
    temPromocao: false,
    descontoPromocional: 0,
    mesesPromocao: 0,
    publico: true,
    tipoCampanha: 'PADRAO' as TipoCampanha,
    dataInicioVigencia: '',
    dataFimVigencia: '',
    baseCalculo: 'KWH_CHEIO' as PlanoBaseCalculo,
    tipoDesconto: 'APLICAR_SOBRE_BASE' as 'APLICAR_SOBRE_BASE' | 'ABATER_DA_CHEIA',
    componentesCustom: [] as ComponenteCustom[],
    referenciaValor: 'MEDIA_3M' as ReferenciaValor,
    fatorIncremento: '' as string | number,
    mostrarDiscriminado: true,
    // CooperToken
    cooperTokenAtivo: false,
    tokenOpcaoCooperado: 'AMBAS' as 'OPCAO_A' | 'OPCAO_B' | 'AMBAS',
    tokenValorTipo: 'KWH_APURADO' as 'FIXO' | 'KWH_APURADO',
    tokenValorFixo: '' as string | number,
    tokenDescontoMaxPerc: '' as string | number,
    tokenExpiracaoMeses: '' as string | number,
  });

  useEffect(() => {
    api.get<Plano>(`/planos/${id}`)
      .then((r) => {
        setPlano(r.data);
        initForm(r.data);
        setEscopo(r.data.cooperativaId ?? 'GLOBAL');
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
      kwhContratoMensal: 500,
      baseCalculo: (p.baseCalculo ?? 'KWH_CHEIO') as PlanoBaseCalculo,
      tipoDesconto: (p.tipoDesconto ?? 'APLICAR_SOBRE_BASE'),
      componentesCustom: (p.componentesCustom ?? []) as ComponenteCustom[],
      referenciaValor: (p.referenciaValor ?? 'MEDIA_3M') as ReferenciaValor,
      fatorIncremento: p.fatorIncremento != null ? Number(p.fatorIncremento) : '',
      mostrarDiscriminado: p.mostrarDiscriminado ?? true,
      // CooperToken
      cooperTokenAtivo: p.cooperTokenAtivo ?? false,
      tokenOpcaoCooperado: (p.tokenOpcaoCooperado ?? 'AMBAS') as 'OPCAO_A' | 'OPCAO_B' | 'AMBAS',
      tokenValorTipo: (p.tokenValorTipo ?? 'KWH_APURADO') as 'FIXO' | 'KWH_APURADO',
      tokenValorFixo: p.tokenValorFixo != null ? Number(p.tokenValorFixo) : '',
      tokenDescontoMaxPerc: p.tokenDescontoMaxPerc != null ? Number(p.tokenDescontoMaxPerc) : '',
      tokenExpiracaoMeses: p.tokenExpiracaoMeses != null ? Number(p.tokenExpiracaoMeses) : '',
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
      payload.baseCalculo = form.baseCalculo;
      payload.tipoDesconto = form.tipoDesconto;
      payload.componentesCustom = form.baseCalculo === 'CUSTOM' ? form.componentesCustom : [];
      payload.referenciaValor = form.referenciaValor;
      payload.fatorIncremento = form.fatorIncremento !== '' ? parseFloat(String(form.fatorIncremento)) : null;
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
      // Multi-tenant (Fase A): apenas SUPER_ADMIN pode alterar escopo.
      if (perfil === 'SUPER_ADMIN') {
        payload.cooperativaId = escopo === 'GLOBAL' ? null : escopo;
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

      {plano && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">

      {!modoEdicao && (
        <>
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
            {perfil === 'SUPER_ADMIN' && (
              <Campo
                label="Escopo"
                value={
                  plano.cooperativaId === null
                    ? 'Global (todos os parceiros)'
                    : (parceiros.find((p) => p.id === plano.cooperativaId)?.nome ?? plano.cooperativaId)
                }
              />
            )}
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

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Configuração Base de Cálculo</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-6">
            <Campo label="Base de Cálculo" value={baseCalculoLabel[plano.baseCalculo] ?? plano.baseCalculo} />
            <Campo
              label="Como o desconto é aplicado"
              value={
                (plano.tipoDesconto ?? 'APLICAR_SOBRE_BASE') === 'ABATER_DA_CHEIA'
                  ? 'Sobre a parte da energia (padrão mercado GD)'
                  : 'Sobre o total da base (admin honesto)'
              }
            />
            <Campo label="Referência de Valor" value={referenciaValorLabel[plano.referenciaValor] ?? plano.referenciaValor} />
            {plano.baseCalculo === 'CUSTOM' && (
              <Campo label="Componentes" value={plano.componentesCustom?.join(', ') || '—'} />
            )}
            <Campo label="Fator de Incremento" value={plano.fatorIncremento != null ? `${Number(plano.fatorIncremento).toFixed(2)}%` : 'Não aplicado'} />
            <Campo label="Mostrar Discriminado" value={plano.mostrarDiscriminado ? 'Sim' : 'Não'} />
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>CooperToken</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-6">
            <Campo label="CooperToken Ativo" value={plano.cooperTokenAtivo ? 'Sim' : 'Não'} />
            {plano.cooperTokenAtivo && (
              <>
                <Campo label="Opção do Cooperado" value={
                  plano.tokenOpcaoCooperado === 'OPCAO_A' ? 'Opção A (desconto)' :
                  plano.tokenOpcaoCooperado === 'OPCAO_B' ? 'Opção B (cashback)' : 'Ambas'
                } />
                <Campo label="Tipo de Valor" value={plano.tokenValorTipo === 'FIXO' ? 'Valor Fixo' : 'kWh Apurado'} />
                {plano.tokenValorTipo === 'FIXO' && (
                  <Campo label="Valor Fixo" value={plano.tokenValorFixo != null ? `R$ ${Number(plano.tokenValorFixo).toFixed(4)}` : '—'} />
                )}
                <Campo label="Desconto Máximo via Token" value={plano.tokenDescontoMaxPerc != null ? `${Number(plano.tokenDescontoMaxPerc).toFixed(2)}%` : '—'} />
                <Campo label="Expiração" value={plano.tokenExpiracaoMeses != null ? `${plano.tokenExpiracaoMeses} meses` : '—'} />
              </>
            )}
          </CardContent>
        </Card>
        </>
      )}

      {modoEdicao && (
        <>
        <Card>
          <CardHeader>
            <CardTitle>Editar Plano</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-6">
            {/* Escopo do plano — apenas SUPER_ADMIN edita */}
            {perfil === 'SUPER_ADMIN' && (
              <div className="col-span-2">
                <label className={labelClass}>Escopo do plano</label>
                <select
                  className={inputClass}
                  value={escopo}
                  onChange={(e) => setEscopo(e.target.value)}
                >
                  <option value="GLOBAL">Plano global (todos os parceiros)</option>
                  {parceiros.map((p) => (
                    <option key={p.id} value={p.id}>
                      Específico de {p.nome}
                    </option>
                  ))}
                </select>
              </div>
            )}

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
                {perfil === 'SUPER_ADMIN' ? (
                  <>
                    <option value="CREDITOS_COMPENSADOS">Créditos Compensados</option>
                    <option value="CREDITOS_DINAMICO">Créditos Dinâmico</option>
                  </>
                ) : (
                  <>
                    <option value="CREDITOS_COMPENSADOS" disabled>Créditos Compensados (bloqueado — Sprint 5)</option>
                    <option value="CREDITOS_DINAMICO" disabled>Créditos Dinâmico (bloqueado — Sprint 5)</option>
                  </>
                )}
              </select>
              {perfil === 'SUPER_ADMIN' && form.modeloCobranca !== 'FIXO_MENSAL' && (
                <p className="text-xs text-orange-600 mt-1">
                  ⚠ Backend ainda bloqueia <strong>aceitar proposta</strong> e <strong>processar fatura</strong> com este modelo enquanto BLOQUEIO_MODELOS_NAO_FIXO=true.
                </p>
              )}
            </div>

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
              <p className="text-xs text-gray-400 mt-0.5">Obrigatório — usado pelo motor de proposta (1-100%)</p>
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

          </CardContent>
        </Card>

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

            {/* Como o desconto é aplicado — define APLICAR_SOBRE_BASE × ABATER_DA_CHEIA */}
            <div className="col-span-2">
              <label className={labelClass}>Como o desconto é aplicado?</label>
              <div className="flex flex-col gap-2 mt-1">
                <label className="flex items-start gap-2 cursor-pointer text-sm text-gray-700">
                  <input
                    type="radio"
                    name="tipoDesconto"
                    value="APLICAR_SOBRE_BASE"
                    checked={form.tipoDesconto === 'APLICAR_SOBRE_BASE'}
                    onChange={(e) => setForm({ ...form, tipoDesconto: e.target.value as 'APLICAR_SOBRE_BASE' | 'ABATER_DA_CHEIA' })}
                    className="mt-0.5"
                  />
                  <span><strong>Sobre o total da conta.</strong> Se anunciar 20% de desconto, cooperado economiza 20% reais.</span>
                </label>
                <label className="flex items-start gap-2 cursor-pointer text-sm text-gray-700">
                  <input
                    type="radio"
                    name="tipoDesconto"
                    value="ABATER_DA_CHEIA"
                    checked={form.tipoDesconto === 'ABATER_DA_CHEIA'}
                    onChange={(e) => setForm({ ...form, tipoDesconto: e.target.value as 'APLICAR_SOBRE_BASE' | 'ABATER_DA_CHEIA' })}
                    className="mt-0.5"
                  />
                  <span><strong>Sobre a parte da energia.</strong> Padrão do mercado GD brasileiro.</span>
                </label>
              </div>
            </div>

            <CombinacaoAtual
              modeloCobranca={form.modeloCobranca}
              baseCalculo={form.baseCalculo}
              tipoDesconto={form.tipoDesconto}
              descontoBase={form.descontoBase}
              referenciaValor={form.referenciaValor}
              temPromocao={form.temPromocao}
              descontoPromocional={form.descontoPromocional}
              mesesPromocao={form.mesesPromocao}
            />

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
        </>
      )}

          </div>
          <div className="lg:col-span-1">
            <PlanoSimulacao
              modeloCobranca={modoEdicao ? form.modeloCobranca : plano.modeloCobranca}
              baseCalculo={modoEdicao ? form.baseCalculo : (plano.baseCalculo as 'KWH_CHEIO' | 'SEM_TRIBUTO' | 'COM_ICMS' | 'CUSTOM')}
              tipoDesconto={modoEdicao ? form.tipoDesconto : (plano.tipoDesconto ?? 'APLICAR_SOBRE_BASE')}
              descontoBase={modoEdicao ? form.descontoBase : Number(plano.descontoBase)}
              referenciaValor={modoEdicao ? form.referenciaValor : (plano.referenciaValor as 'ULTIMA_FATURA' | 'MEDIA_3M' | 'MEDIA_6M' | 'MEDIA_12M')}
              temPromocao={modoEdicao ? form.temPromocao : plano.temPromocao}
              descontoPromocional={modoEdicao ? form.descontoPromocional : (plano.descontoPromocional != null ? Number(plano.descontoPromocional) : 0)}
              mesesPromocao={modoEdicao ? form.mesesPromocao : (plano.mesesPromocao ?? 0)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
