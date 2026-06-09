'use client';

/**
 * F1 (09/06/2026) — Cadastro inicial do PIN pelo portal logado.
 *
 * JWT prova identidade (sem OTP nesta camada — decisao Luciano).
 * Renderiza form somente se temPin=false; caso ja tenha, mostra CTA pra
 * rota futura /portal/seguranca/alterar-pin.
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Info, ShieldCheck, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { isPinFraco } from '@/lib/pin-fraco';

type Estado = 'CARREGANDO' | 'JA_TEM_PIN' | 'PRECISA_DEFINIR' | 'ERRO';

export default function DefinirPinPage() {
  const router = useRouter();
  const [estado, setEstado] = useState<Estado>('CARREGANDO');
  const [pin, setPin] = useState('');
  const [pinConfirmacao, setPinConfirmacao] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  useEffect(() => {
    let cancelado = false;
    api
      .get<{ temPin: boolean }>('/meu-perfil/pin-status')
      .then((r) => {
        if (cancelado) return;
        setEstado(r.data.temPin ? 'JA_TEM_PIN' : 'PRECISA_DEFINIR');
      })
      .catch(() => {
        if (!cancelado) setEstado('ERRO');
      });
    return () => {
      cancelado = true;
    };
  }, []);

  function validarLocal(): string | null {
    if (!/^\d{6}$/.test(pin)) return 'PIN deve ter exatamente 6 dígitos numéricos.';
    if (pin !== pinConfirmacao) return 'PIN e confirmação não conferem.';
    if (isPinFraco(pin))
      return 'PIN fraco. Evite 6 dígitos iguais ou sequências (123456, 987654).';
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    const erroLocal = validarLocal();
    if (erroLocal) {
      setErro(erroLocal);
      return;
    }
    setSalvando(true);
    try {
      await api.post('/meu-perfil/definir-pin', { pin, pinConfirmacao });
      setSucesso(true);
      setPin('');
      setPinConfirmacao('');
      setEstado('JA_TEM_PIN');
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        'Não consegui salvar agora. Tente novamente em alguns minutos.';
      setErro(Array.isArray(msg) ? msg.join(' ') : msg);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="container mx-auto max-w-xl py-8 px-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-green-600" />
            <CardTitle>Definir PIN</CardTitle>
          </div>
          <CardDescription>
            Crie um código de 6 dígitos para autorizar operações de CooperToken pelo WhatsApp.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Help inline obrigatório (regra UX) */}
          <div className="flex gap-3 p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-900">
            <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">O que é o PIN?</p>
              <p className="mt-1 text-blue-800">
                Um código pessoal de 6 dígitos que você digita pelo bot do WhatsApp para
                liberar pagamentos com CooperToken e alterar o seu limite. Por enquanto, o
                PIN é exigido só nessas operações — o portal continua acessível com seu login.
              </p>
              <p className="mt-2 text-blue-800">
                Use um código que <strong>só você sabe</strong>. Não use sequências (123456,
                987654) nem dígitos repetidos (111111).
              </p>
            </div>
          </div>

          {estado === 'CARREGANDO' && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              Verificando status do seu PIN...
            </div>
          )}

          {estado === 'ERRO' && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 p-3 rounded">
              Não consegui carregar o status do seu PIN. Recarregue a página em alguns
              segundos.
            </div>
          )}

          {estado === 'JA_TEM_PIN' && (
            <div className="space-y-3">
              {sucesso && (
                <div className="text-sm text-green-800 bg-green-50 border border-green-200 p-3 rounded">
                  PIN cadastrado com sucesso! Já pode usar o bot do WhatsApp para alterar
                  limite ou pagar com CooperToken.
                </div>
              )}
              <div className="text-sm text-gray-700 bg-gray-50 border border-gray-200 p-3 rounded">
                Você já tem um PIN cadastrado. Para trocar, use a tela de alterar PIN.
              </div>
              <Button
                variant="outline"
                onClick={() => router.push('/portal/seguranca/alterar-pin')}
              >
                Alterar PIN
              </Button>
            </div>
          )}

          {estado === 'PRECISA_DEFINIR' && (
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="pin">Novo PIN (6 dígitos)</Label>
                <Input
                  id="pin"
                  type="password"
                  inputMode="numeric"
                  autoComplete="new-password"
                  maxLength={6}
                  pattern="\d{6}"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••••"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="pinConfirmacao">Repita o PIN</Label>
                <Input
                  id="pinConfirmacao"
                  type="password"
                  inputMode="numeric"
                  autoComplete="new-password"
                  maxLength={6}
                  pattern="\d{6}"
                  value={pinConfirmacao}
                  onChange={(e) =>
                    setPinConfirmacao(e.target.value.replace(/\D/g, ''))
                  }
                  placeholder="••••••"
                  required
                />
              </div>

              {erro && (
                <div className="text-sm text-red-700 bg-red-50 border border-red-200 p-3 rounded">
                  {erro}
                </div>
              )}

              <Button type="submit" disabled={salvando} className="w-full">
                {salvando ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Salvando...
                  </>
                ) : (
                  'Definir PIN'
                )}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
