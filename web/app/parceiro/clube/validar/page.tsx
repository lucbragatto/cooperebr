'use client';

import { useState } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ShieldCheck, Search, CheckCircle, AlertTriangle } from 'lucide-react';

interface ResultadoValidacao {
  jaValidado: boolean;
  validadoEm: string;
  cooperadoNome: string;
  ofertaTitulo: string;
  beneficio: string;
  tokensUsados: number;
  criadoEm: string;
}

export default function ValidarResgatePage() {
  const [codigo, setCodigo] = useState('');
  const [validando, setValidando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoValidacao | null>(null);
  const [erro, setErro] = useState('');

  async function handleValidar(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    setResultado(null);

    const codigoTrim = codigo.trim();
    if (!codigoTrim) {
      setErro('Digite o codigo de resgate');
      return;
    }

    setValidando(true);
    try {
      const res = await api.post('/clube-vantagens/validar-resgate', {
        codigoResgate: codigoTrim,
      });
      setResultado(res.data);
    } catch (err: any) {
      setErro(err.response?.data?.message ?? 'Codigo nao encontrado');
    } finally {
      setValidando(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <ShieldCheck className="h-6 w-6 text-blue-600" />
        Validar Resgate
      </h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Codigo de confirmacao</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleValidar} className="space-y-4">
            <div>
              <Label>Codigo UUID do resgate</Label>
              <Input
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                placeholder="Ex: a1b2c3d4-e5f6-..."
                className="font-mono"
              />
            </div>
            <Button type="submit" disabled={validando}>
              <Search className="h-4 w-4 mr-2" />
              {validando ? 'Validando...' : 'Validar'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {erro && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
          {erro}
        </div>
      )}

      {resultado && (
        <Card className={resultado.jaValidado ? 'border-amber-400' : 'border-green-500 border-2'}>
          <CardContent className="py-6 space-y-4">
            {resultado.jaValidado ? (
              <div className="flex items-center gap-2 text-amber-700">
                <AlertTriangle className="h-5 w-5" />
                <span className="font-semibold">Este resgate ja foi validado anteriormente</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-green-700">
                <CheckCircle className="h-5 w-5" />
                <span className="font-semibold">Resgate validado com sucesso!</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground">Cooperado</p>
                <p className="font-medium">{resultado.cooperadoNome}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Oferta</p>
                <p className="font-medium">{resultado.ofertaTitulo}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Beneficio</p>
                <p className="font-medium">{resultado.beneficio}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Tokens usados</p>
                <p className="font-medium">{resultado.tokensUsados} CTK</p>
              </div>
              <div>
                <p className="text-muted-foreground">Resgatado em</p>
                <p className="font-medium">
                  {new Date(resultado.criadoEm).toLocaleString('pt-BR')}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Validado em</p>
                <p className="font-medium">
                  {resultado.validadoEm
                    ? new Date(resultado.validadoEm).toLocaleString('pt-BR')
                    : '-'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
