'use client';

/**
 * Card reusável de "Economia Projetada" — Fase C.3 (11/05/2026).
 *
 * Mostra os 4 valores de economia (mês / 1 ano / 5 anos / 15 anos) em formatação
 * canônica copiada de PlanoSimulacao.tsx (Fase C.1, 03/05/2026).
 *
 * Uso em 3 telas (D-P-1 do playbook):
 *   - /dashboard/cobrancas/[id] — admin vê economia da cobrança
 *   - /dashboard/contratos/[id] — admin vê economia projetada do contrato
 *   - /aprovar-proposta — cooperado vê economia da proposta
 *
 * Reforço 4 do Luciano (11/05):
 *   - Todos 4 valores presentes: card normal
 *   - Todos null: fallback "—" sem aviso (caso comum, ex: cobrança legada)
 *   - Mix: mostra "—" só nos null
 *   - Negativo: mostra em vermelho (defesa em profundidade — não deveria
 *     acontecer pela matemática, mas se acontecer, sinaliza erro)
 *
 * Quando `avisoLegado` é passado, mostra badge cinza explicando que o cálculo
 * está indisponível (ex: contrato pré-Fase B.5 sem `valorCheioKwhAceite`).
 */
/** Valores podem chegar como number (cálculo frontend) OU string (Prisma Decimal serializado). */
type ValorEconomia = number | string | null | undefined;

export interface EconomiaProjetadaProps {
  valorEconomiaMes: ValorEconomia;
  valorEconomiaAno: ValorEconomia;
  valorEconomia5anos: ValorEconomia;
  valorEconomia15anos: ValorEconomia;
  /** Quando definido, mostra badge de aviso ao invés de card vazio.
   *  Use pra explicar fallback (ex: "Cálculo indisponível — contrato pré-03/05/2026"). */
  avisoLegado?: string;
  /** Titulo do card. Default: "Economia projetada". */
  titulo?: string;
}

/** Coerce Prisma Decimal serializado (string) ou number → number. null se inválido ou vazio. */
function toNum(v: ValorEconomia): number | null {
  if (v == null) return null;
  if (typeof v === 'string' && v.trim() === '') return null;
  const n = typeof v === 'string' ? Number(v) : v;
  return Number.isFinite(n) ? n : null;
}

function formatBRL(v: ValorEconomia): string {
  const n = toNum(v);
  if (n == null) return '—';
  return n.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    style: 'currency',
    currency: 'BRL',
  });
}

function corValor(v: ValorEconomia): string {
  const n = toNum(v);
  if (n == null) return 'text-gray-400';
  if (n < 0) return 'text-red-700';
  return 'text-gray-800';
}

export default function EconomiaProjetada(props: EconomiaProjetadaProps) {
  const {
    valorEconomiaMes,
    valorEconomiaAno,
    valorEconomia5anos,
    valorEconomia15anos,
    avisoLegado,
    titulo = 'Economia projetada',
  } = props;

  const algumNegativo = [valorEconomiaMes, valorEconomiaAno, valorEconomia5anos, valorEconomia15anos]
    .map(toNum)
    .some((n) => n != null && n < 0);

  return (
    <div className="border border-green-100 rounded-lg overflow-hidden mt-4" data-testid="economia-projetada">
      <div className="bg-green-50/50 px-4 py-2 border-b border-green-100">
        <h3 className="text-base font-semibold text-green-800">{titulo}</h3>
      </div>
      <div className="p-4 space-y-3 text-sm">
        {avisoLegado && (
          <div className="bg-gray-100 text-gray-600 px-3 py-2 rounded border border-gray-200 text-xs">
            {avisoLegado}
          </div>
        )}

        {algumNegativo && (
          <div className="bg-red-50 text-red-700 px-3 py-2 rounded border border-red-200 text-xs">
            ⚠ Algum valor de economia veio negativo. Pode indicar erro de cálculo —
            valor cooperado maior que valor cheio. Verifique a configuração do plano.
          </div>
        )}

        <div className="flex justify-between">
          <span className="text-gray-600">Economia mensal:</span>
          <span className={`font-semibold ${corValor(valorEconomiaMes)}`}>
            {formatBRL(valorEconomiaMes)}
          </span>
        </div>

        <hr className="border-gray-200" />

        <div className="space-y-1">
          <p className="text-gray-500 font-medium text-xs">Projeção de economia (sem inflação):</p>
          <div className="flex justify-between">
            <span className="text-gray-600">1 ano:</span>
            <span className={`font-mono ${corValor(valorEconomiaAno)}`}>{formatBRL(valorEconomiaAno)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">5 anos:</span>
            <span className={`font-mono ${corValor(valorEconomia5anos)}`}>{formatBRL(valorEconomia5anos)}</span>
          </div>
          <div className="flex justify-between font-semibold text-green-800">
            <span>15 anos ⭐:</span>
            <span className={`font-mono ${corValor(valorEconomia15anos)}`}>{formatBRL(valorEconomia15anos)}</span>
          </div>
        </div>

        <p className="text-[10px] text-gray-400 pt-1">
          Cálculo sem inflação ou reajuste de tarifa.
        </p>
      </div>
    </div>
  );
}
