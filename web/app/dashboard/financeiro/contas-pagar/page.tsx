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
  ArrowUpCircle, Calendar, CheckCircle, Clock, AlertTriangle, Plus, Search, Loader2,
} from 'lucide-react';

interface Lancamento {
  id: string;
  descricao: string;
  competencia: string;
  dataVencimento: string;
  dataPagamento: string | null;
  valor: number;
  status: string;
  cooperado?: string;
  categoriaNome?: string;
}

interface PlanoContas {
  id: string;
  nome: string;
  tipo: string;
}

function formatarMoeda(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function formatarData(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('pt-BR');
}
function competenciaAtual(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

const STATUS_BADGE: Record<string, { label: string; class: string }> = {
  PREVISTO: { label: 'Previsto', class: 'bg-blue-100 text-blue-700' },
  REALIZADO: { label: 'Pago', class: 'bg-green-100 text-green-700' },
  CANCELADO: { label: 'Cancelado', class: 'bg-gray-100 text-gray-500' },
};

export default function ContasPagarPage() {
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [competencia, setCompetencia] = useState(competenciaAtual());
  const [statusFiltro, setStatusFiltro] = useState('');
  const [busca, setBusca] = useState('');
  const [modalAberto, setModalAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [planoContas, setPlanoContas] = useState<PlanoContas[]>([]);

  const [form, setForm] = useState({
    descricao: '', valor: '', dataVencimento: '', competencia: competenciaAtual(), planoContasId: '',
  });

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const params = new URLSearchParams({ tipo: 'DESPESA' });
      if (competencia) params.set('competencia', competencia);
      if (statusFiltro) params.set('status', statusFiltro);
      const { data } = await api.get(`/financeiro/lancamentos?${params}`);
      setLancamentos(data);
    } catch {
      setLancamentos([]);
    } finally {
      setCarregando(false);
    }
  }, [competencia, statusFiltro]);

  useEffect(() => { carregar(); }, [carregar]);

  useEffect(() => {
    api.get('/financeiro/plano-contas').then(({ data }) => setPlanoContas(data)).catch(() => {});
  }, []);

  async function pagar(id: string) {
    try {
      await api.patch(`/financeiro/lancamentos/${id}/realizar`);
      carregar();
    } catch {
      alert('Erro ao realizar pagamento');
    }
  }

  async function criarLancamento() {
    if (!form.descricao || !form.valor || !form.dataVencimento) return;
    setSalvando(true);
    try {
      await api.post('/financeiro/lancamentos', {
        tipo: 'DESPESA',
        descricao: form.descricao,
        valor: parseFloat(form.valor),
        dataVencimento: form.dataVencimento,
        competencia: form.competencia,
        status: 'PREVISTO',
        planoContasId: form.planoContasId || undefined,
      });
      setModalAberto(false);
      setForm({ descricao: '', valor: '', dataVencimento: '', competencia: competenciaAtual(), planoContasId: '' });
      carregar();
    } catch {
      alert('Erro ao criar lançamento');
    } finally {
      setSalvando(false);
    }
  }

  const hoje = new Date().toISOString().slice(0, 10);
  const em7dias = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const filtrados = lancamentos.filter((l) =>
    !busca || l.descricao?.toLowerCase().includes(busca.toLowerCase())
  );

  const isVencido = (l: Lancamento) => l.status === 'PREVISTO' && l.dataVencimento && l.dataVencimento < hoje;

  const totalPagar = filtrados.filter((l) => l.status === 'PREVISTO').reduce((s, l) => s + Number(l.valor), 0);
  const vencendo7d = filtrados.filter((l) => l.status === 'PREVISTO' && l.dataVencimento >= hoje && l.dataVencimento <= em7dias).length;
  const vencidos = filtrados.filter((l) => isVencido(l)).length;
  const pagoMes = filtrados.filter((l) => l.status === 'REALIZADO').reduce((s, l) => s + Number(l.valor), 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <ArrowUpCircle className="h-6 w-6 text-red-600" />
          <h2 className="text-2xl font-bold text-gray-800">Contas a Pagar</h2>
        </div>
        <Button size="sm" onClick={() => setModalAberto(true)}>
          <Plus className="h-4 w-4 mr-1" /> Novo Lançamento
        </Button>
      </div>

      {/* Cards KPI */}
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
              <span className="text-xs text-gray-500">Vencendo em 7 dias</span>
            </div>
            <p className="text-xl font-bold text-yellow-700">{vencendo7d}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <span className="text-xs text-gray-500">Vencidos</span>
            </div>
            <p className="text-xl font-bold text-red-700">{vencidos}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-xs text-gray-500">Pago no mês</span>
            </div>
            <p className="text-xl font-bold text-green-700">{formatarMoeda(pagoMes)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          type="month"
          value={competencia}
          onChange={(e) => setCompetencia(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
        />
        <select
          value={statusFiltro}
          onChange={(e) => setStatusFiltro(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
        >
          <option value="">Todos os status</option>
          <option value="PREVISTO">Previsto</option>
          <option value="REALIZADO">Pago</option>
          <option value="CANCELADO">Cancelado</option>
        </select>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por descrição..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="border border-gray-300 rounded-md pl-9 pr-3 py-1.5 text-sm w-full"
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
                  <TableHead>Fornecedor / Descrição</TableHead>
                  <TableHead>Competência</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtrados.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-gray-400 py-6">
                      Nenhum lançamento encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filtrados.map((l) => {
                    const vencido = isVencido(l);
                    const badge = vencido
                      ? { label: 'Vencido', class: 'bg-red-100 text-red-700' }
                      : STATUS_BADGE[l.status] ?? { label: l.status, class: 'bg-gray-100 text-gray-500' };
                    return (
                      <TableRow key={l.id} className={vencido ? 'bg-red-50' : ''}>
                        <TableCell className="font-medium max-w-[280px] truncate">{l.descricao}</TableCell>
                        <TableCell>{l.competencia}</TableCell>
                        <TableCell>{formatarData(l.dataVencimento)}</TableCell>
                        <TableCell className="text-right font-medium text-red-700">
                          {formatarMoeda(Number(l.valor))}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={badge.class}>{badge.label}</Badge>
                        </TableCell>
                        <TableCell>
                          {l.status === 'PREVISTO' && (
                            <Button size="sm" variant="outline" onClick={() => pagar(l.id)}>
                              <CheckCircle className="h-3.5 w-3.5 mr-1" /> Pagar
                            </Button>
                          )}
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

      {/* Modal novo lançamento */}
      <Dialog open={modalAberto} onOpenChange={setModalAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Lançamento — Despesa</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Fornecedor / Descrição</Label>
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Competência</Label>
                <Input type="month" value={form.competencia} onChange={(e) => setForm({ ...form, competencia: e.target.value })} />
              </div>
              <div>
                <Label>Categoria</Label>
                <select
                  value={form.planoContasId}
                  onChange={(e) => setForm({ ...form, planoContasId: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                >
                  <option value="">Selecionar...</option>
                  {planoContas.filter((p) => p.tipo === 'DESPESA').map((p) => (
                    <option key={p.id} value={p.id}>{p.nome}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalAberto(false)}>Cancelar</Button>
            <Button onClick={criarLancamento} disabled={salvando}>
              {salvando && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
