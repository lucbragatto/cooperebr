'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Search, UserCheck, TrendingUp } from 'lucide-react';
import Link from 'next/link';

interface Convenio {
  id: string;
  numero: string;
  empresaNome: string;
  empresaCnpj: string | null;
  tipo: string;
  status: string;
  conveniadoNome: string | null;
  membrosAtivosCache: number;
  faixaAtualIndex: number;
  descontoMembrosAtual: number;
  descontoConveniadoAtual: number;
  createdAt: string;
  _count: { cooperados: number };
}

const tipoLabels: Record<string, string> = {
  CONDOMINIO: 'Condomínio',
  ADMINISTRADORA: 'Administradora',
  ASSOCIACAO: 'Associação',
  SINDICATO: 'Sindicato',
  EMPRESA: 'Empresa',
  CLUBE: 'Clube',
  OUTRO: 'Outro',
};

const statusColors: Record<string, string> = {
  ATIVO: 'bg-green-100 text-green-800',
  SUSPENSO: 'bg-yellow-100 text-yellow-800',
  ENCERRADO: 'bg-red-100 text-red-800',
};

export default function ConveniosPage() {
  const [convenios, setConvenios] = useState<Convenio[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState('');
  const [total, setTotal] = useState(0);

  function carregarConvenios() {
    setCarregando(true);
    api.get('/convenios', { params: { busca: busca || undefined, limit: 100 } })
      .then(r => {
        setConvenios(r.data.data);
        setTotal(r.data.total);
      })
      .finally(() => setCarregando(false));
  }

  useEffect(() => { carregarConvenios(); }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Convênios</h1>
          <p className="text-muted-foreground">Gerencie convênios, parcerias e benefícios coletivos</p>
        </div>
        <Link href="/dashboard/convenios/novo">
          <Button><Plus className="h-4 w-4 mr-2" /> Novo Convênio</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, CNPJ ou conveniado..."
                value={busca}
                onChange={e => setBusca(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && carregarConvenios()}
                className="pl-10"
              />
            </div>
            <Button variant="outline" onClick={carregarConvenios}>Buscar</Button>
          </div>
        </CardHeader>
        <CardContent>
          {carregando ? (
            <p className="text-center py-8 text-muted-foreground">Carregando...</p>
          ) : convenios.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">Nenhum convênio encontrado</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Conveniado</TableHead>
                  <TableHead className="text-center">Membros</TableHead>
                  <TableHead className="text-center">Desc. Membros</TableHead>
                  <TableHead className="text-center">Desc. Conveniado</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {convenios.map(c => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <Link href={`/dashboard/convenios/${c.id}`} className="text-blue-600 hover:underline font-mono text-sm">
                        {c.numero}
                      </Link>
                    </TableCell>
                    <TableCell className="font-medium">{c.empresaNome}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{tipoLabels[c.tipo] ?? c.tipo}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{c.conveniadoNome ?? '-'}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{c._count?.cooperados ?? c.membrosAtivosCache}</Badge>
                    </TableCell>
                    <TableCell className="text-center font-mono text-sm">
                      {Number(c.descontoMembrosAtual).toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-center font-mono text-sm">
                      {Number(c.descontoConveniadoAtual).toFixed(1)}%
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[c.status] ?? ''}>{c.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {total > 0 && (
            <p className="text-sm text-muted-foreground mt-4">
              {total} convênio{total !== 1 ? 's' : ''} encontrado{total !== 1 ? 's' : ''}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
