'use client';

import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  ArrowDownCircle, Calendar, CheckCircle, Clock, AlertTriangle, Search,
} from 'lucide-react';

interface Cobranca {
  id: string;
  mesReferencia: number;
  anoReferencia: number;
  valorBruto: number;
  valorLiquido: number;
  valorDesconto: number;
  percentualDesconto: number;
  status: string;
  dataVencimento: string;
  dataPagamento: string | null;
  valorPago: number | null;
  contrato?: {
    cooperado?: {
      nomeCompleto?: string;
    };
  };
}

function formatarMoeda(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function formatarData(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('pt-BR');
}
function competenciaLabel(mes: number, ano: number): string {
  return `${String(mes).padStart(2, '0')}/${ano}`;
}

const STATUS_BADGE: Record<string, { label: string; class: string }> = {
  PENDENTE: { label: 'Pendente', class: 'bg-blue-100 text-blue-700' },
  A_VENCER: { label: 'A Vencer', class: 'bg-yellow-100 text-yellow-700' },
  PAGO: { label: 'Pago', class: 'bg-green-100 text-green-700' },
  VENCIDO: { label: 'Vencido', class: 'bg-red-100 text-red-700' },
  CANCELADO: { label: 'Cancelado', class: 'bg-gray-100 text-gray-500' },
};

export default function ContasReceberPage() {
  const [cobrancas, setCobrancas] = useState<Cobranca[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [statusFiltro, setStatusFiltro] = useState('');
  const [busca, setBusca] = useState('');

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const statusParam = statusFiltro || 'PENDENTE,A_VENCER,VENCIDO,PAGO';
      const { data } = await api.get(`/cobrancas?status=${statusParam}`);
      setCobrancas(data ?? []);
    } catch {
      setCobrancas([]);
    } finally {
      setCarregando(false);
    }
  }, [statusFiltro]);

  useEffect(() => { carregar(); }, [carregar]);

  const hoje = new Date().toISOString().slice(0, 10);

  const filtrados = cobrancas.filter((c) => {
    if (!busca) return true;
    const termo = busca.toLowerCase();
    const nome = c.contrato?.cooperado?.nomeCompleto?.toLowerCase() ?? '';
    const comp = competenciaLabel(c.mesReferencia, c.anoReferencia);
    return nome.includes(termo) || comp.includes(termo);
  });

  const pendentes = filtrados.filter((c) => ['PENDENTE', 'A_VENCER'].includes(c.status));
  const totalReceber = pendentes.reduce((s, c) => s + Number(c.valorLiquido), 0);
  const vencendoHoje = filtrados.filter((c) =>
    ['PENDENTE', 'A_VENCER'].includes(c.status) && c.dataVencimento?.slice(0, 10) === hoje
  ).length;
  const vencidos = filtrados.filter((c) => c.status === 'VENCIDO').length;
  const recebidoMes = filtrados.filter((c) => c.status === 'PAGO').reduce((s, c) => s + Number(c.valorPago ?? c.valorLiquido), 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <ArrowDownCircle className="h-6 w-6 text-green-600" />
          <h2 className="text-2xl font-bold text-gray-800">Contas a Receber</h2>
        </div>
      </div>

      {/* Cards KPI */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <ArrowDownCircle className="h-4 w-4 text-blue-600" />
              <span className="text-xs text-gray-500">Total a Receber</span>
            </div>
            <p className="text-xl font-bold text-blue-700">{formatarMoeda(totalReceber)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="h-4 w-4 text-yellow-600" />
              <span className="text-xs text-gray-500">Vencendo hoje</span>
            </div>
            <p className="text-xl font-bold text-yellow-700">{vencendoHoje}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <span className="text-xs text-gray-500">Vencidos</span>
            </div>
            <p className="text-xl font-bold text-red-700">{vencidos}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-xs text-gray-500">Recebido</span>
            </div>
            <p className="text-xl font-bold text-green-700">{formatarMoeda(recebidoMes)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <select
          value={statusFiltro}
          onChange={(e) => setStatusFiltro(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
        >
          <option value="">Todos os status</option>
          <option value="PENDENTE,A_VENCER">Pendentes</option>
          <option value="VENCIDO">Vencidos</option>
          <option value="PAGO">Pagos</option>
          <option value="CANCELADO">Cancelados</option>
        </select>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por cooperado ou competência..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="border border-gray-300 rounded-md pl-9 pr-3 py-1.5 text-sm w-full"
          />
        </div>
      </div>

      {/* Tabela */}
      {carregando ? (
        <p className="text-gray-500">Carregando...</p>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cooperado</TableHead>
                  <TableHead>Competência</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Desconto</TableHead>
                  <TableHead className="text-right">Líquido</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtrados.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-gray-400 py-6">
                      Nenhuma cobrança encontrada
                    </TableCell>
                  </TableRow>
                ) : (
                  filtrados.map((c) => {
                    const badge = STATUS_BADGE[c.status] ?? { label: c.status, class: 'bg-gray-100 text-gray-500' };
                    return (
                      <TableRow key={c.id} className={c.status === 'VENCIDO' ? 'bg-red-50' : ''}>
                        <TableCell className="font-medium max-w-[240px] truncate">
                          {c.contrato?.cooperado?.nomeCompleto || '—'}
                        </TableCell>
                        <TableCell>{competenciaLabel(c.mesReferencia, c.anoReferencia)}</TableCell>
                        <TableCell>{formatarData(c.dataVencimento)}</TableCell>
                        <TableCell className="text-right">
                          {formatarMoeda(Number(c.valorBruto))}
                        </TableCell>
                        <TableCell className="text-right text-orange-600">
                          {Number(c.valorDesconto) > 0 ? `-${formatarMoeda(Number(c.valorDesconto))}` : '—'}
                        </TableCell>
                        <TableCell className="text-right font-medium text-green-700">
                          {formatarMoeda(Number(c.valorLiquido))}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={badge.class}>{badge.label}</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
