'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Check, X, Coins } from 'lucide-react';

const statusCores: Record<string, string> = {
  PENDENTE: 'bg-yellow-100 text-yellow-800',
  APROVADO: 'bg-blue-100 text-blue-800',
  PAGO: 'bg-green-100 text-green-800',
  CANCELADO: 'bg-red-100 text-red-800',
};

export default function ConversoesAdminPage() {
  const [conversoes, setConversoes] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);

  function carregar() {
    setCarregando(true);
    api.get('/conversao-credito')
      .then(r => setConversoes(r.data))
      .finally(() => setCarregando(false));
  }

  useEffect(() => { carregar(); }, []);

  async function aprovar(id: string) {
    if (!confirm('Confirmar pagamento desta conversão?')) return;
    try {
      await api.patch(`/conversao-credito/${id}/aprovar`);
      carregar();
    } catch (err: any) {
      alert(err.response?.data?.message ?? 'Erro ao aprovar');
    }
  }

  async function cancelar(id: string) {
    if (!confirm('Cancelar esta solicitação?')) return;
    try {
      await api.patch(`/conversao-credito/${id}/cancelar`);
      carregar();
    } catch (err: any) {
      alert(err.response?.data?.message ?? 'Erro ao cancelar');
    }
  }

  if (carregando) return <p className="text-center py-8 text-muted-foreground">Carregando...</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2"><Coins className="h-6 w-6" /> Conversões de Crédito (SEM_UC)</h1>

      {conversoes.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Nenhuma solicitação de conversão pendente.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Cooperado</TableHead>
                  <TableHead>kWh</TableHead>
                  <TableHead>Valor (R$)</TableHead>
                  <TableHead>Tarifa</TableHead>
                  <TableHead>PIX</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {conversoes.map((c: any) => (
                  <TableRow key={c.id}>
                    <TableCell className="text-sm">{new Date(c.createdAt).toLocaleDateString('pt-BR')}</TableCell>
                    <TableCell className="font-medium">{c.cooperado?.nomeCompleto ?? '-'}</TableCell>
                    <TableCell className="font-mono">{Number(c.valorKwh).toFixed(2)}</TableCell>
                    <TableCell className="font-mono">R$ {Number(c.valorReais).toFixed(2)}</TableCell>
                    <TableCell className="font-mono text-sm">{Number(c.tarifaUsada).toFixed(4)}</TableCell>
                    <TableCell className="text-sm">{c.pixChave ?? '-'}</TableCell>
                    <TableCell><Badge className={statusCores[c.status] ?? ''}>{c.status}</Badge></TableCell>
                    <TableCell>
                      {c.status === 'PENDENTE' && (
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => aprovar(c.id)}>
                            <Check className="h-4 w-4 mr-1" /> Aprovar
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => cancelar(c.id)}>
                            <X className="h-4 w-4 mr-1" /> Cancelar
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
