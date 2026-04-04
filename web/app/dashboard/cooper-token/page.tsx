'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Coins, Loader2, Play, Settings, BookOpen, PlusCircle, Search } from 'lucide-react';

interface Resumo {
  totalEmitido: number;
  emCirculacao: number;
  totalExpirado: number;
  emitidoMes: number;
  valorTotalReais: number;
  totalCooperados: number;
  config: {
    valorTokenReais: number;
    tokenExpiracaoMeses: number;
    tokenPorKwhExcedente: number;
    tokenDescontoMaxPerc: number;
  } | null;
}

interface LedgerItem {
  id: string;
  cooperadoId: string;
  tipo: string;
  operacao: string;
  quantidade: string;
  saldoApos: string;
  valorReais: string | null;
  descricao: string | null;
  createdAt: string;
  cooperado: { nomeCompleto: string; email: string } | null;
}

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtToken = (v: number) =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 });

function OperacaoBadge({ operacao }: { operacao: string }) {
  const cores: Record<string, string> = {
    CREDITO: 'bg-green-100 text-green-800',
    DEBITO: 'bg-red-100 text-red-800',
    EXPIRACAO: 'bg-yellow-100 text-yellow-800',
    DOACAO_ENVIADA: 'bg-blue-100 text-blue-800',
    DOACAO_RECEBIDA: 'bg-purple-100 text-purple-800',
  };
  return <Badge className={cores[operacao] ?? 'bg-gray-100 text-gray-600'}>{operacao}</Badge>;
}

function TipoBadge({ tipo }: { tipo: string }) {
  const labels: Record<string, string> = {
    GERACAO_EXCEDENTE: 'Excedente',
    FLEX: 'Flex',
    SOCIAL: 'Social',
    BONUS_INDICACAO: 'Indicacao',
  };
  return <Badge variant="outline">{labels[tipo] ?? tipo}</Badge>;
}

interface CooperadoBusca {
  id: string;
  nomeCompleto: string;
  email: string;
}

export default function CooperTokenPage() {
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [ledger, setLedger] = useState<LedgerItem[]>([]);
  const [ledgerTotal, setLedgerTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [carregando, setCarregando] = useState(true);
  const [processando, setProcessando] = useState(false);

  // Emissão manual
  const [emBusca, setEmBusca] = useState('');
  const [emBuscando, setEmBuscando] = useState(false);
  const [emResultados, setEmResultados] = useState<CooperadoBusca[]>([]);
  const [emSelecionado, setEmSelecionado] = useState<CooperadoBusca | null>(null);
  const [emQuantidade, setEmQuantidade] = useState('');
  const [emDescricao, setEmDescricao] = useState('');
  const [emEnviando, setEmEnviando] = useState(false);
  const [emMensagem, setEmMensagem] = useState('');

  useEffect(() => {
    buscarResumo();
  }, []);

  useEffect(() => {
    buscarLedger();
  }, [page]);

  function buscarResumo() {
    api.get('/cooper-token/admin/resumo')
      .then((res) => setResumo(res.data))
      .catch(() => {});
  }

  function buscarLedger() {
    setCarregando(true);
    api.get('/cooper-token/admin/ledger', { params: { page, limit: 50 } })
      .then((res) => {
        setLedger(res.data.items ?? []);
        setLedgerTotal(res.data.total ?? 0);
      })
      .catch(() => {})
      .finally(() => setCarregando(false));
  }

  async function processar() {
    if (!confirm('Executar apuracao de excedentes agora?')) return;
    setProcessando(true);
    try {
      await api.post('/cooper-token/admin/processar');
      alert('Apuracao executada com sucesso!');
      buscarResumo();
      buscarLedger();
    } catch {
      alert('Erro ao processar excedentes.');
    } finally {
      setProcessando(false);
    }
  }

  async function buscarCooperadoEmissao() {
    if (emBusca.trim().length < 2) return;
    setEmBuscando(true);
    try {
      const { data } = await api.get('/cooperados', { params: { search: emBusca.trim(), limit: 10 } });
      setEmResultados(Array.isArray(data) ? data : data.items ?? data.data ?? []);
    } catch { setEmResultados([]); }
    finally { setEmBuscando(false); }
  }

  async function emitirManual() {
    if (!emSelecionado) return;
    const qtd = parseFloat(emQuantidade);
    if (!qtd || qtd <= 0) { setEmMensagem('Quantidade deve ser maior que zero'); return; }
    if (!confirm(`Emitir ${qtd.toFixed(4)} tokens para ${emSelecionado.nomeCompleto}?\nTaxa de emissao 2% sera aplicada (liquido: ${(qtd * 0.98).toFixed(4)}).`)) return;
    setEmEnviando(true);
    setEmMensagem('');
    try {
      await api.post('/cooper-token/admin/creditar-manual', {
        cooperadoId: emSelecionado.id,
        quantidade: qtd,
        descricao: emDescricao || undefined,
      });
      setEmMensagem(`${qtd.toFixed(4)} tokens emitidos para ${emSelecionado.nomeCompleto} (liquido: ${(qtd * 0.98).toFixed(4)} apos taxa 2%)`);
      setEmSelecionado(null);
      setEmQuantidade('');
      setEmDescricao('');
      buscarResumo();
      buscarLedger();
    } catch (err: any) {
      setEmMensagem(err.response?.data?.message ?? 'Erro ao emitir tokens');
    } finally { setEmEnviando(false); }
  }

  const totalPages = Math.ceil(ledgerTotal / 50);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Coins className="h-6 w-6 text-amber-600" />
          <h2 className="text-2xl font-bold text-gray-800">CooperToken</h2>
        </div>
        <Button onClick={processar} disabled={processando}>
          {processando ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Play className="h-4 w-4 mr-2" />
          )}
          Processar Excedentes
        </Button>
      </div>

      {/* KPIs */}
      {resumo && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="pt-6">
              <p className="text-sm text-amber-700 font-medium">Total Emitido</p>
              <p className="text-2xl font-bold text-amber-800">{fmtToken(resumo.totalEmitido)}</p>
            </CardContent>
          </Card>
          <Card className="border-green-200 bg-green-50">
            <CardContent className="pt-6">
              <p className="text-sm text-green-700 font-medium">Em Circulacao</p>
              <p className="text-2xl font-bold text-green-800">{fmtToken(resumo.emCirculacao)}</p>
              <p className="text-xs text-green-600 mt-1">R$ {fmt(resumo.valorTotalReais)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-gray-500">Expirados</p>
              <p className="text-2xl font-bold text-gray-800">{fmtToken(resumo.totalExpirado)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-gray-500">Emitido este Mes</p>
              <p className="text-2xl font-bold text-gray-800">{fmtToken(resumo.emitidoMes)}</p>
              <p className="text-xs text-gray-400 mt-1">{resumo.totalCooperados} cooperados</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Config */}
      {resumo?.config && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Settings className="h-4 w-4" />
              Configuracao do Plano
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Valor Token (R$)</p>
                <p className="font-semibold">{fmt(resumo.config.valorTokenReais)}</p>
              </div>
              <div>
                <p className="text-gray-500">Expiracao (meses)</p>
                <p className="font-semibold">{resumo.config.tokenExpiracaoMeses}</p>
              </div>
              <div>
                <p className="text-gray-500">Token/kWh Excedente</p>
                <p className="font-semibold">{resumo.config.tokenPorKwhExcedente}</p>
              </div>
              <div>
                <p className="text-gray-500">Desconto Max (%)</p>
                <p className="font-semibold">{fmt(resumo.config.tokenDescontoMaxPerc)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Emissão Manual */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <PlusCircle className="h-4 w-4" />
            Emissao Manual de Tokens
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-gray-500">
            Taxa de emissao de 2% sera aplicada automaticamente.
          </p>

          {emMensagem && (
            <div className={`px-4 py-3 rounded text-sm border ${emMensagem.includes('Erro') ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700'}`}>
              {emMensagem}
            </div>
          )}

          {/* Busca */}
          {emSelecionado ? (
            <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-md px-4 py-3">
              <div>
                <p className="font-medium text-green-800">{emSelecionado.nomeCompleto}</p>
                <p className="text-xs text-green-600">{emSelecionado.email}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setEmSelecionado(null)}>
                Trocar
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <Label className="text-sm">Buscar cooperado</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Nome ou email..."
                  value={emBusca}
                  onChange={(e) => setEmBusca(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), buscarCooperadoEmissao())}
                />
                <Button variant="outline" onClick={buscarCooperadoEmissao} disabled={emBuscando || emBusca.trim().length < 2}>
                  {emBuscando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </Button>
              </div>
              {emResultados.length > 0 && (
                <div className="border rounded-md divide-y max-h-40 overflow-y-auto">
                  {emResultados.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => { setEmSelecionado(c); setEmResultados([]); setEmBusca(''); }}
                      className="w-full text-left px-4 py-2 hover:bg-gray-50 transition-colors"
                    >
                      <p className="text-sm font-medium">{c.nomeCompleto}</p>
                      <p className="text-xs text-gray-500">{c.email}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm">Quantidade</Label>
              <Input
                type="number"
                min={0.0001}
                step={0.0001}
                value={emQuantidade}
                onChange={(e) => setEmQuantidade(e.target.value)}
                placeholder="Ex: 100"
              />
            </div>
            <div>
              <Label className="text-sm">Descricao (opcional)</Label>
              <Input
                value={emDescricao}
                onChange={(e) => setEmDescricao(e.target.value)}
                placeholder="Ex: Bonus por fidelidade"
              />
            </div>
          </div>

          <Button onClick={emitirManual} disabled={!emSelecionado || emEnviando}>
            {emEnviando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <PlusCircle className="h-4 w-4 mr-2" />}
            Emitir Tokens
          </Button>
        </CardContent>
      </Card>

      {/* Ledger */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-amber-600" />
            Ledger de Transacoes
            {ledgerTotal > 0 && (
              <span className="text-sm font-normal text-gray-400 ml-2">
                ({ledgerTotal} registros)
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {carregando && <p className="text-gray-500 py-4">Carregando...</p>}
          {!carregando && (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Cooperado</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Operacao</TableHead>
                    <TableHead className="text-right">Quantidade</TableHead>
                    <TableHead className="text-right">Saldo Apos</TableHead>
                    <TableHead>Descricao</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ledger.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-gray-400 py-8">
                        Nenhuma transacao registrada.
                      </TableCell>
                    </TableRow>
                  )}
                  {ledger.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="whitespace-nowrap">
                        {new Date(l.createdAt).toLocaleDateString('pt-BR')}{' '}
                        <span className="text-gray-400 text-xs">
                          {new Date(l.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{l.cooperado?.nomeCompleto ?? '—'}</div>
                        <div className="text-xs text-gray-400">{l.cooperado?.email ?? ''}</div>
                      </TableCell>
                      <TableCell><TipoBadge tipo={l.tipo} /></TableCell>
                      <TableCell><OperacaoBadge operacao={l.operacao} /></TableCell>
                      <TableCell className="text-right font-mono">
                        {fmtToken(Number(l.quantidade))}
                      </TableCell>
                      <TableCell className="text-right font-mono text-gray-500">
                        {fmtToken(Number(l.saldoApos))}
                      </TableCell>
                      <TableCell className="text-xs text-gray-500 max-w-[200px] truncate">
                        {l.descricao ?? '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-gray-500">
                    Pagina {page} de {totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Proxima
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
