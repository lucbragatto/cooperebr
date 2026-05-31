'use client';

/**
 * D-novo-BR-CT estorno (31/05/2026 noite) — Dialog Tipo C "Estornar repasse PAGO".
 *
 * Padrão UX Dual 17/05: ação focada — motivo textarea required (≥10 chars).
 * Mensagem clara quando apuração está FECHADA: instrui reabrir antes.
 */

import { useState } from 'react';
import { Loader2, RotateCcw, AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import api from '@/lib/api';
import { type Repasse } from './types';

interface DialogEstornarProps {
  repasse: Repasse;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
}

export function DialogEstornar({ repasse, open, onOpenChange, onSuccess }: DialogEstornarProps) {
  const [motivo, setMotivo] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  async function handleSubmit() {
    setErro('');
    if (!motivo.trim() || motivo.trim().length < 10) {
      setErro('Motivo é obrigatório (mínimo 10 caracteres — auditoria contábil).');
      return;
    }
    setSalvando(true);
    try {
      await api.put(`/repasses/${repasse.id}/estornar`, { motivo: motivo.trim() });
      onSuccess();
      setMotivo('');
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? 'Falha ao estornar.';
      setErro(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="h-4 w-4 text-amber-700" />
            Estornar repasse PAGO
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-300 rounded-md p-3 flex gap-2 text-sm text-amber-900">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <strong>O que acontece ao estornar:</strong>
              <ul className="list-disc list-inside mt-1 text-xs space-y-0.5">
                <li>Status volta para <strong>PENDENTE</strong> (pode ser remarcado pago depois)</li>
                <li>Lançamento contábil gerado é <strong>deletado</strong></li>
                <li>Despesas abatidas <strong>voltam pra PENDENTE</strong> (desvincula)</li>
              </ul>
              <p className="mt-2 text-xs">
                ⚠️ Se a apuração do mês de pagamento estiver <strong>FECHADA</strong>, o estorno é bloqueado
                — reabra primeiro (Super Admin).
              </p>
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="motivo-estorno">Motivo *</Label>
            <textarea
              id="motivo-estorno"
              className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm"
              rows={3}
              minLength={10}
              maxLength={500}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex: Erro de digitação na data de pagamento — comprovante real é de outro mês."
              required
            />
            <p className="text-[10px] text-gray-400">{motivo.length}/500 (mínimo 10)</p>
          </div>

          {erro && (
            <div className="bg-red-50 border-l-4 border-red-500 p-3 text-sm text-red-700 rounded">
              {erro}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>
            Voltar
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={salvando}
            className="bg-amber-700 hover:bg-amber-800"
          >
            {salvando && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Confirmar estorno
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
