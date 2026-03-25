'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Sun, MessageCircle, Check, Loader2, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

function formatarTelefone(valor: string): string {
  const nums = valor.replace(/\D/g, '').slice(0, 11);
  if (nums.length <= 2) return nums;
  if (nums.length <= 7) return `(${nums.slice(0, 2)}) ${nums.slice(2)}`;
  return `(${nums.slice(0, 2)}) ${nums.slice(2, 7)}-${nums.slice(7)}`;
}

export default function EntrarPage() {
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
    if (!nome.trim() || telLimpo.length < 10) {
      setErro('Preencha nome e telefone válido.');
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
      'Conheça a CoopereBR! Energia solar sem investimento, 100% digital. Economize até 20% na conta de luz 👉 ' +
        window.location.origin +
        '/entrar',
    );
    window.open(`https://wa.me/?text=${texto}`, '_blank');
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex flex-col">
      {/* Header */}
      <header className="py-6 px-4 text-center">
        <div className="flex items-center justify-center gap-2">
          <Sun className="h-8 w-8 text-green-600" />
          <h1 className="text-2xl font-bold text-green-700">CoopereBR</h1>
        </div>
        <p className="text-sm text-gray-500 mt-1">Energia solar sem investimento</p>
      </header>

      {/* Card central */}
      <main className="flex-1 flex items-start justify-center px-4 pb-12">
        <div className="w-full max-w-md bg-white rounded-xl shadow-lg border p-8">
          {!sucesso ? (
            <>
              {nomeIndicador && (
                <div className="mb-6 text-center bg-green-50 rounded-lg p-4 border border-green-200">
                  <p className="text-green-800 font-medium">
                    Você foi convidado por {nomeIndicador}! 🎉
                  </p>
                </div>
              )}

              <h2 className="text-xl font-bold text-gray-800 text-center mb-2">
                Economize na conta de luz!
              </h2>
              <p className="text-sm text-gray-500 text-center mb-6">
                Descubra quanto você pode economizar com energia solar. Sem investimento, sem obra.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="nome">Nome completo</Label>
                  <Input
                    id="nome"
                    placeholder="Seu nome"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="telefone">Telefone (WhatsApp)</Label>
                  <Input
                    id="telefone"
                    placeholder="(11) 99999-9999"
                    value={telefone}
                    onChange={(e) => setTelefone(formatarTelefone(e.target.value))}
                    required
                  />
                </div>

                {erro && (
                  <p className="text-sm text-red-600 text-center">{erro}</p>
                )}

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-green-600 hover:bg-green-700 text-white h-12 text-base font-semibold"
                >
                  {loading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    'Quero economizar!'
                  )}
                </Button>
              </form>

              <p className="text-xs text-gray-400 text-center mt-4">
                Ao continuar, enviaremos uma mensagem pelo WhatsApp para iniciar sua simulação gratuita.
              </p>
            </>
          ) : (
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <Check className="h-8 w-8 text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-800">Perfeito!</h2>
              <p className="text-gray-600">
                Enviamos uma mensagem no seu WhatsApp. Siga as instruções para fazer sua simulação
                gratuita!
              </p>
              <div className="flex items-center justify-center gap-2 text-green-600">
                <MessageCircle className="h-10 w-10" />
              </div>

              <div className="pt-4 border-t">
                <p className="text-sm text-gray-500 mb-3">
                  Quer indicar amigos e ganhar benefícios?
                </p>
                <Button
                  variant="outline"
                  onClick={compartilhar}
                  className="gap-2 text-green-700 border-green-300 hover:bg-green-50"
                >
                  <Share2 className="h-4 w-4" />
                  Compartilhar com amigos
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-xs text-gray-400 border-t">
        CoopereBR — Cooperativa de Energia Solar
      </footer>
    </div>
  );
}
