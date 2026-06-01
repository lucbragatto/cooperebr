'use client';

/**
 * D-novo-PUX-A.1 (01/06/2026) — Componente <HelpBox> reusável.
 *
 * Banner help dispensável (botão ×; preferência de "fechado" persiste em
 * localStorage[`helpbox:${id}`]). Drop-in pra substituir os banners
 * ad-hoc azul-borda-esquerda repetidos hoje em várias telas.
 *
 * Premissa 19/05: TODA página/funcionalidade DEVE ter help inline contextual.
 * Luciano não programa — sem ajuda visual ele não consegue usar.
 *
 * Sem Shadcn/Radix pesado — estilo leve no padrão `tabs-custom.tsx`.
 *
 * Uso:
 *   <HelpBox id="convenios-explicacao" titulo="O que é um Convênio?">
 *     <p>Acordo formal entre a cooperativa e ...</p>
 *     <ul className="list-disc list-inside mt-2 text-xs">
 *       <li>Ingresso (custeio recebido)</li>
 *       <li>Repasse (saída pra provedor)</li>
 *     </ul>
 *   </HelpBox>
 */

import React, { useEffect, useState } from 'react';
import { Info, AlertTriangle, X } from 'lucide-react';

export type HelpBoxVariante = 'info' | 'aviso';

interface HelpBoxProps {
  /** Chave única — usada em localStorage pra lembrar "fechado" entre sessões */
  id: string;
  /** Título do bloco (curto, ex: "Como funciona") */
  titulo: string;
  /** Variante visual */
  variante?: HelpBoxVariante;
  /** Conteúdo (texto livre + listas + emphasis) */
  children: React.ReactNode;
}

const VARIANTES = {
  info: {
    bg: 'bg-blue-50',
    border: 'border-blue-500',
    title: 'text-blue-900',
    body: 'text-blue-800',
    Icon: Info,
  },
  aviso: {
    bg: 'bg-amber-50',
    border: 'border-amber-500',
    title: 'text-amber-900',
    body: 'text-amber-800',
    Icon: AlertTriangle,
  },
} as const;

const STORAGE_PREFIX = 'helpbox:';

export function HelpBox({ id, titulo, variante = 'info', children }: HelpBoxProps) {
  const [aberto, setAberto] = useState<boolean | null>(null); // null = ainda lendo localStorage (evita flicker SSR)
  const storageKey = `${STORAGE_PREFIX}${id}`;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const fechado = localStorage.getItem(storageKey) === 'fechado';
    setAberto(!fechado);
  }, [storageKey]);

  function fechar() {
    try {
      localStorage.setItem(storageKey, 'fechado');
    } catch {
      // ignora storage cheio / private mode
    }
    setAberto(false);
  }

  // Antes de hidratar (aberto=null) renderiza com conteúdo pra não causar layout shift
  if (aberto === false) return null;

  const { bg, border, title, body, Icon } = VARIANTES[variante];

  return (
    <div className={`${bg} border-l-4 ${border} p-4 rounded relative`}>
      <button
        type="button"
        aria-label="Dispensar ajuda"
        title="Não mostrar mais"
        onClick={fechar}
        className={`absolute top-2 right-2 ${title} opacity-60 hover:opacity-100`}
      >
        <X className="h-4 w-4" />
      </button>
      <h2 className={`font-semibold text-sm flex items-center gap-2 pr-6 ${title}`}>
        <Icon className="h-4 w-4" />
        {titulo}
      </h2>
      <div className={`text-xs mt-2 ${body} space-y-1`}>
        {children}
      </div>
    </div>
  );
}
