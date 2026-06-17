'use client';

/**
 * Sprint D2.1 v2 (16/06/2026) — Edição do Disclaimer de Saque GLOBAL
 * (SISGD default). SUPER_ADMIN edita o texto vigente; versão é gerada
 * server-side. Versões antigas NUNCA são deletadas — recibo antigo
 * recupera texto exato via FK (`ResgateRecibo.disclaimerSaqueId`).
 *
 * Tenant pode sobrescrever no painel próprio de Configurações.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { HelpBox } from '@/components/ui/help-box';
import {
  ArrowLeft,
  FileText,
  Loader2,
  AlertCircle,
  CheckCircle2,
  History,
  Save,
} from 'lucide-react';

interface DisclaimerSaque {
  id: string;
  cooperativaId: string | null;
  versao: string;
  texto: string;
  ativo: boolean;
  criadoPorUsuarioId: string;
  criadoPorPerfil: string;
  createdAt: string;
}

function formatarData(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

export default function SuperAdminDisclaimerSaquePage() {
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [ativo, setAtivo] = useState<DisclaimerSaque | null>(null);
  const [historico, setHistorico] = useState<DisclaimerSaque[]>([]);
  const [novoTexto, setNovoTexto] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  async function carregar() {
    setCarregando(true);
    setErro(null);
    try {
      const [ativoR, histR] = await Promise.all([
        api.get('/saas/disclaimer-saque/global/ativo'),
        api.get('/saas/disclaimer-saque/global/historico'),
      ]);
      setAtivo(ativoR.data);
      setHistorico(histR.data ?? []);
      setNovoTexto(ativoR.data?.texto ?? '');
    } catch (e: any) {
      setErro(e?.response?.data?.message ?? 'Erro ao carregar.');
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  async function salvar() {
    setErro(null);
    setSucesso('');
    const trimmed = novoTexto.trim();
    if (trimmed.length < 50) {
      setErro('Texto deve ter no mínimo 50 caracteres.');
      return;
    }
    if (trimmed.length > 5000) {
      setErro('Texto não pode passar de 5000 caracteres.');
      return;
    }
    if (trimmed === ativo?.texto?.trim()) {
      setErro('Texto idêntico ao vigente — nenhuma alteração para salvar.');
      return;
    }
    if (
      !confirm(
        'Confirma a publicação do novo disclaimer global? Cooperados que tinham a tela aberta serão obrigados a re-aceitar a versão nova. A versão atual fica preservada no histórico (recibos antigos continuam recuperáveis).',
      )
    ) {
      return;
    }
    setSalvando(true);
    try {
      await api.post('/saas/disclaimer-saque/global', { texto: trimmed });
      setSucesso('Disclaimer global atualizado. Cooperados re-aceitam na próxima tentativa.');
      await carregar();
    } catch (e: any) {
      setErro(e?.response?.data?.message ?? 'Erro ao salvar.');
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Link
        href="/dashboard/super-admin"
        className="text-xs text-muted-foreground hover:underline flex items-center gap-1"
      >
        <ArrowLeft className="h-3 w-3" /> Voltar ao Painel SISGD
      </Link>

      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FileText className="h-6 w-6 text-blue-700" /> Disclaimer de Saque — Global (SISGD)
        </h1>
        <p className="text-sm text-muted-foreground">
          Texto padrão que todos os tenants veem. Cooperativas podem sobrescrever
          com versão própria nas suas Configurações.
        </p>
      </div>

      <HelpBox id="super-admin-disclaimer-saque-help" titulo="Como funciona o disclaimer versionado">
        <p>
          <strong>1.</strong> Cooperado COMUM (não-Estabelecimento) precisa aceitar
          este termo antes de cada solicitação de saque PIX. Estabelecimento bypassa.
        </p>
        <p>
          <strong>2.</strong> Cada aceite grava FK (<code>disclaimerSaqueId</code>) no
          recibo de saque. Mesmo após edições futuras, recibo antigo recupera o texto
          exato aceito (histórico imutável — versão fica <code>ativo=false</code> no banco,
          NUNCA é deletada).
        </p>
        <p>
          <strong>3.</strong> Cooperativa pode criar override próprio (Configurações →
          Disclaimer de Saque). Override do tenant tem prioridade sobre este global.
        </p>
        <p>
          <strong>4.</strong> Versão é auto-gerada server-side (<code>v&#123;seq&#125;-&#123;data&#125;</code>) —
          você só edita texto.
        </p>
      </HelpBox>

      {erro && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-md p-3 flex items-start gap-2 text-sm">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <p>{erro}</p>
        </div>
      )}

      {sucesso && (
        <div className="bg-green-50 border border-green-200 text-green-800 rounded-md p-3 flex items-start gap-2 text-sm">
          <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
          <p>{sucesso}</p>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span>Versão ativa</span>
            {ativo && (
              <span className="text-xs font-normal text-muted-foreground">
                {ativo.versao} · publicada {formatarData(ativo.createdAt)}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={novoTexto}
            onChange={(e) => setNovoTexto(e.target.value)}
            rows={12}
            placeholder="Texto do termo de saque (50 a 5000 caracteres, plain text — quebras de linha viram parágrafo)..."
            className="font-mono text-sm"
          />
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              {novoTexto.trim().length} / 5000 caracteres · HTML não permitido (anti-XSS)
            </p>
            <Button onClick={salvar} disabled={salvando}>
              {salvando ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Publicar nova versão
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4" /> Histórico (versões antigas preservadas)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {historico.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem histórico.</p>
          ) : (
            <div className="space-y-2">
              {historico.map((h) => (
                <div
                  key={h.id}
                  className={`border rounded-md p-3 text-sm ${
                    h.ativo
                      ? 'border-green-300 bg-green-50/50'
                      : 'border-gray-200 bg-gray-50/50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="font-medium">
                      <span className="font-mono">{h.versao}</span>
                      {h.ativo && (
                        <span className="ml-2 text-xs bg-green-200 text-green-900 px-2 py-0.5 rounded-full">
                          ATIVA
                        </span>
                      )}
                    </p>
                    <span className="text-xs text-muted-foreground">
                      {formatarData(h.createdAt)} · autor {h.criadoPorPerfil}
                    </span>
                  </div>
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-blue-700">
                      Ver texto completo
                    </summary>
                    <div className="mt-2 whitespace-pre-line text-xs text-gray-700 bg-white border border-gray-200 rounded p-2 max-h-60 overflow-y-auto">
                      {h.texto}
                    </div>
                  </details>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
