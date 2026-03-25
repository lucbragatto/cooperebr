'use client';

import { useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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
        setErro('Nenhum canal de recuperação encontrado. Entre em contato com o administrador.');
        setCarregando(false);
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
      setErro('Erro ao verificar. Tente novamente.');
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
              {passo === 'identificador' && 'Informe seu CPF, email ou celular'}
              {passo === 'escolha' && 'Escolha como deseja receber o link'}
              {passo === 'enviado' && 'Link enviado!'}
            </CardDescription>
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
                    className="w-full justify-start gap-3 bg-green-600 hover:bg-green-700 text-white h-auto py-3"
                  >
                    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current flex-shrink-0">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
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
                    className="w-full justify-start gap-3 h-auto py-3"
                  >
                    <svg viewBox="0 0 24 24" className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="2" y="4" width="20" height="16" rx="2" />
                      <path d="M22 4L12 13 2 4" />
                    </svg>
                    <span className="text-left">
                      <span className="block font-medium">Enviar por Email</span>
                      <span className="block text-sm text-muted-foreground">Para {canal.email}</span>
                    </span>
                  </Button>
                )}

                {erro && <p className="text-sm text-red-600 mt-2">{erro}</p>}

                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={voltar}
                    className="text-sm text-green-700 hover:underline"
                  >
                    Voltar
                  </button>
                </div>
              </div>
            )}

            {passo === 'enviado' && (
              <div className="space-y-4">
                <p className="text-sm text-green-700">
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
    </div>
  );
}
