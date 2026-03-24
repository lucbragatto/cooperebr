'use client';

import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Loader2, Search,
} from 'lucide-react';

interface Mensagem {
  id: string;
  telefone: string;
  direcao: string;
  tipo: string;
  conteudo: string | null;
  status: string;
  enviadaEm: string;
  tipoDisparo: string | null;
}

interface HistoricoResponse {
  mensagens: Mensagem[];
  total: number;
  limit: number;
  offset: number;
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  ENVIADA: { label: 'Enviada', variant: 'secondary' },
  ENTREGUE: { label: 'Entregue', variant: 'outline' },
  LIDA: { label: 'Lida', variant: 'default' },
  FALHOU: { label: 'Falhou', variant: 'destructive' },
  RECEBIDA: { label: 'Recebida', variant: 'default' },
};

const statusColor: Record<string, string> = {
  ENVIADA: 'bg-gray-100 text-gray-600',
  ENTREGUE: 'bg-blue-50 text-blue-600',
  LIDA: 'bg-blue-100 text-blue-700',
  FALHOU: 'bg-red-50 text-red-600',
  RECEBIDA: 'bg-green-50 text-green-700',
};

function formatTimestamp(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function HistoricoMensagens() {
  const [data, setData] = useState<HistoricoResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [filtroTelefone, setFiltroTelefone] = useState('');
  const [filtroDirecao, setFiltroDirecao] = useState<'' | 'ENTRADA' | 'SAIDA'>('');
  const [offset, setOffset] = useState(0);
  const limit = 50;

  const fetchHistorico = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {
        limit: String(limit),
        offset: String(offset),
      };
      if (filtroTelefone.trim()) params.telefone = filtroTelefone.trim();
      if (filtroDirecao) params.direcao = filtroDirecao;

      const { data: resp } = await api.get<HistoricoResponse>('/whatsapp/historico', { params });
      setData(resp);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [offset, filtroTelefone, filtroDirecao]);

  useEffect(() => {
    fetchHistorico();
  }, [fetchHistorico]);

  function buscar() {
    setOffset(0);
    fetchHistorico();
  }

  const totalPages = data ? Math.ceil(data.total / limit) : 0;
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-medium text-gray-600 mb-1">Buscar telefone</label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              value={filtroTelefone}
              onChange={(e) => setFiltroTelefone(e.target.value)}
              placeholder="Telefone..."
              className="pl-9 text-sm"
              onKeyDown={(e) => { if (e.key === 'Enter') buscar(); }}
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Direção</label>
          <select
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            value={filtroDirecao}
            onChange={(e) => { setFiltroDirecao(e.target.value as '' | 'ENTRADA' | 'SAIDA'); setOffset(0); }}
          >
            <option value="">Todas</option>
            <option value="SAIDA">Enviadas</option>
            <option value="ENTRADA">Recebidas</option>
          </select>
        </div>
        <Button onClick={buscar} variant="outline" size="sm">
          <Search className="h-4 w-4 mr-1" /> Buscar
        </Button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : !data || data.mensagens.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-8">Nenhuma mensagem encontrada.</p>
      ) : (
        <>
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 w-8"></th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Telefone</th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Conteúdo</th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 w-24">Status</th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 w-32">Data</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.mensagens.map((msg) => {
                    const sc = statusColor[msg.status] ?? 'bg-gray-100 text-gray-600';
                    return (
                      <tr key={msg.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-3 py-2">
                          {msg.direcao === 'SAIDA' ? (
                            <ArrowUp className="h-4 w-4 text-blue-500" />
                          ) : (
                            <ArrowDown className="h-4 w-4 text-green-500" />
                          )}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">
                          {msg.telefone.replace(/(\d{2})(\d{2})(\d{5})(\d{4})/, '+$1 ($2) $3-$4')}
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-700 max-w-[300px] truncate">
                          {msg.conteudo?.substring(0, 100) ?? '—'}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${sc}`}>
                            {statusConfig[msg.status]?.label ?? msg.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">
                          {formatTimestamp(msg.enviadaEm)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>{data.total} mensagens total</span>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - limit))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span>Página {currentPage} de {totalPages}</span>
              <Button
                variant="ghost"
                size="sm"
                disabled={offset + limit >= data.total}
                onClick={() => setOffset(offset + limit)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
