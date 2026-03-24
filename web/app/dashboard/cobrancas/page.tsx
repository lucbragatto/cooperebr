'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import type { Cobranca } from '@/types';
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
import { useTipoParceiro } from '@/hooks/useTipoParceiro';

const statusClasses: Record<string, string> = {
  PENDENTE: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  PAGO: 'bg-green-100 text-green-800 border-green-200',
  VENCIDO: 'bg-red-100 text-red-800 border-red-200',
  CANCELADO: 'bg-gray-100 text-gray-800 border-gray-200',
};

const statusLabel: Record<string, string> = {
  PENDENTE: 'Pendente',
  PAGO: 'Pago',
  VENCIDO: 'Vencido',
  CANCELADO: 'Cancelado',
};

function formatBRL(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function CobrancasPage() {
  const { tipoMembro } = useTipoParceiro();
  const [cobrancas, setCobrancas] = useState<Cobranca[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    api.get<Cobranca[]>('/cobrancas')
      .then((r) => setCobrancas(r.data))
      .finally(() => setCarregando(false));
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Cobranças</h2>
        <Link href="/dashboard/cobrancas/nova">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Nova Cobrança
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium text-gray-600">
            {carregando ? 'Carregando...' : `${cobrancas.length} registros`}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{tipoMembro}</TableHead>
                <TableHead>Contrato</TableHead>
                <TableHead>Mês/Ano Ref.</TableHead>
                <TableHead>Valor Bruto</TableHead>
                <TableHead>Desconto</TableHead>
                <TableHead>Valor Líquido</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {carregando ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 9 }).map((_, j) => (
                      <TableCell key={j}>
                        <div className="h-4 bg-gray-200 animate-pulse rounded w-3/4" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : cobrancas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-gray-400 py-8">
                    Nenhuma cobrança cadastrada
                  </TableCell>
                </TableRow>
              ) : (
                cobrancas.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">
                      {(c as any).contrato?.cooperado?.nomeCompleto ?? '—'}
                    </TableCell>
                    <TableCell className="font-medium">
                      {c.contrato?.numero ?? '—'}
                    </TableCell>
                    <TableCell>
                      {String(c.mesReferencia).padStart(2, '0')}/{c.anoReferencia}
                    </TableCell>
                    <TableCell>{formatBRL(c.valorBruto)}</TableCell>
                    <TableCell>{formatBRL(c.valorDesconto)}</TableCell>
                    <TableCell>{formatBRL(c.valorLiquido)}</TableCell>
                    <TableCell>
                      {new Date(c.dataVencimento).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell>
                      <Badge className={statusClasses[c.status]}>
                        {statusLabel[c.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/dashboard/cobrancas/${c.id}`}>
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
