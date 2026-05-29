'use client';

/**
 * D-novo-BH BH.4 (M37, 29/05/2026) — Página de proposta de despesa do proprietário.
 *
 * Padrão UX Dual 17/05 Tipo B (entidade inteira → página própria).
 * Fluxo: proprietário escolhe uma das suas usinas → DespesaForm modo
 * `proprietario-propor` → backend cria status=PROPOSTA → admin aprova.
 *
 * Reusa DespesaForm + UploadComprovante.
 */

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, Sun } from 'lucide-react';
import {
  DespesaForm,
  type DespesaFormData,
} from '@/components/despesas/DespesaForm';
import api from '@/lib/api';

interface UsinaResumo {
  id: string;
  nome: string;
  apelidoInterno?: string | null;
}

interface DashboardResponse {
  usinas: UsinaResumo[];
}

interface DetalheUsinaResponse {
  responsabilidadeDespesas?: Record<string, string> | null;
}

export default function NovaDespesaProprietarioPage() {
  const router = useRouter();

  const [usinas, setUsinas] = useState<UsinaResumo[]>([]);
  const [carregandoUsinas, setCarregandoUsinas] = useState(true);
  const [usinaId, setUsinaId] = useState<string>('');
  const [matriz, setMatriz] = useState<Record<string, string>>({});
  const [carregandoMatriz, setCarregandoMatriz] = useState(false);

  useEffect(() => {
    api
      .get<DashboardResponse>('/proprietario/dashboard')
      .then((r) => {
        const lista = r.data.usinas ?? [];
        setUsinas(lista);
        if (lista.length === 1) {
          setUsinaId(lista[0].id);
        }
      })
      .catch(() => setUsinas([]))
      .finally(() => setCarregandoUsinas(false));
  }, []);

  useEffect(() => {
    if (!usinaId) {
      setMatriz({});
      return;
    }
    setCarregandoMatriz(true);
    api
      .get<DetalheUsinaResponse>(`/proprietario/usinas/${usinaId}`)
      .then((r) => setMatriz(r.data.responsabilidadeDespesas ?? {}))
      .catch(() => setMatriz({}))
      .finally(() => setCarregandoMatriz(false));
  }, [usinaId]);

  const usinaSelecionada = useMemo(
    () => usinas.find((u) => u.id === usinaId) ?? null,
    [usinas, usinaId],
  );

  async function handleSubmit(dados: DespesaFormData) {
    if (!usinaId) {
      throw new Error('Selecione uma usina antes de enviar.');
    }
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
    router.push('/proprietario/despesas');
  }

  if (carregandoUsinas) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-amber-600 animate-spin" />
      </div>
    );
  }

  if (usinas.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push('/proprietario/despesas')}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Voltar
          </Button>
        </div>
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Nenhuma usina vinculada ao seu perfil — não é possível propor despesa.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/proprietario/despesas')}
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Voltar
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            Propor despesa operacional
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Sua proposta será enviada ao admin do parceiro para aprovação.
          </p>
        </div>
      </div>

      {/* Seletor de usina */}
      <div className="max-w-2xl space-y-1">
        <label htmlFor="usina-select" className="text-sm font-medium text-gray-700">
          Usina *
        </label>
        <select
          id="usina-select"
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white"
          value={usinaId}
          onChange={(e) => setUsinaId(e.target.value)}
          disabled={usinas.length === 1}
        >
          {usinas.length > 1 && <option value="">— Selecione a usina —</option>}
          {usinas.map((u) => (
            <option key={u.id} value={u.id}>
              {u.nome}
              {u.apelidoInterno ? ` (${u.apelidoInterno})` : ''}
            </option>
          ))}
        </select>
        {usinaSelecionada && (
          <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
            <Sun className="w-3 h-3 text-amber-500" />
            Lançando para <strong>{usinaSelecionada.nome}</strong>
          </p>
        )}
      </div>

      {usinaId && !carregandoMatriz && (
        <DespesaForm
          usinaId={usinaId}
          modo="proprietario-propor"
          matrizCamada1={matriz}
          onSubmit={handleSubmit}
          onCancelar={() => router.push('/proprietario/despesas')}
        />
      )}

      {usinaId && carregandoMatriz && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" /> Carregando dados da usina…
        </div>
      )}
    </div>
  );
}
