'use client';

/**
 * D-novo-BH BH.3.1 (M37, 29/05/2026) — Página própria de lançamento de despesa.
 *
 * Padrão UX Dual 17/05 Tipo B (entidade inteira → página própria).
 * Substitui o DialogLancarDespesa (que violava o padrão).
 *
 * Reusa DespesaForm + UploadComprovante.
 */

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import {
  DespesaForm,
  type DespesaFormData,
} from '@/components/despesas/DespesaForm';
import api from '@/lib/api';

export default function NovaDespesaPage() {
  const params = useParams();
  const router = useRouter();
  const usinaId = params?.id as string;

  const [nomeUsina, setNomeUsina] = useState<string>('');
  const [matriz, setMatriz] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!usinaId) return;
    api
      .get<{ nome: string; responsabilidadeDespesas?: Record<string, string> }>(`/usinas/${usinaId}`)
      .then((r) => {
        setNomeUsina(r.data.nome ?? '');
        setMatriz(r.data.responsabilidadeDespesas ?? {});
      })
      .catch(() => {
        // silently ignore — form abre vazio
      });
  }, [usinaId]);

  async function handleSubmit(dados: DespesaFormData) {
    const payload: Record<string, unknown> = {
      usinaId,
      dataOcorrencia: dados.dataOcorrencia,
      categoria: dados.categoria,
      valor: parseFloat(dados.valor),
      descricao: dados.descricao.trim(),
      quemPagouTipo: dados.quemPagouTipo,
      tratamento: dados.tratamento,
    };
    if (dados.quemPagouTipo === 'TERCEIRO' && dados.quemPagouNome.trim()) {
      payload.quemPagouNome = dados.quemPagouNome.trim();
    }
    if (dados.comprovante.trim()) {
      payload.comprovante = dados.comprovante.trim();
    }

    await api.post('/contas-pagar/propor', payload);
    router.push(`/dashboard/usinas/${usinaId}/despesas`);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/dashboard/usinas/${usinaId}/despesas`)}
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Voltar
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            Lançar despesa operacional
          </h1>
          {nomeUsina && (
            <p className="text-sm text-gray-500 mt-0.5">{nomeUsina}</p>
          )}
        </div>
      </div>

      <DespesaForm
        usinaId={usinaId}
        modo="admin-lancar"
        matrizCamada1={matriz}
        onSubmit={handleSubmit}
        onCancelar={() => router.push(`/dashboard/usinas/${usinaId}/despesas`)}
      />
    </div>
  );
}
