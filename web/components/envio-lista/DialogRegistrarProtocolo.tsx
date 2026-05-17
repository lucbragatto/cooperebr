'use client';

import { useState } from 'react';
import api from '@/lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';

interface Props {
  aberto: boolean;
  onClose: () => void;
  envioId: string;
  numeroInterno: string;
  onSuccess: () => void;
}

export default function DialogRegistrarProtocolo({ aberto, onClose, envioId, numeroInterno, onSuccess }: Props) {
  const hojeIso = new Date().toISOString().slice(0, 10);
  const [numero, setNumero] = useState('');
  const [data, setData] = useState(hojeIso);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  async function confirmar() {
    if (!numero.trim()) {
      setErro('Número de protocolo é obrigatório.');
      return;
    }
    setEnviando(true);
    setErro('');
    try {
      await api.post(`/envios-lista/${envioId}/protocolo`, {
        numeroProtocoloConcessionaria: numero.trim(),
        dataProtocolo: data ? new Date(data).toISOString() : undefined,
      });
      setNumero('');
      setData(hojeIso);
      onSuccess();
      onClose();
    } catch (e: any) {
      setErro(e?.response?.data?.message || 'Erro ao registrar protocolo.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Registrar protocolo — {numeroInterno}</DialogTitle></DialogHeader>
        <p className="text-xs text-gray-500">Registra o número de protocolo devolvido pela concessionária.</p>

        {erro && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded p-2">{erro}</div>}

        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium block mb-1">Número do protocolo *</label>
            <Input
              type="text"
              placeholder="Ex: EDP-2026-12345"
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Data do protocolo</label>
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={enviando}>Cancelar</Button>
          <Button onClick={confirmar} disabled={enviando || !numero.trim()}>
            {enviando && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
