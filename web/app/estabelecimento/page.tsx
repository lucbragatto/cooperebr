'use client';

/**
 * Sprint Higiene de Rotas — Bloco B (14/06/2026, Decisão Luciano D2).
 *
 * Home do "Balcão do Clube" — redireciona pra /estabelecimento/receber
 * (fluxo principal do estabelecimento). O guard de ehEstabelecimento
 * está no layout.
 */
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function EstabelecimentoHomePage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/estabelecimento/receber');
  }, [router]);
  return null;
}
