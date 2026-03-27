'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Search, Building2 } from 'lucide-react';
import Link from 'next/link';

interface Administradora {
  id: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  cnpj: string;
  email: string;
  telefone: string;
  responsavelNome: string;
  ativo: boolean;
  _count: { condominios: number };
  createdAt: string;
}

export default function AdministradorasPage() {
  const [administradoras, setAdministradoras] = useState<Administradora[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState('');

  useEffect(() => {
    api.get<Administradora[]>('/administradoras')
      .then(r => setAdministradoras(r.data))
      .finally(() => setCarregando(false));
  }, []);

  const filtradas = administradoras.filter(a => {
    if (!busca.trim()) return true;
    const t = busca.toLowerCase();
    return a.razaoSocial.toLowerCase().includes(t) || a.cnpj.includes(t) || (a.nomeFantasia && a.nomeFantasia.toLowerCase().includes(t));
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Administradoras</h2>
        <Link href="/dashboard/administradoras/novo">
          <Button><Plus className="h-4 w-4 mr-2" /> Nova Administradora</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="text-base font-medium text-gray-600">
              {carregando ? 'Carregando...' : `${filtradas.length} administradoras`}
            </CardTitle>
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input placeholder="Buscar por nome ou CNPJ..." value={busca} onChange={e => setBusca(e.target.value)} className="pl-9" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Razao Social</TableHead>
                <TableHead>CNPJ</TableHead>
                <TableHead>Responsavel</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Condominios</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {carregando ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <TableCell key={j}><div className="h-4 bg-gray-200 animate-pulse rounded w-3/4" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : filtradas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-gray-400 py-8">
                    <Building2 className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                    Nenhuma administradora cadastrada
                  </TableCell>
                </TableRow>
              ) : (
                filtradas.map(a => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <div>
                        <span className="font-medium text-gray-800">{a.razaoSocial}</span>
                        {a.nomeFantasia && <span className="text-xs text-gray-400 ml-2">({a.nomeFantasia})</span>}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">{a.cnpj}</TableCell>
                    <TableCell className="text-sm">{a.responsavelNome}</TableCell>
                    <TableCell className="text-sm text-gray-600">{a.email}</TableCell>
                    <TableCell className="text-sm font-medium">{a._count.condominios}</TableCell>
                    <TableCell>
                      <Badge className={a.ativo ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}>
                        {a.ativo ? 'Ativa' : 'Inativa'}
                      </Badge>
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
