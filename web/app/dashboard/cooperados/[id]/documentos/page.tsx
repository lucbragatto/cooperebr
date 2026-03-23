'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import type { Cooperado } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle,
  Clock,
  Download,
  FileText,
  Upload,
  X,
  XCircle,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

type TipoDocumento =
  | 'RG_FRENTE'
  | 'RG_VERSO'
  | 'CNH_FRENTE'
  | 'CNH_VERSO'
  | 'CONTRATO_SOCIAL';

type StatusDocumento = 'PENDENTE' | 'APROVADO' | 'REPROVADO';

interface DocumentoSalvo {
  id: string;
  tipo: TipoDocumento;
  url: string;
  nomeArquivo: string | null;
  status: StatusDocumento;
  motivoRejeicao: string | null;
}

interface DocConfig {
  tipo: TipoDocumento;
  titulo: string;
  obrigatorioCpf: boolean;
  obrigatorioJuridico: boolean;
}

interface CardState {
  // Estado do arquivo local selecionado
  arquivo: File | null;
  preview: string | null;
  enviando: boolean;
  erroEnvio: string;
  // Estado da ação de aprovação/reprovação
  processando: boolean;
  erroAcao: string;
  // Input de reprovação
  reprovandoInput: boolean;
  motivoInput: string;
}

// ─── Constantes ──────────────────────────────────────────────────────────────

const DOCS: DocConfig[] = [
  { tipo: 'RG_FRENTE', titulo: 'RG — Frente', obrigatorioCpf: true, obrigatorioJuridico: false },
  { tipo: 'RG_VERSO', titulo: 'RG — Verso', obrigatorioCpf: true, obrigatorioJuridico: false },
  { tipo: 'CNH_FRENTE', titulo: 'CNH — Frente', obrigatorioCpf: true, obrigatorioJuridico: false },
  { tipo: 'CNH_VERSO', titulo: 'CNH — Verso', obrigatorioCpf: true, obrigatorioJuridico: false },
  {
    tipo: 'CONTRATO_SOCIAL',
    titulo: 'Contrato Social',
    obrigatorioCpf: false,
    obrigatorioJuridico: true,
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isCnpj(doc: string): boolean {
  return doc.replace(/\D/g, '').length === 14;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function initialCardState(): CardState {
  return {
    arquivo: null,
    preview: null,
    enviando: false,
    erroEnvio: '',
    processando: false,
    erroAcao: '',
    reprovandoInput: false,
    motivoInput: '',
  };
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: StatusDocumento }) {
  if (status === 'APROVADO')
    return (
      <span className="flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
        <CheckCircle className="h-3 w-3" />
        Aprovado
      </span>
    );
  if (status === 'REPROVADO')
    return (
      <span className="flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
        <XCircle className="h-3 w-3" />
        Reprovado
      </span>
    );
  return (
    <span className="flex items-center gap-1 text-xs font-medium text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-full px-2 py-0.5">
      <Clock className="h-3 w-3" />
      Pendente
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DocumentosCooperadoPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [cooperado, setCooperado] = useState<Cooperado | null>(null);
  const [salvos, setSalvos] = useState<Record<TipoDocumento, DocumentoSalvo | null>>(
    () => Object.fromEntries(DOCS.map((d) => [d.tipo, null])) as Record<TipoDocumento, DocumentoSalvo | null>,
  );
  const [cards, setCards] = useState<Record<TipoDocumento, CardState>>(
    () => Object.fromEntries(DOCS.map((d) => [d.tipo, initialCardState()])) as Record<TipoDocumento, CardState>,
  );
  const [erroPage, setErroPage] = useState('');
  const [carregando, setCarregando] = useState(true);

  const fileRefs = useRef<Partial<Record<TipoDocumento, HTMLInputElement | null>>>({});

  // ── Carregar dados ──────────────────────────────────────────────────────────

  useEffect(() => {
    Promise.all([
      api.get<Cooperado>(`/cooperados/${id}`),
      api.get<DocumentoSalvo[]>(`/documentos/cooperado/${id}`),
    ])
      .then(([coop, docs]) => {
        setCooperado(coop.data);
        const mapa = Object.fromEntries(
          DOCS.map((d) => [d.tipo, null]),
        ) as Record<TipoDocumento, DocumentoSalvo | null>;
        for (const doc of docs.data) {
          mapa[doc.tipo] = doc;
        }
        setSalvos(mapa);
      })
      .catch(() => setErroPage('Erro ao carregar dados.'))
      .finally(() => setCarregando(false));
  }, [id]);

  // ── Helpers de estado ───────────────────────────────────────────────────────

  function patchCard(tipo: TipoDocumento, patch: Partial<CardState>) {
    setCards((prev) => ({ ...prev, [tipo]: { ...prev[tipo], ...patch } }));
  }

  function patchSalvo(tipo: TipoDocumento, patch: Partial<DocumentoSalvo>) {
    setSalvos((prev) => ({ ...prev, [tipo]: { ...prev[tipo], ...patch } as DocumentoSalvo }));
  }

  // ── Selecionar arquivo ──────────────────────────────────────────────────────

  function onFileChange(tipo: TipoDocumento, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (ev) =>
        patchCard(tipo, { arquivo: file, preview: ev.target?.result as string, erroEnvio: '' });
      reader.readAsDataURL(file);
    } else {
      patchCard(tipo, { arquivo: file, preview: null, erroEnvio: '' });
    }
  }

  function limparSelecao(tipo: TipoDocumento) {
    patchCard(tipo, { arquivo: null, preview: null, erroEnvio: '' });
    const ref = fileRefs.current[tipo];
    if (ref) ref.value = '';
  }

  // ── Enviar arquivo ──────────────────────────────────────────────────────────

  async function enviar(tipo: TipoDocumento) {
    const card = cards[tipo];
    if (!card.arquivo) return;
    patchCard(tipo, { enviando: true, erroEnvio: '' });
    try {
      const formData = new FormData();
      formData.append('arquivo', card.arquivo);
      formData.append('tipo', tipo);
      const { data } = await api.post<DocumentoSalvo>(
        `/documentos/upload/${id}`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      setSalvos((prev) => ({
        ...prev,
        [tipo]: {
          id: data.id,
          tipo: data.tipo,
          url: data.url,
          nomeArquivo: data.nomeArquivo ?? card.arquivo!.name,
          status: (data.status ?? 'PENDENTE') as StatusDocumento,
          motivoRejeicao: null,
        },
      }));
      patchCard(tipo, { arquivo: null, preview: null, enviando: false });
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      patchCard(tipo, {
        enviando: false,
        erroEnvio: err.response?.data?.message ?? 'Erro ao enviar. Tente novamente.',
      });
    }
  }

  // ── Aprovar ─────────────────────────────────────────────────────────────────

  async function aprovar(tipo: TipoDocumento) {
    const doc = salvos[tipo];
    if (!doc) return;
    patchCard(tipo, { processando: true, erroAcao: '' });
    try {
      await api.patch(`/documentos/${doc.id}/aprovar`);
      patchSalvo(tipo, { status: 'APROVADO', motivoRejeicao: null });
    } catch {
      patchCard(tipo, { erroAcao: 'Erro ao aprovar.' });
    } finally {
      patchCard(tipo, { processando: false });
    }
  }

  // ── Reprovar ────────────────────────────────────────────────────────────────

  function iniciarReprovacao(tipo: TipoDocumento) {
    patchCard(tipo, { reprovandoInput: true, motivoInput: '', erroAcao: '' });
  }

  function cancelarReprovacao(tipo: TipoDocumento) {
    patchCard(tipo, { reprovandoInput: false, motivoInput: '' });
  }

  async function confirmarReprovacao(tipo: TipoDocumento) {
    const doc = salvos[tipo];
    const card = cards[tipo];
    if (!doc || !card.motivoInput.trim()) return;
    patchCard(tipo, { processando: true, erroAcao: '' });
    try {
      await api.patch(`/documentos/${doc.id}/reprovar`, {
        motivoRejeicao: card.motivoInput.trim(),
      });
      patchSalvo(tipo, { status: 'REPROVADO', motivoRejeicao: card.motivoInput.trim() });
      patchCard(tipo, { reprovandoInput: false, motivoInput: '' });
    } catch {
      patchCard(tipo, { erroAcao: 'Erro ao reprovar.' });
    } finally {
      patchCard(tipo, { processando: false });
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const isJuridico = cooperado ? isCnpj(cooperado.cpf) : false;

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/dashboard/cooperados/${id}`)}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        <h2 className="text-2xl font-bold text-gray-800">
          Documentos{cooperado ? ` — ${cooperado.nomeCompleto}` : ''}
        </h2>
      </div>

      {erroPage && <p className="text-red-500 mb-4 text-sm">{erroPage}</p>}
      {carregando && <p className="text-gray-500 text-sm">Carregando...</p>}

      {!carregando && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {DOCS.map((doc) => {
            const card = cards[doc.tipo];
            const salvo = salvos[doc.tipo];
            const obrigatorio = isJuridico ? doc.obrigatorioJuridico : doc.obrigatorioCpf;
            const temArquivoSelecionado = card.arquivo !== null;

            return (
              <Card key={doc.tipo} className="flex flex-col">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-start justify-between gap-2 text-base">
                    <span className="flex items-center gap-2">
                      <FileText className="h-4 w-4 shrink-0 text-gray-500" />
                      {doc.titulo}
                    </span>
                    {obrigatorio && (
                      <Badge variant="secondary" className="text-xs shrink-0">
                        Obrigatório
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>

                <CardContent className="flex flex-col gap-3 flex-1">
                  {/* ── Status salvo no banco ── */}
                  {salvo ? (
                    <div className="flex items-center justify-between gap-2">
                      <StatusBadge status={salvo.status} />
                      <a
                        href={salvo.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                      >
                        <Download className="h-3 w-3" />
                        Download
                      </a>
                    </div>
                  ) : (
                    !temArquivoSelecionado && (
                      <span className="text-sm text-gray-400">Não enviado</span>
                    )
                  )}

                  {/* ── Motivo de rejeição ── */}
                  {salvo?.status === 'REPROVADO' && salvo.motivoRejeicao && (
                    <div className="flex items-start gap-1.5 text-xs text-red-600 bg-red-50 border border-red-100 rounded p-2">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      <span>{salvo.motivoRejeicao}</span>
                    </div>
                  )}

                  {/* ── Preview arquivo selecionado ── */}
                  {temArquivoSelecionado && card.preview && (
                    <div className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={card.preview}
                        alt="Preview"
                        className="w-full h-32 object-cover rounded-md border border-gray-200"
                      />
                      <button
                        onClick={() => limparSelecao(doc.tipo)}
                        className="absolute top-1 right-1 bg-white rounded-full p-0.5 shadow text-gray-500 hover:text-red-500"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}

                  {temArquivoSelecionado && !card.preview && card.arquivo && (
                    <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-md border border-gray-200">
                      <FileText className="h-5 w-5 text-red-500 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-gray-800 truncate">
                          {card.arquivo.name}
                        </p>
                        <p className="text-xs text-gray-500">{formatBytes(card.arquivo.size)}</p>
                      </div>
                      <button
                        onClick={() => limparSelecao(doc.tipo)}
                        className="text-gray-400 hover:text-red-500"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}

                  {/* ── Erros ── */}
                  {card.erroEnvio && (
                    <p className="text-xs text-red-500">{card.erroEnvio}</p>
                  )}
                  {card.erroAcao && (
                    <p className="text-xs text-red-500">{card.erroAcao}</p>
                  )}

                  {/* ── Input de reprovação ── */}
                  {card.reprovandoInput && (
                    <div className="flex flex-col gap-2">
                      <textarea
                        className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-red-400"
                        rows={2}
                        placeholder="Motivo da reprovação..."
                        value={card.motivoInput}
                        onChange={(e) => patchCard(doc.tipo, { motivoInput: e.target.value })}
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="destructive"
                          className="flex-1 text-xs"
                          onClick={() => confirmarReprovacao(doc.tipo)}
                          disabled={card.processando || !card.motivoInput.trim()}
                        >
                          {card.processando ? 'Salvando...' : 'Confirmar'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 text-xs"
                          onClick={() => cancelarReprovacao(doc.tipo)}
                          disabled={card.processando}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* ── Hidden file input ── */}
                  <input
                    ref={(el) => {
                      fileRefs.current[doc.tipo] = el;
                    }}
                    type="file"
                    accept="image/jpeg,image/png,application/pdf"
                    onChange={(e) => onFileChange(doc.tipo, e)}
                    className="hidden"
                  />

                  {/* ── Botões de ação ── */}
                  <div className="mt-auto flex flex-col gap-2">
                    {/* Sem arquivo selecionado e sem reprovando */}
                    {!temArquivoSelecionado && !card.reprovandoInput && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => fileRefs.current[doc.tipo]?.click()}
                      >
                        <Upload className="h-3.5 w-3.5 mr-1.5" />
                        {salvo ? 'Substituir' : 'Selecionar arquivo'}
                      </Button>
                    )}

                    {/* Arquivo selecionado */}
                    {temArquivoSelecionado && (
                      <Button
                        size="sm"
                        className="w-full"
                        onClick={() => enviar(doc.tipo)}
                        disabled={card.enviando}
                      >
                        {card.enviando ? 'Enviando...' : 'Enviar'}
                      </Button>
                    )}

                    {/* Aprovar / Reprovar — somente quando salvo e PENDENTE */}
                    {salvo?.status === 'PENDENTE' &&
                      !temArquivoSelecionado &&
                      !card.reprovandoInput && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 text-green-700 border-green-300 hover:bg-green-50 text-xs"
                            onClick={() => aprovar(doc.tipo)}
                            disabled={card.processando}
                          >
                            <CheckCircle className="h-3.5 w-3.5 mr-1" />
                            Aprovar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 text-red-700 border-red-300 hover:bg-red-50 text-xs"
                            onClick={() => iniciarReprovacao(doc.tipo)}
                            disabled={card.processando}
                          >
                            <XCircle className="h-3.5 w-3.5 mr-1" />
                            Reprovar
                          </Button>
                        </div>
                      )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
