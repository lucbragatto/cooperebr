'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Mail, MessageCircle, ShieldCheck, UserPlus } from 'lucide-react';
import api from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const SITE_PUBLICO_URL =
  process.env.NEXT_PUBLIC_SITE_PUBLICO_URL || 'https://clube.cooperebr.com.br';

type Canal = { temWhatsapp: boolean; temEmail: boolean; telefone?: string; email?: string };
type Passo = 'identificador' | 'escolha' | 'enviado';

export default function EsqueciSenhaPage() {
  const [identificador, setIdentificador] = useState('');
  const [canal, setCanal] = useState<Canal | null>(null);
  const [passo, setPasso] = useState<Passo>('identificador');
  const [canalEscolhido, setCanalEscolhido] = useState<'whatsapp' | 'email' | null>(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  async function handleVerificar(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    setCarregando(true);
    try {
      const { data } = await api.post<Canal>('/auth/verificar-canal', { identificador });
      setCanal(data);

      if (!data.temWhatsapp && !data.temEmail) {
        setErro('Nenhum canal de recuperacao encontrado. Se voce ainda nao tem cadastro, comece pelo cadastro do clube.');
        return;
      }

      if (data.temWhatsapp && data.temEmail) {
        setPasso('escolha');
      } else if (data.temWhatsapp) {
        await enviarWhatsapp();
      } else {
        await enviarEmail();
      }
    } catch {
      setErro('Nao encontramos esse acesso. Verifique os dados ou faca seu cadastro no clube.');
    } finally {
      setCarregando(false);
    }
  }

  async function enviarWhatsapp() {
    setCarregando(true);
    setErro('');
    try {
      await api.post('/auth/esqueci-senha-whatsapp', { identificador });
      setCanalEscolhido('whatsapp');
      setPasso('enviado');
    } catch {
      setErro('Erro ao enviar via WhatsApp. Tente novamente.');
    } finally {
      setCarregando(false);
    }
  }

  async function enviarEmail() {
    setCarregando(true);
    setErro('');
    try {
      await api.post('/auth/esqueci-senha', { identificador });
      setCanalEscolhido('email');
      setPasso('enviado');
    } catch {
      setErro('Erro ao enviar por email. Tente novamente.');
    } finally {
      setCarregando(false);
    }
  }

  function voltar() {
    setPasso('identificador');
    setCanal(null);
    setErro('');
    setCanalEscolhido(null);
  }

  return (
    <div className="min-h-screen bg-[#f6f8f2] text-[#111814]">
      <div className="grid min-h-screen lg:grid-cols-[0.95fr_1.05fr]">
        <section className="hidden min-h-screen flex-col justify-between overflow-hidden bg-[#101510] p-10 text-white lg:flex">
          <Link
            href={SITE_PUBLICO_URL}
            className="relative z-10 inline-flex items-center gap-2 text-sm font-medium text-white/68 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao Clube
          </Link>

          <div className="relative z-10 max-w-xl">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/18 bg-white/8 px-4 py-2 text-sm text-white/76 backdrop-blur">
              <ShieldCheck className="h-4 w-4 text-[#d7ff65]" />
              Recuperacao segura
            </p>
            <h1 className="text-5xl font-semibold leading-tight tracking-normal">
              Recupere seu acesso ao Clube COOPERE-BR.
            </h1>
            <p className="mt-5 text-lg leading-8 text-white/66">
              Enviaremos um link para o canal cadastrado no seu perfil. Se voce ainda nao faz
              parte do clube, comece pelo cadastro.
            </p>
          </div>

          <div className="relative z-10 border-t border-white/14 pt-6 text-sm text-white/68">
            Seus dados sao usados apenas para localizar seu cadastro e proteger sua conta.
          </div>

          <div
            className="absolute inset-0 opacity-55"
            style={{
              backgroundImage:
                "linear-gradient(120deg, rgba(16,21,16,0.98) 0%, rgba(16,21,16,0.84) 45%, rgba(16,21,16,0.38) 100%), url('https://images.unsplash.com/photo-1508514177221-188b1cf16e9d?auto=format&fit=crop&w=1800&q=85')",
              backgroundPosition: 'center',
              backgroundSize: 'cover',
            }}
          />
        </section>

        <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-8">
          <div className="w-full max-w-md">
            <div className="mb-7 flex justify-center lg:hidden">
              <Link href={SITE_PUBLICO_URL} className="text-sm font-medium text-[#166534]">
                Voltar ao Clube COOPERE-BR
              </Link>
            </div>

            <Card className="border-[#dfe5d8] bg-white/92 shadow-xl shadow-[#101510]/5 backdrop-blur">
              <CardHeader className="space-y-5 text-center">
                <div className="mx-auto flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border border-[#dfe5d8] bg-white shadow-sm">
                  <Image
                    src="/brand/logo-cooperebr.jpg"
                    alt="Logo COOPERE-BR"
                    width={96}
                    height={96}
                    priority
                    className="h-full w-full object-cover"
                  />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#64715b]">
                    Clube COOPERE-BR
                  </p>
                  <CardTitle className="mt-2 text-2xl text-[#101510]">
                    Esqueci minha senha
                  </CardTitle>
                  <CardDescription className="mt-2 text-[#667062]">
                    {passo === 'identificador' && 'Informe seu CPF, email ou celular cadastrado.'}
                    {passo === 'escolha' && 'Escolha como deseja receber o link.'}
                    {passo === 'enviado' && 'Link enviado com seguranca.'}
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                {passo === 'identificador' && (
                  <form onSubmit={handleVerificar} className="space-y-4">
                    <div className="space-y-1">
                      <Label htmlFor="identificador">CPF, email ou celular</Label>
                      <Input
                        id="identificador"
                        type="text"
                        placeholder="Digite seu CPF, email ou celular"
                        value={identificador}
                        onChange={(e) => setIdentificador(e.target.value)}
                        required
                        autoFocus
                      />
                    </div>

                    {erro && <p className="text-sm text-red-600">{erro}</p>}

                    <Button type="submit" className="w-full" disabled={carregando}>
                      {carregando ? 'Verificando...' : 'Continuar'}
                    </Button>

                    <div className="rounded-xl border border-[#dfe5d8] bg-[#f6f8f2] p-3 text-center">
                      <p className="text-sm font-medium text-[#101510]">Nao tem cadastro ainda?</p>
                      <Link
                        href="/entrar"
                        className="mt-2 inline-flex items-center justify-center gap-2 text-sm font-semibold text-[#166534] hover:underline"
                      >
                        <UserPlus className="h-4 w-4" />
                        Comecar cadastro
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </div>

                    <div className="text-center">
                      <Link href="/login" className="text-sm text-green-700 hover:underline">
                        Voltar ao login
                      </Link>
                    </div>
                  </form>
                )}

                {passo === 'escolha' && canal && (
                  <div className="space-y-3">
                    {canal.temWhatsapp && (
                      <Button
                        onClick={enviarWhatsapp}
                        disabled={carregando}
                        className="h-auto w-full justify-start gap-3 bg-green-600 py-3 text-white hover:bg-green-700"
                      >
                        <MessageCircle className="h-5 w-5 shrink-0" />
                        <span className="text-left">
                          <span className="block font-medium">Enviar pelo WhatsApp</span>
                          <span className="block text-sm opacity-90">Para {canal.telefone}</span>
                        </span>
                      </Button>
                    )}

                    {canal.temEmail && (
                      <Button
                        onClick={enviarEmail}
                        disabled={carregando}
                        variant="outline"
                        className="h-auto w-full justify-start gap-3 py-3"
                      >
                        <Mail className="h-5 w-5 shrink-0" />
                        <span className="text-left">
                          <span className="block font-medium">Enviar por email</span>
                          <span className="block text-sm text-muted-foreground">Para {canal.email}</span>
                        </span>
                      </Button>
                    )}

                    {erro && <p className="mt-2 text-sm text-red-600">{erro}</p>}

                    <div className="text-center pt-2">
                      <button type="button" onClick={voltar} className="text-sm text-green-700 hover:underline">
                        Voltar
                      </button>
                    </div>
                  </div>
                )}

                {passo === 'enviado' && (
                  <div className="space-y-4">
                    <p className="rounded-xl bg-[#eef8df] p-4 text-sm leading-6 text-green-800">
                      {canalEscolhido === 'whatsapp'
                        ? 'Verifique seu WhatsApp para redefinir sua senha.'
                        : 'Verifique seu email para redefinir sua senha.'}
                    </p>
                    <Link href="/login">
                      <Button variant="outline" className="w-full">
                        Voltar ao login
                      </Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </div>
  );
}
