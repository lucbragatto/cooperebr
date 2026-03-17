'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';

interface EntradaEspera {
  id: string;
  posicao: number;
  kwhNecessario: number | string;
  status: string;
  createdAt: string;
  cooperado: { id: string; nomeCompleto: string; email: string };
  contrato: { numero: string; status: string } | null;
}

interface Usina {
  id: string;
  nome: string;
  capacidadeKwh: number | string | null;
  cidade: string;
  estado: string;
}

export default function ListaEsperaPage() {
  const [lista, setLista] = useState<EntradaEspera[]>([]);
  const [usinas, setUsinas] = useState<Usina[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [dialogAlocar, setDialogAlocar] = useState<EntradaEspera | null>(null);
  const [usinaEscolhida, setUsinaEscolhida] = useState('');
  const [toast, setToast] = useState<{ tipo: 'sucesso' | 'erro'; mensagem: string } | null>(null);

  function showToast(tipo: 'sucesso' | 'erro', mensagem: string) {
    setToast({ tipo, mensagem });
    setTimeout(() => setToast(null), 3000);
  }

  useEffect(() => {
    Promise.all([
      api.get<EntradaEspera[]>('/motor-proposta/lista-espera'),
      api.get<Usina[]>('/usinas').catch(() => ({ data: [] as Usina[] })),
    ])
      .then(([listaResp, usinasResp]) => {
        setLista(listaResp.data);
        setUsinas(usinasResp.data);
      })
      .finally(() => setCarregando(false));
  }, []);

  async function alocar() {
    if (!dialogAlocar || !usinaEscolhida) return;
    setSalvando(true);
    try {
      await api.post(`/motor-proposta/lista-espera/${dialogAlocar.id}/alocar`, { usinaId: usinaEscolhida });
      setLista(prev => prev.filter(e => e.id !== dialogAlocar.id));
      setDialogAlocar(null);
      setUsinaEscolhida('');
      showToast('sucesso', `Cooperado alocado com sucesso.`);
    } catch {
      showToast('erro', 'Erro ao alocar cooperado.');
    } finally {
      setSalvando(false);
    }
  }

  const cls = 'w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500';

  return (
    <div className="max-w-5xl space-y-5">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg border text-sm font-medium shadow-lg ${toast.tipo === 'sucesso' ? 'bg-green-50 text-green-800 border-green-200' : 'bg-red-50 text-red-800 border-red-200'}`}>
          {toast.mensagem}
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Lista de Espera</h1>
        <p className="text-sm text-gray-500 mt-1">Cooperados aguardando vaga em usina.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span>Fila de espera</span>
            <Badge variant="outline">{lista.length} aguardando</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {carregando ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : lista.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12">
              <p className="text-gray-500">Nenhum cooperado na lista de espera.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b bg-gray-50">
                <tr>
                  <th className="text-center px-4 py-3 text-xs text-gray-500 font-medium w-12">#</th>
                  <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Cooperado</th>
                  <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Contrato</th>
                  <th className="text-right px-4 py-3 text-xs text-gray-500 font-medium">kWh necessário</th>
                  <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Data entrada</th>
                  <th className="text-right px-4 py-3 text-xs text-gray-500 font-medium">Ação</th>
                </tr>
              </thead>
              <tbody>
                {lista.map(e => (
                  <tr key={e.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3 text-center font-bold text-gray-600">{e.posicao}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">{e.cooperado.nomeCompleto}</p>
                      <p className="text-xs text-gray-400">{e.cooperado.email}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{e.contrato?.numero ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-mono">
                      {Number(e.kwhNecessario).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kWh
                    </td>
                    <td className="px-4 py-3 text-gray-500">{new Date(e.createdAt).toLocaleDateString('pt-BR')}</td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" onClick={() => { setUsinaEscolhida(''); setDialogAlocar(e); }}>
                        Alocar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!dialogAlocar} onOpenChange={v => !v && setDialogAlocar(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alocar em usina</DialogTitle>
            <DialogDescription>
              Selecione a usina para alocar {dialogAlocar?.cooperado.nomeCompleto}.
              kWh necessário: {dialogAlocar && Number(dialogAlocar.kwhNecessario).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <label className="block text-xs text-gray-500 mb-0.5">Usina</label>
            <select className={cls} value={usinaEscolhida} onChange={e => setUsinaEscolhida(e.target.value)}>
              <option value="">Selecione uma usina...</option>
              {usinas.map(u => (
                <option key={u.id} value={u.id}>
                  {u.nome} — {u.cidade}/{u.estado}
                  {u.capacidadeKwh ? ` (${Number(u.capacidadeKwh).toLocaleString('pt-BR')} kWh cap.)` : ''}
                </option>
              ))}
            </select>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogAlocar(null)}>Cancelar</Button>
            <Button onClick={alocar} disabled={salvando || !usinaEscolhida}>
              {salvando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirmar alocação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
