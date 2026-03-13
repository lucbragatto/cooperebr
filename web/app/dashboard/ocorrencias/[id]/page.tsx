'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import type { Ocorrencia } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

const prioridadeClasses: Record<string, string> = {
  ALTA: 'bg-red-100 text-red-800 border-red-200',
  MEDIA: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  BAIXA: 'bg-blue-100 text-blue-800 border-blue-200',
  CRITICA: 'bg-red-200 text-red-900 border-red-300',
};

const prioridadeLabel: Record<string, string> = {
  ALTA: 'Alta',
  MEDIA: 'Média',
  BAIXA: 'Baixa',
  CRITICA: 'Crítica',
};

const statusLabel: Record<string, string> = {
  ABERTA: 'Aberta',
  EM_ANDAMENTO: 'Em Andamento',
  RESOLVIDA: 'Resolvida',
  CANCELADA: 'Cancelada',
};

const tipoLabel: Record<string, string> = {
  FALTA_ENERGIA: 'Falta de Energia',
  MEDICAO_INCORRETA: 'Medição Incorreta',
  PROBLEMA_FATURA: 'Problema na Fatura',
  SOLICITACAO: 'Solicitação',
  OUTROS: 'Outros',
};

function Campo({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className="text-sm font-medium text-gray-800">{value ?? '—'}</p>
    </div>
  );
}

export default function OcorrenciaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [ocorrencia, setOcorrencia] = useState<Ocorrencia | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => {
    api.get<Ocorrencia>(`/ocorrencias/${id}`)
      .then((r) => setOcorrencia(r.data))
      .catch(() => setErro('Ocorrência não encontrada.'))
      .finally(() => setCarregando(false));
  }, [id]);

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        <h2 className="text-2xl font-bold text-gray-800">Detalhe da Ocorrência</h2>
      </div>

      {carregando && <p className="text-gray-500">Carregando...</p>}
      {erro && <p className="text-red-500">{erro}</p>}

      {ocorrencia && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{tipoLabel[ocorrencia.tipo] ?? ocorrencia.tipo}</span>
              <Badge className={prioridadeClasses[ocorrencia.prioridade]}>
                {prioridadeLabel[ocorrencia.prioridade] ?? ocorrencia.prioridade}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-6">
            <Campo label="ID" value={ocorrencia.id} />
            <Campo label="Cooperado" value={ocorrencia.cooperado?.nomeCompleto} />
            <Campo label="UC" value={ocorrencia.uc?.numero} />
            <Campo label="Tipo" value={tipoLabel[ocorrencia.tipo] ?? ocorrencia.tipo} />
            <Campo label="Prioridade" value={prioridadeLabel[ocorrencia.prioridade] ?? ocorrencia.prioridade} />
            <Campo label="Status" value={statusLabel[ocorrencia.status] ?? ocorrencia.status} />
            <div className="col-span-2">
              <p className="text-xs text-gray-500 mb-0.5">Descrição</p>
              <p className="text-sm font-medium text-gray-800">{ocorrencia.descricao}</p>
            </div>
            {ocorrencia.resolucao && (
              <div className="col-span-2">
                <p className="text-xs text-gray-500 mb-0.5">Resolução</p>
                <p className="text-sm font-medium text-gray-800">{ocorrencia.resolucao}</p>
              </div>
            )}
            <Campo label="Criado em" value={new Date(ocorrencia.createdAt).toLocaleString('pt-BR')} />
            <Campo label="Atualizado em" value={new Date(ocorrencia.updatedAt).toLocaleString('pt-BR')} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
