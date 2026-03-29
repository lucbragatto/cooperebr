'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface AdminDetalhe {
  id: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  cnpj: string;
  email: string;
  telefone: string;
  responsavelNome: string;
  ativo: boolean;
  _count?: { condominios: number };
  condominios?: { id: string; nome: string; cidade: string; estado: string }[];
  createdAt: string;
}

export default function AdministradoraDetalhePage() {
  const params = useParams();
  const router = useRouter();
  const [admin, setAdmin] = useState<AdminDetalhe | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    api.get<AdminDetalhe>(`/administradoras/${params.id}`)
      .then(r => setAdmin(r.data))
      .catch(() => router.push('/dashboard/administradoras'))
      .finally(() => setCarregando(false));
  }, [params.id, router]);

  if (carregando) {
    return <p className="text-sm text-gray-500 py-8 text-center">Carregando...</p>;
  }

  if (!admin) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
        </Button>
        <h1 className="text-2xl font-bold text-gray-900">{admin.razaoSocial}</h1>
        {admin.nomeFantasia && <span className="text-gray-500">({admin.nomeFantasia})</span>}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados da Administradora</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Razão Social</p>
              <p className="font-medium">{admin.razaoSocial}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Nome Fantasia</p>
              <p className="font-medium">{admin.nomeFantasia || '—'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">CNPJ</p>
              <p className="font-medium">{admin.cnpj}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Email</p>
              <p className="font-medium">{admin.email}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Telefone</p>
              <p className="font-medium">{admin.telefone}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Responsável</p>
              <p className="font-medium">{admin.responsavelNome}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Status</p>
              <Badge className={admin.ativo ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}>
                {admin.ativo ? 'Ativa' : 'Inativa'}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-gray-500">Data de criação</p>
              <p className="font-medium">{new Date(admin.createdAt).toLocaleDateString('pt-BR')}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {admin.condominios && admin.condominios.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Condomínios ({admin.condominios.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {admin.condominios.map(c => (
                <Link key={c.id} href={`/dashboard/condominios/${c.id}`} className="block p-3 rounded-lg border hover:bg-gray-50 transition-colors">
                  <span className="font-medium text-blue-600 hover:underline">{c.nome}</span>
                  <span className="text-sm text-gray-500 ml-2">{c.cidade}/{c.estado}</span>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
