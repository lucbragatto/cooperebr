'use client';

import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';
import type { AsaasCobranca } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Copy, ExternalLink, FileText, Loader2, Plus, QrCode, XCircle,
} from 'lucide-react';

const statusColor: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  RECEIVED: 'bg-green-100 text-green-800',
  CONFIRMED: 'bg-green-100 text-green-800',
  OVERDUE: 'bg-red-100 text-red-800',
  REFUNDED: 'bg-purple-100 text-purple-800',
  CANCELLED: 'bg-gray-100 text-gray-800',
};

const statusLabel: Record<string, string> = {
  PENDING: 'Pendente',
  RECEIVED: 'Recebido',
  CONFIRMED: 'Confirmado',
  OVERDUE: 'Vencido',
  REFUNDED: 'Estornado',
  CANCELLED: 'Cancelado',
};

const formaLabel: Record<string, string> = {
  BOLETO: 'Boleto',
  PIX: 'PIX',
  CREDIT_CARD: 'Cartão',
};

interface Props {
  cooperadoId: string;
}

export default function AsaasTab({ cooperadoId }: Props) {
  const [cobrancas, setCobrancas] = useState<AsaasCobranca[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showPix, setShowPix] = useState<AsaasCobranca | null>(null);
  const [cancelando, setCancelando] = useState<string | null>(null);
  const [emitindo, setEmitindo] = useState(false);
  const [copied, setCopied] = useState('');

  const [form, setForm] = useState({
    valor: '',
    vencimento: '',
    descricao: '',
    formaPagamento: 'BOLETO',
  });

  const load = useCallback(async () => {
    try {
      const { data } = await api.get<AsaasCobranca[]>(`/asaas/cobrancas/${cooperadoId}`);
      setCobrancas(data);
    } catch {
      // sem dados
    } finally {
      setLoading(false);
    }
  }, [cooperadoId]);

  useEffect(() => { load(); }, [load]);

  async function emitir() {
    if (!form.valor || !form.vencimento) return;
    setEmitindo(true);
    try {
      await api.post('/asaas/cobrancas', {
        cooperadoId,
        valor: parseFloat(form.valor),
        vencimento: form.vencimento,
        descricao: form.descricao || 'Mensalidade cooperativa',
        formaPagamento: form.formaPagamento,
      });
      setShowModal(false);
      setForm({ valor: '', vencimento: '', descricao: '', formaPagamento: 'BOLETO' });
      await load();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Erro ao emitir cobrança');
    } finally {
      setEmitindo(false);
    }
  }

  async function cancelar(asaasId: string) {
    if (!confirm('Cancelar esta cobrança no Asaas?')) return;
    setCancelando(asaasId);
    try {
      await api.post(`/asaas/cobrancas/${asaasId}/cancelar`);
      await load();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Erro ao cancelar');
    } finally {
      setCancelando(null);
    }
  }

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(''), 2000);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-6 w-6 animate-spin text-green-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span>Cobranças via Asaas</span>
            <Button size="sm" onClick={() => setShowModal(true)}>
              <Plus className="h-4 w-4 mr-1" /> Nova Cobrança
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {cobrancas.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">Nenhuma cobrança Asaas registrada.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="pb-2 font-medium">Vencimento</th>
                    <th className="pb-2 font-medium">Valor</th>
                    <th className="pb-2 font-medium">Forma</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {cobrancas.map((c) => (
                    <tr key={c.id} className="border-b last:border-0">
                      <td className="py-2">{new Date(c.vencimento).toLocaleDateString('pt-BR')}</td>
                      <td className="py-2">R$ {Number(c.valor).toFixed(2)}</td>
                      <td className="py-2">{formaLabel[c.formaPagamento] || c.formaPagamento}</td>
                      <td className="py-2">
                        <Badge className={statusColor[c.status] || 'bg-gray-100'}>
                          {statusLabel[c.status] || c.status}
                        </Badge>
                      </td>
                      <td className="py-2 text-right">
                        <div className="flex gap-1 justify-end">
                          {/* Link de pagamento */}
                          {c.linkPagamento && (
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Copiar link"
                              onClick={() => copyToClipboard(c.linkPagamento!, 'link-' + c.id)}
                            >
                              {copied === 'link-' + c.id ? <span className="text-green-600 text-xs">Copiado!</span> : <Copy className="h-3.5 w-3.5" />}
                            </Button>
                          )}

                          {/* Boleto */}
                          {c.boletoUrl && (
                            <a href={c.boletoUrl} target="_blank" rel="noopener noreferrer">
                              <Button variant="ghost" size="sm" title="Ver boleto">
                                <FileText className="h-3.5 w-3.5" />
                              </Button>
                            </a>
                          )}

                          {/* PIX QR Code */}
                          {c.pixCopiaECola && (
                            <Button
                              variant="ghost"
                              size="sm"
                              title="PIX"
                              onClick={() => setShowPix(c)}
                            >
                              <QrCode className="h-3.5 w-3.5" />
                            </Button>
                          )}

                          {/* Cancelar */}
                          {(c.status === 'PENDING' || c.status === 'OVERDUE') && (
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Cancelar"
                              onClick={() => cancelar(c.asaasId)}
                              disabled={cancelando === c.asaasId}
                            >
                              {cancelando === c.asaasId ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <XCircle className="h-3.5 w-3.5 text-red-500" />
                              )}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal Nova Cobrança */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Cobrança Asaas</DialogTitle>
            <DialogDescription>Emita uma cobrança via boleto, PIX ou cartão.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Valor (R$)</Label>
              <Input
                type="number"
                step="0.01"
                min="1"
                placeholder="0,00"
                value={form.valor}
                onChange={(e) => setForm((p) => ({ ...p, valor: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Vencimento</Label>
              <Input
                type="date"
                value={form.vencimento}
                onChange={(e) => setForm((p) => ({ ...p, vencimento: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Forma de pagamento</Label>
              <select
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={form.formaPagamento}
                onChange={(e) => setForm((p) => ({ ...p, formaPagamento: e.target.value }))}
              >
                <option value="BOLETO">Boleto</option>
                <option value="PIX">PIX</option>
                <option value="CREDIT_CARD">Cartão de Crédito</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label>Descrição</Label>
              <Input
                placeholder="Mensalidade cooperativa"
                value={form.descricao}
                onChange={(e) => setForm((p) => ({ ...p, descricao: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button onClick={emitir} disabled={emitindo || !form.valor || !form.vencimento}>
              {emitindo && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Emitir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal PIX QR Code */}
      <Dialog open={!!showPix} onOpenChange={(v) => !v && setShowPix(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>PIX - Copia e Cola</DialogTitle>
          </DialogHeader>
          {showPix && (
            <div className="space-y-4">
              {showPix.pixQrCode && (
                <div className="flex justify-center">
                  <img
                    src={`data:image/png;base64,${showPix.pixQrCode}`}
                    alt="QR Code PIX"
                    className="w-48 h-48"
                  />
                </div>
              )}
              {showPix.pixCopiaECola && (
                <div className="space-y-2">
                  <p className="text-xs text-gray-500 break-all bg-gray-50 p-2 rounded">{showPix.pixCopiaECola}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => copyToClipboard(showPix.pixCopiaECola!, 'pix')}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    {copied === 'pix' ? 'Copiado!' : 'Copiar código PIX'}
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
