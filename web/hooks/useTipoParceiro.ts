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

interface CooperativaResponse {
  tipoParceiro?: string;
  tipoMembro?: string;
  tipoMembroPlural?: string;
}

export function useTipoParceiro() {
  const [tipoParceiro, setTipoParceiro] = useState<TipoParceiro | null>(null);
  const [labelsFromApi, setLabelsFromApi] = useState<{ singular: string; plural: string } | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    const usuario = getUsuario();
    if (usuario?.perfil === 'SUPER_ADMIN') {
      setIsSuperAdmin(true);
      return;
    }

    api
      .get<CooperativaResponse[]>('/cooperativas')
      .then((r) => {
        const coop = r.data?.[0];
        // Prefer backend-computed labels (enriquecer adds tipoMembro/tipoMembroPlural)
        if (coop?.tipoMembro && coop?.tipoMembroPlural) {
          setLabelsFromApi({ singular: coop.tipoMembro, plural: coop.tipoMembroPlural });
        }
        const tipo = coop?.tipoParceiro as TipoParceiro | undefined;
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

  const fallback = LABEL_MAP[tipoParceiro ?? 'COOPERATIVA'];

  return {
    tipoParceiro,
    tipoMembro: labelsFromApi?.singular ?? fallback.singular,
    tipoMembroPlural: labelsFromApi?.plural ?? fallback.plural,
  };
}
