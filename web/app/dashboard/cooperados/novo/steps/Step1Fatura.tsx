'use client';

import { useRef, useState } from 'react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  AlertTriangle, BarChart2, FileUp, Loader2, Pencil, Plus, Upload, X, Zap,
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface HistoricoItemEditavel {
  mesAno: string;
  consumoKwh: number;
  valorRS: number;
  estimado?: boolean;
}

export interface DadosOcr {
  titular: string;
  documento: string;
  tipoDocumento: string;
  enderecoInstalacao: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
  numeroUC: string;
  codigoMedidor: string;
  distribuidora: string;
  classificacao: string;
  modalidadeTarifaria: string;
  tensaoNominal: string;
  tipoFornecimento: string;
  consumoAtualKwh: number;
  tarifaTUSD: number;
  tarifaTE: number;
  bandeiraTarifaria: string;
  valorBandeira: number;
  contribIluminacaoPublica: number;
  icmsPercentual: number;
  icmsValor: number;
  pisCofinsPercentual: number;
  pisCofinsValor: number;
  multaJuros: number;
  descontos: number;
  outrosEncargos: number;
  totalAPagar: number;
  historicoConsumo: { mesAno: string; consumoKwh: number; valorRS: number }[];
}

export interface Step1Data {
  ocr: DadosOcr | null;
  historico: HistoricoItemEditavel[];
  mesesSelecionados: Set<number>;
  componentesMarcados: Set<string>;
  componentesEditados: Record<string, number>;
  baseDesconto: 'KWH' | 'VALOR_FATURA';
}

interface Step1Props {
  data: Step1Data;
  onChange: (partial: Partial<Step1Data>) => void;
  tipoMembro: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

const cls = 'w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500';

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function detectarSuspeitos(historico: HistoricoItemEditavel[]): Set<number> {
  const suspeitos = new Set<number>();
  if (historico.length < 2) return suspeitos;
  for (let i = 0; i < historico.length; i++) {
    if (historico[i].estimado) continue;
    if (historico[i].consumoKwh === 0) { suspeitos.add(i); continue; }
    const outros = historico.filter((_, j) => j !== i);
    const mediaOutros = outros.reduce((acc, m) => acc + m.consumoKwh, 0) / outros.length;
    if (historico[i].consumoKwh < mediaOutros * 0.4) suspeitos.add(i);
  }
  return suspeitos;
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  );
}

// ─── Component ──────────────────────────────────────────────────────────────────

export default function Step1Fatura({ data, onChange, tipoMembro }: Step1Props) {
  const { ocr, historico, mesesSelecionados, componentesMarcados, componentesEditados, baseDesconto } = data;

  const [arquivo, setArquivo] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // Add month state
  const [adicionandoMes, setAdicionandoMes] = useState(false);
  const [novoMesAno, setNovoMesAno] = useState('');
  const [novoKwh, setNovoKwh] = useState(0);
  const [novoValorRS, setNovoValorRS] = useState(0);

  function handleFile(file: File) { setArquivo(file); setErro(''); }
  function onDrop(e: React.DragEvent) { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }

  async function analisarFatura() {
    if (!arquivo) { setErro('Selecione um arquivo primeiro.'); return; }
    setErro(''); setLoading(true);
    try {
      const arquivoBase64 = await toBase64(arquivo);
      const tipoArquivo = arquivo.type === 'application/pdf' ? 'pdf' : 'imagem';
      const { data: ocrData } = await api.post<DadosOcr>('/faturas/extrair', { arquivoBase64, tipoArquivo });

      const histEditavel: HistoricoItemEditavel[] = (ocrData.historicoConsumo ?? []).map(h => ({ ...h }));
      const suspeitos = detectarSuspeitos(histEditavel);

      onChange({
        ocr: ocrData,
        historico: histEditavel,
        mesesSelecionados: new Set(histEditavel.map((_, i) => i).filter(i => !suspeitos.has(i))),
        componentesEditados: {
          icmsValor: ocrData.icmsValor ?? 0,
          icmsPercentual: ocrData.icmsPercentual ?? 0,
          pisCofinsValor: ocrData.pisCofinsValor ?? 0,
          pisCofinsPercentual: ocrData.pisCofinsPercentual ?? 0,
          contribIluminacaoPublica: ocrData.contribIluminacaoPublica ?? 0,
          outrosEncargos: ocrData.outrosEncargos ?? 0,
        },
      });
    } catch {
      setErro('Erro ao processar fatura. Verifique o arquivo e tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  function getComponenteValor(key: string, ocrValor: number): number {
    return componentesEditados[key] !== undefined ? componentesEditados[key] : ocrValor;
  }

  function atualizarComponenteValor(key: string, valor: number) {
    onChange({ componentesEditados: { ...componentesEditados, [key]: valor } });
  }

  function toggleComponente(key: string) {
    const next = new Set(componentesMarcados);
    if (next.has(key)) next.delete(key); else next.add(key);
    onChange({ componentesMarcados: next });
  }

  function toggleMes(idx: number) {
    const next = new Set(mesesSelecionados);
    if (next.has(idx)) next.delete(idx); else next.add(idx);
    onChange({ mesesSelecionados: next });
  }

  function atualizarConsumoMes(idx: number, valor: number) {
    onChange({ historico: historico.map((item, i) => i === idx ? { ...item, consumoKwh: valor } : item) });
  }

  function atualizarValorMes(idx: number, valor: number) {
    onChange({ historico: historico.map((item, i) => i === idx ? { ...item, valorRS: valor } : item) });
  }

  function adicionarMesEstimado() {
    if (!novoMesAno || novoKwh <= 0) return;
    const novoIdx = historico.length;
    onChange({
      historico: [...historico, { mesAno: novoMesAno, consumoKwh: novoKwh, valorRS: novoValorRS, estimado: true }],
      mesesSelecionados: new Set([...mesesSelecionados, novoIdx]),
    });
    setAdicionandoMes(false); setNovoMesAno(''); setNovoKwh(0); setNovoValorRS(0);
  }

  function removerMesEstimado(idx: number) {
    const newHist = historico.filter((_, i) => i !== idx);
    const next = new Set<number>();
    for (const i of mesesSelecionados) {
      if (i < idx) next.add(i);
      else if (i > idx) next.add(i - 1);
    }
    onChange({ historico: newHist, mesesSelecionados: next });
  }

  const suspeitos = detectarSuspeitos(historico);

  // Meses disponíveis para adicionar
  const mesesExistentes = new Set(historico.map(h => h.mesAno));
  const mesesDisponiveis: string[] = [];
  const agora = new Date();
  for (let i = 1; i <= 24; i++) {
    const d = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
    const mesAno = `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    if (!mesesExistentes.has(mesAno)) mesesDisponiveis.push(mesAno);
  }

  // Mínimo ANEEL
  const tipoFornecimento = ocr?.tipoFornecimento ?? '';
  const minimoAneel = tipoFornecimento === 'MONOFASICO' ? 30 : tipoFornecimento === 'BIFASICO' ? 50 : tipoFornecimento === 'TRIFASICO' ? 100 : 0;

  // ─── UPLOAD AREA ──────────────────────────────────────────────────────────────
  if (!ocr) {
    return (
      <div className="space-y-5">
        <div>
          <h2 className="text-base font-semibold text-gray-800 mb-1">Fatura da concessionária</h2>
          <p className="text-sm text-gray-500">Envie a fatura de energia do {tipoMembro.toLowerCase()} para extrair os dados automaticamente.</p>
        </div>

        <div
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={onDrop}
          className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
            drag ? 'border-green-500 bg-green-50' : arquivo ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
          }`}
        >
          <input ref={fileRef} type="file" accept=".pdf,image/*" className="hidden"
            onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
          {arquivo ? (
            <div className="space-y-2">
              <FileUp className="h-10 w-10 text-green-600 mx-auto" />
              <p className="text-sm font-medium text-green-800">{arquivo.name}</p>
              <p className="text-xs text-green-600">{(arquivo.size / 1024).toFixed(0)} KB — clique para trocar</p>
            </div>
          ) : (
            <div className="space-y-2">
              <Upload className="h-10 w-10 text-gray-400 mx-auto" />
              <p className="text-sm text-gray-600">Arraste ou <span className="text-green-700 font-medium">clique para selecionar</span></p>
              <p className="text-xs text-gray-400">PDF ou imagem (JPG, PNG)</p>
            </div>
          )}
        </div>

        {erro && <p className="text-sm text-red-600">{erro}</p>}

        <Button onClick={analisarFatura} disabled={!arquivo || loading} className="w-full">
          {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processando com OCR...</> : 'Processar com OCR'}
        </Button>
      </div>
    );
  }

  // ─── OCR RESULTS ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-gray-800 mb-1">Dados extraídos da fatura</h2>
        <p className="text-sm text-gray-500">Confira e corrija os dados extraídos pela IA.</p>
      </div>

      {/* Cards de dados extraídos */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[
          { label: 'Nome', value: ocr.titular },
          { label: 'UC', value: ocr.numeroUC },
          { label: 'Endereço', value: [ocr.enderecoInstalacao, ocr.bairro, `${ocr.cidade}/${ocr.estado}`].filter(Boolean).join(', ') },
          { label: 'Distribuidora', value: ocr.distribuidora },
          { label: 'Tipo fornecimento', value: ocr.tipoFornecimento },
          { label: 'Classificação', value: ocr.classificacao },
        ].map((c, i) => (
          <div key={i} className="bg-gray-50 rounded-lg px-3 py-2.5">
            <p className="text-xs text-gray-500">{c.label}</p>
            <p className="text-sm font-medium text-gray-800 truncate">{c.value || '—'}</p>
          </div>
        ))}
      </div>

      {/* Mínimo ANEEL */}
      {minimoAneel > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800 flex items-center gap-2">
          <Zap className="h-4 w-4 shrink-0" />
          Consumo mínimo ANEEL ({tipoFornecimento === 'MONOFASICO' ? 'monofásico' : tipoFornecimento === 'BIFASICO' ? 'bifásico' : 'trifásico'}): <b>{minimoAneel} kWh</b>
        </div>
      )}

      {/* Histórico de consumo editável */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <BarChart2 className="h-4 w-4 text-green-700" />
          <h3 className="text-sm font-semibold text-gray-800">Histórico de 12 meses</h3>
          <span className="ml-auto text-xs text-gray-500">Marque os meses para calcular a média</span>
        </div>

        {historico.length > 0 && historico.length < 12 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>Histórico com {historico.length} meses. A média será calculada e extrapolada para 12 meses.</span>
          </div>
        )}

        {suspeitos.size > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span><b>{suspeitos.size}</b> mês(es) com consumo suspeito foram desmarcados automaticamente (consumo &lt; 40% da média ou zero).</span>
          </div>
        )}

        {historico.length > 0 && (
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500 uppercase">
              <div className="col-span-1"></div>
              <div className="col-span-4">Mês</div>
              <div className="col-span-4 text-right">Consumo (kWh)</div>
              <div className="col-span-3 text-right">Valor (R$)</div>
            </div>
            {historico.map((item, idx) => {
              const sel = mesesSelecionados.has(idx);
              const isSuspeito = suspeitos.has(idx);
              return (
                <div key={idx} className={`grid grid-cols-12 gap-2 px-4 py-2.5 transition-colors border-b border-gray-100 last:border-0 ${isSuspeito ? 'bg-amber-50' : sel ? 'bg-green-50' : 'hover:bg-gray-50'}`}>
                  <div className="col-span-1 flex items-center">
                    <input type="checkbox" checked={sel} onChange={() => toggleMes(idx)} className="rounded border-gray-300 text-green-600 focus:ring-green-500" />
                  </div>
                  <div className={`col-span-4 text-sm font-medium flex items-center gap-1 ${sel ? 'text-gray-900' : 'text-gray-400'}`}>
                    {isSuspeito && <span title="Consumo muito diferente da média">⚠️</span>}
                    {item.estimado && <Pencil className="h-3 w-3 text-blue-500" />}
                    {item.mesAno}
                    {item.estimado && (
                      <button onClick={() => removerMesEstimado(idx)} className="ml-1 text-red-400 hover:text-red-600"><X className="h-3.5 w-3.5" /></button>
                    )}
                  </div>
                  <div className="col-span-4 text-sm text-right">
                    <input type="number" className={`border rounded px-2 py-0.5 text-sm w-24 text-right focus:ring-2 focus:ring-green-500 focus:outline-none ${isSuspeito ? 'border-amber-400' : 'border-gray-200'}`}
                      value={item.consumoKwh} onChange={(e) => atualizarConsumoMes(idx, Number(e.target.value))} />
                  </div>
                  <div className="col-span-3 text-sm text-right">
                    <input type="number" step="0.01" className="border border-gray-200 rounded px-2 py-0.5 text-sm w-24 text-right focus:ring-2 focus:ring-green-500 focus:outline-none"
                      value={item.valorRS} onChange={(e) => atualizarValorMes(idx, Number(e.target.value))} />
                  </div>
                </div>
              );
            })}
            {adicionandoMes && (
              <div className="grid grid-cols-12 gap-2 px-4 py-2.5 bg-blue-50 border-b border-gray-100">
                <div className="col-span-1"></div>
                <div className="col-span-4 flex items-center gap-1">
                  <Pencil className="h-3 w-3 text-blue-500" />
                  <select className="text-sm border border-gray-300 rounded px-1 py-0.5 bg-white" value={novoMesAno} onChange={(e) => setNovoMesAno(e.target.value)}>
                    <option value="">Selecione...</option>
                    {mesesDisponiveis.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div className="col-span-3 text-right">
                  <input type="number" className="w-full text-right text-sm border border-gray-300 rounded px-2 py-0.5" placeholder="kWh" value={novoKwh || ''} onChange={(e) => setNovoKwh(Number(e.target.value))} />
                </div>
                <div className="col-span-2 text-right">
                  <input type="number" step="0.01" className="w-full text-right text-sm border border-gray-300 rounded px-2 py-0.5" placeholder="R$" value={novoValorRS || ''}
                    onChange={(e) => setNovoValorRS(Number(e.target.value))} onKeyDown={(e) => { if (e.key === 'Enter') adicionarMesEstimado(); }} />
                </div>
                <div className="col-span-2 flex items-center justify-end gap-1">
                  <button onClick={adicionarMesEstimado} disabled={!novoMesAno || novoKwh <= 0} className="text-xs text-green-700 hover:underline disabled:text-gray-400">OK</button>
                  <button onClick={() => setAdicionandoMes(false)} className="text-red-400 hover:text-red-600"><X className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2 text-xs">
          {historico.length > 0 && (
            <>
              <button onClick={() => { const susp = detectarSuspeitos(historico); onChange({ mesesSelecionados: new Set(historico.map((_, i) => i).filter(i => !susp.has(i))) }); }} className="text-green-700 hover:underline">Selecionar todos</button>
              <span className="text-gray-300">|</span>
              <button onClick={() => onChange({ mesesSelecionados: new Set() })} className="text-gray-500 hover:underline">Desmarcar todos</button>
              <span className="text-gray-300">|</span>
            </>
          )}
          <button onClick={() => setAdicionandoMes(true)} className="text-blue-600 hover:underline flex items-center gap-1">
            <Plus className="h-3 w-3" /> Adicionar mês estimado
          </button>
        </div>
      </div>

      {/* Composição do kWh */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-green-700" />
          <h3 className="text-sm font-semibold text-gray-800">Composição do kWh</h3>
          <span className="ml-auto text-xs text-gray-500">Desmarque para excluir do cálculo</span>
        </div>

        {(() => {
          const consumo = ocr.consumoAtualKwh || 1;
          const tusdTe = (ocr.tarifaTUSD ?? 0) + (ocr.tarifaTE ?? 0);
          const icmsPctEdit = getComponenteValor('icmsPercentual', ocr.icmsPercentual ?? 0);
          const pisCofPctEdit = getComponenteValor('pisCofinsPercentual', ocr.pisCofinsPercentual ?? 0);

          type CompItem = { key: string; label: string; valor: number; tipo: 'kwh' | 'fixo'; editKey?: string; pctKey?: string };
          const componentes: CompItem[] = [
            { key: 'tarifaTUSD', label: 'TUSD', valor: ocr.tarifaTUSD ?? 0, tipo: 'kwh' },
            { key: 'tarifaTE', label: 'TE', valor: ocr.tarifaTE ?? 0, tipo: 'kwh' },
            { key: 'valorBandeira', label: `Bandeira (${ocr.bandeiraTarifaria ?? '—'})`, valor: ocr.valorBandeira ?? 0, tipo: 'kwh' },
            { key: 'icms', label: 'ICMS', valor: getComponenteValor('icmsValor', ocr.icmsValor ?? 0), tipo: 'fixo', editKey: 'icmsValor', pctKey: 'icmsPercentual' },
            { key: 'pisCofins', label: 'PIS/COFINS', valor: getComponenteValor('pisCofinsValor', ocr.pisCofinsValor ?? 0), tipo: 'fixo', editKey: 'pisCofinsValor', pctKey: 'pisCofinsPercentual' },
            { key: 'contribIluminacaoPublica', label: 'CIP/COSIP', valor: getComponenteValor('contribIluminacaoPublica', ocr.contribIluminacaoPublica ?? 0), tipo: 'fixo', editKey: 'contribIluminacaoPublica' },
            { key: 'multaJuros', label: 'Multa/Juros', valor: ocr.multaJuros ?? 0, tipo: 'fixo' },
            { key: 'outrosEncargos', label: 'Outros encargos', valor: getComponenteValor('outrosEncargos', ocr.outrosEncargos ?? 0), tipo: 'fixo', editKey: 'outrosEncargos' },
            { key: 'descontos', label: 'Descontos (−)', valor: ocr.descontos ?? 0, tipo: 'fixo' },
          ];

          return (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500 uppercase">
                <div className="col-span-1"></div>
                <div className="col-span-3">Componente</div>
                <div className="col-span-2 text-right">%</div>
                <div className="col-span-3 text-right">Valor (R$)</div>
                <div className="col-span-3 text-right">R$/kWh</div>
              </div>
              {componentes.map(c => {
                const sel = componentesMarcados.has(c.key);
                const porKwh = c.tipo === 'kwh' ? c.valor : c.valor / consumo;
                const isEditable = !!c.editKey;
                const hasPct = !!c.pctKey;
                const pctValue = c.pctKey === 'icmsPercentual' ? icmsPctEdit : c.pctKey === 'pisCofinsPercentual' ? pisCofPctEdit : 0;
                return (
                  <div key={c.key} className={`grid grid-cols-12 gap-2 px-4 py-2 transition-colors border-b border-gray-100 last:border-0 ${sel ? 'bg-green-50' : 'hover:bg-gray-50'}`}>
                    <div className="col-span-1 flex items-center">
                      <input type="checkbox" checked={sel} onChange={() => toggleComponente(c.key)} className="rounded border-gray-300 text-green-600 focus:ring-green-500" />
                    </div>
                    <div className={`col-span-3 text-sm flex items-center ${sel ? 'text-gray-900' : 'text-gray-400'}`}>{c.label}</div>
                    <div className="col-span-2 text-sm text-right flex items-center justify-end">
                      {hasPct ? (
                        <div className="flex items-center gap-1">
                          <input type="number" step="0.1" className="border border-gray-200 rounded px-1.5 py-0.5 text-sm w-16 text-right focus:ring-2 focus:ring-green-500 focus:outline-none"
                            value={pctValue}
                            onChange={(e) => {
                              const newPct = Number(e.target.value);
                              atualizarComponenteValor(c.pctKey!, newPct);
                              atualizarComponenteValor(c.editKey!, tusdTe * (newPct / 100) * consumo);
                            }}
                          />
                          <span className="text-xs text-gray-400">%</span>
                        </div>
                      ) : <span className="text-gray-400">—</span>}
                    </div>
                    <div className={`col-span-3 text-sm text-right flex items-center justify-end ${sel ? 'text-gray-700' : 'text-gray-400'}`}>
                      {isEditable ? (
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-gray-400">R$</span>
                          <input type="number" step="0.01" className="border border-gray-200 rounded px-1.5 py-0.5 text-sm w-24 text-right focus:ring-2 focus:ring-green-500 focus:outline-none"
                            value={c.valor} onChange={(e) => atualizarComponenteValor(c.editKey!, Number(e.target.value))} />
                        </div>
                      ) : c.tipo === 'kwh'
                        ? `R$ ${c.valor.toLocaleString('pt-BR', { minimumFractionDigits: 5, maximumFractionDigits: 5 })}/kWh`
                        : `R$ ${c.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                      }
                    </div>
                    <div className={`col-span-3 text-sm text-right ${sel ? 'text-gray-900 font-medium' : 'text-gray-400'}`}>
                      {c.key === 'descontos' ? '−' : ''}{porKwh.toLocaleString('pt-BR', { minimumFractionDigits: 5, maximumFractionDigits: 5 })}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>

      {/* Base de desconto */}
      <div>
        <p className="text-xs font-medium text-gray-600 mb-2">Base para aplicação do desconto:</p>
        <div className="flex gap-2">
          <button onClick={() => onChange({ baseDesconto: 'KWH' })}
            className={`flex-1 text-xs px-3 py-2 rounded-lg border-2 transition-colors ${baseDesconto === 'KWH' ? 'border-green-600 bg-green-50 text-green-800 font-medium' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
            Valor do kWh bruto (R$/kWh)
          </button>
          <button onClick={() => onChange({ baseDesconto: 'VALOR_FATURA' })}
            className={`flex-1 text-xs px-3 py-2 rounded-lg border-2 transition-colors ${baseDesconto === 'VALOR_FATURA' ? 'border-green-600 bg-green-50 text-green-800 font-medium' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
            Valor médio da fatura (R$/mês)
          </button>
        </div>
      </div>

      {/* Nova fatura */}
      <div className="flex justify-end">
        <button onClick={() => { onChange({ ocr: null, historico: [], mesesSelecionados: new Set(), componentesEditados: {} }); setArquivo(null); }}
          className="text-xs text-gray-500 hover:text-gray-700 hover:underline">
          Reprocessar outra fatura
        </button>
      </div>
    </div>
  );
}
