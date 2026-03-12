'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import type { UC } from '@/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus } from 'lucide-react';

export default function UcsPage() {
  const [ucs, setUcs] = useState<UC[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    api.get<UC[]>('/ucs')
      .then((r) => setUcs(r.data))
      .finally(() => setCarregando(false));
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Unidades Consumidoras</h2>
        <Link href="/dashboard/ucs/nova">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Nova UC
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium text-gray-600">
            {carregando ? 'Carregando...' : `${ucs.length} registros`}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Endereço</TableHead>
                <TableHead>Cidade</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Cooperado</TableHead>
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
              ) : ucs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-gray-400 py-8">
                    Nenhuma UC cadastrada
                  </TableCell>
                </TableRow>
              ) : (
                ucs.map((uc) => (
                  <TableRow key={uc.id}>
                    <TableCell className="font-medium">{uc.numero}</TableCell>
                    <TableCell>{uc.endereco}</TableCell>
                    <TableCell>{uc.cidade}</TableCell>
                    <TableCell>{uc.estado}</TableCell>
                    <TableCell>{uc.cooperado?.nomeCompleto ?? '—'}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm">Ver</Button>
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
