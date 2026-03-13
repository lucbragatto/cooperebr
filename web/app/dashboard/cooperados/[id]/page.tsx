'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import type { Cooperado } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

const statusVariant: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  ATIVO: 'default',
  PENDENTE: 'secondary',
  SUSPENSO: 'outline',
  ENCERRADO: 'destructive',
};

const statusLabel: Record<string, string> = {
  ATIVO: 'Ativo',
  PENDENTE: 'Pendente',
  SUSPENSO: 'Suspenso',
  ENCERRADO: 'Encerrado',
};

function Campo({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className="text-sm font-medium text-gray-800">{value ?? '—'}</p>
    </div>
  );
}

export default function CooperadoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [cooperado, setCooperado] = useState<Cooperado | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => {
    api.get<Cooperado>(`/cooperados/${id}`)
      .then((r) => setCooperado(r.data))
      .catch(() => setErro('Cooperado não encontrado.'))
      .finally(() => setCarregando(false));
  }, [id]);

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        <h2 className="text-2xl font-bold text-gray-800">Detalhe do Cooperado</h2>
      </div>

      {carregando && <p className="text-gray-500">Carregando...</p>}
      {erro && <p className="text-red-500">{erro}</p>}

      {cooperado && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{cooperado.nomeCompleto}</span>
              <Badge variant={statusVariant[cooperado.status]}>
                {statusLabel[cooperado.status]}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-6">
            <Campo label="ID" value={cooperado.id} />
            <Campo label="CPF" value={cooperado.cpf} />
            <Campo label="Email" value={cooperado.email} />
            <Campo label="Telefone" value={cooperado.telefone} />
            <Campo label="Status" value={statusLabel[cooperado.status]} />
            <Campo label="Criado em" value={new Date(cooperado.createdAt).toLocaleString('pt-BR')} />
            <Campo label="Atualizado em" value={new Date(cooperado.updatedAt).toLocaleString('pt-BR')} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
