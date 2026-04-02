'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Check, X } from 'lucide-react';

export default function ConveniosGlobaisPage() {
  const [convenios, setConvenios] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [motivoRejeicao, setMotivoRejeicao] = useState('');
  const [rejeitandoId, setRejeitandoId] = useState<string | null>(null);

  function carregar() {
    setCarregando(true);
    api.get('/convenios/global/pendentes')
      .then(r => setConvenios(r.data))
      .finally(() => setCarregando(false));
  }

  useEffect(() => { carregar(); }, []);

  async function aprovar(id: string) {
    try {
      await api.patch(`/convenios/${id}/aprovar`);
      carregar();
    } catch (err: any) {
      alert(err.response?.data?.message ?? 'Erro ao aprovar');
    }
  }

  async function rejeitar(id: string) {
    if (!motivoRejeicao.trim()) return alert('Informe o motivo da rejeição');
    try {
      await api.patch(`/convenios/${id}/rejeitar`, { motivoRejeicao });
      setRejeitandoId(null);
      setMotivoRejeicao('');
      carregar();
    } catch (err: any) {
      alert(err.response?.data?.message ?? 'Erro ao rejeitar');
    }
  }

  if (carregando) return <p className="text-center py-8 text-muted-foreground">Carregando...</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Convênios Globais Pendentes</h1>

      {convenios.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Nenhum convênio global pendente de aprovação.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>CNPJ</TableHead>
                  <TableHead>Membros</TableHead>
                  <TableHead>Taxa SISGD</TableHead>
                  <TableHead>Tier Mínimo</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {convenios.map((c: any) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.empresaNome}</TableCell>
                    <TableCell><Badge variant="outline">{c.tipo}</Badge></TableCell>
                    <TableCell className="font-mono text-sm">{c.empresaCnpj ?? '-'}</TableCell>
                    <TableCell>{c._count?.cooperados ?? 0}</TableCell>
                    <TableCell>{c.taxaAprovacaoSisgd ? `R$ ${Number(c.taxaAprovacaoSisgd).toFixed(2)}` : '-'}</TableCell>
                    <TableCell>{c.tierMinimoClube ?? '-'}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="sm" variant="default" onClick={() => aprovar(c.id)}>
                          <Check className="h-4 w-4 mr-1" /> Aprovar
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => setRejeitandoId(c.id)}>
                          <X className="h-4 w-4 mr-1" /> Rejeitar
                        </Button>
                      </div>
                      {rejeitandoId === c.id && (
                        <div className="mt-2 space-y-2">
                          <textarea
                            className="w-full border rounded-md px-3 py-2 text-sm"
                            rows={2}
                            placeholder="Motivo da rejeição..."
                            value={motivoRejeicao}
                            onChange={e => setMotivoRejeicao(e.target.value)}
                          />
                          <div className="flex gap-2">
                            <Button size="sm" variant="destructive" onClick={() => rejeitar(c.id)}>Confirmar</Button>
                            <Button size="sm" variant="outline" onClick={() => { setRejeitandoId(null); setMotivoRejeicao(''); }}>Cancelar</Button>
                          </div>
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
