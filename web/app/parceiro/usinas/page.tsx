'use client';

/**
 * D-novo-AN AN.4 (M42, 2026-05-30) — Redirect /parceiro/usinas → /dashboard/usinas.
 *
 * A página antiga (cards display-only sem detalhe) foi deprecada conforme
 * decisão Luciano pós-investigação AN.3.1. A versão funcional completa
 * (lista + detalhe + editar + despesas + repasses + listas concessionária)
 * vive em /dashboard/usinas/* e recebeu toda evolução dos Sub-Sprints
 * F.5/F.6/F.7 + BH + AN.
 *
 * Mantemos esta rota como redirect pra proteger bookmarks antigos.
 * Sidebar do parceiro já foi atualizada pra apontar direto pra /dashboard/usinas.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function ParceiroUsinasRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/usinas');
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-gray-500">
      <Loader2 className="w-8 h-8 text-amber-600 animate-spin mb-3" />
      <p className="text-sm">Redirecionando para /dashboard/usinas…</p>
    </div>
  );
}
