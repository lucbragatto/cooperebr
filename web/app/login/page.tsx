'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  Coins,
  KeyRound,
  QrCode,
  ShieldCheck,
  Smartphone,
  Sun,
  UserPlus,
} from 'lucide-react';
import {
  login,
  solicitarCodigoLogin,
  validarCodigoLogin,
  type SolicitarCodigoResposta,
} from '@/lib/auth';
import { Button } from '@/components/ui/button';

const SITE_PUBLICO_URL =
  process.env.NEXT_PUBLIC_SITE_PUBLICO_URL || 'https://clube.cooperebr.com.br';

// Sprint Portal Empresa 9.0 (04/06/2026) + ajuste Fatia F-G1 (05/06/2026):
// box dev-only com contas de teste. Senhas resetadas pelos seeds dev.
// D-novo-PORTAL-EMPRESA-SEED-TESTE (P3): remover este box antes de produção.
type CredTeste = { email: string; senha: string; titulo: string; desc: string };

const CREDENCIAIS_TESTE: CredTeste[] = [
  {
    email: 'superadmin@cooperebr.com.br',
    senha: 'Teste@123',
    titulo: 'SUPER ADMIN',
    desc: 'Acesso global · /dashboard · painel impersonate (dev/credenciais-teste)',
  },
  {
    email: 'admin@cooperebr.com.br',
    senha: 'Teste@123',
    titulo: 'ADMIN — COOPERE-BR',
    desc: 'Admin da cooperativa · /dashboard',
  },
  {
    email: 'teste@cooperebr.com',
    senha: 'Teste@123',
    titulo: 'COOPERADO',
    desc: 'Cooperado de teste (Luciano Teste) · /portal',
  },
  {
    email: 'lucbragatto+empresa-teste@gmail.com',
    senha: 'Teste@123',
    titulo: 'Empresa cooperada',
    desc: 'Cooperado PJ (Clínica Teste) · /conveniada (via contexto)',
  },
];

// isAmbienteReal() do backend = AMBIENTE_REAL==='true'. No front:
// NEXT_PUBLIC_AMBIENTE_REAL não definido OU 'false' → dev → mostra box.
const isProducao = process.env.NEXT_PUBLIC_AMBIENTE_REAL === 'true';

type Etapa = 'identificacao' | 'codigo' | 'boasvindas' | 'senha';

const REENVIO_SEGUNDOS = 60;

function mensagemErro(e: unknown, padrao: string): string {
  const msg = (e as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
  if (typeof msg === 'string' && msg.trim()) return msg;
  if (Array.isArray(msg) && typeof msg[0] === 'string') return msg[0];
  return padrao;
}

function codigoErro(e: unknown): string | undefined {
  return (e as { response?: { data?: { codigo?: string } } })?.response?.data?.codigo;
}

const campoClasse =
  'h-14 w-full rounded-2xl border-[1.5px] border-[#101510] bg-white px-4 text-base text-[#101510] outline-none transition placeholder:text-[#8a9385] focus:border-[#166534] focus:ring-4 focus:ring-[#d7ff65]';

export default function LoginPage() {
  const router = useRouter();
  const [etapa, setEtapa] = useState<Etapa>('identificacao');
  const [identificador, setIdentificador] = useState('');
  const [senha, setSenha] = useState('');
  const [codigo, setCodigo] = useState('');
  const [envio, setEnvio] = useState<SolicitarCodigoResposta | null>(null);
  const [reenvioEm, setReenvioEm] = useState(0);
  const [nome, setNome] = useState('');
  const [erro, setErro] = useState('');
  const [semCadastro, setSemCadastro] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const validandoRef = useRef(false);

  useEffect(() => {
    if (reenvioEm <= 0) return;
    const t = setTimeout(() => setReenvioEm((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [reenvioEm]);

  function irPara(nova: Etapa) {
    setEtapa(nova);
    setErro('');
    setSemCadastro(false);
    setCodigo('');
  }

  async function solicitar(e?: React.FormEvent) {
    e?.preventDefault();
    setErro('');
    setSemCadastro(false);
    setCarregando(true);
    try {
      const r = await solicitarCodigoLogin(identificador);
      setEnvio(r);
      setCodigo('');
      setReenvioEm(REENVIO_SEGUNDOS);
      setEtapa('codigo');
    } catch (err) {
      setErro(mensagemErro(err, 'Não foi possível enviar o código. Tente novamente.'));
    } finally {
      setCarregando(false);
    }
  }

  const validar = useCallback(
    async (valor: string) => {
      if (validandoRef.current || valor.length !== 6) return;
      validandoRef.current = true;
      setErro('');
      setCarregando(true);
      try {
        const r = await validarCodigoLogin(identificador, valor);
        if (r.novoCadastro) {
          setNome(r.nome.split(' ')[0] || '');
          setEtapa('boasvindas');
        } else {
          router.push('/selecionar-contexto');
        }
      } catch (err) {
        if (codigoErro(err) === 'NAO_BENEFICIARIO_COOPEREBR') setSemCadastro(true);
        setErro(mensagemErro(err, 'Código inválido. Confira ou peça um novo.'));
        setCodigo('');
      } finally {
        setCarregando(false);
        validandoRef.current = false;
      }
    },
    [identificador, router],
  );

  async function entrarComSenha(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    setCarregando(true);
    try {
      await login(identificador, senha);
      router.push('/selecionar-contexto');
    } catch {
      setErro('Identificador ou senha inválidos.');
    } finally {
      setCarregando(false);
    }
  }

  function alterarCodigo(valor: string) {
    const digitos = valor.replace(/\D/g, '').slice(0, 6);
    setCodigo(digitos);
    if (digitos.length === 6) void validar(digitos);
  }

  function preencherCred(c: CredTeste) {
    irPara('senha');
    setIdentificador(c.email);
    setSenha(c.senha);
  }

  const passo = etapa === 'codigo' ? 2 : etapa === 'boasvindas' ? 3 : 1;
  const destino = envio?.telefoneMascarado || envio?.emailMascarado || 'seu contato cadastrado';

  return (
    <main className="flex min-h-screen flex-col bg-[#101510] text-[#101510] lg:flex-row">
      {/* Mensagem do clube */}
      <section className="flex flex-col gap-6 px-5 pb-8 pt-5 text-white sm:px-8 sm:pb-10 lg:min-h-screen lg:flex-[1.15] lg:gap-10 lg:p-14">
        <header className="flex items-center justify-between gap-3">
          <Link href={SITE_PUBLICO_URL} className="flex items-center gap-3" aria-label="Clube COOPERE-BR">
            <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-white">
              <Image
                src="/brand/logo-cooperebr.jpg"
                alt=""
                width={40}
                height={40}
                priority
                className="h-full w-full object-cover"
              />
            </span>
            <span className="leading-tight">
              <span className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-[#a9b3a4]">
                COOPERE-BR
              </span>
              <span className="block text-[15px] font-semibold">Clube Solar</span>
            </span>
          </Link>
          <Link
            href={SITE_PUBLICO_URL}
            className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-[#d7ff65] hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao site
          </Link>
        </header>

        <div className="flex flex-wrap items-center gap-5 sm:gap-8 lg:my-auto">
          <div className="relative aspect-square w-28 shrink-0 sm:w-36 lg:w-48" aria-hidden="true">
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background:
                  'conic-gradient(#d7ff65 0deg 72deg, rgba(255,255,255,0.10) 72deg 360deg)',
              }}
            />
            <div className="absolute inset-[8%] flex flex-col items-center justify-center rounded-full bg-[#101510]">
              <Sun className="h-5 w-5 text-[#d7ff65] lg:h-6 lg:w-6" />
              <span className="mt-0.5 text-xl font-bold sm:text-2xl lg:text-3xl">até 20%</span>
              <span className="text-[10px] text-[#a9b3a4] sm:text-[11px]">da fatura em tokens</span>
            </div>
          </div>
          <div className="min-w-0 max-w-xl flex-1 basis-64">
            <h1 className="text-[30px] font-semibold leading-[1.05] sm:text-4xl lg:text-6xl">
              Sua energia virou benefício.
            </h1>
            <p className="mt-3 text-[15px] leading-relaxed text-[#c4ccbf] sm:text-base lg:mt-5 lg:text-lg">
              Receba até 20% da fatura em CooperTokens e use nos parceiros do clube. Entre com o
              mesmo celular do app COOPERE-BR.
            </p>
          </div>
        </div>

        <ul className="hidden flex-wrap gap-2.5 sm:flex">
          {[
            { icon: Smartphone, titulo: 'Celular', texto: 'sem senha' },
            { icon: KeyRound, titulo: 'Código', texto: 'SMS ou e-mail' },
            { icon: QrCode, titulo: 'Parceiros', texto: 'pague com tokens' },
          ].map(({ icon: Icon, titulo, texto }) => (
            <li
              key={titulo}
              className="flex flex-1 basis-40 items-center gap-2.5 rounded-2xl border border-white/15 px-4 py-3.5"
            >
              <Icon className="h-5 w-5 text-[#d7ff65]" aria-hidden="true" />
              <span className="text-sm font-semibold">{titulo}</span>
              <span className="text-[13px] text-[#a9b3a4]">{texto}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Cartão de acesso */}
      <section className="flex flex-1 lg:min-h-screen lg:py-12 lg:pr-12">
        <div className="flex flex-1 flex-col justify-center rounded-t-[28px] bg-white px-5 py-8 sm:px-10 sm:py-12 lg:rounded-[32px]">
          <div className="mx-auto w-full max-w-md">
            <div className="mb-6 flex gap-1.5" aria-hidden="true">
              {[1, 2, 3].map((i) => (
                <span
                  key={i}
                  className={`h-1.5 w-7 rounded-full ${i <= passo ? 'bg-[#101510]' : 'bg-[#dfe5d8]'}`}
                />
              ))}
            </div>

            {etapa === 'identificacao' && (
              <form onSubmit={solicitar} className="space-y-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#5b6656]">
                  Área do cooperado
                </p>
                <h2 className="text-[28px] font-semibold leading-tight lg:text-[34px]">Entrar no Clube</h2>
                <div className="space-y-1.5">
                  <label htmlFor="identificador" className="text-sm font-semibold text-[#3d4639]">
                    Celular ou e-mail
                  </label>
                  <input
                    id="identificador"
                    type="text"
                    inputMode="email"
                    autoComplete="username"
                    placeholder="(27) 99999-9999 ou e-mail"
                    value={identificador}
                    onChange={(e) => setIdentificador(e.target.value)}
                    required
                    autoFocus
                    className={campoClasse}
                  />
                </div>
                {erro && <p className="text-sm text-red-700">{erro}</p>}
                <button
                  type="submit"
                  disabled={carregando}
                  className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#d7ff65] text-base font-semibold text-[#102012] transition hover:bg-[#c8f24f] disabled:opacity-60"
                >
                  {carregando ? 'Enviando...' : 'Receber código'}
                  {!carregando && <ArrowRight className="h-4 w-4" />}
                </button>
                <p className="flex items-center gap-2 text-xs text-[#5b6656]">
                  <ShieldCheck className="h-4 w-4 shrink-0 text-[#166534]" />
                  Mesmo acesso do app COOPERE-BR. Sem senha para lembrar.
                </p>
              </form>
            )}

            {etapa === 'codigo' && (
              <div className="space-y-4">
                <button
                  type="button"
                  onClick={() => irPara('identificacao')}
                  aria-label="Voltar e trocar celular ou e-mail"
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-[#dfe5d8] hover:bg-[#f5f7f2]"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <h2 className="text-[28px] font-semibold leading-tight lg:text-[34px]">Digite o código</h2>
                <p className="text-[15px] leading-relaxed text-[#4b5546]">
                  Se houver cadastro, enviamos 6 dígitos para{' '}
                  <strong className="text-[#101510]">{destino}</strong>.
                </p>
                <div className="space-y-1.5">
                  <label htmlFor="codigo" className="text-sm font-semibold text-[#3d4639]">
                    Código de 6 dígitos
                  </label>
                  <input
                    id="codigo"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    placeholder="000000"
                    value={codigo}
                    onChange={(e) => alterarCodigo(e.target.value)}
                    autoFocus
                    disabled={carregando}
                    className={`${campoClasse} h-16 text-center text-3xl font-semibold tracking-[0.5em] placeholder:tracking-[0.5em]`}
                  />
                </div>
                {erro && <p className="text-sm text-red-700">{erro}</p>}
                {semCadastro && (
                  <Link
                    href="/entrar"
                    className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#166534] text-sm font-semibold text-white"
                  >
                    <UserPlus className="h-4 w-4" />
                    Fazer meu cadastro no clube
                  </Link>
                )}
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm">
                  {reenvioEm > 0 ? (
                    <span className="text-[#4b5546]">
                      Reenviar em <strong className="text-[#101510]">0:{String(reenvioEm).padStart(2, '0')}</strong>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => solicitar()}
                      disabled={carregando}
                      className="min-h-11 font-semibold text-[#166534] hover:underline disabled:opacity-50"
                    >
                      Reenviar código
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => irPara('identificacao')}
                    className="min-h-11 font-semibold text-[#166534] hover:underline"
                  >
                    Trocar celular/e-mail
                  </button>
                </div>
                <div className="flex gap-2.5 rounded-2xl bg-[#f5f7f2] px-4 py-3.5">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#166534]" />
                  <p className="text-[13px] leading-snug text-[#3d4639]">
                    <strong className="text-[#101510]">A COOPERE-BR nunca pede este código.</strong> Não
                    repasse por telefone ou WhatsApp. Ele vale 10 minutos.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => validar(codigo)}
                  disabled={carregando || codigo.length !== 6}
                  className="h-14 w-full rounded-2xl bg-[#101510] text-base font-semibold text-white transition hover:bg-black disabled:opacity-50"
                >
                  {carregando ? 'Entrando...' : 'Entrar no Clube'}
                </button>
              </div>
            )}

            {etapa === 'boasvindas' && (
              <div className="space-y-4">
                <span className="inline-block rounded-full bg-[#d7ff65] px-3 py-1.5 text-xs font-semibold tracking-[0.12em] text-[#102012]">
                  PRIMEIRO ACESSO
                </span>
                <h2 className="text-[28px] font-semibold leading-tight lg:text-[34px]">
                  Bem-vindo ao Clube{nome ? `, ${nome}` : ''}.
                </h2>
                <p className="text-[15px] leading-relaxed text-[#4b5546]">
                  Trouxemos seu cadastro da COOPERE-BR. Você não precisa preencher nada.
                </p>
                <div className="flex items-center gap-3 rounded-2xl border border-[#dfe5d8] p-3.5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#d7ff65]">
                    <Coins className="h-5 w-5 text-[#102012]" />
                  </span>
                  <p className="text-sm leading-snug">
                    <strong>Até 20% da fatura em tokens</strong>, creditados no seu saldo
                  </p>
                </div>
                <div className="flex items-center gap-3 rounded-2xl border border-[#dfe5d8] p-3.5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#101510]">
                    <QrCode className="h-5 w-5 text-[#d7ff65]" />
                  </span>
                  <p className="text-sm leading-snug">
                    <strong>Pague nos parceiros</strong> por QR Code
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => router.push('/selecionar-contexto')}
                  className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#d7ff65] text-base font-semibold text-[#102012] transition hover:bg-[#c8f24f]"
                >
                  Ir para o Clube
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            )}

            {etapa === 'senha' && (
              <form onSubmit={entrarComSenha} className="space-y-4">
                <button
                  type="button"
                  onClick={() => irPara('identificacao')}
                  aria-label="Voltar para o acesso por código"
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-[#dfe5d8] hover:bg-[#f5f7f2]"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <h2 className="text-[28px] font-semibold leading-tight">Acesso da equipe</h2>
                <div className="space-y-1.5">
                  <label htmlFor="ident-senha" className="text-sm font-semibold text-[#3d4639]">
                    E-mail, CPF ou telefone
                  </label>
                  <input
                    id="ident-senha"
                    type="text"
                    autoComplete="username"
                    value={identificador}
                    onChange={(e) => setIdentificador(e.target.value)}
                    required
                    className={campoClasse}
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="senha" className="text-sm font-semibold text-[#3d4639]">
                    Senha
                  </label>
                  <input
                    id="senha"
                    type="password"
                    autoComplete="current-password"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    required
                    className={campoClasse}
                  />
                </div>
                {erro && <p className="text-sm text-red-700">{erro}</p>}
                <button
                  type="submit"
                  disabled={carregando}
                  className="h-14 w-full rounded-2xl bg-[#101510] text-base font-semibold text-white transition hover:bg-black disabled:opacity-60"
                >
                  {carregando ? 'Entrando...' : 'Entrar'}
                </button>
                <div className="text-center">
                  <Link href="/esqueci-senha" className="text-sm text-[#166534] hover:underline">
                    Esqueci minha senha
                  </Link>
                </div>
              </form>
            )}

            {(etapa === 'identificacao' || etapa === 'senha') && (
              <div className="mt-6 space-y-3 border-t border-[#e6ebe0] pt-4">
                <div className="flex flex-wrap items-center justify-between gap-x-3 text-sm">
                  <span className="text-[#5b6656]">Ainda não é cooperado?</span>
                  <Link
                    href="/entrar"
                    className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-[#166534] hover:underline"
                  >
                    Cadastrar pelo WhatsApp
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
                {etapa === 'identificacao' && (
                  <button
                    type="button"
                    onClick={() => irPara('senha')}
                    className="min-h-11 text-[13px] text-[#5b6656] hover:underline"
                  >
                    Equipe COOPERE-BR? Entrar com senha
                  </button>
                )}
              </div>
            )}

            {/* Box dev-only de credenciais de teste.
                D-novo-PORTAL-EMPRESA-SEED-TESTE (P3): remover antes de produção. */}
            {!isProducao && etapa === 'senha' && (
              <div className="mt-6 space-y-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs">
                <p className="font-semibold text-amber-900">Credenciais de teste (DEV)</p>
                {CREDENCIAIS_TESTE.map((c) => (
                  <div key={c.email} className="space-y-1.5 rounded-md border border-amber-200 bg-white p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] font-semibold text-amber-900">{c.titulo}</p>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => preencherCred(c)}
                        className="h-6 border-amber-400 px-2 text-[10px] text-amber-900 hover:bg-amber-100"
                      >
                        Preencher
                      </Button>
                    </div>
                    <p className="text-[10px] leading-snug text-amber-700">{c.desc}</p>
                    <p className="font-mono text-[10px] text-amber-800">
                      <span className="select-all">{c.email}</span> · <span className="select-all">{c.senha}</span>
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
