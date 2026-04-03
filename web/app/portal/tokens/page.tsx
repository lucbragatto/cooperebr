'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { QRCodeSVG } from 'qrcode.react';
import { Coins, QrCode, Timer } from 'lucide-react';

export default function PortalTokensPage() {
  const [saldo, setSaldo] = useState<number>(0);
  const [carregando, setCarregando] = useState(true);
  const [quantidade, setQuantidade] = useState('');
  const [gerando, setGerando] = useState(false);
  const [qrToken, setQrToken] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [erro, setErro] = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    api.get('/cooper-token/saldo')
      .then(r => setSaldo(Number(r.data.saldoDisponivel)))
      .finally(() => setCarregando(false));
  }, []);

  const limparTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return limparTimer;
  }, [limparTimer]);

  useEffect(() => {
    if (countdown <= 0 && qrToken) {
      setQrToken('');
      limparTimer();
    }
  }, [countdown, qrToken, limparTimer]);

  async function handleGerar(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    setQrToken('');
    limparTimer();

    const qtd = parseFloat(quantidade);
    if (!qtd || qtd <= 0) {
      setErro('Quantidade deve ser maior que zero');
      return;
    }
    if (qtd > saldo) {
      setErro(`Saldo insuficiente. Disponível: ${saldo}`);
      return;
    }

    setGerando(true);
    try {
      const res = await api.post('/cooper-token/gerar-qr-pagamento', {
        quantidade: qtd,
      });
      setQrToken(res.data.qrToken);
      setCountdown(res.data.expiresIn);

      timerRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err: any) {
      setErro(err.response?.data?.message ?? 'Erro ao gerar QR Code');
    } finally {
      setGerando(false);
    }
  }

  function formatTime(seconds: number) {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  }

  if (carregando) {
    return <p className="text-muted-foreground text-center py-8">Carregando...</p>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Pagar com Tokens</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5" /> Saldo Disponível
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold text-green-600">
            {saldo.toFixed(4)} CTK
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" /> Gerar QR Code de Pagamento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleGerar} className="space-y-4">
            {erro && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
                {erro}
              </div>
            )}
            <div className="max-w-xs">
              <Label>Quantidade de tokens</Label>
              <Input
                type="number"
                min={0.0001}
                step={0.0001}
                value={quantidade}
                onChange={e => setQuantidade(e.target.value)}
                placeholder="Ex: 10.5"
                required
              />
              <p className="text-xs text-muted-foreground mt-1">
                Taxa: 1% retida na transferência
              </p>
            </div>
            <Button type="submit" disabled={gerando}>
              {gerando ? 'Gerando...' : 'Gerar QR Code'}
            </Button>
          </form>

          {qrToken && countdown > 0 && (
            <div className="mt-6 flex flex-col items-center gap-4">
              <div className="bg-white p-4 rounded-lg border">
                <QRCodeSVG value={qrToken} size={256} level="M" />
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Timer className="h-4 w-4" />
                <span
                  className={
                    countdown <= 60
                      ? 'text-red-600 font-bold'
                      : 'text-muted-foreground'
                  }
                >
                  Expira em {formatTime(countdown)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground text-center max-w-sm">
                Apresente este QR Code ao parceiro para que ele escaneie e
                processe o pagamento.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
