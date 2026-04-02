'use client';

import { useContexto } from './useContexto';

export function useModulos() {
  const { meData, contextoAtivo } = useContexto();
  const contexto = meData?.contextos.find((c) => c.tipo === contextoAtivo);
  const modulos: string[] = contexto?.modulosAtivos ?? [];
  const modalidades: Record<string, string> = contexto?.modalidadesAtivas ?? {};

  return {
    temModulo: (modulo: string) => contextoAtivo === 'super_admin' || modulos.includes(modulo),
    modalidade: (modulo: string) => modalidades[modulo] ?? 'STANDALONE',
    modulos,
  };
}
