'use client';

/**
 * Sprint Convite-Convênio Fatia 4 (03/06/2026) — Página pública do convite.
 *
 * Fluxo single-page com 5 etapas + 2 estados terminais:
 *
 *   validando → apresentacao → solicitar-otp → validar-otp → cadastro → enviado
 *                  (token vivo)                  (otp ok)      (POST ok)
 *
 *   invalido (qualquer falha de token: inexistente / expirado / usado / status mudou)
 *
 * Defesa LGPD: backend já retorna sufixos (telefoneSufixo, cpfSufixo); frontend
 * só exibe o que recebeu. Nunca loga token no console.
 *
 * Decisão #1 (Luciano): rota `/convite-convenio/[token]` evita colisão com
 * `/convite/[codigo]` (MLM legado). D-novo-CONVITE-ROTA-CONSOLIDAR P3 catalogado.
 */

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Loader2,
  Zap,
  CheckCircle,
  AlertTriangle,
  Send,
  Smartphone,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { HelpBox } from '@/components/ui/help-box';
import { OtpInput } from '@/components/ui/otp-input';
import { formatErroBackend, extrairDetalheErro } from '@/lib/utils';
import api from '@/lib/api';

type Etapa =
  | 'validando'
  | 'invalido'
  | 'apresentacao'
  | 'solicitar-otp'
  | 'validar-otp'
  | 'cadastro'
  | 'enviado';

interface TokenValido {
  valido: true;
  empresaNome: string;
  nomeConvidado: string;
  telefoneSufixo: string;
  expiresAt: string;
  otpJaValidado: boolean;
}
interface TokenInvalido {
  valido: false;
  motivo?: string;
}
type ValidacaoToken = TokenValido | TokenInvalido;

// Máscaras (copiadas de web/app/cadastro/page.tsx — padrão do projeto)
function formatarCPF(valor: string): string {
  const nums = valor.replace(/\D/g, '').slice(0, 11);
  if (nums.length <= 3) return nums;
  if (nums.length <= 6) return `${nums.slice(0, 3)}.${nums.slice(3)}`;
  if (nums.length <= 9) return `${nums.slice(0, 3)}.${nums.slice(3, 6)}.${nums.slice(6)}`;
  return `${nums.slice(0, 3)}.${nums.slice(3, 6)}.${nums.slice(6, 9)}-${nums.slice(9)}`;
}

function formatarTelefone(valor: string): string {
  const nums = valor.replace(/\D/g, '').slice(0, 11);
  if (nums.length <= 2) return nums;
  if (nums.length <= 7) return `(${nums.slice(0, 2)}) ${nums.slice(2)}`;
  return `(${nums.slice(0, 2)}) ${nums.slice(2, 7)}-${nums.slice(7)}`;
}

export default function ConviteConvenioPage() {
  const params = useParams();
  const token = (params?.token as string) ?? '';

  const [etapa, setEtapa] = useState<Etapa>('validando');
  const [validacao, setValidacao] = useState<ValidacaoToken | null>(null);
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);

  // OTP state
  const [codigoOtp, setCodigoOtp] = useState('');
  const [otpErro, setOtpErro] = useState('');
  const [otpExpiraEm, setOtpExpiraEm] = useState<Date | null>(null); // pra exibir
  const [otpReenviosRestantes, setOtpReenviosRestantes] = useState<number | null>(null);
  const [cooldownSegRestantes, setCooldownSegRestantes] = useState(0); // contador live
  const [bloqueadoAteMs, setBloqueadoAteMs] = useState<number | null>(null); // timestamp
  const [bloqueadoCountdown, setBloqueadoCountdown] = useState(0); // seg

  // Cadastro state
  const [cpf, setCpf] = useState('');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [consumoMedioKwh, setConsumoMedioKwh] = useState('');

  // ─── Etapa 1: validar token ao carregar ──────────────────────────
  useEffect(() => {
    if (!token) {
      setEtapa('invalido');
      setValidacao({ valido: false, motivo: 'Link incompleto.' });
      return;
    }
    api
      .get<ValidacaoToken>(`/publico/convites/${token}`)
      .then((r) => {
        setValidacao(r.data);
        if (r.data.valido) {
          setEtapa('apresentacao');
        } else {
          setEtapa('invalido');
        }
      })
      .catch((err) => {
        setValidacao({ valido: false, motivo: formatErroBackend(err) });
        setEtapa('invalido');
      });
  }, [token]);

  // ─── Countdowns live ─────────────────────────────────────────────
  useEffect(() => {
    if (cooldownSegRestantes <= 0) return;
    const id = setInterval(() => {
      setCooldownSegRestantes((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [cooldownSegRestantes]);

  useEffect(() => {
    if (!bloqueadoAteMs) return;
    const tick = () => {
      const restante = Math.max(0, Math.ceil((bloqueadoAteMs - Date.now()) / 1000));
      setBloqueadoCountdown(restante);
      if (restante === 0) setBloqueadoAteMs(null);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [bloqueadoAteMs]);

  // ─── Solicitar OTP ────────────────────────────────────────────────
  async function solicitarOtp() {
    setLoading(true);
    setOtpErro('');
    try {
      const r = await api.post<{
        ok: boolean;
        expiraEmSegundos: number;
        reenviosRestantes: number;
        whatsappEnviado: boolean;
      }>(`/publico/convites/${token}/solicitar-otp`);
      setOtpExpiraEm(new Date(Date.now() + r.data.expiraEmSegundos * 1000));
      setOtpReenviosRestantes(r.data.reenviosRestantes);
      setCooldownSegRestantes(60); // cooldown imediato após enviar
      setEtapa('validar-otp');
      setCodigoOtp('');
    } catch (err) {
      const det = extrairDetalheErro(err);
      const tipo = det?.erro as string | undefined;
      if (tipo === 'bloqueado' && typeof det?.desbloqueadoEm === 'string') {
        setBloqueadoAteMs(new Date(det.desbloqueadoEm).getTime());
      }
      if (tipo === 'cooldown' && typeof det?.liberadoEm === 'string') {
        const seg = Math.max(0, Math.ceil((new Date(det.liberadoEm as string).getTime() - Date.now()) / 1000));
        setCooldownSegRestantes(seg);
      }
      setOtpErro(formatErroBackend(err));
    } finally {
      setLoading(false);
    }
  }

  // ─── Validar OTP ──────────────────────────────────────────────────
  async function validarOtp(codigo: string) {
    if (codigo.length !== 6) return;
    setLoading(true);
    setOtpErro('');
    try {
      await api.post<{ ok: true }>(`/publico/convites/${token}/validar-otp`, { codigo });
      setEtapa('cadastro');
    } catch (err) {
      const det = extrairDetalheErro(err);
      if (det?.erro === 'bloqueado' && typeof det.desbloqueadoEm === 'string') {
        setBloqueadoAteMs(new Date(det.desbloqueadoEm).getTime());
      }
      setOtpErro(formatErroBackend(err));
      setCodigoOtp('');
    } finally {
      setLoading(false);
    }
  }

  // ─── Submeter cadastro ────────────────────────────────────────────
  async function submeterCadastro(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    const cpfLimpo = cpf.replace(/\D/g, '');
    if (cpfLimpo.length !== 11) {
      setErro('CPF inválido — informe 11 dígitos.');
      return;
    }
    if (nome.trim().length < 2) {
      setErro('Nome obrigatório (mínimo 2 caracteres).');
      return;
    }
    if (!email.includes('@')) {
      setErro('Email inválido.');
      return;
    }
    setLoading(true);
    try {
      await api.post(`/publico/convenios/auto-inscrever`, {
        token,
        cpf: cpfLimpo,
        nome: nome.trim(),
        email: email.trim(),
        telefone: telefone.replace(/\D/g, '') || undefined,
        consumoMedioKwh: consumoMedioKwh ? Number(consumoMedioKwh) : undefined,
      });
      setEtapa('enviado');
    } catch (err) {
      setErro(formatErroBackend(err));
    } finally {
      setLoading(false);
    }
  }

  // ─── Renderização ─────────────────────────────────────────────────

  if (etapa === 'validando') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-yellow-100 p-4">
        <Loader2 className="w-10 h-10 animate-spin text-amber-600" />
      </div>
    );
  }

  if (etapa === 'invalido') {
    const motivo = validacao && !validacao.valido ? validacao.motivo : 'Convite indisponível.';
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-6 h-6" /> Convite indisponível
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-gray-700">{motivo}</p>
            <p className="text-xs text-gray-500">
              Se você acredita que isso é um erro, peça à empresa pra enviar um novo convite.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!validacao || !validacao.valido) {
    return null; // type guard
  }

  if (etapa === 'enviado') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-yellow-100 p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-700">
              <CheckCircle className="w-6 h-6" /> Cadastro enviado
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-gray-800">
              Sua inscrição foi enviada com sucesso! Agora <strong>{validacao.empresaNome}</strong> precisa
              confirmar que você é mesmo funcionário/médico, e em seguida o admin da CoopereBR vai revisar
              seu cadastro.
            </p>
            <p className="text-sm text-gray-700">
              Quando você for aprovado, vamos te avisar por WhatsApp.
            </p>
            <p className="text-xs text-gray-500">
              Você pode fechar esta página.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Etapas com dados do convite — wrapper compartilhado
  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-yellow-100 p-4 sm:p-6">
      <div className="max-w-md mx-auto space-y-4">
        {/* Header com identidade visual */}
        <div className="flex items-center justify-center gap-2 py-2">
          <Zap className="w-7 h-7 text-amber-500" />
          <h1 className="text-xl font-bold text-amber-900">CoopereBR</h1>
        </div>

        {/* ── ETAPA APRESENTACAO ─────────────────────────────────── */}
        {etapa === 'apresentacao' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-amber-900">
                Olá, {validacao.nomeConvidado}!
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-800">
                A empresa <strong>{validacao.empresaNome}</strong> te convidou pro programa de custeio de
                energia da CoopereBR.
              </p>

              <HelpBox id="convite-convenio-intro" titulo="O que isso quer dizer">
                <p>
                  A <strong>{validacao.empresaNome}</strong> vai <strong>pagar sua conta de energia</strong>{' '}
                  todo mês — você <strong>não paga nada</strong>. A CoopereBR cuida da operação no meio do
                  caminho.
                </p>
                <p className="mt-2">
                  <strong>Ex:</strong> se sua conta de luz hoje é R$ 200, você passa a pagar R$ 0 — a empresa
                  assume.
                </p>
                <p className="mt-2 text-xs">
                  Pra continuar, vamos enviar um código no seu WhatsApp pra confirmar que esse celular é seu.
                </p>
              </HelpBox>

              <Button
                onClick={solicitarOtp}
                disabled={loading || cooldownSegRestantes > 0}
                className="w-full bg-amber-600 hover:bg-amber-700"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                Receber código por WhatsApp
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>

              {cooldownSegRestantes > 0 && (
                <p className="text-xs text-amber-700 text-center">
                  Aguarde {cooldownSegRestantes}s pra solicitar novamente.
                </p>
              )}
              {bloqueadoCountdown > 0 && (
                <p className="text-xs text-red-700 text-center">
                  Bloqueado por excesso de tentativas. Tente em{' '}
                  {Math.ceil(bloqueadoCountdown / 60)} min.
                </p>
              )}
              {otpErro && bloqueadoCountdown === 0 && cooldownSegRestantes === 0 && (
                <p className="text-xs text-red-700 text-center">{otpErro}</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── ETAPA VALIDAR OTP ───────────────────────────────────── */}
        {etapa === 'validar-otp' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-900">
                <Smartphone className="w-5 h-5" /> Confirme o código
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-800">
                Enviamos um código de 6 dígitos pro WhatsApp{' '}
                <strong>{validacao.telefoneSufixo}</strong>.
              </p>

              <HelpBox id="convite-convenio-validar-otp" titulo="Digite o código">
                <p>O código tem 6 dígitos e <strong>expira em 10 minutos</strong>.</p>
                <p className="mt-2">
                  <strong>Ex:</strong> se errar 5 vezes, ficamos bloqueados por 1 hora — confira com calma.
                </p>
                {otpReenviosRestantes !== null && (
                  <p className="mt-2 text-xs">
                    Reenvios restantes: <strong>{otpReenviosRestantes}</strong>.
                  </p>
                )}
              </HelpBox>

              <OtpInput
                value={codigoOtp}
                onChange={(c) => {
                  setCodigoOtp(c);
                  setOtpErro('');
                }}
                onComplete={validarOtp}
                disabled={loading || bloqueadoCountdown > 0}
                erro={!!otpErro && bloqueadoCountdown === 0}
              />

              {otpErro && (
                <p className="text-sm text-red-700 text-center">{otpErro}</p>
              )}
              {bloqueadoCountdown > 0 && (
                <p className="text-sm text-red-700 text-center">
                  Bloqueado por {Math.ceil(bloqueadoCountdown / 60)} min.
                </p>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setEtapa('apresentacao')}
                  disabled={loading}
                  className="flex-1"
                >
                  Voltar
                </Button>
                <Button
                  onClick={solicitarOtp}
                  disabled={loading || cooldownSegRestantes > 0}
                  variant="outline"
                  className="flex-1"
                >
                  {cooldownSegRestantes > 0
                    ? `Reenviar (${cooldownSegRestantes}s)`
                    : 'Reenviar código'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── ETAPA CADASTRO ──────────────────────────────────────── */}
        {etapa === 'cadastro' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-900">
                <ShieldCheck className="w-5 h-5 text-green-600" /> Quase lá!
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-800">
                Código confirmado ✓. Agora só falta seus dados.
              </p>

              <HelpBox id="convite-convenio-cadastro" titulo="O que vai acontecer agora">
                <p>
                  Seus dados serão revisados pela <strong>{validacao.empresaNome}</strong> e em seguida pelo
                  admin da CoopereBR.
                </p>
                <p className="mt-2">
                  <strong>Ex:</strong> depois de enviar, sua conta fica <strong>pendente de aprovação</strong>.
                  Quando for ativada, te avisamos pelo WhatsApp.
                </p>
              </HelpBox>

              <form onSubmit={submeterCadastro} className="space-y-3">
                <div>
                  <Label htmlFor="nome">Nome completo</Label>
                  <Input
                    id="nome"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="João da Silva"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="cpf">CPF</Label>
                  <Input
                    id="cpf"
                    inputMode="numeric"
                    value={cpf}
                    onChange={(e) => setCpf(formatarCPF(e.target.value))}
                    placeholder="000.000.000-00"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="telefone">Telefone (opcional)</Label>
                  <Input
                    id="telefone"
                    inputMode="numeric"
                    value={telefone}
                    onChange={(e) => setTelefone(formatarTelefone(e.target.value))}
                    placeholder="(27) 99876-5432"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Se preencher, será seu contato principal. Senão usamos o telefone que a empresa cadastrou.
                  </p>
                </div>
                <div>
                  <Label htmlFor="consumo">Consumo médio em kWh/mês (opcional)</Label>
                  <Input
                    id="consumo"
                    type="number"
                    min="0"
                    step="1"
                    value={consumoMedioKwh}
                    onChange={(e) => setConsumoMedioKwh(e.target.value)}
                    placeholder="300"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Deixe em branco se não souber — a empresa/admin ajusta depois.
                  </p>
                </div>

                {erro && <p className="text-sm text-red-700 bg-red-50 border border-red-300 rounded p-2">{erro}</p>}

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-amber-600 hover:bg-amber-700"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4 mr-2" />
                  )}
                  Enviar cadastro
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Rodapé pequeno com expiração */}
        {validacao.expiresAt && (
          <p className="text-xs text-amber-800 text-center opacity-75 pt-2">
            Este convite expira em {new Date(validacao.expiresAt).toLocaleDateString('pt-BR')}.
          </p>
        )}
      </div>
    </div>
  );
}
