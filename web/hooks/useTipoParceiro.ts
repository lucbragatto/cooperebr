'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { getUsuario } from '@/lib/auth';

type TipoParceiro = 'COOPERATIVA' | 'CONSORCIO' | 'ASSOCIACAO' | 'CONDOMINIO';

const LABEL_MAP: Record<TipoParceiro, { singular: string; plural: string }> = {
  COOPERATIVA: { singular: 'Cooperado', plural: 'Cooperados' },
  CONSORCIO: { singular: 'Consorciado', plural: 'Consorciados' },
  ASSOCIACAO: { singular: 'Associado', plural: 'Associados' },
  CONDOMINIO: { singular: 'Condômino', plural: 'Condôminos' },
};

export function useTipoParceiro() {
  const [tipoParceiro, setTipoParceiro] = useState<TipoParceiro | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    const usuario = getUsuario();
    if (usuario?.perfil === 'SUPER_ADMIN') {
      setIsSuperAdmin(true);
      return;
    }

    api
      .get<{ tipoParceiro?: string }[]>('/cooperativas')
      .then((r) => {
        const tipo = r.data?.[0]?.tipoParceiro as TipoParceiro | undefined;
        if (tipo && LABEL_MAP[tipo]) setTipoParceiro(tipo);
        else setTipoParceiro('COOPERATIVA');
      })
      .catch(() => setTipoParceiro('COOPERATIVA'));
  }, []);

  if (isSuperAdmin) {
    return {
      tipoParceiro: null as TipoParceiro | null,
      tipoMembro: 'Membro',
      tipoMembroPlural: 'Membros',
    };
  }

  const labels = LABEL_MAP[tipoParceiro ?? 'COOPERATIVA'];

  return {
    tipoParceiro,
    tipoMembro: labels.singular,
    tipoMembroPlural: labels.plural,
  };
}
