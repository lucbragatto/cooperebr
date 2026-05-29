'use client';

/**
 * D-novo-BH BH.3.1 (M37, 29/05/2026) — Form reusável de lançamento/proposta de despesa.
 *
 * Substitui o DialogLancarDespesa (refator UX Padrão Dual Tipo B — entidade
 * inteira → página própria). Layout vertical com Valor em destaque.
 *
 * Modos:
 *   - 'admin-lancar'         → backend cria APROVADA direto (botão: Lançar)
 *   - 'proprietario-propor'  → backend cria PROPOSTA (botão: Propor) — BH.4
 *   - 'editar'               → reservado pra BH.3.3 futuro
 */

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Info, Loader2 } from 'lucide-react';
import { UploadComprovante } from './UploadComprovante';

export const CATEGORIAS = [
  'CUSD',
  'MANUTENCAO_PREVENTIVA',
  'MANUTENCAO_CORRETIVA',
  'ROCADA',
  'VIGILANCIA',
  'SEGURO',
  'IPTU_ITR',
  'CONSUMO_AUXILIAR',
  'INTERNET',
  'ACOMPANHAMENTO_TECNICO',
  'EQUIPAMENTOS',
  'ARRENDAMENTO_USINA',
  'MANUTENCAO',
  'SALARIO',
  'OUTRO',
] as const;

const CATEGORIAS_LABEL: Record<string, string> = {
  CUSD: 'CUSD (uso do sistema distribuição)',
  MANUTENCAO_PREVENTIVA: 'Manutenção preventiva',
  MANUTENCAO_CORRETIVA: 'Manutenção corretiva',
  ROCADA: 'Roçada',
  VIGILANCIA: 'Vigilância',
  SEGURO: 'Seguro',
  IPTU_ITR: 'IPTU / ITR',
  CONSUMO_AUXILIAR: 'Consumo auxiliar (escritório/monitoramento)',
  INTERNET: 'Internet',
  ACOMPANHAMENTO_TECNICO: 'Acompanhamento técnico',
  EQUIPAMENTOS: 'Equipamentos (inversor/módulos)',
  ARRENDAMENTO_USINA: 'Arrendamento da usina',
  MANUTENCAO: 'Manutenção (genérica)',
  SALARIO: 'Salário',
  OUTRO: 'Outro',
};

export interface DespesaFormData {
  dataOcorrencia: string;
  categoria: string;
  valor: string;
  descricao: string;
  quemPagouTipo: string;
  quemPagouNome: string;
  tratamento: string;
  comprovante: string;
}

export interface DespesaFormProps {
  usinaId: string;
  modo: 'admin-lancar' | 'proprietario-propor' | 'editar';
  valoresIniciais?: Partial<DespesaFormData>;
  matrizCamada1?: Record<string, string>;
  onSubmit: (dados: DespesaFormData) => Promise<void>;
  onCancelar?: () => void;
}

const VALORES_VAZIOS: DespesaFormData = {
  dataOcorrencia: new Date().toISOString().slice(0, 10),
  categoria: '',
  valor: '',
  descricao: '',
  quemPagouTipo: '',
  quemPagouNome: '',
  tratamento: '',
  comprovante: '',
};

export function DespesaForm({
  modo,
  valoresIniciais,
  matrizCamada1,
  onSubmit,
  onCancelar,
}: DespesaFormProps) {
  const [form, setForm] = useState<DespesaFormData>({ ...VALORES_VAZIOS, ...valoresIniciais });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const hoje = new Date().toISOString().slice(0, 10);

  function set<K extends keyof DespesaFormData>(field: K, value: DespesaFormData[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  // Helper: quando admin escolhe categoria, mostra dica de quem é o responsável contratual (Camada 1)
  const responsavelContratual = form.categoria && matrizCamada1 ? matrizCamada1[form.categoria] : '';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro('');

    if (!form.dataOcorrencia || !form.categoria || !form.valor || !form.descricao.trim() || !form.quemPagouTipo || !form.tratamento) {
      setErro('Preencha todos os campos obrigatórios (marcados com *).');
      return;
    }
    if (form.descricao.trim().length < 5) {
      setErro('Descrição precisa ter ao menos 5 caracteres.');
      return;
    }
    const valorNum = parseFloat(form.valor);
    if (isNaN(valorNum) || valorNum <= 0) {
      setErro('Valor inválido.');
      return;
    }
    if (new Date(form.dataOcorrencia) > new Date()) {
      setErro('Data de ocorrência não pode ser no futuro.');
      return;
    }

    setSalvando(true);
    try {
      await onSubmit(form);
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? 'Erro ao salvar despesa.';
      setErro(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setSalvando(false);
    }
  }

  const tituloBotao =
    modo === 'admin-lancar' ? 'Lançar despesa' : modo === 'proprietario-propor' ? 'Propor despesa' : 'Salvar alterações';

  return (
    <Card className="max-w-2xl">
      <CardContent className="pt-6">
        <div className="bg-blue-50 border border-blue-200 rounded-md p-3 flex gap-2 mb-4">
          <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            {modo === 'admin-lancar' && (
              <>
                <strong>Lançamento direto:</strong> despesas lançadas por admin entram como{' '}
                <strong>APROVADAS</strong>. Para fluxo de aprovação, peça ao proprietário propor pelo portal dele.
              </>
            )}
            {modo === 'proprietario-propor' && (
              <>
                <strong>Proposta de despesa:</strong> sua proposta vai pro admin do parceiro aprovar ou rejeitar.
                Você recebe a resposta por email e WhatsApp.
              </>
            )}
            {modo === 'editar' && <strong>Edição de despesa</strong>}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Data — sozinha em row */}
          <div className="space-y-1 max-w-xs">
            <Label htmlFor="dataOcorrencia">Data de ocorrência *</Label>
            <Input
              id="dataOcorrencia"
              type="date"
              value={form.dataOcorrencia}
              onChange={(e) => set('dataOcorrencia', e.target.value)}
              max={hoje}
              required
            />
          </div>

          {/* Valor — destaque text-lg w-full */}
          <div className="space-y-1">
            <Label htmlFor="valor" className="text-base">Valor R$ *</Label>
            <Input
              id="valor"
              type="number"
              step="0.01"
              min="0.01"
              value={form.valor}
              onChange={(e) => set('valor', e.target.value)}
              placeholder="0,00"
              className="text-lg font-semibold"
              required
            />
          </div>

          {/* Categoria */}
          <div className="space-y-1">
            <Label htmlFor="categoria">Categoria *</Label>
            <select
              id="categoria"
              className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm"
              value={form.categoria}
              onChange={(e) => set('categoria', e.target.value)}
              required
            >
              <option value="">— Selecione —</option>
              {CATEGORIAS.map((c) => (
                <option key={c} value={c}>{CATEGORIAS_LABEL[c] ?? c}</option>
              ))}
            </select>
            {responsavelContratual && (
              <p className="text-xs text-blue-700 mt-1">
                💡 Camada 1 (contrato): <strong>{responsavelContratual}</strong> é o responsável contratual por esta categoria.
              </p>
            )}
          </div>

          {/* Descrição */}
          <div className="space-y-1">
            <Label htmlFor="descricao">Descrição *</Label>
            <textarea
              id="descricao"
              className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm"
              rows={3}
              minLength={5}
              maxLength={500}
              value={form.descricao}
              onChange={(e) => set('descricao', e.target.value)}
              placeholder="Ex: Troca de inversor avariado por descarga atmosférica em 27/05"
              required
            />
            <p className="text-[10px] text-gray-400">{form.descricao.length}/500 caracteres</p>
          </div>

          {/* Quem pagou + Nome (condicional) */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="quemPagouTipo">Quem pagou? *</Label>
              <select
                id="quemPagouTipo"
                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm"
                value={form.quemPagouTipo}
                onChange={(e) => set('quemPagouTipo', e.target.value)}
                required
              >
                <option value="">— Selecione —</option>
                <option value="PARCEIRO">Cooperativa (parceiro)</option>
                <option value="PROPRIETARIO">Proprietário (dono)</option>
                <option value="COMPARTILHADO">Compartilhado</option>
                <option value="TERCEIRO">Terceiro</option>
              </select>
            </div>
            {form.quemPagouTipo === 'TERCEIRO' && (
              <div className="space-y-1">
                <Label htmlFor="quemPagouNome">Nome do terceiro</Label>
                <Input
                  id="quemPagouNome"
                  value={form.quemPagouNome}
                  onChange={(e) => set('quemPagouNome', e.target.value)}
                  placeholder="Ex: Empresa X de Manutenção"
                />
              </div>
            )}
          </div>

          {/* Tratamento */}
          <div className="space-y-1">
            <Label htmlFor="tratamento">Tratamento *</Label>
            <select
              id="tratamento"
              className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm"
              value={form.tratamento}
              onChange={(e) => set('tratamento', e.target.value)}
              required
            >
              <option value="">— Selecione —</option>
              <option value="REEMBOLSO">Reembolso</option>
              <option value="DESCONTO_NO_REPASSE">Desconto no próximo repasse</option>
              <option value="ASSUMIDO">Assumido (sem reembolso/desconto)</option>
            </select>
          </div>

          {/* Comprovante — upload nativo */}
          <div className="space-y-1">
            <Label>Comprovante (opcional)</Label>
            <UploadComprovante
              valor={form.comprovante}
              onChange={(url) => set('comprovante', url ?? '')}
            />
          </div>

          {erro && <p className="text-sm text-red-600">{erro}</p>}

          <div className="flex gap-3 pt-2">
            <Button
              type="submit"
              disabled={salvando}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {salvando ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {tituloBotao}
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
