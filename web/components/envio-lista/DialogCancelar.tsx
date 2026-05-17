'use client';

import { useState } from 'react';
import api from '@/lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, AlertTriangle } from 'lucide-react';

interface Props {
  aberto: boolean;
  onClose: () => void;
  envioId: string;
  numeroInterno: string;
  onSuccess: () => void;
}

export default function DialogCancelar({ aberto, onClose, envioId, numeroInterno, onSuccess }: Props) {
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  async function confirmar() {
    setEnviando(true);
    setErro('');
    try {
      await api.patch(`/envios-lista/${envioId}/cancelar`, { motivo: motivo || undefined });
      setMotivo('');
      onSuccess();
      onClose();
    } catch (e: any) {
      setErro(e?.response?.data?.message || 'Erro ao cancelar envio.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Cancelar envio {numeroInterno}</DialogTitle></DialogHeader>

        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded p-3 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>Esta ação não pode ser desfeita. O envio será marcado como CANCELADA e ficará disponível no histórico apenas para consulta.</span>
        </div>

        {erro && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded p-2">{erro}</div>}

        <div>
          <label className="text-sm font-medium block mb-1">Motivo (opcional)</label>
          <Textarea
            rows={3}
            placeholder="Ex: lista incorreta, ajuste de cooperados necessário, retificação solicitada..."
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={enviando}>Voltar</Button>
          <Button onClick={confirmar} disabled={enviando} className="bg-red-600 hover:bg-red-700">
            {enviando && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Cancelar envio
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
