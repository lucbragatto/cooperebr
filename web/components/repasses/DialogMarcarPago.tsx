'use client';

/**
 * D-novo-AN AN.3 (M42, 30/05/2026) — Dialog Tipo C "Marcar pago".
 *
 * Padrão UX Dual 17/05: ação focada com lógica de negócio (3 campos: método +
 * data + comprovante opcional) → Dialog é a forma correta (não Tipo B).
 *
 * `<select>` nativo Tailwind por causa do z-index Shadcn dentro de Dialog
 * (regra 19/05 `solucao_select_nativo_dentro_dialog_19_05`).
 */

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UploadComprovante } from '@/components/despesas/UploadComprovante';
import api from '@/lib/api';
import { fmtMoney, METODOS, type MetodoPagamentoRepasse, type Repasse } from './types';

interface DialogMarcarPagoProps {
  repasse: Repasse;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
}

export function DialogMarcarPago({ repasse, open, onOpenChange, onSuccess }: DialogMarcarPagoProps) {
  const [metodo, setMetodo] = useState<MetodoPagamentoRepasse | ''>('');
  const [dataPagamento, setDataPagamento] = useState(new Date().toISOString().slice(0, 10));
  const [comprovante, setComprovante] = useState<string | undefined>(undefined);
  const [observacao, setObservacao] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const hoje = new Date().toISOString().slice(0, 10);
  const obsObrigatoria = metodo === 'OUTRO';

  async function handleSubmit() {
    setErro('');
    if (!metodo) {
      setErro('Selecione o método de pagamento.');
      return;
    }
    if (!dataPagamento) {
      setErro('Informe a data do pagamento.');
      return;
    }
    if (obsObrigatoria && !observacao.trim()) {
      setErro('Observação obrigatória quando método = Outro.');
      return;
    }

    setSalvando(true);
    try {
      await api.put(`/repasses/${repasse.id}/marcar-pago`, {
        metodoPagamento: metodo,
        dataPagamento,
        comprovante: comprovante ?? undefined,
        observacao: observacao.trim() || undefined,
      });
      onSuccess();
      // Reset
      setMetodo('');
      setDataPagamento(new Date().toISOString().slice(0, 10));
      setComprovante(undefined);
      setObservacao('');
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? 'Falha ao marcar pago.';
      setErro(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Marcar repasse como pago</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-sm text-blue-900">
            Valor líquido a pagar: <strong>{fmtMoney(repasse.valorLiquido)}</strong>
            {repasse.totalDespesasAbatidas > 0 && (
              <span className="text-xs text-blue-700 ml-2">
                (bruto {fmtMoney(repasse.valorBruto)} − despesas {fmtMoney(repasse.totalDespesasAbatidas)})
              </span>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="metodo">Método de pagamento *</Label>
            <select
              id="metodo"
              className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm"
              value={metodo}
              onChange={(e) => setMetodo(e.target.value as MetodoPagamentoRepasse)}
              required
            >
              <option value="">— Selecione —</option>
              {METODOS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="dataPagamento">Data do pagamento *</Label>
            <Input
              id="dataPagamento"
              type="date"
              max={hoje}
              value={dataPagamento}
              onChange={(e) => setDataPagamento(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1">
            <Label>Comprovante (opcional)</Label>
            <UploadComprovante
              valor={comprovante}
              onChange={(url) => setComprovante(url)}
              endpoint="/repasses/upload-comprovante"
              disabled={salvando}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="observacao">
              Observação {obsObrigatoria && <span className="text-red-600">*</span>}
            </Label>
            <textarea
              id="observacao"
              className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm"
              rows={2}
              maxLength={500}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder={obsObrigatoria ? 'Descreva o método (cheque #X, depósito conta Y, etc.)' : 'Notas opcionais'}
              required={obsObrigatoria}
            />
          </div>

          {erro && (
            <p className="text-sm text-red-600">{erro}</p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={salvando} className="bg-green-600 hover:bg-green-700">
            {salvando && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Confirmar pagamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
