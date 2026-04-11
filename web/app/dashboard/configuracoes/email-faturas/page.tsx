'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Loader2, CheckCircle, XCircle, Mail, ExternalLink } from 'lucide-react';

interface EmailConfig {
  host: string;
  port: string;
  user: string;
  senhaDefinida: boolean;
  ativo: boolean;
}

interface TesteResult {
  sucesso: boolean;
  mensagem?: string;
  erro?: string;
}

export default function EmailFaturasConfigPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TesteResult | null>(null);
  const [msg, setMsg] = useState('');
  const [erro, setErro] = useState('');

  const [ativo, setAtivo] = useState(false);
  const [host, setHost] = useState('imap.gmail.com');
  const [port, setPort] = useState('993');
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [senhaDefinida, setSenhaDefinida] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  async function loadConfig() {
    try {
      const { data } = await api.get<EmailConfig>('/config-tenant/email-monitor/config');
      setHost(data.host);
      setPort(data.port);
      setUser(data.user);
      setAtivo(data.ativo);
      setSenhaDefinida(data.senhaDefinida);
    } catch {
      // sem config ainda
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!user) {
      setErro('Informe o endereço de e-mail');
      return;
    }
    if (!pass && !senhaDefinida) {
      setErro('Informe a senha (App Password)');
      return;
    }

    setSaving(true);
    setErro('');
    setMsg('');
    try {
      const payload: Record<string, string | boolean> = {
        host,
        port,
        user,
        ativo,
      };
      if (pass) {
        payload.pass = pass;
      }
      await api.put('/config-tenant/email-monitor/config', payload);
      setMsg('Configuração salva com sucesso!');
      setPass('');
      setSenhaDefinida(true);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setErro(axiosErr.response?.data?.message || 'Erro ao salvar configuração');
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const payload: Record<string, string> = { host, port, user };
      if (pass) payload.pass = pass;
      const { data } = await api.post<TesteResult>('/config-tenant/email-monitor/testar', payload);
      setTestResult(data);
    } catch {
      setTestResult({ sucesso: false, erro: 'Erro ao testar conexão' });
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
        <h1 className="text-2xl font-bold text-gray-800">Email de Faturas</h1>
        <p className="text-sm text-gray-500 mt-1">
          Configure o monitoramento de e-mails para receber faturas de concessionárias automaticamente via IMAP.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Configuração IMAP
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Toggle ativo/inativo */}
          <div className="flex items-center justify-between">
            <div>
              <Label>Monitor ativo</Label>
              <p className="text-xs text-gray-500">Verifica novos e-mails a cada 30 minutos</p>
            </div>
            <Switch checked={ativo} onCheckedChange={setAtivo} />
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="emailUser">Endereço de e-mail</Label>
            <Input
              id="emailUser"
              type="email"
              placeholder="faturas@suacooperativa.com"
              value={user}
              onChange={(e) => setUser(e.target.value)}
            />
          </div>

          {/* Senha */}
          <div className="space-y-2">
            <Label htmlFor="emailPass">Senha</Label>
            <Input
              id="emailPass"
              type="password"
              placeholder={senhaDefinida ? 'Senha configurada (insira nova para alterar)' : 'App Password do Gmail'}
              value={pass}
              onChange={(e) => setPass(e.target.value)}
            />
            <p className="text-xs text-gray-500">
              Para Gmail, use uma App Password.{' '}
              <a
                href="https://myaccount.google.com/apppasswords"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline inline-flex items-center gap-1"
              >
                Criar App Password <ExternalLink className="h-3 w-3" />
              </a>
            </p>
          </div>

          {/* Servidor IMAP */}
          <div className="space-y-2">
            <Label htmlFor="emailHost">Servidor IMAP</Label>
            <Input
              id="emailHost"
              placeholder="imap.gmail.com"
              value={host}
              onChange={(e) => setHost(e.target.value)}
            />
          </div>

          {/* Porta */}
          <div className="space-y-2">
            <Label htmlFor="emailPort">Porta</Label>
            <Input
              id="emailPort"
              type="number"
              placeholder="993"
              value={port}
              onChange={(e) => setPort(e.target.value)}
            />
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
              disabled={testing || (!user)}
            >
              {testing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Testar Conexão
            </Button>
          </div>

          {/* Resultado do teste */}
          {testResult && (
            <div
              className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
                testResult.sucesso
                  ? 'bg-green-50 text-green-800 border border-green-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}
            >
              {testResult.sucesso ? (
                <>
                  <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                  {testResult.mensagem}
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
                  Falha: {testResult.erro}
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dica sobre funcionamento */}
      <Card>
        <CardContent className="py-4 space-y-2">
          <p className="text-sm font-medium text-gray-700">Como funciona:</p>
          <ul className="text-sm text-gray-500 space-y-1 list-disc list-inside">
            <li>O sistema verifica a caixa de entrada a cada 30 minutos</li>
            <li>E-mails com PDFs de faturas de concessionárias são processados automaticamente</li>
            <li>O cooperado é identificado pelo e-mail do remetente ou número da UC</li>
            <li>Faturas não identificadas são movidas para a pasta "Pendentes"</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
