'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  DollarSign,
  Calendar,
  TrendingDown,
  Download,
  CreditCard,
  CheckCircle,
  Clock,
  AlertTriangle,
} from 'lucide-react';

interface CobrancaItem {
  id: string;
  mesReferencia: number;
  anoReferencia: number;
  valorBruto: number;
  valorDesconto: number;
  valorLiquido: number;
  valorMulta: number | null;
  valorJuros: number | null;
  valorAtualizado: number | null;
  status: string;
  dataVencimento: string;
  dataPagamento: string | null;
  asaasCobrancas: { boletoUrl: string | null; linkPagamento: string | null }[];
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  PAGO: { label: 'Pago', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  PENDENTE: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  ATRASADA: { label: 'Atrasada', color: 'bg-red-100 text-red-700', icon: AlertTriangle },
  VENCIDO: { label: 'Vencido', color: 'bg-red-100 text-red-700', icon: AlertTriangle },
  CANCELADO: { label: 'Cancelado', color: 'bg-gray-100 text-gray-500', icon: Clock },
};

export default function PortalFinanceiroPage() {
  const [cobrancas, setCobrancas] = useState<CobrancaItem[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    api
      .get('/cooperados/meu-perfil/cobrancas')
      .then((res) => setCobrancas(res.data))
      .catch(() => {})
      .finally(() => setCarregando(false));
  }, []);

  if (carregando) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-20 bg-gray-200 animate-pulse rounded-xl" />
        ))}
      </div>
    );
  }

  // KPI calculations
  const totalEconomizado = cobrancas
    .filter((c) => c.status === 'PAGO')
    .reduce((acc, c) => acc + Number(c.valorDesconto), 0);

  const proximoVencimento = cobrancas.find((c) => c.status === 'PENDENTE');

  const ultimoPagamento = cobrancas.find((c) => c.status === 'PAGO');

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-gray-800">Financeiro</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                <TrendingDown className="w-5 h-5 text-green-700" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Total economizado</p>
                <p className="text-xl font-bold text-green-700">
                  R$ {totalEconomizado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="pt-3 pb-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-600 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-gray-500">Próx. vencimento</p>
                  <p className="text-sm font-semibold text-gray-800 truncate">
                    {proximoVencimento
                      ? new Date(proximoVencimento.dataVencimento + 'T12:00:00').toLocaleDateString('pt-BR')
                      : '—'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-3 pb-3">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-green-600 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-gray-500">Último pgto.</p>
                  <p className="text-sm font-semibold text-gray-800 truncate">
                    {ultimoPagamento
                      ? `R$ ${Number(ultimoPagamento.valorLiquido).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                      : '—'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Cartão de crédito placeholder */}
      <Card className="bg-gray-50">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CreditCard className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-700">Cartão de crédito</p>
                <p className="text-xs text-gray-400">Pagamento automático</p>
              </div>
            </div>
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
              Em breve
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Lista de cobranças */}
      <div>
        <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">
          Cobranças
        </h2>
        {cobrancas.length === 0 ? (
          <Card>
            <CardContent className="pt-6 pb-6 text-center">
              <DollarSign className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Nenhuma cobrança encontrada.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {cobrancas.map((c) => {
              const cfg = STATUS_CONFIG[c.status] ?? STATUS_CONFIG.PENDENTE;
              const StatusIcon = cfg.icon;
              const mesLabel = `${String(c.mesReferencia).padStart(2, '0')}/${c.anoReferencia}`;
              const boletoUrl = c.asaasCobrancas?.[0]?.boletoUrl ?? c.asaasCobrancas?.[0]?.linkPagamento;
              const temAtualizacao = (c.status === 'ATRASADA' || c.status === 'VENCIDO') &&
                c.valorAtualizado != null && c.valorAtualizado > Number(c.valorLiquido);
              const valorExibido = temAtualizacao ? c.valorAtualizado! : Number(c.valorLiquido);

              return (
                <Card key={c.id}>
                  <CardContent className="pt-3 pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <StatusIcon className={`w-4 h-4 flex-shrink-0 ${c.status === 'PAGO' ? 'text-green-600' : (c.status === 'VENCIDO' || c.status === 'ATRASADA') ? 'text-red-500' : 'text-yellow-500'}`} />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-800">
                            {mesLabel}
                          </p>
                          <p className="text-xs text-gray-500">
                            Venc.: {new Date(c.dataVencimento + 'T12:00:00').toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="text-right">
                          <p className={`text-sm font-bold ${temAtualizacao ? 'text-red-600' : 'text-gray-800'}`}>
                            R$ {valorExibido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                          {temAtualizacao && (
                            <p className="text-xs text-gray-400 line-through">
                              R$ {Number(c.valorLiquido).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </p>
                          )}
                          {temAtualizacao && (
                            <p className="text-xs text-red-500">
                              Multa R$ {Number(c.valorMulta ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              {' + '}Juros R$ {Number(c.valorJuros ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </p>
                          )}
                          <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${cfg.color}`}>
                            {cfg.label}
                          </span>
                        </div>
                        {boletoUrl && c.status !== 'PAGO' && (
                          <a
                            href={boletoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="p-1.5 text-gray-400 hover:text-green-600 transition-colors"
                            title="Download boleto"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
