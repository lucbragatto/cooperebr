'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { login, getUsuario } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function PortalLoginPage() {
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
      router.push('/selecionar-contexto');
    } catch {
      setErro('CPF, email ou senha incorretos.');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-green-50 to-white px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-green-700 tracking-tight">COOPERE-BR</h1>
          <p className="text-gray-500 mt-1 text-sm">Meu Painel</p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="identificador" className="text-sm font-medium">
                CPF, email ou celular
              </Label>
              <Input
                id="identificador"
                type="text"
                inputMode="text"
                placeholder="000.000.000-00"
                value={identificador}
                onChange={(e) => setIdentificador(e.target.value)}
                required
                autoFocus
                className="h-12 text-base"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="senha" className="text-sm font-medium">
                Senha
              </Label>
              <Input
                id="senha"
                type="password"
                placeholder="••••••••"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required
                className="h-12 text-base"
              />
            </div>

            {erro && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{erro}</p>
            )}

            <Button type="submit" className="w-full h-12 text-base font-semibold" disabled={carregando}>
              {carregando ? 'Entrando...' : 'Entrar'}
            </Button>

            <div className="text-center">
              <Link href="/esqueci-senha" className="text-sm text-green-700 hover:underline">
                Esqueci minha senha
              </Link>
            </div>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6 px-4">
          Primeiro acesso? Entre em contato com seu parceiro.
        </p>
      </div>
    </div>
  );
}
