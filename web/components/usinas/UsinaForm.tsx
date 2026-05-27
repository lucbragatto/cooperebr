'use client';

/**
 * UsinaForm — componente compartilhado de cadastro/edição de Usina.
 *
 * Sub-Sprint Refinamento Telas Usinas F.7b (M36, 28/05/2026).
 * Padrão UX Dual 17/05 Tipo B (entidade inteira → página própria).
 *
 * Substitui o Sheet/drawer lateral em /dashboard/usinas/[id]/page.tsx (D-novo-BB)
 * e dá paridade total com /dashboard/usinas/nova (D-novo-BC).
 *
 * Campos cobertos (~28): identidade, classe GD, status homologação, localização,
 * endereço Bloco H', contrato distribuidora, forma de aquisição+pagamento,
 * resumo proprietário, campos operacionais (modeloCobrancaOverride,
 * politicaBandeira, valorKwhPadrao, observacoes).
 *
 * Campos NÃO cobertos (vivem em telas dedicadas):
 *   - responsabilidadeDespesas (matriz 15 categorias) → /proprietario M30
 *   - proprietarioCooperadoId (vínculo cooperado) → /proprietario
 *   - statusOperacional → muda só via ações Tipo C (Dialogs)
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';

export interface UsinaFormData {
  nome: string;
  apelidoInterno: string;
  potenciaKwp: string;
  capacidadeKwh: string;
  producaoMensalKwh: string;
  classeGdAnotada: string;
  statusHomologacao: string;
  dataHomologacao: string;
  dataInicioProducao: string;
  cidade: string;
  estado: string;
  enderecoLogradouro: string;
  enderecoNumero: string;
  enderecoBairro: string;
  enderecoCep: string;
  distribuidora: string;
  cnpjUsina: string;
  numeroContratoEdp: string;
  dataContratoEdp: string;
  formaAquisicao: string;
  formaPagamentoDono: string;
  valorAluguelFixo: string;
  percentualGeracaoDono: string;
  proprietarioNome: string;
  proprietarioCpfCnpj: string;
  proprietarioTelefone: string;
  proprietarioEmail: string;
  proprietarioTipo: string;
  modeloCobrancaOverride: string;
  politicaBandeira: string;
  valorKwhPadrao: string;
  observacoes: string;
}

export const VALORES_INICIAIS: UsinaFormData = {
  nome: '',
  apelidoInterno: '',
  potenciaKwp: '',
  capacidadeKwh: '',
  producaoMensalKwh: '',
  classeGdAnotada: '',
  statusHomologacao: '',
  dataHomologacao: '',
  dataInicioProducao: '',
  cidade: '',
  estado: '',
  enderecoLogradouro: '',
  enderecoNumero: '',
  enderecoBairro: '',
  enderecoCep: '',
  distribuidora: '',
  cnpjUsina: '',
  numeroContratoEdp: '',
  dataContratoEdp: '',
  formaAquisicao: '',
  formaPagamentoDono: '',
  valorAluguelFixo: '',
  percentualGeracaoDono: '',
  proprietarioNome: '',
  proprietarioCpfCnpj: '',
  proprietarioTelefone: '',
  proprietarioEmail: '',
  proprietarioTipo: 'PF',
  modeloCobrancaOverride: '',
  politicaBandeira: '',
  valorKwhPadrao: '',
  observacoes: '',
};

interface UsinaFormProps {
  modo: 'criar' | 'editar';
  usinaId?: string;
  form: UsinaFormData;
  setForm: (next: UsinaFormData) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancelar?: () => void;
  salvando?: boolean;
  erro?: string;
  sucesso?: string;
}

export function UsinaForm({
  modo,
  usinaId,
  form,
  setForm,
  onSubmit,
  onCancelar,
  salvando,
  erro,
  sucesso,
}: UsinaFormProps) {
  function set<K extends keyof UsinaFormData>(field: K, value: string) {
    setForm({ ...form, [field]: value });
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle className="text-base font-medium text-gray-600">
          {modo === 'criar' ? 'Dados da usina' : 'Editar dados da usina'}
        </CardTitle>
        {modo === 'editar' && usinaId && (
          <Link
            href={`/dashboard/usinas/${usinaId}/proprietario`}
            className="text-xs text-amber-700 hover:underline inline-flex items-center gap-1 mt-1"
          >
            <ExternalLink className="w-3 h-3" />
            Editar responsabilidades de despesas + vínculo proprietário cooperado →
          </Link>
        )}
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          {/* ─── Identidade ─────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="nome">Nome (razão social ANEEL) *</Label>
              <Input
                id="nome"
                value={form.nome}
                onChange={(e) => set('nome', e.target.value)}
                placeholder="COOPERE BR - Usina Linhares 2"
                required
                autoFocus={modo === 'criar'}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="apelidoInterno">Apelido interno</Label>
              <Input
                id="apelidoInterno"
                value={form.apelidoInterno}
                onChange={(e) => set('apelidoInterno', e.target.value)}
                placeholder="cooperebr1, cooperebr2"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label htmlFor="potenciaKwp">Potência instalada (kWp) *</Label>
              <Input
                id="potenciaKwp"
                type="number"
                step="0.01"
                min="0"
                value={form.potenciaKwp}
                onChange={(e) => set('potenciaKwp', e.target.value)}
                placeholder="1000.00"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="capacidadeKwh">Capacidade mensal (kWh/mês) {modo === 'criar' && '*'}</Label>
              <Input
                id="capacidadeKwh"
                type="number"
                step="0.01"
                min="0"
                value={form.capacidadeKwh}
                onChange={(e) => set('capacidadeKwh', e.target.value)}
                placeholder="157000.00"
                required={modo === 'criar'}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="producaoMensalKwh">Produção mensal (kWh)</Label>
              <Input
                id="producaoMensalKwh"
                type="number"
                step="0.01"
                min="0"
                value={form.producaoMensalKwh}
                onChange={(e) => set('producaoMensalKwh', e.target.value)}
                placeholder="opcional"
              />
            </div>
          </div>

          {/* Classe GD — campo informativo SÓ REGISTRO (F.7a) */}
          <div className="space-y-1">
            <Label htmlFor="classeGdAnotada">Classe GD (regulatório)</Label>
            <select
              id="classeGdAnotada"
              className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm"
              value={form.classeGdAnotada}
              onChange={(e) => set('classeGdAnotada', e.target.value)}
            >
              <option value="">— Não classificado —</option>
              <option value="GD_I">GD_I — microgeração ≤ 75 kW</option>
              <option value="GD_II">GD_II — minigeração I, 75 kW – 1 MW</option>
              <option value="GD_III">GD_III — minigeração II, 1 MW – 5 MW</option>
            </select>
            <div className="bg-blue-50 border border-blue-200 rounded-md p-2 mt-1 text-xs text-blue-800 space-y-0.5">
              <p><strong>Como ler:</strong></p>
              <p>• <strong>GD_I:</strong> microgeração ≤ 75 kW (isento Fio B histórico)</p>
              <p>• <strong>GD_II:</strong> minigeração I, 75 kW – 1 MW (Fio B progressivo)</p>
              <p>• <strong>GD_III:</strong> minigeração II, 1 MW – 5 MW (Fio B progressivo)</p>
              <p className="italic mt-1">Campo informativo — não impacta cálculo atual. Define como o Fio B será aplicado quando módulo entrar.</p>
            </div>
          </div>

          {/* Status homologação + datas */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label htmlFor="statusHomologacao">Status de homologação</Label>
              <select
                id="statusHomologacao"
                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm"
                value={form.statusHomologacao}
                onChange={(e) => set('statusHomologacao', e.target.value)}
              >
                <option value="">— Padrão CADASTRADA —</option>
                <option value="CADASTRADA">Cadastrada</option>
                <option value="AGUARDANDO_HOMOLOGACAO">Aguardando homologação</option>
                <option value="HOMOLOGADA">Homologada</option>
                <option value="EM_PRODUCAO">Em produção</option>
                <option value="SUSPENSA">Suspensa</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="dataHomologacao">Data homologação</Label>
              <Input
                id="dataHomologacao"
                type="date"
                value={form.dataHomologacao}
                onChange={(e) => set('dataHomologacao', e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="dataInicioProducao">Início produção</Label>
              <Input
                id="dataInicioProducao"
                type="date"
                value={form.dataInicioProducao}
                onChange={(e) => set('dataInicioProducao', e.target.value)}
              />
            </div>
          </div>

          {/* ─── Localização ─────────────────────────────────────── */}
          <hr className="my-2" />
          <p className="text-sm font-medium text-gray-600">Localização</p>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="cidade">Cidade *</Label>
              <Input
                id="cidade"
                value={form.cidade}
                onChange={(e) => set('cidade', e.target.value)}
                placeholder="Linhares"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="estado">UF *</Label>
              <Input
                id="estado"
                value={form.estado}
                onChange={(e) => set('estado', e.target.value.toUpperCase())}
                placeholder="ES"
                maxLength={2}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1">
              <Label>Logradouro</Label>
              <Input value={form.enderecoLogradouro} onChange={(e) => set('enderecoLogradouro', e.target.value)} placeholder="Estrada Linhares X Povoação" />
            </div>
            <div className="space-y-1">
              <Label>Número</Label>
              <Input value={form.enderecoNumero} onChange={(e) => set('enderecoNumero', e.target.value)} placeholder="SN" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Bairro</Label>
              <Input value={form.enderecoBairro} onChange={(e) => set('enderecoBairro', e.target.value)} placeholder="Área Rural" />
            </div>
            <div className="space-y-1">
              <Label>CEP</Label>
              <Input value={form.enderecoCep} onChange={(e) => set('enderecoCep', e.target.value)} placeholder="29900-001" />
            </div>
          </div>

          {/* ─── Contrato distribuidora ─────────────────────────── */}
          <hr className="my-2" />
          <p className="text-sm font-medium text-gray-600">Contrato distribuidora</p>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Distribuidora</Label>
              <select className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm" value={form.distribuidora} onChange={(e) => set('distribuidora', e.target.value)}>
                <option value="">— Selecione —</option>
                <option value="EDP_ES">EDP_ES</option>
                <option value="EDP_SP">EDP_SP</option>
                <option value="CEMIG">CEMIG</option>
                <option value="ENEL_SP">ENEL_SP</option>
                <option value="LIGHT_RJ">LIGHT_RJ</option>
                <option value="CELESC">CELESC</option>
                <option value="OUTRAS">OUTRAS</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label>CNPJ titular EDP (cnpjUsina)</Label>
              <Input value={form.cnpjUsina} onChange={(e) => set('cnpjUsina', e.target.value)} placeholder="00000000000000" maxLength={18} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Número contrato EDP (CUSD/CCER)</Label>
              <Input value={form.numeroContratoEdp} onChange={(e) => set('numeroContratoEdp', e.target.value)} placeholder="EDP-ES-04123/2025" />
            </div>
            <div className="space-y-1">
              <Label>Data contrato EDP</Label>
              <Input type="date" value={form.dataContratoEdp} onChange={(e) => set('dataContratoEdp', e.target.value)} />
            </div>
          </div>

          {/* ─── Forma de aquisição ─────────────────────────────── */}
          <hr className="my-2" />
          <p className="text-sm font-medium text-gray-600">Forma de aquisição</p>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Forma de aquisição</Label>
              <select className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm" value={form.formaAquisicao} onChange={(e) => set('formaAquisicao', e.target.value)}>
                <option value="">— Selecione —</option>
                <option value="CESSAO">Cessão</option>
                <option value="ALUGUEL">Aluguel / Arrendamento</option>
                <option value="PROPRIA">Própria</option>
              </select>
            </div>
            {form.formaAquisicao !== 'PROPRIA' && (
              <div className="space-y-1">
                <Label>Forma de pagamento ao dono</Label>
                <select className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm" value={form.formaPagamentoDono} onChange={(e) => set('formaPagamentoDono', e.target.value)}>
                  <option value="">— A definir —</option>
                  <option value="FIXO">Fixo mensal</option>
                  <option value="PERCENTUAL">Percentual sobre geração</option>
                  <option value="HIBRIDO">Fixo + Percentual</option>
                </select>
              </div>
            )}
          </div>

          {(form.formaPagamentoDono === 'FIXO' || form.formaPagamentoDono === 'HIBRIDO') && (
            <div className="space-y-1">
              <Label htmlFor="valorAluguelFixo">Valor do aluguel/cessão (R$/mês) *</Label>
              <Input
                id="valorAluguelFixo"
                type="number"
                step="0.01"
                min="0.01"
                value={form.valorAluguelFixo}
                onChange={(e) => set('valorAluguelFixo', e.target.value)}
                placeholder="10000.00"
              />
            </div>
          )}

          {(form.formaPagamentoDono === 'PERCENTUAL' || form.formaPagamentoDono === 'HIBRIDO') && (
            <div className="space-y-1">
              <Label htmlFor="percentualGeracaoDono">Percentual da geração ao dono (%) *</Label>
              <Input
                id="percentualGeracaoDono"
                type="number"
                step="0.01"
                min="0.01"
                max="100"
                value={form.percentualGeracaoDono}
                onChange={(e) => set('percentualGeracaoDono', e.target.value)}
                placeholder="25.00"
              />
            </div>
          )}

          {/* ─── Proprietário (resumo) ──────────────────────────── */}
          <hr className="my-2" />
          <p className="text-sm font-medium text-gray-600">Proprietário da Usina (resumo)</p>
          {modo === 'editar' && usinaId && (
            <p className="text-xs text-gray-500">
              ℹ️ Vínculo proprietário cooperado + matriz de responsabilidades vivem em{' '}
              <Link href={`/dashboard/usinas/${usinaId}/proprietario`} className="text-amber-700 underline">
                tela dedicada
              </Link>.
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Tipo</Label>
              <select className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm" value={form.proprietarioTipo} onChange={(e) => set('proprietarioTipo', e.target.value)}>
                <option value="PF">Pessoa Física</option>
                <option value="PJ">Pessoa Jurídica</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label>Nome do Proprietário</Label>
              <Input value={form.proprietarioNome} onChange={(e) => set('proprietarioNome', e.target.value)} placeholder="Nome completo / Razão social" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>CPF/CNPJ</Label>
              <Input value={form.proprietarioCpfCnpj} onChange={(e) => set('proprietarioCpfCnpj', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Telefone</Label>
              <Input value={form.proprietarioTelefone} onChange={(e) => set('proprietarioTelefone', e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Email</Label>
            <Input value={form.proprietarioEmail} onChange={(e) => set('proprietarioEmail', e.target.value)} type="email" />
          </div>

          {/* ─── Operacional ────────────────────────────────────── */}
          <hr className="my-2" />
          <p className="text-sm font-medium text-gray-600">Operacional</p>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="modeloCobrancaOverride">Modelo cobrança override</Label>
              <select
                id="modeloCobrancaOverride"
                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm"
                value={form.modeloCobrancaOverride}
                onChange={(e) => set('modeloCobrancaOverride', e.target.value)}
              >
                <option value="">— Herda da cooperativa —</option>
                <option value="FIXO_MENSAL">Fixo mensal</option>
                <option value="CREDITOS_COMPENSADOS">Créditos compensados</option>
                <option value="CREDITOS_DINAMICO">Créditos dinâmico</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="politicaBandeira">Política bandeira</Label>
              <select
                id="politicaBandeira"
                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm"
                value={form.politicaBandeira}
                onChange={(e) => set('politicaBandeira', e.target.value)}
              >
                <option value="">— Herda da cooperativa —</option>
                <option value="APLICAR">Aplicar (cobra automaticamente)</option>
                <option value="NAO_APLICAR">Não aplicar (nunca cobra)</option>
                <option value="DECIDIR_MENSAL">Decidir mensal (admin escolhe)</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="valorKwhPadrao">Valor kWh padrão (R$/kWh) — override pra repasse</Label>
            <Input
              id="valorKwhPadrao"
              type="number"
              step="0.00001"
              min="0"
              value={form.valorKwhPadrao}
              onChange={(e) => set('valorKwhPadrao', e.target.value)}
              placeholder="ex: 0,46863"
            />
            <p className="text-xs text-gray-500 mt-0.5">
              Override técnico do helper calcularRepasse (Sub-Sprint F M30). Se vazio,
              backend usa TarifaConcessionaria vigente (TUSD + TE) como fallback.
            </p>
          </div>

          <div className="space-y-1">
            <Label htmlFor="observacoes">Observações</Label>
            <textarea
              id="observacoes"
              className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm"
              rows={3}
              value={form.observacoes}
              onChange={(e) => set('observacoes', e.target.value)}
              placeholder="Notas livres sobre a usina"
            />
          </div>

          {erro && <p className="text-sm text-red-600">{erro}</p>}
          {sucesso && <p className="text-sm text-green-600">{sucesso}</p>}

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={salvando}>
              {salvando ? 'Salvando...' : modo === 'criar' ? 'Cadastrar' : 'Salvar alterações'}
            </Button>
            {onCancelar && (
              <Button type="button" variant="outline" onClick={onCancelar}>
                Cancelar
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

/**
 * Helper: monta payload pro POST/PATCH backend a partir do form state.
 * Remove strings vazias e converte numéricos. Mantém regras condicionais
 * FIXO/PERCENTUAL/HIBRIDO consistentes com CreateUsinaDto.
 */
export function montarPayloadUsina(form: UsinaFormData): {
  payload: Record<string, unknown>;
  erro: string | null;
} {
  if (!form.nome.trim() || !form.potenciaKwp || !form.cidade.trim() || !form.estado.trim()) {
    return { payload: {}, erro: 'Nome, potência, cidade e estado são obrigatórios.' };
  }

  const potencia = parseFloat(form.potenciaKwp);
  if (isNaN(potencia) || potencia <= 0) {
    return { payload: {}, erro: 'Potência deve ser um número positivo.' };
  }

  const payload: Record<string, unknown> = {
    nome: form.nome,
    potenciaKwp: potencia,
    cidade: form.cidade,
    estado: form.estado,
  };

  if (form.capacidadeKwh) {
    const capacidade = parseFloat(form.capacidadeKwh);
    if (isNaN(capacidade) || capacidade < 0) {
      return { payload: {}, erro: 'Capacidade deve ser um número positivo.' };
    }
    payload.capacidadeKwh = capacidade;
  }

  if (form.producaoMensalKwh) {
    const prod = parseFloat(form.producaoMensalKwh);
    if (!isNaN(prod) && prod >= 0) payload.producaoMensalKwh = prod;
  }

  // Strings opcionais simples
  const opcionais: Array<keyof UsinaFormData> = [
    'apelidoInterno', 'enderecoLogradouro', 'enderecoNumero', 'enderecoBairro',
    'enderecoCep', 'distribuidora', 'cnpjUsina', 'numeroContratoEdp',
    'dataContratoEdp', 'classeGdAnotada', 'statusHomologacao', 'dataHomologacao',
    'dataInicioProducao', 'proprietarioNome', 'proprietarioCpfCnpj',
    'proprietarioTelefone', 'proprietarioEmail', 'proprietarioTipo',
    'modeloCobrancaOverride', 'politicaBandeira', 'observacoes',
    'formaAquisicao',
  ];
  for (const k of opcionais) {
    if (form[k]) payload[k] = form[k];
  }

  // Forma de pagamento com validação cruzada
  if (form.formaPagamentoDono) {
    payload.formaPagamentoDono = form.formaPagamentoDono;
    if (form.formaPagamentoDono === 'FIXO' || form.formaPagamentoDono === 'HIBRIDO') {
      const valor = parseFloat(form.valorAluguelFixo);
      if (isNaN(valor) || valor <= 0) {
        return { payload: {}, erro: `valorAluguelFixo é obrigatório (> 0) quando formaPagamentoDono = ${form.formaPagamentoDono}.` };
      }
      payload.valorAluguelFixo = valor;
    }
    if (form.formaPagamentoDono === 'PERCENTUAL' || form.formaPagamentoDono === 'HIBRIDO') {
      const pct = parseFloat(form.percentualGeracaoDono);
      if (isNaN(pct) || pct <= 0 || pct > 100) {
        return { payload: {}, erro: `percentualGeracaoDono deve ser entre 0,01 e 100 quando formaPagamentoDono = ${form.formaPagamentoDono}.` };
      }
      payload.percentualGeracaoDono = pct;
    }
  }

  if (form.valorKwhPadrao) {
    const v = parseFloat(form.valorKwhPadrao);
    if (!isNaN(v) && v > 0) payload.valorKwhPadrao = v;
  }

  return { payload, erro: null };
}
