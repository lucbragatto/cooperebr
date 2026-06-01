'use client';

/**
 * D-novo-PUX-A.2 (01/06/2026) — ConvenioForm reusável (criar + editar).
 *
 * Padrão Dual 17/05 Tipo B (entidade inteira → página própria).
 * Substitui o Dialog "Novo convênio" + "Editar" da página da lista.
 *
 * Select NATIVO (regra 19/05 — Shadcn Select dentro de wrapper quebra
 * z-index; mesmo fora de Dialog, mantemos nativo pra consistência).
 */

import { useState, FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

export const FLUXOS_CONVENIO = [
  { value: 'INGRESSO_CUSTEIO_AUXILIAR', label: 'Ingresso (custeio recebido pela cooperativa)' },
  { value: 'REPASSE_PROVEDOR_EXTERNO', label: 'Repasse (saída pra provedor externo)' },
  { value: 'CUSTO_OPERACIONAL_INTERNO', label: 'Custo operacional interno' },
] as const;

export interface ConvenioFormData {
  nome: string;
  descricao: string;
  fluxoFinanceiro: string;
  classificacaoFiscal: string;
  vigenciaInicio: string;
  vigenciaFim: string;
}

interface ConvenioFormProps {
  /** Dados iniciais (criação = vazio; edição = preenche) */
  inicial?: Partial<ConvenioFormData>;
  /** Submit assíncrono — joga ConvenioFormData saneado */
  onSubmit: (dados: ConvenioFormData) => Promise<void>;
  /** Callback de cancelar (geralmente router.back()) */
  onCancel: () => void;
  /** Texto do botão primário ("Criar convênio" | "Salvar alterações") */
  textoSubmit?: string;
}

export function ConvenioForm({
  inicial,
  onSubmit,
  onCancel,
  textoSubmit = 'Salvar',
}: ConvenioFormProps) {
  const [form, setForm] = useState<ConvenioFormData>({
    nome: inicial?.nome ?? '',
    descricao: inicial?.descricao ?? '',
    fluxoFinanceiro: inicial?.fluxoFinanceiro ?? 'INGRESSO_CUSTEIO_AUXILIAR',
    classificacaoFiscal:
      inicial?.classificacaoFiscal ?? 'Ato Auxiliar Art. 88 Lei 5.764/71 + STF Tema 536',
    vigenciaInicio: inicial?.vigenciaInicio ?? new Date().toISOString().slice(0, 10),
    vigenciaFim: inicial?.vigenciaFim ?? '',
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro('');
    if (!form.nome.trim()) {
      setErro('Nome é obrigatório.');
      return;
    }
    if (!form.classificacaoFiscal.trim()) {
      setErro('Classificação fiscal é obrigatória.');
      return;
    }
    if (!form.vigenciaInicio) {
      setErro('Vigência início é obrigatória.');
      return;
    }

    setSalvando(true);
    try {
      await onSubmit({
        nome: form.nome.trim(),
        descricao: form.descricao.trim(),
        fluxoFinanceiro: form.fluxoFinanceiro,
        classificacaoFiscal: form.classificacaoFiscal.trim(),
        vigenciaInicio: form.vigenciaInicio,
        vigenciaFim: form.vigenciaFim,
      });
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.message ?? 'Falha ao salvar convênio';
      setErro(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
      <div>
        <Label htmlFor="nome">Nome *</Label>
        <Input
          id="nome"
          value={form.nome}
          onChange={(e) => setForm({ ...form, nome: e.target.value })}
          placeholder="Ex: Convênio EDP ES Custeio Solar 2026"
          required
          maxLength={120}
        />
      </div>

      <div>
        <Label htmlFor="descricao">Descrição</Label>
        <Input
          id="descricao"
          value={form.descricao}
          onChange={(e) => setForm({ ...form, descricao: e.target.value })}
          placeholder="Detalhes do convênio (opcional)"
          maxLength={500}
        />
      </div>

      <div>
        <Label htmlFor="fluxoFinanceiro">Fluxo financeiro *</Label>
        <select
          id="fluxoFinanceiro"
          value={form.fluxoFinanceiro}
          onChange={(e) => setForm({ ...form, fluxoFinanceiro: e.target.value })}
          className="w-full border rounded px-2 py-1.5 text-sm"
          required
        >
          {FLUXOS_CONVENIO.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-500 mt-1">
          Define como o convênio entra na contabilidade — todos viram lançamento "auxiliar".
        </p>
      </div>

      <div>
        <Label htmlFor="classificacaoFiscal">Classificação fiscal *</Label>
        <Input
          id="classificacaoFiscal"
          value={form.classificacaoFiscal}
          onChange={(e) => setForm({ ...form, classificacaoFiscal: e.target.value })}
          required
          maxLength={300}
        />
        <p className="text-xs text-gray-500 mt-1">
          Cite o fundamento legal — ex: "Ato Auxiliar Art. 88 Lei 5.764/71 + STF Tema 536".
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="vigenciaInicio">Vigência início *</Label>
          <Input
            id="vigenciaInicio"
            type="date"
            value={form.vigenciaInicio}
            onChange={(e) => setForm({ ...form, vigenciaInicio: e.target.value })}
            required
          />
        </div>
        <div>
          <Label htmlFor="vigenciaFim">Vigência fim</Label>
          <Input
            id="vigenciaFim"
            type="date"
            value={form.vigenciaFim}
            onChange={(e) => setForm({ ...form, vigenciaFim: e.target.value })}
          />
        </div>
      </div>

      {erro && (
        <div className="bg-red-50 border-l-4 border-red-500 p-3 text-sm text-red-700 rounded">
          {erro}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2 border-t">
        <Button type="button" variant="outline" onClick={onCancel} disabled={salvando}>
          Voltar
        </Button>
        <Button type="submit" disabled={salvando} className="bg-cyan-700 hover:bg-cyan-800">
          {salvando && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
          {textoSubmit}
        </Button>
      </div>
    </form>
  );
}
