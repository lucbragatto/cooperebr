'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Coins, Search, Send, Loader2 } from 'lucide-react';

interface Cooperado {
  id: string;
  nomeCompleto: string;
  email: string;
}

export default function EnviarTokensPage() {
  const [saldo, setSaldo] = useState<number>(0);
  const [carregandoSaldo, setCarregandoSaldo] = useState(true);
  const [busca, setBusca] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [resultados, setResultados] = useState<Cooperado[]>([]);
  const [selecionado, setSelecionado] = useState<Cooperado | null>(null);
  const [quantidade, setQuantidade] = useState('');
  const [descricao, setDescricao] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState('');
  const [confirmando, setConfirmando] = useState(false);

  useEffect(() => {
    api.get('/cooper-token/saldo')
      .then((r) => setSaldo(Number(r.data.saldoDisponivel)))
      .finally(() => setCarregandoSaldo(false));
  }, []);

  async function buscarCooperados() {
    if (busca.trim().length < 2) return;
    setBuscando(true);
    setResultados([]);
    try {
      const { data } = await api.get('/cooperados', {
        params: { search: busca.trim(), limit: 10 },
      });
      setResultados(Array.isArray(data) ? data : data.items ?? data.data ?? []);
    } catch {
      setResultados([]);
    } finally {
      setBuscando(false);
    }
  }

  function selecionar(c: Cooperado) {
    setSelecionado(c);
    setResultados([]);
    setBusca('');
    setMensagem('');
    setErro('');
  }

  function prepararEnvio(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    setMensagem('');

    const qtd = parseFloat(quantidade);
    if (!qtd || qtd <= 0) {
      setErro('Quantidade deve ser maior que zero');
      return;
    }
    if (qtd > saldo) {
      setErro(`Saldo insuficiente. Disponivel: ${saldo.toFixed(4)} CTK`);
      return;
    }
    if (!selecionado) {
      setErro('Selecione um cooperado');
      return;
    }
    setConfirmando(true);
  }

  async function confirmarEnvio() {
    if (!selecionado) return;
    setEnviando(true);
    setErro('');
    setMensagem('');
    try {
      await api.post('/cooper-token/parceiro/enviar', {
        cooperadoId: selecionado.id,
        quantidade: parseFloat(quantidade),
        descricao: descricao || undefined,
      });
      setMensagem(
        `${parseFloat(quantidade).toFixed(4)} tokens enviados para ${selecionado.nomeCompleto} com sucesso!`,
      );
      setSaldo((prev) => prev - parseFloat(quantidade));
      setSelecionado(null);
      setQuantidade('');
      setDescricao('');
      setConfirmando(false);
    } catch (err: any) {
      setErro(err.response?.data?.message ?? 'Erro ao enviar tokens');
      setConfirmando(false);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Enviar Tokens</h1>
        <p className="text-sm text-gray-500 mt-1">
          Transfira tokens do seu saldo para um cooperado
        </p>
      </div>

      {/* Saldo */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Coins className="h-4 w-4 text-amber-600" /> Seu Saldo
          </CardTitle>
        </CardHeader>
        <CardContent>
          {carregandoSaldo ? (
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          ) : (
            <p className="text-3xl font-bold text-green-600">
              {saldo.toFixed(4)} CTK
            </p>
          )}
        </CardContent>
      </Card>

      {/* Busca cooperado */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Search className="h-4 w-4" /> Selecionar Cooperado
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {selecionado ? (
            <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-md px-4 py-3">
              <div>
                <p className="font-medium text-green-800">
                  {selecionado.nomeCompleto}
                </p>
                <p className="text-xs text-green-600">{selecionado.email}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelecionado(null)}
              >
                Trocar
              </Button>
            </div>
          ) : (
            <>
              <div className="flex gap-2">
                <Input
                  placeholder="Buscar por nome ou email..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && buscarCooperados()}
                />
                <Button
                  variant="outline"
                  onClick={buscarCooperados}
                  disabled={buscando || busca.trim().length < 2}
                >
                  {buscando ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
              </div>
              {resultados.length > 0 && (
                <div className="border rounded-md divide-y max-h-48 overflow-y-auto">
                  {resultados.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => selecionar(c)}
                      className="w-full text-left px-4 py-2 hover:bg-gray-50 transition-colors"
                    >
                      <p className="text-sm font-medium">{c.nomeCompleto}</p>
                      <p className="text-xs text-gray-500">{c.email}</p>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Form envio */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Send className="h-4 w-4" /> Dados do Envio
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={prepararEnvio} className="space-y-4">
            {erro && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
                {erro}
              </div>
            )}
            {mensagem && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded text-sm">
                {mensagem}
              </div>
            )}

            <div>
              <Label className="text-sm">Quantidade de tokens</Label>
              <Input
                type="number"
                min={0.0001}
                step={0.0001}
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
                placeholder="Ex: 50"
                required
              />
              <p className="text-xs text-muted-foreground mt-1">
                Sem taxa de transferencia
              </p>
            </div>

            <div>
              <Label className="text-sm">Descricao (opcional)</Label>
              <Input
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Ex: Bonus por indicacao"
              />
            </div>

            {!confirmando ? (
              <Button type="submit" disabled={!selecionado || enviando}>
                <Send className="h-4 w-4 mr-2" />
                Enviar Tokens
              </Button>
            ) : (
              <div className="bg-amber-50 border border-amber-200 rounded-md p-4 space-y-3">
                <p className="text-sm text-amber-800 font-medium">
                  Confirmar envio de{' '}
                  <strong>{parseFloat(quantidade).toFixed(4)} CTK</strong> para{' '}
                  <strong>{selecionado?.nomeCompleto}</strong>?
                </p>
                <div className="flex gap-2">
                  <Button
                    onClick={confirmarEnvio}
                    disabled={enviando}
                  >
                    {enviando ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    Confirmar
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setConfirmando(false)}
                    disabled={enviando}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
