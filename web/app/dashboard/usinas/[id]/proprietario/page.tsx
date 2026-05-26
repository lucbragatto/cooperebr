'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Loader2, ArrowLeft, Save, Info, Sun, AlertTriangle,
  Mail, UserPlus, Copy, RefreshCw, X, CheckCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from '@/components/ui/dialog';
import api from '@/lib/api';

const STATUS_OPERACIONAL_OPCOES = [
  { value: 'OPERANDO', label: 'Operando (normal)' },
  { value: 'MANUTENCAO_PLANEJADA', label: 'Manutenção planejada' },
  { value: 'MANUTENCAO_EMERGENCIAL', label: 'Manutenção emergencial' },
  { value: 'DESLIGADA', label: 'Desligada (permanente)' },
  { value: 'OFFLINE', label: 'Offline (sem comunicação)' },
];

const CATEGORIAS_DESPESA = [
  'CUSD',
  'MANUTENCAO_PREVENTIVA',
  'MANUTENCAO_CORRETIVA',
  'ROCADA',
  'VIGILANCIA',
  'SEGURO',
  'IPTU_ITR',
  'CONSUMO_AUXILIAR',
  'INTERNET',
  'ACOMPANHAMENTO_TECNICO',
  'EQUIPAMENTOS',
  'ARRENDAMENTO_USINA',
  'MANUTENCAO',
  'SALARIO',
  'OUTRO',
];

const RESPONSAVEIS = [
  { value: '', label: '— (não definido)' },
  { value: 'PARCEIRO', label: 'Parceiro (cooperativa)' },
  { value: 'PROPRIETARIO', label: 'Proprietário (dono)' },
  { value: 'COMPARTILHADO', label: 'Compartilhado' },
];

export default function UsinaProprietarioConfigPage() {
  const params = useParams();
  const router = useRouter();
  const usinaId = params?.id as string;

  const [usina, setUsina] = useState<any>(null);
  const [statusOperacional, setStatusOperacional] = useState<string>('OPERANDO');
  const [valorKwhPadrao, setValorKwhPadrao] = useState<string>('');
  const [matriz, setMatriz] = useState<Record<string, string>>({});
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState('');
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (!usinaId) return;
    api
      .get(`/usinas/${usinaId}`)
      .then((r) => {
        const u = r.data;
        setUsina(u);
        setStatusOperacional(u.statusOperacional ?? 'OPERANDO');
        setValorKwhPadrao(u.valorKwhPadrao != null ? String(u.valorKwhPadrao) : '');
        setMatriz((u.responsabilidadeDespesas ?? {}) as Record<string, string>);
      })
      .catch(() => setErro('Falha ao carregar usina.'))
      .finally(() => setCarregando(false));
  }, [usinaId]);

  function setResponsavel(categoria: string, valor: string) {
    setMatriz((m) => {
      const novo = { ...m };
      if (!valor) delete novo[categoria];
      else novo[categoria] = valor;
      return novo;
    });
  }

  async function handleSalvar() {
    setSalvando(true);
    setMsg('');
    setErro('');
    try {
      const payload: any = {
        statusOperacional,
        responsabilidadeDespesas: matriz,
      };
      if (valorKwhPadrao.trim() !== '') {
        const n = Number(valorKwhPadrao.replace(',', '.'));
        if (Number.isNaN(n) || n <= 0) {
          setErro('valorKwhPadrao deve ser número > 0 (ex: 0,80).');
          setSalvando(false);
          return;
        }
        payload.valorKwhPadrao = n;
      } else {
        payload.valorKwhPadrao = null;
      }
      await api.put(`/usinas/${usinaId}`, payload);
      setMsg('Configuração salva com sucesso.');
    } catch (e: any) {
      setErro(e?.response?.data?.message ?? 'Falha ao salvar.');
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

  if (erro && !usina) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <p className="text-red-600 text-sm">{erro}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <Link href={`/dashboard/usinas/${usinaId}`} className="text-sm text-amber-600 hover:underline inline-flex items-center gap-1">
          <ArrowLeft className="w-3 h-3" /> Voltar pra usina
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2 flex items-center gap-2">
          <Sun className="w-6 h-6 text-amber-500" />
          Configuração Proprietário — {usina?.nome}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Status operacional, override de tarifa pro cálculo de repasse e matriz de responsabilidade de despesas
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-md p-3 flex gap-2">
        <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <strong>Como usar:</strong> esses campos alimentam o <Link href={`/proprietario/usinas/${usinaId}`} className="underline">Portal Proprietário</Link>.
          O status operacional aparece como badge colorido; valorKwhPadrao substitui a tarifa da distribuidora no cálculo PERCENTUAL;
          a matriz define quem paga cada categoria de despesa cadastrada em Contas a Pagar.
        </div>
      </div>

      {/* Status operacional */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Status Operacional</CardTitle>
        </CardHeader>
        <CardContent>
          <Label htmlFor="statusOp">Status atual</Label>
          <select
            id="statusOp"
            value={statusOperacional}
            onChange={(e) => setStatusOperacional(e.target.value)}
            className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          >
            {STATUS_OPERACIONAL_OPCOES.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-2">
            Cron Sungrow atualiza automaticamente (OPERANDO ↔ OFFLINE) quando credenciais habilitadas.
            Override manual aqui sempre prevalece até admin marcar OPERANDO de volta.
          </p>
        </CardContent>
      </Card>

      {/* valorKwhPadrao */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tarifa de Referência (R$/kWh)</CardTitle>
        </CardHeader>
        <CardContent>
          <Label htmlFor="valorKwh">valorKwhPadrao (override fórmula PERCENTUAL/HIBRIDO)</Label>
          <Input
            id="valorKwh"
            type="text"
            placeholder="Ex: 0,80 (vazio = usa TarifaConcessionaria por distribuidora)"
            value={valorKwhPadrao}
            onChange={(e) => setValorKwhPadrao(e.target.value)}
          />
          <p className="text-xs text-gray-500 mt-2">
            Se preenchido, o cálculo de repasse PERCENTUAL/HIBRIDO usa este valor.
            Se vazio, busca a TarifaConcessionaria vigente pra <strong>{usina?.distribuidora ?? '—'}</strong> (TUSD + TE).
          </p>
        </CardContent>
      </Card>

      {/* Matriz responsabilidade */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Matriz de Responsabilidade de Despesas</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-gray-500 mb-3">
            Defina quem paga cada categoria de despesa desta usina conforme contrato bilateral. Categorias
            sem responsável definido ficam visíveis só pro admin (não aparecem no portal do proprietário).
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {CATEGORIAS_DESPESA.map((cat) => (
              <div key={cat} className="flex items-center justify-between gap-2 p-2 border rounded-md">
                <span className="text-sm font-medium">{cat.replace(/_/g, ' ')}</span>
                <select
                  value={matriz[cat] ?? ''}
                  onChange={(e) => setResponsavel(cat, e.target.value)}
                  className="px-2 py-1 border rounded text-xs"
                >
                  {RESPONSAVEIS.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Mensagens + botão salvar */}
      {msg && <p className="text-sm text-green-600 font-medium">{msg}</p>}
      {erro && <p className="text-sm text-red-600 font-medium">{erro}</p>}

      <div className="flex gap-3">
        <Button onClick={handleSalvar} disabled={salvando}>
          {salvando && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          <Save className="w-4 h-4 mr-2" /> Salvar configuração
        </Button>
        <Button variant="outline" onClick={() => router.back()}>Cancelar</Button>
      </div>

      {/* ── F.3 Onboarding ── */}
      <AcessoProprietarioBloco usinaId={usinaId} proprietarioEmail={usina?.proprietarioEmail ?? ''} />
    </div>
  );
}

// ═══ Bloco onboarding (cadastro manual + magic link) ═══

function AcessoProprietarioBloco({ usinaId, proprietarioEmail }: { usinaId: string; proprietarioEmail: string }) {
  const [convites, setConvites] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [dialogManualAberto, setDialogManualAberto] = useState(false);
  const [dialogConviteAberto, setDialogConviteAberto] = useState(false);

  const carregar = useCallback(() => {
    setCarregando(true);
    api
      .get(`/proprietario/convites/${usinaId}`)
      .then((r) => setConvites(r.data ?? []))
      .catch(() => setConvites([]))
      .finally(() => setCarregando(false));
  }, [usinaId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function handleReenviar(conviteId: string) {
    try {
      await api.post(`/proprietario/convite/${conviteId}/reenviar`);
      alert('Convite reenviado com sucesso.');
      carregar();
    } catch (e: any) {
      alert('Erro ao reenviar: ' + (e?.response?.data?.message ?? 'desconhecido'));
    }
  }

  async function handleCancelar(conviteId: string) {
    if (!confirm('Cancelar convite? Esta ação remove o convite do sistema.')) return;
    try {
      await api.delete(`/proprietario/convite/${conviteId}`);
      carregar();
    } catch (e: any) {
      alert('Erro ao cancelar: ' + (e?.response?.data?.message ?? 'desconhecido'));
    }
  }

  return (
    <Card className="mt-6 border-amber-300">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <UserPlus className="w-5 h-5 text-amber-600" />
          Acesso do Proprietário
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-md p-3 flex gap-2 text-sm text-blue-800">
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <strong>Duas formas de dar acesso:</strong>
            <ul className="list-disc pl-4 mt-1 space-y-0.5">
              <li><strong>Cadastrar manualmente:</strong> cria usuário direto com senha temporária — você envia por chat/WhatsApp.</li>
              <li><strong>Convidar por email:</strong> sistema manda link mágico, o proprietário define a própria senha.</li>
            </ul>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Dialog open={dialogManualAberto} onOpenChange={setDialogManualAberto}>
            <DialogTrigger asChild>
              <Button variant="outline" className="border-amber-500 text-amber-700">
                <UserPlus className="w-4 h-4 mr-2" /> Cadastrar manualmente
              </Button>
            </DialogTrigger>
            <CadastroManualDialog
              usinaId={usinaId}
              emailDefault={proprietarioEmail}
              onSuccess={() => { setDialogManualAberto(false); carregar(); }}
            />
          </Dialog>

          <Dialog open={dialogConviteAberto} onOpenChange={setDialogConviteAberto}>
            <DialogTrigger asChild>
              <Button className="bg-amber-600 hover:bg-amber-700">
                <Mail className="w-4 h-4 mr-2" /> Convidar por email (magic link)
              </Button>
            </DialogTrigger>
            <ConvidarEmailDialog
              usinaId={usinaId}
              emailDefault={proprietarioEmail}
              onSuccess={() => { setDialogConviteAberto(false); carregar(); }}
            />
          </Dialog>
        </div>

        {/* Lista convites */}
        <div>
          <h3 className="text-sm font-semibold mb-2 text-gray-700">Convites enviados</h3>
          {carregando ? (
            <Loader2 className="w-5 h-5 animate-spin text-amber-600" />
          ) : convites.length === 0 ? (
            <p className="text-xs text-gray-500">Nenhum convite enviado ainda.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {convites.map((c) => (
                <li key={c.id} className="border rounded p-2 flex items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{c.email}</p>
                    <p className="text-xs text-gray-500">
                      Enviado em {new Date(c.createdAt).toLocaleDateString('pt-BR')} •
                      Expira em {new Date(c.expiresAt).toLocaleDateString('pt-BR')} •
                      Token {c.tokenSufixo}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={
                      c.status === 'USADO' ? 'bg-green-100 text-green-700' :
                      c.status === 'EXPIRADO' ? 'bg-gray-200 text-gray-700' :
                      'bg-yellow-100 text-yellow-700'
                    }>
                      {c.status}
                    </Badge>
                    {c.status === 'PENDENTE' && (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => handleReenviar(c.id)} title="Reenviar">
                          <RefreshCw className="w-3 h-3" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleCancelar(c.id)} title="Cancelar">
                          <X className="w-3 h-3 text-red-500" />
                        </Button>
                      </>
                    )}
                    {c.status === 'EXPIRADO' && (
                      <Button size="sm" variant="ghost" onClick={() => handleReenviar(c.id)} title="Renovar (regen token)">
                        <RefreshCw className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Dialog: Cadastro Manual ──────────────────────────────────────

function CadastroManualDialog({
  usinaId, emailDefault, onSuccess,
}: { usinaId: string; emailDefault: string; onSuccess: () => void }) {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState(emailDefault);
  const [senhaTemp, setSenhaTemp] = useState(() => gerarSenhaForte());
  const [submitting, setSubmitting] = useState(false);
  const [credenciais, setCredenciais] = useState<{ email: string; senhaTemp: string } | null>(null);
  const [erro, setErro] = useState('');

  function gerarSenhaForte(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let s = '';
    for (let i = 0; i < 12; i++) s += chars[Math.floor(Math.random() * chars.length)];
    // Garante 1 letra + 1 numero
    return s + 'A1';
  }

  async function handleCriar() {
    if (!nome.trim() || !email.includes('@') || senhaTemp.length < 8) {
      setErro('Preencha nome, email válido e senha (≥ 8 chars).');
      return;
    }
    setSubmitting(true);
    setErro('');
    try {
      const r = await api.post('/proprietario/cadastro-manual', { usinaId, nome, email, senhaTemp });
      setCredenciais({ email: r.data.email, senhaTemp: r.data.senhaTemp });
    } catch (e: any) {
      setErro(e?.response?.data?.message ?? 'Falha ao cadastrar.');
    } finally {
      setSubmitting(false);
    }
  }

  async function copiarCredenciais() {
    if (!credenciais) return;
    const texto = `Email: ${credenciais.email}\nSenha temporária: ${credenciais.senhaTemp}\n\nAcesse: ${window.location.origin}/login`;
    await navigator.clipboard.writeText(texto);
    alert('Credenciais copiadas pra clipboard. Mande pro proprietário por chat/WhatsApp.');
  }

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>Cadastrar Proprietário Manualmente</DialogTitle>
      </DialogHeader>

      {credenciais ? (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded p-3 flex gap-2">
            <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
            <div className="text-sm text-green-800">
              <strong>Usuário criado.</strong> Copie e envie por chat/WhatsApp pro proprietário.
              Ele troca a senha no primeiro login.
            </div>
          </div>
          <div className="bg-gray-50 border rounded p-3 text-sm font-mono">
            <p><strong>Email:</strong> {credenciais.email}</p>
            <p><strong>Senha temporária:</strong> {credenciais.senhaTemp}</p>
          </div>
          <DialogFooter>
            <Button onClick={copiarCredenciais}><Copy className="w-4 h-4 mr-2" /> Copiar credenciais</Button>
            <Button variant="outline" onClick={onSuccess}>Fechar</Button>
          </DialogFooter>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <Label>Nome do proprietário</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: E-Solares" />
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="contato@esolares.com" />
          </div>
          <div>
            <Label>Senha temporária (auto-gerada — você pode editar)</Label>
            <div className="flex gap-2">
              <Input value={senhaTemp} onChange={(e) => setSenhaTemp(e.target.value)} />
              <Button variant="outline" size="sm" onClick={() => setSenhaTemp(gerarSenhaForte())}><RefreshCw className="w-3 h-3" /></Button>
            </div>
            <p className="text-xs text-gray-500 mt-1">Mínimo 8 chars com letra + número.</p>
          </div>
          {erro && <p className="text-sm text-red-600">{erro}</p>}
          <DialogFooter>
            <Button onClick={handleCriar} disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Criar usuário
            </Button>
          </DialogFooter>
        </div>
      )}
    </DialogContent>
  );
}

// ─── Dialog: Convidar por email ───────────────────────────────────

function ConvidarEmailDialog({
  usinaId, emailDefault, onSuccess,
}: { usinaId: string; emailDefault: string; onSuccess: () => void }) {
  const [email, setEmail] = useState(emailDefault);
  const [submitting, setSubmitting] = useState(false);
  const [resultado, setResultado] = useState<{ link: string; expiresAt: string; reused: boolean } | null>(null);
  const [erro, setErro] = useState('');

  async function handleEnviar() {
    if (!email.includes('@')) {
      setErro('Email inválido.');
      return;
    }
    setSubmitting(true);
    setErro('');
    try {
      const r = await api.post('/proprietario/convite', { usinaId, email });
      setResultado({
        link: r.data.link,
        expiresAt: r.data.expiresAt,
        reused: r.data.reused,
      });
    } catch (e: any) {
      setErro(e?.response?.data?.message ?? 'Falha ao enviar.');
    } finally {
      setSubmitting(false);
    }
  }

  async function copiarLink() {
    if (!resultado) return;
    await navigator.clipboard.writeText(resultado.link);
    alert('Link copiado. Você também pode mandar manualmente além do email.');
  }

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>Convidar Proprietário por Email</DialogTitle>
      </DialogHeader>

      {resultado ? (
        <div className="space-y-3">
          <div className="bg-green-50 border border-green-200 rounded p-3 flex gap-2">
            <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
            <div className="text-sm text-green-800">
              {resultado.reused
                ? <><strong>Convite pendente existente reusado.</strong> Mesmo link foi reenviado.</>
                : <><strong>Convite enviado por email!</strong> O proprietário tem 7 dias pra aceitar.</>}
            </div>
          </div>
          <div className="text-sm">
            <Label>Link gerado (caso queira copiar e mandar manualmente):</Label>
            <div className="bg-gray-50 border rounded p-2 mt-1 text-xs font-mono break-all">{resultado.link}</div>
            <Button size="sm" variant="outline" className="mt-2" onClick={copiarLink}>
              <Copy className="w-3 h-3 mr-1" /> Copiar link
            </Button>
          </div>
          <p className="text-xs text-gray-500">
            Expira em {new Date(resultado.expiresAt).toLocaleDateString('pt-BR')}.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={onSuccess}>Fechar</Button>
          </DialogFooter>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <Label>Email do proprietário</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="contato@esolares.com" />
            <p className="text-xs text-gray-500 mt-1">
              Sistema envia link mágico — proprietário clica e define própria senha.
            </p>
          </div>
          {erro && <p className="text-sm text-red-600">{erro}</p>}
          <DialogFooter>
            <Button onClick={handleEnviar} disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <Mail className="w-4 h-4 mr-2" /> Enviar convite
            </Button>
          </DialogFooter>
        </div>
      )}
    </DialogContent>
  );
}
