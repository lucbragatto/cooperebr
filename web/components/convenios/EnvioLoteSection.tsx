'use client';

/**
 * Sprint Convite-Lote LOTE.4 (07/06/2026) — Componente reusável de envio em lote.
 *
 * Tela "Convidar em lote": upload/colar CSV → prévia com 5 estados → seleção
 * com checkbox → POST lote/enviar (202) → polling do GET status com progress.
 *
 * Reusado entre admin (página do convênio) e portal empresa (/conveniada/...).
 * Discrimina endpoint via prop `source` (mesmo padrão de GestaoConvitesSection).
 *
 * Fluxo de UI em 4 steps:
 *  1. upload    — textarea (colar) OU input file (.csv/.txt via FileReader)
 *  2. previa    — tabela checkbox + 5 cards de resumo + "marcar todos PRONTO"
 *  3. enviando  — progress bar pollando status a cada 1.5s
 *  4. concluido — resumo final + botão fechar (dispara onAcaoConcluida)
 *
 * HELP regra 19/05: HelpBox azul explicando formato + ritmo + LGPD.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import api from '@/lib/api';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileUp,
  Loader2,
  MessageCircle,
  Send,
  Upload,
  Users,
  XCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { HelpBox } from '@/components/ui/help-box';

export type ConviteLoteSource = 'admin' | 'empresa';

type PreviaStatus =
  | 'PRONTO'
  | 'DUPLICATA_CSV'
  | 'JA_MEMBRO'
  | 'JA_CONVIDADO'
  | 'INVALIDO';

interface PreviaLinha {
  linha: number;
  nome: string;
  telefone: string;
  telefoneFmt: string | null;
  status: PreviaStatus;
  motivo?: string;
}

interface PreviaResponse {
  resumo: {
    total: number;
    pronto: number;
    duplicataCsv: number;
    jaMembro: number;
    jaConvidado: number;
    invalido: number;
  };
  linhas: PreviaLinha[];
}

interface EnvioResponse {
  loteId: string;
  total: number;
}

type EnvioStatusItem = {
  conviteId: string;
  nomeConvidado: string;
  telefoneSufixo: string;
  statusEnvio: 'PENDENTE' | 'ENVIADO' | 'FALHOU';
  enviadoEm: string | null;
  erro: string | null;
};

interface StatusResponse {
  loteId: string;
  convenioId: string;
  resumo: { total: number; pendente: number; enviado: number; falhou: number };
  itens: EnvioStatusItem[];
}

const STATUS_PREVIA: Record<
  PreviaStatus,
  { label: string; cor: string }
> = {
  PRONTO: {
    label: 'Pronto p/ enviar',
    cor: 'bg-emerald-50 text-emerald-700 border-emerald-300',
  },
  DUPLICATA_CSV: {
    label: 'Duplicada no arquivo',
    cor: 'bg-slate-100 text-slate-600 border-slate-300',
  },
  JA_MEMBRO: {
    label: 'Já é funcionária',
    cor: 'bg-blue-50 text-blue-700 border-blue-300',
  },
  JA_CONVIDADO: {
    label: 'Já tem convite ativo',
    cor: 'bg-amber-50 text-amber-700 border-amber-300',
  },
  INVALIDO: {
    label: 'Inválido',
    cor: 'bg-red-50 text-red-700 border-red-300',
  },
};

const STATUS_ENVIO: Record<
  EnvioStatusItem['statusEnvio'],
  { label: string; cor: string; Icon: typeof Loader2 }
> = {
  PENDENTE: {
    label: 'Na fila',
    cor: 'bg-slate-100 text-slate-700 border-slate-300',
    Icon: Clock,
  },
  ENVIADO: {
    label: 'Enviado',
    cor: 'bg-emerald-50 text-emerald-700 border-emerald-300',
    Icon: CheckCircle2,
  },
  FALHOU: {
    label: 'Falhou',
    cor: 'bg-red-50 text-red-700 border-red-300',
    Icon: XCircle,
  },
};

interface EnvioLoteSectionProps {
  convenioId: string;
  source: ConviteLoteSource;
  /** Callback quando o lote termina (pra parent recarregar a lista de convites). */
  onAcaoConcluida?: () => void;
}

export function EnvioLoteSection({
  convenioId,
  source,
  onAcaoConcluida,
}: EnvioLoteSectionProps) {
  const [step, setStep] = useState<
    'upload' | 'previa' | 'enviando' | 'concluido'
  >('upload');
  const [csv, setCsv] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [previa, setPrevia] = useState<PreviaResponse | null>(null);
  const [selecionados, setSelecionados] = useState<Set<number>>(new Set());
  const [loteId, setLoteId] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  // Endpoint base por source
  const endpointBase =
    source === 'admin'
      ? `/convenios/${convenioId}/convites/lote`
      : `/portal/meus-convenios/${convenioId}/convites/lote`;

  // Cleanup do poll quando desmontar
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const handleArquivoUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const texto = String(e.target?.result ?? '');
      setCsv(texto);
    };
    reader.onerror = () => setErro('Não foi possível ler o arquivo.');
    reader.readAsText(file);
  };

  const pedirPrevia = useCallback(async () => {
    setErro('');
    setCarregando(true);
    try {
      const r = await api.post<PreviaResponse>(`${endpointBase}/preview`, {
        csv,
      });
      setPrevia(r.data);
      // Marca todos PRONTO por padrão
      const idsPronto = new Set<number>(
        r.data.linhas
          .filter((l) => l.status === 'PRONTO')
          .map((l) => l.linha),
      );
      setSelecionados(idsPronto);
      setStep('previa');
    } catch (err) {
      const e = err as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      setErro(
        e?.response?.data?.message ?? e?.message ?? 'Erro ao gerar prévia',
      );
    } finally {
      setCarregando(false);
    }
  }, [csv, endpointBase]);

  const enviarLote = useCallback(async () => {
    if (!previa) return;
    const destinatarios = previa.linhas
      .filter(
        (l) =>
          l.status === 'PRONTO' &&
          selecionados.has(l.linha) &&
          l.telefoneFmt !== null,
      )
      .map((l) => ({ nome: l.nome, telefone: l.telefoneFmt as string }));
    if (destinatarios.length === 0) {
      setErro('Selecione ao menos 1 destinatário pronto pra enviar.');
      return;
    }
    setErro('');
    setCarregando(true);
    try {
      const r = await api.post<EnvioResponse>(`${endpointBase}/enviar`, {
        destinatarios,
      });
      setLoteId(r.data.loteId);
      setStep('enviando');
      // Inicia poll a cada 1.5s
      const tick = async () => {
        try {
          const s = await api.get<StatusResponse>(
            `${endpointBase}/${r.data.loteId}/status`,
          );
          setStatus(s.data);
          if (s.data.resumo.pendente === 0) {
            if (pollRef.current) clearInterval(pollRef.current);
            pollRef.current = null;
            setStep('concluido');
          }
        } catch {
          // erros transitórios — segue tentando
        }
      };
      // primeiro tick imediato + interval
      tick();
      pollRef.current = setInterval(tick, 1500);
    } catch (err) {
      const e = err as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      setErro(e?.response?.data?.message ?? e?.message ?? 'Erro ao enviar lote');
    } finally {
      setCarregando(false);
    }
  }, [endpointBase, previa, selecionados]);

  const resetar = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    setStep('upload');
    setCsv('');
    setPrevia(null);
    setSelecionados(new Set());
    setLoteId(null);
    setStatus(null);
    setErro('');
  };

  const concluir = () => {
    resetar();
    onAcaoConcluida?.();
  };

  // LOTE.5 — Modo B "Abrir no WhatsApp": cria 1 convite individual e abre wa.me
  // no app pessoal do remetente. Modo A (automático via API Meta) segue intacto.
  const [linhaAbrindoWa, setLinhaAbrindoWa] = useState<number | null>(null);
  const [erroLinha, setErroLinha] = useState<{ linha: number; msg: string } | null>(null);

  const abrirWhatsappManual = useCallback(
    async (linha: PreviaLinha) => {
      if (linha.status !== 'PRONTO' || !linha.telefoneFmt) return;
      setLinhaAbrindoWa(linha.linha);
      setErroLinha(null);
      try {
        const r = await api.post<{
          id: string;
          urlWa: string;
          mensagem: string;
          reused: boolean;
        }>(`${endpointBase.replace('/lote', '')}/modo-b`, {
          nomeConvidado: linha.nome,
          telefone: linha.telefoneFmt,
        });
        // window.open com noopener — Meta abre app/web do WA do usuário com texto preenchido
        window.open(r.data.urlWa, '_blank', 'noopener,noreferrer');
      } catch (err) {
        const e = err as {
          response?: { data?: { message?: string } };
          message?: string;
        };
        setErroLinha({
          linha: linha.linha,
          msg:
            e?.response?.data?.message ??
            e?.message ??
            'Erro ao gerar convite individual.',
        });
      } finally {
        setLinhaAbrindoWa(null);
      }
    },
    [endpointBase],
  );

  const toggleLinha = (linha: number) => {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(linha)) next.delete(linha);
      else next.add(linha);
      return next;
    });
  };

  const toggleTodosPronto = () => {
    if (!previa) return;
    const idsPronto = previa.linhas
      .filter((l) => l.status === 'PRONTO')
      .map((l) => l.linha);
    if (idsPronto.every((id) => selecionados.has(id))) {
      // desmarca todos PRONTO
      setSelecionados((prev) => {
        const next = new Set(prev);
        idsPronto.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      // marca todos PRONTO
      setSelecionados((prev) => {
        const next = new Set(prev);
        idsPronto.forEach((id) => next.add(id));
        return next;
      });
    }
  };

  // ──────────────────────────────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────────────────────────────

  const podeEnviarN =
    previa?.linhas.filter(
      (l) => l.status === 'PRONTO' && selecionados.has(l.linha),
    ).length ?? 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base text-orange-700 flex items-center gap-2">
          <FileUp className="h-4 w-4" /> Convidar em lote — várias pessoas de uma vez
        </CardTitle>
        <p className="text-xs text-slate-500">
          Suba uma planilha ou cole a lista. O sistema envia o link de cadastro
          por WhatsApp pra cada um, com ritmo controlado.
        </p>
      </CardHeader>
      <CardContent>
        <HelpBox id={`convite-lote-${source}-help`} titulo="Como funciona">
          <strong>Formato da planilha:</strong> uma linha por funcionário,{' '}
          <code>Nome, Telefone</code> (vírgula, ponto-e-vírgula ou tab também
          funcionam). Pode colar direto do Excel.
          <br />
          <strong>Prévia:</strong> antes de enviar, o sistema mostra cada linha
          classificada: <em>Pronto</em> · <em>Duplicada no arquivo</em> ·{' '}
          <em>Já é funcionária</em> · <em>Já tem convite ativo</em> ·{' '}
          <em>Inválido</em>. Você marca quais quer enviar.
          <br />
          <strong>2 modos de envio:</strong>
          <br />
          • <strong>Automático (em lote):</strong> selecione vários e clique
          "Enviar X convites" — o sistema dispara os WhatsApps com ~2s entre cada
          (anti-spam Meta). Status aparece em tempo real.
          <br />
          • <strong>Manual (1 a 1):</strong> clique no botão verde{' '}
          <MessageCircle className="inline h-3 w-3" /> ao lado da linha → abre o
          SEU WhatsApp com a mensagem pronta. Você revisa e envia. Útil pra
          toque pessoal ou se o automático estiver fora do ar.
          <br />
          <strong>Privacidade:</strong> os telefones aparecem com os últimos 4
          dígitos no painel de status (LGPD).
        </HelpBox>

        {erro && (
          <div className="mt-3 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <div>{erro}</div>
          </div>
        )}

        {step === 'upload' && (
          <div className="mt-3 space-y-3">
            <div>
              <label
                htmlFor="csv-textarea"
                className="text-xs font-medium text-slate-600"
              >
                Cole a lista aqui (uma pessoa por linha):
              </label>
              <textarea
                id="csv-textarea"
                value={csv}
                onChange={(e) => setCsv(e.target.value)}
                placeholder={
                  'Dra. Ana, 27 99999-0001\nDr. Bruno, 27 99999-0002\nDra. Carla, 27 99999-0003'
                }
                className="mt-1 w-full min-h-[140px] rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>ou</span>
              <label className="inline-flex items-center gap-1 text-orange-700 hover:text-orange-900 cursor-pointer">
                <Upload className="h-3 w-3" />
                <span className="underline">subir arquivo CSV/TXT</span>
                <input
                  type="file"
                  accept=".csv,.txt"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleArquivoUpload(file);
                  }}
                />
              </label>
            </div>
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={pedirPrevia}
                disabled={!csv.trim() || carregando}
                className="inline-flex items-center gap-2 rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50"
              >
                {carregando ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileUp className="h-4 w-4" />
                )}
                Pré-visualizar
              </button>
            </div>
          </div>
        )}

        {step === 'previa' && previa && (
          <div className="mt-3 space-y-3">
            {/* 5 cards de resumo */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {[
                { lbl: 'Total', n: previa.resumo.total, cor: 'bg-slate-100 text-slate-700' },
                { lbl: 'Pronto', n: previa.resumo.pronto, cor: 'bg-emerald-50 text-emerald-700' },
                { lbl: 'Duplicada', n: previa.resumo.duplicataCsv, cor: 'bg-slate-100 text-slate-600' },
                { lbl: 'Já é func.', n: previa.resumo.jaMembro, cor: 'bg-blue-50 text-blue-700' },
                { lbl: 'Já convidada', n: previa.resumo.jaConvidado, cor: 'bg-amber-50 text-amber-700' },
              ].map((c) => (
                <div
                  key={c.lbl}
                  className={`rounded-md border px-2 py-1.5 ${c.cor} border-slate-200`}
                >
                  <div className="text-[10px] uppercase tracking-wide">{c.lbl}</div>
                  <div className="text-lg font-bold font-mono">{c.n}</div>
                </div>
              ))}
            </div>

            {/* Botão marcar todos PRONTO */}
            <div className="flex items-center justify-between gap-2 text-xs">
              <button
                type="button"
                onClick={toggleTodosPronto}
                className="text-orange-700 hover:text-orange-900 underline"
              >
                {previa.linhas
                  .filter((l) => l.status === 'PRONTO')
                  .every((l) => selecionados.has(l.linha))
                  ? 'Desmarcar todos PRONTO'
                  : 'Marcar todos PRONTO'}
              </button>
              <span className="text-slate-500">
                {podeEnviarN} selecionado{podeEnviarN === 1 ? '' : 's'} pra envio
              </span>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {previa.linhas.map((l) => {
                  const lbl = STATUS_PREVIA[l.status];
                  const desabilitado = l.status !== 'PRONTO';
                  const abrindo = linhaAbrindoWa === l.linha;
                  return (
                    <TableRow key={l.linha}>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selecionados.has(l.linha)}
                          onChange={() => toggleLinha(l.linha)}
                          disabled={desabilitado}
                          className="cursor-pointer disabled:cursor-not-allowed"
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {l.nome || <span className="text-slate-400">(sem nome)</span>}
                      </TableCell>
                      <TableCell className="text-xs font-mono text-slate-600">
                        {l.telefoneFmt ?? l.telefone}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`${lbl.cor} text-[10px]`}>
                          {lbl.label}
                        </Badge>
                        {l.motivo && (
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            {l.motivo}
                          </div>
                        )}
                        {erroLinha?.linha === l.linha && (
                          <div className="text-[10px] text-red-600 mt-0.5">
                            {erroLinha.msg}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {l.status === 'PRONTO' && (
                          <button
                            type="button"
                            onClick={() => abrirWhatsappManual(l)}
                            disabled={abrindo}
                            title="Abrir no MEU WhatsApp com a mensagem pronta"
                            className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-50 border border-emerald-300 disabled:opacity-50"
                          >
                            {abrindo ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <MessageCircle className="h-3 w-3" />
                            )}
                            Abrir no WhatsApp
                          </button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            <div className="flex justify-between pt-2">
              <button
                type="button"
                onClick={resetar}
                className="text-xs text-slate-600 hover:text-slate-900 underline"
              >
                ← Voltar / trocar planilha
              </button>
              <button
                type="button"
                onClick={enviarLote}
                disabled={podeEnviarN === 0 || carregando}
                className="inline-flex items-center gap-2 rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50"
              >
                {carregando ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Enviar {podeEnviarN} convite{podeEnviarN === 1 ? '' : 's'}
              </button>
            </div>
          </div>
        )}

        {(step === 'enviando' || step === 'concluido') && (
          <div className="mt-3 space-y-3">
            {/* Progress bar */}
            <div className="rounded-md border border-orange-200 bg-orange-50 px-4 py-3">
              {status ? (
                <>
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="font-semibold text-orange-900">
                      {step === 'concluido' ? 'Concluído' : 'Enviando...'}
                    </span>
                    <span className="text-slate-700 font-mono">
                      {status.resumo.enviado + status.resumo.falhou} de {status.resumo.total}
                    </span>
                  </div>
                  <div className="mt-2 h-2 bg-orange-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-orange-600 transition-all duration-500"
                      style={{
                        width: `${
                          status.resumo.total > 0
                            ? ((status.resumo.enviado + status.resumo.falhou) /
                                status.resumo.total) *
                              100
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                  <div className="mt-2 flex gap-3 text-[11px] text-slate-700">
                    <span>📨 Na fila: <strong>{status.resumo.pendente}</strong></span>
                    <span className="text-emerald-700">✅ Enviados: <strong>{status.resumo.enviado}</strong></span>
                    {status.resumo.falhou > 0 && (
                      <span className="text-red-700">❌ Falhas: <strong>{status.resumo.falhou}</strong></span>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Loader2 className="h-4 w-4 animate-spin" /> Iniciando envio...
                </div>
              )}
            </div>

            {/* Tabela de status por destinatário */}
            {status && status.itens.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {status.itens.map((it) => {
                    const lbl = STATUS_ENVIO[it.statusEnvio];
                    const Icon = lbl.Icon;
                    return (
                      <TableRow key={it.conviteId}>
                        <TableCell className="font-medium">{it.nomeConvidado}</TableCell>
                        <TableCell className="text-xs font-mono text-slate-600">
                          {it.telefoneSufixo}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`${lbl.cor} text-[10px] inline-flex items-center gap-1`}>
                            <Icon
                              className={`h-3 w-3 ${
                                it.statusEnvio === 'PENDENTE' ? 'animate-spin' : ''
                              }`}
                            />
                            {lbl.label}
                          </Badge>
                          {it.erro && (
                            <div className="text-[10px] text-red-600 mt-0.5">{it.erro}</div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}

            {step === 'concluido' && (
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={concluir}
                  className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Fechar e atualizar lista
                </button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
