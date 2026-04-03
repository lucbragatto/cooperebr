'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Camera, CheckCircle, XCircle, QrCode } from 'lucide-react';

export default function ReceberTokensPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [scanning, setScanning] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [resultado, setResultado] = useState<{
    sucesso: boolean;
    quantidadeBruta?: number;
    taxa?: number;
    quantidadeLiquida?: number;
    mensagem?: string;
  } | null>(null);
  const [erro, setErro] = useState('');
  const streamRef = useRef<MediaStream | null>(null);
  const readerRef = useRef<any>(null);

  const pararCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setScanning(false);
  }, []);

  useEffect(() => {
    return pararCamera;
  }, [pararCamera]);

  async function iniciarScanner() {
    setErro('');
    setResultado(null);
    setScanning(true);

    try {
      const { BrowserQRCodeReader } = await import('@zxing/browser');
      const reader = new BrowserQRCodeReader();
      readerRef.current = reader;

      const videoEl = videoRef.current;
      if (!videoEl) return;

      const result = await reader.decodeOnceFromVideoDevice(undefined, videoEl);
      const qrToken = result.getText();

      pararCamera();
      await processarQr(qrToken);
    } catch (err: any) {
      if (err?.name !== 'NotFoundException') {
        setErro('Erro ao acessar câmera ou ler QR Code');
      }
      pararCamera();
    }
  }

  async function processarQr(qrToken: string) {
    setProcessando(true);
    setErro('');
    try {
      const res = await api.post('/cooper-token/processar-pagamento-qr', {
        qrToken,
      });
      setResultado({
        sucesso: true,
        quantidadeBruta: res.data.quantidadeBruta,
        taxa: res.data.taxa,
        quantidadeLiquida: res.data.quantidadeLiquida,
      });
    } catch (err: any) {
      const msg = err.response?.data?.message ?? 'Erro ao processar pagamento';
      setResultado({ sucesso: false, mensagem: msg });
    } finally {
      setProcessando(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Receber Tokens</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" /> Scanner QR Code
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {erro && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
              {erro}
            </div>
          )}

          {processando && (
            <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded text-sm text-center">
              Processando pagamento...
            </div>
          )}

          {resultado && (
            <div
              className={
                resultado.sucesso
                  ? 'bg-green-50 border border-green-200 text-green-700 px-4 py-4 rounded'
                  : 'bg-red-50 border border-red-200 text-red-700 px-4 py-4 rounded'
              }
            >
              {resultado.sucesso ? (
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-6 w-6 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold">Pagamento recebido!</p>
                    <p className="text-sm mt-1">
                      Bruto: {resultado.quantidadeBruta?.toFixed(4)} CTK
                    </p>
                    <p className="text-sm">
                      Taxa (1%): {resultado.taxa?.toFixed(4)} CTK
                    </p>
                    <p className="text-sm font-bold">
                      Recebido: {resultado.quantidadeLiquida?.toFixed(4)} CTK
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <XCircle className="h-6 w-6 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold">Falha no pagamento</p>
                    <p className="text-sm mt-1">{resultado.mensagem}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col items-center gap-4">
            {scanning && (
              <div className="w-full max-w-sm aspect-square bg-black rounded-lg overflow-hidden">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  playsInline
                  muted
                />
              </div>
            )}

            <div className="flex gap-2">
              {!scanning ? (
                <Button onClick={iniciarScanner} disabled={processando}>
                  <Camera className="h-4 w-4 mr-2" />
                  {resultado ? 'Escanear Novo QR' : 'Iniciar Scanner'}
                </Button>
              ) : (
                <Button variant="outline" onClick={pararCamera}>
                  Cancelar
                </Button>
              )}
            </div>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Aponte a câmera para o QR Code exibido no app do cooperado para
            receber o pagamento em tokens.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
