'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';

type TipoParceiro = 'COOPERATIVA' | 'CONSORCIO' | 'ASSOCIACAO' | 'CONDOMINIO';

const LABEL_MAP: Record<TipoParceiro, { singular: string; plural: string }> = {
  COOPERATIVA: { singular: 'Cooperado', plural: 'Cooperados' },
  CONSORCIO: { singular: 'Consorciado', plural: 'Consorciados' },
  ASSOCIACAO: { singular: 'Associado', plural: 'Associados' },
  CONDOMINIO: { singular: 'Condômino', plural: 'Condôminos' },
};

export function useTipoParceiro() {
  const [tipoParceiro, setTipoParceiro] = useState<TipoParceiro>('COOPERATIVA');

  useEffect(() => {
    api
      .get<{ tipoParceiro?: string }[]>('/cooperativas')
      .then((r) => {
        const tipo = r.data?.[0]?.tipoParceiro as TipoParceiro | undefined;
        if (tipo && LABEL_MAP[tipo]) setTipoParceiro(tipo);
      })
      .catch(() => {});
  }, []);

  const labels = LABEL_MAP[tipoParceiro];

  return {
    tipoParceiro,
    tipoMembro: labels.singular,
    tipoMembroPlural: labels.plural,
  };
}
