'use client';

import { useEffect, useState } from 'react';
import { Gift } from 'lucide-react';
import api from '@/lib/api';
import ConviteCard from '@/components/ConviteCard';
import { Badge } from '@/components/ui/badge';

interface Indicacao {
  id: string;
  nivel: number;
  status: string;
  createdAt: string;
  cooperadoIndicado: { nomeCompleto: string };
}

export default function MeuConvitePage() {
  const [indicacoes, setIndicacoes] = useState<Indicacao[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<Indicacao[]>('/indicacoes/minhas')
      .then(({ data }) => setIndicacoes(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-8">
      <div className="text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Gift className="h-6 w-6 text-green-600" />
          <h1 className="text-2xl font-bold text-gray-800">Convide seus amigos!</h1>
        </div>
        <p className="text-gray-500">
          Cada amigo que você indicar e pagar a primeira fatura gera um benefício para você!
        </p>
      </div>

      <div className="flex justify-center">
        <ConviteCard />
      </div>

      {/* Tabela de indicações */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h2 className="font-semibold text-gray-800">Suas indicações</h2>
        </div>

        {loading ? (
          <div className="p-6 text-center text-sm text-gray-400">Carregando...</div>
        ) : indicacoes.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-500">
            Você ainda não fez nenhuma indicação. Compartilhe seu link acima!
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase">
                <th className="px-6 py-3">Nome</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Data</th>
              </tr>
            </thead>
            <tbody>
              {indicacoes.map((ind) => (
                <tr key={ind.id} className="border-t hover:bg-gray-50">
                  <td className="px-6 py-3 font-medium text-gray-800">
                    {ind.cooperadoIndicado?.nomeCompleto ?? '—'}
                  </td>
                  <td className="px-6 py-3">
                    <StatusBadge status={ind.status} />
                  </td>
                  <td className="px-6 py-3 text-gray-500">
                    {new Date(ind.createdAt).toLocaleDateString('pt-BR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    PENDENTE: { label: 'Pendente', className: 'bg-yellow-100 text-yellow-800' },
    PRIMEIRA_FATURA_PAGA: { label: 'Ativo', className: 'bg-green-100 text-green-800' },
    CANCELADO: { label: 'Cancelado', className: 'bg-red-100 text-red-800' },
  };
  const cfg = map[status] ?? { label: status, className: 'bg-gray-100 text-gray-800' };
  return <Badge className={cfg.className}>{cfg.label}</Badge>;
}
