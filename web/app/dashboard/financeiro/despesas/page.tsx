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
  ClipboardList, Plus, CheckCircle, Calendar, Loader2, Repeat, Ban,
} from 'lucide-react';

interface PlanoContas {
  id: string;
  nome: string;
  tipo: string;
}

interface DespesaCorrente {
  id: string;
  descricao: string;
  valor: number;
  dataVencimento: string;
  competencia: string;
  status: string;
  categoriaNome?: string;
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

export default function DespesasCorrentesPage() {
  const [despesas, setDespesas] = useState<DespesaCorrente[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [planoContas, setPlanoContas] = useState<PlanoContas[]>([]);
  const [modalAberto, setModalAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const [form, setForm] = useState({
    descricao: '',
    valor: '',
    diaVencimento: '10',
    frequencia: 'mensal' as 'mensal' | 'unica',
    planoContasId: '',
  });

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const { data } = await api.get('/financeiro/lancamentos?tipo=DESPESA');
      setDespesas(data);
    } catch {
      setDespesas([]);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  useEffect(() => {
    api.get('/financeiro/plano-contas').then(({ data }) => setPlanoContas(data)).catch(() => {});
  }, []);

  async function lancarAgora() {
    if (!form.descricao || !form.valor) return;
    setSalvando(true);
    try {
      const comp = competenciaAtual();
      const [ano, mes] = comp.split('-');
      const dia = String(Math.min(parseInt(form.diaVencimento) || 10, 28)).padStart(2, '0');
      const dataVencimento = `${ano}-${mes}-${dia}`;

      await api.post('/financeiro/lancamentos', {
        tipo: 'DESPESA',
        descricao: form.descricao,
        valor: parseFloat(form.valor),
        dataVencimento,
        competencia: comp,
        status: 'PREVISTO',
        planoContasId: form.planoContasId || undefined,
      });

      // Se mensal, lançar também para próximos 2 meses
      if (form.frequencia === 'mensal') {
        for (let i = 1; i <= 2; i++) {
          const d = new Date(parseInt(ano), parseInt(mes) - 1 + i, 1);
          const compFut = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          const dataVenc = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${dia}`;
          await api.post('/financeiro/lancamentos', {
            tipo: 'DESPESA',
            descricao: form.descricao,
            valor: parseFloat(form.valor),
            dataVencimento: dataVenc,
            competencia: compFut,
            status: 'PREVISTO',
            planoContasId: form.planoContasId || undefined,
          });
        }
      }

      setModalAberto(false);
      setForm({ descricao: '', valor: '', diaVencimento: '10', frequencia: 'mensal', planoContasId: '' });
      carregar();
    } catch {
      alert('Erro ao criar despesa');
    } finally {
      setSalvando(false);
    }
  }

  async function realizarDespesa(id: string) {
    try {
      await api.patch(`/financeiro/lancamentos/${id}/realizar`);
      carregar();
    } catch {
      alert('Erro ao confirmar pagamento');
    }
  }

  async function cancelarDespesa(id: string) {
    try {
      await api.patch(`/financeiro/lancamentos/${id}/cancelar`);
      carregar();
    } catch {
      alert('Erro ao cancelar');
    }
  }

  const hoje = new Date().toISOString().slice(0, 10);
  const previstas = despesas.filter((d) => d.status === 'PREVISTO');
  const totalPrevisto = previstas.reduce((s, d) => s + Number(d.valor), 0);
  const totalPago = despesas.filter((d) => d.status === 'REALIZADO').reduce((s, d) => s + Number(d.valor), 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <ClipboardList className="h-6 w-6 text-orange-600" />
          <h2 className="text-2xl font-bold text-gray-800">Despesas Correntes</h2>
        </div>
        <Button size="sm" onClick={() => setModalAberto(true)}>
          <Plus className="h-4 w-4 mr-1" /> Nova Despesa
        </Button>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="h-4 w-4 text-orange-600" />
              <span className="text-xs text-gray-500">Total Previsto</span>
            </div>
            <p className="text-xl font-bold text-orange-700">{formatarMoeda(totalPrevisto)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-xs text-gray-500">Total Pago</span>
            </div>
            <p className="text-xl font-bold text-green-700">{formatarMoeda(totalPago)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <ClipboardList className="h-4 w-4 text-blue-600" />
              <span className="text-xs text-gray-500">Despesas Cadastradas</span>
            </div>
            <p className="text-xl font-bold text-blue-700">{despesas.length}</p>
          </CardContent>
        </Card>
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
                  <TableHead>Descrição</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {despesas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-gray-400 py-6">
                      Nenhuma despesa cadastrada
                    </TableCell>
                  </TableRow>
                ) : (
                  despesas.map((d) => {
                    const vencido = d.status === 'PREVISTO' && d.dataVencimento < hoje;
                    return (
                      <TableRow key={d.id} className={vencido ? 'bg-red-50' : ''}>
                        <TableCell className="font-medium">{d.descricao}</TableCell>
                        <TableCell>
                          <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">{d.categoriaNome || '—'}</span>
                        </TableCell>
                        <TableCell>{formatarData(d.dataVencimento)}</TableCell>
                        <TableCell className="text-right font-medium text-red-700">
                          {formatarMoeda(Number(d.valor))}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={
                            vencido ? 'bg-red-100 text-red-700' :
                            d.status === 'PREVISTO' ? 'bg-blue-100 text-blue-700' :
                            d.status === 'REALIZADO' ? 'bg-green-100 text-green-700' :
                            'bg-gray-100 text-gray-500'
                          }>
                            {vencido ? 'Vencido' : d.status === 'PREVISTO' ? 'Previsto' : d.status === 'REALIZADO' ? 'Pago' : d.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {d.status === 'PREVISTO' && (
                            <div className="flex gap-1">
                              <Button size="sm" variant="outline" onClick={() => realizarDespesa(d.id)}>
                                <CheckCircle className="h-3.5 w-3.5 mr-1" /> Pagar
                              </Button>
                              <Button size="sm" variant="ghost" className="text-gray-400" onClick={() => cancelarDespesa(d.id)}>
                                <Ban className="h-3.5 w-3.5" />
                              </Button>
                            </div>
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

      {/* Modal nova despesa */}
      <Dialog open={modalAberto} onOpenChange={setModalAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Despesa Corrente</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Descrição</Label>
              <Input placeholder="Ex: Aluguel, Salários, Manutenção..." value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Valor (R$)</Label>
                <Input type="number" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} />
              </div>
              <div>
                <Label>Dia de Vencimento</Label>
                <Input type="number" min="1" max="28" value={form.diaVencimento} onChange={(e) => setForm({ ...form, diaVencimento: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Frequência</Label>
                <select
                  value={form.frequencia}
                  onChange={(e) => setForm({ ...form, frequencia: e.target.value as 'mensal' | 'unica' })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                >
                  <option value="mensal">Mensal (lança 3 meses)</option>
                  <option value="unica">Única</option>
                </select>
              </div>
              <div>
                <Label>Categoria (Plano de Contas)</Label>
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
            {form.frequencia === 'mensal' && (
              <p className="text-xs text-gray-500 flex items-center gap-1">
                <Repeat className="h-3 w-3" /> Será lançado para o mês atual e os 2 meses seguintes
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalAberto(false)}>Cancelar</Button>
            <Button onClick={lancarAgora} disabled={salvando}>
              {salvando && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Lançar Agora
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
