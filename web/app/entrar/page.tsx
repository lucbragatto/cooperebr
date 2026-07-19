'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  BadgeCheck,
  Check,
  Leaf,
  Loader2,
  MessageCircle,
  Share2,
  ShieldCheck,
  Sparkles,
  Sun,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatarTelefone } from '@/lib/formatar-telefone';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
const SITE_PUBLICO_URL =
  process.env.NEXT_PUBLIC_SITE_PUBLICO_URL || 'https://clube.cooperebr.com.br';

function EntrarContent() {
  const searchParams = useSearchParams();
  const codigoRef = searchParams.get('ref') ?? '';

  const [nomeIndicador, setNomeIndicador] = useState('');
  const [nome, setNome] = useState(searchParams.get('nome') ?? '');
  const [telefone, setTelefone] = useState(searchParams.get('tel') ?? '');
  const [loading, setLoading] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const [erro, setErro] = useState('');

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
    if (!nome.trim()) {
      setErro('Preencha seu nome.');
      return;
    }
    if (telLimpo.length !== 11) {
      setErro('Telefone deve ter 11 digitos com DDD. Ex: (11) 99999-9999');
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
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Erro ao enviar');
      setSucesso(true);
    } catch (err: any) {
      setErro(err.message || 'Erro ao enviar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  function compartilhar() {
    const texto = encodeURIComponent(
      `Conheca o Clube COOPERE-BR! Energia solar sem investimento, beneficios e uma jornada digital: ${window.location.origin}/entrar`,
    );
    window.open(`https://wa.me/?text=${texto}`, '_blank');
  }

  return (
    <div className="min-h-screen bg-[#f6f8f2] text-[#111814]">
      <section className="relative overflow-hidden bg-[#101510] text-white">
        <div
          className="absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              "linear-gradient(115deg, rgba(16,21,16,0.98) 0%, rgba(16,21,16,0.82) 48%, rgba(16,21,16,0.32) 100%), url('https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&w=2200&q=85')",
            backgroundPosition: 'center',
            backgroundSize: 'cover',
          }}
        />

        <header className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
          <Link href={SITE_PUBLICO_URL} className="flex items-center gap-3" aria-label="Clube COOPERE-BR">
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-white/18 bg-white">
              <Image
                src="/brand/logo-cooperebr.jpg"
                alt="Logo COOPERE-BR"
                width={48}
                height={48}
                priority
                className="h-full w-full object-cover"
              />
            </div>
            <span>
              <span className="block text-sm font-semibold uppercase tracking-[0.18em] text-white/62">
                COOPERE-BR
              </span>
              <span className="block text-base font-semibold">Clube Solar</span>
            </span>
          </Link>

          <Link
            href="/login"
            className="inline-flex h-10 items-center justify-center rounded-full border border-white/28 px-5 text-sm font-medium text-white transition hover:bg-white hover:text-[#111814]"
          >
            Ja tenho conta
          </Link>
        </header>

        <div className="relative z-10 mx-auto grid min-h-[calc(100vh-88px)] w-full max-w-7xl grid-cols-1 items-center gap-10 px-5 pb-14 pt-8 sm:px-8 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="max-w-3xl">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/18 bg-white/8 px-4 py-2 text-sm text-white/76 backdrop-blur">
              <Sparkles className="h-4 w-4 text-[#d7ff65]" />
              Cadastro Clube COOPERE-BR
            </p>
            <h1 className="text-5xl font-semibold leading-[1.03] tracking-normal sm:text-6xl">
              Comece sua jornada de economia solar e beneficios.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-white/72">
              Informe seus dados para iniciar pelo WhatsApp. Nossa equipe confirma seu perfil,
              explica o plano disponivel e orienta os proximos passos.
            </p>

            <div className="mt-8 grid max-w-2xl gap-3 sm:grid-cols-3">
              {[
                { icon: Sun, text: 'Sem obra no imovel' },
                { icon: BadgeCheck, text: 'Clube de beneficios' },
                { icon: Leaf, text: 'Energia limpa' },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.text} className="rounded-2xl border border-white/14 bg-white/8 p-4 backdrop-blur">
                    <Icon className="h-5 w-5 text-[#d7ff65]" />
                    <p className="mt-3 text-sm font-medium text-white/82">{item.text}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mx-auto w-full max-w-md lg:ml-auto">
            <div className="rounded-[1.6rem] border border-white/18 bg-white/12 p-3 shadow-2xl backdrop-blur-xl">
              <div className="rounded-[1.2rem] bg-white p-6 text-[#111814] shadow-xl">
                {!sucesso ? (
                  <>
                    <div className="mb-6 text-center">
                      <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-[#dfe5d8] bg-white shadow-sm">
                        <Image
                          src="/brand/logo-cooperebr.jpg"
                          alt="Logo COOPERE-BR"
                          width={80}
                          height={80}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#64715b]">
                        Novo cadastro
                      </p>
                      <h2 className="mt-2 text-2xl font-semibold">Entrar para o Clube</h2>
                      <p className="mt-2 text-sm leading-6 text-[#667062]">
                        Energia solar sem investimento inicial, com acompanhamento pelo portal.
                      </p>
                    </div>

                    {nomeIndicador && (
                      <div className="mb-5 rounded-xl border border-green-200 bg-green-50 p-4 text-center">
                        <p className="text-sm font-medium text-green-800">
                          Voce foi convidado por {nomeIndicador}.
                        </p>
                      </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="space-y-1">
                        <Label htmlFor="nome">Nome completo</Label>
                        <Input
                          id="nome"
                          placeholder="Seu nome"
                          value={nome}
                          onChange={(e) => setNome(e.target.value)}
                          required
                        />
                      </div>

                      <div className="space-y-1">
                        <Label htmlFor="telefone">Telefone com WhatsApp</Label>
                        <Input
                          id="telefone"
                          placeholder="(11) 99999-9999"
                          value={telefone}
                          onChange={(e) => setTelefone(formatarTelefone(e.target.value))}
                          required
                        />
                      </div>

                      {erro && <p className="text-sm text-red-600">{erro}</p>}

                      <Button type="submit" disabled={loading} className="h-12 w-full gap-2">
                        {loading ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <>
                            Iniciar pelo WhatsApp
                            <ArrowRight className="h-4 w-4" />
                          </>
                        )}
                      </Button>
                    </form>

                    <p className="mt-4 text-center text-xs leading-5 text-[#7b8576]">
                      Ao continuar, enviaremos uma mensagem pelo WhatsApp para iniciar sua
                      simulacao e cadastro.
                    </p>

                    <div className="mt-5 rounded-xl border border-[#dfe5d8] bg-[#f6f8f2] p-3 text-center">
                      <p className="text-sm font-medium">Ja tem senha de acesso?</p>
                      <Link
                        href="/login"
                        className="mt-2 inline-flex items-center justify-center gap-2 text-sm font-semibold text-[#166534] hover:underline"
                      >
                        Acessar minha conta
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </>
                ) : (
                  <div className="space-y-5 text-center">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                      <Check className="h-8 w-8 text-green-600" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-semibold">Perfeito.</h2>
                      <p className="mt-2 text-sm leading-6 text-[#667062]">
                        Enviamos uma mensagem no seu WhatsApp. Siga as instrucoes para iniciar sua
                        simulacao gratuita.
                      </p>
                    </div>

                    <div className="flex items-center justify-center gap-2 text-green-600">
                      <MessageCircle className="h-10 w-10" />
                    </div>

                    <div className="border-t pt-4">
                      <p className="mb-3 text-sm text-[#667062]">
                        Quer indicar amigos e ganhar beneficios?
                      </p>
                      <Button
                        variant="outline"
                        onClick={compartilhar}
                        className="gap-2 border-green-300 text-green-700 hover:bg-green-50"
                      >
                        <Share2 className="h-4 w-4" />
                        Compartilhar com amigos
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <p className="mt-5 flex items-center justify-center gap-2 text-center text-xs text-white/62 lg:text-white/70">
              <ShieldCheck className="h-4 w-4" />
              Seus dados sao usados para contato e validacao do cadastro.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function EntrarPage() {
  return (
    <Suspense fallback={<div>Carregando...</div>}>
      <EntrarContent />
    </Suspense>
  );
}
