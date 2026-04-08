'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Award, Gift, CheckCircle, Loader2 } from 'lucide-react';

interface Oferta {
  id: string;
  titulo: string;
  descricao: string;
  quantidadeTokens: number;
  beneficio: string;
  emoji: string | null;
  estoque: number | null;
  totalResgatado: number;
  validadeAte: string | null;
}

interface Resgate {
  id: string;
  codigoResgate: string;
  tokensUsados: number;
  validado: boolean;
  createdAt: string;
  oferta: { titulo: string; beneficio: string; emoji: string | null };
}

export default function PortalClubePage() {
  const [ofertas, setOfertas] = useState<Oferta[]>([]);
  const [resgates, setResgates] = useState<Resgate[]>([]);
  const [saldo, setSaldo] = useState<number>(0);
  const [carregando, setCarregando] = useState(true);
  const [resgatando, setResgatando] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{
    codigoResgate: string;
    ofertaTitulo: string;
    beneficio: string;
    tokensUsados: number;
  } | null>(null);
  const [erro, setErro] = useState('');
  const [confirmando, setConfirmando] = useState<Oferta | null>(null);

  const carregarDados = useCallback(async () => {
    try {
      const [ofertasRes, saldoRes, resgatesRes] = await Promise.all([
        api.get('/clube-vantagens/ofertas'),
        api.get('/cooper-token/saldo'),
        api.get('/clube-vantagens/meus-resgates'),
      ]);
      setOfertas(ofertasRes.data);
      setSaldo(Number(saldoRes.data.saldoDisponivel));
      setResgates(resgatesRes.data);
    } catch {
      // silently fail
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  async function handleResgatar(ofertaId: string) {
    setErro('');
    setResultado(null);
    setResgatando(ofertaId);

    try {
      const res = await api.post('/clube-vantagens/resgatar', { ofertaId });
      setResultado(res.data);
      await carregarDados();
    } catch (err: any) {
      setErro(err.response?.data?.message ?? 'Erro ao resgatar oferta');
    } finally {
      setResgatando(null);
    }
  }

  if (carregando) {
    return <p className="text-muted-foreground text-center py-8">Carregando...</p>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Award className="h-6 w-6 text-amber-500" />
        Clube de Vantagens
      </h1>

      {/* Saldo */}
      <Card>
        <CardContent className="py-4">
          <p className="text-sm text-muted-foreground">Seu saldo</p>
          <p className="text-2xl font-bold text-green-600">{saldo.toFixed(0)} CTK</p>
        </CardContent>
      </Card>

      {/* Modal de confirmacao */}
      {confirmando && (
        <Card className="border-2 border-blue-400 bg-blue-50">
          <CardContent className="py-6 text-center space-y-3">
            <h2 className="text-lg font-bold text-blue-800">Confirmar resgate</h2>
            <p className="text-sm text-blue-700">
              <strong>{confirmando.emoji ?? '🎁'} {confirmando.titulo}</strong>
            </p>
            <p className="text-sm text-muted-foreground">{confirmando.beneficio}</p>
            <div className="bg-white border rounded-lg p-3 mt-2">
              <p className="text-xs text-muted-foreground">Custo</p>
              <p className="text-xl font-bold text-amber-600">{confirmando.quantidadeTokens} CTK</p>
              <p className="text-xs text-muted-foreground mt-1">
                Saldo atual: <span className="font-medium text-green-600">{saldo.toFixed(0)} CTK</span>
                {' → '}
                Saldo apos: <span className="font-medium">{(saldo - confirmando.quantidadeTokens).toFixed(0)} CTK</span>
              </p>
            </div>
            <div className="flex gap-2 justify-center mt-3">
              <Button variant="outline" size="sm" onClick={() => setConfirmando(null)}>
                Cancelar
              </Button>
              <Button
                size="sm"
                disabled={resgatando === confirmando.id}
                onClick={() => {
                  const ofertaId = confirmando.id;
                  setConfirmando(null);
                  handleResgatar(ofertaId);
                }}
              >
                {resgatando === confirmando.id ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : null}
                Confirmar resgate
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modal de resultado de resgate */}
      {resultado && (
        <Card className="border-2 border-green-500 bg-green-50">
          <CardContent className="py-6 text-center space-y-3">
            <CheckCircle className="h-10 w-10 text-green-600 mx-auto" />
            <h2 className="text-lg font-bold text-green-800">Resgate realizado!</h2>
            <p className="text-sm text-green-700">
              <strong>{resultado.ofertaTitulo}</strong> — {resultado.tokensUsados} tokens
            </p>
            <div className="bg-white border-2 border-dashed border-green-400 rounded-lg p-4 mt-3">
              <p className="text-xs text-muted-foreground mb-1">Codigo de confirmacao</p>
              <p className="text-lg font-mono font-bold tracking-wider text-green-800 break-all">
                {resultado.codigoResgate}
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Apresente este codigo ao parceiro para validar seu beneficio
            </p>
            <Button variant="outline" size="sm" onClick={() => setResultado(null)}>
              Fechar
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Erro */}
      {erro && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
          {erro}
        </div>
      )}

      {/* Catalogo de ofertas */}
      {ofertas.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Gift className="h-10 w-10 text-gray-300 mx-auto mb-2" />
            <p className="text-muted-foreground">Nenhuma oferta disponivel no momento</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Ofertas disponiveis</h2>
          {ofertas.map((oferta) => {
            const semEstoque = oferta.estoque != null && oferta.totalResgatado >= oferta.estoque;
            const saldoInsuficiente = saldo < oferta.quantidadeTokens;

            return (
              <Card key={oferta.id} className={semEstoque ? 'opacity-60' : ''}>
                <CardContent className="py-4">
                  <div className="flex items-start gap-3">
                    <span className="text-3xl">{oferta.emoji ?? '🎁'}</span>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold">{oferta.titulo}</h3>
                      <p className="text-sm text-muted-foreground mt-0.5">{oferta.descricao}</p>
                      <p className="text-xs text-green-700 mt-1 font-medium">{oferta.beneficio}</p>
                      {oferta.estoque != null && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Restam: {Math.max(0, oferta.estoque - oferta.totalResgatado)} unidades
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-lg font-bold text-amber-600">
                        {oferta.quantidadeTokens} CTK
                      </p>
                      <Button
                        size="sm"
                        className="mt-2"
                        disabled={semEstoque || saldoInsuficiente || resgatando === oferta.id}
                        onClick={() => setConfirmando(oferta)}
                      >
                        {resgatando === oferta.id ? (
                          <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        ) : null}
                        {semEstoque ? 'Esgotado' : saldoInsuficiente ? 'Saldo insuficiente' : 'Resgatar'}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Meus resgates */}
      {resgates.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Meus resgates</h2>
          {resgates.map((r) => (
            <Card key={r.id}>
              <CardContent className="py-3">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{r.oferta.emoji ?? '🎁'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{r.oferta.titulo}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(r.createdAt).toLocaleDateString('pt-BR')} — {r.tokensUsados} CTK
                    </p>
                    <p className="text-xs font-mono text-muted-foreground break-all">
                      {r.codigoResgate}
                    </p>
                  </div>
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      r.validado
                        ? 'bg-green-100 text-green-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {r.validado ? 'Validado' : 'Pendente'}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
