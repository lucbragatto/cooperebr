'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import type { Cooperado } from '@/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus } from 'lucide-react';
import Link from 'next/link';

const statusVariant: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  ATIVO: 'default',
  PENDENTE: 'secondary',
  SUSPENSO: 'outline',
  ENCERRADO: 'destructive',
};

const statusLabel: Record<string, string> = {
  ATIVO: 'Ativo',
  PENDENTE: 'Pendente',
  SUSPENSO: 'Suspenso',
  ENCERRADO: 'Encerrado',
};

export default function CooperadosPage() {
  const [cooperados, setCooperados] = useState<Cooperado[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    api.get<Cooperado[]>('/cooperados')
      .then((r) => setCooperados(r.data))
      .finally(() => setCarregando(false));
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Cooperados</h2>
        <Link href="/dashboard/cooperados/novo">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Novo Cooperado
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium text-gray-600">
            {carregando ? 'Carregando...' : `${cooperados.length} registros`}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>CPF</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {carregando ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <TableCell key={j}>
                        <div className="h-4 bg-gray-200 animate-pulse rounded w-3/4" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : cooperados.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-gray-400 py-8">
                    Nenhum cooperado cadastrado
                  </TableCell>
                </TableRow>
              ) : (
                cooperados.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.nomeCompleto}</TableCell>
                    <TableCell>{c.cpf}</TableCell>
                    <TableCell>{c.email}</TableCell>
                    <TableCell>{c.telefone ?? '—'}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[c.status]}>
                        {statusLabel[c.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/dashboard/cooperados/${c.id}`}>
                        <Button variant="ghost" size="sm">Ver</Button>
                      </Link>
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
