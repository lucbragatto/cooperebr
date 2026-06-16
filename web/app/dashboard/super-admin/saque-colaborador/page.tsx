'use client';

/**
 * Sprint D2 (16/06/2026) — Painel super-admin pra toggle do "Saque PIX
 * Colaborador Comum" por cooperativa.
 *
 * Gate dual:
 *  (A) flag tenant Cooperativa.saqueColaboradorAtivo (este toggle liga).
 *  (B) env SAQUE_COLABORADOR_PRODUCAO_LIBERADO=true (Luciano libera após
 *      parecer escrito do cooperebr-analista-conformidade).
 *
 * Toggle nasce OFF. Mesmo ON em produção real, sem o env, NÃO tem efeito
 * (UI mostra banner âmbar). Espelha o gate de oxidação (OXIDACAO_PRODUCAO_
 * LIBERADA).
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Banknote, ArrowLeft, Power, AlertCircle, AlertTriangle } from 'lucide-react';

interface ParceiroEnriquecido {
  id: string;
  nome: string;
  saqueColaboradorAtivo?: boolean;
  saqueColaboradorAtivadoEm?: string | null;
}

interface SaqueColaboradorStatus {
  id: string;
  saqueColaboradorAtivo: boolean;
  saqueColaboradorAtivadoEm: string | null;
  ambienteReal: boolean;
  envProducaoLiberado: boolean;
  gateProducaoEfetivo: boolean;
}

export default function SuperAdminSaqueColaborador() {
  const [parceiros, setParceiros] = useState<ParceiroEnriquecido[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [atualizandoId, setAtualizandoId] = useState<string | null>(null);
  // Status de produção lido do PRIMEIRO parceiro carregado — o env é GLOBAL
  // (não-tenant), então qualquer cooperativa serve pra detectar.
  const [envGlobal, setEnvGlobal] = useState<{
    ambienteReal: boolean;
    envProducaoLiberado: boolean;
  } | null>(null);

  async function recarregar() {
    setCarregando(true);
    try {
      const parceirosRes = await api.get<ParceiroEnriquecido[]>('/saas/parceiros');
      setParceiros(parceirosRes.data);
      // Detecta gate global usando o 1º parceiro pra ler env (mesmo flag OFF).
      if (parceirosRes.data.length > 0) {
        const probeRes = await api.get<SaqueColaboradorStatus>(
          `/saas/cooperativas/${parceirosRes.data[0].id}/saque-colaborador`,
        );
        setEnvGlobal({
          ambienteReal: probeRes.data.ambienteReal,
          envProducaoLiberado: probeRes.data.envProducaoLiberado,
        });
      }
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
      await api.patch(`/saas/cooperativas/${p.id}/saque-colaborador`, {
        ativo: !p.saqueColaboradorAtivo,
      });
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

  // Banner âmbar quando produção real + env OFF (toggle ON não tem efeito).
  const banner =
    envGlobal && envGlobal.ambienteReal && !envGlobal.envProducaoLiberado;

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
          <Banknote className="w-8 h-8 text-emerald-600" />
          Saque PIX Colaborador — Gestão por Parceiro
        </h1>
        <p className="text-sm text-gray-500">
          Toggle por cooperativa pra permitir cooperados NÃO-Estabelecimento solicitarem
          resgate de tokens em R$ via PIX. Espelha o gate da oxidação. Toggle nasce OFF.
        </p>
      </div>

      {/* Banner âmbar — gate de produção bloqueado */}
      {banner && (
        <Card className="p-4 bg-amber-50 border-amber-300 text-amber-900">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" />
            <div className="text-sm space-y-1">
              <p className="font-semibold">
                Toggle ON tem efeito ZERO em produção sem o env de gate liberado.
              </p>
              <p>
                Variável <code className="px-1 py-0.5 bg-amber-100 rounded text-xs">
                  SAQUE_COLABORADOR_PRODUCAO_LIBERADO=true
                </code>{' '}
                NÃO está setada no <code className="px-1 py-0.5 bg-amber-100 rounded text-xs">backend/.env</code>.
                Ligar exige parecer escrito do <strong>cooperebr-analista-conformidade</strong> antes:
                o saque de cooperado comum é juridicamente sensível (pode ser visto como
                uso indevido do voucher como meio de saque se mal narrado vs liquidação
                de voucher protegida pelo Art. 79 Lei 5.764/71).
              </p>
            </div>
          </div>
        </Card>
      )}

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
                    {p.saqueColaboradorAtivo
                      ? `Ativo desde ${
                          p.saqueColaboradorAtivadoEm
                            ? new Date(p.saqueColaboradorAtivadoEm).toLocaleDateString('pt-BR')
                            : '—'
                        }`
                      : 'Não ativo'}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`text-xs px-2 py-1 rounded border ${
                      p.saqueColaboradorAtivo
                        ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                        : 'bg-gray-100 text-gray-600 border-gray-200'
                    }`}
                  >
                    {p.saqueColaboradorAtivo ? 'ATIVO' : 'INATIVO'}
                  </span>
                  <Button
                    variant={p.saqueColaboradorAtivo ? 'outline' : 'default'}
                    onClick={() => alternar(p)}
                    disabled={atualizandoId === p.id}
                    className={
                      p.saqueColaboradorAtivo
                        ? ''
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    }
                  >
                    <Power className="w-4 h-4 mr-2" />
                    {atualizandoId === p.id
                      ? '…'
                      : p.saqueColaboradorAtivo
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
        <strong>Help:</strong> ligar este toggle pra uma cooperativa permite que
        cooperados comuns (não-Estabelecimento) vejam o card "Resgatar em R$ via PIX"
        em <code className="px-1 py-0.5 bg-cyan-100 rounded">/portal/tokens</code> +
        acessem <code className="px-1 py-0.5 bg-cyan-100 rounded">/portal/resgatar-tokens</code>.
        O fluxo (PIX-out Asaas + webhook + recibo + contábil D Passivo/C Caixa) é
        idêntico ao do Estabelecimento (M35). Toggle não basta em produção real —
        gate dual exige também env <code className="px-1 py-0.5 bg-cyan-100 rounded">
          SAQUE_COLABORADOR_PRODUCAO_LIBERADO=true
        </code>.
      </Card>
    </div>
  );
}
