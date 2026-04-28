'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import api from '@/lib/api';
import type { ResumoParceiro } from '@/types';
import { Building2, Search, ChevronRight } from 'lucide-react';

function formatBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function ParceirosListPage() {
  const [parceiros, setParceiros] = useState<ResumoParceiro[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [busca, setBusca] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<string>('todos');
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');

  useEffect(() => {
    api
      .get<ResumoParceiro[]>('/saas/parceiros')
      .then((res) => setParceiros(res.data))
      .catch((e) => setErro(e?.response?.data?.message ?? e?.message ?? 'Erro ao carregar'))
      .finally(() => setLoading(false));
  }, []);

  const parceirosFiltrados = useMemo(() => {
    return parceiros.filter((p) => {
      if (busca && !p.nome.toLowerCase().includes(busca.toLowerCase())) return false;
      if (filtroTipo !== 'todos' && p.tipoParceiro !== filtroTipo) return false;
      if (filtroStatus !== 'todos' && p.statusSaas !== filtroStatus) return false;
      return true;
    });
  }, [parceiros, busca, filtroTipo, filtroStatus]);

  const corBadge = (cor: 'verde' | 'amarelo' | 'vermelho') => {
    if (cor === 'vermelho') return 'bg-red-100 text-red-800 border-red-200';
    if (cor === 'amarelo') return 'bg-amber-100 text-amber-800 border-amber-200';
    return 'bg-green-100 text-green-800 border-green-200';
  };

  if (loading) return <div className="p-6 text-gray-500">Carregando parceiros…</div>;
  if (erro) {
    return (
      <div className="p-6">
        <Card className="p-4 bg-red-50 border-red-200 text-red-800">Erro: {erro}</Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-800">Parceiros</h1>
        <p className="text-sm text-gray-500">
          {parceiros.length} parceiro(s) cadastrado(s) no SISGD · {parceirosFiltrados.length}{' '}
          mostrado(s)
        </p>
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Busca</label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400 pointer-events-none" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Nome do parceiro..."
                className="pl-9"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">
              Tipo de parceiro
            </label>
            <Select value={filtroTipo} onValueChange={setFiltroTipo}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="COOPERATIVA">Cooperativa</SelectItem>
                <SelectItem value="CONSORCIO">Consórcio</SelectItem>
                <SelectItem value="ASSOCIACAO">Associação</SelectItem>
                <SelectItem value="CONDOMINIO">Condomínio</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Status SaaS</label>
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="ATIVO">Ativo</SelectItem>
                <SelectItem value="TRIAL">Trial</SelectItem>
                <SelectItem value="INADIMPLENTE">Inadimplente</SelectItem>
                <SelectItem value="SUSPENSO">Suspenso</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {parceirosFiltrados.length === 0 ? (
        <Card className="p-8 text-center text-gray-500">
          Nenhum parceiro corresponde aos filtros.
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr className="text-left text-xs text-gray-600 uppercase">
                <th className="px-4 py-3">Parceiro</th>
                <th className="px-4 py-3">Plano</th>
                <th className="px-4 py-3 text-right">Membros</th>
                <th className="px-4 py-3 text-right">Contratos</th>
                <th className="px-4 py-3 text-right">Cobranças (mês)</th>
                <th className="px-4 py-3 text-center">Saúde</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {parceirosFiltrados.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Building2 className="w-5 h-5 text-blue-600 shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium truncate">{p.nome}</p>
                        <div className="flex gap-2 mt-0.5 flex-wrap">
                          <Badge variant="outline" className="text-xs">
                            {p.tipoParceiro}
                          </Badge>
                          {p.statusSaas === 'TRIAL' && (
                            <Badge
                              variant="outline"
                              className="text-xs bg-blue-50 text-blue-700 border-blue-200"
                            >
                              TRIAL
                            </Badge>
                          )}
                          {p.statusSaas === 'SUSPENSO' && (
                            <Badge
                              variant="outline"
                              className="text-xs bg-red-50 text-red-700 border-red-200"
                            >
                              SUSPENSO
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {p.planoSaas ? (
                      <div>
                        <p className="font-medium">{p.planoSaas.nome}</p>
                        <p className="text-xs text-gray-500">
                          {formatBRL(p.planoSaas.mensalidadeBase)}/mês
                        </p>
                      </div>
                    ) : (
                      <span className="text-gray-400 text-xs italic">Sem plano</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-sm">
                    <p className="font-medium">{p.membros.ativos}</p>
                    <p className="text-xs text-gray-500">de {p.membros.total} total</p>
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-medium">
                    {p.contratosAtivos}
                  </td>
                  <td className="px-4 py-3 text-right text-sm">
                    <p className="font-medium">{formatBRL(p.cobrancasMes.receitaPaga)}</p>
                    <p className="text-xs text-gray-500">
                      {p.cobrancasMes.pagas} paga(s) · {p.cobrancasMes.vencidas} venc(s)
                    </p>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge className={corBadge(p.saude.cor)}>
                      {p.saude.taxaInadimplencia}% inad.
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/dashboard/super-admin/parceiros/${p.id}`}
                      className="text-blue-600 hover:text-blue-800 inline-flex"
                      aria-label={`Detalhe ${p.nome}`}
                    >
                      <ChevronRight className="w-5 h-5" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
