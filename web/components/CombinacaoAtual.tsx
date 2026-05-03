'use client';

import { useMemo } from 'react';
import {
  simularPlano,
  SimularPlanoInput,
  BaseCalculo,
  TipoDesconto,
  ModeloCobranca,
  ReferenciaValor,
} from '@/lib/simular-plano';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

const BASE_LABEL: Record<BaseCalculo, string> = {
  KWH_CHEIO: 'kWh Cheio (todos componentes)',
  SEM_TRIBUTO: 'Sem Tributos (TUSD + TE)',
  COM_ICMS: 'Com ICMS (TUSD + TE + ICMS)',
  CUSTOM: 'Personalizado',
};

const TIPO_LABEL: Record<TipoDesconto, string> = {
  APLICAR_SOBRE_BASE: 'Sobre o total da base',
  ABATER_DA_CHEIA: 'Sobre a parte da energia',
};

interface Props {
  modeloCobranca: ModeloCobranca;
  baseCalculo: BaseCalculo;
  tipoDesconto: TipoDesconto;
  descontoBase: number;
  referenciaValor?: ReferenciaValor;
  temPromocao?: boolean;
  descontoPromocional?: number;
  mesesPromocao?: number;
}

/**
 * ITEM 8 da Fase C.1: helper visual inline da combinação baseCalculo + tipoDesconto.
 *
 * Mostra resumo da combinação escolhida + economia efetiva (%) + avisos V4.
 * Fica abaixo dos 2 selects de "base + aplicação" no form de plano. Complementa
 * (não substitui) o painel <PlanoSimulacao> lateral.
 */
export default function CombinacaoAtual(props: Props) {
  const r = useMemo(() => {
    const input: SimularPlanoInput = {
      valorCheioKwh: 1.02,
      tarifaSemImpostos: 0.78,
      kwhContratoMensal: 500,
      modeloCobranca: props.modeloCobranca,
      baseCalculo: props.baseCalculo,
      descontoBase: props.descontoBase,
      tipoDesconto: props.tipoDesconto,
      referenciaValor: props.referenciaValor,
      temPromocao: props.temPromocao,
      descontoPromocional: props.descontoPromocional,
      mesesPromocao: props.mesesPromocao,
    };
    return simularPlano(input);
  }, [props]);

  const economiaPercentReal = r.valorBruto > 0
    ? (r.valorEconomiaMes / r.valorBruto) * 100
    : 0;

  return (
    <div className="col-span-2 bg-gray-50 border border-gray-200 rounded-md p-3 text-xs">
      <div className="flex items-start gap-2 mb-2">
        <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-gray-700">
            <span className="font-semibold">Combinação atual:</span>{' '}
            <span className="text-gray-900">{BASE_LABEL[props.baseCalculo]}</span>
            {' + '}
            <span className="text-gray-900">{TIPO_LABEL[props.tipoDesconto]}</span>
          </p>
          <p className="text-gray-600 mt-0.5">
            → Cooperado paga aprox. <span className="font-mono font-semibold">R$ {r.tarifaContratada.toFixed(5)}/kWh</span>
            {' '}
            (<span className="font-semibold text-green-700">{economiaPercentReal.toFixed(1)}% economia real</span>{' '}
            sobre fatura típica de R$ {r.tarifaCheiaUsada.toFixed(2)}/kWh).
          </p>
        </div>
      </div>

      {r.avisos.length > 0 && (
        <div className="space-y-1 mt-2 pt-2 border-t border-gray-200">
          {r.avisos.map((aviso, i) => (
            <div key={i} className="flex gap-1.5 items-start text-yellow-800 bg-yellow-50 p-1.5 rounded">
              <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
              <span>{aviso}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
