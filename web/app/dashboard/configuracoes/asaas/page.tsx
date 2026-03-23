'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import type { AsaasConfig } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, XCircle, ExternalLink } from 'lucide-react';

export default function AsaasConfigPage() {
  const [config, setConfig] = useState<AsaasConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; erro?: string; totalCustomers?: number } | null>(null);
  const [msg, setMsg] = useState('');
  const [erro, setErro] = useState('');

  const [apiKey, setApiKey] = useState('');
  const [ambiente, setAmbiente] = useState('SANDBOX');
  const [webhookToken, setWebhookToken] = useState('');

  useEffect(() => {
    loadConfig();
  }, []);

  async function loadConfig() {
    try {
      const { data } = await api.get<AsaasConfig | null>('/asaas/config');
      if (data) {
        setConfig(data);
        setAmbiente(data.ambiente);
        setWebhookToken(data.webhookToken || '');
      }
    } catch {
      // sem config
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!apiKey && !config?.apiKeyDefinida) {
      setErro('Informe a API Key');
      return;
    }
    setSaving(true);
    setErro('');
    setMsg('');
    try {
      const payload: any = { ambiente, webhookToken: webhookToken || undefined };
      if (apiKey) payload.apiKey = apiKey;
      else if (config?.apiKeyDefinida) {
        // Manter a key atual — backend precisa da key para upsert
        // Enviamos um campo especial
        payload.apiKey = '__MANTER__';
      }

      // Se for manter, precisamos enviar a key real — simplificação: sempre exigir key no save
      if (payload.apiKey === '__MANTER__') {
        setErro('Para atualizar, informe a API Key novamente (por segurança ela não é exibida)');
        setSaving(false);
        return;
      }

      await api.post('/asaas/config', payload);
      setMsg('Configuração salva com sucesso!');
      setApiKey('');
      await loadConfig();
    } catch (err: any) {
      setErro(err.response?.data?.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const { data } = await api.get<{ ok: boolean; erro?: string; totalCustomers?: number }>('/asaas/testar-conexao');
      setTestResult(data);
    } catch {
      setTestResult({ ok: false, erro: 'Erro ao testar conexão' });
    } finally {
      setTesting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-green-600" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Integração Asaas</h1>
        <p className="text-sm text-gray-500 mt-1">
          Configure o gateway de pagamentos Asaas para cobranças via boleto, PIX e cartão de crédito.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Credenciais da API</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Ambiente toggle */}
          <div className="space-y-2">
            <Label>Ambiente</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={ambiente === 'SANDBOX' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setAmbiente('SANDBOX')}
              >
                Sandbox (Teste)
              </Button>
              <Button
                type="button"
                variant={ambiente === 'PRODUCAO' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setAmbiente('PRODUCAO')}
                className={ambiente === 'PRODUCAO' ? 'bg-red-600 hover:bg-red-700' : ''}
              >
                Produção
              </Button>
            </div>
            {ambiente === 'PRODUCAO' && (
              <p className="text-xs text-red-600">Atenção: transações reais serão processadas!</p>
            )}
          </div>

          {/* API Key */}
          <div className="space-y-2">
            <Label htmlFor="apiKey">API Key</Label>
            <Input
              id="apiKey"
              type="password"
              placeholder={config?.apiKeyDefinida ? 'Key configurada (insira nova para alterar)' : 'Cole sua API Key do Asaas'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
            {config?.apiKeyDefinida && (
              <p className="text-xs text-gray-500">Key atual: {config.apiKey}</p>
            )}
          </div>

          {/* Webhook Token */}
          <div className="space-y-2">
            <Label htmlFor="webhookToken">Webhook Token (opcional)</Label>
            <Input
              id="webhookToken"
              placeholder="Token para validar webhooks do Asaas"
              value={webhookToken}
              onChange={(e) => setWebhookToken(e.target.value)}
            />
            <p className="text-xs text-gray-500">
              Configure no painel Asaas a URL: <code className="bg-gray-100 px-1 rounded">{typeof window !== 'undefined' ? window.location.origin.replace(':3001', ':3000') : ''}/asaas/webhook</code>
            </p>
          </div>

          {/* Mensagens */}
          {msg && <p className="text-sm text-green-600 font-medium">{msg}</p>}
          {erro && <p className="text-sm text-red-600 font-medium">{erro}</p>}

          {/* Botões */}
          <div className="flex gap-3 pt-2">
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Salvar Configuração
            </Button>
            <Button
              variant="outline"
              onClick={handleTest}
              disabled={testing || !config?.apiKeyDefinida}
            >
              {testing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Testar Conexão
            </Button>
          </div>

          {/* Resultado do teste */}
          {testResult && (
            <div
              className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
                testResult.ok
                  ? 'bg-green-50 text-green-800 border border-green-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}
            >
              {testResult.ok ? (
                <>
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  Conexão OK! {testResult.totalCustomers != null && `(${testResult.totalCustomers} clientes encontrados)`}
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-red-600" />
                  Falha: {typeof testResult.erro === 'string' ? testResult.erro : JSON.stringify(testResult.erro)}
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Link de documentação */}
      <Card>
        <CardContent className="py-4">
          <a
            href="https://docs.asaas.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
          >
            <ExternalLink className="h-4 w-4" />
            Documentação da API Asaas
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
