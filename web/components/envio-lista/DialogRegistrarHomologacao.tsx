'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';

type StatusHomolog = 'HOMOLOGADO' | 'REJEITADO';

interface Props {
  aberto: boolean;
  onClose: () => void;
  envioId: string;
  cooperadoId: string;
  cooperadoNome: string;
  onSuccess: () => void;
}

export default function DialogRegistrarHomologacao({
  aberto, onClose, envioId, cooperadoId, cooperadoNome, onSuccess,
}: Props) {
  const hojeIso = new Date().toISOString().slice(0, 10);
  const [status, setStatus] = useState<StatusHomolog>('HOMOLOGADO');
  const [data, setData] = useState(hojeIso);
  const [obs, setObs] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (aberto) {
      setStatus('HOMOLOGADO');
      setData(hojeIso);
      setObs('');
      setErro('');
    }
  }, [aberto, hojeIso]);

  async function confirmar() {
    setEnviando(true);
    setErro('');
    try {
      await api.post(`/envios-lista/${envioId}/homologar/${cooperadoId}`, {
        statusIndividual: status,
        dataHomologacao: data ? new Date(data).toISOString() : undefined,
        observacao: obs || undefined,
      });
      onSuccess();
      onClose();
    } catch (e: any) {
      setErro(e?.response?.data?.message || 'Erro ao registrar homologação.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Registrar homologação — {cooperadoNome}</DialogTitle></DialogHeader>

        {erro && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded p-2">{erro}</div>}

        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium block mb-1">Resultado da concessionária</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="status"
                  checked={status === 'HOMOLOGADO'}
                  onChange={() => setStatus('HOMOLOGADO')}
                />
                <span className="text-green-700 font-medium">Homologado</span>
              </label>
              <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="status"
                  checked={status === 'REJEITADO'}
                  onChange={() => setStatus('REJEITADO')}
                />
                <span className="text-red-700 font-medium">Rejeitado</span>
              </label>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Data da homologação</label>
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Observação (opcional)</label>
            <Textarea
              rows={2}
              placeholder="Ex: motivo da rejeição, número do retorno EDP..."
              value={obs}
              onChange={(e) => setObs(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={enviando}>Cancelar</Button>
          <Button onClick={confirmar} disabled={enviando}>
            {enviando && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
