'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { login } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md px-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-green-700 tracking-tight">SISGD</h1>
          <p className="text-gray-500 mt-1 text-sm">Painel Administrativo</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Entrar</CardTitle>
            <CardDescription>Use seu email, CPF ou telefone</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="identificador">Email / CPF / Telefone</Label>
                <Input
                  id="identificador"
                  type="text"
                  placeholder="exemplo@email.com"
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
                {carregando ? 'Entrando...' : 'Entrar'}
              </Button>

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
                    2 contas
                  </span>
                </div>

                {[CRED_SUPER_ADMIN, CRED_EMPRESA].map((c) => (
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
      </div>
    </div>
  );
}
