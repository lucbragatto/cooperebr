'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
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
import { CheckCircle, Plus } from 'lucide-react';
import Link from 'next/link';

interface CooperadoLista {
  id: string;
  nomeCompleto: string;
  cpf: string;
  email: string;
  telefone: string | null;
  status: string;
  tipoCooperado: string;
  cotaKwhMensal: number | string | null;
  usinaVinculada: string | null;
  statusContrato: string | null;
  kwhContrato: number | null;
  checklist: string;
  checklistPronto: boolean;
  createdAt: string;
}

const statusColors: Record<string, string> = {
  ATIVO: 'bg-green-100 text-green-800 border-green-200',
  ATIVO_RECEBENDO_CREDITOS: 'bg-green-100 text-green-800 border-green-200',
  PENDENTE: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  PENDENTE_ATIVACAO: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  SUSPENSO: 'bg-orange-100 text-orange-800 border-orange-200',
  ENCERRADO: 'bg-red-100 text-red-800 border-red-200',
};

const statusLabel: Record<string, string> = {
  ATIVO: 'Ativo',
  ATIVO_RECEBENDO_CREDITOS: 'Ativo',
  PENDENTE: 'Pendente',
  PENDENTE_ATIVACAO: 'Pendente Ativacao',
  SUSPENSO: 'Suspenso',
  ENCERRADO: 'Encerrado',
};

const statusContratoLabel: Record<string, string> = {
  PENDENTE_ATIVACAO: 'Pend. Ativacao',
  ATIVO: 'Ativo',
  LISTA_ESPERA: 'Lista Espera',
};

const statusContratoColors: Record<string, string> = {
  PENDENTE_ATIVACAO: 'bg-yellow-100 text-yellow-800',
  ATIVO: 'bg-green-100 text-green-800',
  LISTA_ESPERA: 'bg-purple-100 text-purple-800',
};

export default function CooperadosPage() {
  const [cooperados, setCooperados] = useState<CooperadoLista[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    api.get<CooperadoLista[]>('/cooperados')
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
                <TableHead>CPF/CNPJ</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Usina</TableHead>
                <TableHead>Contrato</TableHead>
                <TableHead>Checklist</TableHead>
                <TableHead className="text-right">Acoes</TableHead>
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
              ) : cooperados.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-gray-400 py-8">
                    Nenhum cooperado cadastrado
                  </TableCell>
                </TableRow>
              ) : (
                cooperados.map((c) => (
                  <TableRow key={c.id} className={c.checklistPronto && c.status === 'PENDENTE' ? 'bg-green-50/50' : ''}>
                    <TableCell>
                      <div>
                        <span className="font-medium text-gray-800">{c.nomeCompleto}</span>
                        {c.tipoCooperado === 'SEM_UC' && (
                          <span className="ml-2 text-xs text-gray-400">(sem UC)</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">{c.cpf}</TableCell>
                    <TableCell>
                      <Badge className={statusColors[c.status] ?? 'bg-gray-100 text-gray-600'}>
                        {statusLabel[c.status] ?? c.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {c.usinaVinculada ?? <span className="text-gray-400">—</span>}
                    </TableCell>
                    <TableCell>
                      {c.statusContrato ? (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusContratoColors[c.statusContrato] ?? 'bg-gray-100'}`}>
                          {statusContratoLabel[c.statusContrato] ?? c.statusContrato}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-sm font-mono ${c.checklistPronto ? 'text-green-700 font-bold' : 'text-gray-500'}`}>
                          {c.checklist}
                        </span>
                        {c.checklistPronto && (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        )}
                      </div>
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
