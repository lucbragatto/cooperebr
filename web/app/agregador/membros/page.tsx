'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Users } from 'lucide-react';
import { useContexto } from '@/hooks/useContexto';

interface Membro {
  id: string;
  nomeCompleto: string;
  email: string;
  telefone: string | null;
  cpf: string;
  status: string;
  createdAt: string;
}

export default function AgregadorMembrosPage() {
  const { contextoObj } = useContexto();
  const [membros, setMembros] = useState<Membro[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState('');

  useEffect(() => {
    if (!contextoObj?.agregadorId) return;
    api.get<Membro[]>(`/cooperados?administradoraId=${contextoObj.agregadorId}`)
      .then(r => setMembros(Array.isArray(r.data) ? r.data : []))
      .finally(() => setCarregando(false));
  }, [contextoObj?.agregadorId]);

  const filtrados = membros.filter(m => {
    if (!busca.trim()) return true;
    const t = busca.toLowerCase();
    return m.nomeCompleto.toLowerCase().includes(t) || m.email.toLowerCase().includes(t) || m.cpf.includes(t);
  });

  const statusLabel: Record<string, string> = {
    PENDENTE: 'Pendente',
    ATIVO: 'Ativo',
    SUSPENSO: 'Suspenso',
    ENCERRADO: 'Encerrado',
  };

  const statusColor: Record<string, string> = {
    PENDENTE: 'bg-yellow-100 text-yellow-800',
    ATIVO: 'bg-green-100 text-green-800',
    SUSPENSO: 'bg-red-100 text-red-800',
    ENCERRADO: 'bg-gray-100 text-gray-600',
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Membros</h2>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="text-base font-medium text-gray-600">
              {carregando ? 'Carregando...' : `${filtrados.length} membros`}
            </CardTitle>
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input placeholder="Buscar por nome, email ou CPF..." value={busca} onChange={e => setBusca(e.target.value)} className="pl-9" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>CPF</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {carregando ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <TableCell key={j}><div className="h-4 bg-gray-200 animate-pulse rounded w-3/4" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : filtrados.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-gray-400 py-8">
                    <Users className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                    Nenhum membro encontrado
                  </TableCell>
                </TableRow>
              ) : (
                filtrados.map(m => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.nomeCompleto}</TableCell>
                    <TableCell className="text-sm text-gray-600">{m.email}</TableCell>
                    <TableCell className="text-sm text-gray-600">{m.telefone ?? '—'}</TableCell>
                    <TableCell className="text-sm text-gray-600">{m.cpf}</TableCell>
                    <TableCell>
                      <Badge className={statusColor[m.status] ?? 'bg-gray-100 text-gray-600'}>
                        {statusLabel[m.status] ?? m.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
