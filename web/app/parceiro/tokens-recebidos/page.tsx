'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Coins } from 'lucide-react';

interface TransacaoToken {
  id: string;
  cooperadoId: string;
  cooperadoNome?: string;
  tipo: string;
  operacao: string;
  quantidade: number;
  saldoApos: number;
  descricao?: string;
  createdAt: string;
}

export default function TokensRecebidosPage() {
  const [transacoes, setTransacoes] = useState<TransacaoToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const PER_PAGE = 20;

  useEffect(() => {
    loadTransacoes();
  }, [page]);

  async function loadTransacoes() {
    setLoading(true);
    try {
      const { data } = await api.get('/cooper-token/admin/historico-parceiro', {
        params: { page, limit: PER_PAGE },
      });
      setTransacoes(data.items ?? data);
      setTotal(data.total ?? data.length ?? 0);
    } catch {
      setTransacoes([]);
    } finally {
      setLoading(false);
    }
  }

  const fmt = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  const fmtData = (d: string) => new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Coins className="h-6 w-6" /> Tokens Recebidos
      </h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Histórico de Transações</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-gray-500 py-8">Carregando...</p>
          ) : transacoes.length === 0 ? (
            <p className="text-center text-gray-500 py-8">Nenhuma transação encontrada.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-gray-500">
                      <th className="py-2 px-2">Data</th>
                      <th className="py-2 px-2">Tipo</th>
                      <th className="py-2 px-2">Operação</th>
                      <th className="py-2 px-2 text-right">CTK</th>
                      <th className="py-2 px-2 text-right">R$ est.</th>
                      <th className="py-2 px-2">Descrição</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transacoes.map((t) => (
                      <tr key={t.id} className="border-b hover:bg-gray-50">
                        <td className="py-2 px-2 text-xs">{fmtData(t.createdAt)}</td>
                        <td className="py-2 px-2">
                          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">{t.tipo}</span>
                        </td>
                        <td className="py-2 px-2">
                          <span className={`text-xs px-2 py-0.5 rounded ${t.operacao === 'CREDITO' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {t.operacao}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-right font-mono">{fmt(t.quantidade)}</td>
                        <td className="py-2 px-2 text-right font-mono text-gray-500">{fmt(t.quantidade * 0.20)}</td>
                        <td className="py-2 px-2 text-xs text-gray-600 max-w-[200px] truncate">{t.descricao || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {total > PER_PAGE && (
                <div className="flex justify-center gap-2 mt-4">
                  <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                    Anterior
                  </Button>
                  <span className="text-sm text-gray-500 self-center">Página {page}</span>
                  <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={transacoes.length < PER_PAGE}>
                    Próxima
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
