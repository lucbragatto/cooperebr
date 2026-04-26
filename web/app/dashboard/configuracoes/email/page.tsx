'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, XCircle, ExternalLink, Info } from 'lucide-react';

interface SmtpView {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  from: string;
  fonte: 'tenant' | 'env' | 'default';
  passDefinida: boolean;
}

interface ImapView {
  host: string;
  port: number;
  user: string;
  ativo: boolean;
  fonte: 'tenant' | 'env' | 'default';
  passDefinida: boolean;
}

interface ConfigSeguro {
  smtp: SmtpView;
  imap: ImapView;
}

interface TestSmtpResp {
  sucesso: boolean;
  destino: string;
  observacao?: string;
}

interface TestImapResp {
  sucesso: boolean;
  host?: string;
  user?: string;
  fonte?: string;
  totalPastas?: number;
  pastas?: string[];
  totalMensagensInbox?: number;
  erro?: string;
}

const FONTE_LABEL: Record<string, { label: string; cor: string; tooltip: string }> = {
  tenant: { label: 'Banco (parceiro)', cor: 'text-green-700 bg-green-100', tooltip: 'Configuração específica deste parceiro, salva no banco.' },
  env: { label: 'Sistema (.env fallback)', cor: 'text-yellow-700 bg-yellow-100', tooltip: 'Sem config específica do parceiro. Usando configuração global do servidor.' },
  default: { label: 'Padrão hard-coded', cor: 'text-gray-700 bg-gray-100', tooltip: 'Sem config no banco e sem .env. Usando defaults do código.' },
};

export default function EmailConfigPage() {
  const [config, setConfig] = useState<ConfigSeguro | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingSmtp, setSavingSmtp] = useState(false);
  const [savingImap, setSavingImap] = useState(false);
  const [testingSmtp, setTestingSmtp] = useState(false);
  const [testingImap, setTestingImap] = useState(false);
  const [smtpResult, setSmtpResult] = useState<TestSmtpResp | null>(null);
  const [imapResult, setImapResult] = useState<TestImapResp | null>(null);
  const [msg, setMsg] = useState('');
  const [erro, setErro] = useState('');

  // SMTP form state
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('465');
  const [smtpSecure, setSmtpSecure] = useState(true);
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [smtpFrom, setSmtpFrom] = useState('');

  // IMAP form state
  const [imapHost, setImapHost] = useState('');
  const [imapPort, setImapPort] = useState('993');
  const [imapUser, setImapUser] = useState('');
  const [imapPass, setImapPass] = useState('');
  const [imapAtivo, setImapAtivo] = useState(true);

  // Destino do teste SMTP
  const [destinoTeste, setDestinoTeste] = useState('');

  useEffect(() => {
    loadConfig();
  }, []);

  async function loadConfig() {
    setLoading(true);
    setErro('');
    try {
      const { data } = await api.get<ConfigSeguro>('/configuracoes/email');
      setConfig(data);
      setSmtpHost(data.smtp.host);
      setSmtpPort(String(data.smtp.port));
      setSmtpSecure(data.smtp.secure);
      setSmtpUser(data.smtp.user);
      setSmtpFrom(data.smtp.from);
      setImapHost(data.imap.host);
      setImapPort(String(data.imap.port));
      setImapUser(data.imap.user);
      setImapAtivo(data.imap.ativo);
    } catch (err: any) {
      setErro(err?.response?.data?.message || 'Erro ao carregar configurações');
    } finally {
      setLoading(false);
    }
  }

  async function salvarSmtp() {
    setSavingSmtp(true);
    setMsg('');
    setErro('');
    try {
      const body: any = {
        host: smtpHost,
        port: Number(smtpPort),
        secure: smtpSecure,
        user: smtpUser,
        from: smtpFrom,
      };
      if (smtpPass) body.pass = smtpPass; // string vazia = mantém
      const { data } = await api.put<ConfigSeguro>('/configuracoes/email/smtp', body);
      setConfig(data);
      setSmtpPass('');
      setMsg('Configuração SMTP salva. Próximo envio usará a config nova.');
    } catch (err: any) {
      setErro(err?.response?.data?.message || 'Erro ao salvar SMTP');
    } finally {
      setSavingSmtp(false);
    }
  }

  async function salvarImap() {
    setSavingImap(true);
    setMsg('');
    setErro('');
    try {
      const body: any = {
        host: imapHost,
        port: Number(imapPort),
        user: imapUser,
        ativo: imapAtivo,
      };
      if (imapPass) body.pass = imapPass;
      const { data } = await api.put<ConfigSeguro>('/configuracoes/email/imap', body);
      setConfig(data);
      setImapPass('');
      setMsg('Configuração IMAP salva. Próxima execução do monitor usará a config nova.');
    } catch (err: any) {
      setErro(err?.response?.data?.message || 'Erro ao salvar IMAP');
    } finally {
      setSavingImap(false);
    }
  }

  async function testarSmtp() {
    setTestingSmtp(true);
    setSmtpResult(null);
    setErro('');
    try {
      const { data } = await api.post<TestSmtpResp>('/configuracoes/email/testar-smtp', {
        destino: destinoTeste || undefined,
      });
      setSmtpResult(data);
    } catch (err: any) {
      setSmtpResult({ sucesso: false, destino: destinoTeste, observacao: err?.response?.data?.message || 'Erro' });
    } finally {
      setTestingSmtp(false);
    }
  }

  async function testarImap() {
    setTestingImap(true);
    setImapResult(null);
    setErro('');
    try {
      const { data } = await api.post<TestImapResp>('/configuracoes/email/testar-imap');
      setImapResult(data);
    } catch (err: any) {
      setImapResult({ sucesso: false, erro: err?.response?.data?.message || 'Erro' });
    } finally {
      setTestingImap(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando configurações...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-2xl font-bold text-gray-800">Configurações de email</h2>
        <p className="text-sm text-gray-600 mt-1">
          Cada parceiro tem seu próprio servidor de email (SMTP pra envio + IMAP pra receber faturas da concessionária).
          Quando os campos do parceiro estão vazios, o sistema cai no fallback global do servidor.
        </p>
      </div>

      {erro && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">{erro}</div>
      )}
      {msg && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded text-sm">{msg}</div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded p-3 text-xs text-blue-900 flex gap-2">
        <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold mb-1">Como gerar uma App Password Google (Gmail / Workspace)</p>
          <p>
            Conta com 2FA ativo: acessar{' '}
            <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" className="underline inline-flex items-center gap-1">
              myaccount.google.com/apppasswords <ExternalLink className="h-3 w-3" />
            </a>{' '}
            → criar nova senha (nome ex: <code className="bg-blue-100 px-1 rounded">sisgd_smtp_2026</code>) → copiar os 16 caracteres → colar no campo Senha. A senha aparece uma única vez no Google.
          </p>
        </div>
      </div>

      {/* ── SMTP ──────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">SMTP — envio de emails</CardTitle>
          {config && (
            <span className={`text-xs px-2 py-1 rounded ${FONTE_LABEL[config.smtp.fonte].cor}`} title={FONTE_LABEL[config.smtp.fonte].tooltip}>
              {FONTE_LABEL[config.smtp.fonte].label}
            </span>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="smtp-host">Host *</Label>
              <Input id="smtp-host" value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} placeholder="smtp.gmail.com" />
            </div>
            <div>
              <Label htmlFor="smtp-port">Porta *</Label>
              <Input id="smtp-port" type="number" value={smtpPort} onChange={(e) => setSmtpPort(e.target.value)} placeholder="465" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={smtpSecure} onChange={(e) => setSmtpSecure(e.target.checked)} />
            Conexão segura (SSL/TLS — recomendado pra porta 465)
          </label>
          <div>
            <Label htmlFor="smtp-user">Usuário (email) *</Label>
            <Input id="smtp-user" type="email" value={smtpUser} onChange={(e) => setSmtpUser(e.target.value)} placeholder="contato@suaempresa.com.br" />
          </div>
          <div>
            <Label htmlFor="smtp-pass">
              Senha (App Password) {config?.smtp.passDefinida ? <span className="text-xs text-green-700">(definida — deixe vazio pra manter)</span> : <span className="text-xs text-orange-700">(não definida)</span>}
            </Label>
            <Input id="smtp-pass" type="password" value={smtpPass} onChange={(e) => setSmtpPass(e.target.value)} placeholder="xxxx xxxx xxxx xxxx" autoComplete="new-password" />
          </div>
          <div>
            <Label htmlFor="smtp-from">Remetente "From" *</Label>
            <Input id="smtp-from" value={smtpFrom} onChange={(e) => setSmtpFrom(e.target.value)} placeholder='Nome do Parceiro <contato@suaempresa.com.br>' />
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button onClick={salvarSmtp} disabled={savingSmtp}>
              {savingSmtp && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Salvar SMTP
            </Button>
            <div className="flex items-center gap-2 ml-auto">
              <Input
                placeholder="email pra teste (opcional — usa o seu)"
                value={destinoTeste}
                onChange={(e) => setDestinoTeste(e.target.value)}
                className="w-72"
              />
              <Button variant="outline" onClick={testarSmtp} disabled={testingSmtp}>
                {testingSmtp && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Testar envio
              </Button>
            </div>
          </div>
          {smtpResult && (
            <div className={`text-xs px-3 py-2 rounded border ${smtpResult.sucesso ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'} flex items-start gap-2`}>
              {smtpResult.sucesso ? <CheckCircle className="h-4 w-4 mt-0.5" /> : <XCircle className="h-4 w-4 mt-0.5" />}
              <div>
                <p className="font-semibold">{smtpResult.sucesso ? 'Email de teste enviado' : 'Falha no envio'}</p>
                <p>Destino: {smtpResult.destino}</p>
                {smtpResult.observacao && <p className="mt-1">{smtpResult.observacao}</p>}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── IMAP ──────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">IMAP — recebimento de faturas da concessionária</CardTitle>
          {config && (
            <span className={`text-xs px-2 py-1 rounded ${FONTE_LABEL[config.imap.fonte].cor}`} title={FONTE_LABEL[config.imap.fonte].tooltip}>
              {FONTE_LABEL[config.imap.fonte].label}
            </span>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-gray-600">
            O sistema varre essa caixa diariamente buscando faturas EDP/CEMIG/etc anexadas. Para cada cooperado funcionar,
            ele precisa cadastrar este email como destinatário de 2ª via no portal da concessionária.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="imap-host">Host *</Label>
              <Input id="imap-host" value={imapHost} onChange={(e) => setImapHost(e.target.value)} placeholder="imap.gmail.com" />
            </div>
            <div>
              <Label htmlFor="imap-port">Porta *</Label>
              <Input id="imap-port" type="number" value={imapPort} onChange={(e) => setImapPort(e.target.value)} placeholder="993" />
            </div>
          </div>
          <div>
            <Label htmlFor="imap-user">Usuário (email) *</Label>
            <Input id="imap-user" type="email" value={imapUser} onChange={(e) => setImapUser(e.target.value)} placeholder="contato@suaempresa.com.br" />
          </div>
          <div>
            <Label htmlFor="imap-pass">
              Senha (App Password) {config?.imap.passDefinida ? <span className="text-xs text-green-700">(definida — deixe vazio pra manter)</span> : <span className="text-xs text-orange-700">(não definida)</span>}
            </Label>
            <Input id="imap-pass" type="password" value={imapPass} onChange={(e) => setImapPass(e.target.value)} placeholder="xxxx xxxx xxxx xxxx" autoComplete="new-password" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={imapAtivo} onChange={(e) => setImapAtivo(e.target.checked)} />
            Monitor IMAP ativo (busca automática diária às 6h)
          </label>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button onClick={salvarImap} disabled={savingImap}>
              {savingImap && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Salvar IMAP
            </Button>
            <Button variant="outline" onClick={testarImap} disabled={testingImap} className="ml-auto">
              {testingImap && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Testar conexão
            </Button>
          </div>
          {imapResult && (
            <div className={`text-xs px-3 py-2 rounded border ${imapResult.sucesso ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
              <div className="flex items-start gap-2">
                {imapResult.sucesso ? <CheckCircle className="h-4 w-4 mt-0.5" /> : <XCircle className="h-4 w-4 mt-0.5" />}
                <div className="flex-1">
                  <p className="font-semibold">{imapResult.sucesso ? 'Conexão IMAP OK' : 'Falha na conexão'}</p>
                  {imapResult.sucesso ? (
                    <>
                      <p>Total de pastas: {imapResult.totalPastas} • Mensagens na INBOX: {imapResult.totalMensagensInbox}</p>
                      {imapResult.pastas && imapResult.pastas.length > 0 && (
                        <p className="mt-1 truncate">Primeiras pastas: {imapResult.pastas.slice(0, 5).join(', ')}{imapResult.pastas.length > 5 ? '...' : ''}</p>
                      )}
                    </>
                  ) : (
                    <p>{imapResult.erro}</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
