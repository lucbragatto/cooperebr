'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import type { Cobranca } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

const statusClasses: Record<string, string> = {
  PENDENTE: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  PAGO: 'bg-green-100 text-green-800 border-green-200',
  VENCIDO: 'bg-red-100 text-red-800 border-red-200',
  CANCELADO: 'bg-gray-100 text-gray-800 border-gray-200',
};

const statusLabel: Record<string, string> = {
  PENDENTE: 'Pendente',
  PAGO: 'Pago',
  VENCIDO: 'Vencido',
  CANCELADO: 'Cancelado',
};

function formatBRL(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function Campo({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className="text-sm font-medium text-gray-800">{value ?? '—'}</p>
    </div>
  );
}

export default function CobrancaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [cobranca, setCobranca] = useState<Cobranca | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => {
    api.get<Cobranca>(`/cobrancas/${id}`)
      .then((r) => setCobranca(r.data))
      .catch(() => setErro('Cobrança não encontrada.'))
      .finally(() => setCarregando(false));
  }, [id]);

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        <h2 className="text-2xl font-bold text-gray-800">Detalhe da Cobrança</h2>
      </div>

      {carregando && <p className="text-gray-500">Carregando...</p>}
      {erro && <p className="text-red-500">{erro}</p>}

      {cobranca && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>
                Cobrança {String(cobranca.mesReferencia).padStart(2, '0')}/{cobranca.anoReferencia}
              </span>
              <Badge className={statusClasses[cobranca.status]}>
                {statusLabel[cobranca.status]}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-6">
            <Campo label="ID" value={cobranca.id} />
            <Campo label="Contrato" value={cobranca.contrato?.numero} />
            <Campo label="Mês/Ano Referência" value={`${String(cobranca.mesReferencia).padStart(2, '0')}/${cobranca.anoReferencia}`} />
            <Campo label="Valor Bruto" value={formatBRL(cobranca.valorBruto)} />
            <Campo label="Desconto (%)" value={`${cobranca.percentualDesconto}%`} />
            <Campo label="Valor Desconto" value={formatBRL(cobranca.valorDesconto)} />
            <Campo label="Valor Líquido" value={formatBRL(cobranca.valorLiquido)} />
            <Campo label="Status" value={statusLabel[cobranca.status]} />
            <Campo label="Vencimento" value={new Date(cobranca.dataVencimento).toLocaleDateString('pt-BR')} />
            <Campo label="Pagamento" value={cobranca.dataPagamento ? new Date(cobranca.dataPagamento).toLocaleDateString('pt-BR') : null} />
            <Campo label="Criado em" value={new Date(cobranca.createdAt).toLocaleString('pt-BR')} />
            <Campo label="Atualizado em" value={new Date(cobranca.updatedAt).toLocaleString('pt-BR')} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
