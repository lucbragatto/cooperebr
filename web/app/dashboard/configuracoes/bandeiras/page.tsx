'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ArrowLeft, Plus, Pencil, Trash2, Loader2, CheckCircle, XCircle, Info, AlertTriangle,
} from 'lucide-react';
import Link from 'next/link';

interface Bandeira {
  id: string;
  tipo: string;
  valorPor100Kwh: number;
  dataInicio: string;
  dataFim: string;
  observacao: string | null;
}

const TIPOS = [
  { value: 'VERDE', label: 'Verde', color: 'bg-green-100 text-green-800' },
  { value: 'AMARELA', label: 'Amarela', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'VERMELHA_P1', label: 'Vermelha P1', color: 'bg-red-100 text-red-800' },
  { value: 'VERMELHA_P2', label: 'Vermelha P2', color: 'bg-red-200 text-red-900' },
];

function tipoBadge(tipo: string) {
  const t = TIPOS.find(x => x.value === tipo);
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${t?.color ?? 'bg-gray-100 text-gray-800'}`}>
      {tipo !== 'VERDE' && <AlertTriangle className="w-3 h-3" />}
      {t?.label ?? tipo}
    </span>
  );
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('pt-BR');
}

function formatBRL(v: number) {
  return `R$ ${v.toFixed(4).replace('.', ',')}`;
}

const cls = 'w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500';

export default function BandeirasPage() {
  const [bandeiras, setBandeiras] = useState<Bandeira[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ tipo: 'sucesso' | 'erro'; msg: string } | null>(null);

  // Modal
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<Bandeira | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState({
    tipo: 'AMARELA',
    valorPor100Kwh: '',
    dataInicio: '',
    dataFim: '',
    observacao: '',
  });

  const showToast = (tipo: 'sucesso' | 'erro', msg: string) => {
    setToast({ tipo, msg });
    setTimeout(() => setToast(null), 3000);
  };

  const carregar = useCallback(async () => {
    try {
      const { data } = await api.get<Bandeira[]>('/bandeiras-tarifarias');
      setBandeiras(data);
    } catch {
      showToast('erro', 'Erro ao carregar bandeiras.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  function abrirNova() {
    setEditando(null);
    setForm({ tipo: 'AMARELA', valorPor100Kwh: '', dataInicio: '', dataFim: '', observacao: '' });
    setModalAberto(true);
  }

  function abrirEditar(b: Bandeira) {
    setEditando(b);
    setForm({
      tipo: b.tipo,
      valorPor100Kwh: String(b.valorPor100Kwh),
      dataInicio: b.dataInicio.slice(0, 10),
      dataFim: b.dataFim.slice(0, 10),
      observacao: b.observacao ?? '',
    });
    setModalAberto(true);
  }

  async function salvar() {
    if (!form.valorPor100Kwh || !form.dataInicio || !form.dataFim) {
      showToast('erro', 'Preencha todos os campos obrigatórios.');
      return;
    }
    setSalvando(true);
    try {
      const payload = {
        tipo: form.tipo,
        valorPor100Kwh: parseFloat(form.valorPor100Kwh),
        dataInicio: form.dataInicio,
        dataFim: form.dataFim,
        observacao: form.observacao || undefined,
      };
      if (editando) {
        await api.put(`/bandeiras-tarifarias/${editando.id}`, payload);
        showToast('sucesso', 'Bandeira atualizada.');
      } else {
        await api.post('/bandeiras-tarifarias', payload);
        showToast('sucesso', 'Bandeira criada.');
      }
      setModalAberto(false);
      carregar();
    } catch {
      showToast('erro', 'Erro ao salvar bandeira.');
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(id: string) {
    if (!confirm('Excluir esta bandeira tarifária?')) return;
    try {
      await api.delete(`/bandeiras-tarifarias/${id}`);
      showToast('sucesso', 'Bandeira excluída.');
      carregar();
    } catch {
      showToast('erro', 'Erro ao excluir bandeira.');
    }
  }

  if (loading) return <div className="p-8 text-gray-400">Carregando bandeiras...</div>;

  return (
    <div className="max-w-4xl space-y-6">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg border text-sm font-medium shadow-lg ${toast.tipo === 'sucesso' ? 'bg-green-50 text-green-800 border-green-200' : 'bg-red-50 text-red-800 border-red-200'}`}>
          {toast.tipo === 'sucesso' ? <CheckCircle className="inline h-4 w-4 mr-2" /> : <XCircle className="inline h-4 w-4 mr-2" />}
          {toast.msg}
        </div>
      )}

      <Link href="/dashboard/motor-proposta/configuracao" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 transition-colors">
        <ArrowLeft className="h-4 w-4" />Voltar para configuração do motor
      </Link>

      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">Bandeiras Tarifárias</h2>
        <Button onClick={abrirNova} size="sm">
          <Plus className="h-4 w-4 mr-2" />Nova Bandeira
        </Button>
      </div>

      <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <span>
          Bandeiras tarifárias adicionam um custo extra por kWh consumido nas cobranças mensais.
          O valor é calculado como: (kWh cobrado / 100) &times; valor da bandeira.
          A bandeira verde não gera cobrança adicional.
        </span>
      </div>

      {/* Grid de bandeiras */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-gray-700">Bandeiras configuradas</CardTitle>
        </CardHeader>
        <CardContent>
          {bandeiras.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">Nenhuma bandeira configurada.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-gray-500">
                    <th className="pb-2 pr-4">Tipo</th>
                    <th className="pb-2 pr-4">Valor / 100 kWh</th>
                    <th className="pb-2 pr-4">Período</th>
                    <th className="pb-2 pr-4">Observação</th>
                    <th className="pb-2 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {bandeiras.map(b => (
                    <tr key={b.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="py-3 pr-4">{tipoBadge(b.tipo)}</td>
                      <td className="py-3 pr-4 font-mono">{formatBRL(Number(b.valorPor100Kwh))}</td>
                      <td className="py-3 pr-4">{formatDate(b.dataInicio)} — {formatDate(b.dataFim)}</td>
                      <td className="py-3 pr-4 text-gray-500 max-w-[200px] truncate">{b.observacao || '—'}</td>
                      <td className="py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => abrirEditar(b)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={() => excluir(b.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal criar/editar */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setModalAberto(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-800">
              {editando ? 'Editar Bandeira' : 'Nova Bandeira Tarifária'}
            </h3>

            <div>
              <Label className="text-xs text-gray-600">Tipo *</Label>
              <select className={cls} value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}>
                {TIPOS.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <div>
              <Label className="text-xs text-gray-600">Valor por 100 kWh (R$) *</Label>
              <Input
                type="number"
                step="0.0001"
                min="0"
                placeholder="Ex: 1.8850"
                value={form.valorPor100Kwh}
                onChange={e => setForm({ ...form, valorPor100Kwh: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-gray-600">Data início *</Label>
                <Input
                  type="date"
                  value={form.dataInicio}
                  onChange={e => setForm({ ...form, dataInicio: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs text-gray-600">Data fim *</Label>
                <Input
                  type="date"
                  value={form.dataFim}
                  onChange={e => setForm({ ...form, dataFim: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label className="text-xs text-gray-600">Observação</Label>
              <textarea
                className={`${cls} resize-none h-16`}
                placeholder="Ex: Bandeira abr/2026 - Resolução ANEEL nº xxx"
                value={form.observacao}
                onChange={e => setForm({ ...form, observacao: e.target.value })}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setModalAberto(false)} disabled={salvando}>
                Cancelar
              </Button>
              <Button onClick={salvar} disabled={salvando}>
                {salvando ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Salvando...</> : editando ? 'Salvar' : 'Criar'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
