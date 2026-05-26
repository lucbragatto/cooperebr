'use client';

import { useEffect, useState } from 'react';
import { Loader2, Receipt, Info, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import api from '@/lib/api';

interface Despesa {
  id: string;
  descricao: string;
  categoria: string;
  valor: number;
  dataVencimento: string;
  dataPagamento: string | null;
  status: string;
  responsavelPagamento: string | null;
  usina: { id: string; nome: string; apelidoInterno: string | null };
  comprovante: string | null;
}

function fmtMoney(v: number): string {
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const STATUS_COR: Record<string, string> = {
  PENDENTE: 'bg-yellow-100 text-yellow-700',
  PAGO: 'bg-green-100 text-green-700',
  ATRASADO: 'bg-red-100 text-red-700',
  CANCELADO: 'bg-gray-200 text-gray-600',
};

const RESP_COR: Record<string, string> = {
  PROPRIETARIO: 'bg-amber-100 text-amber-700',
  COMPARTILHADO: 'bg-purple-100 text-purple-700',
  PARCEIRO: 'bg-blue-100 text-blue-700',
};

export default function ProprietarioDespesasPage() {
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    api
      .get<Despesa[]>('/proprietario/despesas')
      .then((r) => setDespesas(r.data ?? []))
      .catch(() => setDespesas([]))
      .finally(() => setCarregando(false));
  }, []);

  if (carregando) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-amber-600 animate-spin" />
      </div>
    );
  }

  const totalGeral = despesas.reduce((s, d) => s + d.valor, 0);
  const totalPago = despesas.filter((d) => d.status === 'PAGO').reduce((s, d) => s + d.valor, 0);
  const totalPendente = despesas.filter((d) => d.status === 'PENDENTE' || d.status === 'ATRASADO').reduce((s, d) => s + d.valor, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Despesas</h1>
        <p className="text-sm text-gray-500 mt-1">
          Despesas operacionais das suas usinas que você é responsável por pagar
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-md p-3 flex gap-2">
        <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <strong>Só visualização:</strong> esta tela mostra apenas despesas onde a matriz de responsabilidade
          aponta você (PROPRIETARIO ou COMPARTILHADO). A cooperativa cadastra as despesas; você acompanha aqui.
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-500">Total despesas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fmtMoney(totalGeral)}</div>
            <p className="text-xs text-gray-500 mt-1">{despesas.length} despesa(s)</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-500">Já pagas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700">{fmtMoney(totalPago)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-500">Pendentes/Atrasadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-700">{fmtMoney(totalPendente)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Receipt className="w-4 h-4 text-amber-500" />
            Despesas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {despesas.length === 0 ? (
            <div className="text-center py-12">
              <Receipt className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">Nenhuma despesa registrada com sua responsabilidade.</p>
              <p className="text-gray-400 text-xs mt-1">A cooperativa cadastra despesas no painel admin.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Usina</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Comprovante</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {despesas.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.descricao}</TableCell>
                    <TableCell className="text-xs">{d.categoria.replace(/_/g, ' ')}</TableCell>
                    <TableCell className="text-xs">{d.usina.nome}</TableCell>
                    <TableCell className="text-xs">
                      {new Date(d.dataVencimento).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell>
                      <Badge className={STATUS_COR[d.status] ?? 'bg-gray-100'}>{d.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {d.responsavelPagamento && (
                        <Badge className={RESP_COR[d.responsavelPagamento] ?? 'bg-gray-100'}>
                          {d.responsavelPagamento}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-semibold">{fmtMoney(d.valor)}</TableCell>
                    <TableCell>
                      {d.comprovante && (
                        <a href={d.comprovante} target="_blank" rel="noopener noreferrer">
                          <Button size="sm" variant="ghost">
                            <Download className="w-3 h-3" />
                          </Button>
                        </a>
                      )}
                    </TableCell>
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
