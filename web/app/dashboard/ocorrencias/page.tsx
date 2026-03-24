'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import type { Ocorrencia } from '@/types';
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

const prioridadeClasses: Record<string, string> = {
  ALTA: 'bg-red-100 text-red-800 border-red-200',
  MEDIA: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  BAIXA: 'bg-blue-100 text-blue-800 border-blue-200',
  CRITICA: 'bg-red-200 text-red-900 border-red-300',
};

const prioridadeLabel: Record<string, string> = {
  ALTA: 'Alta',
  MEDIA: 'Média',
  BAIXA: 'Baixa',
  CRITICA: 'Crítica',
};

const statusLabel: Record<string, string> = {
  ABERTA: 'Aberta',
  EM_ANDAMENTO: 'Em Andamento',
  RESOLVIDA: 'Resolvida',
  CANCELADA: 'Cancelada',
};

const tipoLabel: Record<string, string> = {
  FALTA_ENERGIA: 'Falta de Energia',
  MEDICAO_INCORRETA: 'Medição Incorreta',
  PROBLEMA_FATURA: 'Problema na Fatura',
  SOLICITACAO: 'Solicitação',
  OUTROS: 'Outros',
};

export default function OcorrenciasPage() {
  const { tipoMembro } = useTipoParceiro();
  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    api.get<Ocorrencia[]>('/ocorrencias')
      .then((r) => setOcorrencias(r.data))
      .finally(() => setCarregando(false));
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Ocorrências</h2>
        <Link href="/dashboard/ocorrencias/nova">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Nova Ocorrência
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium text-gray-600">
            {carregando ? 'Carregando...' : `${ocorrencias.length} registros`}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{tipoMembro}</TableHead>
                <TableHead>UC</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {carregando ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <TableCell key={j}>
                        <div className="h-4 bg-gray-200 animate-pulse rounded w-3/4" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : ocorrencias.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-gray-400 py-8">
                    Nenhuma ocorrência cadastrada
                  </TableCell>
                </TableRow>
              ) : (
                ocorrencias.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-medium">
                      {o.cooperado?.nomeCompleto ?? '—'}
                    </TableCell>
                    <TableCell>{o.uc?.numero ?? '—'}</TableCell>
                    <TableCell>{tipoLabel[o.tipo] ?? o.tipo}</TableCell>
                    <TableCell>
                      <Badge className={prioridadeClasses[o.prioridade]}>
                        {prioridadeLabel[o.prioridade] ?? o.prioridade}
                      </Badge>
                    </TableCell>
                    <TableCell>{statusLabel[o.status] ?? o.status}</TableCell>
                    <TableCell>
                      {new Date(o.createdAt).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/dashboard/ocorrencias/${o.id}`}>
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
