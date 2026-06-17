'use client';

/**
 * Sprint D2.1 v2 (16/06/2026) — Edição do Disclaimer de Saque do TENANT
 * (cooperativa). ADMIN do tenant cria override próprio que substitui o
 * default SISGD. Ao desativar o override, cooperativa volta a usar o global.
 *
 * Override é por cooperativa — `cooperativaId` vem SEMPRE do JWT (controller
 * força, service rejeita do body). Histórico imutável: versões antigas
 * permanecem `ativo=false` no banco pra recibos antigos recuperarem texto
 * via FK.
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
  XCircle,
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

interface AtivoResponse {
  disclaimer: DisclaimerSaque;
  origem: 'TENANT' | 'GLOBAL';
}

function formatarData(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

export default function AdminTenantDisclaimerSaquePage() {
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [desativando, setDesativando] = useState(false);
  const [ativo, setAtivo] = useState<AtivoResponse | null>(null);
  const [historico, setHistorico] = useState<DisclaimerSaque[]>([]);
  const [novoTexto, setNovoTexto] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  async function carregar() {
    setCarregando(true);
    setErro(null);
    try {
      const [ativoR, histR] = await Promise.all([
        api.get('/cooperativa/disclaimer-saque/ativo'),
        api.get('/cooperativa/disclaimer-saque/historico'),
      ]);
      setAtivo(ativoR.data);
      setHistorico(histR.data ?? []);
      // Pré-popula textarea: se já tem override do tenant, usa texto dele.
      // Se está caindo no global, deixa em branco pra o admin criar override
      // partindo do zero (ou copiar do bloco "Atualmente ativo" se quiser).
      setNovoTexto(ativoR.data?.origem === 'TENANT' ? ativoR.data.disclaimer.texto : '');
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
    if (ativo?.origem === 'TENANT' && trimmed === ativo.disclaimer.texto?.trim()) {
      setErro('Texto idêntico ao vigente — nenhuma alteração para salvar.');
      return;
    }
    if (
      !confirm(
        'Confirma a publicação do novo disclaimer da cooperativa? Cooperados que tinham a tela aberta serão obrigados a re-aceitar a versão nova. A versão atual fica preservada no histórico (recibos antigos continuam recuperáveis).',
      )
    ) {
      return;
    }
    setSalvando(true);
    try {
      await api.post('/cooperativa/disclaimer-saque', { texto: trimmed });
      setSucesso('Disclaimer da cooperativa atualizado. Cooperados re-aceitam na próxima tentativa.');
      await carregar();
    } catch (e: any) {
      setErro(e?.response?.data?.message ?? 'Erro ao salvar.');
    } finally {
      setSalvando(false);
    }
  }

  async function desativarOverride() {
    setErro(null);
    setSucesso('');
    if (ativo?.origem !== 'TENANT') {
      setErro('Cooperativa já está usando o global SISGD.');
      return;
    }
    if (
      !confirm(
        'Confirma desativar o override da cooperativa? A partir de agora, cooperados verão o disclaimer GLOBAL do SISGD. A versão atual da cooperativa fica preservada no histórico (recibos antigos continuam recuperáveis).',
      )
    ) {
      return;
    }
    setDesativando(true);
    try {
      await api.delete('/cooperativa/disclaimer-saque/ativo');
      setSucesso('Override desativado. Cooperativa voltou a usar o global SISGD.');
      await carregar();
    } catch (e: any) {
      setErro(e?.response?.data?.message ?? 'Erro ao desativar.');
    } finally {
      setDesativando(false);
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
        href="/dashboard/configuracoes/seguranca"
        className="text-xs text-muted-foreground hover:underline flex items-center gap-1"
      >
        <ArrowLeft className="h-3 w-3" /> Voltar a Configurações
      </Link>

      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FileText className="h-6 w-6 text-blue-700" /> Disclaimer de Saque da Cooperativa
        </h1>
        <p className="text-sm text-muted-foreground">
          Texto que SEUS cooperados leem antes de cada solicitação de saque PIX.
          Por padrão, todos veem o texto SISGD — aqui você cria um override próprio.
        </p>
      </div>

      <HelpBox id="admin-disclaimer-saque-help" titulo="Como funciona o override">
        <p>
          <strong>1.</strong> Sem override: cooperados veem o texto padrão do SISGD
          (mantido pelo super-admin global).
        </p>
        <p>
          <strong>2.</strong> Com override: cooperados veem o SEU texto. Útil pra
          adaptar linguagem da sua cooperativa, citar normas internas ou destacar
          orientações específicas.
        </p>
        <p>
          <strong>3.</strong> Cada aceite grava FK no recibo de saque — mesmo após
          edições futuras, recibo antigo recupera texto exato (histórico imutável).
        </p>
        <p>
          <strong>4.</strong> Versão é auto-gerada server-side
          (<code>tenant-v&#123;seq&#125;-&#123;data&#125;</code>) — você só edita texto.
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
          <CardTitle className="text-base flex items-center justify-between gap-2 flex-wrap">
            <span>Atualmente ativo</span>
            {ativo && (
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${
                  ativo.origem === 'TENANT'
                    ? 'bg-blue-100 text-blue-900'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                {ativo.origem === 'TENANT'
                  ? `Override da cooperativa · ${ativo.disclaimer.versao}`
                  : `Global SISGD · ${ativo.disclaimer.versao}`}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {ativo && (
            <div className="space-y-2">
              <div className="whitespace-pre-line text-sm text-gray-700 bg-amber-50/30 border border-amber-200 rounded p-3 max-h-60 overflow-y-auto leading-relaxed">
                {ativo.disclaimer.texto}
              </div>
              <p className="text-xs text-muted-foreground">
                Publicada {formatarData(ativo.disclaimer.createdAt)} · autor{' '}
                {ativo.disclaimer.criadoPorPerfil}
              </p>
              {ativo.origem === 'TENANT' && (
                <div className="pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={desativarOverride}
                    disabled={desativando}
                  >
                    {desativando ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <XCircle className="h-4 w-4 mr-2" />
                    )}
                    Desativar override e voltar ao global SISGD
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {ativo?.origem === 'TENANT' ? 'Editar texto' : 'Criar override da cooperativa'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={novoTexto}
            onChange={(e) => setNovoTexto(e.target.value)}
            rows={12}
            placeholder="Texto do termo de saque para SUA cooperativa (50 a 5000 caracteres, plain text — quebras de linha viram parágrafo)..."
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
            <History className="h-4 w-4" /> Histórico da cooperativa (versões preservadas)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {historico.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Sem histórico — cooperativa nunca criou override.
            </p>
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
