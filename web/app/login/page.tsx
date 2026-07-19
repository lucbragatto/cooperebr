'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Leaf, LockKeyhole, ShieldCheck, Sparkles, UserPlus } from 'lucide-react';
import { login } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const SITE_PUBLICO_URL =
  process.env.NEXT_PUBLIC_SITE_PUBLICO_URL || 'https://clube.cooperebr.com.br';

// Sprint Portal Empresa 9.0 (04/06/2026) + ajuste Fatia F-G1 (05/06/2026):
// box dev-only com 2 contas pra acelerar testes — SUPER_ADMIN (acesso a
// /dashboard + painel /dev/credenciais-teste pra impersonate) + Empresa
// cooperada (perfil COOPERADO, acesso a /conveniada via contexto).
// Senhas resetadas pelos seeds dev (`reset-senha-superadmin-teste.ts` +
// `seed-portal-empresa-teste.ts`). NÃO persistidas em config — só vivem
// nos seeds executados sob demanda.
// D-novo-PORTAL-EMPRESA-SEED-TESTE (P3): remover este box antes de produção.
type CredTeste = { email: string; senha: string; titulo: string; desc: string };

const CRED_SUPER_ADMIN: CredTeste = {
  email: 'superadmin@cooperebr.com.br',
  senha: 'Teste@123',
  titulo: 'SUPER ADMIN',
  desc: 'Acesso global · /dashboard · painel impersonate (dev/credenciais-teste)',
};
const CRED_ADMIN: CredTeste = {
  email: 'admin@cooperebr.com.br',
  senha: 'Teste@123',
  titulo: 'ADMIN — COOPERE-BR',
  desc: 'Admin da cooperativa · /parceiro (gestão tenant) · também acessa /dashboard',
};
const CRED_COOPERADO: CredTeste = {
  email: 'teste@cooperebr.com',
  senha: 'Teste@123',
  titulo: 'COOPERADO',
  desc: 'Cooperado de teste (Luciano Teste) · /portal',
};
const CRED_EMPRESA: CredTeste = {
  email: 'lucbragatto+empresa-teste@gmail.com',
  senha: 'Teste@123',
  titulo: 'Empresa cooperada',
  desc: 'Cooperado PJ (Clínica Teste) · /conveniada (via contexto)',
};

// isAmbienteReal() do backend = process.env.AMBIENTE_REAL==='true'. No front:
// NEXT_PUBLIC_AMBIENTE_REAL não definido OU 'false' → dev → mostra box.
const isProducao = process.env.NEXT_PUBLIC_AMBIENTE_REAL === 'true';

export default function LoginPage() {
  const router = useRouter();
  const [identificador, setIdentificador] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  function preencherCred(c: CredTeste) {
    setIdentificador(c.email);
    setSenha(c.senha);
  }

  async function handleSubmit(e: React.FormEvent) {
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

  return (
    <div className="min-h-screen bg-[#f6f8f2] text-[#111814]">
      <div className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
        <section className="hidden min-h-screen flex-col justify-between overflow-hidden bg-[#101510] p-10 text-white lg:flex">
          <div className="relative z-10">
            <Link
              href={SITE_PUBLICO_URL}
              className="inline-flex items-center gap-2 text-sm font-medium text-white/68 transition hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar ao Clube
            </Link>
          </div>

          <div className="relative z-10 max-w-2xl">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/18 bg-white/8 px-4 py-2 text-sm text-white/76 backdrop-blur">
              <Sparkles className="h-4 w-4 text-[#d7ff65]" />
              Clube COOPERE-BR
            </p>
            <h1 className="text-5xl font-semibold leading-tight tracking-normal">
              Acesse sua area do Clube COOPERE-BR.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-8 text-white/66">
              Consulte sua jornada, acompanhe beneficios, Cooper Tokens, indicacoes e as
              informacoes da sua participacao no ecossistema de energia solar.
            </p>
          </div>

          <div className="relative z-10 grid grid-cols-3 gap-3 border-t border-white/14 pt-6 text-sm text-white/68">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-[#d7ff65]" />
              Acesso seguro
            </div>
            <div className="flex items-center gap-2">
              <Leaf className="h-4 w-4 text-[#d7ff65]" />
              Energia limpa
            </div>
            <div className="flex items-center gap-2">
              <LockKeyhole className="h-4 w-4 text-[#d7ff65]" />
              Dados protegidos
            </div>
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
                <div className="mx-auto flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border border-[#dfe5d8] bg-white shadow-sm">
                  <Image
                    src="/brand/logo-cooperebr.jpg"
                    alt="Logo COOPERE-BR"
                    width={112}
                    height={112}
                    priority
                    className="h-full w-full object-cover"
                  />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#64715b]">
                    Clube COOPERE-BR
                  </p>
                  <CardTitle className="mt-2 text-2xl text-[#101510]">
                    Entrar na area do cliente
                  </CardTitle>
                  <CardDescription className="mt-2 text-[#667062]">
                    Use seu email, CPF ou telefone para acessar o sistema do Clube.
                  </CardDescription>
                </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="identificador">Email / CPF / Telefone</Label>
                <Input
                  id="identificador"
                  type="text"
                  placeholder="email, CPF ou telefone"
                  value={identificador}
                  onChange={(e) => setIdentificador(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="senha">Senha</Label>
                <Input
                  id="senha"
                  type="password"
                  placeholder="••••••••"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  required
                />
              </div>

              {erro && (
                <p className="text-sm text-red-600">{erro}</p>
              )}

              <Button type="submit" className="w-full" disabled={carregando}>
                {carregando ? 'Entrando...' : 'Acessar Clube COOPERE-BR'}
              </Button>

              <div className="rounded-xl border border-[#dfe5d8] bg-[#f6f8f2] p-3 text-center">
                <p className="text-sm font-medium text-[#101510]">Ainda nao faz parte do clube?</p>
                <Link
                  href="/entrar"
                  className="mt-2 inline-flex items-center justify-center gap-2 text-sm font-semibold text-[#166534] hover:underline"
                >
                  <UserPlus className="h-4 w-4" />
                  Fazer cadastro
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              <div className="text-center">
                <Link href="/esqueci-senha" className="text-sm text-green-700 hover:underline">
                  Esqueci minha senha
                </Link>
              </div>
            </form>

            {/* Box dev-only de credenciais de teste — Sprint Portal Empresa 9.0
                + ajuste Fatia F-G1 (05/06): 2 contas (SUPER_ADMIN + Empresa).
                Use SUPER_ADMIN pra acessar /dashboard/dev/credenciais-teste e
                impersonar QUALQUER outro perfil (admin/cooperado/proprietário)
                sem digitar senha.
                D-novo-PORTAL-EMPRESA-SEED-TESTE (P3): remover antes de produção. */}
            {!isProducao && (
              <div className="mt-6 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-amber-900">
                    🔑 Credenciais de teste (DEV)
                  </p>
                  <span className="text-[10px] uppercase tracking-wide text-amber-700 font-bold">
                    4 contas
                  </span>
                </div>

                {[CRED_SUPER_ADMIN, CRED_ADMIN, CRED_COOPERADO, CRED_EMPRESA].map((c) => (
                  <div key={c.email} className="border border-amber-200 rounded-md bg-white p-2.5 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-amber-900 text-[11px]">{c.titulo}</p>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => preencherCred(c)}
                        className="border-amber-400 text-amber-900 hover:bg-amber-100 h-6 text-[10px] px-2"
                      >
                        Preencher
                      </Button>
                    </div>
                    <p className="text-[10px] text-amber-700 opacity-80 leading-snug">{c.desc}</p>
                    <div className="text-amber-800 space-y-0.5 font-mono text-[10px]">
                      <div>
                        <span className="opacity-70">login:</span>{' '}
                        <span className="select-all">{c.email}</span>
                      </div>
                      <div>
                        <span className="opacity-70">senha:</span>{' '}
                        <span className="select-all">{c.senha}</span>
                      </div>
                    </div>
                  </div>
                ))}

                <p className="text-[10px] text-amber-700 opacity-80 leading-snug">
                  💡 Logue como <strong>SUPER ADMIN</strong> e vá em <code>/dashboard/dev/credenciais-teste</code> pra impersonar admin/cooperado/proprietário sem precisar de senha de cada um.
                </p>
                <p className="text-[10px] text-amber-700 opacity-80">
                  Este box NÃO aparece em produção (NEXT_PUBLIC_AMBIENTE_REAL=true).
                </p>
              </div>
            )}
          </CardContent>
        </Card>

            <p className="mt-6 text-center text-xs leading-5 text-[#7b8576]">
              Voce esta acessando o ambiente do Clube COOPERE-BR. Para conhecer o clube,
              beneficios e assinatura, volte para o site principal.
            </p>
      </div>
        </section>
      </div>
    </div>
  );
}
