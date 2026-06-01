'use client';

/**
 * D-novo-PUX-A.2 (01/06/2026) — Página própria de edição de Convênio.
 *
 * Padrão Dual 17/05 Tipo B (entidade inteira → página própria).
 * useParams RAW (lição BF — não envolve em hook custom que esconde re-render).
 */

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { ArrowLeft, FileCheck, Loader2 } from 'lucide-react';
import { ConvenioForm, type ConvenioFormData } from '@/components/convenios/ConvenioForm';
import { ConvenioHelp } from '@/components/convenios/ConvenioHelp';

type ConvenioApi = {
  id: string;
  nome: string;
  descricao: string | null;
  fluxoFinanceiro: string;
  classificacaoFiscal: string;
  vigenciaInicio: string;
  vigenciaFim: string | null;
  ativo: boolean;
};

export default function EditarConvenioPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [convenio, setConvenio] = useState<ConvenioApi | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setErro('');
    api
      .get<ConvenioApi>(`/contabilidade-tributaria/convenios/${id}`)
      .then((r) => setConvenio(r.data))
      .catch((err) => setErro(err?.response?.data?.message || 'Falha ao carregar convênio'))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSubmit(dados: ConvenioFormData) {
    await api.patch(`/contabilidade-tributaria/convenios/${id}`, {
      nome: dados.nome,
      descricao: dados.descricao || undefined,
      fluxoFinanceiro: dados.fluxoFinanceiro,
      classificacaoFiscal: dados.classificacaoFiscal,
      vigenciaInicio: dados.vigenciaInicio,
      vigenciaFim: dados.vigenciaFim || undefined,
    });
    router.push('/dashboard/contabilidade/convenios');
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <Link
          href="/dashboard/contabilidade/convenios"
          className="text-sm text-cyan-700 hover:underline flex items-center gap-1"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar pra Convênios
        </Link>
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2 mt-2">
          <FileCheck className="h-6 w-6 text-cyan-700" />
          Editar Convênio
        </h1>
      </div>

      <ConvenioHelp storageId="convenios-editar-explicacao" />

      {loading && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-cyan-700" />
        </div>
      )}

      {erro && (
        <div className="bg-red-50 border-l-4 border-red-500 p-3 text-sm text-red-700 rounded">
          {erro}
        </div>
      )}

      {!loading && convenio && (
        <ConvenioForm
          inicial={{
            nome: convenio.nome,
            descricao: convenio.descricao ?? '',
            fluxoFinanceiro: convenio.fluxoFinanceiro,
            classificacaoFiscal: convenio.classificacaoFiscal,
            vigenciaInicio: convenio.vigenciaInicio.slice(0, 10),
            vigenciaFim: convenio.vigenciaFim ? convenio.vigenciaFim.slice(0, 10) : '',
          }}
          onSubmit={handleSubmit}
          onCancel={() => router.push('/dashboard/contabilidade/convenios')}
          textoSubmit="Salvar alterações"
        />
      )}
    </div>
  );
}
