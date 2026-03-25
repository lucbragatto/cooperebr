'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { BarChart2, FileText, RefreshCw } from 'lucide-react';
import type { Step1Data, HistoricoItemEditavel } from './Step1Fatura';
import { detectarSuspeitos } from './Step1Fatura';

interface PlanoOption {
  id: string;
  nome: string;
  descontoBase: string;
  modeloCobranca: string;
  temPromocao: boolean;
  descontoPromocional: string | null;
  mesesPromocao: number | null;
}

export interface Step3Data {
  planoSelecionadoId: string;
  descontoCustom: number;
  simulacao: {
    faturaAtual: number;
    faturaCooperebr: number;
    desconto: number;
    economiaMensal: number;
    economiaAnual: number;
    economia5anos: number;
    mesesGratis: number;
  } | null;
}

interface Step3Props {
  data: Step3Data;
  faturaData: Step1Data;
  onChange: (partial: Partial<Step3Data>) => void;
  tipoMembro: string;
}

export default function Step3Simulacao({ data, faturaData, onChange, tipoMembro }: Step3Props) {
  const { planoSelecionadoId, descontoCustom, simulacao } = data;
  const { ocr, historico, mesesSelecionados, componentesMarcados, componentesEditados, baseDesconto } = faturaData;

  const [planosAtivos, setPlanosAtivos] = useState<PlanoOption[]>([]);

  useEffect(() => {
    api.get<PlanoOption[]>('/planos/ativos').then(r => setPlanosAtivos(r.data)).catch(() => {});
  }, []);

  // Cálculos
  function calcularEstatisticas() {
    const selecionados = historico.filter((_, i) => mesesSelecionados.has(i));
    const totalKwh = selecionados.reduce((acc, m) => acc + m.consumoKwh, 0);
    const mediaKwh = selecionados.length > 0 ? totalKwh / selecionados.length : 0;
    const mesesComValor = selecionados.filter(m => m.valorRS > 0);
    const mediaValorRS = mesesComValor.length > 0 ? mesesComValor.reduce((acc, m) => acc + m.valorRS, 0) / mesesComValor.length : 0;
    return { mediaKwh, mediaValorRS, qtd: selecionados.length };
  }

  function getComponenteValor(key: string, ocrValor: number): number {
    return componentesEditados[key] !== undefined ? componentesEditados[key] : ocrValor;
  }

  function calcularValorBrutoKwh() {
    if (!ocr) return 0;
    const consumo = ocr.consumoAtualKwh || 1;
    let valor = 0;
    if (componentesMarcados.has('tarifaTUSD')) valor += ocr.tarifaTUSD ?? 0;
    if (componentesMarcados.has('tarifaTE')) valor += ocr.tarifaTE ?? 0;
    if (componentesMarcados.has('valorBandeira')) valor += ocr.valorBandeira ?? 0;
    if (componentesMarcados.has('icms')) valor += getComponenteValor('icmsValor', ocr.icmsValor ?? 0) / consumo;
    if (componentesMarcados.has('pisCofins')) valor += getComponenteValor('pisCofinsValor', ocr.pisCofinsValor ?? 0) / consumo;
    if (componentesMarcados.has('contribIluminacaoPublica')) valor += getComponenteValor('contribIluminacaoPublica', ocr.contribIluminacaoPublica ?? 0) / consumo;
    if (componentesMarcados.has('multaJuros')) valor += (ocr.multaJuros ?? 0) / consumo;
    if (componentesMarcados.has('outrosEncargos')) valor += getComponenteValor('outrosEncargos', ocr.outrosEncargos ?? 0) / consumo;
    if (componentesMarcados.has('descontos')) valor -= (ocr.descontos ?? 0) / consumo;
    return Math.max(0, valor);
  }

  function gerarSimulacao() {
    const plano = planosAtivos.find(p => p.id === planoSelecionadoId);
    const descontoPct = descontoCustom > 0 ? descontoCustom : (plano ? Number(plano.descontoBase) : 15);
    const desconto = descontoPct / 100;
    const { mediaKwh, mediaValorRS } = calcularEstatisticas();
    const valorBrutoKwh = calcularValorBrutoKwh();

    let faturaAtual: number;
    if (baseDesconto === 'VALOR_FATURA' && mediaValorRS > 0) {
      faturaAtual = mediaValorRS;
    } else {
      faturaAtual = valorBrutoKwh * mediaKwh;
    }

    const economiaMensal = faturaAtual * desconto;
    const faturaCooperebr = faturaAtual - economiaMensal;
    const economiaAnual = economiaMensal * 12;
    const economia5anos = economiaMensal * 60;
    const mesesGratis = faturaAtual > 0 ? Math.round(economia5anos / faturaAtual) : 0;

    onChange({
      simulacao: { faturaAtual, faturaCooperebr, desconto: descontoPct, economiaMensal, economiaAnual, economia5anos, mesesGratis },
      descontoCustom: descontoPct,
    });
  }

  const { mediaKwh, mediaValorRS, qtd } = calcularEstatisticas();
  const suspeitos = detectarSuspeitos(historico);
  const mesesSuspeitosSelecionados = [...suspeitos].filter(i => mesesSelecionados.has(i));

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-gray-800 mb-1">Simulação e proposta</h2>
        <p className="text-sm text-gray-500">Calcule a economia estimada para o {tipoMembro.toLowerCase()}.</p>
      </div>

      {/* Resumo do consumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2.5">
          <p className="text-xs text-green-700">Consumo médio</p>
          <p className="text-lg font-bold text-green-800">{Math.round(mediaKwh).toLocaleString('pt-BR')} kWh</p>
          <p className="text-xs text-green-600">{qtd} meses (excl. suspeitos)</p>
        </div>
        <div className="bg-gray-50 rounded-lg px-3 py-2.5">
          <p className="text-xs text-gray-500">Valor médio fatura</p>
          <p className="text-lg font-bold text-gray-900">
            {mediaValorRS > 0 ? mediaValorRS.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'}
          </p>
        </div>
        <div className="bg-gray-50 rounded-lg px-3 py-2.5">
          <p className="text-xs text-gray-500">Tarifa (TUSD+TE)</p>
          <p className="text-lg font-bold text-gray-900">
            R$ {((ocr?.tarifaTUSD ?? 0) + (ocr?.tarifaTE ?? 0)).toLocaleString('pt-BR', { minimumFractionDigits: 5 })}
          </p>
        </div>
        <div className="bg-gray-50 rounded-lg px-3 py-2.5">
          <p className="text-xs text-gray-500">kWh bruto</p>
          <p className="text-lg font-bold text-gray-900">
            R$ {calcularValorBrutoKwh().toLocaleString('pt-BR', { minimumFractionDigits: 5 })}
          </p>
        </div>
      </div>

      {mesesSuspeitosSelecionados.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
          ⚠️ {mesesSuspeitosSelecionados.length} mês(es) suspeitos incluídos no cálculo. Considere voltar e desmarcar.
        </div>
      )}

      {/* Plano (cards) + desconto */}
      <div className="space-y-3">
        <label className="block text-xs font-medium text-gray-600">Plano</label>
        {planosAtivos.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {planosAtivos.map(p => {
              const sel = planoSelecionadoId === p.id;
              return (
                <button key={p.id} type="button"
                  onClick={() => onChange({ planoSelecionadoId: p.id, simulacao: null })}
                  className={`relative text-left border-2 rounded-xl px-4 py-3 transition-colors ${sel ? 'border-green-600 bg-green-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  {p.temPromocao && p.descontoPromocional && (
                    <span className="absolute -top-2 -right-2 bg-amber-400 text-amber-900 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                      Promo {Number(p.descontoPromocional)}%
                    </span>
                  )}
                  <p className="text-sm font-semibold text-gray-800">{p.nome}</p>
                  <p className="text-2xl font-bold text-green-700 mt-1">{Number(p.descontoBase)}%</p>
                  <p className="text-xs text-gray-500">de desconto</p>
                </button>
              );
            })}
          </div>
        )}
        <div className="flex gap-3 items-end">
          <div className="w-32">
            <label className="block text-xs font-medium text-gray-600 mb-1">% Desconto customizado</label>
            <input type="number" min="1" max="99" step="0.5"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              value={descontoCustom || ''}
              onChange={e => onChange({ descontoCustom: Number(e.target.value), simulacao: null })}
              placeholder="Ex: 15" />
          </div>
          <Button onClick={gerarSimulacao} disabled={!planoSelecionadoId && !descontoCustom}>
            <RefreshCw className="h-4 w-4 mr-2" />
            {simulacao ? 'Recalcular' : 'Calcular'}
          </Button>
        </div>
      </div>

      {/* Resultado da simulação */}
      {simulacao && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500">Fatura atual estimada</p>
              <p className="text-xl font-bold text-gray-900">
                {simulacao.faturaAtual.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/mês
              </p>
            </div>
            <div>
              <p className="text-xs text-green-700">Com CoopereBR ({simulacao.desconto}% desc.)</p>
              <p className="text-xl font-bold text-green-800">
                {simulacao.faturaCooperebr.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/mês
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Economia mensal</p>
              <p className="text-lg font-bold text-green-700">
                {simulacao.economiaMensal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Economia anual</p>
              <p className="text-lg font-bold text-green-700">
                {simulacao.economiaAnual.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
            </div>
          </div>
          <div className="border-t border-green-200 pt-3 grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500">Economia em 5 anos</p>
              <p className="text-lg font-bold text-green-700">
                {simulacao.economia5anos.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
            </div>
            <div className="text-center flex items-center justify-center">
              <p className="text-sm text-green-800" style={{ textWrap: 'balance' }}>
                Equivale a <span className="font-bold text-lg">{simulacao.mesesGratis}</span> meses de energia grátis
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
