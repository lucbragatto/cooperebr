'use client';

/**
 * D-FISCAL-2.4.4e (02/06/2026) — Bloco de custeio do convênio (Caso 1:
 * empresa cooperada paga total).
 *
 * Reusado entre /dashboard/convenios/novo e /dashboard/convenios/[id]/editar.
 *
 * Select pagador (CADA_MEMBRO default | EMPRESA) — quando EMPRESA, revela:
 *   - pagadorCooperadoId (<select> nativo da lista de cooperados ATIVOs)
 *   - baseCobrancaCusteio (CONSUMO_REAL | ALOCACAO_FIXA)
 *   - kwhAlocadoMensal (só se ALOCACAO_FIXA)
 *   - descontoKwhCusteio (% — slider/input)
 *
 * Selects NATIVOS (regra 19/05). HelpBox neutro explicando o modelo.
 */

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { HelpBox } from '@/components/ui/help-box';

export type Pagador = 'CADA_MEMBRO' | 'EMPRESA';
export type BaseCobrancaCusteio = 'CONSUMO_REAL' | 'ALOCACAO_FIXA';
// D-novo-CT-TARIFA-FIXA-EMPRESA (02/06/2026)
export type TipoTarifaEmpresa = 'PERCENTUAL_DESCONTO' | 'VALOR_FIXO';

export interface ConvenioCusteioState {
  pagador: Pagador;
  pagadorCooperadoId: string;
  baseCobrancaCusteio: BaseCobrancaCusteio;
  kwhAlocadoMensal: number | '';
  descontoKwhCusteio: number | '';
  // D-novo-CT-TARIFA-FIXA-EMPRESA
  tipoTarifaEmpresa: TipoTarifaEmpresa;
  tarifaFixaKwhEmpresa: number | '';
  // Sprint Onboarding Bloco 0 Fatia 0.2 (06/06/2026) — Plano de Clube vinculado.
  // String vazia = sem plano (default).
  planoClubeId: string;
}

interface ConvenioCusteioBlocoProps {
  state: ConvenioCusteioState;
  onChange: (patch: Partial<ConvenioCusteioState>) => void;
  /** ID único pro HelpBox dispensável (localStorage). Default 'convenio-custeio-help'. */
  helpId?: string;
}

interface CooperadoOption {
  id: string;
  nomeCompleto: string;
  cpf?: string;
  status?: string;
  tipoCooperado?: string;
}

interface PlanoClubeOption {
  id: string;
  nome: string;
  valorMensal: string;
  cobra: boolean;
  ativo: boolean;
}

function formatBRL(v: number | string) {
  const n = typeof v === 'string' ? Number(v) : v;
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const PAGADOR_OPCOES: { value: Pagador; label: string }[] = [
  { value: 'CADA_MEMBRO', label: 'Cada membro paga a sua (modelo padrão / MLM legado)' },
  { value: 'EMPRESA', label: 'Empresa cooperada paga o total (Caso 1 — custeio)' },
];

const BASE_OPCOES: { value: BaseCobrancaCusteio; label: string }[] = [
  { value: 'CONSUMO_REAL', label: 'Consumo real (soma das faturas dos membros)' },
  { value: 'ALOCACAO_FIXA', label: 'Alocação fixa (pacote mensal de kWh)' },
];

// D-novo-CT-TARIFA-FIXA-EMPRESA (02/06/2026)
const TIPO_TARIFA_OPCOES: { value: TipoTarifaEmpresa; label: string }[] = [
  { value: 'PERCENTUAL_DESCONTO', label: '% desconto sobre a tarifa da concessionária (dinâmico)' },
  { value: 'VALOR_FIXO', label: 'Valor fixo R$/kWh (preço negociado com a empresa)' },
];

export function ConvenioCusteioBloco({
  state,
  onChange,
  helpId = 'convenio-custeio-help',
}: ConvenioCusteioBlocoProps) {
  const [cooperados, setCooperados] = useState<CooperadoOption[]>([]);
  const [carregandoCoop, setCarregandoCoop] = useState(false);
  // Fatia 0.2 — planos ativos do tenant pra select.
  const [planosClube, setPlanosClube] = useState<PlanoClubeOption[]>([]);
  const [carregandoPlanos, setCarregandoPlanos] = useState(false);

  useEffect(() => {
    // Carrega cooperados ATIVOs do tenant pra dropdown do pagador.
    // GET /cooperados retorna tenant-scoped automaticamente via JWT.
    if (state.pagador !== 'EMPRESA') return;
    if (cooperados.length > 0) return;
    setCarregandoCoop(true);
    api
      .get<CooperadoOption[] | { data: CooperadoOption[] }>('/cooperados')
      .then((r) => {
        const lista = Array.isArray(r.data) ? r.data : (r.data?.data ?? []);
        setCooperados(
          lista
            .filter((c) => c.status === 'ATIVO' || c.status === undefined)
            .sort((a, b) => a.nomeCompleto.localeCompare(b.nomeCompleto)),
        );
      })
      .catch(() => setCooperados([]))
      .finally(() => setCarregandoCoop(false));
  }, [state.pagador, cooperados.length]);

  // Fatia 0.2 — carrega planos de clube ATIVOS do tenant. Sempre carrega
  // (independente do pagador), pois o select pode ser usado em qualquer modelo.
  useEffect(() => {
    if (planosClube.length > 0) return;
    setCarregandoPlanos(true);
    api
      .get<PlanoClubeOption[]>('/plano-clube')
      .then((r) => {
        setPlanosClube(
          (r.data ?? [])
            .filter((p) => p.ativo)
            .sort((a, b) => a.nome.localeCompare(b.nome)),
        );
      })
      .catch(() => setPlanosClube([]))
      .finally(() => setCarregandoPlanos(false));
  }, [planosClube.length]);

  const isEmpresa = state.pagador === 'EMPRESA';
  const isAlocacaoFixa = state.baseCobrancaCusteio === 'ALOCACAO_FIXA';

  return (
    <div className="space-y-4 border-t pt-4 mt-4">
      <div>
        <h3 className="text-base font-semibold text-gray-800">Modelo de pagamento</h3>
        <p className="text-xs text-gray-500 mt-0.5">
          Define quem paga as cobranças mensais deste convênio.
        </p>
      </div>

      <HelpBox id={helpId} titulo="Custeio (Caso 1): empresa paga o total" variante="info">
        <p>
          No modelo de <strong>custeio</strong>, uma empresa cooperada
          (clínica/empresa/condomínio) paga <strong>1 cobrança mensal consolidada</strong> pelo consumo
          de todos os membros e da própria UC (se tiver). Os membros{' '}
          <strong>não recebem cobrança individual</strong> — toda a conta vai pra empresa.
        </p>
        <ul className="list-disc list-inside ml-1 mt-2">
          <li><strong>Pagador EMPRESA:</strong> escolha a empresa cooperada que paga a conta.</li>
          <li>
            <strong>Base CONSUMO_REAL:</strong> soma o consumo real das UCs dos membros (via fatura
            da concessionária). Cron mensal espera as faturas chegarem antes de gerar.
          </li>
          <li>
            <strong>Base ALOCACAO_FIXA:</strong> usa um pacote mensal fixo de kWh (não depende da
            chegada das faturas). Útil pra convênios de quota fechada.
          </li>
          <li>
            <strong>Modo da tarifa:</strong>{' '}
            <strong>% desconto</strong> (dinâmico — segue a concessionária menos um %) OU{' '}
            <strong>R$/kWh fixo</strong> (preço negociado, ignora concessionária — ex: R$ 0,80/kWh).
          </li>
        </ul>
        <p className="mt-2 text-amber-800 bg-amber-50 border border-amber-300 rounded p-2">
          ⚠️ Modelo CADA_MEMBRO mantém o comportamento legado (MLM Hangar/Moradas). Mude pra EMPRESA
          só quando o convênio for de custeio confirmado pelo contador.
        </p>
      </HelpBox>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Pagador *
        </label>
        <select
          value={state.pagador}
          onChange={(e) => {
            const novo = e.target.value as Pagador;
            // Ao mudar pra CADA_MEMBRO, limpa campos dependentes pra não vazar dado órfão
            if (novo === 'CADA_MEMBRO') {
              onChange({
                pagador: 'CADA_MEMBRO',
                pagadorCooperadoId: '',
                baseCobrancaCusteio: 'CONSUMO_REAL',
                kwhAlocadoMensal: '',
                descontoKwhCusteio: '',
                // D-novo-CT-TARIFA-FIXA-EMPRESA: limpa também os novos campos
                tipoTarifaEmpresa: 'PERCENTUAL_DESCONTO',
                tarifaFixaKwhEmpresa: '',
                // Fatia 0.2 — clube só faz sentido em EMPRESA paga
                planoClubeId: '',
              });
            } else {
              onChange({ pagador: novo });
            }
          }}
          className="w-full border rounded px-2 py-1.5 text-sm bg-white"
        >
          {PAGADOR_OPCOES.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {isEmpresa && (
        <div className="space-y-4 rounded-lg border-l-4 border-emerald-400 bg-emerald-50/50 p-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Empresa pagadora (cooperado PJ) *
            </label>
            <select
              value={state.pagadorCooperadoId}
              onChange={(e) => onChange({ pagadorCooperadoId: e.target.value })}
              className="w-full border rounded px-2 py-1.5 text-sm bg-white"
              required={isEmpresa}
              disabled={carregandoCoop}
            >
              <option value="">
                {carregandoCoop ? '— carregando cooperados —' : '— selecione a empresa —'}
              </option>
              {cooperados.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nomeCompleto}{c.cpf ? ` (${c.cpf})` : ''}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-gray-500 mt-1">
              Deve ser um cooperado PJ <strong>ATIVO</strong>. Cadastre primeiro em
              {' '}<a href="/dashboard/cooperados/novo" className="underline" target="_blank">/dashboard/cooperados/novo</a>
              {' '}se não aparecer na lista.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Base de cobrança *
            </label>
            <select
              value={state.baseCobrancaCusteio}
              onChange={(e) =>
                onChange({ baseCobrancaCusteio: e.target.value as BaseCobrancaCusteio })
              }
              className="w-full border rounded px-2 py-1.5 text-sm bg-white"
              required={isEmpresa}
            >
              {BASE_OPCOES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {isAlocacaoFixa && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                kWh alocado por mês *
              </label>
              <input
                type="number"
                min={1}
                step={1}
                value={state.kwhAlocadoMensal}
                onChange={(e) =>
                  onChange({
                    kwhAlocadoMensal: e.target.value === '' ? '' : Number(e.target.value),
                  })
                }
                placeholder="Ex: 5000"
                className="w-full border rounded px-2 py-1.5 text-sm"
                required={isEmpresa && isAlocacaoFixa}
              />
              <p className="text-[11px] text-gray-500 mt-1">
                Quantidade fixa de kWh cobrada mensalmente (independente das faturas individuais dos membros).
              </p>
            </div>
          )}

          {/* D-novo-CT-TARIFA-FIXA-EMPRESA (02/06/2026) — modo de cobrança */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Como cobrar a empresa *
            </label>
            <select
              value={state.tipoTarifaEmpresa}
              onChange={(e) => {
                const novo = e.target.value as TipoTarifaEmpresa;
                // Limpa campos dependentes ao trocar o modo (evita dados órfãos no payload)
                if (novo === 'PERCENTUAL_DESCONTO') {
                  onChange({ tipoTarifaEmpresa: novo, tarifaFixaKwhEmpresa: '' });
                } else {
                  onChange({ tipoTarifaEmpresa: novo, descontoKwhCusteio: '' });
                }
              }}
              className="w-full border rounded px-2 py-1.5 text-sm bg-white"
              required={isEmpresa}
            >
              {TIPO_TARIFA_OPCOES.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <p className="text-[11px] text-gray-500 mt-1">
              <strong>Dinâmico:</strong> tarifa segue a concessionária (TUSD+TE da TarifaConcessionaria atual)
              {' '}menos o desconto configurado.
              <br />
              <strong>Fixo:</strong> preço fechado em R$/kWh (ex: R$ 0,80/kWh negociado direto com a empresa) —
              {' '}independe da tarifa da concessionária e ignora desconto percentual.
            </p>
          </div>

          {state.tipoTarifaEmpresa === 'PERCENTUAL_DESCONTO' && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Desconto sobre a tarifa (%) — opcional
              </label>
              <input
                type="number"
                min={0}
                max={100}
                step={0.01}
                value={state.descontoKwhCusteio}
                onChange={(e) =>
                  onChange({
                    descontoKwhCusteio: e.target.value === '' ? '' : Number(e.target.value),
                  })
                }
                placeholder="Ex: 20 (deixe vazio = 0% / paga cheio)"
                className="w-full border rounded px-2 py-1.5 text-sm"
              />
              <p className="text-[11px] text-gray-500 mt-1">
                Desconto aplicado sobre a tarifa da distribuidora ao calcular o valor da consolidada.
                0–100. Vazio = paga cheio (sem desconto).
              </p>
            </div>
          )}

          {state.tipoTarifaEmpresa === 'VALOR_FIXO' && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Tarifa fixa R$/kWh *
              </label>
              <input
                type="number"
                min={0}
                step={0.00001}
                value={state.tarifaFixaKwhEmpresa}
                onChange={(e) =>
                  onChange({
                    tarifaFixaKwhEmpresa: e.target.value === '' ? '' : Number(e.target.value),
                  })
                }
                placeholder="Ex: 0.80 (R$ 0,80 por kWh)"
                className="w-full border rounded px-2 py-1.5 text-sm"
                required={isEmpresa && state.tipoTarifaEmpresa === 'VALOR_FIXO'}
              />
              <p className="text-[11px] text-gray-500 mt-1">
                Preço negociado por kWh. Valor da consolidada = <strong>kWh × tarifa fixa</strong>
                {' '}(sem desconto, sem consultar concessionária). Use até 5 casas decimais.
              </p>
            </div>
          )}

          {/* Sprint Onboarding Bloco 0 Fatia 0.2 (06/06/2026) — Plano de Clube vinculado */}
          <div className="mt-4 pt-4 border-t border-emerald-200">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Plano de Clube vinculado (opcional)
            </label>
            <select
              value={state.planoClubeId}
              onChange={(e) => onChange({ planoClubeId: e.target.value })}
              className="w-full border rounded px-2 py-1.5 text-sm bg-white"
              disabled={carregandoPlanos}
            >
              <option value="">
                {carregandoPlanos ? '— carregando planos —' : '— Sem plano de clube —'}
              </option>
              {planosClube.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}{' '}
                  {p.cobra
                    ? `— ${formatBRL(p.valorMensal)}/mês`
                    : '— Grátis'}
                </option>
              ))}
            </select>
            <div className="mt-2 text-[11px] text-gray-700 bg-amber-50 border border-amber-200 rounded p-2">
              <p>
                <strong>Ao escolher um plano de clube aqui, a EMPRESA paga a mensalidade de clube
                de todos os funcionários ativos do convênio</strong> (adesão obrigatória pra
                funcionário de conveniado).
              </p>
              <p className="mt-1">
                O valor é somado à energia na cobrança consolidada, discriminado em linha separada:
                <em> Energia (com desconto) + (nº membros × mensalidade) = Total</em>.
              </p>
              <p className="mt-1 text-gray-600">
                Não precisa cadastrar plano? Crie um em{' '}
                <a href="/dashboard/clube/planos" className="underline" target="_blank">
                  /dashboard/clube/planos
                </a>
                {' '}ou deixe "Sem plano de clube".
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
