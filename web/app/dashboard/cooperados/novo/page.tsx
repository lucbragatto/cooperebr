'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft, CheckCircle, ChevronRight, FileUp, FileText, Loader2,
  Upload, User, UserX, Zap, BarChart2, AlertTriangle, Plus, X, Pencil,
  Sun, Car, PlugZap,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface HistoricoItem {
  mesAno: string;
  consumoKwh: number;
  valorRS: number;
}

interface HistoricoItemEditavel extends HistoricoItem {
  estimado?: boolean;
}

interface DadosOcr {
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
  historicoConsumo: HistoricoItem[];
}

type TipoCooperado = 'COM_UC' | 'SEM_UC' | 'GERADOR' | 'CARREGADOR_VEICULAR' | 'USUARIO_CARREGADOR' | '';
// Etapas COM_UC: 1=upload, 2=revisar, 8=histórico, 4=sucesso, 3=preferência
// Etapas SEM_UC/GERADOR/CARREGADOR/USUARIO: 5=dados pessoais, 6=upload documento, 7=sucesso
type Etapa = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

interface UsinaOption { id: string; nome: string; cidade: string; estado: string }

// ─── CSS helpers ─────────────────────────────────────────────────────────────

const cls = 'w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500';
const lbl = 'block text-xs font-medium text-gray-600 mb-1';

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className={lbl}>{label}</label>
      {children}
    </div>
  );
}

// ─── Stepper ─────────────────────────────────────────────────────────────────

function Stepper({ etapa, tipo }: { etapa: Etapa; tipo: TipoCooperado }) {
  const isSemUC = tipo !== 'COM_UC';
  const steps = isSemUC ? [5, 6, 7] : [1, 2, 8, 4];
  const labels = isSemUC
    ? ['Dados pessoais', 'Documento', 'Sucesso']
    : ['Upload fatura', 'Revisar dados', 'Consumo', 'Sucesso'];

  return (
    <div className="flex items-center gap-2 mb-8">
      {steps.map((s, i) => {
        const num = i + 1;
        const active = etapa === s;
        const done = steps.indexOf(s) < steps.indexOf(etapa as number);
        return (
          <div key={s} className="flex items-center gap-2">
            <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold border-2 transition-all ${done ? 'bg-green-600 border-green-600 text-white' : active ? 'border-green-600 text-green-700 bg-green-50' : 'border-gray-300 text-gray-400'}`}>
              {done ? <CheckCircle className="h-3.5 w-3.5" /> : num}
            </div>
            <span className={`text-xs font-medium hidden sm:block ${active ? 'text-green-700' : done ? 'text-green-600' : 'text-gray-400'}`}>
              {labels[i]}
            </span>
            {i < steps.length - 1 && <ChevronRight className="h-4 w-4 text-gray-300 shrink-0" />}
          </div>
        );
      })}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function detectarSuspeitos(historico: HistoricoItemEditavel[]): Set<number> {
  const suspeitos = new Set<number>();
  if (historico.length < 2) return suspeitos;
  for (let i = 0; i < historico.length; i++) {
    if (historico[i].estimado) continue;
    const outros = historico.filter((_, j) => j !== i);
    const mediaOutros = outros.reduce((acc, m) => acc + m.consumoKwh, 0) / outros.length;
    if (historico[i].consumoKwh < mediaOutros * 0.3) {
      suspeitos.add(i);
    }
  }
  return suspeitos;
}

export default function NovoCooperadoPage() {
  const router = useRouter();

  const [tipoCooperado, setTipoCooperado] = useState<TipoCooperado>('');
  const [etapa, setEtapa] = useState<Etapa>(0);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  // Tipo-specific: GERADOR
  const [usinas, setUsinas] = useState<UsinaOption[]>([]);
  const [usinaPropriaId, setUsinaPropriaId] = useState('');
  // Tipo-specific: CARREGADOR_VEICULAR
  const [percentualRepasse, setPercentualRepasse] = useState('');

  // SEM_UC
  const [docArquivo, setDocArquivo] = useState<File | null>(null);
  const docRef = useRef<HTMLInputElement>(null);
  const [termoAceito, setTermoAceito] = useState(false);

  // OCR
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // OCR result
  const [ocr, setOcr] = useState<DadosOcr | null>(null);

  // Histórico selecionado (step 8)
  const [mesesSelecionados, setMesesSelecionados] = useState<Set<number>>(new Set());

  // Histórico editável (step 8)
  const [historicoEditado, setHistoricoEditado] = useState<HistoricoItemEditavel[]>([]);
  // editandoIdx removido - inputs sempre editáveis
  const [adicionandoMes, setAdicionandoMes] = useState(false);
  const [novoMesAno, setNovoMesAno] = useState('');
  const [novoKwh, setNovoKwh] = useState(0);
  const [novoValorRS, setNovoValorRS] = useState(0);

  // Componentes do kWh selecionados (step 8)
  const [componentesMarcados, setComponentesMarcados] = useState<Set<string>>(
    new Set(['tarifaTUSD', 'tarifaTE', 'valorBandeira', 'icms', 'pisCofins', 'contribIluminacaoPublica', 'multaJuros', 'outrosEncargos', 'descontos']),
  );

  // Valores editáveis dos componentes do kWh (sobrescrevem OCR)
  const [componentesEditados, setComponentesEditados] = useState<Record<string, number>>({});

  function atualizarComponenteValor(key: string, valor: number) {
    setComponentesEditados(prev => ({ ...prev, [key]: valor }));
  }

  function getComponenteValor(key: string, ocrValor: number): number {
    return componentesEditados[key] !== undefined ? componentesEditados[key] : ocrValor;
  }

  // Base para aplicação do desconto
  const [baseDesconto, setBaseDesconto] = useState<'KWH' | 'VALOR_FATURA'>('KWH');

  // Mínimo faturável
  const [minimoConfig, setMinimoConfig] = useState<{ ativo: boolean; mono: number; bi: number; tri: number }>({ ativo: false, mono: 30, bi: 50, tri: 100 });

  // Planos e simulação (step 8)
  interface PlanoOption { id: string; nome: string; descontoBase: string; modeloCobranca: string; temPromocao: boolean; descontoPromocional: string | null; mesesPromocao: number | null }
  const [planosAtivos, setPlanosAtivos] = useState<PlanoOption[]>([]);
  const [planoSelecionadoId, setPlanoSelecionadoId] = useState('');
  const [simulacao, setSimulacao] = useState<{
    faturaAtual: number;
    faturaCooperebr: number;
    desconto: number;
    economiaMensal: number;
    economia5anos: number;
    mesesGratis: number;
  } | null>(null);

  useEffect(() => {
    if (tipoCooperado === 'GERADOR' && usinas.length === 0) {
      api.get<UsinaOption[]>('/usinas').then(r => setUsinas(r.data)).catch(() => {});
    }
  }, [tipoCooperado]);

  useEffect(() => {
    if (etapa === 8) {
      Promise.all([
        api.get<{ valor: string }>('/config-tenant/minimo_faturavel_ativo').then(r => r.data.valor).catch(() => 'false'),
        api.get<{ valor: string }>('/config-tenant/minimo_monofasico').then(r => r.data.valor).catch(() => '30'),
        api.get<{ valor: string }>('/config-tenant/minimo_bifasico').then(r => r.data.valor).catch(() => '50'),
        api.get<{ valor: string }>('/config-tenant/minimo_trifasico').then(r => r.data.valor).catch(() => '100'),
      ]).then(([ativo, mono, bi, tri]) => {
        setMinimoConfig({ ativo: ativo === 'true', mono: Number(mono) || 30, bi: Number(bi) || 50, tri: Number(tri) || 100 });
      });
      // Buscar planos ativos
      api.get<PlanoOption[]>('/planos/ativos').then(r => setPlanosAtivos(r.data)).catch(() => {});
    }
  }, [etapa]);

  // Cooperado form
  const [formCoop, setFormCoop] = useState({
    nomeCompleto: '', cpf: '', email: '', telefone: '', status: 'PENDENTE',
  });

  // UC form
  const [formUC, setFormUC] = useState({
    endereco: '', cidade: '', estado: '', cep: '',
    numeroUC: '', distribuidora: '', classificacao: '',
    codigoMedidor: '', bairro: '',
  });

  // After creation
  const [cooperadoId, setCooperadoId] = useState<string | null>(null);
  const [ucsCount, setUcsCount] = useState(0);
  const [ultimaUC, setUltimaUC] = useState<{ endereco: string; distribuidora: string; consumo: number } | null>(null);

  // Step 3 preference
  const [preferencia, setPreferencia] = useState<'CONSOLIDADA' | 'SEPARADA' | ''>('');

  // Step 4 document uploads
  const [docUploads, setDocUploads] = useState<Record<string, File | null>>({});
  const [uploadingDocs, setUploadingDocs] = useState(false);
  const [docsEnviados, setDocsEnviados] = useState(false);
  const [repLegalNome, setRepLegalNome] = useState('');
  const [repLegalCpf, setRepLegalCpf] = useState('');
  const [repLegalCargo, setRepLegalCargo] = useState('');

  // ── File handling ──────────────────────────────────────────────────────────

  function handleFile(file: File) { setArquivo(file); setErro(''); }

  function onDrop(e: React.DragEvent) {
    e.preventDefault(); setDrag(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }

  function toBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // ── Step 1 → 2: OCR ───────────────────────────────────────────────────────

  async function analisarFatura() {
    if (!arquivo) { setErro('Selecione um arquivo primeiro.'); return; }
    setErro(''); setLoading(true);
    try {
      const arquivoBase64 = await toBase64(arquivo);
      const tipoArquivo = arquivo.type === 'application/pdf' ? 'pdf' : 'imagem';
      const { data } = await api.post<DadosOcr>('/faturas/extrair', { arquivoBase64, tipoArquivo });
      setOcr(data);
      setFormCoop(prev => ({ ...prev, nomeCompleto: data.titular || '', cpf: data.documento || '' }));
      setFormUC({
        endereco: data.enderecoInstalacao || '',
        cidade: data.cidade || '',
        estado: data.estado || '',
        cep: data.cep || '',
        bairro: data.bairro || '',
        numeroUC: data.numeroUC || '',
        distribuidora: data.distribuidora || '',
        classificacao: data.classificacao || '',
        codigoMedidor: data.codigoMedidor || '',
      });
      // Inicializar valores editáveis dos componentes
      setComponentesEditados({
        icmsValor: data.icmsValor ?? 0,
        icmsPercentual: data.icmsPercentual ?? 0,
        pisCofinsValor: data.pisCofinsValor ?? 0,
        pisCofinsPercentual: data.pisCofinsPercentual ?? 0,
        contribIluminacaoPublica: data.contribIluminacaoPublica ?? 0,
        outrosEncargos: data.outrosEncargos ?? 0,
      });
      // Criar cópia editável do histórico e detectar suspeitos
      const histEditavel: HistoricoItemEditavel[] = (data.historicoConsumo ?? []).map((h: HistoricoItem) => ({ ...h }));
      setHistoricoEditado(histEditavel);
      setAdicionandoMes(false);
      const suspeitosInit = detectarSuspeitos(histEditavel);
      setMesesSelecionados(new Set(
        histEditavel.map((_: HistoricoItemEditavel, i: number) => i).filter((i: number) => !suspeitosInit.has(i))
      ));
      setEtapa(2);
    } catch {
      setErro('Erro ao processar fatura. Verifique o arquivo e tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  // ── Step 2 → 8: ir para histórico ─────────────────────────────────────────

  function avancarParaHistorico() {
    if (!formCoop.nomeCompleto.trim() || !formCoop.email.trim() || !formCoop.cpf.trim()) {
      setErro('Nome, CPF e email são obrigatórios.');
      return;
    }
    setErro('');
    setEtapa(8);
  }

  // ── Cálculos do histórico ─────────────────────────────────────────────────

  function calcularEstatisticas() {
    const selecionados = historicoEditado.filter((_, i) => mesesSelecionados.has(i));
    const totalKwh = selecionados.reduce((acc, m) => acc + m.consumoKwh, 0);
    const mediaKwh = selecionados.length > 0 ? totalKwh / selecionados.length : 0;
    const tarifaKwh = (ocr?.tarifaTUSD ?? 0) + (ocr?.tarifaTE ?? 0);
    // Média dos valores R$ (apenas meses com valorRS > 0)
    const mesesComValor = selecionados.filter(m => m.valorRS > 0);
    const mediaValorRS = mesesComValor.length > 0
      ? mesesComValor.reduce((acc, m) => acc + m.valorRS, 0) / mesesComValor.length
      : 0;
    return { totalKwh, mediaKwh, tarifaKwh, qtd: selecionados.length, totalDisponivel: historicoEditado.length, mediaValorRS };
  }

  function calcularValorBrutoKwh() {
    if (!ocr) return 0;
    const consumo = ocr.consumoAtualKwh || 1;
    let valor = 0;
    if (componentesMarcados.has('tarifaTUSD')) valor += ocr.tarifaTUSD ?? 0;
    if (componentesMarcados.has('tarifaTE')) valor += ocr.tarifaTE ?? 0;
    if (componentesMarcados.has('valorBandeira')) valor += ocr.valorBandeira ?? 0;
    // Impostos/encargos por kWh: dividir valor total pelo consumo (usando valores editados)
    if (componentesMarcados.has('icms')) valor += getComponenteValor('icmsValor', ocr.icmsValor ?? 0) / consumo;
    if (componentesMarcados.has('pisCofins')) valor += getComponenteValor('pisCofinsValor', ocr.pisCofinsValor ?? 0) / consumo;
    if (componentesMarcados.has('contribIluminacaoPublica')) valor += getComponenteValor('contribIluminacaoPublica', ocr.contribIluminacaoPublica ?? 0) / consumo;
    if (componentesMarcados.has('multaJuros')) valor += (ocr.multaJuros ?? 0) / consumo;
    if (componentesMarcados.has('outrosEncargos')) valor += getComponenteValor('outrosEncargos', ocr.outrosEncargos ?? 0) / consumo;
    if (componentesMarcados.has('descontos')) valor -= (ocr.descontos ?? 0) / consumo;
    return Math.max(0, valor);
  }

  function toggleComponente(key: string) {
    setComponentesMarcados(prev => {
      const next = new Set(prev);
      if (next.has(key)) { next.delete(key); } else { next.add(key); }
      return next;
    });
  }

  function toggleMes(idx: number) {
    setMesesSelecionados(prev => {
      const next = new Set(prev);
      if (next.has(idx)) { next.delete(idx); } else { next.add(idx); }
      return next;
    });
  }

  function adicionarMesEstimado() {
    if (!novoMesAno || novoKwh <= 0) return;
    const novoIdx = historicoEditado.length;
    setHistoricoEditado(prev => [...prev, { mesAno: novoMesAno, consumoKwh: novoKwh, valorRS: novoValorRS, estimado: true }]);
    setMesesSelecionados(prev => new Set([...prev, novoIdx]));
    setAdicionandoMes(false);
    setNovoMesAno('');
    setNovoKwh(0);
    setNovoValorRS(0);
  }

  function removerMesEstimado(idx: number) {
    setHistoricoEditado(prev => prev.filter((_, i) => i !== idx));
    setMesesSelecionados(prev => {
      const next = new Set<number>();
      for (const i of prev) {
        if (i < idx) next.add(i);
        else if (i > idx) next.add(i - 1);
      }
      return next;
    });
  }

  function atualizarConsumoMes(idx: number, valor: number) {
    setHistoricoEditado(prev => prev.map((item, i) => i === idx ? { ...item, consumoKwh: valor } : item));
  }

  function atualizarValorMes(idx: number, valor: number) {
    setHistoricoEditado(prev => prev.map((item, i) => i === idx ? { ...item, valorRS: valor } : item));
  }

  // ── Gerar simulação de proposta ─────────────────────────────────────────

  function gerarSimulacao() {
    if (!planoSelecionadoId) return;
    const plano = planosAtivos.find(p => p.id === planoSelecionadoId);
    if (!plano) return;

    const desconto = Number(plano.descontoBase) / 100;
    const { mediaValorRS } = calcularEstatisticas();
    const valorBrutoKwh = calcularValorBrutoKwh();
    const { mediaKwh } = calcularEstatisticas();

    let faturaAtual: number;
    if (baseDesconto === 'VALOR_FATURA' && mediaValorRS > 0) {
      faturaAtual = mediaValorRS;
    } else {
      faturaAtual = valorBrutoKwh * mediaKwh;
    }

    const economiaMensal = faturaAtual * desconto;
    const faturaCooperebr = faturaAtual - economiaMensal;
    const economia5anos = economiaMensal * 60;
    const mesesGratis = faturaAtual > 0 ? Math.round(economia5anos / faturaAtual) : 0;

    setSimulacao({
      faturaAtual,
      faturaCooperebr,
      desconto: Number(plano.descontoBase),
      economiaMensal,
      economia5anos,
      mesesGratis,
    });
  }

  // ── Step 8 → 4: criar cooperado + UC ──────────────────────────────────────

  async function confirmarCadastro() {
    // Validar meses suspeitos marcados
    const suspeitosAtual = detectarSuspeitos(historicoEditado);
    const suspeitosMarcados = [...suspeitosAtual].filter(i => mesesSelecionados.has(i));
    if (suspeitosMarcados.length > 0) {
      setErro(`Há ${suspeitosMarcados.length} mês(es) com valores suspeitos marcados. Desmarque ou corrija os valores antes de continuar.`);
      return;
    }
    setErro(''); setLoading(true);
    try {
      let cid = cooperadoId;

      if (!cid) {
        const { data: novoCooperado } = await api.post<{ id: string }>('/cooperados', {
          nomeCompleto: formCoop.nomeCompleto,
          cpf: formCoop.cpf,
          email: formCoop.email,
          telefone: formCoop.telefone || undefined,
          status: formCoop.status,
        });
        cid = novoCooperado.id;
        setCooperadoId(cid);
      }

      const ucNumero = formUC.numeroUC || `UC-${Date.now()}`;
      await api.post('/ucs', {
        numero: ucNumero,
        endereco: formUC.endereco,
        cidade: formUC.cidade,
        estado: formUC.estado,
        cep: formUC.cep || undefined,
        bairro: formUC.bairro || undefined,
        numeroUC: formUC.numeroUC || undefined,
        distribuidora: formUC.distribuidora || undefined,
        classificacao: formUC.classificacao || undefined,
        codigoMedidor: formUC.codigoMedidor || undefined,
        cooperadoId: cid,
      });

      const { mediaKwh } = calcularEstatisticas();

      // Se houver simulação gerada, salvar a proposta automaticamente
      if (simulacao && planoSelecionadoId && cid) {
        const selecionados = historicoEditado.filter((_, i) => mesesSelecionados.has(i));
        try {
          await api.post('/motor-proposta/calcular', {
            cooperadoId: cid,
            historico: selecionados.map(h => ({ mesAno: h.mesAno, consumoKwh: h.consumoKwh, valorRS: h.valorRS })),
            kwhMesRecente: ocr?.consumoAtualKwh ?? Math.round(mediaKwh),
            valorMesRecente: ocr?.totalAPagar ?? 0,
            mesReferencia: selecionados[selecionados.length - 1]?.mesAno ?? '',
            tipoFornecimento: ocr?.tipoFornecimento || undefined,
          });
        } catch {
          // Proposta é complementar, não bloqueia o cadastro
        }
      }

      setUcsCount(prev => prev + 1);
      setUltimaUC({
        endereco: formUC.endereco,
        distribuidora: formUC.distribuidora,
        consumo: Math.round(mediaKwh),
      });
      setEtapa(4);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setErro(msg || 'Erro ao cadastrar. Verifique os dados e tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  // ── Step 4: adicionar outra UC ─────────────────────────────────────────────

  function adicionarOutraUC() {
    setArquivo(null); setOcr(null);
    setFormUC({ endereco: '', cidade: '', estado: '', cep: '', bairro: '', numeroUC: '', distribuidora: '', classificacao: '', codigoMedidor: '' });
    setMesesSelecionados(new Set());
    setHistoricoEditado([]);
    setAdicionandoMes(false);
    setErro('');
    setEtapa(1);
  }

  function finalizar() {
    if (ucsCount >= 2) { setEtapa(3); }
    else { router.push(`/dashboard/cooperados/${cooperadoId}`); }
  }

  // ── Step 3: preferência ────────────────────────────────────────────────────

  async function salvarPreferencia() {
    if (!preferencia) { setErro('Selecione uma opção.'); return; }
    if (!cooperadoId) return;
    setLoading(true);
    try {
      await api.put(`/cooperados/${cooperadoId}`, { preferenciaCobranca: preferencia });
      router.push(`/dashboard/cooperados/${cooperadoId}`);
    } catch {
      setErro('Erro ao salvar preferência.');
    } finally { setLoading(false); }
  }

  // ── SEM_UC ────────────────────────────────────────────────────────────────

  async function cadastrarSemUC() {
    if (!formCoop.nomeCompleto.trim() || !formCoop.email.trim() || !formCoop.cpf.trim()) {
      setErro('Nome, CPF e email são obrigatórios.'); return;
    }
    setErro(''); setLoading(true);
    try {
      const payload: Record<string, unknown> = {
        nomeCompleto: formCoop.nomeCompleto,
        cpf: formCoop.cpf,
        email: formCoop.email,
        telefone: formCoop.telefone || undefined,
        status: 'PENDENTE',
        tipoCooperado: tipoCooperado || 'SEM_UC',
      };
      if (tipoCooperado === 'GERADOR' && usinaPropriaId) payload.usinaPropriaId = usinaPropriaId;
      if (tipoCooperado === 'CARREGADOR_VEICULAR' && percentualRepasse) payload.percentualRepasse = Number(percentualRepasse);
      const { data: novoCooperado } = await api.post<{ id: string }>('/cooperados', payload);
      setCooperadoId(novoCooperado.id);
      setEtapa(6);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setErro(msg || 'Erro ao cadastrar. Verifique os dados.');
    } finally { setLoading(false); }
  }

  async function enviarDocumentoSemUC() {
    if (!docArquivo || !cooperadoId) { setErro('Selecione o documento de identidade.'); return; }
    if (!termoAceito) { setErro('Aceite o termo de adesão para continuar.'); return; }
    setErro(''); setLoading(true);
    try {
      const formData = new FormData();
      formData.append('arquivo', docArquivo);
      formData.append('tipo', 'CNH_FRENTE');
      await api.post(`/documentos/cooperado/${cooperadoId}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      await api.put(`/cooperados/${cooperadoId}`, {
        termoAdesaoAceito: true,
        termoAdesaoAceitoEm: new Date().toISOString(),
      });
      setEtapa(7);
    } catch {
      setErro('Erro ao enviar documento. Tente novamente.');
    } finally { setLoading(false); }
  }

  // ── Step 4: enviar documentos ──────────────────────────────────────────────

  function setDocFile(tipo: string, file: File | null) {
    setDocUploads(prev => ({ ...prev, [tipo]: file }));
  }

  const temDocsSelecionados = Object.values(docUploads).some(f => f !== null);
  const isPJ = (formCoop.cpf || '').replace(/\D/g, '').length >= 14;

  async function enviarDocumentos() {
    if (!cooperadoId || !temDocsSelecionados) return;
    setUploadingDocs(true); setErro('');
    try {
      for (const [tipo, file] of Object.entries(docUploads)) {
        if (!file) continue;
        const formData = new FormData();
        formData.append('arquivo', file);
        formData.append('tipo', tipo);
        await api.post(`/documentos/upload/${cooperadoId}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }
      // Se PJ, salvar dados do representante legal
      if (isPJ && (repLegalNome || repLegalCpf || repLegalCargo)) {
        await api.put(`/cooperados/${cooperadoId}`, {
          tipoPessoa: 'PJ',
          representanteLegalNome: repLegalNome || undefined,
          representanteLegalCpf: repLegalCpf || undefined,
          representanteLegalCargo: repLegalCargo || undefined,
        });
      }
      setDocsEnviados(true);
    } catch {
      setErro('Erro ao enviar documentos. Tente novamente.');
    } finally { setUploadingDocs(false); }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl">

      <Link href="/dashboard/cooperados" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors">
        <ArrowLeft className="h-4 w-4 mr-1" />Cooperados
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">Novo cooperado</h1>

      {/* ── ETAPA 0: Seleção do tipo de cooperado ────────────────────────── */}
      {etapa === 0 && (
        <Card>
          <CardContent className="pt-6 space-y-5">
            <div>
              <h2 className="text-base font-semibold text-gray-800 mb-1">Tipo de cooperado</h2>
              <p className="text-sm text-gray-500">Escolha o perfil adequado para este cooperado.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {([
                { tipo: 'COM_UC' as const, icon: Zap, color: 'text-green-600', label: 'Com UC', desc: 'Possui unidade consumidora — upload de fatura', etapaInicial: 1 as Etapa },
                { tipo: 'SEM_UC' as const, icon: UserX, color: 'text-orange-500', label: 'Sem UC', desc: 'Sem unidade consumidora — cadastro simplificado', etapaInicial: 5 as Etapa },
                { tipo: 'GERADOR' as const, icon: Sun, color: 'text-yellow-500', label: 'Gerador', desc: 'Cooperado que possui usina própria de geração', etapaInicial: 5 as Etapa },
                { tipo: 'CARREGADOR_VEICULAR' as const, icon: Car, color: 'text-blue-500', label: 'Carregador Veicular', desc: 'Disponibiliza carregador EV com repasse à cooperativa', etapaInicial: 5 as Etapa },
                { tipo: 'USUARIO_CARREGADOR' as const, icon: PlugZap, color: 'text-purple-500', label: 'Usuário Carregador', desc: 'Utiliza pontos de recarga de veículos elétricos', etapaInicial: 5 as Etapa },
              ]).map((opt) => (
                <button
                  key={opt.tipo}
                  onClick={() => { setTipoCooperado(opt.tipo); setEtapa(opt.etapaInicial); }}
                  className="border-2 border-gray-200 hover:border-green-500 rounded-xl p-5 text-center transition-colors"
                >
                  <opt.icon className={`h-7 w-7 ${opt.color} mx-auto mb-2`} />
                  <p className="text-sm font-semibold text-gray-800">{opt.label}</p>
                  <p className="text-xs text-gray-500 mt-1 leading-snug">{opt.desc}</p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {tipoCooperado && <Stepper etapa={etapa} tipo={tipoCooperado} />}

      {/* ── ETAPA 1: Upload ──────────────────────────────────────────────────── */}
      {etapa === 1 && (
        <Card>
          <CardContent className="pt-6 space-y-5">
            <div>
              <h2 className="text-base font-semibold text-gray-800 mb-1">Upload da fatura de energia</h2>
              <p className="text-sm text-gray-500">A IA vai extrair os dados automaticamente.</p>
            </div>
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={onDrop}
              className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${drag ? 'border-green-500 bg-green-50' : arquivo ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'}`}
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
              {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Extraindo dados com IA...</> : 'Analisar fatura'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── ETAPA 2: Revisar dados ───────────────────────────────────────────── */}
      {etapa === 2 && (
        <div className="space-y-5">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <User className="h-4 w-4 text-green-700" />
                <h2 className="text-sm font-semibold text-gray-800">Dados do cooperado</h2>
                {!cooperadoId && <span className="ml-auto text-xs text-gray-400">Preencha email e telefone</span>}
                {cooperadoId && <span className="ml-auto text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Cooperado já criado</span>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Campo label="Nome completo *">
                    <input className={cls} value={formCoop.nomeCompleto} onChange={e => setFormCoop(p => ({ ...p, nomeCompleto: e.target.value }))} disabled={!!cooperadoId} />
                  </Campo>
                </div>
                <Campo label="CPF *">
                  <input className={cls} value={formCoop.cpf} onChange={e => setFormCoop(p => ({ ...p, cpf: e.target.value }))} disabled={!!cooperadoId} placeholder="000.000.000-00" />
                </Campo>
                <Campo label="Status">
                  <select className={cls} value={formCoop.status} onChange={e => setFormCoop(p => ({ ...p, status: e.target.value }))} disabled={!!cooperadoId}>
                    <option value="PENDENTE">Pendente</option>
                    <option value="PENDENTE_VALIDACAO">Pendente Validação</option>
                    <option value="PENDENTE_DOCUMENTOS">Pendente Documentos</option>
                    <option value="AGUARDANDO_CONCESSIONARIA">Aguardando Concessionária</option>
                    <option value="APROVADO">Aprovado</option>
                    <option value="ATIVO">Ativo</option>
                    <option value="SUSPENSO">Suspenso</option>
                    <option value="ENCERRADO">Encerrado</option>
                  </select>
                </Campo>
                <Campo label="Email *">
                  <input className={cls} type="email" value={formCoop.email} onChange={e => setFormCoop(p => ({ ...p, email: e.target.value }))} disabled={!!cooperadoId} placeholder="email@exemplo.com" />
                </Campo>
                <Campo label="Telefone">
                  <input className={cls} value={formCoop.telefone} onChange={e => setFormCoop(p => ({ ...p, telefone: e.target.value }))} disabled={!!cooperadoId} placeholder="(00) 00000-0000" />
                </Campo>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <Zap className="h-4 w-4 text-green-700" />
                <h2 className="text-sm font-semibold text-gray-800">
                  Dados da UC {ucsCount > 0 && <span className="text-gray-400 font-normal">({ucsCount + 1}ª unidade)</span>}
                </h2>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Campo label="Número UC">
                  <input className={cls} value={formUC.numeroUC} onChange={e => setFormUC(p => ({ ...p, numeroUC: e.target.value }))} />
                </Campo>
                <Campo label="Distribuidora">
                  <input className={cls} value={formUC.distribuidora} onChange={e => setFormUC(p => ({ ...p, distribuidora: e.target.value }))} />
                </Campo>
                <div className="col-span-2">
                  <Campo label="Endereço de instalação">
                    <input className={cls} value={formUC.endereco} onChange={e => setFormUC(p => ({ ...p, endereco: e.target.value }))} />
                  </Campo>
                </div>
                <Campo label="Bairro">
                  <input className={cls} value={formUC.bairro} onChange={e => setFormUC(p => ({ ...p, bairro: e.target.value }))} />
                </Campo>
                <Campo label="CEP">
                  <input className={cls} value={formUC.cep} onChange={e => setFormUC(p => ({ ...p, cep: e.target.value }))} />
                </Campo>
                <Campo label="Cidade">
                  <input className={cls} value={formUC.cidade} onChange={e => setFormUC(p => ({ ...p, cidade: e.target.value }))} />
                </Campo>
                <Campo label="Estado (UF)">
                  <input className={cls} value={formUC.estado} onChange={e => setFormUC(p => ({ ...p, estado: e.target.value }))} maxLength={2} />
                </Campo>
                <Campo label="Classificação">
                  <input className={cls} value={formUC.classificacao} onChange={e => setFormUC(p => ({ ...p, classificacao: e.target.value }))} />
                </Campo>
                <Campo label="Cód. medidor">
                  <input className={cls} value={formUC.codigoMedidor} onChange={e => setFormUC(p => ({ ...p, codigoMedidor: e.target.value }))} />
                </Campo>
              </div>
            </CardContent>
          </Card>

          {erro && <p className="text-sm text-red-600">{erro}</p>}

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => { setEtapa(1); setErro(''); }}>Voltar</Button>
            <Button onClick={avancarParaHistorico} className="flex-1">
              Próximo: Revisar consumo →
            </Button>
          </div>
        </div>
      )}

      {/* ── ETAPA 8: Histórico de consumo ────────────────────────────────────── */}
      {etapa === 8 && (() => {
        const suspeitos = detectarSuspeitos(historicoEditado);
        const { totalKwh, mediaKwh, tarifaKwh, qtd, totalDisponivel, mediaValorRS } = calcularEstatisticas();
        const tarifaTotal = (ocr?.tarifaTUSD ?? 0) + (ocr?.tarifaTE ?? 0);
        const cotaAnual = Math.round(mediaKwh * 12);

        // Meses disponíveis para adicionar (últimos 24 meses, excluindo existentes)
        const mesesExistentes = new Set(historicoEditado.map(h => h.mesAno));
        const mesesDisponiveis: string[] = [];
        const agora = new Date();
        for (let i = 1; i <= 24; i++) {
          const d = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
          const mesAno = `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
          if (!mesesExistentes.has(mesAno)) mesesDisponiveis.push(mesAno);
        }

        return (
          <div className="space-y-5">
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <BarChart2 className="h-4 w-4 text-green-700" />
                  <h2 className="text-sm font-semibold text-gray-800">Histórico de consumo</h2>
                  <span className="ml-auto text-xs text-gray-500">Marque os meses para calcular a média</span>
                </div>

                {/* Banner histórico incompleto */}
                {historicoEditado.length > 0 && historicoEditado.length < 12 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800 flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>Histórico de {historicoEditado.length} meses disponíveis. A cota mensal será calculada pela média dos meses selecionados e extrapolada para 12 meses (cotaAnual = média × 12).</span>
                  </div>
                )}

                {historicoEditado.length === 0 ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
                    Nenhum histórico extraído da fatura. Será usado o consumo atual como referência.
                  </div>
                ) : (
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    {/* Header */}
                    <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500 uppercase">
                      <div className="col-span-1"></div>
                      <div className="col-span-4">Mês</div>
                      <div className="col-span-4 text-right">Consumo (kWh)</div>
                      <div className="col-span-3 text-right">Valor (R$)</div>
                    </div>
                    {/* Rows */}
                    {historicoEditado.map((item, idx) => {
                      const sel = mesesSelecionados.has(idx);
                      const isSuspeito = suspeitos.has(idx);
                      return (
                        <div
                          key={idx}
                          className={`grid grid-cols-12 gap-2 px-4 py-2.5 transition-colors border-b border-gray-100 last:border-0 ${
                            isSuspeito ? 'bg-amber-50' : sel ? 'bg-green-50' : 'hover:bg-gray-50'
                          }`}
                          title={isSuspeito ? 'Valor suspeito — verifique e corrija se necessário' : undefined}
                        >
                          <div className="col-span-1 flex items-center">
                            <input
                              type="checkbox"
                              checked={sel}
                              onChange={() => toggleMes(idx)}
                              className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                            />
                          </div>
                          <div className={`col-span-4 text-sm font-medium flex items-center gap-1 ${sel ? 'text-gray-900' : 'text-gray-400'}`}>
                            {isSuspeito && <span title="Valor suspeito">⚠️</span>}
                            {item.estimado && <span title="Mês estimado"><Pencil className="h-3 w-3 text-blue-500" /></span>}
                            {item.mesAno}
                            {item.estimado && (
                              <button onClick={() => removerMesEstimado(idx)} className="ml-1 text-red-400 hover:text-red-600" title="Remover mês estimado">
                                <X className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                          <div className={`col-span-4 text-sm text-right ${sel ? 'text-gray-900' : 'text-gray-400'}`}>
                            <input
                              type="number"
                              className={`border rounded px-2 py-0.5 text-sm w-24 text-right focus:ring-2 focus:ring-green-500 focus:border-green-500 focus:outline-none ${
                                isSuspeito ? 'border-amber-400' : 'border-gray-200'
                              }`}
                              value={item.consumoKwh}
                              onChange={(e) => atualizarConsumoMes(idx, Number(e.target.value))}
                            />
                          </div>
                          <div className={`col-span-3 text-sm text-right ${sel ? 'text-gray-700' : 'text-gray-400'}`}>
                            <input
                              type="number"
                              step="0.01"
                              className={`border rounded px-2 py-0.5 text-sm w-24 text-right focus:ring-2 focus:ring-green-500 focus:border-green-500 focus:outline-none border-gray-200`}
                              value={item.valorRS}
                              onChange={(e) => atualizarValorMes(idx, Number(e.target.value))}
                            />
                          </div>
                        </div>
                      );
                    })}
                    {/* Linha de adicionar mês estimado */}
                    {adicionandoMes && (
                      <div className="grid grid-cols-12 gap-2 px-4 py-2.5 bg-blue-50 border-b border-gray-100">
                        <div className="col-span-1 flex items-center">
                          <input type="checkbox" checked disabled className="rounded border-gray-300 text-green-600" />
                        </div>
                        <div className="col-span-4 flex items-center gap-1">
                          <Pencil className="h-3 w-3 text-blue-500" />
                          <select
                            className="text-sm border border-gray-300 rounded px-1 py-0.5 bg-white"
                            value={novoMesAno}
                            onChange={(e) => setNovoMesAno(e.target.value)}
                          >
                            <option value="">Selecione...</option>
                            {mesesDisponiveis.map(m => <option key={m} value={m}>{m}</option>)}
                          </select>
                        </div>
                        <div className="col-span-3 text-right">
                          <input
                            type="number"
                            className="w-full text-right text-sm border border-gray-300 rounded px-2 py-0.5"
                            placeholder="kWh"
                            value={novoKwh || ''}
                            onChange={(e) => setNovoKwh(Number(e.target.value))}
                          />
                        </div>
                        <div className="col-span-2 text-right">
                          <input
                            type="number"
                            step="0.01"
                            className="w-full text-right text-sm border border-gray-300 rounded px-2 py-0.5"
                            placeholder="R$"
                            value={novoValorRS || ''}
                            onChange={(e) => setNovoValorRS(Number(e.target.value))}
                            onKeyDown={(e) => { if (e.key === 'Enter') adicionarMesEstimado(); }}
                          />
                        </div>
                        <div className="col-span-2 flex items-center justify-end gap-1">
                          <button onClick={adicionarMesEstimado} disabled={!novoMesAno || novoKwh <= 0}
                            className="text-xs text-green-700 hover:underline disabled:text-gray-400 disabled:no-underline">
                            OK
                          </button>
                          <button onClick={() => setAdicionandoMes(false)} className="text-red-400 hover:text-red-600">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Ações rápidas */}
                <div className="flex gap-2 text-xs">
                  {historicoEditado.length > 0 && (
                    <>
                      <button
                        onClick={() => {
                          const susp = detectarSuspeitos(historicoEditado);
                          setMesesSelecionados(new Set(historicoEditado.map((_, i) => i).filter(i => !susp.has(i))));
                        }}
                        className="text-green-700 hover:underline"
                      >
                        Selecionar todos
                      </button>
                      <span className="text-gray-300">|</span>
                      <button
                        onClick={() => setMesesSelecionados(new Set())}
                        className="text-gray-500 hover:underline"
                      >
                        Desmarcar todos
                      </button>
                      <span className="text-gray-300">|</span>
                    </>
                  )}
                  <button
                    onClick={() => setAdicionandoMes(true)}
                    className="text-blue-600 hover:underline flex items-center gap-1"
                  >
                    <Plus className="h-3 w-3" /> Adicionar mês estimado
                  </button>
                </div>
              </CardContent>
            </Card>

            {/* Composição do kWh */}
            <Card>
              <CardContent className="pt-6 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <Zap className="h-4 w-4 text-green-700" />
                  <h2 className="text-sm font-semibold text-gray-800">Composição do kWh</h2>
                  <span className="ml-auto text-xs text-gray-500">Desmarque para excluir do cálculo</span>
                </div>

                {(() => {
                  const consumo = ocr?.consumoAtualKwh || 1;
                  const tusdTe = (ocr?.tarifaTUSD ?? 0) + (ocr?.tarifaTE ?? 0);
                  const icmsPctEdit = getComponenteValor('icmsPercentual', ocr?.icmsPercentual ?? 0);
                  const pisCofPctEdit = getComponenteValor('pisCofinsPercentual', ocr?.pisCofinsPercentual ?? 0);

                  // Editable keys and their OCR defaults
                  type CompItem = { key: string; label: string; valor: number; tipo: 'kwh' | 'fixo'; editKey?: string; pctKey?: string };
                  const componentes: CompItem[] = [
                    { key: 'tarifaTUSD', label: 'TUSD', valor: ocr?.tarifaTUSD ?? 0, tipo: 'kwh' },
                    { key: 'tarifaTE', label: 'TE', valor: ocr?.tarifaTE ?? 0, tipo: 'kwh' },
                    { key: 'valorBandeira', label: `Bandeira (${ocr?.bandeiraTarifaria ?? '—'})`, valor: ocr?.valorBandeira ?? 0, tipo: 'kwh' },
                    { key: 'icms', label: 'ICMS', valor: getComponenteValor('icmsValor', ocr?.icmsValor ?? 0), tipo: 'fixo', editKey: 'icmsValor', pctKey: 'icmsPercentual' },
                    { key: 'pisCofins', label: 'PIS/COFINS', valor: getComponenteValor('pisCofinsValor', ocr?.pisCofinsValor ?? 0), tipo: 'fixo', editKey: 'pisCofinsValor', pctKey: 'pisCofinsPercentual' },
                    { key: 'contribIluminacaoPublica', label: 'CIP/COSIP', valor: getComponenteValor('contribIluminacaoPublica', ocr?.contribIluminacaoPublica ?? 0), tipo: 'fixo', editKey: 'contribIluminacaoPublica' },
                    { key: 'multaJuros', label: 'Multa/Juros', valor: ocr?.multaJuros ?? 0, tipo: 'fixo' },
                    { key: 'outrosEncargos', label: 'Outros encargos', valor: getComponenteValor('outrosEncargos', ocr?.outrosEncargos ?? 0), tipo: 'fixo', editKey: 'outrosEncargos' },
                    { key: 'descontos', label: 'Descontos (−)', valor: ocr?.descontos ?? 0, tipo: 'fixo' },
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
                          <div
                            key={c.key}
                            className={`grid grid-cols-12 gap-2 px-4 py-2 transition-colors border-b border-gray-100 last:border-0 ${sel ? 'bg-green-50' : 'hover:bg-gray-50'}`}
                          >
                            <div className="col-span-1 flex items-center">
                              <input
                                type="checkbox"
                                checked={sel}
                                onChange={() => toggleComponente(c.key)}
                                className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                              />
                            </div>
                            <div className={`col-span-3 text-sm flex items-center ${sel ? 'text-gray-900' : 'text-gray-400'}`}>
                              {c.label}
                              {c.key === 'pisCofins' && pisCofPctEdit === 0 && (
                                <span className="ml-1 text-xs text-amber-600 italic" title="Não identificado na fatura - verifique">
                                  !
                                </span>
                              )}
                            </div>
                            <div className="col-span-2 text-sm text-right flex items-center justify-end">
                              {hasPct ? (
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    step="0.1"
                                    className="border border-gray-200 rounded px-1.5 py-0.5 text-sm w-16 text-right focus:ring-2 focus:ring-green-500 focus:border-green-500 focus:outline-none"
                                    value={pctValue}
                                    onChange={(e) => {
                                      const newPct = Number(e.target.value);
                                      atualizarComponenteValor(c.pctKey!, newPct);
                                      // Recalculate valor: (TUSD+TE) * pct/100 * consumo
                                      const newValor = tusdTe * (newPct / 100) * consumo;
                                      atualizarComponenteValor(c.editKey!, newValor);
                                    }}
                                  />
                                  <span className="text-xs text-gray-400">%</span>
                                </div>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </div>
                            <div className={`col-span-3 text-sm text-right flex items-center justify-end ${c.key === 'pisCofins' && pisCofPctEdit === 0 ? 'text-amber-600 font-medium' : sel ? 'text-gray-700' : 'text-gray-400'}`}>
                              {isEditable ? (
                                <div className="flex items-center gap-1">
                                  <span className="text-xs text-gray-400">R$</span>
                                  <input
                                    type="number"
                                    step="0.01"
                                    className="border border-gray-200 rounded px-1.5 py-0.5 text-sm w-24 text-right focus:ring-2 focus:ring-green-500 focus:border-green-500 focus:outline-none"
                                    value={c.valor}
                                    onChange={(e) => {
                                      const newVal = Number(e.target.value);
                                      atualizarComponenteValor(c.editKey!, newVal);
                                      // Recalculate R$/kWh automatically
                                    }}
                                  />
                                </div>
                              ) : (
                                c.tipo === 'kwh'
                                  ? `R$ ${c.valor.toLocaleString('pt-BR', { minimumFractionDigits: 5, maximumFractionDigits: 5 })}/kWh`
                                  : `R$ ${c.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                              )}
                            </div>
                            <div className={`col-span-3 text-sm text-right flex items-center justify-end ${sel ? 'text-gray-900 font-medium' : 'text-gray-400'}`}>
                              {c.key === 'descontos' ? '−' : ''}{porKwh.toLocaleString('pt-BR', { minimumFractionDigits: 5, maximumFractionDigits: 5 })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>

            {/* Painel de estatísticas */}
            <Card>
              <CardContent className="pt-5 pb-5">
                <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">Resumo do cálculo</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-lg px-4 py-3">
                    <p className="text-xs text-gray-500">Meses na base</p>
                    <p className="text-2xl font-bold text-gray-900">{qtd}</p>
                    <p className="text-xs text-gray-400">({qtd} selecionados de {totalDisponivel} disponíveis)</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg px-4 py-3">
                    <p className="text-xs text-gray-500">Total kWh (período)</p>
                    <p className="text-2xl font-bold text-gray-900">{totalKwh.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</p>
                    <p className="text-xs text-gray-400">kWh acumulados</p>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3">
                    <p className="text-xs text-green-700 font-medium">Média mensal (cota)</p>
                    <p className="text-2xl font-bold text-green-800">{Math.round(mediaKwh).toLocaleString('pt-BR')}</p>
                    <p className="text-xs text-green-600">kWh/mês</p>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3">
                    <p className="text-xs text-green-700 font-medium">Cota anual estimada</p>
                    <p className="text-2xl font-bold text-green-800">{cotaAnual.toLocaleString('pt-BR')}</p>
                    <p className="text-xs text-green-600">kWh/ano (média × 12)</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg px-4 py-3">
                    <p className="text-xs text-gray-500">Tarifa kWh (TUSD+TE)</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {tarifaTotal > 0
                        ? `R$ ${tarifaTotal.toLocaleString('pt-BR', { minimumFractionDigits: 5, maximumFractionDigits: 5 })}`
                        : '—'}
                    </p>
                    <p className="text-xs text-gray-400">por kWh consumido</p>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                    <p className="text-xs text-amber-700 font-medium">Valor bruto do kWh</p>
                    <p className="text-2xl font-bold text-amber-800">
                      {`R$ ${calcularValorBrutoKwh().toLocaleString('pt-BR', { minimumFractionDigits: 5, maximumFractionDigits: 5 })}`}
                    </p>
                    <p className="text-xs text-amber-600">componentes marcados</p>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
                    <p className="text-xs text-blue-700 font-medium">Valor médio pago (R$/mês)</p>
                    <p className="text-2xl font-bold text-blue-800">
                      {mediaValorRS > 0
                        ? `R$ ${mediaValorRS.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : '—'}
                    </p>
                    <p className="text-xs text-blue-600">média dos meses selecionados</p>
                  </div>
                </div>

                {/* Mínimo faturável + tipo fornecimento */}
                {(() => {
                  const tipo = ocr?.tipoFornecimento ?? '';
                  const tipoLabel: Record<string, string> = { MONOFASICO: 'Monofásico', BIFASICO: 'Bifásico', TRIFASICO: 'Trifásico' };
                  const tipoBadgeColor: Record<string, string> = { MONOFASICO: 'bg-gray-100 text-gray-700', BIFASICO: 'bg-blue-100 text-blue-700', TRIFASICO: 'bg-purple-100 text-purple-700' };
                  const minimoKwh = minimoConfig.ativo
                    ? (tipo === 'MONOFASICO' ? minimoConfig.mono : tipo === 'BIFASICO' ? minimoConfig.bi : tipo === 'TRIFASICO' ? minimoConfig.tri : 0)
                    : 0;
                  const consumoConsiderado = Math.max(0, mediaKwh - minimoKwh);

                  return (tipo || minimoConfig.ativo) ? (
                    <div className="mt-4 pt-3 border-t border-gray-100 grid grid-cols-3 gap-3">
                      {tipo && (
                        <div className="bg-gray-50 rounded-lg px-4 py-3">
                          <p className="text-xs text-gray-500">Tipo de fornecimento</p>
                          <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium ${tipoBadgeColor[tipo] ?? 'bg-gray-100 text-gray-600'}`}>
                            {tipoLabel[tipo] ?? tipo}
                          </span>
                        </div>
                      )}
                      {minimoConfig.ativo && minimoKwh > 0 && (
                        <div className="bg-orange-50 border border-orange-200 rounded-lg px-4 py-3">
                          <p className="text-xs text-orange-700 font-medium">Mínimo faturável</p>
                          <p className="text-lg font-bold text-orange-800">{minimoKwh} kWh</p>
                          <p className="text-xs text-orange-600">{tipoLabel[tipo] ?? tipo}</p>
                        </div>
                      )}
                      {minimoConfig.ativo && minimoKwh > 0 && (
                        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3">
                          <p className="text-xs text-green-700 font-medium">Consumo para proposta</p>
                          <p className="text-lg font-bold text-green-800">{Math.round(consumoConsiderado).toLocaleString('pt-BR')} kWh</p>
                          <p className="text-xs text-green-600">média − mínimo</p>
                        </div>
                      )}
                    </div>
                  ) : null;
                })()}

                {/* Seletor base de desconto */}
                <div className="mt-4 pt-3 border-t border-gray-100">
                  <p className="text-xs font-medium text-gray-600 mb-2">Base para aplicação do desconto do plano:</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setBaseDesconto('KWH')}
                      className={`flex-1 text-xs px-3 py-2 rounded-lg border-2 transition-colors ${baseDesconto === 'KWH' ? 'border-green-600 bg-green-50 text-green-800 font-medium' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                    >
                      Valor do kWh bruto (R$/kWh)
                    </button>
                    <button
                      onClick={() => setBaseDesconto('VALOR_FATURA')}
                      className={`flex-1 text-xs px-3 py-2 rounded-lg border-2 transition-colors ${baseDesconto === 'VALOR_FATURA' ? 'border-green-600 bg-green-50 text-green-800 font-medium' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                      disabled={mediaValorRS <= 0}
                      title={mediaValorRS <= 0 ? 'Indisponível: nenhum mês com valor R$ no histórico' : ''}
                    >
                      Valor médio da fatura (R$/mês)
                    </button>
                  </div>
                </div>

                {/* Consumo atual da fatura */}
                {ocr && ocr.consumoAtualKwh > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between text-sm text-gray-600">
                    <span>Consumo atual (mês de referência)</span>
                    <span className="font-medium text-gray-900">{ocr.consumoAtualKwh.toLocaleString('pt-BR')} kWh</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Simulação de proposta */}
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="h-4 w-4 text-green-700" />
                  <h2 className="text-sm font-semibold text-gray-800">Simulação de Proposta</h2>
                </div>

                <div className="flex gap-3 items-end">
                  <div className="flex-1">
                    <label className={lbl}>Plano</label>
                    <select
                      className={cls}
                      value={planoSelecionadoId}
                      onChange={e => { setPlanoSelecionadoId(e.target.value); setSimulacao(null); }}
                    >
                      <option value="">Selecione um plano...</option>
                      {planosAtivos.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.nome} ({Number(p.descontoBase)}% desc.)
                        </option>
                      ))}
                    </select>
                  </div>
                  <Button
                    onClick={gerarSimulacao}
                    disabled={!planoSelecionadoId}
                    variant="outline"
                  >
                    <BarChart2 className="h-4 w-4 mr-2" />
                    Gerar simulação
                  </Button>
                </div>

                {simulacao && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-gray-500">Fatura atual estimada</p>
                        <p className="text-lg font-bold text-gray-900">
                          {simulacao.faturaAtual.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/mês
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-green-700">Com CoopereBR ({simulacao.desconto}% desc.)</p>
                        <p className="text-lg font-bold text-green-800">
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
                        <p className="text-xs text-gray-500">Economia em 5 anos</p>
                        <p className="text-lg font-bold text-green-700">
                          {simulacao.economia5anos.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </p>
                      </div>
                    </div>
                    <div className="text-center pt-2 border-t border-green-200">
                      <p className="text-sm text-green-800">
                        Equivale a <span className="font-bold text-lg">{simulacao.mesesGratis}</span> meses de energia grátis
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {erro && <p className="text-sm text-red-600">{erro}</p>}

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => { setEtapa(2); setErro(''); }}>Voltar</Button>
              <Button onClick={confirmarCadastro} disabled={loading} className="flex-1">
                {loading
                  ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Salvando...</>
                  : 'Confirmar e cadastrar'}
              </Button>
            </div>
          </div>
        );
      })()}

      {/* ── ETAPA 4: Sucesso ─────────────────────────────────────────────────── */}
      {etapa === 4 && (
        <Card>
          <CardContent className="pt-8 pb-8 space-y-6">
            <div className="text-center space-y-2">
              <div className="flex justify-center">
                <div className="bg-green-100 rounded-full p-4">
                  <CheckCircle className="h-10 w-10 text-green-600" />
                </div>
              </div>
              <h2 className="text-lg font-bold text-gray-900">
                {ucsCount === 1 ? 'Cooperado cadastrado com sucesso!' : `${ucsCount}ª UC cadastrada com sucesso!`}
              </h2>
              <p className="text-sm text-gray-500">{formCoop.nomeCompleto}</p>
            </div>

            {ultimaUC && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-4 space-y-2 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>Endereço</span>
                  <span className="font-medium text-gray-900 text-right max-w-xs">{ultimaUC.endereco}</span>
                </div>
                {ultimaUC.distribuidora && (
                  <div className="flex justify-between text-gray-600">
                    <span>Distribuidora</span>
                    <span className="font-medium text-gray-900">{ultimaUC.distribuidora}</span>
                  </div>
                )}
                {ultimaUC.consumo > 0 && (
                  <div className="flex justify-between text-gray-600">
                    <span>Média kWh/mês</span>
                    <span className="font-medium text-green-700">{ultimaUC.consumo.toLocaleString('pt-BR')} kWh</span>
                  </div>
                )}
                <div className="flex justify-between text-gray-600">
                  <span>UCs cadastradas</span>
                  <span className="font-medium text-green-700">{ucsCount}</span>
                </div>
              </div>
            )}

            {/* ── Upload de documentos (opcional) ── */}
            {cooperadoId && !docsEnviados && (
              <div className="border border-gray-200 rounded-lg p-4 space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-800">Documentos <span className="text-gray-400 font-normal">(opcional agora, obrigatório para ativar junto à concessionária)</span></h3>
                </div>

                {!isPJ ? (
                  <>
                    <p className="text-xs text-gray-500">Envie RG <b>ou</b> CNH</p>
                    <div className="grid grid-cols-2 gap-3">
                      {([
                        ['RG_FRENTE', 'RG Frente'],
                        ['RG_VERSO', 'RG Verso'],
                        ['CNH_FRENTE', 'CNH Frente'],
                        ['CNH_VERSO', 'CNH Verso'],
                      ] as const).map(([tipo, label]) => (
                        <label key={tipo} className="border border-dashed border-gray-300 rounded-lg p-3 text-center cursor-pointer hover:border-green-400 hover:bg-green-50 transition-colors">
                          <input type="file" accept="image/*,.pdf" className="hidden"
                            onChange={e => setDocFile(tipo, e.target.files?.[0] ?? null)} />
                          <Upload className="h-5 w-5 text-gray-400 mx-auto mb-1" />
                          <p className="text-xs font-medium text-gray-700">{label}</p>
                          {docUploads[tipo] && (
                            <p className="text-xs text-green-700 mt-1 truncate">{docUploads[tipo]!.name}</p>
                          )}
                        </label>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      {([
                        ['CONTRATO_SOCIAL', 'Contrato Social'],
                        ['CNH_FRENTE', 'RG/CNH Representante Legal'],
                      ] as const).map(([tipo, label]) => (
                        <label key={tipo} className="border border-dashed border-gray-300 rounded-lg p-3 text-center cursor-pointer hover:border-green-400 hover:bg-green-50 transition-colors">
                          <input type="file" accept="image/*,.pdf" className="hidden"
                            onChange={e => setDocFile(tipo, e.target.files?.[0] ?? null)} />
                          <Upload className="h-5 w-5 text-gray-400 mx-auto mb-1" />
                          <p className="text-xs font-medium text-gray-700">{label}</p>
                          {docUploads[tipo] && (
                            <p className="text-xs text-green-700 mt-1 truncate">{docUploads[tipo]!.name}</p>
                          )}
                        </label>
                      ))}
                    </div>
                    <div className="grid grid-cols-3 gap-3 mt-3">
                      <Campo label="Nome do representante legal">
                        <input className={cls} value={repLegalNome} onChange={e => setRepLegalNome(e.target.value)} />
                      </Campo>
                      <Campo label="CPF do representante">
                        <input className={cls} value={repLegalCpf} onChange={e => setRepLegalCpf(e.target.value)} placeholder="000.000.000-00" />
                      </Campo>
                      <Campo label="Cargo">
                        <input className={cls} value={repLegalCargo} onChange={e => setRepLegalCargo(e.target.value)} placeholder="Sócio-administrador" />
                      </Campo>
                    </div>
                  </>
                )}

                {erro && <p className="text-sm text-red-600">{erro}</p>}

                {temDocsSelecionados && (
                  <Button onClick={enviarDocumentos} disabled={uploadingDocs} className="w-full">
                    {uploadingDocs
                      ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Enviando...</>
                      : 'Enviar documentos selecionados'}
                  </Button>
                )}
              </div>
            )}

            {docsEnviados && (
              <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-800 flex items-center gap-2">
                <CheckCircle className="h-4 w-4" /> Documentos enviados com sucesso!
              </div>
            )}

            <div className="border-t pt-5 space-y-3">
              <p className="text-sm font-medium text-gray-700 text-center">
                Este cooperado possui outro endereço com energia solar?
              </p>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={adicionarOutraUC}>
                  Sim, cadastrar outra UC
                </Button>
                <Button className="flex-1" onClick={finalizar}>
                  Não, finalizar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── ETAPA 3: Preferência ─────────────────────────────────────────────── */}
      {etapa === 3 && (
        <Card>
          <CardContent className="pt-6 space-y-6">
            <div>
              <h2 className="text-base font-semibold text-gray-800 mb-1">Como deseja receber as cobranças?</h2>
              <p className="text-sm text-gray-500">Este cooperado possui {ucsCount} unidades cadastradas.</p>
            </div>
            <div className="space-y-3">
              {(['CONSOLIDADA', 'SEPARADA'] as const).map(opt => (
                <button key={opt} onClick={() => setPreferencia(opt)}
                  className={`w-full text-left border-2 rounded-xl p-4 transition-colors ${preferencia === opt ? 'border-green-600 bg-green-50' : 'border-gray-200 hover:border-gray-300'}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 w-4 h-4 rounded-full border-2 shrink-0 ${preferencia === opt ? 'border-green-600 bg-green-600' : 'border-gray-400'}`} />
                    <div>
                      <p className="text-sm font-semibold text-gray-800">
                        {opt === 'CONSOLIDADA' ? 'Fatura única consolidada' : 'Faturas separadas por UC'}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {opt === 'CONSOLIDADA' ? 'Uma cobrança por mês com a soma de todas as UCs' : 'Uma cobrança por endereço a cada mês'}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
            {erro && <p className="text-sm text-red-600">{erro}</p>}
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => router.push(`/dashboard/cooperados/${cooperadoId}`)}>Pular</Button>
              <Button onClick={salvarPreferencia} disabled={!preferencia || loading} className="flex-1">
                {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Salvando...</> : 'Salvar e finalizar'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── ETAPA 5: Dados pessoais (SEM_UC / GERADOR / CARREGADOR / USUARIO) */}
      {etapa === 5 && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <User className="h-4 w-4 text-green-700" />
              <h2 className="text-sm font-semibold text-gray-800">
                Dados do cooperado{tipoCooperado === 'GERADOR' ? ' (Gerador)' : tipoCooperado === 'CARREGADOR_VEICULAR' ? ' (Carregador Veicular)' : tipoCooperado === 'USUARIO_CARREGADOR' ? ' (Usuário Carregador)' : ' (sem UC)'}
              </h2>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Campo label="Nome completo *">
                  <input className={cls} value={formCoop.nomeCompleto} onChange={e => setFormCoop(p => ({ ...p, nomeCompleto: e.target.value }))} />
                </Campo>
              </div>
              <Campo label="CPF/CNPJ *">
                <input className={cls} value={formCoop.cpf} onChange={e => setFormCoop(p => ({ ...p, cpf: e.target.value }))} placeholder="000.000.000-00" />
              </Campo>
              <Campo label="Email *">
                <input className={cls} type="email" value={formCoop.email} onChange={e => setFormCoop(p => ({ ...p, email: e.target.value }))} placeholder="email@exemplo.com" />
              </Campo>
              <Campo label="Telefone">
                <input className={cls} value={formCoop.telefone} onChange={e => setFormCoop(p => ({ ...p, telefone: e.target.value }))} placeholder="(00) 00000-0000" />
              </Campo>
              {/* GERADOR: selecionar usina própria */}
              {tipoCooperado === 'GERADOR' && (
                <div className="col-span-2">
                  <Campo label="Usina própria">
                    <select className={cls} value={usinaPropriaId} onChange={e => setUsinaPropriaId(e.target.value)}>
                      <option value="">Selecione a usina...</option>
                      {usinas.map(u => (
                        <option key={u.id} value={u.id}>{u.nome} — {u.cidade}/{u.estado}</option>
                      ))}
                    </select>
                  </Campo>
                </div>
              )}
              {/* CARREGADOR_VEICULAR: percentual de repasse */}
              {tipoCooperado === 'CARREGADOR_VEICULAR' && (
                <div className="col-span-2">
                  <Campo label="Percentual de repasse à cooperativa (%)">
                    <input className={cls} type="number" min="0" max="100" step="0.01" value={percentualRepasse}
                      onChange={e => setPercentualRepasse(e.target.value)} placeholder="Ex: 15.00" />
                  </Campo>
                </div>
              )}
            </div>
            {erro && <p className="text-sm text-red-600">{erro}</p>}
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => { setEtapa(0); setTipoCooperado(''); setErro(''); }}>Voltar</Button>
              <Button onClick={cadastrarSemUC} disabled={loading} className="flex-1">
                {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Salvando...</> : 'Continuar'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── ETAPA 6: Documento + Termo (SEM_UC) ─────────────────────────────── */}
      {etapa === 6 && (
        <Card>
          <CardContent className="pt-6 space-y-5">
            <div>
              <h2 className="text-base font-semibold text-gray-800 mb-1">Documento de identidade</h2>
              <p className="text-sm text-gray-500">Envie uma foto do RG ou CNH do cooperado.</p>
            </div>
            <div onClick={() => docRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${docArquivo ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-gray-400'}`}>
              <input ref={docRef} type="file" accept="image/*,.pdf" className="hidden"
                onChange={(e) => { if (e.target.files?.[0]) setDocArquivo(e.target.files[0]); }} />
              {docArquivo ? (
                <div className="space-y-1">
                  <FileText className="h-8 w-8 text-green-600 mx-auto" />
                  <p className="text-sm font-medium text-green-800">{docArquivo.name}</p>
                </div>
              ) : (
                <div className="space-y-1">
                  <Upload className="h-8 w-8 text-gray-400 mx-auto" />
                  <p className="text-sm text-gray-600">Clique para selecionar</p>
                </div>
              )}
            </div>
            <div className="border border-gray-200 rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-semibold text-gray-800">Termo de adesão</h3>
              <p className="text-xs text-gray-500">Declaro que li e aceito os termos de adesão da cooperativa de energia, concordando com as regras de participação, direitos e deveres do cooperado, conforme regulamento vigente.</p>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={termoAceito} onChange={(e) => setTermoAceito(e.target.checked)}
                  className="rounded border-gray-300 text-green-600 focus:ring-green-500" />
                <span className="text-sm text-gray-700">Li e aceito o termo de adesão</span>
              </label>
            </div>
            {erro && <p className="text-sm text-red-600">{erro}</p>}
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => { setEtapa(5); setErro(''); }}>Voltar</Button>
              <Button onClick={enviarDocumentoSemUC} disabled={loading || !docArquivo || !termoAceito} className="flex-1">
                {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Enviando...</> : 'Finalizar cadastro'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── ETAPA 7: Sucesso (SEM_UC) ──────────────────────────────────────── */}
      {etapa === 7 && (
        <Card>
          <CardContent className="pt-8 pb-8 space-y-6">
            <div className="text-center space-y-2">
              <div className="flex justify-center">
                <div className="bg-green-100 rounded-full p-4">
                  <CheckCircle className="h-10 w-10 text-green-600" />
                </div>
              </div>
              <h2 className="text-lg font-bold text-gray-900">Cooperado cadastrado com sucesso!</h2>
              <p className="text-sm text-gray-500">{formCoop.nomeCompleto}</p>
              <p className="text-xs text-gray-400">Tipo: Sem UC (aguardando aprovação de documentos)</p>
            </div>
            <div className="flex justify-center">
              <Button onClick={() => router.push(`/dashboard/cooperados/${cooperadoId}`)}>Ver perfil do cooperado</Button>
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  );
}
