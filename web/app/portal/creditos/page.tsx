'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Coins, Send } from 'lucide-react';

const statusCores: Record<string, string> = {
  PENDENTE: 'bg-yellow-100 text-yellow-800',
  APROVADO: 'bg-blue-100 text-blue-800',
  PAGO: 'bg-green-100 text-green-800',
  CANCELADO: 'bg-red-100 text-red-800',
};

export default function PortalCreditosPage() {
  const [conversoes, setConversoes] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [form, setForm] = useState({ kwhDesejado: '', pixChave: '', pixNome: '' });
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  function carregar() {
    api.get('/conversao-credito/minhas')
      .then(r => setConversoes(r.data))
      .finally(() => setCarregando(false));
  }

  useEffect(() => { carregar(); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    setSucesso('');
    setEnviando(true);
    try {
      await api.post('/conversao-credito/solicitar', {
        kwhDesejado: parseFloat(form.kwhDesejado),
        pixChave: form.pixChave || undefined,
        pixNome: form.pixNome || undefined,
      });
      setSucesso('Solicitação enviada com sucesso!');
      setForm({ kwhDesejado: '', pixChave: '', pixNome: '' });
      carregar();
    } catch (err: any) {
      setErro(err.response?.data?.message ?? 'Erro ao solicitar conversão');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Converter Créditos</h1>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Send className="h-5 w-5" /> Solicitar Conversão</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {erro && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">{erro}</div>}
            {sucesso && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded text-sm">{sucesso}</div>}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>kWh a converter *</Label>
                <Input type="number" min={1} step={0.01} value={form.kwhDesejado} onChange={e => setForm(prev => ({ ...prev, kwhDesejado: e.target.value }))} required />
              </div>
              <div>
                <Label>Chave PIX</Label>
                <Input value={form.pixChave} onChange={e => setForm(prev => ({ ...prev, pixChave: e.target.value }))} placeholder="CPF, email, telefone ou chave aleatória" />
              </div>
              <div>
                <Label>Nome do titular PIX</Label>
                <Input value={form.pixNome} onChange={e => setForm(prev => ({ ...prev, pixNome: e.target.value }))} />
              </div>
            </div>
            <Button type="submit" disabled={enviando}>{enviando ? 'Enviando...' : 'Solicitar Conversão'}</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Coins className="h-5 w-5" /> Histórico de Conversões</CardTitle></CardHeader>
        <CardContent>
          {carregando ? (
            <p className="text-muted-foreground text-center py-4">Carregando...</p>
          ) : conversoes.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">Nenhuma conversão solicitada.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>kWh</TableHead>
                  <TableHead>Valor (R$)</TableHead>
                  <TableHead>Tarifa</TableHead>
                  <TableHead>PIX</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {conversoes.map((c: any) => (
                  <TableRow key={c.id}>
                    <TableCell className="text-sm">{new Date(c.createdAt).toLocaleDateString('pt-BR')}</TableCell>
                    <TableCell className="font-mono">{Number(c.valorKwh).toFixed(2)}</TableCell>
                    <TableCell className="font-mono">R$ {Number(c.valorReais).toFixed(2)}</TableCell>
                    <TableCell className="font-mono text-sm">{Number(c.tarifaUsada).toFixed(4)}</TableCell>
                    <TableCell className="text-sm">{c.pixChave ?? '-'}</TableCell>
                    <TableCell><Badge className={statusCores[c.status] ?? ''}>{c.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
