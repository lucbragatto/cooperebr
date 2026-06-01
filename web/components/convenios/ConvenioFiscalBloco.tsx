'use client';

/**
 * D-FISCAL-2.3 (01/06/2026 noite) — Bloco fiscal do convênio consolidado.
 *
 * Reusado entre /dashboard/convenios/novo e /dashboard/convenios/[id]/editar.
 * Toggle "Gerar registro contábil (ato cooperativo)" controla visibilidade
 * dos campos fiscais. HelpBox neutro com critério econômico + 4 travas.
 *
 * Selects NATIVOS (regra 19/05). Dates LOCAL (CT.9.1 fix preservado pelo backend).
 */

import { HelpBox } from '@/components/ui/help-box';

export interface ConvenioFiscalState {
  geraLancamentoContabil: boolean;
  naturezaAtoCooperativo: '' | 'PROPRIO' | 'AUXILIAR' | 'NAO_COOPERATIVO';
  fluxoFinanceiro:
    | ''
    | 'INGRESSO_CUSTEIO_AUXILIAR'
    | 'REPASSE_PROVEDOR_EXTERNO'
    | 'CUSTO_OPERACIONAL_INTERNO';
  classificacaoFiscal: string;
  vigenciaInicio: string;
  vigenciaFim: string;
}

interface ConvenioFiscalBlocoProps {
  state: ConvenioFiscalState;
  onChange: (patch: Partial<ConvenioFiscalState>) => void;
  /** ID único para o HelpBox dispensável (localStorage). Default 'convenio-fiscal-help'. */
  helpId?: string;
}

const NATUREZA_OPCOES = [
  { value: '', label: '— selecione a natureza —' },
  { value: 'PROPRIO', label: 'PRÓPRIO (Art. 79 — cooperativa retém sobra)' },
  { value: 'AUXILIAR', label: 'AUXILIAR (Art. 88 — trânsito puro)' },
  { value: 'NAO_COOPERATIVO', label: 'NÃO-COOPERATIVO (Art. 86 — terceiros)' },
] as const;

const FLUXO_OPCOES = [
  { value: '', label: '— selecione o fluxo —' },
  { value: 'INGRESSO_CUSTEIO_AUXILIAR', label: 'Ingresso (custeio recebido pela cooperativa)' },
  { value: 'REPASSE_PROVEDOR_EXTERNO', label: 'Repasse (saída pra provedor externo)' },
  { value: 'CUSTO_OPERACIONAL_INTERNO', label: 'Custo operacional interno' },
] as const;

export function ConvenioFiscalBloco({
  state,
  onChange,
  helpId = 'convenio-fiscal-help',
}: ConvenioFiscalBlocoProps) {
  const ligado = state.geraLancamentoContabil;
  return (
    <div className="space-y-4 border-t pt-4 mt-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-gray-800">
            Classificação fiscal (opcional)
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Ative para que movimentos deste convênio gerem lançamentos contábeis
            classificados (Próprio / Auxiliar / Não-Coop).
          </p>
        </div>
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={ligado}
            onChange={(e) => onChange({ geraLancamentoContabil: e.target.checked })}
            className="h-4 w-4"
          />
          <span className="text-sm text-gray-700">Gerar registro contábil</span>
        </label>
      </div>

      {ligado && (
        <>
          <HelpBox id={helpId} titulo="Como classificar o convênio" variante="info">
            <p>
              <strong>Critério econômico:</strong> "A cooperativa fica com sobra/resultado,
              mesmo se o resíduo for repassado ao dono da estrutura?"
            </p>
            <ul className="list-disc list-inside ml-1">
              <li>
                <strong>SIM</strong> → <strong>PRÓPRIO</strong> (Art. 79 — isento). Ex.:
                caso médico (empresa custeia energia dos médicos cooperados em usina cessão).
              </li>
              <li>
                <strong>NÃO</strong> → <strong>AUXILIAR</strong> (Art. 88 — neutro), se as
                4 travas abaixo forem cumpridas; senão NÃO-COOPERATIVO (Art. 86, tributado).
              </li>
            </ul>
            <p className="mt-2"><strong>4 travas pra qualificar Art. 88 (AUXILIAR):</strong></p>
            <ul className="list-disc list-inside ml-1">
              <li>Todos os participantes são cooperados (ou cooperativa é única operadora)</li>
              <li>Fluxo entra = sai (soma zero — sem retenção/margem)</li>
              <li>Convênio documentado formalmente (objeto, prazo, valores, partes)</li>
              <li>Escrituração contábil segregada (lançamentos visíveis na DRE Auxiliar)</li>
            </ul>
            <p className="mt-2 bg-amber-50 border border-amber-300 rounded p-2 text-amber-800">
              ⚠️ Classificação <strong>SUGERIDA</strong> — confira antes de uso fiscal real
              (DCTF/SPED).
            </p>
          </HelpBox>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Natureza do ato cooperativo *
              </label>
              <select
                value={state.naturezaAtoCooperativo}
                onChange={(e) =>
                  onChange({ naturezaAtoCooperativo: e.target.value as any })
                }
                className="w-full border rounded px-2 py-1.5 text-sm bg-white"
                required={ligado}
              >
                {NATUREZA_OPCOES.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Fluxo financeiro *
              </label>
              <select
                value={state.fluxoFinanceiro}
                onChange={(e) => onChange({ fluxoFinanceiro: e.target.value as any })}
                className="w-full border rounded px-2 py-1.5 text-sm bg-white"
                required={ligado}
              >
                {FLUXO_OPCOES.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Fundamento legal (opcional — texto livre defensável)
            </label>
            <input
              type="text"
              value={state.classificacaoFiscal}
              onChange={(e) => onChange({ classificacaoFiscal: e.target.value })}
              maxLength={300}
              placeholder='ex: "Ato Próprio Art. 79 Lei 5.764/71 + STF Tema 536"'
              className="w-full border rounded px-2 py-1.5 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Vigência início (opcional)
              </label>
              <input
                type="date"
                value={state.vigenciaInicio}
                onChange={(e) => onChange({ vigenciaInicio: e.target.value })}
                className="w-full border rounded px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Vigência fim (opcional)
              </label>
              <input
                type="date"
                value={state.vigenciaFim}
                onChange={(e) => onChange({ vigenciaFim: e.target.value })}
                className="w-full border rounded px-2 py-1.5 text-sm"
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
