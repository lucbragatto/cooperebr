'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Search, Loader2, User, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import api from '@/lib/api';

const statusCores: Record<string, string> = {
  ATIVO: 'bg-green-100 text-green-700',
  ATIVO_RECEBENDO_CREDITOS: 'bg-green-100 text-green-700',
  PENDENTE: 'bg-yellow-100 text-yellow-700',
  PENDENTE_VALIDACAO: 'bg-yellow-100 text-yellow-700',
  PENDENTE_DOCUMENTOS: 'bg-orange-100 text-orange-700',
  AGUARDANDO_CONCESSIONARIA: 'bg-blue-100 text-blue-700',
  APROVADO: 'bg-blue-100 text-blue-700',
  SUSPENSO: 'bg-red-100 text-red-700',
  ENCERRADO: 'bg-gray-100 text-gray-500',
};

const statusLabels: Record<string, string> = {
  ATIVO: 'Ativo',
  ATIVO_RECEBENDO_CREDITOS: 'Ativo',
  PENDENTE: 'Pendente',
  PENDENTE_VALIDACAO: 'Validação',
  PENDENTE_DOCUMENTOS: 'Documentos',
  AGUARDANDO_CONCESSIONARIA: 'Concessionária',
  APROVADO: 'Aprovado',
  SUSPENSO: 'Suspenso',
  ENCERRADO: 'Encerrado',
};

export default function ParceiroMembrosPage() {
  const [membros, setMembros] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('TODOS');

  useEffect(() => {
    async function carregar() {
      try {
        const { data } = await api.get('/cooperados');
        setMembros(Array.isArray(data) ? data : data?.data ?? []);
      } catch {
        // ignore
      } finally {
        setCarregando(false);
      }
    }
    carregar();
  }, []);

  const filtrados = membros.filter((m) => {
    const matchBusca =
      !busca ||
      m.nomeCompleto?.toLowerCase().includes(busca.toLowerCase()) ||
      m.cpf?.includes(busca) ||
      m.email?.toLowerCase().includes(busca.toLowerCase());
    const matchStatus = filtroStatus === 'TODOS' || m.status === filtroStatus;
    return matchBusca && matchStatus;
  });

  if (carregando) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Membros</h1>
        <p className="text-sm text-gray-500 mt-1">{membros.length} membro(s) cadastrado(s)</p>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Buscar por nome, CPF ou email..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white"
        >
          <option value="TODOS">Todos os status</option>
          <option value="ATIVO">Ativo</option>
          <option value="PENDENTE">Pendente</option>
          <option value="SUSPENSO">Suspenso</option>
          <option value="ENCERRADO">Encerrado</option>
        </select>
      </div>

      {/* Lista */}
      <div className="bg-white rounded-lg border divide-y">
        {filtrados.length === 0 ? (
          <div className="text-center py-12 text-gray-500 text-sm">
            Nenhum membro encontrado.
          </div>
        ) : (
          filtrados.map((m) => (
            <Link
              key={m.id}
              href={`/parceiro/membros/${m.id}`}
              className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-50 text-blue-600 shrink-0">
                <User className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-gray-900 truncate">{m.nomeCompleto}</p>
                <p className="text-xs text-gray-500">{m.cpf} &middot; {m.email}</p>
              </div>
              <Badge className={statusCores[m.status] ?? 'bg-gray-100 text-gray-500'}>
                {statusLabels[m.status] ?? m.status}
              </Badge>
              <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
