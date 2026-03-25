'use client';

import { useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function EsqueciSenhaPage() {
  const [email, setEmail] = useState('');
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    setCarregando(true);
    try {
      await api.post('/auth/esqueci-senha', { email });
      setEnviado(true);
    } catch {
      setErro('Erro ao enviar. Tente novamente.');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md px-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-green-700 tracking-tight">COOPERE-BR</h1>
          <p className="text-gray-500 mt-1 text-sm">Recuperação de Senha</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Esqueci minha senha</CardTitle>
            <CardDescription>
              Informe seu email para receber um link de redefinição
            </CardDescription>
          </CardHeader>
          <CardContent>
            {enviado ? (
              <div className="space-y-4">
                <p className="text-sm text-green-700">
                  Verifique seu email para redefinir sua senha.
                </p>
                <Link href="/login">
                  <Button variant="outline" className="w-full">
                    Voltar ao login
                  </Button>
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                  />
                </div>

                {erro && <p className="text-sm text-red-600">{erro}</p>}

                <Button type="submit" className="w-full" disabled={carregando}>
                  {carregando ? 'Enviando...' : 'Enviar link de redefinição'}
                </Button>

                <div className="text-center">
                  <Link href="/login" className="text-sm text-green-700 hover:underline">
                    Voltar ao login
                  </Link>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
