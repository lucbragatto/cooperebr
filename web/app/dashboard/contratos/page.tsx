'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import type { Contrato } from '@/types';
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

const statusClasses: Record<string, string> = {
  ATIVO: 'bg-green-100 text-green-800 border-green-200',
  SUSPENSO: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  ENCERRADO: 'bg-red-100 text-red-800 border-red-200',
};

const statusLabel: Record<string, string> = {
  ATIVO: 'Ativo',
  SUSPENSO: 'Suspenso',
  ENCERRADO: 'Encerrado',
};

export default function ContratosPage() {
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    api.get<Contrato[]>('/contratos')
      .then((r) => setContratos(r.data))
      .finally(() => setCarregando(false));
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Contratos</h2>
        <Link href="/dashboard/contratos/novo">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Novo Contrato
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium text-gray-600">
            {carregando ? 'Carregando...' : `${contratos.length} registros`}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Cooperado</TableHead>
                <TableHead>UC</TableHead>
                <TableHead>Usina</TableHead>
                <TableHead>Desconto (%)</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data Início</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {carregando ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <TableCell key={j}>
                        <div className="h-4 bg-gray-200 animate-pulse rounded w-3/4" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : contratos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-gray-400 py-8">
                    Nenhum contrato cadastrado
                  </TableCell>
                </TableRow>
              ) : (
                contratos.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.numero}</TableCell>
                    <TableCell>{c.cooperado?.nomeCompleto ?? '—'}</TableCell>
                    <TableCell>{c.uc?.numero ?? '—'}</TableCell>
                    <TableCell>{c.usina?.nome ?? '—'}</TableCell>
                    <TableCell>{c.percentualDesconto}%</TableCell>
                    <TableCell>
                      <Badge className={statusClasses[c.status]}>
                        {statusLabel[c.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(c.dataInicio).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm">
                        Ver
                      </Button>
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
