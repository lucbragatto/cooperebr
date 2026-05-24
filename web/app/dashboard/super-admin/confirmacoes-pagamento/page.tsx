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
import { Wallet, CheckCircle2, XCircle, Loader2, Info } from 'lucide-react';

type StatusConfirmacao = 'PENDENTE' | 'CONFIRMADA' | 'RECUSADA';

interface Solicitacao {
  id: string;
  cooperadoId: string;
  cooperativaId: string;
  cobrancaId: string;
  valorReclamado: number | string | null;
  formaPagamentoReclamada: string | null;
  status: StatusConfirmacao;
  createdAt: string;
  processadaEm: string | null;
  observacoesEquipe: string | null;
  cooperado?: { id: string; nomeCompleto: string | null; telefone: string | null };
  cobranca?: {
    id: string;
    valorLiquido: number | string | null;
    mesReferencia: number;
    anoReferencia: number;
    status: string;
    dataVencimento: string;
  };
}

const STATUS_COR: Record<StatusConfirmacao, string> = {
  PENDENTE: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  CONFIRMADA: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  RECUSADA: 'bg-gray-100 text-gray-800 border-gray-200',
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

function formatarValor(v: number | string | null | undefined): string {
  if (v == null) return '-';
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function ConfirmacoesPagamentoPage() {
  const [items, setItems] = useState<Solicitacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [filtroStatus, setFiltroStatus] = useState<StatusConfirmacao | 'TODOS'>('PENDENTE');
  const [acaoLoading, setAcaoLoading] = useState<string | null>(null);

  const [solRecusa, setSolRecusa] = useState<Solicitacao | null>(null);
  const [obs, setObs] = useState('');

  const [solConfirma, setSolConfirma] = useState<Solicitacao | null>(null);
  const [marcarPago, setMarcarPago] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const url = filtroStatus === 'TODOS'
        ? '/solicitacoes-confirmacao-pagamento'
        : `/solicitacoes-confirmacao-pagamento?status=${filtroStatus}`;
      const res = await api.get<Solicitacao[]>(url);
      setItems(res.data);
    } catch (e: any) {
      setErro(e?.response?.data?.message ?? e?.message ?? 'Erro ao carregar');
    } finally {
      setLoading(false);
    }
  }, [filtroStatus]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function confirmar() {
    if (!solConfirma) return;
    setAcaoLoading(solConfirma.id);
    try {
      await api.post(`/solicitacoes-confirmacao-pagamento/${solConfirma.id}/confirmar`, {
        marcarPago,
      });
      setSolConfirma(null);
      setMarcarPago(false);
      await carregar();
    } catch (e: any) {
      alert(e?.response?.data?.message ?? e?.message ?? 'Erro ao confirmar');
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
      await api.post(`/solicitacoes-confirmacao-pagamento/${solRecusa.id}/recusar`, {
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
          <Wallet className="size-7 text-emerald-700" />
          <div>
            <h1 className="text-2xl font-bold">Confirmações de Pagamento</h1>
            <p className="text-sm text-gray-600">
              Cooperados que avisaram via WhatsApp que pagaram a fatura.
            </p>
          </div>
        </div>
        <Badge className={STATUS_COR.PENDENTE}>{pendentes.length} pendente(s)</Badge>
      </header>

      <div className="bg-blue-50 border border-blue-200 rounded-md p-3 flex gap-2 items-start text-sm text-blue-900">
        <Info className="size-4 shrink-0 mt-0.5" />
        <div>
          O bot <strong>nunca</strong> dá baixa direto na cobrança. Quando o cooperado
          informa que pagou (PIX direto, transferência, depósito), o caso aparece aqui.
          <strong> Confirmar</strong> opcionalmente marca a cobrança como PAGA. <strong>Recusar</strong> manda
          uma mensagem ao cooperado com as observações da equipe.
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {(['PENDENTE', 'CONFIRMADA', 'RECUSADA', 'TODOS'] as const).map((s) => (
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
          <Wallet className="size-10 mx-auto mb-2 opacity-40" />
          Nenhuma confirmação encontrada.
        </Card>
      )}

      {!loading && !erro && items.length > 0 && (
        <div className="space-y-3">
          {items.map((sol) => (
            <Card key={sol.id} className="p-4">
              <div className="flex justify-between items-start gap-4 flex-wrap">
                <div className="flex-1 min-w-[240px] space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
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
                  {sol.cobranca && (
                    <div className="text-sm text-gray-700">
                      <strong>Fatura:</strong>{' '}
                      {String(sol.cobranca.mesReferencia).padStart(2, '0')}/{sol.cobranca.anoReferencia} —{' '}
                      {formatarValor(sol.cobranca.valorLiquido)} —{' '}
                      <span className="text-xs">venc. {new Date(sol.cobranca.dataVencimento).toLocaleDateString('pt-BR')}</span>
                      {' · '}
                      <span className="text-xs uppercase text-gray-500">{sol.cobranca.status}</span>
                    </div>
                  )}
                  {sol.formaPagamentoReclamada && (
                    <div className="text-sm text-gray-700">
                      <strong>Forma reclamada:</strong> {sol.formaPagamentoReclamada}
                    </div>
                  )}
                  {sol.valorReclamado != null && (
                    <div className="text-sm text-gray-700">
                      <strong>Valor reclamado:</strong> {formatarValor(sol.valorReclamado)}
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
                      onClick={() => {
                        setSolConfirma(sol);
                        setMarcarPago(false);
                      }}
                      disabled={acaoLoading === sol.id}
                      className="bg-emerald-600 hover:bg-emerald-700"
                    >
                      {acaoLoading === sol.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="size-4" />
                      )}
                      <span className="ml-1">Confirmar</span>
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

      <Dialog open={!!solConfirma} onOpenChange={(open) => !open && setSolConfirma(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar pagamento</DialogTitle>
            <DialogDescription>
              {solConfirma?.cobranca &&
                `Fatura ${String(solConfirma.cobranca.mesReferencia).padStart(2, '0')}/${solConfirma.cobranca.anoReferencia} — ${formatarValor(solConfirma.cobranca.valorLiquido)}`}
              {solConfirma?.cooperado?.nomeCompleto && ` — ${solConfirma.cooperado.nomeCompleto}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <label className="flex items-start gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={marcarPago}
                onChange={(e) => setMarcarPago(e.target.checked)}
                className="mt-1"
              />
              <span>
                <strong>Marcar cobrança como PAGA</strong>
                <p className="text-xs text-gray-500 mt-0.5">
                  Atualiza o status da cobrança no banco direto. Use quando já validou o
                  pagamento no gateway/banco. Desmarcado: apenas registra a confirmação,
                  cobrança continua em aberto até o gateway bater.
                </p>
              </span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSolConfirma(null)}>
              Cancelar
            </Button>
            <Button
              onClick={confirmar}
              disabled={!!acaoLoading}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {acaoLoading ? <Loader2 className="size-4 animate-spin mr-1" /> : null}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!solRecusa} onOpenChange={(open) => !open && setSolRecusa(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recusar confirmação</DialogTitle>
            <DialogDescription>
              {solRecusa?.cooperado?.nomeCompleto ?? solRecusa?.cooperadoId}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Observações da equipe <span className="text-red-600">*</span>
            </label>
            <Textarea
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              placeholder="Explique por que não foi possível validar (ex: não encontramos o PIX no extrato, valor diferente, etc). O cooperado vai receber essa mensagem."
              rows={4}
              minLength={3}
            />
            <p className="text-xs text-gray-500">
              Mínimo 3 caracteres. Enviado por WhatsApp ao cooperado.
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
