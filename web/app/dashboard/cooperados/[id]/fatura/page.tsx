'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import type { Cooperado } from '@/types';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import FaturaUploadOCR from '@/components/FaturaUploadOCR';

export default function ProcessarFaturaPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [cooperado, setCooperado] = useState<Cooperado | null>(null);

  useEffect(() => {
    api
      .get<Cooperado>(`/cooperados/${id}`)
      .then((r) => setCooperado(r.data))
      .catch(() => {
        alert('Erro ao carregar dados do cooperado.');
      });
  }, [id]);

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="sm" onClick={() => router.push(`/dashboard/cooperados/${id}`)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        <h2 className="text-2xl font-bold text-gray-800">
          Processar Fatura{cooperado ? ` — ${cooperado.nomeCompleto}` : ''}
        </h2>
      </div>

      <FaturaUploadOCR cooperadoId={id} />
    </div>
  );
}
