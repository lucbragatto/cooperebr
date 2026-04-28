'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { Card } from '@/components/ui/card';
import { ResumoSaas } from '@/types';
import { Building2, Users, DollarSign, AlertCircle, TrendingUp } from 'lucide-react';

function formatBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function SuperAdminDashboard() {
  const [resumo, setResumo] = useState<ResumoSaas | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<ResumoSaas>('/saas/dashboard')
      .then((r) => setResumo(r.data))
      .catch((e) => setErro(e?.response?.data?.message ?? e?.message ?? 'Erro ao carregar'));
  }, []);

  if (erro) {
    return (
      <div className="p-6">
        <Card className="p-4 bg-red-50 border-red-200 text-red-800">Erro: {erro}</Card>
      </div>
    );
  }
  if (!resumo) return <div className="p-6 text-gray-500">Carregando…</div>;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-800">Painel SISGD</h1>
        <p className="text-sm text-gray-500">
          Visão consolidada da plataforma · Atualizado em{' '}
          {new Date(resumo.geradoEm).toLocaleString('pt-BR')}
        </p>
      </div>

      {resumo.parceirosComIncendio.length > 0 ? (
        <Card className="p-4 bg-red-50 border-red-200">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-red-600 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-red-900">
                {resumo.parceirosComIncendio.length} parceiro(s) com inadimplência alta
              </h3>
              <ul className="mt-2 space-y-1 text-sm">
                {resumo.parceirosComIncendio.map((p) => (
                  <li key={p.cooperativaId} className="text-red-800">
                    <Link href={`/dashboard/cooperativas/${p.cooperativaId}`} className="hover:underline">
                      <strong>{p.nome}</strong>
                    </Link>{' '}
                    — {p.taxaVencimentoPerc}% vencidas ({p.vencidas} de {p.totalCobrancas})
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      ) : (
        <Card className="p-4 bg-green-50 border-green-200">
          <div className="flex items-center gap-3">
            <span className="text-2xl">✅</span>
            <p className="font-medium text-green-900">Sem incêndios. Tudo nos eixos.</p>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Building2 className="w-8 h-8 text-blue-600 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm text-gray-500">Parceiros Ativos</p>
              <p className="text-2xl font-bold">{resumo.totalParceiros}</p>
              <p className="text-xs text-gray-400 truncate">
                {resumo.parceirosPorTipo.length === 0
                  ? '—'
                  : resumo.parceirosPorTipo.map((p) => `${p.count} ${p.tipo}`).join(' · ')}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Users className="w-8 h-8 text-green-600 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm text-gray-500">Membros Ativos (total)</p>
              <p className="text-2xl font-bold">{resumo.totalMembrosAtivos}</p>
              <p className="text-xs text-gray-400">em todos os parceiros</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <DollarSign className="w-8 h-8 text-emerald-600 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm text-gray-500">Faturado este mês</p>
              <p className="text-2xl font-bold">{formatBRL(resumo.faturamentoMesAtual.totalReais)}</p>
              <p className="text-xs text-gray-400">
                {resumo.faturamentoMesAtual.totalCobrancas} cobrança(s) paga(s)
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-8 h-8 text-purple-600 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm text-gray-500">MRR plataforma</p>
              <p className="text-2xl font-bold">{formatBRL(resumo.mrr.total)}</p>
              <p className="text-xs text-gray-400 truncate">
                {formatBRL(resumo.mrr.fixo)} fixo · {formatBRL(resumo.mrr.variavelEstimado)} estimado
              </p>
            </div>
          </div>
        </Card>
      </div>

      {resumo.inadimplenciaSaaS.qtdFaturasVencidas > 0 && (
        <Card className="p-4 bg-amber-50 border-amber-200">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-amber-600" />
            <div className="flex-1">
              <p className="font-semibold text-amber-900">
                Você (SISGD) tem a receber: {formatBRL(resumo.inadimplenciaSaaS.valorVencido)}
              </p>
              <p className="text-sm text-amber-700">
                {resumo.inadimplenciaSaaS.qtdFaturasVencidas} fatura(s) SaaS vencida(s) — parceiros não pagaram a plataforma
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
