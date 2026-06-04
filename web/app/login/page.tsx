'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { login } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// Sprint Portal Empresa 9.0 (04/06/2026) — credenciais de teste dev-only.
// Geradas pelo seed `backend/scripts/seed-portal-empresa-teste.ts`.
// D-novo-PORTAL-EMPRESA-SEED-TESTE (P3): remover antes de produção.
const CRED_TESTE_EMPRESA = {
  email: 'lucbragatto+empresa-teste@gmail.com',
  senha: 'Teste@123',
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

  function preencherCredenciaisTeste() {
    setIdentificador(CRED_TESTE_EMPRESA.email);
    setSenha(CRED_TESTE_EMPRESA.senha);
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

            {/* Sprint Portal Empresa 9.0 — box dev-only de credenciais de teste.
                D-novo-PORTAL-EMPRESA-SEED-TESTE (P3): remover antes de produção. */}
            {!isProducao && (
              <div className="mt-6 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-amber-900">
                    🔑 Credenciais de teste (DEV)
                  </p>
                  <span className="text-[10px] uppercase tracking-wide text-amber-700 font-bold">
                    Portal Empresa
                  </span>
                </div>
                <div className="text-amber-800 space-y-0.5 font-mono text-[11px]">
                  <div>
                    <span className="opacity-70">login:</span>{' '}
                    <span className="select-all">{CRED_TESTE_EMPRESA.email}</span>
                  </div>
                  <div>
                    <span className="opacity-70">senha:</span>{' '}
                    <span className="select-all">{CRED_TESTE_EMPRESA.senha}</span>
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={preencherCredenciaisTeste}
                  className="w-full border-amber-400 text-amber-900 hover:bg-amber-100 h-8 text-xs"
                >
                  Preencher (dev only)
                </Button>
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
