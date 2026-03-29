'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import type { Usina, StatusUsina } from '@/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2 } from 'lucide-react';

const statusLabels: Record<StatusUsina, string> = {
  CADASTRADA: 'Cadastrada',
  AGUARDANDO_HOMOLOGACAO: 'Aguard. Homologacao',
  HOMOLOGADA: 'Homologada',
  EM_PRODUCAO: 'Em Producao',
  SUSPENSA: 'Suspensa',
};

const statusColors: Record<StatusUsina, string> = {
  CADASTRADA: 'bg-gray-100 text-gray-700',
  AGUARDANDO_HOMOLOGACAO: 'bg-yellow-100 text-yellow-800',
  HOMOLOGADA: 'bg-blue-100 text-blue-700',
  EM_PRODUCAO: 'bg-green-100 text-green-700',
  SUSPENSA: 'bg-red-100 text-red-700',
};

export default function UsinasPage() {
  const [usinas, setUsinas] = useState<Usina[]>([]);
  const [carregando, setCarregando] = useState(true);

  function carregarUsinas() {
    api.get<Usina[]>('/usinas')
      .then((r) => setUsinas(r.data))
      .finally(() => setCarregando(false));
  }

  useEffect(() => { carregarUsinas(); }, []);

  async function handleExcluir(id: string, nome: string) {
    if (!confirm(`Tem certeza que deseja excluir '${nome}'? Esta ação não pode ser desfeita.`)) return;
    try {
      await api.delete(`/usinas/${id}`);
      carregarUsinas();
    } catch {
      alert('Erro ao excluir usina.');
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Usinas</h2>
        <Link href="/dashboard/usinas/nova">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Nova Usina
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium text-gray-600">
            {carregando ? 'Carregando...' : `${usinas.length} registros`}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Potencia (kWp)</TableHead>
                <TableHead>Capacidade (kWh)</TableHead>
                <TableHead>Proprietário</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Cidade</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acoes</TableHead>
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
              ) : usinas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-gray-400 py-8">
                    Nenhuma usina cadastrada
                  </TableCell>
                </TableRow>
              ) : (
                usinas.map((u) => {
                  const st = (u.statusHomologacao || 'CADASTRADA') as StatusUsina;
                  return (
                    <TableRow key={u.id}>
                      <TableCell>
                        <Link href={`/dashboard/usinas/${u.id}`} className="text-blue-600 hover:underline font-medium">
                          {u.nome}
                        </Link>
                      </TableCell>
                      <TableCell>{Number(u.potenciaKwp).toFixed(2)}</TableCell>
                      <TableCell>{u.capacidadeKwh ? Number(u.capacidadeKwh).toFixed(2) : '—'}</TableCell>
                      <TableCell>{(u as any).proprietarioNome || '—'}</TableCell>
                      <TableCell>
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColors[st] ?? 'bg-gray-100'}`}>
                          {statusLabels[st] ?? st}
                        </span>
                      </TableCell>
                      <TableCell>{u.cidade}</TableCell>
                      <TableCell>{u.estado}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Link href={`/dashboard/usinas/${u.id}`}>
                            <Button variant="ghost" size="sm">Ver</Button>
                          </Link>
                          <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" title="Excluir" onClick={() => handleExcluir(u.id, u.nome)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
