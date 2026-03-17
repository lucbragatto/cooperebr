'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import {
  AlertTriangle, ArrowLeft, BarChart3, Building2, CheckCircle, CreditCard,
  FileCheck, FilePlus, FileText, FileX, Loader2, Pencil, Plus, User,
  XCircle, Zap,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type Aba = 'geral' | 'fatura' | 'contrato' | 'cobrancas' | 'documentos' | 'ocorrencias' | 'proposta';

interface PropostaOpcao {
  base: 'MES_RECENTE' | 'MEDIA_12M';
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
interface PropostaResultado extends PropostaOpcao {
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
}
interface PropostaResult {
  outlierDetectado: boolean;
  aguardandoEscolha?: boolean;
  opcoes?: PropostaOpcao[];
  resultado?: PropostaResultado;
}

interface HistoricoItem { mesAno: string; consumoKwh: number; valorRS: number }
interface DadosExtraidos {
  titular: string; documento: string; tipoDocumento: string;
  enderecoInstalacao: string; cidade: string; estado: string;
  numeroUC: string; distribuidora: string; classificacao: string;
  mesReferencia: string; consumoAtualKwh: number; totalAPagar: number;
  bandeiraTarifaria: string; historicoConsumo: HistoricoItem[];
}
interface FaturaProcessada {
  id: string; arquivoUrl: string | null; dadosExtraidos: DadosExtraidos;
  mediaKwhCalculada: number | string; mesesUtilizados: number;
  mesesDescartados: number; status: string; createdAt: string;
}
interface UCItem { id: string; numero: string; endereco: string; cidade: string; estado: string; distribuidora: string | null }
interface Plano { id: string; nome: string; modeloCobranca: string; descontoBase: number | string }
interface Cobranca {
  id: string; mesReferencia: number; anoReferencia: number;
  valorBruto: number | string; valorDesconto: number | string;
  valorLiquido: number | string; percentualDesconto: number | string;
  status: string; dataVencimento: string; dataPagamento: string | null;
}
interface Usina { id: string; nome: string; potenciaKwp: number | string; cidade: string; estado: string }
interface Contrato {
  id: string; numero: string; status: string; dataInicio: string;
  dataFim: string | null; percentualDesconto: number | string;
  plano: Plano | null; uc: UCItem | null; usina: Usina | null; cobrancas: Cobranca[];
}
interface DocumentoCooperado {
  id: string; tipo: string; url: string; nomeArquivo: string | null;
  status: string; motivoRejeicao: string | null; createdAt: string;
}
interface OcorrenciaItem {
  id: string; tipo: string; descricao: string; status: string;
  prioridade: string; resolucao: string | null; createdAt: string;
}
interface CooperadoCompleto {
  id: string; nomeCompleto: string; cpf: string; email: string; telefone: string | null;
  status: string; cotaKwhMensal: number | string | null; percentualUsina: number | string | null;
  documento: string | null; tipoDocumento: string | null; createdAt: string; updatedAt: string;
  ucs: UCItem[]; contratos: Contrato[]; documentos: DocumentoCooperado[]; ocorrencias: OcorrenciaItem[];
}

// ─── Label maps ──────────────────────────────────────────────────────────────

const statusCoopColors: Record<string, string> = {
  ATIVO: 'bg-green-100 text-green-800 border-green-200',
  PENDENTE: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  SUSPENSO: 'bg-orange-100 text-orange-800 border-orange-200',
  ENCERRADO: 'bg-red-100 text-red-800 border-red-200',
};
const statusDocColors: Record<string, string> = {
  APROVADO: 'bg-green-100 text-green-800 border-green-200',
  PENDENTE: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  REPROVADO: 'bg-red-100 text-red-800 border-red-200',
};
const statusCobColors: Record<string, string> = {
  PAGO: 'bg-green-100 text-green-800 border-green-200',
  PENDENTE: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  VENCIDO: 'bg-red-100 text-red-800 border-red-200',
  CANCELADO: 'bg-gray-100 text-gray-800 border-gray-200',
};
const statusContratoColors: Record<string, string> = {
  ATIVO: 'bg-green-100 text-green-800 border-green-200',
  SUSPENSO: 'bg-orange-100 text-orange-800 border-orange-200',
  ENCERRADO: 'bg-red-100 text-red-800 border-red-200',
  LISTA_ESPERA: 'bg-purple-100 text-purple-800 border-purple-200',
};
const tipoDocLabel: Record<string, string> = {
  RG_FRENTE: 'RG (Frente)', RG_VERSO: 'RG (Verso)',
  CNH_FRENTE: 'CNH (Frente)', CNH_VERSO: 'CNH (Verso)',
  CONTRATO_SOCIAL: 'Contrato Social', OUTROS: 'Outros',
};
const tipoOcLabel: Record<string, string> = {
  FALTA_ENERGIA: 'Falta de Energia', MEDICAO_INCORRETA: 'Medição Incorreta',
  PROBLEMA_FATURA: 'Problema na Fatura', SOLICITACAO: 'Solicitação', OUTROS: 'Outros',
};
const modeloCobrancaLabel: Record<string, string> = {
  FIXO_MENSAL: 'Fixo Mensal', CREDITOS_COMPENSADOS: 'Créditos Compensados', CREDITOS_DINAMICO: 'Créditos Dinâmico',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const cls = 'w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500';
const lbl = 'block text-xs text-gray-500 mb-0.5';
function formatBRL(v: number | string) { return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function Campo({ label, value }: { label: string; value: React.ReactNode }) {
  return <div><p className="text-xs text-gray-500 mb-0.5">{label}</p><p className="text-sm font-medium text-gray-800">{value ?? '—'}</p></div>;
}
function today() { return new Date().toISOString().slice(0, 10); }

const abas: { id: Aba; label: string; icon: React.ElementType }[] = [
  { id: 'geral', label: 'Visão Geral', icon: User },
  { id: 'fatura', label: 'Fatura & Consumo', icon: BarChart3 },
  { id: 'contrato', label: 'Contrato & Plano', icon: Building2 },
  { id: 'cobrancas', label: 'Cobranças', icon: CreditCard },
  { id: 'documentos', label: 'Documentos', icon: FileText },
  { id: 'ocorrencias', label: 'Ocorrências', icon: AlertTriangle },
  { id: 'proposta', label: 'Proposta', icon: Zap },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CooperadoPerfilPage() {
  const { id } = useParams<{ id: string }>();

  // Core data
  const [cooperado, setCooperado] = useState<CooperadoCompleto | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [aba, setAba] = useState<Aba>('geral');

  // Faturas
  const [faturas, setFaturas] = useState<FaturaProcessada[]>([]);
  const [carregandoFaturas, setCarregandoFaturas] = useState(false);
  const [faturasBuscadas, setFaturasBuscadas] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ tipo: 'sucesso' | 'erro'; mensagem: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Loading
  const [salvando, setSalvando] = useState(false);

  // Sheets
  const [sheetCooperado, setSheetCooperado] = useState(false);
  const [sheetContrato, setSheetContrato] = useState<Contrato | null>(null);
  const [sheetNovaCobranca, setSheetNovaCobranca] = useState(false);
  const [sheetEditCobranca, setSheetEditCobranca] = useState<Cobranca | null>(null);
  const [sheetNovaOcorrencia, setSheetNovaOcorrencia] = useState(false);
  const [sheetEditOcorrencia, setSheetEditOcorrencia] = useState<OcorrenciaItem | null>(null);

  // Dialogs
  const [dialogEncerrarContrato, setDialogEncerrarContrato] = useState<Contrato | null>(null);
  const [dialogDarBaixa, setDialogDarBaixa] = useState<Cobranca | null>(null);
  const [dialogExcluirCobranca, setDialogExcluirCobranca] = useState<Cobranca | null>(null);
  const [dialogExcluirDoc, setDialogExcluirDoc] = useState<DocumentoCooperado | null>(null);

  // Forms
  const [formCoop, setFormCoop] = useState({ nomeCompleto: '', email: '', telefone: '', cpf: '', status: '' });
  const [formContrato, setFormContrato] = useState({ status: '', percentualDesconto: '', dataFim: '' });
  const [formCob, setFormCob] = useState({ mes: '', ano: '', valorBruto: '', percentualDesconto: '', dataVencimento: '' });
  const [formEditCob, setFormEditCob] = useState({ valorBruto: '', percentualDesconto: '', dataVencimento: '', status: '' });
  const [dataBaixa, setDataBaixa] = useState(today());
  const [formOc, setFormOc] = useState({ tipo: 'SOLICITACAO', prioridade: 'MEDIA', descricao: '', ucId: '' });
  const [formEditOc, setFormEditOc] = useState({ status: '', resolucao: '' });

  // Proposta
  const [proposta, setProposta] = useState<PropostaResult | null>(null);
  const [calculandoProposta, setCalculandoProposta] = useState(false);
  const [historicoProposta, setHistoricoProposta] = useState<any[]>([]);

  // Reprovar doc (inline)
  const [reprovarId, setReprovarId] = useState<string | null>(null);
  const [motivoRejeicao, setMotivoRejeicao] = useState('');
  const [docAcao, setDocAcao] = useState<string | null>(null);

  // Criar contrato
  const [sheetCriarContrato, setSheetCriarContrato] = useState(false);
  const [planosAtivos, setPlanosAtivos] = useState<Plano[]>([]);
  const [formCriarContrato, setFormCriarContrato] = useState({ planoId: '', ucId: '', percentualDesconto: '', dataAdesao: today(), dataEncerramento: '' });

  // Upload documento
  const [sheetUploadDoc, setSheetUploadDoc] = useState(false);
  const [arquivoUpload, setArquivoUpload] = useState<File | null>(null);
  const [formUploadDoc, setFormUploadDoc] = useState({ tipo: 'RG_FRENTE' });

  // ── Toast helper ──────────────────────────────────────────────────────────

  function showToast(tipo: 'sucesso' | 'erro', mensagem: string) {
    setToast({ tipo, mensagem });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }

  // ── State helpers ─────────────────────────────────────────────────────────

  function updateCob(cobId: string, upd: (c: Cobranca) => Cobranca) {
    setCooperado(p => p ? { ...p, contratos: p.contratos.map(ct => ({ ...ct, cobrancas: ct.cobrancas.map(c => c.id === cobId ? upd(c) : c) })) } : p);
  }
  function removeCob(cobId: string) {
    setCooperado(p => p ? { ...p, contratos: p.contratos.map(ct => ({ ...ct, cobrancas: ct.cobrancas.filter(c => c.id !== cobId) })) } : p);
  }
  function addCob(contratoId: string, cob: Cobranca) {
    setCooperado(p => p ? { ...p, contratos: p.contratos.map(ct => ct.id === contratoId ? { ...ct, cobrancas: [cob, ...ct.cobrancas] } : ct) } : p);
  }
  function updateOc(ocId: string, upd: (o: OcorrenciaItem) => OcorrenciaItem) {
    setCooperado(p => p ? { ...p, ocorrencias: p.ocorrencias.map(o => o.id === ocId ? upd(o) : o) } : p);
  }
  function removeDoc(docId: string) {
    setCooperado(p => p ? { ...p, documentos: p.documentos.filter(d => d.id !== docId) } : p);
  }
  function updateDoc(docId: string, upd: (d: DocumentoCooperado) => DocumentoCooperado) {
    setCooperado(p => p ? { ...p, documentos: p.documentos.map(d => d.id === docId ? upd(d) : d) } : p);
  }

  // ── Load ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    api.get<CooperadoCompleto>(`/cooperados/${id}`)
      .then(r => setCooperado(r.data))
      .catch(() => setErro('Cooperado não encontrado.'))
      .finally(() => setCarregando(false));
  }, [id]);

  const buscarFaturas = useCallback(async () => {
    if (faturasBuscadas) return;
    setCarregandoFaturas(true);
    try {
      const { data } = await api.get<FaturaProcessada[]>(`/faturas/cooperado/${id}`);
      setFaturas(data);
      setFaturasBuscadas(true);
    } finally { setCarregandoFaturas(false); }
  }, [id, faturasBuscadas]);

  useEffect(() => { if (aba === 'fatura') buscarFaturas(); }, [aba, buscarFaturas]);

  // ── Actions — Cooperado ───────────────────────────────────────────────────

  function abrirEditarCooperado() {
    if (!cooperado) return;
    setFormCoop({ nomeCompleto: cooperado.nomeCompleto, email: cooperado.email, telefone: cooperado.telefone ?? '', cpf: cooperado.cpf, status: cooperado.status });
    setSheetCooperado(true);
  }

  async function salvarCooperado() {
    setSalvando(true);
    try {
      const { data } = await api.put<CooperadoCompleto>(`/cooperados/${id}`, formCoop);
      setCooperado(p => p ? { ...p, nomeCompleto: data.nomeCompleto, email: data.email, telefone: data.telefone, cpf: data.cpf, status: data.status, updatedAt: data.updatedAt } : p);
      setSheetCooperado(false);
      showToast('sucesso', 'Dados atualizados com sucesso.');
    } catch { showToast('erro', 'Erro ao atualizar dados.'); }
    finally { setSalvando(false); }
  }

  // ── Actions — Contrato ────────────────────────────────────────────────────

  function abrirEditarContrato(c: Contrato) {
    setFormContrato({ status: c.status, percentualDesconto: String(c.percentualDesconto), dataFim: c.dataFim ? c.dataFim.slice(0, 10) : '' });
    setSheetContrato(c);
  }

  async function salvarContrato() {
    if (!sheetContrato) return;
    setSalvando(true);
    try {
      const payload: Record<string, unknown> = { percentualDesconto: Number(formContrato.percentualDesconto), status: formContrato.status };
      if (formContrato.dataFim) payload.dataFim = formContrato.dataFim;
      const { data } = await api.put(`/contratos/${sheetContrato.id}`, payload);
      setCooperado(p => p ? { ...p, contratos: p.contratos.map(c => c.id === sheetContrato.id ? { ...c, ...(data as object) } : c) } : p);
      setSheetContrato(null);
      showToast('sucesso', 'Contrato atualizado.');
    } catch { showToast('erro', 'Erro ao atualizar contrato.'); }
    finally { setSalvando(false); }
  }

  async function encerrarContrato() {
    if (!dialogEncerrarContrato) return;
    setSalvando(true);
    try {
      await api.put(`/contratos/${dialogEncerrarContrato.id}`, { status: 'ENCERRADO' });
      setCooperado(p => p ? { ...p, contratos: p.contratos.map(c => c.id === dialogEncerrarContrato.id ? { ...c, status: 'ENCERRADO' } : c) } : p);
      setDialogEncerrarContrato(null);
      showToast('sucesso', 'Contrato encerrado.');
    } catch { showToast('erro', 'Erro ao encerrar contrato.'); }
    finally { setSalvando(false); }
  }

  // ── Actions — Cobranças ───────────────────────────────────────────────────

  async function criarCobranca() {
    const contratoId = cooperado?.contratos?.[0]?.id;
    if (!contratoId) return;
    const vBruto = Number(formCob.valorBruto);
    const pDesc = Number(formCob.percentualDesconto);
    const vDesc = (vBruto * pDesc) / 100;
    setSalvando(true);
    try {
      const { data } = await api.post<Cobranca>('/cobrancas', {
        contratoId, mesReferencia: Number(formCob.mes), anoReferencia: Number(formCob.ano),
        valorBruto: vBruto, percentualDesconto: pDesc, valorDesconto: vDesc,
        valorLiquido: vBruto - vDesc, dataVencimento: formCob.dataVencimento,
      });
      addCob(contratoId, data);
      setSheetNovaCobranca(false);
      setFormCob({ mes: '', ano: '', valorBruto: '', percentualDesconto: '', dataVencimento: '' });
      showToast('sucesso', 'Cobrança criada.');
    } catch { showToast('erro', 'Erro ao criar cobrança.'); }
    finally { setSalvando(false); }
  }

  function abrirEditarCobranca(c: Cobranca) {
    setFormEditCob({ valorBruto: String(c.valorBruto), percentualDesconto: String(c.percentualDesconto), dataVencimento: c.dataVencimento.slice(0, 10), status: c.status });
    setSheetEditCobranca(c);
  }

  async function salvarCobranca() {
    if (!sheetEditCobranca) return;
    const vBruto = Number(formEditCob.valorBruto);
    const pDesc = Number(formEditCob.percentualDesconto);
    const vDesc = (vBruto * pDesc) / 100;
    setSalvando(true);
    try {
      const { data } = await api.put<Cobranca>(`/cobrancas/${sheetEditCobranca.id}`, {
        valorBruto: vBruto, percentualDesconto: pDesc, valorDesconto: vDesc,
        valorLiquido: vBruto - vDesc, dataVencimento: formEditCob.dataVencimento, status: formEditCob.status,
      });
      updateCob(sheetEditCobranca.id, () => data);
      setSheetEditCobranca(null);
      showToast('sucesso', 'Cobrança atualizada.');
    } catch { showToast('erro', 'Erro ao atualizar cobrança.'); }
    finally { setSalvando(false); }
  }

  async function darBaixa() {
    if (!dialogDarBaixa) return;
    setSalvando(true);
    try {
      const { data } = await api.put<Cobranca>(`/cobrancas/${dialogDarBaixa.id}`, { status: 'PAGO', dataPagamento: dataBaixa });
      updateCob(dialogDarBaixa.id, () => data);
      setDialogDarBaixa(null);
      showToast('sucesso', 'Baixa registrada com sucesso.');
    } catch { showToast('erro', 'Erro ao dar baixa.'); }
    finally { setSalvando(false); }
  }

  async function excluirCobranca() {
    if (!dialogExcluirCobranca) return;
    setSalvando(true);
    try {
      await api.delete(`/cobrancas/${dialogExcluirCobranca.id}`);
      removeCob(dialogExcluirCobranca.id);
      setDialogExcluirCobranca(null);
      showToast('sucesso', 'Cobrança excluída.');
    } catch { showToast('erro', 'Erro ao excluir cobrança.'); }
    finally { setSalvando(false); }
  }

  // ── Actions — Documentos ──────────────────────────────────────────────────

  async function aprovarDoc(docId: string) {
    setDocAcao(docId);
    try {
      await api.patch(`/documentos/${docId}/aprovar`);
      updateDoc(docId, d => ({ ...d, status: 'APROVADO', motivoRejeicao: null }));
      showToast('sucesso', 'Documento aprovado.');
    } catch { showToast('erro', 'Erro ao aprovar documento.'); }
    finally { setDocAcao(null); }
  }

  async function reprovarDoc() {
    if (!reprovarId || !motivoRejeicao.trim()) return;
    setDocAcao(reprovarId);
    try {
      await api.patch(`/documentos/${reprovarId}/reprovar`, { motivoRejeicao });
      updateDoc(reprovarId, d => ({ ...d, status: 'REPROVADO', motivoRejeicao }));
      setReprovarId(null); setMotivoRejeicao('');
      showToast('sucesso', 'Documento reprovado.');
    } catch { showToast('erro', 'Erro ao reprovar documento.'); }
    finally { setDocAcao(null); }
  }

  async function excluirDoc() {
    if (!dialogExcluirDoc) return;
    setSalvando(true);
    try {
      await api.delete(`/documentos/${dialogExcluirDoc.id}`);
      removeDoc(dialogExcluirDoc.id);
      setDialogExcluirDoc(null);
      showToast('sucesso', 'Documento excluído.');
    } catch { showToast('erro', 'Erro ao excluir documento.'); }
    finally { setSalvando(false); }
  }

  // ── Actions — Ocorrências ─────────────────────────────────────────────────

  async function criarOcorrencia() {
    if (!cooperado) return;
    setSalvando(true);
    try {
      const { data } = await api.post<OcorrenciaItem>('/ocorrencias', {
        cooperadoId: id, tipo: formOc.tipo, prioridade: formOc.prioridade,
        descricao: formOc.descricao, ucId: formOc.ucId || undefined,
      });
      setCooperado(p => p ? { ...p, ocorrencias: [data, ...p.ocorrencias] } : p);
      setSheetNovaOcorrencia(false);
      setFormOc({ tipo: 'SOLICITACAO', prioridade: 'MEDIA', descricao: '', ucId: '' });
      showToast('sucesso', 'Ocorrência aberta.');
    } catch { showToast('erro', 'Erro ao abrir ocorrência.'); }
    finally { setSalvando(false); }
  }

  function abrirEditarOcorrencia(o: OcorrenciaItem) {
    setFormEditOc({ status: o.status, resolucao: o.resolucao ?? '' });
    setSheetEditOcorrencia(o);
  }

  async function salvarOcorrencia() {
    if (!sheetEditOcorrencia) return;
    setSalvando(true);
    try {
      const { data } = await api.put<OcorrenciaItem>(`/ocorrencias/${sheetEditOcorrencia.id}`, formEditOc);
      updateOc(sheetEditOcorrencia.id, () => data);
      setSheetEditOcorrencia(null);
      showToast('sucesso', 'Ocorrência atualizada.');
    } catch { showToast('erro', 'Erro ao atualizar ocorrência.'); }
    finally { setSalvando(false); }
  }

  // ── Actions — Criar Contrato ──────────────────────────────────────────────

  async function abrirCriarContrato() {
    if (!cooperado?.ucs.length) { showToast('erro', 'Cooperado sem UC vinculada.'); return; }
    setFormCriarContrato({ planoId: '', ucId: cooperado.ucs[0]?.id ?? '', percentualDesconto: '', dataAdesao: today(), dataEncerramento: '' });
    try {
      const { data } = await api.get<any[]>('/planos');
      setPlanosAtivos(data.filter((p: any) => p.ativo));
    } catch { setPlanosAtivos([]); }
    setSheetCriarContrato(true);
  }

  async function criarContrato() {
    if (!cooperado || !formCriarContrato.ucId || !formCriarContrato.percentualDesconto) return;
    setSalvando(true);
    try {
      const { data } = await api.post('/contratos', {
        cooperadoId: id,
        planoId: formCriarContrato.planoId || undefined,
        ucId: formCriarContrato.ucId,
        percentualDesconto: Number(formCriarContrato.percentualDesconto),
        dataInicio: formCriarContrato.dataAdesao,
        ...(formCriarContrato.dataEncerramento ? { dataFim: formCriarContrato.dataEncerramento } : {}),
      });
      setCooperado(p => p ? { ...p, contratos: [data, ...p.contratos] } : p);
      setSheetCriarContrato(false);
      showToast('sucesso', 'Contrato criado com sucesso.');
    } catch { showToast('erro', 'Erro ao criar contrato.'); }
    finally { setSalvando(false); }
  }

  // ── Actions — Upload Documento ────────────────────────────────────────────

  async function uploadDocumento() {
    if (!arquivoUpload || !formUploadDoc.tipo) return;
    const formData = new FormData();
    formData.append('arquivo', arquivoUpload);
    formData.append('tipo', formUploadDoc.tipo);
    setSalvando(true);
    try {
      const { data } = await api.post<DocumentoCooperado>(`/documentos/upload/${id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setCooperado(p => p ? { ...p, documentos: [...p.documentos, data] } : p);
      setSheetUploadDoc(false);
      setArquivoUpload(null);
      setFormUploadDoc({ tipo: 'RG_FRENTE' });
      showToast('sucesso', 'Documento enviado com sucesso.');
    } catch { showToast('erro', 'Erro ao enviar documento.'); }
    finally { setSalvando(false); }
  }

  // ── Actions — Proposta ────────────────────────────────────────────────────

  async function calcularProposta(opcaoEscolhida?: 'MES_RECENTE' | 'MEDIA_12M') {
    setCalculandoProposta(true);
    try {
      const [faturasResp] = await Promise.all([
        api.get<FaturaProcessada[]>(`/faturas/cooperado/${id}`),
        api.get<{ tusdNova: number; teNova: number } | null>('/motor-proposta/tarifa-concessionaria/atual'),
      ]);
      const fats = faturasResp.data;
      const ultimaFat = fats[0] ?? null;
      const historico = ultimaFat?.dadosExtraidos?.historicoConsumo ?? [];
      const kwhRecente = ultimaFat?.dadosExtraidos?.consumoAtualKwh ?? 0;
      const valorRecente = ultimaFat?.dadosExtraidos?.totalAPagar ?? 0;
      const mesRef = ultimaFat?.dadosExtraidos?.mesReferencia ?? new Date().toISOString().slice(0, 7);

      const payload: any = {
        cooperadoId: id,
        historico: historico.map((h: HistoricoItem) => ({
          mesAno: h.mesAno,
          consumoKwh: Number(h.consumoKwh),
          valorRS: Number(h.valorRS),
        })),
        kwhMesRecente: Number(kwhRecente),
        valorMesRecente: Number(valorRecente),
        mesReferencia: mesRef,
      };
      if (opcaoEscolhida) payload.opcaoEscolhida = opcaoEscolhida;

      const endpoint = opcaoEscolhida ? '/motor-proposta/confirmar-opcao' : '/motor-proposta/calcular';
      const { data } = await api.post<PropostaResult>(endpoint, payload);
      setProposta(data);
    } catch {
      showToast('erro', 'Erro ao calcular proposta.');
    } finally {
      setCalculandoProposta(false);
    }
  }

  async function aceitarProposta() {
    if (!proposta?.resultado) return;
    setSalvando(true);
    try {
      const { data: resp } = await api.post<{ emListaEspera?: boolean }>('/motor-proposta/aceitar', {
        cooperadoId: id,
        resultado: proposta.resultado,
        mesReferencia: proposta.resultado.mesReferencia,
      });
      const msg = resp.emListaEspera
        ? 'Proposta aceita. Cooperado adicionado à lista de espera por falta de vaga.'
        : 'Proposta aceita! Contrato criado automaticamente.';
      showToast('sucesso', msg);
      setProposta(null);
      // Recarregar cooperado (novo contrato) e histórico
      const [cooperadoResp, historicoResp] = await Promise.all([
        api.get<CooperadoCompleto>(`/cooperados/${id}`),
        api.get<any[]>(`/motor-proposta/historico/${id}`),
      ]);
      setCooperado(cooperadoResp.data);
      setHistoricoProposta(historicoResp.data);
    } catch {
      showToast('erro', 'Erro ao aceitar proposta.');
    } finally {
      setSalvando(false);
    }
  }

  async function carregarHistoricoProposta() {
    try {
      const { data } = await api.get<any[]>(`/motor-proposta/historico/${id}`);
      setHistoricoProposta(data);
    } catch {
      // silently ignore
    }
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const contrato = cooperado?.contratos?.[0] ?? null;
  const cobrancas = contrato?.cobrancas ?? [];
  const ultimaFatura = faturas[0] ?? null;

  // ── Guard ─────────────────────────────────────────────────────────────────

  if (carregando) return (
    <div className="max-w-5xl space-y-4">
      {[1, 2, 3].map(i => <div key={i} className="h-20 bg-gray-200 animate-pulse rounded-xl" />)}
    </div>
  );
  if (erro || !cooperado) return (
    <div className="flex flex-col items-center py-20 gap-4">
      <p className="text-red-500">{erro || 'Cooperado não encontrado.'}</p>
      <Link href="/dashboard/cooperados"><Button variant="outline"><ArrowLeft className="h-4 w-4 mr-2" />Voltar</Button></Link>
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-5xl space-y-5">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg border text-sm font-medium shadow-lg transition-all ${toast.tipo === 'sucesso' ? 'bg-green-50 text-green-800 border-green-200' : 'bg-red-50 text-red-800 border-red-200'}`}>
          {toast.tipo === 'sucesso' ? <CheckCircle className="inline h-4 w-4 mr-2" /> : <XCircle className="inline h-4 w-4 mr-2" />}
          {toast.mensagem}
        </div>
      )}

      {/* Back */}
      <Link href="/dashboard/cooperados" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-800 transition-colors">
        <ArrowLeft className="h-4 w-4 mr-1" />Cooperados
      </Link>

      {/* Header */}
      <div className="bg-white border rounded-xl px-6 py-5 flex items-start justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{cooperado.nomeCompleto}</h1>
            <Badge className={statusCoopColors[cooperado.status]}>{cooperado.status}</Badge>
          </div>
          <p className="text-sm text-gray-500">
            {cooperado.tipoDocumento ?? 'CPF'}: {cooperado.cpf}
            <span className="mx-2 text-gray-300">•</span>{cooperado.email}
            {cooperado.telefone && <><span className="mx-2 text-gray-300">•</span>{cooperado.telefone}</>}
          </p>
          {cooperado.cotaKwhMensal && (
            <p className="text-sm text-green-700 font-medium">
              Cota: {Number(cooperado.cotaKwhMensal).toLocaleString('pt-BR')} kWh/mês
              {cooperado.percentualUsina && <span className="ml-3 text-gray-500">({Number(cooperado.percentualUsina).toFixed(4)}% da usina)</span>}
            </p>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          <Link href={`/dashboard/cooperados/${id}/fatura`}>
            <Button variant="outline" size="sm"><FileText className="h-4 w-4 mr-2" />Processar Fatura</Button>
          </Link>
        </div>
      </div>

      {/* Tabs nav */}
      <div className="flex gap-1 border-b overflow-x-auto">
        {abas.map(({ id: abaId, label, icon: Icon }) => (
          <button key={abaId} onClick={() => setAba(abaId)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${aba === abaId ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
          >
            <Icon className="h-4 w-4" />{label}
          </button>
        ))}
      </div>

      {/* ── Aba 1: Visão Geral ── */}
      {aba === 'geral' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Dados Pessoais</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <Campo label="Nome completo" value={cooperado.nomeCompleto} />
              <Campo label="CPF" value={cooperado.cpf} />
              <Campo label="Email" value={cooperado.email} />
              <Campo label="Telefone" value={cooperado.telefone} />
              <Campo label="Documento (OCR)" value={cooperado.documento} />
              <Campo label="Tipo documento" value={cooperado.tipoDocumento} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Dados Técnicos</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <Campo label="Cota kWh/mês" value={cooperado.cotaKwhMensal ? `${Number(cooperado.cotaKwhMensal).toLocaleString('pt-BR')} kWh` : null} />
              <Campo label="% da usina" value={cooperado.percentualUsina ? `${Number(cooperado.percentualUsina).toFixed(4)}%` : null} />
              <Campo label="UCs vinculadas" value={cooperado.ucs.length || '—'} />
              <Campo label="Contratos" value={cooperado.contratos.length || '—'} />
            </CardContent>
          </Card>
          <Card className="md:col-span-2">
            <CardHeader><CardTitle className="text-base">Datas</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <Campo label="Criado em" value={new Date(cooperado.createdAt).toLocaleString('pt-BR')} />
              <Campo label="Atualizado em" value={new Date(cooperado.updatedAt).toLocaleString('pt-BR')} />
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Aba 2: Fatura & Consumo ── */}
      {aba === 'fatura' && (
        <div className="space-y-4">
          {carregandoFaturas ? (
            <Card><CardContent className="py-8"><div className="h-4 bg-gray-200 animate-pulse rounded w-full" /></CardContent></Card>
          ) : faturas.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-4 py-12">
                <BarChart3 className="h-10 w-10 text-gray-300" />
                <p className="text-gray-500">Nenhuma fatura processada ainda.</p>
                <Link href={`/dashboard/cooperados/${id}/fatura`}><Button><FilePlus className="h-4 w-4 mr-2" />Processar primeira fatura</Button></Link>
              </CardContent>
            </Card>
          ) : (
            <>
              {ultimaFatura && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center justify-between">
                      <span>Fatura mais recente</span>
                      <Badge className={ultimaFatura.status === 'APROVADA' ? 'bg-green-100 text-green-800 border-green-200' : ultimaFatura.status === 'REJEITADA' ? 'bg-red-100 text-red-800 border-red-200' : 'bg-yellow-100 text-yellow-800 border-yellow-200'}>{ultimaFatura.status}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <Campo label="Titular (na fatura)" value={ultimaFatura.dadosExtraidos.titular} />
                    <Campo label="Documento" value={`${ultimaFatura.dadosExtraidos.tipoDocumento}: ${ultimaFatura.dadosExtraidos.documento}`} />
                    <Campo label="Mês referência" value={ultimaFatura.dadosExtraidos.mesReferencia} />
                    <Campo label="Endereço" value={[ultimaFatura.dadosExtraidos.enderecoInstalacao, ultimaFatura.dadosExtraidos.cidade, ultimaFatura.dadosExtraidos.estado].filter(Boolean).join(', ')} />
                    <Campo label="UC" value={ultimaFatura.dadosExtraidos.numeroUC} />
                    <Campo label="Distribuidora" value={ultimaFatura.dadosExtraidos.distribuidora} />
                    <Campo label="Consumo atual (kWh)" value={Number(ultimaFatura.dadosExtraidos.consumoAtualKwh).toLocaleString('pt-BR')} />
                    <Campo label="Total a pagar" value={formatBRL(ultimaFatura.dadosExtraidos.totalAPagar)} />
                    <Campo label="Média calculada" value={`${Number(ultimaFatura.mediaKwhCalculada).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} kWh`} />
                  </CardContent>
                </Card>
              )}
              {ultimaFatura?.dadosExtraidos.historicoConsumo?.length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-base">Histórico de Consumo</CardTitle></CardHeader>
                  <CardContent className="overflow-x-auto p-0">
                    <table className="w-full text-sm">
                      <thead className="border-b bg-gray-50">
                        <tr>
                          <th className="text-left px-4 py-2 text-xs text-gray-500 font-medium">Mês/Ano</th>
                          <th className="text-right px-4 py-2 text-xs text-gray-500 font-medium">Consumo (kWh)</th>
                          <th className="text-right px-4 py-2 text-xs text-gray-500 font-medium">Valor (R$)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ultimaFatura.dadosExtraidos.historicoConsumo.map(h => (
                          <tr key={h.mesAno} className="border-b last:border-0 hover:bg-gray-50">
                            <td className="px-4 py-2 text-gray-800">{h.mesAno}</td>
                            <td className="px-4 py-2 text-right">{Number(h.consumoKwh).toLocaleString('pt-BR')}</td>
                            <td className="px-4 py-2 text-right">{formatBRL(h.valorRS)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              )}
              {faturas.length > 1 && (
                <Card>
                  <CardHeader><CardTitle className="text-base">Todas as Faturas</CardTitle></CardHeader>
                  <CardContent className="overflow-x-auto p-0">
                    <table className="w-full text-sm">
                      <thead className="border-b bg-gray-50">
                        <tr>
                          <th className="text-left px-4 py-2 text-xs text-gray-500 font-medium">Processada em</th>
                          <th className="text-right px-4 py-2 text-xs text-gray-500 font-medium">Média (kWh)</th>
                          <th className="text-right px-4 py-2 text-xs text-gray-500 font-medium">Meses usados</th>
                          <th className="text-center px-4 py-2 text-xs text-gray-500 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {faturas.map(f => (
                          <tr key={f.id} className="border-b last:border-0 hover:bg-gray-50">
                            <td className="px-4 py-2 text-gray-800">{new Date(f.createdAt).toLocaleDateString('pt-BR')}</td>
                            <td className="px-4 py-2 text-right">{Number(f.mediaKwhCalculada).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</td>
                            <td className="px-4 py-2 text-right">{f.mesesUtilizados}</td>
                            <td className="px-4 py-2 text-center">
                              <Badge className={f.status === 'APROVADA' ? 'bg-green-100 text-green-800 border-green-200' : f.status === 'REJEITADA' ? 'bg-red-100 text-red-800 border-red-200' : 'bg-yellow-100 text-yellow-800 border-yellow-200'}>{f.status}</Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Aba 3: Contrato & Plano ── */}
      {aba === 'contrato' && (
        <div className="space-y-4">
          {cooperado.contratos.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-4 py-12">
                <Building2 className="h-10 w-10 text-gray-300" />
                <p className="text-gray-500">Sem contrato ativo.</p>
                <Button size="sm" onClick={abrirCriarContrato}><Plus className="h-4 w-4 mr-2" />Criar contrato</Button>
              </CardContent>
            </Card>
          ) : (
            cooperado.contratos.map(c => (
              <div key={c.id} className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center justify-between">
                      <span>Contrato {c.numero}</span>
                      <div className="flex items-center gap-2">
                        <Badge className={statusContratoColors[c.status]}>{c.status}</Badge>
                        <Button size="sm" variant="outline" onClick={() => abrirEditarContrato(c)}><Pencil className="h-3.5 w-3.5 mr-1" />Editar</Button>
                        {c.status !== 'ENCERRADO' && (
                          <Button size="sm" variant="outline" className="text-red-600 border-red-300 hover:bg-red-50" onClick={() => setDialogEncerrarContrato(c)}>Encerrar</Button>
                        )}
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <Campo label="Desconto contratado" value={`${Number(c.percentualDesconto).toFixed(2)}%`} />
                    <Campo label="Data de adesão" value={new Date(c.dataInicio).toLocaleDateString('pt-BR')} />
                    <Campo label="Data de encerramento" value={c.dataFim ? new Date(c.dataFim).toLocaleDateString('pt-BR') : 'Indeterminado'} />
                  </CardContent>
                </Card>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {c.plano && (
                    <Card>
                      <CardHeader><CardTitle className="text-base">Plano</CardTitle></CardHeader>
                      <CardContent className="grid gap-3">
                        <Campo label="Nome" value={c.plano.nome} />
                        <Campo label="Modelo" value={modeloCobrancaLabel[c.plano.modeloCobranca] ?? c.plano.modeloCobranca} />
                        <Campo label="Desconto base" value={`${Number(c.plano.descontoBase).toFixed(2)}%`} />
                      </CardContent>
                    </Card>
                  )}
                  {c.uc && (
                    <Card>
                      <CardHeader><CardTitle className="text-base flex items-center gap-2"><Zap className="h-4 w-4" />UC</CardTitle></CardHeader>
                      <CardContent className="grid gap-3">
                        <Campo label="Número UC" value={c.uc.numero} />
                        <Campo label="Distribuidora" value={c.uc.distribuidora} />
                        <Campo label="Localização" value={`${c.uc.cidade}/${c.uc.estado}`} />
                      </CardContent>
                    </Card>
                  )}
                  {c.usina && (
                    <Card>
                      <CardHeader><CardTitle className="text-base">Usina</CardTitle></CardHeader>
                      <CardContent className="grid gap-3">
                        <Campo label="Nome" value={c.usina.nome} />
                        <Campo label="Potência (kWp)" value={`${Number(c.usina.potenciaKwp).toLocaleString('pt-BR')} kWp`} />
                        <Campo label="Localização" value={`${c.usina.cidade}/${c.usina.estado}`} />
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Aba 4: Cobranças ── */}
      {aba === 'cobrancas' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            {!contrato && <p className="text-sm text-gray-500">Crie um contrato primeiro para gerar cobranças.</p>}
            {contrato && <div />}
            <Button size="sm" onClick={() => { setFormCob({ mes: String(new Date().getMonth() + 1), ano: String(new Date().getFullYear()), valorBruto: '', percentualDesconto: String(contrato?.percentualDesconto ?? ''), dataVencimento: '' }); setSheetNovaCobranca(true); }} disabled={!contrato}>
              <Plus className="h-4 w-4 mr-2" />Nova cobrança
            </Button>
          </div>
          <Card>
            <CardContent className="p-0">
              {cobrancas.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-12"><CreditCard className="h-10 w-10 text-gray-300" /><p className="text-gray-500">Nenhuma cobrança gerada ainda.</p></div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="border-b bg-gray-50">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Mês/Ano</th>
                      <th className="text-right px-4 py-3 text-xs text-gray-500 font-medium">Bruto</th>
                      <th className="text-right px-4 py-3 text-xs text-gray-500 font-medium">Desconto</th>
                      <th className="text-right px-4 py-3 text-xs text-gray-500 font-medium">Líquido</th>
                      <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Vencimento</th>
                      <th className="text-center px-4 py-3 text-xs text-gray-500 font-medium">Status</th>
                      <th className="text-right px-4 py-3 text-xs text-gray-500 font-medium">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cobrancas.map(c => (
                      <tr key={c.id} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">{String(c.mesReferencia).padStart(2, '0')}/{c.anoReferencia}</td>
                        <td className="px-4 py-3 text-right">{formatBRL(c.valorBruto)}</td>
                        <td className="px-4 py-3 text-right text-green-700">{formatBRL(c.valorDesconto)}</td>
                        <td className="px-4 py-3 text-right font-medium">{formatBRL(c.valorLiquido)}</td>
                        <td className="px-4 py-3">{new Date(c.dataVencimento).toLocaleDateString('pt-BR')}</td>
                        <td className="px-4 py-3 text-center"><Badge className={statusCobColors[c.status]}>{c.status}</Badge></td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {(c.status === 'PENDENTE' || c.status === 'VENCIDO') && (
                              <Button size="sm" variant="outline" className="text-green-700 border-green-300 hover:bg-green-50 h-7 px-2 text-xs" onClick={() => { setDataBaixa(today()); setDialogDarBaixa(c); }}>Baixa</Button>
                            )}
                            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => abrirEditarCobranca(c)}><Pencil className="h-3.5 w-3.5" /></Button>
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-red-500 hover:text-red-700" onClick={() => setDialogExcluirCobranca(c)}><XCircle className="h-3.5 w-3.5" /></Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Aba 5: Documentos ── */}
      {aba === 'documentos' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => { setFormUploadDoc({ tipo: 'RG_FRENTE' }); setArquivoUpload(null); setSheetUploadDoc(true); }}>
              <FilePlus className="h-4 w-4 mr-2" />Adicionar documento
            </Button>
          </div>
          {reprovarId && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="pt-4 space-y-3">
                <p className="text-sm font-medium text-red-800">Motivo da reprovação:</p>
                <textarea className="w-full border border-red-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-400" rows={2} placeholder="Obrigatório..." value={motivoRejeicao} onChange={e => setMotivoRejeicao(e.target.value)} />
                <div className="flex gap-2">
                  <Button size="sm" variant="destructive" onClick={reprovarDoc} disabled={!motivoRejeicao.trim() || !!docAcao}><FileX className="h-4 w-4 mr-2" />Confirmar</Button>
                  <Button size="sm" variant="outline" onClick={() => { setReprovarId(null); setMotivoRejeicao(''); }}>Cancelar</Button>
                </div>
              </CardContent>
            </Card>
          )}
          {cooperado.documentos.length === 0 ? (
            <Card><CardContent className="flex flex-col items-center gap-3 py-12"><FileText className="h-10 w-10 text-gray-300" /><p className="text-gray-500">Nenhum documento enviado.</p></CardContent></Card>
          ) : (
            cooperado.documentos.map(doc => (
              <Card key={doc.id}>
                <CardContent className="pt-4 flex items-start justify-between gap-4">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-800">{tipoDocLabel[doc.tipo] ?? doc.tipo}</span>
                      <Badge className={statusDocColors[doc.status]}>{doc.status}</Badge>
                    </div>
                    {doc.nomeArquivo && <p className="text-xs text-gray-500">{doc.nomeArquivo}</p>}
                    <p className="text-xs text-gray-400">Enviado em {new Date(doc.createdAt).toLocaleDateString('pt-BR')}</p>
                    {doc.motivoRejeicao && <p className="text-xs text-red-600">Motivo: {doc.motivoRejeicao}</p>}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <a href={doc.url} target="_blank" rel="noopener noreferrer"><Button variant="ghost" size="sm">Ver</Button></a>
                    {doc.status === 'PENDENTE' && (
                      <>
                        <Button size="sm" variant="outline" className="text-green-700 border-green-300 hover:bg-green-50" onClick={() => aprovarDoc(doc.id)} disabled={docAcao === doc.id}><FileCheck className="h-4 w-4 mr-1" />Aprovar</Button>
                        <Button size="sm" variant="outline" className="text-red-600 border-red-300 hover:bg-red-50" onClick={() => { setReprovarId(doc.id); setMotivoRejeicao(''); }} disabled={docAcao === doc.id}><FileX className="h-4 w-4 mr-1" />Reprovar</Button>
                      </>
                    )}
                    <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700" onClick={() => setDialogExcluirDoc(doc)}><XCircle className="h-4 w-4" /></Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* ── Aba 7: Proposta ── */}
      {aba === 'proposta' && (
        <div className="space-y-4">
          {/* Estado inicial: botão calcular */}
          {!proposta && !calculandoProposta && (
            <Card>
              <CardContent className="flex flex-col items-center gap-4 py-16">
                <Zap className="h-12 w-12 text-green-500" />
                <div className="text-center">
                  <p className="text-gray-700 font-medium text-lg">Motor de Proposta</p>
                  <p className="text-gray-400 text-sm mt-1">Gere uma proposta personalizada baseada no histórico de consumo e nas configurações da cooperativa.</p>
                </div>
                <Button onClick={() => { carregarHistoricoProposta(); calcularProposta(); }} size="lg">
                  <Zap className="h-4 w-4 mr-2" />Calcular proposta
                </Button>
                {historicoProposta.length > 0 && (
                  <div className="w-full mt-4">
                    <p className="text-xs text-gray-500 mb-2 font-medium">Histórico de propostas</p>
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b">
                          <tr>
                            <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Referência</th>
                            <th className="text-right px-3 py-2 text-xs font-medium text-gray-500">kWh</th>
                            <th className="text-right px-3 py-2 text-xs font-medium text-gray-500">Economia/mês</th>
                            <th className="text-center px-3 py-2 text-xs font-medium text-gray-500">Status</th>
                            <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Data</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {historicoProposta.map((p: any) => (
                            <tr key={p.id} className="hover:bg-gray-50">
                              <td className="px-3 py-2">{p.mesReferencia}</td>
                              <td className="px-3 py-2 text-right font-mono text-xs">{Number(p.kwhContrato).toLocaleString('pt-BR', { minimumFractionDigits: 5, maximumFractionDigits: 5 })}</td>
                              <td className="px-3 py-2 text-right text-green-700">{Number(p.economiaMensal).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                              <td className="px-3 py-2 text-center">
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.status === 'ACEITA' ? 'bg-green-100 text-green-800' : p.status === 'PENDENTE' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-600'}`}>{p.status}</span>
                              </td>
                              <td className="px-3 py-2 text-gray-500 text-xs">{new Date(p.createdAt).toLocaleDateString('pt-BR')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Carregando */}
          {calculandoProposta && (
            <Card>
              <CardContent className="flex flex-col items-center gap-4 py-16">
                <Loader2 className="h-10 w-10 text-green-500 animate-spin" />
                <p className="text-gray-500">Calculando proposta...</p>
              </CardContent>
            </Card>
          )}

          {/* Resultado: aguardando escolha (outlier) */}
          {proposta?.aguardandoEscolha && proposta.opcoes && (
            <div className="space-y-4">
              <Card className="border-orange-200 bg-orange-50">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-5 w-5 text-orange-600" />
                    <span className="font-medium text-orange-800">Consumo atípico detectado</span>
                  </div>
                  <p className="text-sm text-orange-700">O consumo do mês atual é significativamente diferente da média histórica. Escolha qual base usar para a proposta:</p>
                </CardContent>
              </Card>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {proposta.opcoes.map(opcao => (
                  <Card key={opcao.base} className="border-2 hover:border-green-400 transition-colors">
                    <CardHeader><CardTitle className="text-sm font-semibold text-gray-700">{opcao.label}</CardTitle></CardHeader>
                    <CardContent className="space-y-2">
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div><p className="text-xs text-gray-400">Base kWh</p><p className="font-mono font-medium">{Number(opcao.kwhApuradoBase).toLocaleString('pt-BR', { minimumFractionDigits: 5, maximumFractionDigits: 5 })}</p></div>
                        <div><p className="text-xs text-gray-400">Desconto</p><p className="font-medium text-green-700">{Number(opcao.descontoPercentual).toLocaleString('pt-BR', { minimumFractionDigits: 5, maximumFractionDigits: 5 })}%</p></div>
                        <div><p className="text-xs text-gray-400">Economia/mês</p><p className="font-bold text-green-700">{Number(opcao.economiaMensal).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p></div>
                        <div><p className="text-xs text-gray-400">Economia/ano</p><p className="font-medium">{Number(opcao.economiaAnual).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p></div>
                      </div>
                      <Button className="w-full mt-2" onClick={() => calcularProposta(opcao.base)} disabled={calculandoProposta}>
                        Escolher esta opção
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={() => setProposta(null)}>Recalcular</Button>
              </div>
            </div>
          )}

          {/* Resultado final */}
          {proposta?.resultado && (
            <div className="space-y-4">
              {proposta.outlierDetectado && (
                <Card className="border-orange-200 bg-orange-50">
                  <CardContent className="pt-3 pb-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-orange-600" />
                      <span className="text-sm text-orange-800">Consumo atípico detectado — base utilizada: <strong>{proposta.resultado.base === 'MES_RECENTE' ? 'Mês atual' : 'Média 12 meses'}</strong></span>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card className="border-2 border-green-400">
                <CardHeader className="bg-green-50 rounded-t-lg">
                  <CardTitle className="text-green-800 flex items-center gap-2">
                    <CheckCircle className="h-5 w-5" />
                    Proposta calculada — {proposta.resultado.mesReferencia}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-gray-50 rounded p-3">
                      <p className="text-xs text-gray-500">kWh do contrato</p>
                      <p className="font-mono font-bold text-lg">{Number(proposta.resultado.kwhContrato).toLocaleString('pt-BR', { minimumFractionDigits: 5, maximumFractionDigits: 5 })}</p>
                    </div>
                    <div className="bg-green-50 rounded p-3">
                      <p className="text-xs text-gray-500">Desconto</p>
                      <p className="font-bold text-lg text-green-700">{Number(proposta.resultado.descontoPercentual).toLocaleString('pt-BR', { minimumFractionDigits: 5, maximumFractionDigits: 5 })}%</p>
                    </div>
                    <div className="bg-green-50 rounded p-3">
                      <p className="text-xs text-gray-500">Economia mensal</p>
                      <p className="font-bold text-lg text-green-700">{Number(proposta.resultado.economiaMensal).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                    </div>
                    <div className="bg-green-50 rounded p-3">
                      <p className="text-xs text-gray-500">Economia anual</p>
                      <p className="font-bold text-lg text-green-700">{Number(proposta.resultado.economiaAnual).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm border-t pt-4">
                    <div><p className="text-xs text-gray-400">TUSD utilizada</p><p className="font-mono">{Number(proposta.resultado.tusdUtilizada).toLocaleString('pt-BR', { minimumFractionDigits: 5, maximumFractionDigits: 5 })}</p></div>
                    <div><p className="text-xs text-gray-400">TE utilizada</p><p className="font-mono">{Number(proposta.resultado.teUtilizada).toLocaleString('pt-BR', { minimumFractionDigits: 5, maximumFractionDigits: 5 })}</p></div>
                    <div><p className="text-xs text-gray-400">Tarifa unit. sem trib.</p><p className="font-mono">{Number(proposta.resultado.tarifaUnitSemTrib).toLocaleString('pt-BR', { minimumFractionDigits: 5, maximumFractionDigits: 5 })}</p></div>
                    <div><p className="text-xs text-gray-400">Valor cooperado</p><p className="font-mono">{Number(proposta.resultado.valorCooperado).toLocaleString('pt-BR', { minimumFractionDigits: 5, maximumFractionDigits: 5 })}</p></div>
                    <div><p className="text-xs text-gray-400">kWh mês recente</p><p className="font-mono">{Number(proposta.resultado.kwhMesRecente).toLocaleString('pt-BR', { minimumFractionDigits: 5, maximumFractionDigits: 5 })}</p></div>
                    <div><p className="text-xs text-gray-400">kWh médio 12m</p><p className="font-mono">{Number(proposta.resultado.kwhMedio12m).toLocaleString('pt-BR', { minimumFractionDigits: 5, maximumFractionDigits: 5 })}</p></div>
                    <div><p className="text-xs text-gray-400">Média cooperativa</p><p className="font-mono">{Number(proposta.resultado.mediaCooperativaKwh).toLocaleString('pt-BR', { minimumFractionDigits: 5, maximumFractionDigits: 5 })}</p></div>
                    <div><p className="text-xs text-gray-400">Resultado vs média</p><p className={`font-mono ${proposta.resultado.resultadoVsMedia > 0 ? 'text-red-600' : 'text-green-600'}`}>{Number(proposta.resultado.resultadoVsMedia).toLocaleString('pt-BR', { minimumFractionDigits: 5, maximumFractionDigits: 5 })}%</p></div>
                    <div><p className="text-xs text-gray-400">Meses equivalentes</p><p className="font-mono">{Number(proposta.resultado.mesesEquivalentes).toLocaleString('pt-BR', { minimumFractionDigits: 5, maximumFractionDigits: 5 })}</p></div>
                    <div><p className="text-xs text-gray-400">Base utilizada</p><p className="font-medium">{proposta.resultado.base === 'MES_RECENTE' ? 'Mês atual' : 'Média 12m'}</p></div>
                  </div>

                  <div className="flex gap-3 border-t pt-4">
                    <Button onClick={aceitarProposta} disabled={salvando} className="bg-green-600 hover:bg-green-700">
                      {salvando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                      Aceitar proposta
                    </Button>
                    <Button variant="outline" onClick={() => setProposta(null)} disabled={salvando}>
                      Recalcular
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* ── Aba 6: Ocorrências ── */}
      {aba === 'ocorrencias' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => { setFormOc({ tipo: 'SOLICITACAO', prioridade: 'MEDIA', descricao: '', ucId: '' }); setSheetNovaOcorrencia(true); }}>
              <Plus className="h-4 w-4 mr-2" />Abrir ocorrência
            </Button>
          </div>
          {cooperado.ocorrencias.length === 0 ? (
            <Card><CardContent className="flex flex-col items-center gap-3 py-12"><AlertTriangle className="h-10 w-10 text-gray-300" /><p className="text-gray-500">Nenhuma ocorrência registrada.</p></CardContent></Card>
          ) : (
            cooperado.ocorrencias.map(o => (
              <Card key={o.id}>
                <CardContent className="pt-4 flex items-start justify-between gap-4">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-800">{tipoOcLabel[o.tipo] ?? o.tipo}</span>
                      <Badge className={o.prioridade === 'CRITICA' ? 'bg-red-100 text-red-800 border-red-200' : o.prioridade === 'ALTA' ? 'bg-orange-100 text-orange-800 border-orange-200' : o.prioridade === 'MEDIA' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' : 'bg-gray-100 text-gray-800 border-gray-200'}>{o.prioridade}</Badge>
                      <Badge className={o.status === 'RESOLVIDA' ? 'bg-green-100 text-green-800 border-green-200' : o.status === 'EM_ANDAMENTO' ? 'bg-blue-100 text-blue-800 border-blue-200' : o.status === 'CANCELADA' ? 'bg-gray-100 text-gray-800 border-gray-200' : 'bg-yellow-100 text-yellow-800 border-yellow-200'}>{o.status}</Badge>
                    </div>
                    <p className="text-sm text-gray-600">{o.descricao}</p>
                    {o.resolucao && <p className="text-xs text-green-700 bg-green-50 px-2 py-1 rounded">Resolução: {o.resolucao}</p>}
                    <p className="text-xs text-gray-400">{new Date(o.createdAt).toLocaleDateString('pt-BR')}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => abrirEditarOcorrencia(o)}><Pencil className="h-3.5 w-3.5 mr-1" />Atualizar</Button>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          SHEETS
      ════════════════════════════════════════════════════════════════════════ */}

      {/* Sheet — Editar Cooperado */}
      <Sheet open={sheetCooperado} onOpenChange={setSheetCooperado}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader><SheetTitle>Editar Cooperado</SheetTitle></SheetHeader>
          <div className="mt-6 space-y-4">
            <div><label className={lbl}>Nome completo</label><input className={cls} value={formCoop.nomeCompleto} onChange={e => setFormCoop(p => ({ ...p, nomeCompleto: e.target.value }))} /></div>
            <div><label className={lbl}>Email</label><input type="email" className={cls} value={formCoop.email} onChange={e => setFormCoop(p => ({ ...p, email: e.target.value }))} /></div>
            <div><label className={lbl}>CPF</label><input className={cls} value={formCoop.cpf} onChange={e => setFormCoop(p => ({ ...p, cpf: e.target.value }))} /></div>
            <div><label className={lbl}>Telefone</label><input className={cls} value={formCoop.telefone} onChange={e => setFormCoop(p => ({ ...p, telefone: e.target.value }))} /></div>
            <div><label className={lbl}>Status</label>
              <select className={cls} value={formCoop.status} onChange={e => setFormCoop(p => ({ ...p, status: e.target.value }))}>
                {['PENDENTE', 'ATIVO', 'SUSPENSO', 'ENCERRADO'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <SheetFooter className="mt-6 flex gap-2">
            <Button onClick={salvarCooperado} disabled={salvando} className="flex-1">{salvando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Salvar</Button>
            <Button variant="outline" onClick={() => setSheetCooperado(false)}>Cancelar</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Sheet — Editar Contrato */}
      <Sheet open={!!sheetContrato} onOpenChange={v => !v && setSheetContrato(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader><SheetTitle>Editar Contrato {sheetContrato?.numero}</SheetTitle></SheetHeader>
          <div className="mt-6 space-y-4">
            <div><label className={lbl}>Status</label>
              <select className={cls} value={formContrato.status} onChange={e => setFormContrato(p => ({ ...p, status: e.target.value }))}>
                {['ATIVO', 'SUSPENSO', 'ENCERRADO', 'LISTA_ESPERA'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div><label className={lbl}>Desconto (%)</label><input type="number" step="0.01" className={cls} value={formContrato.percentualDesconto} onChange={e => setFormContrato(p => ({ ...p, percentualDesconto: e.target.value }))} /></div>
            <div><label className={lbl}>Data de encerramento</label><input type="date" className={cls} value={formContrato.dataFim} onChange={e => setFormContrato(p => ({ ...p, dataFim: e.target.value }))} /></div>
          </div>
          <SheetFooter className="mt-6 flex gap-2">
            <Button onClick={salvarContrato} disabled={salvando} className="flex-1">{salvando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Salvar</Button>
            <Button variant="outline" onClick={() => setSheetContrato(null)}>Cancelar</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Sheet — Nova Cobrança */}
      <Sheet open={sheetNovaCobranca} onOpenChange={setSheetNovaCobranca}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader><SheetTitle>Nova Cobrança</SheetTitle></SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div><label className={lbl}>Mês (1-12)</label><input type="number" min={1} max={12} className={cls} value={formCob.mes} onChange={e => setFormCob(p => ({ ...p, mes: e.target.value }))} /></div>
              <div><label className={lbl}>Ano</label><input type="number" className={cls} value={formCob.ano} onChange={e => setFormCob(p => ({ ...p, ano: e.target.value }))} /></div>
            </div>
            <div><label className={lbl}>Valor bruto (R$)</label><input type="number" step="0.01" className={cls} value={formCob.valorBruto} onChange={e => setFormCob(p => ({ ...p, valorBruto: e.target.value }))} /></div>
            <div><label className={lbl}>Desconto (%)</label><input type="number" step="0.01" className={cls} value={formCob.percentualDesconto} onChange={e => setFormCob(p => ({ ...p, percentualDesconto: e.target.value }))} /></div>
            {formCob.valorBruto && formCob.percentualDesconto && (
              <div className="bg-green-50 border border-green-200 rounded-md px-3 py-2 text-sm text-green-800">
                Valor líquido: {formatBRL(Number(formCob.valorBruto) * (1 - Number(formCob.percentualDesconto) / 100))}
              </div>
            )}
            <div><label className={lbl}>Data de vencimento</label><input type="date" className={cls} value={formCob.dataVencimento} onChange={e => setFormCob(p => ({ ...p, dataVencimento: e.target.value }))} /></div>
          </div>
          <SheetFooter className="mt-6 flex gap-2">
            <Button onClick={criarCobranca} disabled={salvando || !formCob.mes || !formCob.ano || !formCob.valorBruto || !formCob.dataVencimento} className="flex-1">{salvando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Criar</Button>
            <Button variant="outline" onClick={() => setSheetNovaCobranca(false)}>Cancelar</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Sheet — Editar Cobrança */}
      <Sheet open={!!sheetEditCobranca} onOpenChange={v => !v && setSheetEditCobranca(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader><SheetTitle>Editar Cobrança</SheetTitle></SheetHeader>
          <div className="mt-6 space-y-4">
            <div><label className={lbl}>Valor bruto (R$)</label><input type="number" step="0.01" className={cls} value={formEditCob.valorBruto} onChange={e => setFormEditCob(p => ({ ...p, valorBruto: e.target.value }))} /></div>
            <div><label className={lbl}>Desconto (%)</label><input type="number" step="0.01" className={cls} value={formEditCob.percentualDesconto} onChange={e => setFormEditCob(p => ({ ...p, percentualDesconto: e.target.value }))} /></div>
            <div><label className={lbl}>Data de vencimento</label><input type="date" className={cls} value={formEditCob.dataVencimento} onChange={e => setFormEditCob(p => ({ ...p, dataVencimento: e.target.value }))} /></div>
            <div><label className={lbl}>Status</label>
              <select className={cls} value={formEditCob.status} onChange={e => setFormEditCob(p => ({ ...p, status: e.target.value }))}>
                {['PENDENTE', 'PAGO', 'VENCIDO', 'CANCELADO'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <SheetFooter className="mt-6 flex gap-2">
            <Button onClick={salvarCobranca} disabled={salvando} className="flex-1">{salvando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Salvar</Button>
            <Button variant="outline" onClick={() => setSheetEditCobranca(null)}>Cancelar</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Sheet — Nova Ocorrência */}
      <Sheet open={sheetNovaOcorrencia} onOpenChange={setSheetNovaOcorrencia}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader><SheetTitle>Abrir Ocorrência</SheetTitle></SheetHeader>
          <div className="mt-6 space-y-4">
            <div><label className={lbl}>Tipo</label>
              <select className={cls} value={formOc.tipo} onChange={e => setFormOc(p => ({ ...p, tipo: e.target.value }))}>
                {Object.entries(tipoOcLabel).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div><label className={lbl}>Prioridade</label>
              <select className={cls} value={formOc.prioridade} onChange={e => setFormOc(p => ({ ...p, prioridade: e.target.value }))}>
                {['BAIXA', 'MEDIA', 'ALTA', 'CRITICA'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            {cooperado.ucs.length > 0 && (
              <div><label className={lbl}>UC (opcional)</label>
                <select className={cls} value={formOc.ucId} onChange={e => setFormOc(p => ({ ...p, ucId: e.target.value }))}>
                  <option value="">Nenhuma</option>
                  {cooperado.ucs.map(u => <option key={u.id} value={u.id}>{u.numero} — {u.cidade}</option>)}
                </select>
              </div>
            )}
            <div><label className={lbl}>Descrição</label>
              <textarea className={cls} rows={4} value={formOc.descricao} onChange={e => setFormOc(p => ({ ...p, descricao: e.target.value }))} />
            </div>
          </div>
          <SheetFooter className="mt-6 flex gap-2">
            <Button onClick={criarOcorrencia} disabled={salvando || !formOc.descricao.trim()} className="flex-1">{salvando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Abrir</Button>
            <Button variant="outline" onClick={() => setSheetNovaOcorrencia(false)}>Cancelar</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Sheet — Atualizar Ocorrência */}
      <Sheet open={!!sheetEditOcorrencia} onOpenChange={v => !v && setSheetEditOcorrencia(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader><SheetTitle>Atualizar Ocorrência</SheetTitle></SheetHeader>
          <div className="mt-6 space-y-4">
            <div><label className={lbl}>Status</label>
              <select className={cls} value={formEditOc.status} onChange={e => setFormEditOc(p => ({ ...p, status: e.target.value }))}>
                {['ABERTA', 'EM_ANDAMENTO', 'RESOLVIDA', 'CANCELADA'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Resolução {formEditOc.status === 'RESOLVIDA' && <span className="text-red-500">*</span>}</label>
              <textarea className={cls} rows={4} placeholder={formEditOc.status === 'RESOLVIDA' ? 'Obrigatório...' : 'Opcional...'} value={formEditOc.resolucao} onChange={e => setFormEditOc(p => ({ ...p, resolucao: e.target.value }))} />
            </div>
          </div>
          <SheetFooter className="mt-6 flex gap-2">
            <Button onClick={salvarOcorrencia} disabled={salvando || (formEditOc.status === 'RESOLVIDA' && !formEditOc.resolucao.trim())} className="flex-1">{salvando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Salvar</Button>
            <Button variant="outline" onClick={() => setSheetEditOcorrencia(null)}>Cancelar</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ════════════════════════════════════════════════════════════════════════
          DIALOGS
      ════════════════════════════════════════════════════════════════════════ */}

      {/* Dialog — Encerrar Contrato */}
      <Dialog open={!!dialogEncerrarContrato} onOpenChange={v => !v && setDialogEncerrarContrato(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Encerrar contrato?</DialogTitle>
            <DialogDescription>Esta ação mudará o status do contrato {dialogEncerrarContrato?.numero} para ENCERRADO. Confirma?</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogEncerrarContrato(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={encerrarContrato} disabled={salvando}>{salvando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Encerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog — Dar Baixa */}
      <Dialog open={!!dialogDarBaixa} onOpenChange={v => !v && setDialogDarBaixa(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar pagamento</DialogTitle>
            <DialogDescription>Informe a data de pagamento para registrar a baixa.</DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <label className={lbl}>Data de pagamento</label>
            <input type="date" className={cls} value={dataBaixa} onChange={e => setDataBaixa(e.target.value)} />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogDarBaixa(null)}>Cancelar</Button>
            <Button onClick={darBaixa} disabled={salvando || !dataBaixa}>{salvando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Confirmar baixa</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog — Excluir Cobrança */}
      <Dialog open={!!dialogExcluirCobranca} onOpenChange={v => !v && setDialogExcluirCobranca(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir cobrança?</DialogTitle>
            <DialogDescription>A cobrança de {dialogExcluirCobranca && `${String(dialogExcluirCobranca.mesReferencia).padStart(2, '0')}/${dialogExcluirCobranca.anoReferencia}`} será excluída permanentemente.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogExcluirCobranca(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={excluirCobranca} disabled={salvando}>{salvando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog — Excluir Documento */}
      <Dialog open={!!dialogExcluirDoc} onOpenChange={v => !v && setDialogExcluirDoc(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir documento?</DialogTitle>
            <DialogDescription>O documento {dialogExcluirDoc && (tipoDocLabel[dialogExcluirDoc.tipo] ?? dialogExcluirDoc.tipo)} será excluído permanentemente do sistema e do storage.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogExcluirDoc(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={excluirDoc} disabled={salvando}>{salvando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sheet — Criar Contrato */}
      <Sheet open={sheetCriarContrato} onOpenChange={setSheetCriarContrato}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader><SheetTitle>Criar Contrato</SheetTitle></SheetHeader>
          <div className="mt-6 space-y-4">
            <div><label className={lbl}>Plano</label>
              <select className={cls} value={formCriarContrato.planoId} onChange={e => {
                const p = planosAtivos.find(pl => pl.id === e.target.value);
                setFormCriarContrato(prev => ({ ...prev, planoId: e.target.value, percentualDesconto: p ? String(p.descontoBase) : prev.percentualDesconto }));
              }}>
                <option value="">Sem plano</option>
                {planosAtivos.map(p => <option key={p.id} value={p.id}>{p.nome} ({Number(p.descontoBase).toFixed(2)}%)</option>)}
              </select>
            </div>
            {cooperado.ucs.length > 0 && (
              <div><label className={lbl}>UC</label>
                <select className={cls} value={formCriarContrato.ucId} onChange={e => setFormCriarContrato(p => ({ ...p, ucId: e.target.value }))}>
                  {cooperado.ucs.map(u => <option key={u.id} value={u.id}>{u.numero} — {u.cidade}</option>)}
                </select>
              </div>
            )}
            <div><label className={lbl}>Desconto (%)</label><input type="number" step="0.01" className={cls} value={formCriarContrato.percentualDesconto} onChange={e => setFormCriarContrato(p => ({ ...p, percentualDesconto: e.target.value }))} /></div>
            <div><label className={lbl}>Data de adesão</label><input type="date" className={cls} value={formCriarContrato.dataAdesao} onChange={e => setFormCriarContrato(p => ({ ...p, dataAdesao: e.target.value }))} /></div>
            <div><label className={lbl}>Data de encerramento (opcional)</label><input type="date" className={cls} value={formCriarContrato.dataEncerramento} onChange={e => setFormCriarContrato(p => ({ ...p, dataEncerramento: e.target.value }))} /></div>
          </div>
          <SheetFooter className="mt-6 flex gap-2">
            <Button onClick={criarContrato} disabled={salvando || !formCriarContrato.ucId || !formCriarContrato.percentualDesconto} className="flex-1">{salvando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Criar</Button>
            <Button variant="outline" onClick={() => setSheetCriarContrato(false)}>Cancelar</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Sheet — Upload Documento */}
      <Sheet open={sheetUploadDoc} onOpenChange={setSheetUploadDoc}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader><SheetTitle>Adicionar Documento</SheetTitle></SheetHeader>
          <div className="mt-6 space-y-4">
            <div><label className={lbl}>Tipo de documento</label>
              <select className={cls} value={formUploadDoc.tipo} onChange={e => setFormUploadDoc(p => ({ ...p, tipo: e.target.value }))}>
                {Object.entries(tipoDocLabel).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Arquivo (PDF ou imagem)</label>
              <input type="file" accept=".pdf,image/*" className={cls + ' py-1.5 cursor-pointer'} onChange={e => setArquivoUpload(e.target.files?.[0] ?? null)} />
              {arquivoUpload && <p className="text-xs text-gray-500 mt-1">{arquivoUpload.name} ({(arquivoUpload.size / 1024).toFixed(0)} KB)</p>}
            </div>
          </div>
          <SheetFooter className="mt-6 flex gap-2">
            <Button onClick={uploadDocumento} disabled={salvando || !arquivoUpload} className="flex-1">{salvando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Enviar</Button>
            <Button variant="outline" onClick={() => setSheetUploadDoc(false)}>Cancelar</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

    </div>
  );
}
