'use client';

import { useEffect, useState } from 'react';
import { Loader2, FileText, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import api from '@/lib/api';

interface Contrato {
  id: string;
  numero: string;
  status: string;
  dataInicio: string;
  dataFim: string | null;
  kwhContrato: number;
  percentualUsina: number;
  percentualDesconto: number;
  cooperado: string; // anonimizado
  usina: { id: string; nome: string; apelidoInterno: string | null };
}

const STATUS_COR: Record<string, string> = {
  ATIVO: 'bg-green-100 text-green-700',
  PENDENTE_ATIVACAO: 'bg-yellow-100 text-yellow-700',
  APROVADO: 'bg-blue-100 text-blue-700',
  ENCERRADO: 'bg-gray-100 text-gray-500',
  SUSPENSO: 'bg-red-100 text-red-700',
};

function fmtKwh(v: number): string {
  return `${v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} kWh`;
}

export default function ProprietarioContratosPage() {
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    api
      .get<Contrato[]>('/proprietario/contratos')
      .then((r) => setContratos(r.data ?? []))
      .catch(() => setContratos([]))
      .finally(() => setCarregando(false));
  }, []);

  if (carregando) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-amber-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Contratos de Uso</h1>
        <p className="text-sm text-gray-500 mt-1">Contratos vinculados às suas usinas (cooperados anonimizados)</p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-md p-3 flex gap-2">
        <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <strong>LGPD:</strong> cooperados são exibidos com apelido sequencial (Cooperado #001, #002...) —
          nomes reais não aparecem.
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-4 h-4 text-purple-500" />
            Contratos ({contratos.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {contratos.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">Nenhum contrato vinculado.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Cooperado</TableHead>
                  <TableHead>Usina</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Início</TableHead>
                  <TableHead className="text-right">kWh/mês</TableHead>
                  <TableHead className="text-right">% Usina</TableHead>
                  <TableHead className="text-right">% Desconto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contratos.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.numero}</TableCell>
                    <TableCell>{c.cooperado}</TableCell>
                    <TableCell className="text-xs">{c.usina.nome}</TableCell>
                    <TableCell><Badge className={STATUS_COR[c.status] ?? 'bg-gray-100'}>{c.status.replace(/_/g, ' ')}</Badge></TableCell>
                    <TableCell className="text-xs">{new Date(c.dataInicio).toLocaleDateString('pt-BR')}</TableCell>
                    <TableCell className="text-right">{fmtKwh(c.kwhContrato)}</TableCell>
                    <TableCell className="text-right">{c.percentualUsina}%</TableCell>
                    <TableCell className="text-right">{c.percentualDesconto}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
