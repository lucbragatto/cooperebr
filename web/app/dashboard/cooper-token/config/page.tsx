'use client';

/**
 * Sprint Clube P1 — Fase 1.5 Bloco 4 (10/06/2026).
 *
 * Pagina dedicada de Configuracao da Economia do CooperToken — entidade
 * inteira = pagina propria (padrao UX Tipo B do projeto). Substitui a
 * edicao duplicada que estava em /parceiro/configuracoes (la fica so um
 * LINK pra cá; fonte unica).
 *
 * 4 secoes:
 *  1. Geral — modo de geracao, vida, valor R$, desconto max, bonus, limite,
 *     teto.
 *  2. Taxa de Operacao — 4 pares (% + fixo) per-operacao. Defaults preservam
 *     2% emissao + 1% QR.
 *  3. Oxidacao DECAY_CONTINUO — perc mes + graca + piso. Banner ambar dupla
 *     consequencia: financeiro + gate juridico.
 *  4. Status — ativo / desativado.
 *
 * Help inline azul (regra UX 19/05). Botao "← Voltar ao Clube" no topo.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Info,
  AlertTriangle,
  Coins,
  Receipt,
  TrendingDown,
  Loader2,
} from 'lucide-react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface CooperTokenConfig {
  // Geral
  modoGeracao: string;
  modeloVida: string;
  limiteTokenMensal: number | null;
  valorTokenReais: number;
  descontoMaxPerc: number;
  bonusIndicacao: number;
  tetoCoop: number | null;
  ativo: boolean;
  // Taxas (Bloco 2)
  taxaEmissaoPerc: number;
  taxaEmissaoFixa: number;
  taxaQrPerc: number;
  taxaQrFixa: number;
  taxaTransferenciaPerc: number;
  taxaTransferenciaFixa: number;
  taxaResgatePerc: number;
  taxaResgateFixa: number;
  // Oxidacao (Bloco 3)
  oxidacaoPercMes: number;
  oxidacaoPeriodoGracaDias: number;
  oxidacaoPiso: number;
  oxidacaoAtivadaEm: string | null;
}

const DEFAULTS: CooperTokenConfig = {
  modoGeracao: 'AMBOS',
  modeloVida: 'AMBOS',
  limiteTokenMensal: null,
  valorTokenReais: 0.45,
  descontoMaxPerc: 30,
  bonusIndicacao: 50,
  tetoCoop: null,
  ativo: true,
  taxaEmissaoPerc: 2,
  taxaEmissaoFixa: 0,
  taxaQrPerc: 1,
  taxaQrFixa: 0,
  taxaTransferenciaPerc: 0,
  taxaTransferenciaFixa: 0,
  taxaResgatePerc: 0,
  taxaResgateFixa: 0,
  oxidacaoPercMes: 0,
  oxidacaoPeriodoGracaDias: 0,
  oxidacaoPiso: 0,
  oxidacaoAtivadaEm: null,
};

function toNum(v: any, def: number): number {
  if (v == null) return def;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isNaN(n) ? def : n;
}

export default function CooperTokenConfigPage() {
  const router = useRouter();
  const [config, setConfig] = useState<CooperTokenConfig>(DEFAULTS);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const { data } = await api.get('/cooper-token/admin/config');
      if (data && typeof data === 'object' && Object.keys(data).length > 0) {
        setConfig({
          modoGeracao: data.modoGeracao ?? DEFAULTS.modoGeracao,
          modeloVida: data.modeloVida ?? DEFAULTS.modeloVida,
          limiteTokenMensal: data.limiteTokenMensal ?? null,
          valorTokenReais: toNum(data.valorTokenReais, DEFAULTS.valorTokenReais),
          descontoMaxPerc: toNum(data.descontoMaxPerc, DEFAULTS.descontoMaxPerc),
          bonusIndicacao: toNum(data.bonusIndicacao, DEFAULTS.bonusIndicacao),
          tetoCoop: data.tetoCoop ?? null,
          ativo: data.ativo ?? true,
          taxaEmissaoPerc: toNum(data.taxaEmissaoPerc, DEFAULTS.taxaEmissaoPerc),
          taxaEmissaoFixa: toNum(data.taxaEmissaoFixa, DEFAULTS.taxaEmissaoFixa),
          taxaQrPerc: toNum(data.taxaQrPerc, DEFAULTS.taxaQrPerc),
          taxaQrFixa: toNum(data.taxaQrFixa, DEFAULTS.taxaQrFixa),
          taxaTransferenciaPerc: toNum(data.taxaTransferenciaPerc, DEFAULTS.taxaTransferenciaPerc),
          taxaTransferenciaFixa: toNum(data.taxaTransferenciaFixa, DEFAULTS.taxaTransferenciaFixa),
          taxaResgatePerc: toNum(data.taxaResgatePerc, DEFAULTS.taxaResgatePerc),
          taxaResgateFixa: toNum(data.taxaResgateFixa, DEFAULTS.taxaResgateFixa),
          oxidacaoPercMes: toNum(data.oxidacaoPercMes, DEFAULTS.oxidacaoPercMes),
          oxidacaoPeriodoGracaDias: toNum(data.oxidacaoPeriodoGracaDias, DEFAULTS.oxidacaoPeriodoGracaDias),
          oxidacaoPiso: toNum(data.oxidacaoPiso, DEFAULTS.oxidacaoPiso),
          oxidacaoAtivadaEm: data.oxidacaoAtivadaEm ?? null,
        });
      }
    } catch {
      // 401 silencioso — pagina exige ADMIN/SUPER_ADMIN.
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function handleSalvar() {
    setSalvando(true);
    setMensagem(null);

    // Guard especifico: ligando oxidacao requer confirmacao dupla.
    if (config.oxidacaoPercMes > 0 && !config.oxidacaoAtivadaEm) {
      const ok = window.confirm(
        '⚠️ ATENÇÃO — Você está LIGANDO a oxidação (DECAY_CONTINUO).\n\n' +
          'Em produção real, isso REDUZ saldos dos cooperados todo mês.\n' +
          'O sistema NÃO ativa em produção sem a flag técnica OXIDACAO_PRODUCAO_LIBERADA=true.\n\n' +
          'ANTES de ligar essa flag em produção:\n' +
          '  1. Política de quebra escrita + aprovada (regulatório).\n' +
          '  2. Auditoria do que seria oxidado.\n' +
          '  3. Comunicação clara aos cooperados (Regulamento do Clube).\n\n' +
          'Confirma salvar a configuração?',
      );
      if (!ok) {
        setSalvando(false);
        return;
      }
    }

    try {
      // oxidacaoAtivadaEm NUNCA viaja no body — backend carimba/limpa
      // automaticamente em upsertConfig conforme transicao de oxidacaoPercMes.
      const { oxidacaoAtivadaEm: _omit, ...payload } = config;
      await api.put('/cooper-token/admin/config', payload);
      setMensagem({ tipo: 'ok', texto: 'Configuração salva com sucesso.' });
      await carregar();
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.message ?? 'Erro ao salvar';
      setMensagem({ tipo: 'erro', texto: Array.isArray(msg) ? msg.join(', ') : String(msg) });
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-cyan-700" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/clube">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Voltar ao Clube
          </Button>
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Coins className="h-6 w-6 text-amber-600" />
          Configuração da Economia
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Defina taxas de operação e parâmetros da moeda do Clube.
        </p>
      </div>

      {/* Help inline azul (regra UX 19/05) */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 flex gap-3">
        <Info className="h-5 w-5 text-blue-700 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-900">
          <p className="font-semibold mb-1">Como funciona</p>
          <p>
            <strong>Taxa de Operação</strong>: percentual e/ou valor fixo cobrado
            por operação (emissão, QR, transferência, resgate). Defaults
            preservam o histórico: emissão 2%, QR 1%, demais desligados.
          </p>
          <p className="mt-2">
            <strong>Oxidação (DECAY_CONTINUO)</strong>: reduz saldos
            mensalmente para evitar acumulação infinita. Apenas{' '}
            <strong>tokens novos</strong> (emitidos depois de ligar a oxidação)
            sofrem decay — tokens antigos ficam intocados. Respeita período
            de graça e piso. <strong>Default desligada (0%).</strong>
          </p>
        </div>
      </div>

      {/* ── Seção 1: Geral ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Geral</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="modoGeracao">Modo de geração</Label>
              <select
                id="modoGeracao"
                value={config.modoGeracao}
                onChange={(e) => setConfig({ ...config, modoGeracao: e.target.value })}
                className="w-full mt-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="AMBOS">AMBOS</option>
                <option value="PRE_COMPRA">PRE_COMPRA</option>
                <option value="COTA_MENSAL">COTA_MENSAL</option>
              </select>
            </div>
            <div>
              <Label htmlFor="modeloVida">Vida do token</Label>
              <select
                id="modeloVida"
                value={config.modeloVida}
                onChange={(e) => setConfig({ ...config, modeloVida: e.target.value })}
                className="w-full mt-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="AMBOS">AMBOS</option>
                <option value="EXPIRACAO_29D">EXPIRACAO_29D</option>
                <option value="DECAY_CONTINUO">DECAY_CONTINUO</option>
              </select>
            </div>
            <div>
              <Label htmlFor="valorTokenReais">Valor do token (R$)</Label>
              <Input
                id="valorTokenReais"
                type="number"
                step="0.01"
                min="0"
                value={config.valorTokenReais}
                onChange={(e) => setConfig({ ...config, valorTokenReais: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div>
              <Label htmlFor="descontoMaxPerc">Desconto máximo (%)</Label>
              <Input
                id="descontoMaxPerc"
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={config.descontoMaxPerc}
                onChange={(e) => setConfig({ ...config, descontoMaxPerc: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div>
              <Label htmlFor="bonusIndicacao">Bônus indicação (tokens)</Label>
              <Input
                id="bonusIndicacao"
                type="number"
                step="1"
                min="0"
                value={config.bonusIndicacao}
                onChange={(e) => setConfig({ ...config, bonusIndicacao: parseInt(e.target.value, 10) || 0 })}
              />
            </div>
            <div>
              <Label htmlFor="limiteTokenMensal">Limite mensal/cooperado (vazio = sem limite)</Label>
              <Input
                id="limiteTokenMensal"
                type="number"
                step="1"
                min="0"
                value={config.limiteTokenMensal ?? ''}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    limiteTokenMensal: e.target.value === '' ? null : parseInt(e.target.value, 10) || 0,
                  })
                }
              />
            </div>
            <div>
              <Label htmlFor="tetoCoop">Teto da cooperativa (vazio = sem teto)</Label>
              <Input
                id="tetoCoop"
                type="number"
                step="1"
                min="0"
                value={config.tetoCoop ?? ''}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    tetoCoop: e.target.value === '' ? null : parseInt(e.target.value, 10) || 0,
                  })
                }
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.ativo}
                  onChange={(e) => setConfig({ ...config, ativo: e.target.checked })}
                />
                CooperToken <strong>ativo</strong> nesta cooperativa
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Seção 2: Taxa de Operação (Bloco 2) ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Receipt className="h-4 w-4 text-emerald-700" />
            Taxa de Operação
          </CardTitle>
          <p className="text-xs text-slate-500 mt-1">
            Percentual e/ou fixo cobrado em cada operação. Soma das duas
            partes (perc + fixa) = taxa total da operação.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <TaxaPar
            titulo="Emissão"
            descricao="Aplicada quando tokens são creditados (cota mensal, excedente, bônus, etc)."
            perc={config.taxaEmissaoPerc}
            fixa={config.taxaEmissaoFixa}
            onChange={(perc, fixa) =>
              setConfig({ ...config, taxaEmissaoPerc: perc, taxaEmissaoFixa: fixa })
            }
          />
          <TaxaPar
            titulo="QR (peer-to-peer + estabelecimento)"
            descricao="Cobrada UMA vez sobre o bruto do pagamento via QR Code."
            perc={config.taxaQrPerc}
            fixa={config.taxaQrFixa}
            onChange={(perc, fixa) =>
              setConfig({ ...config, taxaQrPerc: perc, taxaQrFixa: fixa })
            }
          />
          <TaxaPar
            titulo="Transferência"
            descricao="Aplicada em transferências entre cooperados (não-QR). Default 0."
            perc={config.taxaTransferenciaPerc}
            fixa={config.taxaTransferenciaFixa}
            onChange={(perc, fixa) =>
              setConfig({
                ...config,
                taxaTransferenciaPerc: perc,
                taxaTransferenciaFixa: fixa,
              })
            }
          />
          <TaxaPar
            titulo="Resgate"
            descricao="Cobrada no resgate token → R$ (estabelecimentos). Default 0."
            perc={config.taxaResgatePerc}
            fixa={config.taxaResgateFixa}
            onChange={(perc, fixa) =>
              setConfig({ ...config, taxaResgatePerc: perc, taxaResgateFixa: fixa })
            }
          />
        </CardContent>
      </Card>

      {/* ── Seção 3: Oxidação (Bloco 3) — banner âmbar ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-rose-700" />
            Oxidação (DECAY_CONTINUO)
          </CardTitle>
          <p className="text-xs text-slate-500 mt-1">
            Reduz saldos mensalmente apenas para tokens emitidos DEPOIS de
            ligar (prospectivo). Default desligada (0%).
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Banner âmbar — consequência financeira + gate jurídico */}
          <div className="bg-amber-50 border-l-4 border-amber-500 p-3 rounded">
            <p className="text-sm font-semibold text-amber-900 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> Atenção — dupla consequência
            </p>
            <ul className="text-xs text-amber-800 mt-1 list-disc list-inside space-y-1">
              <li>
                <strong>Financeira:</strong> reduz saldo dos cooperados todo
                mês (respeitando graça e piso).
              </li>
              <li>
                <strong>Gate jurídico (técnico):</strong> em produção o cron
                só roda com flag <code>OXIDACAO_PRODUCAO_LIBERADA=true</code>.
                Libere essa flag SÓ APÓS política de quebra escrita +
                aprovada + auditoria do que seria oxidado.
              </li>
              <li>
                <strong>Prospectivo:</strong> tokens emitidos ANTES de ligar
                ficam imunes para sempre.
              </li>
            </ul>
          </div>

          {config.oxidacaoAtivadaEm && (
            <div className="rounded border border-rose-300 bg-rose-50 p-3 text-xs text-rose-900">
              <strong>Marco ativo:</strong> oxidação ligada em{' '}
              {new Date(config.oxidacaoAtivadaEm).toLocaleString('pt-BR')}.
              Apenas tokens emitidos a partir dessa data são candidatos a
              oxidação. Desligar limpa o marco (re-ligar começa um novo).
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="oxidacaoPercMes">Decaimento mensal (%)</Label>
              <Input
                id="oxidacaoPercMes"
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={config.oxidacaoPercMes}
                onChange={(e) =>
                  setConfig({ ...config, oxidacaoPercMes: parseFloat(e.target.value) || 0 })
                }
              />
              <p className="text-xs text-slate-500 mt-1">0 = desligada</p>
            </div>
            <div>
              <Label htmlFor="oxidacaoPeriodoGracaDias">Período de graça (dias)</Label>
              <Input
                id="oxidacaoPeriodoGracaDias"
                type="number"
                step="1"
                min="0"
                value={config.oxidacaoPeriodoGracaDias}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    oxidacaoPeriodoGracaDias: parseInt(e.target.value, 10) || 0,
                  })
                }
              />
              <p className="text-xs text-slate-500 mt-1">Tokens emitidos a menos de X dias não oxidam</p>
            </div>
            <div>
              <Label htmlFor="oxidacaoPiso">Piso (tokens)</Label>
              <Input
                id="oxidacaoPiso"
                type="number"
                step="0.0001"
                min="0"
                value={config.oxidacaoPiso}
                onChange={(e) =>
                  setConfig({ ...config, oxidacaoPiso: parseFloat(e.target.value) || 0 })
                }
              />
              <p className="text-xs text-slate-500 mt-1">Saldo nunca cai abaixo</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {mensagem && (
        <div
          className={`rounded p-3 text-sm border ${
            mensagem.tipo === 'ok'
              ? 'border-green-300 bg-green-50 text-green-900'
              : 'border-red-300 bg-red-50 text-red-900'
          }`}
        >
          {mensagem.texto}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => router.push('/dashboard/clube')} disabled={salvando}>
          Cancelar
        </Button>
        <Button onClick={handleSalvar} disabled={salvando} className="bg-cyan-700 hover:bg-cyan-800">
          {salvando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Salvar configuração
        </Button>
      </div>
    </div>
  );
}

function TaxaPar({
  titulo,
  descricao,
  perc,
  fixa,
  onChange,
}: {
  titulo: string;
  descricao: string;
  perc: number;
  fixa: number;
  onChange: (perc: number, fixa: number) => void;
}) {
  return (
    <div className="rounded border border-slate-200 p-3 bg-slate-50">
      <h3 className="text-sm font-semibold text-slate-800">{titulo}</h3>
      <p className="text-xs text-slate-500 mt-0.5 mb-2">{descricao}</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Percentual (%)</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={perc}
            onChange={(e) => onChange(parseFloat(e.target.value) || 0, fixa)}
          />
        </div>
        <div>
          <Label className="text-xs">Fixo (tokens)</Label>
          <Input
            type="number"
            step="0.0001"
            min="0"
            value={fixa}
            onChange={(e) => onChange(perc, parseFloat(e.target.value) || 0)}
          />
        </div>
      </div>
    </div>
  );
}
