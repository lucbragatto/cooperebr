'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Coins,
  KeyRound,
  Loader2,
  MessageCircle,
  QrCode,
  Share2,
  ShieldCheck,
  Sun,
  UserCheck,
} from 'lucide-react';
import { formatarTelefone } from '@/lib/formatar-telefone';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
const SITE_PUBLICO_URL =
  process.env.NEXT_PUBLIC_SITE_PUBLICO_URL || 'https://clube.cooperebr.com.br';

const campoClasse =
  'h-14 w-full rounded-2xl border-[1.5px] border-[#101510] bg-white px-4 text-base text-[#101510] outline-none transition placeholder:text-[#8a9385] focus:border-[#166534] focus:ring-4 focus:ring-[#d7ff65]';

const proximosPassos = [
  { titulo: 'Mensagem no WhatsApp', texto: 'Você recebe nossa mensagem em instantes.', icon: MessageCircle },
  { titulo: 'Simulação e adesão', texto: 'Mostramos quanto volta em tokens e concluímos seu cadastro de cooperado.', icon: UserCheck },
  { titulo: 'Acesso ao clube', texto: 'Você entra com o celular e um código. Sem senha.', icon: KeyRound },
];

function EntrarContent() {
  const searchParams = useSearchParams();
  const codigoRef = searchParams.get('ref') ?? '';

  const [nomeIndicador, setNomeIndicador] = useState('');
  const [nome, setNome] = useState(searchParams.get('nome') ?? '');
  const [telefone, setTelefone] = useState(formatarTelefone(searchParams.get('tel') ?? ''));
  const [loading, setLoading] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const [erro, setErro] = useState('');
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    if (!codigoRef) return;
    fetch(`${API_URL}/publico/convite/${codigoRef}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.valido) setNomeIndicador(data.nomeIndicador);
      })
      .catch(() => {});
  }, [codigoRef]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro('');

    const telLimpo = telefone.replace(/\D/g, '');
    if (nome.trim().split(/\s+/).length < 2) {
      setErro('Informe nome e sobrenome.');
      return;
    }
    if (telLimpo.length !== 11) {
      setErro('Informe o celular com DDD. Ex.: (27) 99999-9999');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/publico/iniciar-cadastro`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: nome.trim(),
          telefone: telLimpo,
          codigoRef: codigoRef || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Erro ao enviar');
      setSucesso(true);
    } catch (err: unknown) {
      setErro(err instanceof Error && err.message ? err.message : 'Erro ao enviar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  const linkConvite =
    typeof window !== 'undefined' ? `${window.location.origin}/entrar` : 'https://cliente.clube.cooperebr.com.br/entrar';
  const textoConvite = `Conheça o Clube COOPERE-BR: até 20% da conta de luz volta em CooperTokens para usar nos parceiros. Sem obra e sem investimento: ${linkConvite}`;

  async function copiarConvite() {
    try {
      await navigator.clipboard.writeText(textoConvite);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      /* sem permissão de área de transferência: ignora */
    }
  }

  const primeiroNome = nome.trim().split(/\s+/)[0] ?? '';

  return (
    <main className="flex min-h-screen flex-col bg-[#101510] text-[#101510] lg:flex-row">
      {/* Mensagem */}
      <section className="flex flex-col gap-6 px-5 pb-8 pt-5 text-white sm:px-8 sm:pb-10 lg:min-h-screen lg:flex-[1.15] lg:gap-10 lg:p-14">
        <header className="flex items-center justify-between gap-3">
          <Link href={SITE_PUBLICO_URL} className="flex items-center gap-3" aria-label="Clube COOPERE-BR">
            <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-white">
              <Image src="/brand/logo-cooperebr.jpg" alt="" width={40} height={40} priority className="h-full w-full object-cover" />
            </span>
            <span className="leading-tight">
              <span className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-[#a9b3a4]">COOPERE-BR</span>
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
              style={{ background: 'conic-gradient(#d7ff65 0deg 72deg, rgba(255,255,255,0.10) 72deg 360deg)' }}
            />
            <div className="absolute inset-[8%] flex flex-col items-center justify-center rounded-full bg-[#101510]">
              <Sun className="h-5 w-5 text-[#d7ff65] lg:h-6 lg:w-6" />
              <span className="mt-0.5 text-xl font-bold sm:text-2xl lg:text-3xl">até 20%</span>
              <span className="text-[10px] text-[#a9b3a4] sm:text-[11px]">da fatura em tokens</span>
            </div>
          </div>
          <div className="min-w-0 max-w-xl flex-1 basis-64">
            <h1 className="text-[30px] font-semibold leading-[1.05] sm:text-4xl lg:text-6xl">
              Entre para o clube em 1 minuto.
            </h1>
            <p className="mt-3 text-[15px] leading-relaxed text-[#c4ccbf] sm:text-base lg:mt-5 lg:text-lg">
              Deixe nome e WhatsApp. A gente faz sua simulação e cuida do cadastro de cooperado, com ou
              sem conta de energia.
            </p>
          </div>
        </div>

        <ul className="hidden flex-wrap gap-2.5 sm:flex">
          {[
            { icon: Sun, titulo: 'Sem obra', texto: 'nem investimento' },
            { icon: Coins, titulo: 'Tokens', texto: 'todo mês' },
            { icon: QrCode, titulo: 'Parceiros', texto: 'pague com tokens' },
          ].map(({ icon: Icon, titulo, texto }) => (
            <li key={titulo} className="flex flex-1 basis-40 items-center gap-2.5 rounded-2xl border border-white/15 px-4 py-3.5">
              <Icon className="h-5 w-5 text-[#d7ff65]" aria-hidden="true" />
              <span className="text-sm font-semibold">{titulo}</span>
              <span className="text-[13px] text-[#a9b3a4]">{texto}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Cartão */}
      <section className="flex flex-1 lg:min-h-screen lg:py-12 lg:pr-12">
        <div className="flex flex-1 flex-col justify-center rounded-t-[28px] bg-white px-5 py-8 sm:px-10 sm:py-12 lg:rounded-[32px]">
          <div className="mx-auto w-full max-w-md">
            <div className="mb-6 flex gap-1.5" aria-hidden="true">
              {[1, 2, 3].map((i) => (
                <span
                  key={i}
                  className={`h-1.5 w-7 rounded-full ${i <= (sucesso ? 2 : 1) ? 'bg-[#101510]' : 'bg-[#dfe5d8]'}`}
                />
              ))}
            </div>

            {!sucesso ? (
              <>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#5b6656]">Novo cadastro</p>
                <h2 className="mt-2 text-[28px] font-semibold leading-tight lg:text-[34px]">Quero participar</h2>

                {nomeIndicador && (
                  <div className="mt-4 flex items-center gap-3 rounded-2xl bg-[#eef8df] p-3.5">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#d7ff65]">
                      <UserCheck className="h-5 w-5 text-[#102012]" aria-hidden="true" />
                    </span>
                    <p className="text-sm leading-snug text-[#1d3a14]">
                      Você foi convidado por <strong>{nomeIndicador}</strong>.
                    </p>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="mt-5 space-y-4" noValidate>
                  <div className="space-y-1.5">
                    <label htmlFor="nome" className="text-sm font-semibold text-[#3d4639]">
                      Nome completo
                    </label>
                    <input
                      id="nome"
                      autoComplete="name"
                      autoCapitalize="words"
                      placeholder="Seu nome e sobrenome"
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      required
                      className={campoClasse}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="telefone" className="text-sm font-semibold text-[#3d4639]">
                      Celular com WhatsApp
                    </label>
                    <input
                      id="telefone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel-national"
                      placeholder="(27) 99999-9999"
                      value={telefone}
                      onChange={(e) => setTelefone(formatarTelefone(e.target.value))}
                      required
                      className={campoClasse}
                    />
                  </div>

                  {erro && <p className="text-sm text-red-700">{erro}</p>}

                  <button
                    type="submit"
                    disabled={loading}
                    className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#d7ff65] text-base font-semibold text-[#102012] transition hover:bg-[#c8f24f] disabled:opacity-60"
                  >
                    {loading ? (
                      <Loader2 className="h-5 w-5 animate-spin" aria-label="Enviando" />
                    ) : (
                      <>
                        <MessageCircle className="h-5 w-5" />
                        Continuar pelo WhatsApp
                      </>
                    )}
                  </button>

                  <p className="flex items-start gap-2 text-xs leading-relaxed text-[#5b6656]">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#166534]" />
                    Usamos seus dados só para contato e validação do cadastro.
                  </p>
                </form>

                <div className="mt-6 rounded-2xl border border-[#dfe5d8] bg-[#f5f7f2] p-4">
                  <p className="text-sm font-semibold">Já é cliente da COOPERE-BR?</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-[#4b5546]">
                    Não precisa se cadastrar. Entre com o mesmo celular do app e receba um código.
                  </p>
                  <Link
                    href="/login"
                    className="mt-2 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-[#166534] hover:underline"
                  >
                    Entrar com código
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </>
            ) : (
              <div className="space-y-5">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#d7ff65]">
                  <Check className="h-7 w-7 text-[#102012]" aria-hidden="true" />
                </span>
                <div>
                  <h2 className="text-[28px] font-semibold leading-tight lg:text-[34px]">
                    Tudo certo{primeiroNome ? `, ${primeiroNome}` : ''}!
                  </h2>
                  <p className="mt-2 text-[15px] leading-relaxed text-[#4b5546]">
                    Enviamos uma mensagem para <strong className="text-[#101510]">{telefone}</strong>. Responda por
                    lá para continuar.
                  </p>
                </div>

                <ol className="space-y-2.5">
                  {proximosPassos.map(({ titulo, texto, icon: Icon }, i) => (
                    <li key={titulo} className="flex gap-3 rounded-2xl border border-[#dfe5d8] p-3.5">
                      <span
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                          i === 0 ? 'bg-[#101510] text-[#d7ff65]' : 'bg-[#f5f7f2] text-[#166534]'
                        }`}
                      >
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <span>
                        <span className="block text-sm font-semibold">{titulo}</span>
                        <span className="block text-[13px] leading-snug text-[#4b5546]">{texto}</span>
                      </span>
                    </li>
                  ))}
                </ol>

                <div className="rounded-2xl bg-[#101510] p-4 text-white">
                  <p className="text-sm font-semibold">Convide quem paga conta de luz</p>
                  <p className="mt-1 text-[13px] text-[#a9b3a4]">Indicações rendem níveis e recompensas no clube.</p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <a
                      href={`https://wa.me/?text=${encodeURIComponent(textoConvite)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-12 items-center justify-center gap-2 rounded-xl bg-[#d7ff65] text-sm font-semibold text-[#102012]"
                    >
                      <Share2 className="h-4 w-4" />
                      WhatsApp
                    </a>
                    <button
                      type="button"
                      onClick={copiarConvite}
                      className="h-12 rounded-xl border border-white/25 text-sm font-semibold hover:bg-white/10"
                    >
                      {copiado ? 'Copiado!' : 'Copiar convite'}
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSucesso(false)}
                  className="min-h-11 text-sm font-semibold text-[#166534] hover:underline"
                >
                  Corrigir meu número
                </button>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

export default function EntrarPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#101510]" />}>
      <EntrarContent />
    </Suspense>
  );
}
