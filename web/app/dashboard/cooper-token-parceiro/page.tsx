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
import { Coins, Loader2, ArrowDownCircle, Zap, ArrowRightCircle, Search } from 'lucide-react';

interface SaldoParceiro {
  id: string;
  cooperativaId: string;
  saldoDisponivel: string;
  totalRecebido: string;
  totalUsadoEnergia: string;
  totalTransferido: string;
  totalComprado: string;
}

interface LedgerItem {
  id: string;
  cooperadoId: string;
  tipo: string;
  operacao: string;
  quantidade: string;
  saldoApos: string;
  descricao: string | null;
  createdAt: string;
  cooperado: { nomeCompleto: string; email: string } | null;
}

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtToken = (v: number) =>
  Number.isInteger(v)
    ? v.toLocaleString('pt-BR')
    : v.toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 });

const fmtData = (iso: string) => {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm} ${hh}:${mi}`;
};

function OperacaoBadge({ operacao }: { operacao: string }) {
  const cores: Record<string, string> = {
    CREDITO: 'bg-green-100 text-green-800',
    DEBITO: 'bg-red-100 text-red-800',
    ABATIMENTO_ENERGIA: 'bg-orange-100 text-orange-800',
    TRANSFERENCIA_PARCEIRO: 'bg-blue-100 text-blue-800',
    COMPRA_PARCEIRO: 'bg-purple-100 text-purple-800',
  };
  const labels: Record<string, string> = {
    CREDITO: 'Recebido',
    DEBITO: 'Débito',
    ABATIMENTO_ENERGIA: 'Energia',
    TRANSFERENCIA_PARCEIRO: 'Transferência',
    COMPRA_PARCEIRO: 'Compra',
  };
  return <Badge className={cores[operacao] ?? 'bg-gray-100 text-gray-600'}>{labels[operacao] ?? operacao}</Badge>;
}

interface ParceiroSearch {
  id: string;
  nome: string;
  cnpj: string;
}

export default function CooperTokenParceiroPage() {
  const [saldo, setSaldo] = useState<SaldoParceiro | null>(null);
  const [extrato, setExtrato] = useState<LedgerItem[]>([]);
  const [extratoTotal, setExtratoTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [carregando, setCarregando] = useState(true);

  // Usar energia
  const [ueQtd, setUeQtd] = useState('');
  const [ueDesc, setUeDesc] = useState('');
  const [ueEnviando, setUeEnviando] = useState(false);
  const [ueMsg, setUeMsg] = useState('');

  // Transferir
  const [trBusca, setTrBusca] = useState('');
  const [trBuscando, setTrBuscando] = useState(false);
  const [trResultados, setTrResultados] = useState<ParceiroSearch[]>([]);
  const [trSelecionado, setTrSelecionado] = useState<ParceiroSearch | null>(null);
  const [trQtd, setTrQtd] = useState('');
  const [trDesc, setTrDesc] = useState('');
  const [trEnviando, setTrEnviando] = useState(false);
  const [trMsg, setTrMsg] = useState('');

  useEffect(() => { buscarSaldo(); }, []);
  useEffect(() => { buscarExtrato(); }, [page]);

  function buscarSaldo() {
    api.get('/cooper-token/parceiro/saldo')
      .then((res) => setSaldo(res.data))
      .catch(() => {})
      .finally(() => setCarregando(false));
  }

  function buscarExtrato() {
    api.get('/cooper-token/parceiro/extrato', { params: { page, limit: 50 } })
      .then((res) => {
        setExtrato(res.data.items ?? []);
        setExtratoTotal(res.data.total ?? 0);
      })
      .catch(() => {});
  }

  async function usarEnergia() {
    const qtd = parseFloat(ueQtd);
    if (!qtd || qtd <= 0) { setUeMsg('Quantidade deve ser maior que zero'); return; }
    if (!confirm(`Usar ${fmtToken(qtd)} tokens para abater conta de energia?`)) return;
    setUeEnviando(true);
    setUeMsg('');
    try {
      await api.post('/cooper-token/parceiro/usar-energia', { quantidade: qtd, descricao: ueDesc || undefined });
      setUeMsg(`${fmtToken(qtd)} tokens usados para abatimento de energia`);
      setUeQtd('');
      setUeDesc('');
      buscarSaldo();
      buscarExtrato();
    } catch (err: any) {
      setUeMsg(err.response?.data?.message ?? 'Erro ao usar tokens');
    } finally { setUeEnviando(false); }
  }

  async function buscarParceiros() {
    if (trBusca.trim().length < 2) return;
    setTrBuscando(true);
    try {
      const { data } = await api.get('/cooperativas', { params: { search: trBusca.trim(), limit: 10 } });
      setTrResultados(Array.isArray(data) ? data : data.items ?? data.data ?? []);
    } catch { setTrResultados([]); }
    finally { setTrBuscando(false); }
  }

  async function transferir() {
    if (!trSelecionado) return;
    const qtd = parseFloat(trQtd);
    if (!qtd || qtd <= 0) { setTrMsg('Quantidade deve ser maior que zero'); return; }
    if (!confirm(`Transferir ${fmtToken(qtd)} tokens para ${trSelecionado.nome}?`)) return;
    setTrEnviando(true);
    setTrMsg('');
    try {
      await api.post('/cooper-token/parceiro/transferir', {
        destinatarioCooperativaId: trSelecionado.id,
        quantidade: qtd,
        descricao: trDesc || undefined,
      });
      setTrMsg(`${fmtToken(qtd)} tokens transferidos para ${trSelecionado.nome}`);
      setTrSelecionado(null);
      setTrQtd('');
      setTrDesc('');
      buscarSaldo();
      buscarExtrato();
    } catch (err: any) {
      setTrMsg(err.response?.data?.message ?? 'Erro ao transferir tokens');
    } finally { setTrEnviando(false); }
  }

  const totalPages = Math.ceil(extratoTotal / 50);

  if (carregando) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <ArrowDownCircle className="h-6 w-6 text-amber-600" />
        <h2 className="text-2xl font-bold text-gray-800">Tokens Recebidos</h2>
      </div>

      {/* KPIs */}
      {saldo && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card className="border-green-200 bg-green-50">
            <CardContent className="pt-6">
              <p className="text-sm text-green-700 font-medium">Saldo Disponível</p>
              <p className="text-2xl font-bold text-green-800">{fmtToken(Number(saldo.saldoDisponivel))} CTK</p>
            </CardContent>
          </Card>
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="pt-6">
              <p className="text-sm text-amber-700 font-medium">Total Recebido</p>
              <p className="text-2xl font-bold text-amber-800">{fmtToken(Number(saldo.totalRecebido))}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-gray-500">Usado em Energia</p>
              <p className="text-2xl font-bold text-gray-800">{fmtToken(Number(saldo.totalUsadoEnergia))}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-gray-500">Transferido</p>
              <p className="text-2xl font-bold text-gray-800">{fmtToken(Number(saldo.totalTransferido))}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Usar tokens para energia */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Zap className="h-4 w-4" />
            Usar Tokens para Abater Energia
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {ueMsg && (
            <div className={`px-4 py-3 rounded text-sm border ${ueMsg.includes('Erro') ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700'}`}>
              {ueMsg}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm">Quantidade de tokens</Label>
              <Input type="number" min={0.0001} step={0.0001} value={ueQtd} onChange={(e) => setUeQtd(e.target.value)} placeholder="Ex: 50" />
            </div>
            <div>
              <Label className="text-sm">Descrição (opcional)</Label>
              <Input value={ueDesc} onChange={(e) => setUeDesc(e.target.value)} placeholder="Ex: Abatimento ref. abril/2026" />
            </div>
          </div>
          <Button onClick={usarEnergia} disabled={ueEnviando}>
            {ueEnviando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Zap className="h-4 w-4 mr-2" />}
            Usar Tokens
          </Button>
        </CardContent>
      </Card>

      {/* Transferir para outro parceiro */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ArrowRightCircle className="h-4 w-4" />
            Transferir para Outro Parceiro
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {trMsg && (
            <div className={`px-4 py-3 rounded text-sm border ${trMsg.includes('Erro') ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700'}`}>
              {trMsg}
            </div>
          )}

          {trSelecionado ? (
            <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-md px-4 py-3">
              <div>
                <p className="font-medium text-blue-800">{trSelecionado.nome}</p>
                <p className="text-xs text-blue-600">{trSelecionado.cnpj}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setTrSelecionado(null)}>Trocar</Button>
            </div>
          ) : (
            <div className="space-y-2">
              <Label className="text-sm">Buscar parceiro por nome ou CNPJ</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Nome ou CNPJ..."
                  value={trBusca}
                  onChange={(e) => setTrBusca(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), buscarParceiros())}
                />
                <Button variant="outline" onClick={buscarParceiros} disabled={trBuscando || trBusca.trim().length < 2}>
                  {trBuscando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </Button>
              </div>
              {trResultados.length > 0 && (
                <div className="border rounded-md divide-y max-h-40 overflow-y-auto">
                  {trResultados.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => { setTrSelecionado(p); setTrResultados([]); setTrBusca(''); }}
                      className="w-full text-left px-4 py-2 hover:bg-gray-50 transition-colors"
                    >
                      <p className="text-sm font-medium">{p.nome}</p>
                      <p className="text-xs text-gray-500">{p.cnpj}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm">Quantidade</Label>
              <Input type="number" min={0.0001} step={0.0001} value={trQtd} onChange={(e) => setTrQtd(e.target.value)} placeholder="Ex: 100" />
            </div>
            <div>
              <Label className="text-sm">Descrição (opcional)</Label>
              <Input value={trDesc} onChange={(e) => setTrDesc(e.target.value)} placeholder="Ex: Parceria abril" />
            </div>
          </div>
          <Button onClick={transferir} disabled={!trSelecionado || trEnviando}>
            {trEnviando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ArrowRightCircle className="h-4 w-4 mr-2" />}
            Transferir Tokens
          </Button>
        </CardContent>
      </Card>

      {/* Extrato */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-amber-600" />
            Extrato de Operações
            {extratoTotal > 0 && (
              <span className="text-sm font-normal text-gray-400 ml-2">({extratoTotal} registros)</span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Cooperado</TableHead>
                <TableHead>Operação</TableHead>
                <TableHead className="text-right">Quantidade</TableHead>
                <TableHead className="text-right">Saldo Após</TableHead>
                <TableHead>Descrição</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {extrato.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-gray-400 py-8">
                    Nenhuma operação registrada.
                  </TableCell>
                </TableRow>
              )}
              {extrato.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="whitespace-nowrap text-sm">{fmtData(l.createdAt)}</TableCell>
                  <TableCell>
                    <div className="font-medium text-sm">{l.cooperado?.nomeCompleto ?? '—'}</div>
                  </TableCell>
                  <TableCell><OperacaoBadge operacao={l.operacao} /></TableCell>
                  <TableCell className="text-right font-mono">{fmtToken(Number(l.quantidade))}</TableCell>
                  <TableCell className="text-right font-mono text-gray-500">{fmtToken(Number(l.saldoApos))}</TableCell>
                  <TableCell className="text-xs text-gray-500 max-w-[200px] truncate">{l.descricao ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-gray-500">Pagina {page} de {totalPages}</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Proxima</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
