'use client';

import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  ArrowUpCircle, CheckCircle, Clock, AlertTriangle, Plus, Loader2, Trash2,
} from 'lucide-react';

interface ContaAPagar {
  id: string;
  descricao: string;
  categoria: string;
  valor: number;
  dataVencimento: string;
  dataPagamento: string | null;
  status: string;
  comprovante: string | null;
  usina?: { id: string; nome: string } | null;
  createdAt: string;
}

function formatarMoeda(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function formatarData(d: string | null): string {
  if (!d) return '\u2014';
  return new Date(d).toLocaleDateString('pt-BR');
}

const STATUS_BADGE: Record<string, { label: string; class: string }> = {
  PENDENTE: { label: 'Pendente', class: 'bg-blue-100 text-blue-700' },
  PAGO: { label: 'Pago', class: 'bg-green-100 text-green-700' },
  ATRASADO: { label: 'Atrasado', class: 'bg-red-100 text-red-700' },
  CANCELADO: { label: 'Cancelado', class: 'bg-gray-100 text-gray-500' },
};

const CATEGORIAS: Record<string, string> = {
  ARRENDAMENTO_USINA: 'Arrendamento Usina',
  MANUTENCAO: 'Manuten\u00e7\u00e3o',
  SALARIO: 'Sal\u00e1rio',
  OUTRO: 'Outro',
};

export default function ContasPagarPage() {
  const [contas, setContas] = useState<ContaAPagar[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [statusFiltro, setStatusFiltro] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState('');
  const [busca, setBusca] = useState('');
  const [modalAberto, setModalAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const [form, setForm] = useState({
    descricao: '', categoria: 'ARRENDAMENTO_USINA', valor: '', dataVencimento: '',
  });

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const params = new URLSearchParams();
      if (statusFiltro) params.set('status', statusFiltro);
      if (categoriaFiltro) params.set('categoria', categoriaFiltro);
      const { data } = await api.get(`/contas-pagar?${params}`);
      setContas(data);
    } catch {
      setContas([]);
    } finally {
      setCarregando(false);
    }
  }, [statusFiltro, categoriaFiltro]);

  useEffect(() => { carregar(); }, [carregar]);

  async function marcarPago(id: string) {
    try {
      await api.patch(`/contas-pagar/${id}`, {
        status: 'PAGO',
        dataPagamento: new Date().toISOString(),
      });
      carregar();
    } catch {
      alert('Erro ao marcar como pago');
    }
  }

  async function excluir(id: string) {
    if (!confirm('Excluir esta conta a pagar?')) return;
    try {
      await api.delete(`/contas-pagar/${id}`);
      carregar();
    } catch {
      alert('Erro ao excluir');
    }
  }

  async function criarConta() {
    if (!form.descricao || !form.valor || !form.dataVencimento) return;
    setSalvando(true);
    try {
      await api.post('/contas-pagar', {
        descricao: form.descricao,
        categoria: form.categoria,
        valor: parseFloat(form.valor),
        dataVencimento: form.dataVencimento,
      });
      setModalAberto(false);
      setForm({ descricao: '', categoria: 'ARRENDAMENTO_USINA', valor: '', dataVencimento: '' });
      carregar();
    } catch {
      alert('Erro ao criar conta a pagar');
    } finally {
      setSalvando(false);
    }
  }

  const hoje = new Date().toISOString().slice(0, 10);
  const filtradas = contas.filter((c) =>
    !busca || c.descricao.toLowerCase().includes(busca.toLowerCase())
  );

  const isAtrasado = (c: ContaAPagar) =>
    c.status === 'PENDENTE' && c.dataVencimento && c.dataVencimento.slice(0, 10) < hoje;

  const totalPagar = filtradas.filter((c) => c.status === 'PENDENTE').reduce((s, c) => s + Number(c.valor), 0);
  const atrasados = filtradas.filter(isAtrasado).length;
  const vencendoHoje = filtradas.filter((c) =>
    c.status === 'PENDENTE' && c.dataVencimento?.slice(0, 10) === hoje
  ).length;
  const pagoTotal = filtradas.filter((c) => c.status === 'PAGO').reduce((s, c) => s + Number(c.valor), 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <ArrowUpCircle className="h-6 w-6 text-red-600" />
          <h2 className="text-2xl font-bold text-gray-800">Contas a Pagar</h2>
        </div>
        <Button size="sm" onClick={() => setModalAberto(true)}>
          <Plus className="h-4 w-4 mr-1" /> Nova Conta
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <ArrowUpCircle className="h-4 w-4 text-red-600" />
              <span className="text-xs text-gray-500">Total a Pagar</span>
            </div>
            <p className="text-xl font-bold text-red-700">{formatarMoeda(totalPagar)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-yellow-600" />
              <span className="text-xs text-gray-500">Vencendo Hoje</span>
            </div>
            <p className="text-xl font-bold text-yellow-700">{vencendoHoje}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <span className="text-xs text-gray-500">Atrasados</span>
            </div>
            <p className="text-xl font-bold text-red-700">{atrasados}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-xs text-gray-500">Total Pago</span>
            </div>
            <p className="text-xl font-bold text-green-700">{formatarMoeda(pagoTotal)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <select
          value={statusFiltro}
          onChange={(e) => setStatusFiltro(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
        >
          <option value="">Todos os status</option>
          <option value="PENDENTE">Pendente</option>
          <option value="PAGO">Pago</option>
          <option value="ATRASADO">Atrasado</option>
          <option value="CANCELADO">Cancelado</option>
        </select>
        <select
          value={categoriaFiltro}
          onChange={(e) => setCategoriaFiltro(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
        >
          <option value="">Todas as categorias</option>
          {Object.entries(CATEGORIAS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <div className="relative flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="Buscar por descri\u00e7\u00e3o..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="border border-gray-300 rounded-md pl-3 pr-3 py-1.5 text-sm w-full"
          />
        </div>
      </div>

      {/* Tabela */}
      {carregando ? (
        <p className="text-gray-500">Carregando...</p>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descri\u00e7\u00e3o</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Usina</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>A\u00e7\u00f5es</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtradas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-gray-400 py-6">
                      Nenhuma conta a pagar encontrada
                    </TableCell>
                  </TableRow>
                ) : (
                  filtradas.map((c) => {
                    const atrasado = isAtrasado(c);
                    const badge = atrasado
                      ? { label: 'Atrasado', class: 'bg-red-100 text-red-700' }
                      : STATUS_BADGE[c.status] ?? { label: c.status, class: 'bg-gray-100 text-gray-500' };
                    return (
                      <TableRow key={c.id} className={atrasado ? 'bg-red-50' : ''}>
                        <TableCell className="font-medium max-w-[280px] truncate">{c.descricao}</TableCell>
                        <TableCell>{CATEGORIAS[c.categoria] ?? c.categoria}</TableCell>
                        <TableCell>{c.usina?.nome ?? '\u2014'}</TableCell>
                        <TableCell>{formatarData(c.dataVencimento)}</TableCell>
                        <TableCell className="text-right font-medium text-red-700">
                          {formatarMoeda(Number(c.valor))}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={badge.class}>{badge.label}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {c.status === 'PENDENTE' && (
                              <Button size="sm" variant="outline" onClick={() => marcarPago(c.id)}>
                                <CheckCircle className="h-3.5 w-3.5 mr-1" /> Pagar
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" onClick={() => excluir(c.id)}>
                              <Trash2 className="h-3.5 w-3.5 text-red-500" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Modal nova conta */}
      <Dialog open={modalAberto} onOpenChange={setModalAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Conta a Pagar</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Descri\u00e7\u00e3o</Label>
              <Input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Valor (R$)</Label>
                <Input type="number" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} />
              </div>
              <div>
                <Label>Vencimento</Label>
                <Input type="date" value={form.dataVencimento} onChange={(e) => setForm({ ...form, dataVencimento: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Categoria</Label>
              <select
                value={form.categoria}
                onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              >
                {Object.entries(CATEGORIAS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalAberto(false)}>Cancelar</Button>
            <Button onClick={criarConta} disabled={salvando}>
              {salvando && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
