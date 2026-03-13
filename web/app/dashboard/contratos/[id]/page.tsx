'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import type { Contrato } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

const statusClasses: Record<string, string> = {
  ATIVO: 'bg-green-100 text-green-800 border-green-200',
  SUSPENSO: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  ENCERRADO: 'bg-red-100 text-red-800 border-red-200',
};

const statusLabel: Record<string, string> = {
  ATIVO: 'Ativo',
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

export default function ContratoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [contrato, setContrato] = useState<Contrato | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => {
    api.get<Contrato>(`/contratos/${id}`)
      .then((r) => setContrato(r.data))
      .catch(() => setErro('Contrato não encontrado.'))
      .finally(() => setCarregando(false));
  }, [id]);

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        <h2 className="text-2xl font-bold text-gray-800">Detalhe do Contrato</h2>
      </div>

      {carregando && <p className="text-gray-500">Carregando...</p>}
      {erro && <p className="text-red-500">{erro}</p>}

      {contrato && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Contrato {contrato.numero}</span>
              <Badge className={statusClasses[contrato.status]}>
                {statusLabel[contrato.status]}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-6">
            <Campo label="ID" value={contrato.id} />
            <Campo label="Número" value={contrato.numero} />
            <Campo label="Cooperado" value={contrato.cooperado?.nomeCompleto} />
            <Campo label="UC" value={contrato.uc?.numero} />
            <Campo label="Usina" value={contrato.usina?.nome} />
            <Campo label="Desconto (%)" value={`${contrato.percentualDesconto}%`} />
            <Campo label="Status" value={statusLabel[contrato.status]} />
            <Campo label="Data Início" value={new Date(contrato.dataInicio).toLocaleDateString('pt-BR')} />
            <Campo label="Data Fim" value={contrato.dataFim ? new Date(contrato.dataFim).toLocaleDateString('pt-BR') : null} />
            <Campo label="Criado em" value={new Date(contrato.createdAt).toLocaleString('pt-BR')} />
            <Campo label="Atualizado em" value={new Date(contrato.updatedAt).toLocaleString('pt-BR')} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
