'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  AlertTriangle, ArrowLeft, BarChart3, Building2, CheckCircle, CreditCard,
  FileCheck, FileDown, FilePlus, FileText, FileX, Loader2, Mail, MessageCircle,
  Pencil, Plus, User, XCircle, Zap, Upload, DollarSign, Filter, Gift, Copy, Link as LinkIcon,
} from 'lucide-react';
import AsaasTab from './asaas-tab';
import FaturaUploadOCR from '@/components/FaturaUploadOCR';
import { useTipoParceiro } from '@/hooks/useTipoParceiro';

// ─── Types ────────────────────────────────────────────────────────────────────

type Aba = 'geral' | 'fatura' | 'contrato' | 'cobrancas' | 'documentos' | 'ocorrencias' | 'proposta' | 'asaas' | 'indicacoes' | 'financeiro';

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
  kwhContrato?: number | string | null;
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
  status: string; cotaKwhMensal: number | string | null;
  documento: string | null; tipoDocumento: string | null; createdAt: string; updatedAt: string;
  tipoCooperado: string; tipoPessoa: string | null;
  dataNascimento: string | null; razaoSocial: string | null;
  cep: string | null; logradouro: string | null; numero: string | null;
  complemento: string | null; bairro: string | null; cidade: string | null; estado: string | null;
  usinaPropriaId: string | null; percentualRepasse: number | string | null;
  preferenciaCobranca: string | null;
  representanteLegalNome: string | null; representanteLegalCpf: string | null; representanteLegalCargo: string | null;
  codigoIndicacao?: string; cooperadoIndicadorId?: string | null;
  ucs: UCItem[]; contratos: Contrato[]; documentos: DocumentoCooperado[]; ocorrencias: OcorrenciaItem[];
}

// ─── Zod schema — Editar Cooperado ──────────────────────────────────────────

const cooperadoSchema = z.object({
  nomeCompleto: z.string().min(1, 'Nome obrigatório'),
  email: z.string().email('Email inválido'),
  cpf: z.string().min(11, 'CPF/CNPJ obrigatório'),
  telefone: z.string().optional(),
  status: z.string().min(1),
  dataNascimento: z.string().optional(),
  tipoPessoa: z.string().optional(),
  razaoSocial: z.string().optional(),
  cep: z.string().optional(),
  logradouro: z.string().optional(),
  numero: z.string().optional(),
  complemento: z.string().optional(),
  bairro: z.string().optional(),
  cidade: z.string().optional(),
  estado: z.string().optional(),
});

type CooperadoFormData = z.infer<typeof cooperadoSchema>;

// ─── Label maps ──────────────────────────────────────────────────────────────

const statusCoopColors: Record<string, string> = {
  ATIVO: 'bg-green-100 text-green-800 border-green-200',
  ATIVO_RECEBENDO_CREDITOS: 'bg-green-100 text-green-800 border-green-200',
  PENDENTE: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  PENDENTE_ATIVACAO: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  SUSPENSO: 'bg-orange-100 text-orange-800 border-orange-200',
  ENCERRADO: 'bg-red-100 text-red-800 border-red-200',
};
const statusCoopLabel: Record<string, string> = {
  ATIVO: 'Ativo',
  ATIVO_RECEBENDO_CREDITOS: 'Ativo - Recebendo Creditos',
  PENDENTE: 'Pendente',
  PENDENTE_ATIVACAO: 'Pendente Ativacao',
  SUSPENSO: 'Suspenso',
  ENCERRADO: 'Encerrado',
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
  PENDENTE_ATIVACAO: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  ATIVO: 'bg-green-100 text-green-800 border-green-200',
  SUSPENSO: 'bg-orange-100 text-orange-800 border-orange-200',
  ENCERRADO: 'bg-red-100 text-red-800 border-red-200',
  LISTA_ESPERA: 'bg-purple-100 text-purple-800 border-purple-200',
};
const statusContratoLabel: Record<string, string> = {
  PENDENTE_ATIVACAO: 'Pendente Ativacao',
  ATIVO: 'Ativo',
  SUSPENSO: 'Suspenso',
  ENCERRADO: 'Encerrado',
  LISTA_ESPERA: 'Lista de Espera',
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
const tipoCooperadoLabel: Record<string, string> = {
  COM_UC: 'Com UC', SEM_UC: 'Sem UC', GERADOR: 'Gerador',
  CARREGADOR_VEICULAR: 'Carregador Veicular', USUARIO_CARREGADOR: 'Usuário Carregador',
};
const tipoCooperadoColors: Record<string, string> = {
  COM_UC: 'bg-green-100 text-green-800 border-green-200',
  SEM_UC: 'bg-orange-100 text-orange-800 border-orange-200',
  GERADOR: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  CARREGADOR_VEICULAR: 'bg-blue-100 text-blue-800 border-blue-200',
  USUARIO_CARREGADOR: 'bg-purple-100 text-purple-800 border-purple-200',
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
  { id: 'fatura', label: 'Fatura Concessionaria', icon: BarChart3 },
  { id: 'contrato', label: 'Contrato & Plano', icon: Building2 },
  { id: 'cobrancas', label: 'Cobrancas Cooperativa', icon: CreditCard },
  { id: 'documentos', label: 'Documentos', icon: FileText },
  { id: 'ocorrencias', label: 'Ocorrências', icon: AlertTriangle },
  { id: 'proposta', label: 'Proposta', icon: Zap },
  { id: 'financeiro', label: 'Financeiro', icon: DollarSign },
  { id: 'asaas', label: 'Cobranças Asaas', icon: DollarSign },
  { id: 'indicacoes', label: 'Indicações', icon: Gift },
];

// ─── Financeiro Tab ─────────────────────────────────────────────────────────

function FinanceiroTab({ cooperadoId }: { cooperadoId: string }) {
  const [cobrancas, setCobrancas] = useState<any[]>([]);
  const [faturas, setFaturas] = useState<any[]>([]);
  const [beneficios, setBeneficios] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;
    setCarregando(true);
    Promise.all([
      api.get(`/cobrancas?cooperadoId=${cooperadoId}`, { signal }).then(({ data }) => setCobrancas(Array.isArray(data) ? data : data.items ?? [])).catch(() => {}),
      api.get(`/faturas/cooperado/${cooperadoId}`, { signal }).then(({ data }) => setFaturas(data)).catch(() => {}),
      api.get(`/indicacoes/beneficios?cooperadoId=${cooperadoId}`, { signal }).then(({ data }) => setBeneficios(data)).catch(() => {}),
    ]).finally(() => { if (!signal.aborted) setCarregando(false); });
    return () => controller.abort();
  }, [cooperadoId]);

  if (carregando) return <p className="text-gray-500 py-4">Carregando dados financeiros...</p>;

  const totalPago = cobrancas.filter((c: any) => c.status === 'PAGO').reduce((s: number, c: any) => s + Number(c.valorLiquido ?? 0), 0);
  const totalAberto = cobrancas.filter((c: any) => c.status !== 'PAGO' && c.status !== 'CANCELADO').reduce((s: number, c: any) => s + Number(c.valorLiquido ?? 0), 0);
  const totalCreditos = faturas.reduce((s: number, f: any) => s + Number(f.dadosExtraidos?.creditosRecebidosKwh ?? 0), 0);
  const totalBeneficios = beneficios.reduce((s: number, b: any) => s + Number(b.valorDesconto ?? 0), 0);

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const fmtData = (d: string) => d ? new Date(d).toLocaleDateString('pt-BR') : '—';

  return (
    <div className="space-y-6">
      {/* Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-gray-500">Total Pago</p>
            <p className="text-lg font-bold text-green-700">{fmt(totalPago)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-gray-500">Em Aberto</p>
            <p className="text-lg font-bold text-red-700">{fmt(totalAberto)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-gray-500">Créditos kWh</p>
            <p className="text-lg font-bold text-blue-700">{totalCreditos.toLocaleString('pt-BR')} kWh</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-gray-500">Benefícios Indicação</p>
            <p className="text-lg font-bold text-purple-700">{fmt(totalBeneficios)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Cobranças recentes */}
      <Card>
        <CardHeader><CardTitle className="text-base">Cobranças Recentes</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Referência</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cobrancas.slice(0, 10).map((c: any) => (
                <TableRow key={c.id}>
                  <TableCell>{String(c.mesReferencia).padStart(2, '0')}/{c.anoReferencia}</TableCell>
                  <TableCell>{fmtData(c.dataVencimento)}</TableCell>
                  <TableCell className="text-right font-medium">{fmt(Number(c.valorLiquido ?? 0))}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={
                      c.status === 'PAGO' ? 'bg-green-100 text-green-700' :
                      c.status === 'VENCIDO' ? 'bg-red-100 text-red-700' :
                      'bg-yellow-100 text-yellow-700'
                    }>{c.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
              {cobrancas.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-gray-400 py-4">Nenhuma cobrança</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Faturas concessionária */}
      <Card>
        <CardHeader><CardTitle className="text-base">Faturas Concessionária</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mês Ref.</TableHead>
                <TableHead>Consumo kWh</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {faturas.slice(0, 10).map((f: any) => {
                const d = f.dadosExtraidos as any;
                return (
                  <TableRow key={f.id}>
                    <TableCell>{f.mesReferencia ?? d?.mesReferencia ?? '—'}</TableCell>
                    <TableCell>{d?.consumoAtualKwh ?? '—'}</TableCell>
                    <TableCell className="text-right font-medium">{d?.totalAPagar ? fmt(d.totalAPagar) : '—'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={
                        f.statusRevisao === 'AUTO_APROVADO' || f.statusRevisao === 'APROVADO' ? 'bg-green-100 text-green-700' :
                        f.statusRevisao === 'PENDENTE_REVISAO' ? 'bg-yellow-100 text-yellow-700' : ''
                      }>{f.statusRevisao === 'AUTO_APROVADO' ? 'Aprovado' : f.statusRevisao}</Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
              {faturas.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-gray-400 py-4">Nenhuma fatura</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Indicações Tab ──────────────────────────────────────────────────────────

function IndicacoesTab({ cooperadoId, codigoIndicacao }: { cooperadoId: string; codigoIndicacao?: string }) {
  const [beneficios, setBeneficios] = useState<any[]>([]);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    api.get(`/indicacoes/beneficios?cooperadoId=${cooperadoId}`, { signal: controller.signal })
      .then(({ data }) => setBeneficios(data))
      .catch((err) => {
        if (err?.name !== 'AbortError' && err?.code !== 'ERR_CANCELED') {
          console.error('Erro ao carregar benefícios de indicação');
        }
      });
    return () => controller.abort();
  }, [cooperadoId]);

  const link = `https://app.cooperebr.com.br/indicar?ref=${codigoIndicacao || ''}`;
  const totalAplicado = beneficios.reduce((s, b) => s + Number(b.valorAplicado), 0);
  const totalPendente = beneficios.filter(b => b.status === 'PENDENTE' || b.status === 'PARCIAL').reduce((s, b) => s + Number(b.saldoRestante), 0);

  function copiar() {
    navigator.clipboard.writeText(link);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Gift className="h-4 w-4 text-green-600" />Programa de Indicações</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <div className="flex-1">
              <p className="text-xs text-gray-500 mb-1">Código único de indicação</p>
              <p className="text-sm font-mono font-bold text-green-700">{codigoIndicacao || '—'}</p>
            </div>
            <div className="flex-1">
              <p className="text-xs text-gray-500 mb-1">Link de indicação</p>
              <div className="flex items-center gap-2">
                <p className="text-xs font-mono text-gray-600 truncate">{link}</p>
                <button onClick={copiar} className="shrink-0 p-1.5 rounded hover:bg-gray-200 transition-colors" title="Copiar link">
                  {copiado ? <CheckCircle className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4 text-gray-500" />}
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-green-50 rounded-lg">
              <p className="text-xs text-gray-500">Total aplicado</p>
              <p className="text-lg font-bold text-green-700">R$ {totalAplicado.toFixed(2)}</p>
            </div>
            <div className="p-3 bg-amber-50 rounded-lg">
              <p className="text-xs text-gray-500">Pendente de aplicação</p>
              <p className="text-lg font-bold text-amber-700">R$ {totalPendente.toFixed(2)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {beneficios.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Benefícios recebidos</CardTitle></CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs text-gray-500 font-medium">Indicado</th>
                    <th className="px-4 py-2 text-left text-xs text-gray-500 font-medium">Tipo</th>
                    <th className="px-4 py-2 text-right text-xs text-gray-500 font-medium">Valor</th>
                    <th className="px-4 py-2 text-right text-xs text-gray-500 font-medium">Aplicado</th>
                    <th className="px-4 py-2 text-left text-xs text-gray-500 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {beneficios.map((b: any) => (
                    <tr key={b.id} className="border-t hover:bg-gray-50">
                      <td className="px-4 py-2">{b.indicacao?.cooperadoIndicado?.nomeCompleto ?? '—'}</td>
                      <td className="px-4 py-2 text-xs">{b.tipo === 'PERCENTUAL_FATURA' ? '% Fatura' : 'R$/kWh'}</td>
                      <td className="px-4 py-2 text-right">R$ {Number(b.valorCalculado).toFixed(2)}</td>
                      <td className="px-4 py-2 text-right">R$ {Number(b.valorAplicado).toFixed(2)}</td>
                      <td className="px-4 py-2">
                        <Badge variant="outline" className={`text-xs ${
                          b.status === 'APLICADO' ? 'bg-green-100 text-green-800' :
                          b.status === 'PARCIAL' ? 'bg-amber-100 text-amber-800' : ''
                        }`}>{b.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CooperadoPerfilPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { tipoMembro, tipoMembroPlural } = useTipoParceiro();

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
  const [dialogAtivarContrato, setDialogAtivarContrato] = useState<Contrato | null>(null);
  const [formAtivar, setFormAtivar] = useState({ protocoloConcessionaria: '', dataInicioCreditos: today(), observacoes: '' });
  const [dialogEncerrarContrato, setDialogEncerrarContrato] = useState<Contrato | null>(null);
  const [dialogDarBaixa, setDialogDarBaixa] = useState<Cobranca | null>(null);
  const [dialogExcluirCobranca, setDialogExcluirCobranca] = useState<Cobranca | null>(null);
  const [dialogExcluirDoc, setDialogExcluirDoc] = useState<DocumentoCooperado | null>(null);

  // Checklist
  const [checklist, setChecklist] = useState<{ tipo: string; status: string; items: { label: string; ok: boolean }[]; pronto: boolean } | null>(null);

  // Forms — Cooperado (RHF+Zod)
  const cooperadoForm = useForm<CooperadoFormData>({ resolver: zodResolver(cooperadoSchema) as any });
  const formCoopErrors = cooperadoForm.formState.errors;

  // Forms (legacy state-based)
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

  // Filtro cobranças
  const [filtroCobStatus, setFiltroCobStatus] = useState<string>('TODOS');

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

  // Upload fatura concessionária
  const [sheetUploadConc, setSheetUploadConc] = useState(false);
  const [faturaExpandida, setFaturaExpandida] = useState<string | null>(null);
  const [arquivoConc, setArquivoConc] = useState<File | null>(null);
  const [mesRefConc, setMesRefConc] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [uploadandoConc, setUploadandoConc] = useState(false);

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
    const controller = new AbortController();
    const signal = controller.signal;
    Promise.all([
      api.get<CooperadoCompleto>(`/cooperados/${id}`, { signal }),
      api.get(`/cooperados/${id}/checklist`, { signal }),
    ])
      .then(([coopRes, checkRes]) => {
        setCooperado(coopRes.data);
        setChecklist(checkRes.data);
      })
      .catch((err) => {
        if (err?.name !== 'AbortError' && err?.code !== 'ERR_CANCELED') {
          setErro('Registro não encontrado.');
        }
      })
      .finally(() => {
        if (!signal.aborted) setCarregando(false);
      });
    return () => controller.abort();
  }, [id]);

  const buscarFaturas = useCallback(async (force = false) => {
    if (faturasBuscadas && !force) return;
    setCarregandoFaturas(true);
    try {
      const { data } = await api.get<FaturaProcessada[]>(`/faturas/cooperado/${id}`);
      setFaturas(data);
      setFaturasBuscadas(true);
    } finally { setCarregandoFaturas(false); }
  }, [id, faturasBuscadas]);

  useEffect(() => { if (aba === 'fatura') buscarFaturas(); }, [aba, buscarFaturas]);
  useEffect(() => { if (aba === 'proposta') carregarHistoricoProposta(); }, [aba]);

  // ── Actions — Cooperado ───────────────────────────────────────────────────

  function abrirEditarCooperado() {
    if (!cooperado) return;
    cooperadoForm.reset({
      nomeCompleto: cooperado.nomeCompleto,
      email: cooperado.email,
      cpf: cooperado.cpf,
      telefone: cooperado.telefone ?? '',
      status: cooperado.status,
      dataNascimento: cooperado.dataNascimento ? cooperado.dataNascimento.slice(0, 10) : '',
      tipoPessoa: cooperado.tipoPessoa ?? 'PF',
      razaoSocial: cooperado.razaoSocial ?? '',
      cep: cooperado.cep ?? '',
      logradouro: cooperado.logradouro ?? '',
      numero: cooperado.numero ?? '',
      complemento: cooperado.complemento ?? '',
      bairro: cooperado.bairro ?? '',
      cidade: cooperado.cidade ?? '',
      estado: cooperado.estado ?? '',
    });
    setSheetCooperado(true);
  }

  async function salvarCooperado(formData: CooperadoFormData) {
    setSalvando(true);
    try {
      // Remover campos vazios opcionais para não enviar strings vazias
      const payload: Record<string, any> = { ...formData };
      if (!payload.dataNascimento) delete payload.dataNascimento;
      const { data } = await api.put<CooperadoCompleto>(`/cooperados/${id}`, payload);
      setCooperado(p => p ? { ...p, ...data } : p);
      setSheetCooperado(false);
      showToast('sucesso', 'Dados atualizados com sucesso.');
    } catch { showToast('erro', 'Erro ao atualizar dados.'); }
    finally { setSalvando(false); }
  }

  async function ativarCooperado() {
    setSalvando(true);
    try {
      const { data } = await api.put<CooperadoCompleto>(`/cooperados/${id}`, { status: 'ATIVO' });
      setCooperado(p => p ? { ...p, status: 'ATIVO', updatedAt: data.updatedAt } : p);
      // Recarregar dados completos (contratos mudam de PENDENTE_ATIVACAO para ATIVO)
      const [coopRes, checkRes] = await Promise.all([
        api.get<CooperadoCompleto>(`/cooperados/${id}`),
        api.get(`/cooperados/${id}/checklist`),
      ]);
      setCooperado(coopRes.data);
      setChecklist(checkRes.data);
      showToast('sucesso', `${tipoMembro} ativado! Contratos pendentes foram ativados automaticamente.`);
    } catch { showToast('erro', `Erro ao ativar ${tipoMembro.toLowerCase()}.`); }
    finally { setSalvando(false); }
  }

  // ── Actions — Ativar Contrato (Fase 7) ──────────────────────────────────

  async function ativarContrato() {
    if (!dialogAtivarContrato || !formAtivar.protocoloConcessionaria || !formAtivar.dataInicioCreditos) return;
    setSalvando(true);
    try {
      await api.post(`/contratos/${dialogAtivarContrato.id}/ativar`, formAtivar);
      setDialogAtivarContrato(null);
      // Recarregar dados completos
      const [coopRes, checkRes] = await Promise.all([
        api.get<CooperadoCompleto>(`/cooperados/${id}`),
        api.get(`/cooperados/${id}/checklist`),
      ]);
      setCooperado(coopRes.data);
      setChecklist(checkRes.data);
      showToast('sucesso', `${tipoMembro} ativado com sucesso!`);
    } catch { showToast('erro', 'Erro ao ativar contrato.'); }
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
    if (!cooperado?.ucs.length) { showToast('erro', `${tipoMembro} sem UC vinculada.`); return; }
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
      <p className="text-red-500">{erro || `${tipoMembro} não encontrado.`}</p>
      <Button variant="outline" onClick={() => router.back()}><ArrowLeft className="h-4 w-4 mr-2" />Voltar</Button>
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
      <button onClick={() => router.back()} className="inline-flex items-center text-sm text-gray-500 hover:text-gray-800 transition-colors">
        <ArrowLeft className="h-4 w-4 mr-1" />Voltar
      </button>

      {/* Header */}
      <div className="bg-white border rounded-xl px-6 py-5 flex items-start justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{cooperado.nomeCompleto}</h1>
            <Badge className={statusCoopColors[cooperado.status]}>{statusCoopLabel[cooperado.status] ?? cooperado.status}</Badge>
            <Badge className={tipoCooperadoColors[cooperado.tipoCooperado] ?? 'bg-gray-100 text-gray-800 border-gray-200'}>
              {tipoCooperadoLabel[cooperado.tipoCooperado] ?? cooperado.tipoCooperado}
            </Badge>
          </div>
          <p className="text-sm text-gray-500">
            {cooperado.tipoDocumento ?? 'CPF'}: {cooperado.cpf}
            <span className="mx-2 text-gray-300">•</span>{cooperado.email}
            {cooperado.telefone && <><span className="mx-2 text-gray-300">•</span>{cooperado.telefone}</>}
          </p>
          {cooperado.cotaKwhMensal && (
            <p className="text-sm text-green-700 font-medium">
              Cota: {Number(cooperado.cotaKwhMensal).toLocaleString('pt-BR')} kWh/mês
              {(() => { const soma = cooperado.contratos.filter((c: any) => c.status === 'ATIVO').reduce((acc: number, c: any) => acc + Number(c.percentualUsina ?? 0), 0); return soma > 0 ? <span className="ml-3 text-gray-500">({soma.toFixed(4)}% da usina)</span> : null; })()}
            </p>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={abrirEditarCooperado}>
            <Pencil className="h-4 w-4 mr-2" />Editar
          </Button>
          <Link href={`/dashboard/cooperados/${id}/fatura-mensal`}>
            <Button variant="outline" size="sm"><Upload className="h-4 w-4 mr-2" />Upload Fatura Mensal</Button>
          </Link>
          <Link href={`/dashboard/cooperados/${id}/fatura`}>
            <Button variant="outline" size="sm"><FileText className="h-4 w-4 mr-2" />Processar Fatura</Button>
          </Link>
        </div>
      </div>

      {/* Resumo Financeiro */}
      {(() => {
        const todasCobrancas = cooperado.contratos.flatMap(ct => ct.cobrancas);
        const mesAtual = new Date().getMonth() + 1;
        const anoAtual = new Date().getFullYear();
        const cobMes = todasCobrancas.filter(c => c.mesReferencia === mesAtual && c.anoReferencia === anoAtual);
        const totalMes = cobMes.reduce((acc, c) => acc + Number(c.valorLiquido), 0);
        const pagoAno = todasCobrancas.filter(c => c.anoReferencia === anoAtual && c.status === 'PAGO').reduce((acc, c) => acc + Number(c.valorLiquido), 0);
        const economiaAno = todasCobrancas.filter(c => c.anoReferencia === anoAtual).reduce((acc, c) => acc + Number(c.valorDesconto), 0);
        return (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-5 flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center"><CreditCard className="h-5 w-5 text-blue-600" /></div>
                <div><p className="text-xs text-gray-500">Cobranças no mês</p><p className="text-lg font-bold text-gray-900">{formatBRL(totalMes)}</p></div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center"><DollarSign className="h-5 w-5 text-green-600" /></div>
                <div><p className="text-xs text-gray-500">Total pago no ano</p><p className="text-lg font-bold text-gray-900">{formatBRL(pagoAno)}</p></div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center"><Zap className="h-5 w-5 text-emerald-600" /></div>
                <div><p className="text-xs text-gray-500">Economia estimada no ano</p><p className="text-lg font-bold text-green-700">{formatBRL(economiaAno)}</p></div>
              </CardContent>
            </Card>
          </div>
        );
      })()}

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
        <div className="space-y-4">
          {/* Checklist + Botão Ativar */}
          {checklist && (
            <Card className={checklist.pronto && cooperado.status === 'PENDENTE' ? 'border-green-400 bg-green-50/30' : ''}>
              <CardHeader>
                <CardTitle className="text-base flex items-center justify-between">
                  <span>Checklist de Ativacao</span>
                  {checklist.pronto && cooperado.status === 'PENDENTE' && (
                    <Button onClick={ativarCooperado} disabled={salvando} className="bg-green-600 hover:bg-green-700">
                      {salvando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                      Ativar {tipoMembro}
                    </Button>
                  )}
                  {(cooperado.status === 'ATIVO' || cooperado.status === 'ATIVO_RECEBENDO_CREDITOS') && (
                    <Badge className="bg-green-100 text-green-800 border-green-200">{cooperado.status === 'ATIVO_RECEBENDO_CREDITOS' ? 'Ativo - Recebendo Creditos' : `${tipoMembro} Ativo`}</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {checklist.items.map((item, i) => (
                    <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${item.ok ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                      {item.ok ? <CheckCircle className="h-4 w-4 text-green-600 shrink-0" /> : <XCircle className="h-4 w-4 text-gray-400 shrink-0" />}
                      <span className={`text-sm ${item.ok ? 'text-green-800 font-medium' : 'text-gray-500'}`}>{item.label}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Dados Pessoais</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <Campo label="Nome completo" value={cooperado.nomeCompleto} />
                <Campo label="CPF/CNPJ" value={cooperado.cpf} />
                <Campo label="Email" value={cooperado.email} />
                <Campo label="Telefone" value={cooperado.telefone} />
                <Campo label="Documento (OCR)" value={cooperado.documento} />
                <Campo label="Tipo documento" value={cooperado.tipoDocumento} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Dados Tecnicos</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <Campo label="Cota kWh/mes" value={cooperado.cotaKwhMensal ? `${Number(cooperado.cotaKwhMensal).toLocaleString('pt-BR')} kWh` : null} />
                <Campo label="% da usina" value={(() => { const soma = cooperado.contratos.filter((c: any) => c.status === 'ATIVO').reduce((acc: number, c: any) => acc + Number(c.percentualUsina ?? 0), 0); return soma > 0 ? `${soma.toFixed(4)}%` : null; })()} />
                <Campo label="UCs vinculadas" value={cooperado.ucs.length || '—'} />
                <Campo label="Contratos" value={cooperado.contratos.length || '—'} />
              </CardContent>
            </Card>
          </div>

          {/* Resumo de contratos com usina */}
          {cooperado.contratos.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Contratos Vinculados</CardTitle></CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead className="border-b bg-gray-50">
                    <tr>
                      <th className="text-left px-4 py-2 text-xs text-gray-500 font-medium">Contrato</th>
                      <th className="text-left px-4 py-2 text-xs text-gray-500 font-medium">Status</th>
                      <th className="text-left px-4 py-2 text-xs text-gray-500 font-medium">Usina</th>
                      <th className="text-right px-4 py-2 text-xs text-gray-500 font-medium">kWh</th>
                      <th className="text-right px-4 py-2 text-xs text-gray-500 font-medium">Desconto</th>
                      <th className="text-left px-4 py-2 text-xs text-gray-500 font-medium">Plano</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cooperado.contratos.map(c => (
                      <tr key={c.id} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="px-4 py-2 font-medium">{c.numero}</td>
                        <td className="px-4 py-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusContratoColors[c.status] ?? 'bg-gray-100'}`}>
                            {statusContratoLabel[c.status] ?? c.status}
                          </span>
                        </td>
                        <td className="px-4 py-2">{c.usina ? <Link href={`/dashboard/usinas/${c.usina.id}`} className="text-blue-600 hover:underline font-medium">{c.usina.nome}</Link> : <span className="text-gray-400">Sem usina</span>}</td>
                        <td className="px-4 py-2 text-right font-mono">{Number(c.kwhContrato ?? 0).toLocaleString('pt-BR')}</td>
                        <td className="px-4 py-2 text-right">{Number(c.percentualDesconto).toFixed(2)}%</td>
                        <td className="px-4 py-2">{c.plano ? `${c.plano.nome} (${modeloCobrancaLabel[c.plano.modeloCobranca] ?? c.plano.modeloCobranca})` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle className="text-base">Datas</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <Campo label="Criado em" value={new Date(cooperado.createdAt).toLocaleString('pt-BR')} />
              <Campo label="Atualizado em" value={new Date(cooperado.updatedAt).toLocaleString('pt-BR')} />
            </CardContent>
          </Card>

          {/* UCs vinculadas */}
          {cooperado.ucs.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">UCs Vinculadas</CardTitle></CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead className="border-b bg-gray-50">
                    <tr>
                      <th className="text-left px-4 py-2 text-xs text-gray-500 font-medium">Número</th>
                      <th className="text-left px-4 py-2 text-xs text-gray-500 font-medium">Endereço</th>
                      <th className="text-left px-4 py-2 text-xs text-gray-500 font-medium">Cidade/UF</th>
                      <th className="text-left px-4 py-2 text-xs text-gray-500 font-medium">Distribuidora</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cooperado.ucs.map(uc => (
                      <tr key={uc.id} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="px-4 py-2 font-medium"><Link href={`/dashboard/ucs/${uc.id}`} className="text-blue-600 hover:underline font-medium">{uc.numero}</Link></td>
                        <td className="px-4 py-2">{uc.endereco}</td>
                        <td className="px-4 py-2">{uc.cidade}/{uc.estado}</td>
                        <td className="px-4 py-2">{uc.distribuidora ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── Aba 2: Fatura & Consumo ── */}
      {aba === 'fatura' && (
        <div className="space-y-4">
          {/* Upload concessionária */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2"><Upload className="h-4 w-4" />Faturas da Concessionária</span>
                <Button size="sm" onClick={() => setSheetUploadConc(true)}>
                  <FilePlus className="h-4 w-4 mr-1" />Upload Fatura
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {carregandoFaturas ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
              ) : faturas.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">Nenhuma fatura processada.</p>
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs text-gray-500 font-medium">Mês Ref.</th>
                        <th className="px-4 py-2 text-left text-xs text-gray-500 font-medium">Distribuidora</th>
                        <th className="px-4 py-2 text-right text-xs text-gray-500 font-medium">kWh Comp.</th>
                        <th className="px-4 py-2 text-right text-xs text-gray-500 font-medium">Saldo</th>
                        <th className="px-4 py-2 text-left text-xs text-gray-500 font-medium">Status</th>
                        <th className="px-4 py-2 text-right text-xs text-gray-500 font-medium">Cobrança</th>
                        <th className="px-4 py-2 text-center text-xs text-gray-500 font-medium">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {faturas.map((f) => {
                        const d = f.dadosExtraidos as any;
                        const analise = (f as any).analise as any;
                        const sr = (f as any).statusRevisao as string;
                        const isExpanded = faturaExpandida === f.id;
                        return (
                          <React.Fragment key={f.id}>
                            <tr className="border-t hover:bg-gray-50 cursor-pointer" onClick={() => setFaturaExpandida(isExpanded ? null : f.id)}>
                              <td className="px-4 py-2">{(f as any).mesReferencia ?? d?.mesReferencia ?? '—'}</td>
                              <td className="px-4 py-2">{d?.distribuidora ?? '—'}</td>
                              <td className="px-4 py-2 text-right">{Number(d?.creditosRecebidosKwh ?? 0).toFixed(0)}</td>
                              <td className="px-4 py-2 text-right">{Number(d?.saldoTotalKwh ?? 0).toFixed(0)}</td>
                              <td className="px-4 py-2">
                                <Badge variant="outline" className={`text-xs ${
                                  sr === 'AUTO_APROVADO' || sr === 'APROVADO' ? 'bg-green-100 text-green-800 border-green-200' :
                                  sr === 'PENDENTE_REVISAO' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
                                  sr === 'REJEITADO' ? 'bg-red-100 text-red-800 border-red-200' : ''
                                }`}>
                                  {sr === 'AUTO_APROVADO' ? 'Auto-aprovado' : sr === 'APROVADO' ? 'Aprovado' : sr === 'PENDENTE_REVISAO' ? 'Revisar' : sr === 'REJEITADO' ? 'Rejeitado' : f.status}
                                </Badge>
                              </td>
                              <td className="px-4 py-2 text-right">
                                {(f as any).cobrancaGeradaId ? <Badge variant="outline" className="text-xs bg-green-50 text-green-700">Gerada</Badge> : '—'}
                              </td>
                              <td className="px-4 py-2 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  {sr === 'PENDENTE_REVISAO' && (
                                    <>
                                      <Button size="sm" variant="outline" className="h-7 text-xs text-green-700 border-green-300 hover:bg-green-50" onClick={async (e) => {
                                        e.stopPropagation();
                                        try {
                                          await api.patch(`/faturas/${f.id}/aprovar`);
                                          showToast('sucesso', 'Fatura aprovada');
                                          buscarFaturas(true);
                                        } catch { showToast('erro', 'Erro ao aprovar'); }
                                      }}>
                                        <CheckCircle className="h-3 w-3 mr-1" />Aprovar
                                      </Button>
                                      <Button size="sm" variant="outline" className="h-7 text-xs text-red-600 border-red-300 hover:bg-red-50" onClick={async (e) => {
                                        e.stopPropagation();
                                        try {
                                          await api.patch(`/faturas/${f.id}/rejeitar`);
                                          showToast('sucesso', 'Fatura rejeitada');
                                          buscarFaturas(true);
                                        } catch { showToast('erro', 'Erro ao rejeitar'); }
                                      }}>
                                        <XCircle className="h-3 w-3 mr-1" />Rejeitar
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                            {isExpanded && (
                              <tr className="bg-gray-50">
                                <td colSpan={7} className="px-4 py-3">
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                                    {analise && (
                                      <>
                                        <div><span className="text-gray-500">kWh Esperado:</span> <strong>{Number(analise.kwhEsperado ?? 0).toLocaleString('pt-BR')}</strong></div>
                                        <div><span className="text-gray-500">kWh Compensado:</span> <strong>{Number(analise.kwhCompensado ?? 0).toLocaleString('pt-BR')}</strong></div>
                                        <div><span className="text-gray-500">kWh Injetado:</span> <strong>{Number(analise.kwhInjetado ?? 0).toLocaleString('pt-BR')}</strong></div>
                                        <div><span className="text-gray-500">Divergência:</span> <strong className={Number(analise.divergenciaPerc ?? 0) > 10 ? 'text-red-600' : 'text-green-600'}>{Number(analise.divergenciaPerc ?? 0).toFixed(1)}%</strong></div>
                                      </>
                                    )}
                                    <div><span className="text-gray-500">Consumo Atual:</span> <strong>{Number(d?.consumoAtualKwh ?? 0).toLocaleString('pt-BR')} kWh</strong></div>
                                    <div><span className="text-gray-500">Total a Pagar:</span> <strong>{Number(d?.totalAPagar ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong></div>
                                    <div><span className="text-gray-500">Titular:</span> <strong>{d?.titular ?? '—'}</strong></div>
                                    <div><span className="text-gray-500">UC:</span> <strong>{d?.numeroUC ?? '—'}</strong></div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* OCR original (legacy) */}
          <FaturaUploadOCR
            cooperadoId={id}
            onFaturaProcessada={() => {
              api.get<FaturaProcessada[]>(`/faturas/cooperado/${id}`).then(r => setFaturas(r.data)).catch(() => {});
            }}
          />
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
                        <Badge className={statusContratoColors[c.status]}>{statusContratoLabel[c.status] ?? c.status}</Badge>
                        {c.status === 'PENDENTE_ATIVACAO' && (
                          <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => { setFormAtivar({ protocoloConcessionaria: '', dataInicioCreditos: today(), observacoes: '' }); setDialogAtivarContrato(c); }}>
                            <Zap className="h-3.5 w-3.5 mr-1" />Ativar
                          </Button>
                        )}
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
                        <Link href={`/dashboard/ucs/${c.uc.id}`} className="text-blue-600 hover:underline text-sm font-medium">Ver UC</Link>
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
                        <Link href={`/dashboard/usinas/${c.usina.id}`} className="text-blue-600 hover:underline text-sm font-medium">Ver Usina</Link>
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
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-400" />
              <select className="border border-gray-300 rounded-md px-2 py-1 text-sm" value={filtroCobStatus} onChange={e => setFiltroCobStatus(e.target.value)}>
                <option value="TODOS">Todos os status</option>
                <option value="PENDENTE">Pendente</option>
                <option value="PAGO">Pago</option>
                <option value="VENCIDO">Vencido</option>
                <option value="CANCELADO">Cancelado</option>
              </select>
            </div>
            <Button size="sm" onClick={() => { setFormCob({ mes: String(new Date().getMonth() + 1), ano: String(new Date().getFullYear()), valorBruto: '', percentualDesconto: String(contrato?.percentualDesconto ?? ''), dataVencimento: '' }); setSheetNovaCobranca(true); }} disabled={!contrato}>
              <Plus className="h-4 w-4 mr-2" />Nova cobrança
            </Button>
          </div>
          <Card>
            <CardContent className="p-0">
              {(() => {
                const todasCob = cooperado.contratos.flatMap(ct => ct.cobrancas);
                const cobFiltradas = filtroCobStatus === 'TODOS' ? todasCob : todasCob.filter(c => c.status === filtroCobStatus);
                return cobFiltradas.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-12"><CreditCard className="h-10 w-10 text-gray-300" /><p className="text-gray-500">{todasCob.length === 0 ? 'Nenhuma cobrança gerada ainda.' : 'Nenhuma cobrança com este status.'}</p></div>
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
                    {cobFiltradas.map(c => (
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
              );
              })()}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Aba 5: Documentos ── */}
      {aba === 'documentos' && (
        <div className="space-y-3">
          <div className="flex justify-between">
            <Link href={`/dashboard/cooperados/${id}/documentos`}>
              <Button variant="outline" size="sm"><FileText className="h-4 w-4 mr-2" />Ver todos</Button>
            </Link>
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
          {/* Histórico de propostas — sempre visível */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span>Historico de Propostas</span>
                <Button onClick={() => calcularProposta()} disabled={calculandoProposta} size="sm">
                  <Zap className="h-4 w-4 mr-2" />{proposta ? 'Recalcular' : 'Calcular proposta'}
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {historicoProposta.length === 0 ? (
                <div className="text-center py-8 text-gray-400">Nenhuma proposta gerada ainda.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Referencia</th>
                      <th className="text-right px-3 py-2 text-xs font-medium text-gray-500">kWh</th>
                      <th className="text-right px-3 py-2 text-xs font-medium text-gray-500">Desconto</th>
                      <th className="text-right px-3 py-2 text-xs font-medium text-gray-500">Economia/mes</th>
                      <th className="text-center px-3 py-2 text-xs font-medium text-gray-500">Status</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Data</th>
                      <th className="text-right px-3 py-2 text-xs font-medium text-gray-500">Acoes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {historicoProposta.map((p: any) => (
                      <tr key={p.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2">{p.mesReferencia}</td>
                        <td className="px-3 py-2 text-right font-mono text-xs">{Number(p.kwhContrato).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</td>
                        <td className="px-3 py-2 text-right text-green-700">{Number(p.descontoPercentual).toFixed(2)}%</td>
                        <td className="px-3 py-2 text-right text-green-700">{Number(p.economiaMensal).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.status === 'ACEITA' ? 'bg-green-100 text-green-800' : p.status === 'PENDENTE' ? 'bg-yellow-100 text-yellow-800' : p.status === 'CANCELADA' ? 'bg-gray-100 text-gray-600' : 'bg-gray-100 text-gray-600'}`}>{p.status}</span>
                        </td>
                        <td className="px-3 py-2 text-gray-500 text-xs">{new Date(p.createdAt).toLocaleDateString('pt-BR')}</td>
                        <td className="px-3 py-2 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-green-700 hover:text-green-900" title="Gerar PDF"
                              onClick={async () => {
                                try {
                                  const { data } = await api.post(`/motor-proposta/proposta/${p.id}/enviar-pdf`, {});
                                  if (data.pdfPath) {
                                    window.open(`/motor-proposta/proposta/${p.id}/html`, '_blank');
                                  }
                                  showToast('sucesso', data.mensagem || 'PDF gerado.');
                                } catch { showToast('erro', 'Erro ao gerar PDF.'); }
                              }}>
                              <FileDown className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-green-600 hover:text-green-800" title="Enviar WhatsApp"
                              onClick={async () => {
                                try {
                                  const { data } = await api.post(`/motor-proposta/proposta/${p.id}/enviar-aprovacao`, {
                                    canal: 'whatsapp',
                                    destino: cooperado.telefone || '',
                                  });
                                  showToast('sucesso', data.link ? 'Link de aprovacao enviado por WhatsApp.' : 'Enviado por WhatsApp.');
                                } catch { showToast('erro', 'Erro ao enviar por WhatsApp.'); }
                              }}>
                              <MessageCircle className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-blue-600 hover:text-blue-800" title="Enviar Email"
                              onClick={async () => {
                                try {
                                  const { data } = await api.post(`/motor-proposta/proposta/${p.id}/enviar-aprovacao`, {
                                    canal: 'email',
                                    destino: cooperado.email || '',
                                  });
                                  showToast('sucesso', data.link ? 'Link de aprovacao enviado por email.' : 'Enviado por email.');
                                } catch { showToast('erro', 'Erro ao enviar por email.'); }
                              }}>
                              <Mail className="h-3.5 w-3.5" />
                            </Button>
                            {p.status !== 'CANCELADA' && (
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-red-500 hover:text-red-700" title="Excluir"
                                onClick={async () => {
                                  try {
                                    await api.delete(`/motor-proposta/proposta/${p.id}`);
                                    setHistoricoProposta(prev => prev.filter(x => x.id !== p.id));
                                    showToast('sucesso', 'Proposta excluida.');
                                  } catch { showToast('erro', 'Erro ao excluir proposta.'); }
                                }}>
                                <XCircle className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>

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

                  <div className="flex gap-3 border-t pt-4 flex-wrap">
                    <Button onClick={aceitarProposta} disabled={salvando} className="bg-green-600 hover:bg-green-700">
                      {salvando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                      Aceitar proposta
                    </Button>
                    <Button variant="outline" onClick={() => setProposta(null)} disabled={salvando}>
                      Recalcular
                    </Button>
                  </div>

                  {/* Botoes de envio — visivel apos proposta salva no historico */}
                  {historicoProposta.length > 0 && (() => {
                    const ultimaProposta = historicoProposta[0];
                    return (
                      <div className="flex gap-2 border-t pt-4 flex-wrap">
                        <Button size="sm" variant="outline" onClick={async () => {
                          try {
                            await api.post(`/motor-proposta/proposta/${ultimaProposta.id}/enviar-pdf`, {});
                            window.open(`/api/motor-proposta/proposta/${ultimaProposta.id}/html`, '_blank');
                            showToast('sucesso', 'PDF gerado com sucesso.');
                          } catch { showToast('erro', 'Erro ao gerar PDF.'); }
                        }}>
                          <FileDown className="h-4 w-4 mr-2" />Gerar PDF
                        </Button>
                        <Button size="sm" variant="outline" className="text-green-700 border-green-300 hover:bg-green-50" onClick={async () => {
                          try {
                            await api.post(`/motor-proposta/proposta/${ultimaProposta.id}/enviar-aprovacao`, {
                              canal: 'whatsapp',
                              destino: cooperado.telefone || '',
                            });
                            showToast('sucesso', 'Proposta enviada por WhatsApp.');
                          } catch { showToast('erro', 'Erro ao enviar por WhatsApp.'); }
                        }}>
                          <MessageCircle className="h-4 w-4 mr-2" />Enviar por WhatsApp
                        </Button>
                        <Button size="sm" variant="outline" className="text-blue-700 border-blue-300 hover:bg-blue-50" onClick={async () => {
                          try {
                            await api.post(`/motor-proposta/proposta/${ultimaProposta.id}/enviar-aprovacao`, {
                              canal: 'email',
                              destino: cooperado.email || '',
                            });
                            showToast('sucesso', 'Proposta enviada por email.');
                          } catch { showToast('erro', 'Erro ao enviar por email.'); }
                        }}>
                          <Mail className="h-4 w-4 mr-2" />Enviar por Email
                        </Button>
                      </div>
                    );
                  })()}
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

      {/* Sheet — Editar Cooperado (RHF + Zod) */}
      <Sheet open={sheetCooperado} onOpenChange={setSheetCooperado}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader><SheetTitle>Editar {tipoMembro}</SheetTitle></SheetHeader>
          <form onSubmit={cooperadoForm.handleSubmit(salvarCooperado)} className="mt-6 space-y-4">
            <div>
              <label className={lbl}>Nome completo *</label>
              <input className={cls} {...cooperadoForm.register('nomeCompleto')} />
              {formCoopErrors.nomeCompleto && <p className="text-xs text-red-500 mt-1">{formCoopErrors.nomeCompleto.message}</p>}
            </div>
            <div>
              <label className={lbl}>Email *</label>
              <input type="email" className={cls} {...cooperadoForm.register('email')} />
              {formCoopErrors.email && <p className="text-xs text-red-500 mt-1">{formCoopErrors.email.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>CPF/CNPJ *</label>
                <input className={cls} {...cooperadoForm.register('cpf')} />
                {formCoopErrors.cpf && <p className="text-xs text-red-500 mt-1">{formCoopErrors.cpf.message}</p>}
              </div>
              <div>
                <label className={lbl}>Telefone (celular)</label>
                <input className={cls} {...cooperadoForm.register('telefone')} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Status</label>
                <select className={cls} {...cooperadoForm.register('status')}>
                  {['PENDENTE', 'ATIVO', 'ATIVO_RECEBENDO_CREDITOS', 'AGUARDANDO_CONCESSIONARIA', 'SUSPENSO', 'ENCERRADO'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>Data de nascimento</label>
                <input type="date" className={cls} {...cooperadoForm.register('dataNascimento')} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Tipo de pessoa</label>
                <select className={cls} {...cooperadoForm.register('tipoPessoa')}>
                  <option value="PF">Pessoa Física</option>
                  <option value="PJ">Pessoa Jurídica</option>
                </select>
              </div>
              {cooperadoForm.watch('tipoPessoa') === 'PJ' && (
                <div>
                  <label className={lbl}>Razão social</label>
                  <input className={cls} {...cooperadoForm.register('razaoSocial')} />
                </div>
              )}
            </div>

            {/* Endereço */}
            <div className="border-t pt-3 mt-3">
              <p className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Endereço</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={lbl}>CEP</label>
                  <input
                    className={cls}
                    maxLength={9}
                    {...cooperadoForm.register('cep', {
                      onChange: (e) => {
                        const raw = e.target.value.replace(/\D/g, '');
                        if (raw.length === 8) {
                          fetch(`https://viacep.com.br/ws/${raw}/json/`)
                            .then(r => r.json())
                            .then(d => {
                              if (!d.erro) {
                                cooperadoForm.setValue('logradouro', d.logradouro || '');
                                cooperadoForm.setValue('bairro', d.bairro || '');
                                cooperadoForm.setValue('cidade', d.localidade || '');
                                cooperadoForm.setValue('estado', d.uf || '');
                              }
                            })
                            .catch(() => {});
                        }
                      },
                    })}
                  />
                </div>
                <div className="col-span-2">
                  <label className={lbl}>Logradouro</label>
                  <input className={cls} {...cooperadoForm.register('logradouro')} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 mt-2">
                <div>
                  <label className={lbl}>Número</label>
                  <input className={cls} {...cooperadoForm.register('numero')} />
                </div>
                <div className="col-span-2">
                  <label className={lbl}>Complemento</label>
                  <input className={cls} {...cooperadoForm.register('complemento')} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 mt-2">
                <div>
                  <label className={lbl}>Bairro</label>
                  <input className={cls} {...cooperadoForm.register('bairro')} />
                </div>
                <div>
                  <label className={lbl}>Cidade</label>
                  <input className={cls} {...cooperadoForm.register('cidade')} />
                </div>
                <div>
                  <label className={lbl}>Estado</label>
                  <input className={cls} maxLength={2} {...cooperadoForm.register('estado')} />
                </div>
              </div>
            </div>

            <SheetFooter className="flex gap-2 pt-2">
              <Button type="submit" disabled={salvando} className="flex-1">{salvando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Salvar</Button>
              <Button type="button" variant="outline" onClick={() => setSheetCooperado(false)}>Cancelar</Button>
            </SheetFooter>
          </form>
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

      {/* ─── Aba Cobranças Asaas ─────────────────────────────────────────── */}
      {aba === 'asaas' && <AsaasTab cooperadoId={id} />}

      {/* ─── Aba Financeiro ─────────────────────────────────────────────── */}
      {aba === 'financeiro' && <FinanceiroTab cooperadoId={id} />}

      {/* ─── Aba Indicações ───────────────────────────────────────────────── */}
      {aba === 'indicacoes' && <IndicacoesTab cooperadoId={id} codigoIndicacao={cooperado?.codigoIndicacao} />}

      {/* ════════════════════════════════════════════════════════════════════════
          DIALOGS
      ════════════════════════════════════════════════════════════════════════ */}

      {/* Dialog — Ativar Contrato */}
      <Dialog open={!!dialogAtivarContrato} onOpenChange={v => !v && setDialogAtivarContrato(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ativar Contrato {dialogAtivarContrato?.numero}</DialogTitle>
            <DialogDescription>Informe os dados da concessionaria para ativar os creditos do cooperado.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className={lbl}>Protocolo da Concessionaria *</label>
              <input type="text" className={cls} placeholder="Ex: PROT-2026-12345" value={formAtivar.protocoloConcessionaria} onChange={e => setFormAtivar(p => ({ ...p, protocoloConcessionaria: e.target.value }))} />
            </div>
            <div>
              <label className={lbl}>Data de Inicio dos Creditos *</label>
              <input type="date" className={cls} value={formAtivar.dataInicioCreditos} onChange={e => setFormAtivar(p => ({ ...p, dataInicioCreditos: e.target.value }))} />
            </div>
            <div>
              <label className={lbl}>Observacoes (opcional)</label>
              <textarea className={cls} rows={3} placeholder="Observacoes sobre a ativacao..." value={formAtivar.observacoes} onChange={e => setFormAtivar(p => ({ ...p, observacoes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogAtivarContrato(null)}>Cancelar</Button>
            <Button className="bg-green-600 hover:bg-green-700" onClick={ativarContrato} disabled={salvando || !formAtivar.protocoloConcessionaria || !formAtivar.dataInicioCreditos}>
              {salvando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Zap className="h-4 w-4 mr-2" />}Confirmar Ativacao
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      {/* Sheet — Upload Fatura Concessionária */}
      <Sheet open={sheetUploadConc} onOpenChange={setSheetUploadConc}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader><SheetTitle>Upload Fatura Concessionária</SheetTitle></SheetHeader>
          <div className="mt-6 space-y-4">
            <div>
              <label className={lbl}>Mês de referência</label>
              <input type="month" className={cls} value={mesRefConc} onChange={e => setMesRefConc(e.target.value)} />
            </div>
            <div>
              <label className={lbl}>Arquivo PDF da fatura</label>
              <input type="file" accept=".pdf,image/*" className={cls + ' py-1.5 cursor-pointer'} onChange={e => setArquivoConc(e.target.files?.[0] ?? null)} />
              {arquivoConc && <p className="text-xs text-gray-500 mt-1">{arquivoConc.name} ({(arquivoConc.size / 1024).toFixed(0)} KB)</p>}
            </div>
          </div>
          <SheetFooter className="mt-6 flex gap-2">
            <Button onClick={async () => {
              if (!arquivoConc || !mesRefConc) return;
              setUploadandoConc(true);
              try {
                const reader = new FileReader();
                const base64 = await new Promise<string>((resolve) => {
                  reader.onload = () => resolve((reader.result as string).split(',')[1]);
                  reader.readAsDataURL(arquivoConc);
                });
                const tipoArquivo = arquivoConc.type.includes('pdf') ? 'pdf' : 'imagem';
                const { data } = await api.post('/faturas/upload-concessionaria', {
                  cooperadoId: id,
                  arquivoBase64: base64,
                  tipoArquivo,
                  mesReferencia: mesRefConc,
                });
                showToast('sucesso', data.statusRevisao === 'AUTO_APROVADO'
                  ? 'Fatura auto-aprovada! Cobrança gerada.'
                  : 'Fatura enviada para revisão.');
                setSheetUploadConc(false);
                setArquivoConc(null);
                buscarFaturas();
              } catch (err: any) {
                showToast('erro', err?.response?.data?.message ?? 'Erro ao processar fatura');
              } finally {
                setUploadandoConc(false);
              }
            }} disabled={uploadandoConc || !arquivoConc} className="flex-1">
              {uploadandoConc ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
              Enviar e Processar
            </Button>
            <Button variant="outline" onClick={() => setSheetUploadConc(false)}>Cancelar</Button>
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
