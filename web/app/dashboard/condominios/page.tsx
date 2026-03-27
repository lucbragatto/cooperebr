'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Search, Building, MapPin } from 'lucide-react';
import Link from 'next/link';

interface Condominio {
  id: string;
  nome: string;
  cnpj: string | null;
  endereco: string;
  cidade: string;
  estado: string;
  modeloRateio: string;
  ativo: boolean;
  administradora?: { razaoSocial: string } | null;
  _count: { unidades: number };
  createdAt: string;
}

const RATEIO_LABELS: Record<string, string> = {
  PROPORCIONAL_CONSUMO: 'Proporcional',
  IGUALITARIO: 'Igualitario',
  FRACAO_IDEAL: 'Fracao Ideal',
  PERSONALIZADO: 'Personalizado',
};

export default function CondominiosPage() {
  const [condominios, setCondominios] = useState<Condominio[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState('');

  useEffect(() => {
    api.get<Condominio[]>('/condominios')
      .then(r => setCondominios(r.data))
      .finally(() => setCarregando(false));
  }, []);

  const filtrados = condominios.filter(c => {
    if (!busca.trim()) return true;
    const t = busca.toLowerCase();
    return c.nome.toLowerCase().includes(t) || c.cidade.toLowerCase().includes(t) || (c.cnpj && c.cnpj.includes(t));
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Condominios</h2>
        <Link href="/dashboard/condominios/novo">
          <Button><Plus className="h-4 w-4 mr-2" /> Novo Condominio</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="text-base font-medium text-gray-600">
              {carregando ? 'Carregando...' : `${filtrados.length} condominios`}
            </CardTitle>
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input placeholder="Buscar por nome, cidade ou CNPJ..." value={busca} onChange={e => setBusca(e.target.value)} className="pl-9" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Cidade/UF</TableHead>
                <TableHead>Administradora</TableHead>
                <TableHead>Rateio</TableHead>
                <TableHead>Unidades</TableHead>
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
              ) : filtrados.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-gray-400 py-8">
                    <Building className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                    Nenhum condominio cadastrado
                  </TableCell>
                </TableRow>
              ) : (
                filtrados.map(c => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <Link href={`/dashboard/condominios/${c.id}`} className="font-medium text-blue-600 hover:underline">
                        {c.nome}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {c.cidade}/{c.estado}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{c.administradora?.razaoSocial ?? <span className="text-gray-400">&mdash;</span>}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{RATEIO_LABELS[c.modeloRateio] ?? c.modeloRateio}</Badge>
                    </TableCell>
                    <TableCell className="text-sm font-medium">{c._count.unidades}</TableCell>
                    <TableCell>
                      <Badge className={c.ativo ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}>
                        {c.ativo ? 'Ativo' : 'Inativo'}
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
