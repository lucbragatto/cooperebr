'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { login } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function LoginPage() {
  const router = useRouter();
  const [identificador, setIdentificador] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    setCarregando(true);
    try {
      await login(identificador, senha);
      router.push('/dashboard');
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
          <h1 className="text-3xl font-bold text-green-700 tracking-tight">COOPERE-BR</h1>
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
