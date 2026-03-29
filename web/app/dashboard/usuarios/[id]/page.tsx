'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface UsuarioDetalhe {
  id: string;
  nome: string;
  email: string;
  telefone?: string | null;
  perfil: string;
  ativo: boolean;
  cooperativaId: string | null;
  cooperativa?: { nome: string } | null;
  createdAt: string;
}

const perfilLabels: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  OPERADOR: 'Operador',
  COOPERADO: 'Cooperado',
};

export default function UsuarioDetalhePage() {
  const params = useParams();
  const router = useRouter();
  const [usuario, setUsuario] = useState<UsuarioDetalhe | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    api.get<UsuarioDetalhe>(`/auth/usuarios/${params.id}`)
      .then(r => setUsuario(r.data))
      .catch(() => router.push('/dashboard/usuarios'))
      .finally(() => setCarregando(false));
  }, [params.id, router]);

  if (carregando) {
    return <p className="text-sm text-gray-500 py-8 text-center">Carregando...</p>;
  }

  if (!usuario) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/usuarios">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
          </Button>
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">{usuario.nome}</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados do Usuário</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Nome</p>
              <p className="font-medium">{usuario.nome}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Email</p>
              <p className="font-medium">{usuario.email}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Telefone</p>
              <p className="font-medium">{usuario.telefone || '—'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Perfil</p>
              <Badge variant="secondary">{perfilLabels[usuario.perfil] || usuario.perfil}</Badge>
            </div>
            <div>
              <p className="text-sm text-gray-500">Status</p>
              <Badge variant={usuario.ativo ? 'default' : 'destructive'}>
                {usuario.ativo ? 'Ativo' : 'Inativo'}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-gray-500">Parceiro</p>
              <p className="font-medium">{usuario.cooperativa?.nome || '—'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Data de criação</p>
              <p className="font-medium">{new Date(usuario.createdAt).toLocaleDateString('pt-BR')}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
