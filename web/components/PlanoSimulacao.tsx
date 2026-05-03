'use client';

import { useMemo, useState } from 'react';
import {
  simularPlano,
  SimularPlanoInput,
  SimulacaoResultado,
  ModeloCobranca,
  BaseCalculo,
  TipoDesconto,
  ReferenciaValor,
} from '@/lib/simular-plano';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, Info } from 'lucide-react';

interface Props {
  modeloCobranca: ModeloCobranca;
  baseCalculo: BaseCalculo;
  tipoDesconto?: TipoDesconto;
  descontoBase: number;
  referenciaValor?: ReferenciaValor;
  temPromocao?: boolean;
  descontoPromocional?: number;
  mesesPromocao?: number;
}

/** Premissas default da simulação (fatura EDP-ES típica). */
const DEFAULT_VALOR_CHEIO_KWH = 1.02;
const DEFAULT_TARIFA_SEM_IMPOSTOS = 0.78;
const DEFAULT_KWH_CONTRATO_MENSAL = 500;

function formatBRL(n: number | null | undefined, casas = 2): string {
  if (n == null) return '—';
  return n.toLocaleString('pt-BR', {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
    style: 'currency',
    currency: 'BRL',
  });
}

function formatTarifa(n: number): string {
  return `R$ ${n.toFixed(5)}/kWh`;
}

export default function PlanoSimulacao(props: Props) {
  const [editando, setEditando] = useState(false);
  const [valorCheio, setValorCheio] = useState<number>(DEFAULT_VALOR_CHEIO_KWH);
  const [tarifaSemImp, setTarifaSemImp] = useState<number>(DEFAULT_TARIFA_SEM_IMPOSTOS);
  const [kwhMensal, setKwhMensal] = useState<number>(DEFAULT_KWH_CONTRATO_MENSAL);

  const input: SimularPlanoInput = useMemo(() => ({
    valorCheioKwh: valorCheio,
    tarifaSemImpostos: tarifaSemImp,
    kwhContratoMensal: kwhMensal,
    modeloCobranca: props.modeloCobranca,
    baseCalculo: props.baseCalculo,
    descontoBase: props.descontoBase,
    tipoDesconto: props.tipoDesconto,
    referenciaValor: props.referenciaValor,
    temPromocao: props.temPromocao,
    descontoPromocional: props.descontoPromocional,
    mesesPromocao: props.mesesPromocao,
  }), [
    valorCheio, tarifaSemImp, kwhMensal,
    props.modeloCobranca, props.baseCalculo, props.descontoBase,
    props.tipoDesconto, props.referenciaValor,
    props.temPromocao, props.descontoPromocional, props.mesesPromocao,
  ]);

  const r: SimulacaoResultado = useMemo(() => simularPlano(input), [input]);

  const ehFixo = props.modeloCobranca === 'FIXO_MENSAL';

  return (
    <Card className="sticky top-4 border-green-100">
      <CardHeader className="pb-3 bg-green-50/50 rounded-t-lg">
        <CardTitle className="text-base font-semibold text-green-800">
          Simulação para fatura típica
        </CardTitle>
      </CardHeader>
      <CardContent className="text-sm space-y-3 pt-4">
        <div className="text-xs text-gray-600 space-y-0.5">
          <div className="flex justify-between">
            <span>Valor cheio do kWh:</span>
            <span className="font-mono">{formatTarifa(valorCheio)}</span>
          </div>
          <div className="flex justify-between">
            <span>Tarifa sem impostos:</span>
            <span className="font-mono">{formatTarifa(tarifaSemImp)}</span>
          </div>
          <div className="flex justify-between">
            <span>Consumo de exemplo:</span>
            <span className="font-mono">{kwhMensal} kWh/mês</span>
          </div>
          <button
            type="button"
            onClick={() => setEditando((v) => !v)}
            className="text-xs text-green-700 hover:text-green-900 underline mt-1"
          >
            {editando ? 'Fechar premissas' : 'Editar premissas'}
          </button>
        </div>

        {editando && (
          <div className="border border-gray-200 rounded p-2 space-y-2 bg-gray-50">
            <label className="block text-xs">
              <span className="text-gray-600">Valor cheio (R$/kWh)</span>
              <input
                type="number"
                step={0.00001}
                min={0}
                value={valorCheio}
                onChange={(e) => setValorCheio(parseFloat(e.target.value) || 0)}
                className="w-full mt-0.5 border border-gray-300 rounded px-2 py-1 text-xs"
              />
            </label>
            <label className="block text-xs">
              <span className="text-gray-600">Tarifa sem impostos (R$/kWh)</span>
              <input
                type="number"
                step={0.00001}
                min={0}
                value={tarifaSemImp}
                onChange={(e) => setTarifaSemImp(parseFloat(e.target.value) || 0)}
                className="w-full mt-0.5 border border-gray-300 rounded px-2 py-1 text-xs"
              />
            </label>
            <label className="block text-xs">
              <span className="text-gray-600">Consumo (kWh/mês)</span>
              <input
                type="number"
                step={1}
                min={1}
                value={kwhMensal}
                onChange={(e) => setKwhMensal(parseInt(e.target.value) || 0)}
                className="w-full mt-0.5 border border-gray-300 rounded px-2 py-1 text-xs"
              />
            </label>
          </div>
        )}

        <hr className="border-gray-200" />

        <div className="space-y-1">
          <div className="flex justify-between">
            <span className="text-gray-600">Tarifa contratada:</span>
            <span className="font-semibold font-mono">{formatTarifa(r.tarifaContratada)}</span>
          </div>
          {ehFixo && r.valorContratado !== null && (
            <div className="flex justify-between">
              <span className="text-gray-600">Valor mensal:</span>
              <span className="font-semibold">{formatBRL(r.valorContratado)}</span>
            </div>
          )}
          {!ehFixo && (
            <div className="flex justify-between">
              <span className="text-gray-600">Cooperado paga (500 kWh):</span>
              <span className="font-semibold">{formatBRL(r.valorLiquido)}</span>
            </div>
          )}
          <div className="flex justify-between text-green-700">
            <span>Economia mensal:</span>
            <span className="font-bold">{formatBRL(r.valorEconomiaMes)}</span>
          </div>
        </div>

        <hr className="border-gray-200" />

        <div className="space-y-1 text-xs">
          <p className="text-gray-500 font-medium">Projeção de economia (sem inflação):</p>
          <div className="flex justify-between">
            <span>1 ano:</span>
            <span className="font-mono">{formatBRL(r.valorEconomiaAno)}</span>
          </div>
          <div className="flex justify-between">
            <span>5 anos:</span>
            <span className="font-mono">{formatBRL(r.valorEconomia5anos)}</span>
          </div>
          <div className="flex justify-between font-semibold text-green-800">
            <span>15 anos ⭐:</span>
            <span className="font-mono">{formatBRL(r.valorEconomia15anos)}</span>
          </div>
        </div>

        {r.promocional && (
          <>
            <hr className="border-orange-200" />
            <div className="bg-orange-50 -mx-3 px-3 py-2 text-xs space-y-1.5">
              <p className="font-semibold text-orange-800">
                Promocional (mês 1 a {props.mesesPromocao ?? '?'})
              </p>
              <div className="flex justify-between">
                <span>Tarifa promo:</span>
                <span className="font-mono">{formatTarifa(r.promocional.tarifaContratada)}</span>
              </div>
              <div className="flex justify-between">
                <span>Cooperado paga:</span>
                <span className="font-semibold">{formatBRL(r.promocional.valorLiquido)}</span>
              </div>
              <div className="flex justify-between text-green-700">
                <span>Economia/mês:</span>
                <span className="font-bold">{formatBRL(r.promocional.valorEconomiaMes)}</span>
              </div>
              <p className="text-[10px] text-orange-600 pt-1">
                Após promoção, valores voltam aos da seção principal acima.
              </p>
            </div>
          </>
        )}

        {r.avisos.length > 0 && (
          <>
            <hr className="border-yellow-200" />
            <div className="space-y-1.5">
              {r.avisos.map((aviso, i) => (
                <div key={i} className="flex gap-1.5 items-start text-xs text-yellow-800 bg-yellow-50 p-2 rounded">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>{aviso}</span>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="flex gap-1.5 items-start text-[10px] text-gray-400 pt-1">
          <Info className="h-3 w-3 shrink-0 mt-0.5" />
          <span>
            Cálculo paritário com backend. Sem inflação ou reajuste de tarifa. Premissas editáveis acima.
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
