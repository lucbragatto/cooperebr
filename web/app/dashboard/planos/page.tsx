'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import type { Plano } from '@/types';
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

const modeloLabel: Record<string, string> = {
  FIXO_MENSAL: 'Fixo Mensal',
  CREDITOS_COMPENSADOS: 'Créditos Compensados',
  CREDITOS_DINAMICO: 'Créditos Dinâmico',
};

const modeloClass: Record<string, string> = {
  FIXO_MENSAL: 'bg-blue-100 text-blue-700 border-blue-200',
  CREDITOS_COMPENSADOS: 'bg-green-100 text-green-700 border-green-200',
  CREDITOS_DINAMICO: 'bg-purple-100 text-purple-700 border-purple-200',
};

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('pt-BR');
}

export default function PlanosPage() {
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    api.get<Plano[]>('/planos')
      .then((r) => setPlanos(r.data))
      .finally(() => setCarregando(false));
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Planos</h2>
        <Link href="/dashboard/planos/novo">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Novo Plano
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium text-gray-600">
            {carregando ? 'Carregando...' : `${planos.length} registros`}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Modelo de Cobrança</TableHead>
                <TableHead>Desconto Base</TableHead>
                <TableHead>Promoção</TableHead>
                <TableHead>Público</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Vigência</TableHead>
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
              ) : planos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-gray-400 py-8">
                    Nenhum plano cadastrado
                  </TableCell>
                </TableRow>
              ) : (
                planos.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.nome}</TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${modeloClass[p.modeloCobranca]}`}
                      >
                        {modeloLabel[p.modeloCobranca]}
                      </span>
                    </TableCell>
                    <TableCell>{Number(p.descontoBase).toFixed(1)}%</TableCell>
                    <TableCell>
                      {p.tipoCampanha === 'CAMPANHA' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border bg-orange-100 text-orange-700 border-orange-200">
                          CAMPANHA
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">Padrão</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {p.publico ? (
                        <Badge variant="default">Sim</Badge>
                      ) : (
                        <Badge variant="outline">Não</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {p.ativo ? (
                        <Badge variant="default">Ativo</Badge>
                      ) : (
                        <Badge variant="secondary">Inativo</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {p.tipoCampanha === 'CAMPANHA'
                        ? `${formatDate(p.dataInicioVigencia)} – ${formatDate(p.dataFimVigencia)}`
                        : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/dashboard/planos/${p.id}`}>
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
