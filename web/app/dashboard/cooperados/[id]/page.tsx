'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Building2,
  CheckCircle,
  CreditCard,
  FileCheck,
  FilePlus,
  FileText,
  FileX,
  Pencil,
  User,
  XCircle,
  Zap,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

type Aba = 'geral' | 'fatura' | 'contrato' | 'cobrancas' | 'documentos' | 'ocorrencias';

interface HistoricoItem { mesAno: string; consumoKwh: number; valorRS: number }

interface DadosExtraidos {
  titular: string;
  documento: string;
  tipoDocumento: string;
  enderecoInstalacao: string;
  cidade: string;
  estado: string;
  numeroUC: string;
  distribuidora: string;
  classificacao: string;
  mesReferencia: string;
  consumoAtualKwh: number;
  totalAPagar: number;
  bandeiraTarifaria: string;
  historicoConsumo: HistoricoItem[];
}

interface FaturaProcessada {
  id: string;
  arquivoUrl: string | null;
  dadosExtraidos: DadosExtraidos;
  mediaKwhCalculada: number | string;
  mesesUtilizados: number;
  mesesDescartados: number;
  status: string;
  createdAt: string;
}

interface UCItem {
  id: string;
  numero: string;
  endereco: string;
  cidade: string;
  estado: string;
  distribuidora: string | null;
}

interface Plano {
  id: string;
  nome: string;
  modeloCobranca: string;
  descontoBase: number | string;
}

interface Cobranca {
  id: string;
  mesReferencia: number;
  anoReferencia: number;
  valorBruto: number | string;
  valorDesconto: number | string;
  valorLiquido: number | string;
  percentualDesconto: number | string;
  status: string;
  dataVencimento: string;
  dataPagamento: string | null;
}

interface Usina {
  id: string;
  nome: string;
  potenciaKwp: number | string;
  cidade: string;
  estado: string;
}

interface Contrato {
  id: string;
  numero: string;
  status: string;
  dataInicio: string;
  dataFim: string | null;
  percentualDesconto: number | string;
  plano: Plano | null;
  uc: UCItem | null;
  usina: Usina | null;
  cobrancas: Cobranca[];
}

interface DocumentoCooperado {
  id: string;
  tipo: string;
  url: string;
  nomeArquivo: string | null;
  status: string;
  motivoRejeicao: string | null;
  createdAt: string;
}

interface OcorrenciaItem {
  id: string;
  tipo: string;
  descricao: string;
  status: string;
  prioridade: string;
  createdAt: string;
}

interface CooperadoCompleto {
  id: string;
  nomeCompleto: string;
  cpf: string;
  email: string;
  telefone: string | null;
  status: string;
  cotaKwhMensal: number | string | null;
  percentualUsina: number | string | null;
  documento: string | null;
  tipoDocumento: string | null;
  createdAt: string;
  updatedAt: string;
  ucs: UCItem[];
  contratos: Contrato[];
  documentos: DocumentoCooperado[];
  ocorrencias: OcorrenciaItem[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const statusCooperadoColors: Record<string, string> = {
  ATIVO: 'bg-green-100 text-green-800 border-green-200',
  PENDENTE: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  SUSPENSO: 'bg-orange-100 text-orange-800 border-orange-200',
  ENCERRADO: 'bg-red-100 text-red-800 border-red-200',
};
const statusCooperadoLabel: Record<string, string> = {
  ATIVO: 'Ativo', PENDENTE: 'Pendente', SUSPENSO: 'Suspenso', ENCERRADO: 'Encerrado',
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
const statusCobLabel: Record<string, string> = {
  PAGO: 'Pago', PENDENTE: 'Pendente', VENCIDO: 'Vencido', CANCELADO: 'Cancelado',
};

const statusContratoColors: Record<string, string> = {
  ATIVO: 'bg-green-100 text-green-800 border-green-200',
  SUSPENSO: 'bg-orange-100 text-orange-800 border-orange-200',
  ENCERRADO: 'bg-red-100 text-red-800 border-red-200',
};

const tipoDocLabel: Record<string, string> = {
  RG_FRENTE: 'RG (Frente)', RG_VERSO: 'RG (Verso)',
  CNH_FRENTE: 'CNH (Frente)', CNH_VERSO: 'CNH (Verso)',
  CONTRATO_SOCIAL: 'Contrato Social',
};

const tipoOcorrenciaLabel: Record<string, string> = {
  FALTA_ENERGIA: 'Falta de Energia', MEDICAO_INCORRETA: 'Medição Incorreta',
  PROBLEMA_FATURA: 'Problema na Fatura', SOLICITACAO: 'Solicitação', OUTROS: 'Outros',
};

const modeloCobrancaLabel: Record<string, string> = {
  FIXO_MENSAL: 'Fixo Mensal',
  CREDITOS_COMPENSADOS: 'Créditos Compensados',
  CREDITOS_DINAMICO: 'Créditos Dinâmico',
};

function formatBRL(v: number | string) {
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function Campo({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className="text-sm font-medium text-gray-800">{value ?? '—'}</p>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-5 bg-gray-200 animate-pulse rounded w-full" />
      ))}
    </div>
  );
}

// ─── Tabs config ─────────────────────────────────────────────────────────────

const abas: { id: Aba; label: string; icon: React.ElementType }[] = [
  { id: 'geral', label: 'Visão Geral', icon: User },
  { id: 'fatura', label: 'Fatura & Consumo', icon: BarChart3 },
  { id: 'contrato', label: 'Contrato & Plano', icon: Building2 },
  { id: 'cobrancas', label: 'Cobranças', icon: CreditCard },
  { id: 'documentos', label: 'Documentos', icon: FileText },
  { id: 'ocorrencias', label: 'Ocorrências', icon: AlertTriangle },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CooperadoPerfilPage() {
  const { id } = useParams<{ id: string }>();
  const [cooperado, setCooperado] = useState<CooperadoCompleto | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [aba, setAba] = useState<Aba>('geral');

  // Fatura state
  const [faturas, setFaturas] = useState<FaturaProcessada[]>([]);
  const [carregandoFaturas, setCarregandoFaturas] = useState(false);
  const [faturasBuscadas, setFaturasBuscadas] = useState(false);

  // Documento actions
  const [docAcao, setDocAcao] = useState<string | null>(null); // id do doc em ação
  const [reprovarId, setReprovarId] = useState<string | null>(null);
  const [motivoRejeicao, setMotivoRejeicao] = useState('');
  const [docMensagem, setDocMensagem] = useState('');

  useEffect(() => {
    api
      .get<CooperadoCompleto>(`/cooperados/${id}`)
      .then((r) => setCooperado(r.data))
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
    } finally {
      setCarregandoFaturas(false);
    }
  }, [id, faturasBuscadas]);

  useEffect(() => {
    if (aba === 'fatura') buscarFaturas();
  }, [aba, buscarFaturas]);

  async function aprovarDoc(docId: string) {
    setDocAcao(docId);
    setDocMensagem('');
    try {
      await api.patch(`/documentos/${docId}/aprovar`);
      setCooperado((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          documentos: prev.documentos.map((d) =>
            d.id === docId ? { ...d, status: 'APROVADO', motivoRejeicao: null } : d,
          ),
        };
      });
      setDocMensagem('Documento aprovado.');
    } catch {
      setDocMensagem('Erro ao aprovar documento.');
    } finally {
      setDocAcao(null);
    }
  }

  async function reprovarDoc() {
    if (!reprovarId || !motivoRejeicao.trim()) return;
    setDocAcao(reprovarId);
    setDocMensagem('');
    try {
      await api.patch(`/documentos/${reprovarId}/reprovar`, { motivoRejeicao });
      setCooperado((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          documentos: prev.documentos.map((d) =>
            d.id === reprovarId ? { ...d, status: 'REPROVADO', motivoRejeicao } : d,
          ),
        };
      });
      setReprovarId(null);
      setMotivoRejeicao('');
      setDocMensagem('Documento reprovado.');
    } catch {
      setDocMensagem('Erro ao reprovar documento.');
    } finally {
      setDocAcao(null);
    }
  }

  const contrato = cooperado?.contratos?.[0] ?? null;
  const cobrancas = contrato?.cobrancas ?? [];
  const ultimaFatura = faturas[0] ?? null;

  // ── Loading / Error ────────────────────────────────────────────────────────

  if (carregando) {
    return (
      <div className="max-w-5xl space-y-6">
        <div className="h-8 bg-gray-200 animate-pulse rounded w-64" />
        <div className="h-24 bg-gray-200 animate-pulse rounded" />
        <div className="h-64 bg-gray-200 animate-pulse rounded" />
      </div>
    );
  }

  if (erro || !cooperado) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-red-500">{erro || 'Cooperado não encontrado.'}</p>
        <Link href="/dashboard/cooperados">
          <Button variant="outline"><ArrowLeft className="h-4 w-4 mr-2" />Voltar</Button>
        </Link>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-5xl space-y-6">

      {/* Back */}
      <Link href="/dashboard/cooperados" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-800 transition-colors">
        <ArrowLeft className="h-4 w-4 mr-1" />
        Cooperados
      </Link>

      {/* Header card */}
      <div className="bg-white border rounded-xl px-6 py-5 flex items-start justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{cooperado.nomeCompleto}</h1>
            <Badge className={statusCooperadoColors[cooperado.status]}>
              {statusCooperadoLabel[cooperado.status]}
            </Badge>
          </div>
          <p className="text-sm text-gray-500">
            {cooperado.tipoDocumento ?? 'CPF'}: {cooperado.cpf}
            <span className="mx-2 text-gray-300">•</span>
            {cooperado.email}
            {cooperado.telefone && (
              <><span className="mx-2 text-gray-300">•</span>{cooperado.telefone}</>
            )}
          </p>
          {cooperado.cotaKwhMensal && (
            <p className="text-sm text-green-700 font-medium">
              Cota: {Number(cooperado.cotaKwhMensal).toLocaleString('pt-BR')} kWh/mês
              {cooperado.percentualUsina && (
                <span className="ml-3 text-gray-500">
                  ({Number(cooperado.percentualUsina).toFixed(4)}% da usina)
                </span>
              )}
            </p>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          <Link href={`/dashboard/cooperados/${id}/fatura`}>
            <Button variant="outline" size="sm">
              <FileText className="h-4 w-4 mr-2" />
              Processar Fatura
            </Button>
          </Link>
          <Link href={`/dashboard/cooperados/${id}/editar`}>
            <Button variant="outline" size="sm">
              <Pencil className="h-4 w-4 mr-2" />
              Editar
            </Button>
          </Link>
        </div>
      </div>

      {/* Tabs nav */}
      <div className="flex gap-1 border-b overflow-x-auto">
        {abas.map(({ id: abaId, label, icon: Icon }) => (
          <button
            key={abaId}
            onClick={() => setAba(abaId)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              aba === abaId
                ? 'border-green-600 text-green-700'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
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
              <Campo
                label="Cota kWh/mês"
                value={cooperado.cotaKwhMensal
                  ? `${Number(cooperado.cotaKwhMensal).toLocaleString('pt-BR')} kWh`
                  : null}
              />
              <Campo
                label="% da usina"
                value={cooperado.percentualUsina
                  ? `${Number(cooperado.percentualUsina).toFixed(4)}%`
                  : null}
              />
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
            <Card><CardContent className="py-6"><Skeleton /></CardContent></Card>
          ) : faturas.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-4 py-12">
                <BarChart3 className="h-10 w-10 text-gray-300" />
                <p className="text-gray-500">Nenhuma fatura processada ainda.</p>
                <Link href={`/dashboard/cooperados/${id}/fatura`}>
                  <Button>
                    <FilePlus className="h-4 w-4 mr-2" />
                    Processar primeira fatura
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Última fatura — dados completos */}
              {ultimaFatura && (
                <>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center justify-between">
                        <span>Fatura mais recente</span>
                        <Badge className={
                          ultimaFatura.status === 'APROVADA'
                            ? 'bg-green-100 text-green-800 border-green-200'
                            : ultimaFatura.status === 'REJEITADA'
                            ? 'bg-red-100 text-red-800 border-red-200'
                            : 'bg-yellow-100 text-yellow-800 border-yellow-200'
                        }>
                          {ultimaFatura.status}
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <Campo label="Titular (na fatura)" value={ultimaFatura.dadosExtraidos.titular} />
                      <Campo label="Documento" value={`${ultimaFatura.dadosExtraidos.tipoDocumento}: ${ultimaFatura.dadosExtraidos.documento}`} />
                      <Campo label="Mês referência" value={ultimaFatura.dadosExtraidos.mesReferencia} />
                      <Campo
                        label="Endereço instalação"
                        value={[
                          ultimaFatura.dadosExtraidos.enderecoInstalacao,
                          ultimaFatura.dadosExtraidos.cidade,
                          ultimaFatura.dadosExtraidos.estado,
                        ].filter(Boolean).join(', ')}
                      />
                      <Campo label="UC" value={ultimaFatura.dadosExtraidos.numeroUC} />
                      <Campo label="Distribuidora" value={ultimaFatura.dadosExtraidos.distribuidora} />
                      <Campo label="Classificação" value={ultimaFatura.dadosExtraidos.classificacao} />
                      <Campo
                        label="Consumo atual (kWh)"
                        value={Number(ultimaFatura.dadosExtraidos.consumoAtualKwh).toLocaleString('pt-BR')}
                      />
                      <Campo
                        label="Total a pagar"
                        value={formatBRL(ultimaFatura.dadosExtraidos.totalAPagar)}
                      />
                      <Campo
                        label="Média calculada (kWh/mês)"
                        value={`${Number(ultimaFatura.mediaKwhCalculada).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} kWh`}
                      />
                      <Campo label="Meses utilizados" value={ultimaFatura.mesesUtilizados} />
                      <Campo label="Meses descartados" value={ultimaFatura.mesesDescartados} />
                    </CardContent>
                  </Card>

                  {/* Histórico de consumo */}
                  {ultimaFatura.dadosExtraidos.historicoConsumo?.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Histórico de Consumo da Fatura</CardTitle>
                      </CardHeader>
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
                            {ultimaFatura.dadosExtraidos.historicoConsumo.map((h) => (
                              <tr key={h.mesAno} className="border-b last:border-0 hover:bg-gray-50">
                                <td className="px-4 py-2 text-gray-800">{h.mesAno}</td>
                                <td className="px-4 py-2 text-right text-gray-800">{Number(h.consumoKwh).toLocaleString('pt-BR')}</td>
                                <td className="px-4 py-2 text-right text-gray-800">{formatBRL(h.valorRS)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </CardContent>
                    </Card>
                  )}
                </>
              )}

              {/* Histórico de todas as faturas */}
              {faturas.length > 1 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Todas as Faturas Processadas</CardTitle>
                  </CardHeader>
                  <CardContent className="overflow-x-auto p-0">
                    <table className="w-full text-sm">
                      <thead className="border-b bg-gray-50">
                        <tr>
                          <th className="text-left px-4 py-2 text-xs text-gray-500 font-medium">Processada em</th>
                          <th className="text-right px-4 py-2 text-xs text-gray-500 font-medium">Consumo médio (kWh)</th>
                          <th className="text-right px-4 py-2 text-xs text-gray-500 font-medium">Meses usados</th>
                          <th className="text-center px-4 py-2 text-xs text-gray-500 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {faturas.map((f) => (
                          <tr key={f.id} className="border-b last:border-0 hover:bg-gray-50">
                            <td className="px-4 py-2 text-gray-800">
                              {new Date(f.createdAt).toLocaleDateString('pt-BR')}
                            </td>
                            <td className="px-4 py-2 text-right text-gray-800">
                              {Number(f.mediaKwhCalculada).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                            </td>
                            <td className="px-4 py-2 text-right text-gray-800">{f.mesesUtilizados}</td>
                            <td className="px-4 py-2 text-center">
                              <Badge className={
                                f.status === 'APROVADA'
                                  ? 'bg-green-100 text-green-800 border-green-200'
                                  : f.status === 'REJEITADA'
                                  ? 'bg-red-100 text-red-800 border-red-200'
                                  : 'bg-yellow-100 text-yellow-800 border-yellow-200'
                              }>
                                {f.status}
                              </Badge>
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
          {!contrato ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-12">
                <Building2 className="h-10 w-10 text-gray-300" />
                <p className="text-gray-500">Sem contrato ativo.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center justify-between">
                    <span>Contrato {contrato.numero}</span>
                    <Badge className={statusContratoColors[contrato.status]}>
                      {contrato.status}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                  <Campo label="Número" value={contrato.numero} />
                  <Campo label="Status" value={contrato.status} />
                  <Campo label="Desconto contratado" value={`${Number(contrato.percentualDesconto).toFixed(2)}%`} />
                  <Campo label="Data de adesão" value={new Date(contrato.dataInicio).toLocaleDateString('pt-BR')} />
                  <Campo
                    label="Data de encerramento"
                    value={contrato.dataFim ? new Date(contrato.dataFim).toLocaleDateString('pt-BR') : 'Indeterminado'}
                  />
                </CardContent>
              </Card>

              {contrato.plano && (
                <Card>
                  <CardHeader><CardTitle className="text-base">Plano</CardTitle></CardHeader>
                  <CardContent className="grid grid-cols-2 gap-4">
                    <Campo label="Nome" value={contrato.plano.nome} />
                    <Campo label="Modelo de cobrança" value={modeloCobrancaLabel[contrato.plano.modeloCobranca] ?? contrato.plano.modeloCobranca} />
                    <Campo label="Desconto base" value={`${Number(contrato.plano.descontoBase).toFixed(2)}%`} />
                  </CardContent>
                </Card>
              )}

              {contrato.uc && (
                <Card>
                  <CardHeader><CardTitle className="text-base flex items-center gap-2"><Zap className="h-4 w-4" />UC Vinculada</CardTitle></CardHeader>
                  <CardContent className="grid grid-cols-2 gap-4">
                    <Campo label="Número UC" value={contrato.uc.numero} />
                    <Campo label="Distribuidora" value={contrato.uc.distribuidora} />
                    <Campo label="Endereço" value={`${contrato.uc.endereco}, ${contrato.uc.cidade}/${contrato.uc.estado}`} />
                  </CardContent>
                </Card>
              )}

              {contrato.usina && (
                <Card>
                  <CardHeader><CardTitle className="text-base">Usina</CardTitle></CardHeader>
                  <CardContent className="grid grid-cols-2 gap-4">
                    <Campo label="Nome" value={contrato.usina.nome} />
                    <Campo label="Potência (kWp)" value={`${Number(contrato.usina.potenciaKwp).toLocaleString('pt-BR')} kWp`} />
                    <Campo label="Localização" value={`${contrato.usina.cidade}/${contrato.usina.estado}`} />
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Aba 4: Cobranças ── */}
      {aba === 'cobrancas' && (
        <Card>
          <CardContent className="p-0">
            {cobrancas.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12">
                <CreditCard className="h-10 w-10 text-gray-300" />
                <p className="text-gray-500">Nenhuma cobrança gerada ainda.</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Mês/Ano</th>
                    <th className="text-right px-4 py-3 text-xs text-gray-500 font-medium">Valor Bruto</th>
                    <th className="text-right px-4 py-3 text-xs text-gray-500 font-medium">Desconto</th>
                    <th className="text-right px-4 py-3 text-xs text-gray-500 font-medium">Valor Líquido</th>
                    <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Vencimento</th>
                    <th className="text-center px-4 py-3 text-xs text-gray-500 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {cobrancas.map((c) => (
                    <tr key={c.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-800">
                        {String(c.mesReferencia).padStart(2, '0')}/{c.anoReferencia}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-800">{formatBRL(c.valorBruto)}</td>
                      <td className="px-4 py-3 text-right text-green-700">{formatBRL(c.valorDesconto)}</td>
                      <td className="px-4 py-3 text-right font-medium text-gray-800">{formatBRL(c.valorLiquido)}</td>
                      <td className="px-4 py-3 text-gray-800">
                        {new Date(c.dataVencimento).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge className={statusCobColors[c.status]}>
                          {statusCobLabel[c.status] ?? c.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Aba 5: Documentos ── */}
      {aba === 'documentos' && (
        <div className="space-y-3">
          {docMensagem && (
            <p className={`text-sm ${docMensagem.startsWith('Erro') ? 'text-red-500' : 'text-green-700'}`}>
              {docMensagem}
            </p>
          )}

          {/* Formulário de reprovação */}
          {reprovarId && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="pt-4 space-y-3">
                <p className="text-sm font-medium text-red-800">Informe o motivo da reprovação:</p>
                <textarea
                  className="w-full border border-red-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 bg-white"
                  rows={2}
                  placeholder="Motivo obrigatório..."
                  value={motivoRejeicao}
                  onChange={(e) => setMotivoRejeicao(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button size="sm" variant="destructive" onClick={reprovarDoc} disabled={!motivoRejeicao.trim() || !!docAcao}>
                    <FileX className="h-4 w-4 mr-2" />
                    Confirmar reprovação
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setReprovarId(null); setMotivoRejeicao(''); }}>
                    Cancelar
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {cooperado.documentos.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-12">
                <FileText className="h-10 w-10 text-gray-300" />
                <p className="text-gray-500">Nenhum documento enviado.</p>
              </CardContent>
            </Card>
          ) : (
            cooperado.documentos.map((doc) => (
              <Card key={doc.id}>
                <CardContent className="pt-4 flex items-start justify-between gap-4">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-800">
                        {tipoDocLabel[doc.tipo] ?? doc.tipo}
                      </span>
                      <Badge className={statusDocColors[doc.status]}>{doc.status}</Badge>
                    </div>
                    {doc.nomeArquivo && (
                      <p className="text-xs text-gray-500">{doc.nomeArquivo}</p>
                    )}
                    <p className="text-xs text-gray-400">
                      Enviado em {new Date(doc.createdAt).toLocaleDateString('pt-BR')}
                    </p>
                    {doc.motivoRejeicao && (
                      <p className="text-xs text-red-600">Motivo: {doc.motivoRejeicao}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <a href={doc.url} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="sm">Ver</Button>
                    </a>
                    {doc.status === 'PENDENTE' && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-green-700 border-green-300 hover:bg-green-50"
                          onClick={() => aprovarDoc(doc.id)}
                          disabled={docAcao === doc.id}
                        >
                          <FileCheck className="h-4 w-4 mr-1" />
                          Aprovar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 border-red-300 hover:bg-red-50"
                          onClick={() => { setReprovarId(doc.id); setMotivoRejeicao(''); setDocMensagem(''); }}
                          disabled={docAcao === doc.id}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Reprovar
                        </Button>
                      </>
                    )}
                    {doc.status === 'APROVADO' && (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    )}
                    {doc.status === 'REPROVADO' && (
                      <XCircle className="h-5 w-5 text-red-500" />
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* ── Aba 6: Ocorrências ── */}
      {aba === 'ocorrencias' && (
        <div className="space-y-3">
          {cooperado.ocorrencias.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-12">
                <AlertTriangle className="h-10 w-10 text-gray-300" />
                <p className="text-gray-500">Nenhuma ocorrência registrada.</p>
              </CardContent>
            </Card>
          ) : (
            cooperado.ocorrencias.map((o) => (
              <Card key={o.id}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-800">
                          {tipoOcorrenciaLabel[o.tipo] ?? o.tipo}
                        </span>
                        <Badge className={
                          o.prioridade === 'CRITICA' ? 'bg-red-100 text-red-800 border-red-200'
                          : o.prioridade === 'ALTA' ? 'bg-orange-100 text-orange-800 border-orange-200'
                          : o.prioridade === 'MEDIA' ? 'bg-yellow-100 text-yellow-800 border-yellow-200'
                          : 'bg-gray-100 text-gray-800 border-gray-200'
                        }>
                          {o.prioridade}
                        </Badge>
                        <Badge className={
                          o.status === 'RESOLVIDA' ? 'bg-green-100 text-green-800 border-green-200'
                          : o.status === 'EM_ANDAMENTO' ? 'bg-blue-100 text-blue-800 border-blue-200'
                          : o.status === 'CANCELADA' ? 'bg-gray-100 text-gray-800 border-gray-200'
                          : 'bg-yellow-100 text-yellow-800 border-yellow-200'
                        }>
                          {o.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600">{o.descricao}</p>
                      <p className="text-xs text-gray-400">
                        {new Date(o.createdAt).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

    </div>
  );
}
