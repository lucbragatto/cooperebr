'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import type { Usina } from '@/types';
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

export default function UsinaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [usina, setUsina] = useState<Usina | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => {
    api.get<Usina>(`/usinas/${id}`)
      .then((r) => setUsina(r.data))
      .catch(() => setErro('Usina não encontrada.'))
      .finally(() => setCarregando(false));
  }, [id]);

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        <h2 className="text-2xl font-bold text-gray-800">Detalhe da Usina</h2>
      </div>

      {carregando && <p className="text-gray-500">Carregando...</p>}
      {erro && <p className="text-red-500">{erro}</p>}

      {usina && (
        <Card>
          <CardHeader>
            <CardTitle>{usina.nome}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-6">
            <Campo label="ID" value={usina.id} />
            <Campo label="Nome" value={usina.nome} />
            <Campo label="Potência (kWp)" value={Number(usina.potenciaKwp).toFixed(2)} />
            <Campo label="Cidade" value={usina.cidade} />
            <Campo label="Estado" value={usina.estado} />
            <Campo label="Criado em" value={new Date(usina.createdAt).toLocaleString('pt-BR')} />
            <Campo label="Atualizado em" value={new Date(usina.updatedAt).toLocaleString('pt-BR')} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
