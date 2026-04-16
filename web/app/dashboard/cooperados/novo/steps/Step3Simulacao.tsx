'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { BarChart2, FileText, RefreshCw, Loader2, AlertTriangle } from 'lucide-react';
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

export interface OpcaoCalculo {
  base: string;
  label: string;
  kwhApuradoBase: number;
  descontoPercentual: number;
  descontoAbsoluto: number;
  kwhContrato: number;
  valorCooperado: number;
  economiaAbsoluta: number;
  economiaPercentual: number;
  economiaMensal: number;
  economiaAnual: number;
  mesesEquivalentes: number;
}

export interface ResultadoMotor extends OpcaoCalculo {
  tarifaUnitSemTrib: number;
  tusdUtilizada: number;
  teUtilizada: number;
  kwhMesRecente: number;
  valorMesRecente: number;
  kwhMedio12m: number;
  valorMedio12m: number;
  mediaCooperativaKwh: number;
  resultadoVsMedia: number;
  mesReferencia: string;
  consumoConsiderado?: number;
  minimoFaturavelDescontado?: number;
  tipoFornecimento?: string;
}

interface RespostaMotor {
  outlierDetectado: boolean;
  aguardandoEscolha?: boolean;
  opcoes?: OpcaoCalculo[];
  resultado?: ResultadoMotor;
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
  resultadoMotor: ResultadoMotor | null;
}

interface Step3Props {
  data: Step3Data;
  faturaData: Step1Data;
  cooperadoId: string;
  onChange: (partial: Partial<Step3Data>) => void;
  tipoMembro: string;
}

export default function Step3Simulacao({ data, faturaData, cooperadoId, onChange, tipoMembro }: Step3Props) {
  const { planoSelecionadoId, simulacao, resultadoMotor } = data;
  const { ocr, historico, mesesSelecionados, componentesMarcados, componentesEditados, baseDesconto } = faturaData;

  const [planosAtivos, setPlanosAtivos] = useState<PlanoOption[]>([]);
  const [calculando, setCalculando] = useState(false);
  const [erroCalculo, setErroCalculo] = useState('');
  const [opcoesOutlier, setOpcoesOutlier] = useState<OpcaoCalculo[] | null>(null);

  useEffect(() => {
    api.get<PlanoOption[]>('/planos/ativos').then(r => setPlanosAtivos(r.data)).catch(() => {});
  }, []);

  // Auto-calcular ao montar se cooperadoId disponível e sem resultado ainda
  useEffect(() => {
    if (!cooperadoId || resultadoMotor) return;
    chamarMotor();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cooperadoId]);

  // Recalcular ao trocar plano ou base de desconto
  useEffect(() => {
    if (!cooperadoId || !resultadoMotor) return;
    chamarMotor();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planoSelecionadoId, baseDesconto]);

  // Helpers para cards de resumo (display only — não influenciam o cálculo do motor)
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

  // Motor de proposta — substitui cálculo local
  async function chamarMotor(opcaoEscolhida?: 'MES_RECENTE' | 'MEDIA_12M') {
    setCalculando(true);
    setErroCalculo('');
    setOpcoesOutlier(null);
    try {
      const selecionados = historico.filter((_, i) => mesesSelecionados.has(i));
      const ultimoMes = selecionados.length > 0 ? selecionados[selecionados.length - 1] : null;
      const payload = {
        cooperadoId,
        historico: selecionados.map(m => ({
          mesAno: m.mesAno,
          consumoKwh: m.consumoKwh,
          valorRS: m.valorRS,
        })),
        kwhMesRecente: ocr?.consumoAtualKwh ?? ultimoMes?.consumoKwh ?? 0,
        valorMesRecente: ocr?.totalAPagar ?? ultimoMes?.valorRS ?? 0,
        mesReferencia: ultimoMes?.mesAno ?? new Date().toISOString().slice(0, 7),
        tipoFornecimento: ocr?.tipoFornecimento || undefined,
        planoId: planoSelecionadoId || undefined,
        baseDesconto: baseDesconto === 'VALOR_FATURA' ? 'VALOR_FATURA' as const : 'KWH_CHEIO' as const,
        ...(opcaoEscolhida ? { opcaoEscolhida } : {}),
      };

      const { data: resp } = await api.post<RespostaMotor>('/motor-proposta/calcular', payload);

      if (resp.aguardandoEscolha && resp.opcoes) {
        setOpcoesOutlier(resp.opcoes);
        return;
      }

      if (!resp.resultado) {
        setErroCalculo('Motor retornou sem resultado. Verifique os dados da fatura.');
        return;
      }

      const r = resp.resultado;
      onChange({
        resultadoMotor: r,
        simulacao: {
          faturaAtual: r.valorMesRecente,
          faturaCooperebr: Math.round((r.valorMesRecente - r.economiaMensal) * 100) / 100,
          desconto: r.descontoPercentual,
          economiaMensal: r.economiaMensal,
          economiaAnual: r.economiaAnual,
          economia5anos: Math.round(r.economiaMensal * 60 * 100) / 100,
          mesesGratis: Math.round(r.mesesEquivalentes),
        },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      setErroCalculo(`Não foi possível calcular a proposta. Verifique se a tarifa da distribuidora está cadastrada. (${message})`);
    } finally {
      setCalculando(false);
    }
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

      {/* Resumo do consumo (referência — dados do Step1) */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
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
          <p className="text-xs text-gray-500">Tarifa base (TUSD+TE)</p>
          <p className="text-lg font-bold text-gray-900">
            R$ {(getComponenteValor('tarifaTUSD', ocr?.tarifaTUSD ?? 0) + getComponenteValor('tarifaTE', ocr?.tarifaTE ?? 0)).toLocaleString('pt-BR', { minimumFractionDigits: 5 })}
          </p>
        </div>
      </div>

      {mesesSuspeitosSelecionados.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
          {mesesSuspeitosSelecionados.length} mês(es) suspeitos incluídos no cálculo. Considere voltar e desmarcar.
        </div>
      )}

      {/* Plano (cards) — vincula ao contrato, não influencia cálculo do motor */}
      <div className="space-y-3">
        <label className="block text-xs font-medium text-gray-600">Plano (vinculado ao contrato)</label>
        {planosAtivos.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {planosAtivos.map(p => {
              const sel = planoSelecionadoId === p.id;
              return (
                <button key={p.id} type="button"
                  onClick={() => onChange({ planoSelecionadoId: p.id })}
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

        {/* Botão calcular / recalcular */}
        <Button onClick={() => chamarMotor()} disabled={calculando || !cooperadoId}>
          {calculando ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Calculando...</>
          ) : (
            <><RefreshCw className="h-4 w-4 mr-2" /> {resultadoMotor ? 'Recalcular' : 'Calcular proposta'}</>
          )}
        </Button>
      </div>

      {/* Erro do motor */}
      {erroCalculo && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-2">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
            <p className="text-sm text-red-700">{erroCalculo}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => chamarMotor()}>
            Tentar novamente
          </Button>
        </div>
      )}

      {/* Outlier detectado — opções para o admin */}
      {opcoesOutlier && (
        <div className="space-y-3">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-start gap-2 mb-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-800">Consumo atípico detectado</p>
                <p className="text-xs text-amber-700 mt-1">
                  O consumo do mês mais recente é significativamente diferente da média histórica.
                  Escolha qual base usar para a proposta:
                </p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {opcoesOutlier.map(op => (
              <button key={op.base} type="button"
                onClick={() => chamarMotor(op.base as 'MES_RECENTE' | 'MEDIA_12M')}
                className="text-left border-2 border-gray-200 hover:border-green-500 rounded-xl p-4 transition-colors space-y-2">
                <p className="text-sm font-semibold text-gray-800">{op.label}</p>
                <div className="space-y-1 text-sm">
                  <p className="text-gray-600">kWh contrato: <span className="font-medium">{Math.round(op.kwhContrato).toLocaleString('pt-BR')}</span></p>
                  <p className="text-green-700 font-medium">Economia: {op.economiaMensal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/mês</p>
                  <p className="text-gray-500 text-xs">{op.economiaAnual.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/ano</p>
                </div>
                <span className="inline-block text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium mt-1">
                  Usar este
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Resultado da simulação (do motor de proposta) */}
      {simulacao && resultadoMotor && (
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
          {/* Detalhes técnicos do motor */}
          <div className="border-t border-green-200 pt-3">
            <p className="text-xs text-gray-500 mb-2">Dados técnicos (motor de proposta)</p>
            <div className="grid grid-cols-3 gap-2 text-xs text-gray-600">
              <div>kWh contrato: <span className="font-medium">{Math.round(resultadoMotor.kwhContrato).toLocaleString('pt-BR')}</span></div>
              <div>Base: <span className="font-medium">{resultadoMotor.base === 'MES_RECENTE' ? 'Mês atual' : 'Média 12m'}</span></div>
              <div>Tarifa: <span className="font-medium">R$ {resultadoMotor.tarifaUnitSemTrib.toFixed(5)}</span></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
