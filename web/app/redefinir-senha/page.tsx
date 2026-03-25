'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function RedefinirSenhaPage() {
  const searchParams = useSearchParams();
  const [accessToken, setAccessToken] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [sucesso, setSucesso] = useState(false);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    // Supabase pode enviar como query param ou fragment
    const token = searchParams.get('access_token') || '';
    if (token) setAccessToken(token);

    // Tentar extrair do hash/fragment também
    if (!token && typeof window !== 'undefined') {
      const hash = window.location.hash;
      const match = hash.match(/access_token=([^&]+)/);
      if (match) setAccessToken(match[1]);
    }
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro('');

    if (novaSenha.length < 8) {
      setErro('A senha deve ter pelo menos 8 caracteres.');
      return;
    }
    if (novaSenha !== confirmarSenha) {
      setErro('As senhas não coincidem.');
      return;
    }
    if (!accessToken) {
      setErro('Token de redefinição não encontrado. Solicite um novo link.');
      return;
    }

    setCarregando(true);
    try {
      await api.post('/auth/redefinir-senha', { access_token: accessToken, novaSenha });
      setSucesso(true);
    } catch {
      setErro('Erro ao redefinir senha. O link pode ter expirado.');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md px-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-green-700 tracking-tight">COOPERE-BR</h1>
          <p className="text-gray-500 mt-1 text-sm">Redefinição de Senha</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Nova senha</CardTitle>
            <CardDescription>Defina sua nova senha de acesso</CardDescription>
          </CardHeader>
          <CardContent>
            {sucesso ? (
              <div className="space-y-4">
                <p className="text-sm text-green-700">
                  Senha redefinida com sucesso! Faça login com sua nova senha.
                </p>
                <Link href="/login">
                  <Button className="w-full">Ir para o login</Button>
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1">
                  <Label htmlFor="novaSenha">Nova senha</Label>
                  <Input
                    id="novaSenha"
                    type="password"
                    placeholder="Mínimo 8 caracteres"
                    value={novaSenha}
                    onChange={(e) => setNovaSenha(e.target.value)}
                    required
                    autoFocus
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="confirmarSenha">Confirmar nova senha</Label>
                  <Input
                    id="confirmarSenha"
                    type="password"
                    placeholder="Repita a nova senha"
                    value={confirmarSenha}
                    onChange={(e) => setConfirmarSenha(e.target.value)}
                    required
                  />
                </div>

                {erro && <p className="text-sm text-red-600">{erro}</p>}

                <Button type="submit" className="w-full" disabled={carregando}>
                  {carregando ? 'Redefinindo...' : 'Redefinir senha'}
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
