'use client';

/**
 * Sprint Convite-Convênio Fatia 5 (03/06/2026) — Componente reusável.
 *
 * Gestão de convites do convênio (lista + criar + reenviar + cancelar).
 * Reusado entre admin (/dashboard/convenios/[id]) e portal empresa
 * (/conveniada/convenio/[id] — Fatia 9.1).
 *
 * Discrimina endpoint via prop `source`:
 *  - 'admin'   → /convenios/:id/convites (JWT admin)
 *  - 'empresa' → /portal/meus-convenios/:id/convites (Fatia 9, futuro)
 *
 * HELP (regra 19/05): HelpBox info dismissível com exemplo concreto.
 */

import { useEffect, useState, useCallback } from 'react';
import {
  Loader2,
  Send,
  Trash2,
  RefreshCw,
  UserPlus,
  Plus,
  Copy,
  Check,
  Clock,
  AlertCircle,
  CheckCircle2,
  XCircle,
  FileQuestion,
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
import { Input } from '@/components/ui/input';
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
import { formatarTelefone, normalizarTelefone } from '@/lib/formatar-telefone';

export type ConviteSource = 'admin' | 'empresa';

interface ConviteItem {
  id: string;
  nomeConvidado: string;
  telefone: string;
  tokenSufixo: string;
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
  createdBy: string;
  otpValidadoEm: string | null;
  membroId: string | null;
  status: StatusConviteDerivado;
  membro: {
    id: string;
    cooperadoNome: string | null;
    cooperadoCpfSufixo: string | null;
  } | null;
}

interface Contadores {
  total: number;
  aguardando_otp: number;
  aguardando_cadastro: number;
  pendente_empresa: number;
  pendente_admin: number;
  aguardando_docs: number;
  ativo: number;
  rejeitado_empresa: number;
  rejeitado_admin: number;
  link_expirado: number;
}

interface ListagemConvites {
  data: ConviteItem[];
  contadores: Contadores;
}

type StatusConviteDerivado =
  | 'AGUARDANDO_OTP'
  | 'AGUARDANDO_CADASTRO'
  | 'PENDENTE_APROVACAO_EMPRESA'
  | 'PENDENTE_APROVACAO_ADMIN'
  | 'AGUARDANDO_DOCS'
  | 'ATIVO'
  | 'REJEITADO_EMPRESA'
  | 'REJEITADO_ADMIN'
  | 'LINK_EXPIRADO';

const STATUS_VISUAL: Record<
  StatusConviteDerivado,
  { label: string; cor: string; Icon: typeof Clock }
> = {
  AGUARDANDO_OTP: { label: 'Aguardando código', cor: 'bg-slate-100 text-slate-700', Icon: Hourglass },
  AGUARDANDO_CADASTRO: { label: 'Aguardando cadastro', cor: 'bg-blue-100 text-blue-700', Icon: Hourglass },
  PENDENTE_APROVACAO_EMPRESA: { label: 'Pendente empresa', cor: 'bg-amber-100 text-amber-800', Icon: Clock },
  PENDENTE_APROVACAO_ADMIN: { label: 'Pendente CoopereBR', cor: 'bg-purple-100 text-purple-700', Icon: Clock },
  AGUARDANDO_DOCS: { label: 'Aguardando docs', cor: 'bg-indigo-100 text-indigo-700', Icon: FileQuestion },
  ATIVO: { label: 'Ativo ✓', cor: 'bg-green-100 text-green-800', Icon: ShieldCheck },
  REJEITADO_EMPRESA: { label: 'Recusado empresa', cor: 'bg-red-100 text-red-700', Icon: XCircle },
  REJEITADO_ADMIN: { label: 'Recusado CoopereBR', cor: 'bg-red-100 text-red-700', Icon: XCircle },
  LINK_EXPIRADO: { label: 'Link expirado', cor: 'bg-gray-200 text-gray-700', Icon: AlertCircle },
};

interface GestaoConvitesSectionProps {
  convenioId: string;
  source: ConviteSource;
  /** Callback quando lista muda (pra parent atualizar contadores externos) */
  onListaAtualizada?: (contadores: Contadores) => void;
  /**
   * Bug B (10/06/2026) — bump externo pra forçar re-fetch sem desmontar.
   * Parent incrementa quando uma seção irmã (lote/pendentes) realiza ação
   * que afeta a lista de convites desta seção.
   */
  refreshKey?: number;
}

export function GestaoConvitesSection({
  convenioId,
  source,
  onListaAtualizada,
  refreshKey,
}: GestaoConvitesSectionProps) {
  const [loading, setLoading] = useState(true);
  const [listagem, setListagem] = useState<ListagemConvites | null>(null);
  const [erro, setErro] = useState('');

  // Dialog "Gerar convite"
  const [dialogCriarAberto, setDialogCriarAberto] = useState(false);
  const [criarNome, setCriarNome] = useState('');
  const [criarTelefone, setCriarTelefone] = useState('');
  const [criarSubmitting, setCriarSubmitting] = useState(false);
  const [criarErro, setCriarErro] = useState('');

  // Cancelar/reenviar
  const [acaoConviteId, setAcaoConviteId] = useState<string | null>(null);

  // Endpoint base por source
  const endpointBase =
    source === 'admin'
      ? `/convenios/${convenioId}/convites`
      : `/portal/meus-convenios/${convenioId}/convites`;

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro('');
    try {
      const r = await api.get<ListagemConvites>(endpointBase);
      setListagem(r.data);
      onListaAtualizada?.(r.data.contadores);
    } catch (err) {
      setErro(formatErroBackend(err));
    } finally {
      setLoading(false);
    }
  }, [endpointBase, onListaAtualizada]);

  useEffect(() => {
    carregar();
    // refreshKey no dep array — bump externo dispara re-fetch (Bug B 10/06/2026).
  }, [carregar, refreshKey]);

  // F4 Bloco D carona (12/06/2026) — formatarTelefone agora vem de
  // @/lib/formatar-telefone (helper único + fix strip 55).

  async function gerarConvite() {
    setCriarSubmitting(true);
    setCriarErro('');
    try {
      await api.post(endpointBase, {
        nomeConvidado: criarNome.trim(),
        telefone: normalizarTelefone(criarTelefone),
      });
      setDialogCriarAberto(false);
      setCriarNome('');
      setCriarTelefone('');
      await carregar();
    } catch (err) {
      setCriarErro(formatErroBackend(err));
    } finally {
      setCriarSubmitting(false);
    }
  }

  async function reenviarConvite(conviteId: string) {
    setAcaoConviteId(conviteId);
    try {
      await api.post(`${endpointBase}/${conviteId}/reenviar`);
      await carregar();
    } catch (err) {
      setErro(formatErroBackend(err));
    } finally {
      setAcaoConviteId(null);
    }
  }

  async function cancelarConvite(conviteId: string, nome: string) {
    if (!confirm(`Cancelar o convite de "${nome}"? Esta ação não pode ser desfeita.`)) return;
    setAcaoConviteId(conviteId);
    try {
      await api.delete(`${endpointBase}/${conviteId}`);
      await carregar();
    } catch (err) {
      setErro(formatErroBackend(err));
    } finally {
      setAcaoConviteId(null);
    }
  }

  function StatusBadge({ status }: { status: StatusConviteDerivado }) {
    const v = STATUS_VISUAL[status];
    const Icon = v.Icon;
    return (
      <Badge variant="outline" className={`${v.cor} border-transparent text-xs font-medium`}>
        <Icon className="h-3 w-3 mr-1" />
        {v.label}
      </Badge>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-cyan-700" />
            Convites enviados
            {listagem && (
              <span className="text-sm font-normal text-gray-500">({listagem.contadores.total})</span>
            )}
          </CardTitle>
          <Button onClick={() => setDialogCriarAberto(true)} className="bg-cyan-700 hover:bg-cyan-800">
            <Plus className="h-4 w-4 mr-1" />
            Gerar convite
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <HelpBox id={`convites-${source}-como-funciona`} titulo="Como funciona">
          <p>
            Digite <strong>nome e WhatsApp</strong> do funcionário/médico que será convidado pro convênio.
            O sistema envia automaticamente um link com código de confirmação.
          </p>
          <p className="mt-2">
            <strong>Ex:</strong> "Maria Silva, 27999998888" → ela recebe no WhatsApp:{' '}
            <em>"Olá Maria, a empresa X te convidou pra ser custeado…"</em>
          </p>
          <p className="mt-2 text-xs">
            <strong>O que cada status quer dizer:</strong> Aguardando código = ainda não confirmou WhatsApp;
            Aguardando cadastro = confirmou OTP, falta preencher dados; Pendente empresa = empresa precisa
            confirmar que é funcionário; Pendente CoopereBR = nós validamos; Ativo = aprovado e custeado.
          </p>
        </HelpBox>

        {/* Contadores resumo */}
        {listagem && listagem.contadores.total > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <ContadorCard label="Ativos" valor={listagem.contadores.ativo} cor="text-green-700" />
            <ContadorCard
              label="Pendentes"
              valor={
                listagem.contadores.pendente_empresa +
                listagem.contadores.pendente_admin +
                listagem.contadores.aguardando_docs
              }
              cor="text-amber-700"
            />
            <ContadorCard
              label="Aguardando convidado"
              valor={listagem.contadores.aguardando_otp + listagem.contadores.aguardando_cadastro}
              cor="text-blue-700"
            />
            <ContadorCard
              label="Recusados/Expirados"
              valor={
                listagem.contadores.rejeitado_empresa +
                listagem.contadores.rejeitado_admin +
                listagem.contadores.link_expirado
              }
              cor="text-gray-600"
            />
          </div>
        )}

        {erro && (
          <p className="text-sm text-red-700 bg-red-50 border border-red-300 rounded p-2">{erro}</p>
        )}

        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-cyan-700" />
          </div>
        ) : !listagem || listagem.data.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-6">
            Nenhum convite ainda. Clique em <strong>Gerar convite</strong> pra começar.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Convidado</TableHead>
                  <TableHead>WhatsApp</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {listagem.data.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="text-sm">
                      <div className="font-medium">{c.nomeConvidado}</div>
                      {c.membro?.cooperadoNome && (
                        <div className="text-xs text-gray-500">
                          → {c.membro.cooperadoNome} ({c.membro.cooperadoCpfSufixo})
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs font-mono">{formatarTelefone(c.telefone)}</TableCell>
                    <TableCell>
                      <StatusBadge status={c.status} />
                    </TableCell>
                    <TableCell className="text-xs text-gray-600">
                      {new Date(c.createdAt).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {/* Reenviar — só quando convite ainda não usado e não terminal */}
                        {!c.usedAt && c.status !== 'LINK_EXPIRADO' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={acaoConviteId === c.id}
                            onClick={() => reenviarConvite(c.id)}
                            title="Reenviar link por WhatsApp"
                          >
                            {acaoConviteId === c.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <RefreshCw className="h-4 w-4 text-cyan-700" />
                            )}
                          </Button>
                        )}
                        {/* Cancelar — só quando convite ainda não usado */}
                        {!c.usedAt && (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={acaoConviteId === c.id}
                            onClick={() => cancelarConvite(c.id, c.nomeConvidado)}
                            title="Cancelar convite (irreversível)"
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* Dialog "Gerar convite" */}
      <Dialog
        open={dialogCriarAberto}
        onOpenChange={(o) => !criarSubmitting && setDialogCriarAberto(o)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-cyan-700" />
              Gerar convite
            </DialogTitle>
            <DialogDescription>
              O sistema envia um link automático por WhatsApp pro convidado com código de confirmação.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div>
              <Label htmlFor="convite-nome">Nome do convidado</Label>
              <Input
                id="convite-nome"
                value={criarNome}
                onChange={(e) => setCriarNome(e.target.value)}
                placeholder="Maria Silva"
                disabled={criarSubmitting}
              />
            </div>
            <div>
              <Label htmlFor="convite-telefone">WhatsApp (com DDD)</Label>
              <Input
                id="convite-telefone"
                inputMode="numeric"
                value={criarTelefone}
                onChange={(e) => setCriarTelefone(formatarTelefone(e.target.value))}
                placeholder="(27) 99999-8888"
                disabled={criarSubmitting}
              />
              <p className="text-xs text-gray-500 mt-1">
                O código vai pro WhatsApp <strong>desse número</strong> — confira antes de enviar.
              </p>
            </div>

            {criarErro && (
              <p className="text-sm text-red-700 bg-red-50 border border-red-300 rounded p-2">
                {criarErro}
              </p>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDialogCriarAberto(false)}
              disabled={criarSubmitting}
            >
              Cancelar
            </Button>
            <Button
              onClick={gerarConvite}
              disabled={
                criarSubmitting ||
                criarNome.trim().length < 2 ||
                criarTelefone.replace(/\D/g, '').length < 10
              }
              className="bg-cyan-700 hover:bg-cyan-800"
            >
              {criarSubmitting ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-1" />
              )}
              Enviar convite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function ContadorCard({ label, valor, cor }: { label: string; valor: number; cor: string }) {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded p-2 text-center">
      <div className={`text-lg font-bold ${cor}`}>{valor}</div>
      <div className="text-xs text-gray-600">{label}</div>
    </div>
  );
}
