'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import api from '@/lib/api';
import { ClipboardList, CheckCircle2, XCircle, Loader2, Info } from 'lucide-react';

type TipoAlteracao = 'AUMENTAR_KWH' | 'DIMINUIR_KWH' | 'SUSPENDER' | 'ENCERRAR';
type StatusSolicitacao = 'PENDENTE' | 'APROVADA' | 'APLICADA' | 'RECUSADA' | 'CANCELADA';

interface Solicitacao {
  id: string;
  cooperadoId: string;
  cooperativaId: string;
  contratoId: string;
  tipoAlteracao: TipoAlteracao;
  valorPropostoKwh: number | null;
  motivo: string | null;
  status: StatusSolicitacao;
  createdAt: string;
  processadaEm: string | null;
  observacoesEquipe: string | null;
  cooperado?: { id: string; nomeCompleto: string | null; telefone: string | null };
  contrato?: { id: string; kwhContratoMensal: number | string | null; status: string };
}

const TIPO_LABEL: Record<TipoAlteracao, string> = {
  AUMENTAR_KWH: 'Aumentar kWh',
  DIMINUIR_KWH: 'Diminuir kWh',
  SUSPENDER: 'Suspender contrato',
  ENCERRAR: 'Encerrar contrato',
};

const TIPO_COR: Record<TipoAlteracao, string> = {
  AUMENTAR_KWH: 'bg-blue-100 text-blue-800 border-blue-200',
  DIMINUIR_KWH: 'bg-amber-100 text-amber-800 border-amber-200',
  SUSPENDER: 'bg-orange-100 text-orange-800 border-orange-200',
  ENCERRAR: 'bg-red-100 text-red-800 border-red-200',
};

const STATUS_COR: Record<StatusSolicitacao, string> = {
  PENDENTE: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  APROVADA: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  APLICADA: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  RECUSADA: 'bg-gray-100 text-gray-800 border-gray-200',
  CANCELADA: 'bg-gray-100 text-gray-800 border-gray-200',
};

function formatarData(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function SolicitacoesContratoPage() {
  const [items, setItems] = useState<Solicitacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [filtroStatus, setFiltroStatus] = useState<StatusSolicitacao | 'TODOS'>('PENDENTE');
  const [acaoLoading, setAcaoLoading] = useState<string | null>(null);

  // Modal recusa
  const [solRecusa, setSolRecusa] = useState<Solicitacao | null>(null);
  const [obs, setObs] = useState('');

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const url = filtroStatus === 'TODOS'
        ? '/solicitacoes-contrato'
        : `/solicitacoes-contrato?status=${filtroStatus}`;
      const res = await api.get<Solicitacao[]>(url);
      setItems(res.data);
    } catch (e: any) {
      setErro(e?.response?.data?.message ?? e?.message ?? 'Erro ao carregar solicitacoes');
    } finally {
      setLoading(false);
    }
  }, [filtroStatus]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function aprovar(sol: Solicitacao) {
    if (acaoLoading) return;
    const confirmar = window.confirm(
      `Confirma APROVAR e APLICAR imediato?\n\n${TIPO_LABEL[sol.tipoAlteracao]} — ${sol.cooperado?.nomeCompleto ?? sol.cooperadoId}\n\nEsta acao altera o contrato direto e envia WhatsApp ao cooperado.`,
    );
    if (!confirmar) return;
    setAcaoLoading(sol.id);
    try {
      await api.post(`/solicitacoes-contrato/${sol.id}/aprovar`);
      await carregar();
    } catch (e: any) {
      alert(e?.response?.data?.message ?? e?.message ?? 'Erro ao aprovar');
    } finally {
      setAcaoLoading(null);
    }
  }

  async function recusar() {
    if (!solRecusa || obs.trim().length < 3) {
      alert('Observacoes obrigatorias (min 3 caracteres).');
      return;
    }
    setAcaoLoading(solRecusa.id);
    try {
      await api.post(`/solicitacoes-contrato/${solRecusa.id}/recusar`, {
        observacoesEquipe: obs.trim(),
      });
      setSolRecusa(null);
      setObs('');
      await carregar();
    } catch (e: any) {
      alert(e?.response?.data?.message ?? e?.message ?? 'Erro ao recusar');
    } finally {
      setAcaoLoading(null);
    }
  }

  const pendentes = items.filter((s) => s.status === 'PENDENTE');

  return (
    <div className="p-6 space-y-4 max-w-7xl mx-auto">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ClipboardList className="size-7 text-emerald-700" />
          <div>
            <h1 className="text-2xl font-bold">Solicitações de Contrato</h1>
            <p className="text-sm text-gray-600">
              Pedidos do bot WhatsApp (aumentar/diminuir kWh, suspender, encerrar).
            </p>
          </div>
        </div>
        <Badge className={STATUS_COR.PENDENTE}>{pendentes.length} pendente(s)</Badge>
      </header>

      <div className="bg-blue-50 border border-blue-200 rounded-md p-3 flex gap-2 items-start text-sm text-blue-900">
        <Info className="size-4 shrink-0 mt-0.5" />
        <div>
          O bot <strong>nunca</strong> altera contrato direto. Toda alteração passa
          por esta tela. <strong>Aprovar</strong> aplica a mudança no contrato
          imediatamente e dispara WhatsApp ao cooperado. <strong>Recusar</strong> pede
          observações obrigatórias que o cooperado recebe.
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {(['PENDENTE', 'APLICADA', 'RECUSADA', 'TODOS'] as const).map((s) => (
          <Button
            key={s}
            variant={filtroStatus === s ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFiltroStatus(s)}
          >
            {s === 'TODOS' ? 'Todos' : s.charAt(0) + s.slice(1).toLowerCase()}
          </Button>
        ))}
      </div>

      {loading && (
        <div className="text-center py-10 text-gray-500">
          <Loader2 className="size-6 mx-auto animate-spin mb-2" />
          Carregando...
        </div>
      )}

      {erro && (
        <Card className="p-4 bg-red-50 border-red-200 text-red-800">{erro}</Card>
      )}

      {!loading && !erro && items.length === 0 && (
        <Card className="p-10 text-center text-gray-500">
          <ClipboardList className="size-10 mx-auto mb-2 opacity-40" />
          Nenhuma solicitação encontrada.
        </Card>
      )}

      {!loading && !erro && items.length > 0 && (
        <div className="space-y-3">
          {items.map((sol) => (
            <Card key={sol.id} className="p-4">
              <div className="flex justify-between items-start gap-4 flex-wrap">
                <div className="flex-1 min-w-[240px] space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={TIPO_COR[sol.tipoAlteracao]}>
                      {TIPO_LABEL[sol.tipoAlteracao]}
                    </Badge>
                    <Badge className={STATUS_COR[sol.status]} variant="outline">
                      {sol.status}
                    </Badge>
                    <span className="text-xs text-gray-500">{formatarData(sol.createdAt)}</span>
                  </div>
                  <div className="text-sm">
                    <strong>Cooperado:</strong>{' '}
                    {sol.cooperado?.nomeCompleto ?? sol.cooperadoId}
                    {sol.cooperado?.telefone && (
                      <span className="text-gray-500"> · {sol.cooperado.telefone}</span>
                    )}
                  </div>
                  <div className="text-sm text-gray-700">
                    <strong>Contrato:</strong>{' '}
                    {sol.contrato?.kwhContratoMensal != null
                      ? `${Number(sol.contrato.kwhContratoMensal)} kWh/mês atual`
                      : sol.contratoId}
                    {sol.valorPropostoKwh != null && (
                      <span>
                        {' '}
                        → <strong className="text-blue-700">{sol.valorPropostoKwh} kWh/mês</strong>
                      </span>
                    )}
                  </div>
                  {sol.motivo && (
                    <div className="text-sm text-gray-700">
                      <strong>Motivo do cooperado:</strong> {sol.motivo}
                    </div>
                  )}
                  {sol.observacoesEquipe && (
                    <div className="text-sm text-gray-700 bg-gray-50 p-2 rounded">
                      <strong>Obs. equipe:</strong> {sol.observacoesEquipe}
                    </div>
                  )}
                </div>
                {sol.status === 'PENDENTE' && (
                  <div className="flex gap-2 shrink-0">
                    <Button
                      size="sm"
                      onClick={() => aprovar(sol)}
                      disabled={acaoLoading === sol.id}
                      className="bg-emerald-600 hover:bg-emerald-700"
                    >
                      {acaoLoading === sol.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="size-4" />
                      )}
                      <span className="ml-1">Aprovar</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSolRecusa(sol);
                        setObs('');
                      }}
                      disabled={acaoLoading === sol.id}
                    >
                      <XCircle className="size-4" />
                      <span className="ml-1">Recusar</span>
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!solRecusa} onOpenChange={(open) => !open && setSolRecusa(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recusar solicitação</DialogTitle>
            <DialogDescription>
              {solRecusa &&
                `${TIPO_LABEL[solRecusa.tipoAlteracao]} — ${solRecusa.cooperado?.nomeCompleto ?? solRecusa.cooperadoId}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Observações da equipe <span className="text-red-600">*</span>
            </label>
            <Textarea
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              placeholder="Explique o motivo da recusa. O cooperado vai receber esta mensagem."
              rows={4}
              minLength={3}
            />
            <p className="text-xs text-gray-500">
              Mínimo 3 caracteres. Será enviado por WhatsApp ao cooperado.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSolRecusa(null)}>
              Cancelar
            </Button>
            <Button
              onClick={recusar}
              disabled={obs.trim().length < 3 || !!acaoLoading}
              className="bg-red-600 hover:bg-red-700"
            >
              {acaoLoading ? <Loader2 className="size-4 animate-spin mr-1" /> : null}
              Recusar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
