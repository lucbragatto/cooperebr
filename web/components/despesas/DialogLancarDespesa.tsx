'use client';

/**
 * D-novo-BH BH.3 (M37, 29/05/2026) — Dialog reusável de lançamento/proposta de despesa.
 *
 * Modo controlado por prop `modo`:
 *   - 'admin-lancar': admin lança direto → backend cria APROVADA
 *   - 'proprietario-propor': proprietário propõe → backend cria PROPOSTA
 *
 * Submete pra POST /contas-pagar/propor (backend detecta role via JWT).
 *
 * Reuso futuro: BH.4 (tela portal proprietário).
 */

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Info, Loader2 } from 'lucide-react';
import api from '@/lib/api';

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

export interface DialogLancarDespesaProps {
  usinaId: string;
  modo: 'admin-lancar' | 'proprietario-propor';
  triggerNode: React.ReactNode;
  onSuccess: () => void;
}

export function DialogLancarDespesa({ usinaId, modo, triggerNode, onSuccess }: DialogLancarDespesaProps) {
  const [aberto, setAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const hoje = new Date().toISOString().slice(0, 10);

  const [dataOcorrencia, setDataOcorrencia] = useState(hoje);
  const [categoria, setCategoria] = useState('');
  const [valor, setValor] = useState('');
  const [descricao, setDescricao] = useState('');
  const [quemPagouTipo, setQuemPagouTipo] = useState('');
  const [quemPagouNome, setQuemPagouNome] = useState('');
  const [tratamento, setTratamento] = useState('');
  const [comprovante, setComprovante] = useState('');

  function resetForm() {
    setDataOcorrencia(hoje);
    setCategoria('');
    setValor('');
    setDescricao('');
    setQuemPagouTipo('');
    setQuemPagouNome('');
    setTratamento('');
    setComprovante('');
    setErro('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro('');

    if (!dataOcorrencia || !categoria || !valor || !descricao.trim() || !quemPagouTipo || !tratamento) {
      setErro('Preencha todos os campos obrigatórios.');
      return;
    }
    if (descricao.trim().length < 5) {
      setErro('Descrição deve ter ao menos 5 caracteres.');
      return;
    }
    const valorNum = parseFloat(valor);
    if (isNaN(valorNum) || valorNum <= 0) {
      setErro('Valor inválido.');
      return;
    }
    if (new Date(dataOcorrencia) > new Date()) {
      setErro('Data de ocorrência não pode ser no futuro.');
      return;
    }

    setSalvando(true);
    try {
      const payload: Record<string, unknown> = {
        usinaId,
        dataOcorrencia,
        categoria,
        valor: valorNum,
        descricao: descricao.trim(),
        quemPagouTipo,
        tratamento,
      };
      if (quemPagouTipo === 'TERCEIRO' && quemPagouNome.trim()) payload.quemPagouNome = quemPagouNome.trim();
      if (comprovante.trim()) payload.comprovante = comprovante.trim();

      await api.post('/contas-pagar/propor', payload);
      resetForm();
      setAberto(false);
      onSuccess();
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? 'Erro ao lançar despesa.';
      setErro(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger render={<span>{triggerNode}</span>} />
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {modo === 'admin-lancar' ? 'Lançar despesa operacional' : 'Propor despesa operacional'}
          </DialogTitle>
        </DialogHeader>

        <div className="bg-blue-50 border border-blue-200 rounded-md p-3 flex gap-2 my-2">
          <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <div className="text-xs text-blue-800">
            {modo === 'admin-lancar' ? (
              <>
                <strong>Lançamento direto:</strong> despesas lançadas por admin entram como <strong>APROVADAS</strong>.
                Para fluxo de aprovação, peça ao proprietário propor pelo portal dele.
              </>
            ) : (
              <>
                <strong>Proposta de despesa:</strong> sua proposta vai pro admin do parceiro aprovar ou rejeitar.
                Você recebe a resposta por email e WhatsApp.
              </>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="dataOcorrencia">Data ocorrência *</Label>
              <Input
                id="dataOcorrencia"
                type="date"
                value={dataOcorrencia}
                onChange={(e) => setDataOcorrencia(e.target.value)}
                max={hoje}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="valor">Valor R$ *</Label>
              <Input
                id="valor"
                type="number"
                step="0.01"
                min="0.01"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="1500.00"
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="categoria">Categoria *</Label>
            <select
              id="categoria"
              className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm"
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              required
            >
              <option value="">— Selecione —</option>
              {CATEGORIAS.map((c) => (
                <option key={c} value={c}>{CATEGORIAS_LABEL[c] ?? c}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="descricao">Descrição *</Label>
            <textarea
              id="descricao"
              className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm"
              rows={3}
              minLength={5}
              maxLength={500}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex: Troca de inversor avariado por descarga atmosférica em 27/05"
              required
            />
            <p className="text-[10px] text-gray-400">{descricao.length}/500 caracteres</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="quemPagouTipo">Quem pagou? *</Label>
              <select
                id="quemPagouTipo"
                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm"
                value={quemPagouTipo}
                onChange={(e) => setQuemPagouTipo(e.target.value)}
                required
              >
                <option value="">— Selecione —</option>
                <option value="PARCEIRO">Cooperativa (parceiro)</option>
                <option value="PROPRIETARIO">Proprietário (dono)</option>
                <option value="COMPARTILHADO">Compartilhado</option>
                <option value="TERCEIRO">Terceiro</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="tratamento">Tratamento *</Label>
              <select
                id="tratamento"
                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm"
                value={tratamento}
                onChange={(e) => setTratamento(e.target.value)}
                required
              >
                <option value="">— Selecione —</option>
                <option value="REEMBOLSO">Reembolso</option>
                <option value="DESCONTO_NO_REPASSE">Desconto no repasse</option>
                <option value="ASSUMIDO">Assumido (sem reembolso/desconto)</option>
              </select>
            </div>
          </div>

          {quemPagouTipo === 'TERCEIRO' && (
            <div className="space-y-1">
              <Label htmlFor="quemPagouNome">Nome do terceiro</Label>
              <Input
                id="quemPagouNome"
                value={quemPagouNome}
                onChange={(e) => setQuemPagouNome(e.target.value)}
                placeholder="Ex: Empresa X de Manutenção"
              />
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="comprovante">Comprovante (URL)</Label>
            <Input
              id="comprovante"
              type="url"
              value={comprovante}
              onChange={(e) => setComprovante(e.target.value)}
              placeholder="https://drive.google.com/... (opcional)"
            />
            <p className="text-[10px] text-gray-400">Upload nativo virá futuramente (D-novo-BI).</p>
          </div>

          {erro && <p className="text-sm text-red-600">{erro}</p>}

          <DialogFooter className="flex gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => { resetForm(); setAberto(false); }}>
              Cancelar
            </Button>
            <Button type="submit" disabled={salvando} className="bg-amber-600 hover:bg-amber-700">
              {salvando ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {modo === 'admin-lancar' ? 'Lançar' : 'Propor'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
