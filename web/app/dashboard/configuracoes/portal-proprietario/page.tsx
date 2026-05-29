'use client';

/**
 * D-novo-BH BH.4 (M37, 29/05/2026) — Configuração do Portal Proprietário.
 *
 * Tela admin minimal: toggle `proprietarioVeDespesas` controla se o
 * portal proprietário exibe a aba "Despesas" pros donos das usinas.
 *
 * Endpoint backend: PUT /cooperativas/:id/proprietario-ve-despesas
 *   - Admin parceiro só toggla a própria cooperativa (assertSameTenantOrSuperAdmin)
 *   - SUPER_ADMIN qualquer
 *
 * Padrão UX Dual 17/05 Tipo B (página própria — entidade inteira).
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Info, Loader2, CheckCircle, XCircle, Eye, EyeOff } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import api from '@/lib/api';

interface MinhaCooperativa {
  id: string;
  nome: string;
  proprietarioVeDespesas?: boolean;
}

export default function PortalProprietarioConfigPage() {
  const [cooperativa, setCooperativa] = useState<MinhaCooperativa | null>(null);
  const [flagAtiva, setFlagAtiva] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [toast, setToast] = useState<{ tipo: 'sucesso' | 'erro'; msg: string } | null>(null);

  useEffect(() => {
    api
      .get<MinhaCooperativa[]>('/cooperativas')
      .then((r) => {
        const lista = r.data ?? [];
        if (lista.length === 0) return;
        const coop = lista[0];
        setCooperativa(coop);
        setFlagAtiva(Boolean(coop.proprietarioVeDespesas));
      })
      .catch(() => setToast({ tipo: 'erro', msg: 'Erro ao carregar cooperativa.' }))
      .finally(() => setCarregando(false));
  }, []);

  function showToast(tipo: 'sucesso' | 'erro', msg: string) {
    setToast({ tipo, msg });
    setTimeout(() => setToast(null), 3000);
  }

  async function handleToggle(novoValor: boolean) {
    if (!cooperativa) return;
    const valorAnterior = flagAtiva;
    setFlagAtiva(novoValor); // otimista
    setSalvando(true);
    try {
      await api.put(`/cooperativas/${cooperativa.id}/proprietario-ve-despesas`, {
        ativo: novoValor,
      });
      showToast(
        'sucesso',
        novoValor
          ? 'Aba "Despesas" agora visível no portal proprietário.'
          : 'Aba "Despesas" oculta no portal proprietário.',
      );
    } catch {
      setFlagAtiva(valorAnterior); // rollback
      showToast('erro', 'Erro ao salvar configuração.');
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-amber-600 animate-spin" />
      </div>
    );
  }

  if (!cooperativa) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/configuracoes">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
            </Button>
          </Link>
        </div>
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Cooperativa não encontrada no seu contexto.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/configuracoes">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Portal do Proprietário</h1>
          <p className="text-sm text-gray-500 mt-0.5">{cooperativa.nome}</p>
        </div>
      </div>

      {/* Help inline (regra UX 19/05) */}
      <div className="bg-blue-50 border border-blue-200 rounded-md p-4 flex gap-3 max-w-3xl">
        <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-900 space-y-1.5">
          <p>
            O <strong>Portal do Proprietário</strong> é a área onde os donos das usinas
            arrendadas/parceiras acompanham: dashboard, usinas, repasses e contratos.
          </p>
          <p>
            A aba <strong>Despesas</strong> permite que o proprietário <em>veja</em> e{' '}
            <em>proponha</em> despesas operacionais (manutenção, vigilância, IPTU…) das
            usinas dele. Toda proposta passa por aprovação do admin parceiro antes de
            virar desconto no repasse ou reembolso.
          </p>
        </div>
      </div>

      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            {flagAtiva ? (
              <Eye className="w-5 h-5 text-green-600" />
            ) : (
              <EyeOff className="w-5 h-5 text-gray-400" />
            )}
            Visibilidade da aba "Despesas"
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-6 py-2">
            <div className="space-y-1">
              <p className="text-sm font-medium text-gray-800">
                Exibir aba "Despesas" no portal do proprietário
              </p>
              <p className="text-xs text-gray-500 max-w-lg">
                Quando ativada, proprietários verão lista de despesas das suas usinas e
                poderão propor novas (com workflow de aprovação obrigatório).
              </p>
            </div>
            <div className="flex items-center gap-2">
              {salvando && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
              <Switch
                checked={flagAtiva}
                onCheckedChange={handleToggle}
                disabled={salvando}
              />
            </div>
          </div>

          <div
            className={`text-xs px-3 py-2 rounded-md ${
              flagAtiva
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-gray-50 text-gray-600 border border-gray-200'
            }`}
          >
            {flagAtiva ? (
              <>
                <strong>Status atual:</strong> aba visível — proprietários veem e podem
                propor despesas.
              </>
            ) : (
              <>
                <strong>Status atual:</strong> aba oculta — proprietários não veem a
                seção de despesas no portal.
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {toast && (
        <div
          className={`fixed bottom-6 right-6 px-4 py-3 rounded-md shadow-lg flex items-center gap-2 text-sm font-medium ${
            toast.tipo === 'sucesso'
              ? 'bg-green-600 text-white'
              : 'bg-red-600 text-white'
          }`}
        >
          {toast.tipo === 'sucesso' ? (
            <CheckCircle className="w-4 h-4" />
          ) : (
            <XCircle className="w-4 h-4" />
          )}
          {toast.msg}
        </div>
      )}
    </div>
  );
}
