'use client';

/**
 * D-novo-PUX-A.2 (01/06/2026) — Página própria de criação de Convênio.
 *
 * Padrão Dual 17/05 Tipo B (entidade inteira → página própria).
 * Substitui o Dialog "Novo convênio" da página de lista.
 */

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { ArrowLeft, FileCheck } from 'lucide-react';
import { ConvenioForm, type ConvenioFormData } from '@/components/convenios/ConvenioForm';
import { ConvenioHelp } from '@/components/convenios/ConvenioHelp';

export default function NovoConvenioPage() {
  const router = useRouter();

  async function handleSubmit(dados: ConvenioFormData) {
    await api.post('/contabilidade-tributaria/convenios', {
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
          Novo Convênio
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Cadastre o acordo formal com classificação fiscal pra defender ato auxiliar (Art. 88).
        </p>
      </div>

      <ConvenioHelp storageId="convenios-novo-explicacao" />

      <ConvenioForm
        onSubmit={handleSubmit}
        onCancel={() => router.push('/dashboard/contabilidade/convenios')}
        textoSubmit="Criar convênio"
      />
    </div>
  );
}
