'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShieldCheck, ArrowLeft, Power, AlertCircle } from 'lucide-react';

interface CoopAtiva {
  id: string;
  nome: string;
  ativadoEm: string | null;
}

interface ParceiroEnriquecido {
  id: string;
  nome: string;
  moduloConciergeAtivo?: boolean;
  conciergeAtivadoEm?: string | null;
}

export default function SuperAdminConcierge() {
  const [parceiros, setParceiros] = useState<ParceiroEnriquecido[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [atualizandoId, setAtualizandoId] = useState<string | null>(null);

  async function recarregar() {
    setCarregando(true);
    try {
      const parceirosRes = await api.get<ParceiroEnriquecido[]>('/saas/parceiros');
      const ativasRes = await api.get<{ items: CoopAtiva[] }>(
        '/concierge/saas/cooperativas-ativas',
      );
      const setAtivas = new Set(ativasRes.data.items.map((c) => c.id));
      const merged = parceirosRes.data.map((p) => ({
        ...p,
        moduloConciergeAtivo: setAtivas.has(p.id),
        conciergeAtivadoEm:
          ativasRes.data.items.find((c) => c.id === p.id)?.ativadoEm ?? null,
      }));
      setParceiros(merged);
    } catch (e: any) {
      setErro(e?.response?.data?.message ?? e?.message ?? 'Erro ao carregar');
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    recarregar();
  }, []);

  async function alternar(p: ParceiroEnriquecido) {
    setAtualizandoId(p.id);
    try {
      const endpoint = p.moduloConciergeAtivo
        ? `/concierge/saas/cooperativas/${p.id}/desativar`
        : `/concierge/saas/cooperativas/${p.id}/ativar`;
      await api.patch(endpoint);
      await recarregar();
    } catch (e: any) {
      setErro(e?.response?.data?.message ?? e?.message ?? 'Erro ao alterar');
    } finally {
      setAtualizandoId(null);
    }
  }

  if (erro) {
    return (
      <div className="p-6">
        <Card className="p-4 bg-red-50 border-red-200 text-red-800 flex items-center gap-2">
          <AlertCircle className="w-5 h-5" /> {erro}
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <Link
          href="/dashboard/super-admin"
          className="text-sm text-emerald-600 hover:underline flex items-center gap-1 mb-2"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar ao Painel SISGD
        </Link>
        <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
          <ShieldCheck className="w-8 h-8 text-emerald-600" />
          Concierge SaaS — Gestão por Parceiro
        </h1>
        <p className="text-sm text-gray-500">
          Ative ou desative o módulo Concierge Tributário por cooperativa. Plano OURO
          incluirá automaticamente no futuro.
        </p>
      </div>

      <Card className="p-4">
        {carregando ? (
          <div className="text-gray-500 text-sm py-8 text-center">Carregando…</div>
        ) : parceiros.length === 0 ? (
          <div className="text-gray-500 text-sm py-8 text-center">
            Nenhum parceiro cadastrado.
          </div>
        ) : (
          <div className="divide-y">
            {parceiros.map((p) => (
              <div
                key={p.id}
                className="py-3 flex items-center justify-between gap-4"
              >
                <div>
                  <div className="font-medium text-gray-800">{p.nome}</div>
                  <div className="text-xs text-gray-500">
                    {p.moduloConciergeAtivo
                      ? `Ativo desde ${
                          p.conciergeAtivadoEm
                            ? new Date(p.conciergeAtivadoEm).toLocaleDateString(
                                'pt-BR',
                              )
                            : '—'
                        }`
                      : 'Não ativo'}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`text-xs px-2 py-1 rounded border ${
                      p.moduloConciergeAtivo
                        ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                        : 'bg-gray-100 text-gray-600 border-gray-200'
                    }`}
                  >
                    {p.moduloConciergeAtivo ? 'ATIVO' : 'INATIVO'}
                  </span>
                  <Button
                    variant={p.moduloConciergeAtivo ? 'outline' : 'default'}
                    onClick={() => alternar(p)}
                    disabled={atualizandoId === p.id}
                    className={
                      p.moduloConciergeAtivo
                        ? ''
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    }
                  >
                    <Power className="w-4 h-4 mr-2" />
                    {atualizandoId === p.id
                      ? '…'
                      : p.moduloConciergeAtivo
                      ? 'Desativar'
                      : 'Ativar'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-4 bg-cyan-50 border-cyan-200 text-sm text-cyan-800">
        <strong>Importante:</strong> ativar o Concierge libera o painel{' '}
        <code className="px-1 py-0.5 bg-cyan-100 rounded">/dashboard/concierge</code>{' '}
        pra todos os admins da cooperativa. Diagnósticos persistidos virão em
        Sprint C4. Auditoria fiscal das 8 faturas analisadas já gerou material
        consolidado em{' '}
        <code className="px-1 py-0.5 bg-cyan-100 rounded">
          docs/concierge/2026-06-11-*.md
        </code>
        .
      </Card>
    </div>
  );
}
