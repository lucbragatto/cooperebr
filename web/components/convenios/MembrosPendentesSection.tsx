'use client';

/**
 * Sprint Convite-Convênio Fatia 5 (03/06/2026) — Componente reusável.
 *
 * Gestão de membros PENDENTE_* do convênio (lista + aprovar + rejeitar +
 * solicitar documentação + reenviar magic link da empresa).
 * Reusado entre admin (/dashboard/convenios/[id]) e portal empresa
 * (/conveniada/convenio/[id] — Fatia 9.1).
 *
 * Source 'empresa' filtra ações: empresa NÃO solicita-documentação NEM
 * aprova/rejeita por aqui (ela aprova in-portal via outro endpoint —
 * Fatia 9.3). Apenas visualização + reenviar magic link.
 *
 * BANNER ÂMBAR sempre visível em ações de consequência (aprovar/rejeitar)
 * — regra 19/05.
 */

import { useEffect, useState, useCallback } from 'react';
import {
  Loader2,
  CheckCircle2,
  XCircle,
  FileQuestion,
  RefreshCw,
  AlertTriangle,
  Clock,
  Hourglass,
  ShieldCheck,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { HelpBox } from '@/components/ui/help-box';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import api from '@/lib/api';
import { formatErroBackend } from '@/lib/utils';
import type { ConviteSource } from './GestaoConvitesSection';

// Tipos enxutos do que precisamos
type StatusMembroPendente =
  | 'PENDENTE_APROVACAO_EMPRESA'
  | 'PENDENTE_APROVACAO_ADMIN';

interface UcDoCooperado {
  id: string;
  numero: string;
  tipoUc: 'NORMAL' | 'SINTETICA';
  numeroUC: string | null;
  numeroConcessionariaOriginal: string | null;
  distribuidora: string;
}

interface MembroPendente {
  id: string;
  status: StatusMembroPendente;
  ativo: boolean;
  origem: string;
  documentacaoSolicitadaEm: string | null;
  cooperado: {
    id: string;
    nomeCompleto: string;
    cpf: string;
    email: string;
    telefone: string | null;
    // Bug C (10/06/2026) — backend agora expoe estes campos no listarPendentes.
    cotaKwhMensal: number | null;
    ucs: UcDoCooperado[];
  };
  aprovacao: {
    tokenSufixo: string;
    expiresAt: string;
    usedAt: string | null;
    decisao: string | null;
  } | null;
  convite: {
    id: string;
    nomeConvidado: string;
    telefone: string;
  } | null;
  createdAt: string;
}

interface ListagemPendentes {
  data: MembroPendente[];
  total: number;
  page: number;
  limit: number;
}

interface MembrosPendentesSectionProps {
  convenioId: string;
  source: ConviteSource;
  /** Callback após qualquer ação (aprovar/rejeitar/etc) — pra parent atualizar */
  onAcaoConcluida?: () => void;
  /**
   * Bug B (10/06/2026) — bump externo pra forçar re-fetch sem desmontar.
   * Parent incrementa quando uma seção irmã (lote/convites) gera novos
   * membros pendentes que precisam aparecer aqui.
   */
  refreshKey?: number;
}

// Tipos de documento disponíveis (espelha enum TipoDocumento do Prisma)
const TIPOS_DOCUMENTO = [
  { valor: 'RG_FRENTE', label: 'RG (frente)' },
  { valor: 'RG_VERSO', label: 'RG (verso)' },
  { valor: 'CNH_FRENTE', label: 'CNH (frente)' },
  { valor: 'CNH_VERSO', label: 'CNH (verso)' },
  { valor: 'CONTRATO_SOCIAL', label: 'Contrato social' },
  { valor: 'OUTROS', label: 'Outros' },
];

export function MembrosPendentesSection({
  convenioId,
  source,
  onAcaoConcluida,
  refreshKey,
}: MembrosPendentesSectionProps) {
  const [loading, setLoading] = useState(true);
  const [listagem, setListagem] = useState<ListagemPendentes | null>(null);
  const [erro, setErro] = useState('');
  const [acaoMembroId, setAcaoMembroId] = useState<string | null>(null);

  // Dialogs
  const [dialogAprovarMembroId, setDialogAprovarMembroId] = useState<string | null>(null);
  const [dialogRejeitarMembroId, setDialogRejeitarMembroId] = useState<string | null>(null);
  const [dialogDocsMembroId, setDialogDocsMembroId] = useState<string | null>(null);
  const [motivoRejeicao, setMotivoRejeicao] = useState('');
  const [docsSelected, setDocsSelected] = useState<Set<string>>(new Set());

  const endpointListar =
    source === 'admin'
      ? `/convenios/${convenioId}/membros-pendentes`
      : `/portal/meus-convenios/${convenioId}/membros-pendentes`;

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro('');
    try {
      const r = await api.get<ListagemPendentes>(endpointListar);
      setListagem(r.data);
    } catch (err) {
      setErro(formatErroBackend(err));
    } finally {
      setLoading(false);
    }
  }, [endpointListar]);

  useEffect(() => {
    carregar();
    // refreshKey no dep array — bump externo dispara re-fetch (Bug B 10/06/2026).
  }, [carregar, refreshKey]);

  async function aprovarAdmin(membroId: string) {
    setAcaoMembroId(membroId);
    try {
      await api.post(`/convenios/${convenioId}/membros/${membroId}/aprovar-admin`);
      setDialogAprovarMembroId(null);
      await carregar();
      onAcaoConcluida?.();
    } catch (err) {
      setErro(formatErroBackend(err));
    } finally {
      setAcaoMembroId(null);
    }
  }

  async function rejeitarAdmin(membroId: string) {
    setAcaoMembroId(membroId);
    try {
      await api.post(`/convenios/${convenioId}/membros/${membroId}/rejeitar-admin`, {
        motivo: motivoRejeicao.trim(),
      });
      setDialogRejeitarMembroId(null);
      setMotivoRejeicao('');
      await carregar();
      onAcaoConcluida?.();
    } catch (err) {
      setErro(formatErroBackend(err));
    } finally {
      setAcaoMembroId(null);
    }
  }

  // Sprint Portal Empresa 9.1 (04/06/2026) — empresa decide in-portal
  // (JWT, sem magic link). Endpoint: /portal/meus-convenios/:id/membros/:mid/decidir
  async function decidirEmpresa(
    membroId: string,
    decisao: 'APROVAR' | 'REJEITAR',
    motivo?: string,
  ) {
    setAcaoMembroId(membroId);
    try {
      await api.post(
        `/portal/meus-convenios/${convenioId}/membros/${membroId}/decidir`,
        { decisao, motivo: motivo?.trim() || undefined },
      );
      setDialogAprovarMembroId(null);
      setDialogRejeitarMembroId(null);
      setMotivoRejeicao('');
      await carregar();
      onAcaoConcluida?.();
    } catch (err) {
      setErro(formatErroBackend(err));
    } finally {
      setAcaoMembroId(null);
    }
  }

  async function solicitarDocs(membroId: string) {
    setAcaoMembroId(membroId);
    try {
      await api.post(`/convenios/${convenioId}/membros/${membroId}/solicitar-documentacao`, {
        tipos: Array.from(docsSelected),
      });
      setDialogDocsMembroId(null);
      setDocsSelected(new Set());
      await carregar();
      onAcaoConcluida?.();
    } catch (err) {
      setErro(formatErroBackend(err));
    } finally {
      setAcaoMembroId(null);
    }
  }

  async function reenviarAprovacaoEmpresa(membroId: string) {
    setAcaoMembroId(membroId);
    try {
      await api.post(`/convenios/${convenioId}/membros/${membroId}/reenviar-aprovacao-empresa`);
      await carregar();
      onAcaoConcluida?.();
    } catch (err) {
      setErro(formatErroBackend(err));
    } finally {
      setAcaoMembroId(null);
    }
  }

  function statusVisual(m: MembroPendente) {
    if (m.documentacaoSolicitadaEm) {
      return {
        label: 'Aguardando docs',
        cor: 'bg-indigo-100 text-indigo-700',
        Icon: FileQuestion,
      };
    }
    if (m.status === 'PENDENTE_APROVACAO_EMPRESA') {
      return {
        label: 'Pendente empresa',
        cor: 'bg-amber-100 text-amber-800',
        Icon: Clock,
      };
    }
    return {
      label: 'Pendente CoopereBR',
      cor: 'bg-purple-100 text-purple-700',
      Icon: Hourglass,
    };
  }

  const aprovarMembro =
    dialogAprovarMembroId && listagem
      ? listagem.data.find((m) => m.id === dialogAprovarMembroId)
      : null;
  const rejeitarMembro =
    dialogRejeitarMembroId && listagem
      ? listagem.data.find((m) => m.id === dialogRejeitarMembroId)
      : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Hourglass className="h-5 w-5 text-amber-700" />
          Membros pendentes
          {listagem && (
            <span className="text-sm font-normal text-gray-500">({listagem.total})</span>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <HelpBox id={`membros-pendentes-${source}-legenda`} titulo="O que cada status quer dizer">
          <ul className="list-disc list-inside space-y-1 text-xs">
            <li>
              <strong>Pendente empresa</strong>: o cooperado cadastrou; a empresa precisa confirmar que é
              funcionário/médico (via magic link no WhatsApp ou no portal dela).
            </li>
            <li>
              <strong>Pendente CoopereBR</strong>: empresa confirmou; admin precisa aprovar ou rejeitar.
            </li>
            <li>
              <strong>Aguardando docs</strong>: admin pediu documentos. O cooperado precisa enviar via portal.
            </li>
          </ul>
          <p className="mt-2 text-xs">
            <strong>Ex:</strong> "Maria pendente empresa" = Hangar Academia precisa confirmar via link no
            WhatsApp. Use "Reenviar" se ela não recebeu.
          </p>
        </HelpBox>

        {/* Banner âmbar SEMPRE-VISÍVEL (regra 19/05 — consequência financeira) */}
        {source === 'admin' && (
          <div className="bg-amber-50 border-l-4 border-amber-500 p-3 rounded">
            <p className="text-sm font-semibold text-amber-900 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> Atenção
            </p>
            <p className="text-xs text-amber-800 mt-1">
              <strong>Aprovar</strong> ativa o membro custeado — a partir dali, a energia dele entra na
              cobrança consolidada da empresa. <strong>Rejeitar</strong> bloqueia o cadastro (o cooperado
              recebe o motivo). <strong>Ex:</strong> só aprove depois que a empresa também confirmou que é
              funcionário dela.
            </p>
          </div>
        )}
        {/* Sprint Portal Empresa 9.1 — banner âmbar pra empresa (consequência financeira) */}
        {source === 'empresa' && (
          <div className="bg-amber-50 border-l-4 border-amber-500 p-3 rounded">
            <p className="text-sm font-semibold text-amber-900 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> Confirme com atenção
            </p>
            <p className="text-xs text-amber-800 mt-1">
              Ao <strong>CONFIRMAR</strong>, a pessoa entra no convênio e a energia dela passa a ser
              custeada pela sua empresa (você paga).{' '}
              <strong>Ex:</strong> confirme só quem realmente trabalha na sua empresa.
            </p>
          </div>
        )}

        {erro && (
          <p className="text-sm text-red-700 bg-red-50 border border-red-300 rounded p-2">{erro}</p>
        )}

        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-amber-700" />
          </div>
        ) : !listagem || listagem.data.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-6">
            Nenhum membro pendente no momento. ✓
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cooperado</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Cadastrado em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {listagem.data.map((m) => {
                  const v = statusVisual(m);
                  const Icon = v.Icon;
                  return (
                    <TableRow key={m.id}>
                      <TableCell className="text-sm">
                        <div className="font-medium">{m.cooperado.nomeCompleto}</div>
                        <div className="text-xs text-gray-500 font-mono">
                          CPF ...{m.cooperado.cpf.slice(-3)} ·{' '}
                          {m.cooperado.telefone ? `WA ...${m.cooperado.telefone.slice(-4)}` : 'sem WA'}
                        </div>
                        {/* Bug C (10/06/2026) — UC + cota mensal visiveis no detalhe */}
                        <div className="text-xs text-gray-600 mt-1">
                          <UcResumo ucs={m.cooperado.ucs} />
                          {' · '}
                          {typeof m.cooperado.cotaKwhMensal === 'number' && m.cooperado.cotaKwhMensal > 0
                            ? `${m.cooperado.cotaKwhMensal.toLocaleString('pt-BR')} kWh/mês`
                            : <span className="text-amber-700">sem cota</span>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`${v.cor} border-transparent text-xs`}>
                          <Icon className="h-3 w-3 mr-1" />
                          {v.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-gray-600">
                        {new Date(m.createdAt).toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1 flex-wrap">
                          {/* Aprovar admin — só em PENDENTE_APROVACAO_ADMIN (admin não pula empresa) */}
                          {source === 'admin' && m.status === 'PENDENTE_APROVACAO_ADMIN' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={acaoMembroId === m.id}
                              onClick={() => setDialogAprovarMembroId(m.id)}
                              title="Aprovar e ativar"
                              className="text-green-700 hover:bg-green-50"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                          )}
                          {/* Solicitar docs — só em PENDENTE_APROVACAO_ADMIN, source=admin */}
                          {source === 'admin' && m.status === 'PENDENTE_APROVACAO_ADMIN' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={acaoMembroId === m.id}
                              onClick={() => {
                                setDocsSelected(new Set());
                                setDialogDocsMembroId(m.id);
                              }}
                              title="Solicitar documentação"
                              className="text-indigo-700 hover:bg-indigo-50"
                            >
                              <FileQuestion className="h-4 w-4" />
                            </Button>
                          )}
                          {/* Rejeitar admin — só em PENDENTE_APROVACAO_ADMIN, source=admin */}
                          {source === 'admin' && m.status === 'PENDENTE_APROVACAO_ADMIN' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={acaoMembroId === m.id}
                              onClick={() => {
                                setMotivoRejeicao('');
                                setDialogRejeitarMembroId(m.id);
                              }}
                              title="Rejeitar"
                              className="text-red-700 hover:bg-red-50"
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          )}
                          {/* Sprint Portal Empresa 9.1 — empresa decide in-portal */}
                          {source === 'empresa' && m.status === 'PENDENTE_APROVACAO_EMPRESA' && (
                            <>
                              <Button
                                variant="default"
                                size="sm"
                                disabled={acaoMembroId === m.id}
                                onClick={() => setDialogAprovarMembroId(m.id)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                                Confirmar
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={acaoMembroId === m.id}
                                onClick={() => {
                                  setMotivoRejeicao('');
                                  setDialogRejeitarMembroId(m.id);
                                }}
                                className="border-red-300 text-red-700 hover:bg-red-50"
                              >
                                <XCircle className="h-3.5 w-3.5 mr-1" />
                                Recusar
                              </Button>
                            </>
                          )}
                          {/* Reenviar magic link da empresa — só em PENDENTE_APROVACAO_EMPRESA */}
                          {source === 'admin' && m.status === 'PENDENTE_APROVACAO_EMPRESA' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={acaoMembroId === m.id}
                              onClick={() => reenviarAprovacaoEmpresa(m.id)}
                              title="Reenviar magic link pra empresa"
                              className="text-cyan-700 hover:bg-cyan-50"
                            >
                              {acaoMembroId === m.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <RefreshCw className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* Dialog APROVAR */}
      <Dialog
        open={!!dialogAprovarMembroId}
        onOpenChange={(o) => !acaoMembroId && !o && setDialogAprovarMembroId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-700">
              <ShieldCheck className="h-5 w-5" />
              {source === 'empresa'
                ? 'Confirmar funcionário?'
                : 'Aprovar membro custeado?'}
            </DialogTitle>
            <DialogDescription>
              {aprovarMembro && source === 'empresa' && (
                <>
                  Ao confirmar, <strong>{aprovarMembro.cooperado.nomeCompleto}</strong> entra no
                  convênio e a energia dele passa a ser custeada pela sua empresa (você paga).
                  Em seguida, a CoopereBR faz a aprovação final.
                </>
              )}
              {aprovarMembro && source === 'admin' && (
                <>
                  Ao aprovar, <strong>{aprovarMembro.cooperado.nomeCompleto}</strong> passa a ser membro
                  ATIVO do convênio. Sua energia entra na cobrança consolidada da empresa a partir da
                  próxima geração.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="bg-amber-50 border-l-4 border-amber-500 p-3 rounded text-xs text-amber-800 my-2">
            {source === 'empresa' ? (
              <>
                <strong>Atenção — consequência financeira.</strong> Confirme apenas se essa
                pessoa realmente trabalha na sua empresa. A partir daqui o custo de energia
                dela é seu.
              </>
            ) : (
              <>
                <strong>Confirme se a empresa já confirmou.</strong> O fluxo é: empresa confirma primeiro
                (magic link no WA) → admin aprova depois.
              </>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDialogAprovarMembroId(null)}
              disabled={!!acaoMembroId}
            >
              Cancelar
            </Button>
            <Button
              onClick={() =>
                aprovarMembro &&
                (source === 'empresa'
                  ? decidirEmpresa(aprovarMembro.id, 'APROVAR')
                  : aprovarAdmin(aprovarMembro.id))
              }
              disabled={!!acaoMembroId}
              className="bg-green-600 hover:bg-green-700"
            >
              {acaoMembroId && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {source === 'empresa' ? 'Confirmar funcionário' : 'Aprovar e ativar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog REJEITAR */}
      <Dialog
        open={!!dialogRejeitarMembroId}
        onOpenChange={(o) => !acaoMembroId && !o && setDialogRejeitarMembroId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <XCircle className="h-5 w-5" /> Rejeitar cadastro?
            </DialogTitle>
            <DialogDescription>
              {rejeitarMembro && (
                <>
                  Conte por que está recusando <strong>{rejeitarMembro.cooperado.nomeCompleto}</strong>.
                  O motivo será enviado pro cooperado.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="motivo-rejeicao">Motivo (mínimo 2 caracteres)</Label>
            <Textarea
              id="motivo-rejeicao"
              value={motivoRejeicao}
              onChange={(e) => setMotivoRejeicao(e.target.value)}
              placeholder="Ex: dados não conferem / não é funcionário/médico autorizado"
              rows={3}
              maxLength={500}
              disabled={!!acaoMembroId}
            />
            <p className="text-xs text-gray-500 text-right">{motivoRejeicao.length}/500</p>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDialogRejeitarMembroId(null)}
              disabled={!!acaoMembroId}
            >
              Cancelar
            </Button>
            <Button
              onClick={() =>
                rejeitarMembro &&
                (source === 'empresa'
                  ? decidirEmpresa(rejeitarMembro.id, 'REJEITAR', motivoRejeicao)
                  : rejeitarAdmin(rejeitarMembro.id))
              }
              disabled={!!acaoMembroId || motivoRejeicao.trim().length < 2}
              variant="destructive"
              className="bg-red-600 hover:bg-red-700"
            >
              {acaoMembroId && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {source === 'empresa' ? 'Recusar' : 'Rejeitar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog SOLICITAR DOCS */}
      <Dialog
        open={!!dialogDocsMembroId}
        onOpenChange={(o) => !acaoMembroId && !o && setDialogDocsMembroId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-indigo-700">
              <FileQuestion className="h-5 w-5" /> Solicitar documentação
            </DialogTitle>
            <DialogDescription>
              Selecione os documentos que o cooperado precisa enviar antes de você aprovar. O cooperado
              recebe um aviso e envia pelo portal.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            {TIPOS_DOCUMENTO.map((tipo) => (
              <label key={tipo.valor} className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={docsSelected.has(tipo.valor)}
                  disabled={!!acaoMembroId}
                  onChange={(e) => {
                    const next = new Set(docsSelected);
                    if (e.target.checked) next.add(tipo.valor);
                    else next.delete(tipo.valor);
                    setDocsSelected(next);
                  }}
                />
                {tipo.label}
              </label>
            ))}
            <p className="text-xs text-gray-500 mt-2">
              <strong>Ex:</strong> "RG (frente) + RG (verso) + Contrato social" pra PJ.
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDialogDocsMembroId(null)}
              disabled={!!acaoMembroId}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => dialogDocsMembroId && solicitarDocs(dialogDocsMembroId)}
              disabled={!!acaoMembroId || docsSelected.size === 0}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {acaoMembroId && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Solicitar {docsSelected.size > 0 && `(${docsSelected.size})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/**
 * Bug C (10/06/2026) — resumo de UCs do cooperado pendente.
 *
 * Regras:
 *  - 0 UCs → "sem UC" amber (caso raro — cadastroWebV2 sempre cria pelo menos
 *    uma; pode acontecer se membro foi criado via outro path).
 *  - 1 UC NORMAL → "UC <numeroUC|numero> · <distribuidora>".
 *  - 1 UC SINTETICA → "UC sintética (sem fatura)" slate (custeio puro SEM_UC).
 *  - N>1 UCs → "UC <primeira> · +<N-1> UCs · <distribuidora|misto>".
 */
function UcResumo({ ucs }: { ucs: UcDoCooperado[] }) {
  if (ucs.length === 0) {
    return <span className="text-amber-700">sem UC</span>;
  }
  const principal = ucs[0]!;
  if (principal.tipoUc === 'SINTETICA') {
    // Em MEMBROS_PENDENTES com >1 UCs misturando NORMAL + SINTETICA, mostra a primeira
    // mas sinaliza misto pra empresa/admin ver.
    if (ucs.length > 1) {
      return (
        <span className="text-slate-500">
          UC sintética + {ucs.length - 1} UC{ucs.length - 1 > 1 ? 's' : ''} adicional{ucs.length - 1 > 1 ? 'is' : ''}
        </span>
      );
    }
    return <span className="text-slate-500">UC sintética (sem fatura)</span>;
  }
  const numeroExibido = principal.numeroUC ?? principal.numero;
  if (ucs.length === 1) {
    return (
      <span>
        UC {numeroExibido} · {principal.distribuidora}
      </span>
    );
  }
  const distribuidorasDistintas = new Set(ucs.map((u) => u.distribuidora));
  const distribuidoraLabel =
    distribuidorasDistintas.size === 1 ? principal.distribuidora : 'múltiplas';
  return (
    <span>
      UC {numeroExibido} · +{ucs.length - 1} UC{ucs.length - 1 > 1 ? 's' : ''} · {distribuidoraLabel}
    </span>
  );
}
