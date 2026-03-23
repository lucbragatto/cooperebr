'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Plus, Pencil, Trash2 } from 'lucide-react';

interface PlanoSaas {
  id: string;
  nome: string;
  descricao: string | null;
  taxaSetup: number;
  mensalidadeBase: number;
  limiteMembros: number | null;
  percentualReceita: number;
  ativo: boolean;
  _count?: { cooperativas: number };
}

const emptyForm = {
  nome: '', descricao: '', taxaSetup: '0', mensalidadeBase: '0',
  limiteMembros: '', percentualReceita: '0',
};

export default function PlanosSaasPage() {
  const [planos, setPlanos] = useState<PlanoSaas[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [dialogAberto, setDialogAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  async function carregar() {
    try {
      const { data } = await api.get('/saas/planos');
      setPlanos(data);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => { carregar(); }, []);

  function abrirNovo() {
    setEditandoId(null);
    setForm(emptyForm);
    setErro('');
    setDialogAberto(true);
  }

  function abrirEditar(p: PlanoSaas) {
    setEditandoId(p.id);
    setForm({
      nome: p.nome,
      descricao: p.descricao || '',
      taxaSetup: String(p.taxaSetup),
      mensalidadeBase: String(p.mensalidadeBase),
      limiteMembros: p.limiteMembros != null ? String(p.limiteMembros) : '',
      percentualReceita: String(p.percentualReceita),
    });
    setErro('');
    setDialogAberto(true);
  }

  async function handleSalvar() {
    if (!form.nome.trim()) { setErro('Nome é obrigatório'); return; }
    setSalvando(true);
    setErro('');
    try {
      const payload = {
        nome: form.nome,
        descricao: form.descricao || undefined,
        taxaSetup: Number(form.taxaSetup),
        mensalidadeBase: Number(form.mensalidadeBase),
        limiteMembros: form.limiteMembros ? Number(form.limiteMembros) : null,
        percentualReceita: Number(form.percentualReceita),
      };
      if (editandoId) {
        await api.patch(`/saas/planos/${editandoId}`, payload);
      } else {
        await api.post('/saas/planos', payload);
      }
      setDialogAberto(false);
      carregar();
    } catch (e: any) {
      setErro(e?.response?.data?.message || 'Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  }

  async function handleExcluir(id: string) {
    if (!confirm('Excluir este plano?')) return;
    try {
      await api.delete(`/saas/planos/${id}`);
      carregar();
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Erro ao excluir');
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Planos SaaS</h2>
        <Button onClick={abrirNovo}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Plano
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium text-gray-600">
            {carregando ? 'Carregando...' : `${planos.length} planos`}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Mensalidade</TableHead>
                <TableHead>Taxa Setup</TableHead>
                <TableHead>% Receita</TableHead>
                <TableHead>Limite Membros</TableHead>
                <TableHead>Parceiros</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {planos.length === 0 && !carregando ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-gray-400 py-8">
                    Nenhum plano cadastrado
                  </TableCell>
                </TableRow>
              ) : (
                planos.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.nome}</TableCell>
                    <TableCell>R$ {Number(p.mensalidadeBase).toFixed(2)}</TableCell>
                    <TableCell>R$ {Number(p.taxaSetup).toFixed(2)}</TableCell>
                    <TableCell>{Number(p.percentualReceita).toFixed(2)}%</TableCell>
                    <TableCell>{p.limiteMembros ?? 'Ilimitado'}</TableCell>
                    <TableCell>{p._count?.cooperativas ?? 0}</TableCell>
                    <TableCell>
                      <Badge className={p.ativo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}>
                        {p.ativo ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="sm" onClick={() => abrirEditar(p)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="text-red-500" onClick={() => handleExcluir(p.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editandoId ? 'Editar Plano' : 'Novo Plano SaaS'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Nome *</Label>
              <Input value={form.nome} onChange={(e) => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Starter, Growth" />
            </div>
            <div className="space-y-1">
              <Label>Descrição</Label>
              <Input value={form.descricao} onChange={(e) => setForm(f => ({ ...f, descricao: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Mensalidade Base (R$)</Label>
                <Input type="number" step="0.01" value={form.mensalidadeBase} onChange={(e) => setForm(f => ({ ...f, mensalidadeBase: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Taxa Setup (R$)</Label>
                <Input type="number" step="0.01" value={form.taxaSetup} onChange={(e) => setForm(f => ({ ...f, taxaSetup: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>% sobre Receita</Label>
                <Input type="number" step="0.01" value={form.percentualReceita} onChange={(e) => setForm(f => ({ ...f, percentualReceita: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Limite de Membros</Label>
                <Input type="number" value={form.limiteMembros} onChange={(e) => setForm(f => ({ ...f, limiteMembros: e.target.value }))} placeholder="Vazio = ilimitado" />
              </div>
            </div>
            {erro && <p className="text-sm text-red-600">{erro}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogAberto(false)}>Cancelar</Button>
            <Button onClick={handleSalvar} disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
