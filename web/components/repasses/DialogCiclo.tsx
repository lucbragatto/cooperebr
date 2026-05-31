'use client';

/**
 * D-novo-BR-CT estorno (31/05/2026 noite) — Dialog visualização do ciclo contábil
 * do repasse PAGO.
 *
 * Mostra: lançamento gerado (natureza + valor + competência) +
 * despesas abatidas (lista). Resolve o gap "não vi pra onde foi" do smoke Luciano.
 */

import { useEffect, useState } from 'react';
import { Loader2, FileText, ArrowDownCircle, Receipt } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import api from '@/lib/api';
import { fmtMoney, fmtDate, type Repasse } from './types';

interface Ciclo {
  repasse: Repasse;
  lancamentoGerado: {
    id: string;
    tipo: string;
    descricao: string;
    valor: number;
    naturezaAto: string;
    status: string;
    competencia: string;
    dataPagamento: string | null;
  } | null;
  despesasAbatidas: Array<{
    id: string;
    descricao: string;
    categoria: string | null;
    valor: number;
    dataOcorrencia: string;
  }>;
}

interface DialogCicloProps {
  repasseId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const NATUREZA_COLOR: Record<string, string> = {
  PROPRIO: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  AUXILIAR: 'bg-blue-100 text-blue-800 border-blue-300',
  NAO_COOPERATIVO: 'bg-rose-100 text-rose-800 border-rose-300',
};

export function DialogCiclo({ repasseId, open, onOpenChange }: DialogCicloProps) {
  const [ciclo, setCiclo] = useState<Ciclo | null>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setErro('');
    api
      .get<Ciclo>(`/repasses/${repasseId}/ciclo`)
      .then((r) => setCiclo(r.data))
      .catch((e) => setErro(e?.response?.data?.message ?? 'Falha ao carregar ciclo'))
      .finally(() => setLoading(false));
  }, [open, repasseId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-cyan-700" />
            Ciclo contábil do repasse
          </DialogTitle>
          <DialogDescription>
            Onde foi o dinheiro: lançamento gerado e despesas abatidas no momento do pagamento.
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-cyan-700" />
          </div>
        )}

        {erro && (
          <div className="bg-red-50 border-l-4 border-red-500 p-3 text-sm text-red-700 rounded">
            {erro}
          </div>
        )}

        {ciclo && !loading && (
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            {/* Lançamento gerado */}
            <div className="border rounded p-3 bg-gray-50">
              <h3 className="text-xs font-semibold text-gray-600 flex items-center gap-1 mb-2">
                <ArrowDownCircle className="h-3.5 w-3.5" />
                Lançamento contábil gerado
              </h3>
              {ciclo.lancamentoGerado ? (
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Descrição</span>
                    <span className="font-medium">{ciclo.lancamentoGerado.descricao}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Tipo</span>
                    <span>{ciclo.lancamentoGerado.tipo}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Natureza cooperativa</span>
                    <Badge
                      variant="outline"
                      className={NATUREZA_COLOR[ciclo.lancamentoGerado.naturezaAto] ?? ''}
                    >
                      {ciclo.lancamentoGerado.naturezaAto}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Valor</span>
                    <span className="font-semibold tabular-nums">
                      {fmtMoney(ciclo.lancamentoGerado.valor)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Competência</span>
                    <span className="font-mono text-xs">{ciclo.lancamentoGerado.competencia}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Status</span>
                    <span>{ciclo.lancamentoGerado.status}</span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-gray-500 italic">
                  Sem lançamento contábil — repasse ainda não pago OU estornado.
                </p>
              )}
            </div>

            {/* Despesas abatidas */}
            <div className="border rounded p-3">
              <h3 className="text-xs font-semibold text-gray-600 flex items-center gap-1 mb-2">
                <Receipt className="h-3.5 w-3.5" />
                Despesas abatidas no repasse ({ciclo.despesasAbatidas.length})
              </h3>
              {ciclo.despesasAbatidas.length === 0 ? (
                <p className="text-xs text-gray-500 italic">
                  Nenhuma despesa foi abatida neste repasse.
                </p>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b text-gray-500">
                      <th className="text-left py-1">Descrição</th>
                      <th className="text-left py-1">Categoria</th>
                      <th className="text-left py-1">Ocorrência</th>
                      <th className="text-right py-1">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ciclo.despesasAbatidas.map((d) => (
                      <tr key={d.id} className="border-b">
                        <td className="py-1">{d.descricao}</td>
                        <td className="py-1 text-gray-600">{d.categoria ?? '—'}</td>
                        <td className="py-1 text-gray-600">{fmtDate(d.dataOcorrencia)}</td>
                        <td className="py-1 text-right tabular-nums">{fmtMoney(d.valor)}</td>
                      </tr>
                    ))}
                    <tr className="border-t font-semibold bg-gray-50">
                      <td colSpan={3} className="py-1.5 px-1">
                        Total abatido
                      </td>
                      <td className="text-right py-1.5 tabular-nums px-1">
                        {fmtMoney(ciclo.despesasAbatidas.reduce((s, d) => s + d.valor, 0))}
                      </td>
                    </tr>
                  </tbody>
                </table>
              )}
            </div>

            <p className="text-[10px] text-gray-500 border-t pt-2">
              Caso precise reverter este pagamento, use "Estornar" — o ciclo todo é desfeito atomicamente.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
