'use client';

/**
 * D-novo-AN AN.3 (M42, 30/05/2026) — Dialog Tipo C "Cancelar repasse".
 *
 * Padrão UX Dual 17/05: ação focada — só motivo textarea required.
 */

import { useState } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import api from '@/lib/api';
import { type Repasse } from './types';

interface DialogCancelarProps {
  repasse: Repasse;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
}

export function DialogCancelar({ repasse, open, onOpenChange, onSuccess }: DialogCancelarProps) {
  const [motivo, setMotivo] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  async function handleSubmit() {
    setErro('');
    if (!motivo.trim()) {
      setErro('Motivo do cancelamento é obrigatório.');
      return;
    }
    if (motivo.trim().length < 5) {
      setErro('Motivo precisa ter ao menos 5 caracteres.');
      return;
    }

    setSalvando(true);
    try {
      await api.put(`/repasses/${repasse.id}/cancelar`, { motivo: motivo.trim() });
      onSuccess();
      setMotivo('');
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? 'Falha ao cancelar.';
      setErro(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancelar repasse</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-300 rounded-md p-3 flex gap-2 text-sm text-amber-900">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              Esta ação <strong>não desvincula</strong> despesas já abatidas. Use só quando o pagamento
              não vai mais acontecer (contestação, contrato encerrado, acerto fora do sistema).
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="motivo">Motivo *</Label>
            <textarea
              id="motivo"
              className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm"
              rows={3}
              minLength={5}
              maxLength={500}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex: Contrato encerrado em 30/04 — repasse não se aplica mais."
              required
            />
            <p className="text-[10px] text-gray-400">{motivo.length}/500</p>
          </div>

          {erro && <p className="text-sm text-red-600">{erro}</p>}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>
            Voltar
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={salvando}
            className="bg-red-600 hover:bg-red-700"
          >
            {salvando && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Cancelar repasse
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
