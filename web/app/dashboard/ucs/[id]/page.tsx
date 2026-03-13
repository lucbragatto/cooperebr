'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import type { UC } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

function Campo({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className="text-sm font-medium text-gray-800">{value ?? '—'}</p>
    </div>
  );
}

export default function UCDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [uc, setUc] = useState<UC | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => {
    api.get<UC>(`/ucs/${id}`)
      .then((r) => setUc(r.data))
      .catch(() => setErro('UC não encontrada.'))
      .finally(() => setCarregando(false));
  }, [id]);

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        <h2 className="text-2xl font-bold text-gray-800">Detalhe da UC</h2>
      </div>

      {carregando && <p className="text-gray-500">Carregando...</p>}
      {erro && <p className="text-red-500">{erro}</p>}

      {uc && (
        <Card>
          <CardHeader>
            <CardTitle>UC {uc.numero}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-6">
            <Campo label="ID" value={uc.id} />
            <Campo label="Número" value={uc.numero} />
            <Campo label="Endereço" value={uc.endereco} />
            <Campo label="Cidade" value={uc.cidade} />
            <Campo label="Estado" value={uc.estado} />
            <Campo label="Cooperado" value={uc.cooperado?.nomeCompleto} />
            <Campo label="ID do Cooperado" value={uc.cooperadoId} />
            <Campo label="Criado em" value={new Date(uc.createdAt).toLocaleString('pt-BR')} />
            <Campo label="Atualizado em" value={new Date(uc.updatedAt).toLocaleString('pt-BR')} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
