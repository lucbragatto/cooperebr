'use client';

import { useState } from 'react';
import api from '@/lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';

type Canal = 'email' | 'portal' | 'fisico';

interface Props {
  aberto: boolean;
  onClose: () => void;
  envioId: string;
  numeroInterno: string;
  onSuccess: () => void;
}

export default function DialogMarcarEnviado({ aberto, onClose, envioId, numeroInterno, onSuccess }: Props) {
  const [canal, setCanal] = useState<Canal>('email');
  const [obs, setObs] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  async function confirmar() {
    setEnviando(true);
    setErro('');
    try {
      await api.patch(`/envios-lista/${envioId}/marcar-enviado`, {
        canalEnvio: canal,
        observacoes: obs || undefined,
      });
      setObs('');
      onSuccess();
      onClose();
    } catch (e: any) {
      setErro(e?.response?.data?.message || 'Erro ao marcar como enviado.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Marcar {numeroInterno} como enviado</DialogTitle></DialogHeader>
        <p className="text-xs text-gray-500">Registra que você enviou a lista manualmente para a concessionária. Selecione o canal usado.</p>

        {erro && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded p-2">{erro}</div>}

        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium block mb-1">Canal de envio</label>
            <div className="flex gap-3">
              {(['email', 'portal', 'fisico'] as Canal[]).map((c) => (
                <label key={c} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="canal"
                    checked={canal === c}
                    onChange={() => setCanal(c)}
                  />
                  {c === 'email' ? 'Email' : c === 'portal' ? 'Portal EDP' : 'Físico'}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Observações (opcional)</label>
            <Textarea
              rows={3}
              placeholder="Ex: enviado via formulário do portal EDP, destinatário fulano@edp.com.br..."
              value={obs}
              onChange={(e) => setObs(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={enviando}>Cancelar</Button>
          <Button onClick={confirmar} disabled={enviando}>
            {enviando && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Confirmar envio
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
