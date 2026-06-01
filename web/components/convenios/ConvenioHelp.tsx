'use client';

/**
 * D-novo-PUX-A.3 (01/06/2026) — Bloco de help reusável da entidade Convênio.
 *
 * Texto validado com o Luciano em 01/06 (substitui o banner ad-hoc da lista).
 * Reusado em /convenios, /convenios/novo, /convenios/[id]/editar.
 */

import { HelpBox } from '@/components/ui/help-box';

interface ConvenioHelpProps {
  /** Distingue help instâncias se uma página tiver mais de um (default ok pra a maioria) */
  storageId?: string;
}

export function ConvenioHelp({ storageId = 'convenios-explicacao' }: ConvenioHelpProps) {
  return (
    <HelpBox id={storageId} titulo="O que é um Convênio?" variante="info">
      <p>
        <strong>Acordo formal</strong> entre a cooperativa e uma instituição/empresa (ou os
        próprios cooperados) pra custear ou apoiar a atividade — é um{' '}
        <strong>ato cooperativo auxiliar</strong> (Art. 88, Lei 5.764/71). Se o dinheiro passa
        por dentro sem margem (entra = sai, soma zero), <strong>não é tributado</strong>. Por
        isso registrar e classificar certo é a sua defesa fiscal.
      </p>
      <p className="mt-2">
        <strong>Os 3 fluxos:</strong>
      </p>
      <ul className="list-disc list-inside ml-1">
        <li><strong>Ingresso</strong> — custeio recebido pela cooperativa</li>
        <li><strong>Repasse</strong> — saída pra provedor</li>
        <li><strong>Custo operacional interno</strong></li>
      </ul>
      <p className="mt-1 text-[11px] opacity-90">Todos viram lançamento "auxiliar" na contabilidade.</p>
      <p className="mt-2">
        <strong>Classificação fiscal:</strong> cite o fundamento. Exemplo:{' '}
        <em>"Ato Auxiliar Art. 88 + STF Tema 536"</em>.
      </p>
      <p className="mt-3 bg-amber-50 border border-amber-300 rounded p-2 text-amber-800">
        ⚠️ <strong>Hoje o Convênio é registro/documentação</strong> — os movimentos financeiros
        ainda são lançados pelos outros fluxos. A geração automática de lançamento a partir
        do convênio está em desenvolvimento.
      </p>
    </HelpBox>
  );
}
