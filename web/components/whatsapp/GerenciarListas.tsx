'use client';

import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Edit2, Loader2, Plus, Send, Trash2, X,
} from 'lucide-react';

interface ListaContatos {
  id: string;
  nome: string;
  descricao: string | null;
  telefones: string[];
  cooperadoIds: string[];
  createdAt: string;
}

interface GerenciarListasProps {
  onUsarNoDisparo?: (telefones: string[], nomeLista: string) => void;
}

export default function GerenciarListas({ onUsarNoDisparo }: GerenciarListasProps) {
  const [listas, setListas] = useState<ListaContatos[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);

  // Form state
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [telefoneInput, setTelefoneInput] = useState('');
  const [telefones, setTelefones] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);

  const fetchListas = useCallback(async () => {
    try {
      const { data } = await api.get<ListaContatos[]>('/whatsapp/listas');
      setListas(data);
    } catch {
      setListas([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchListas();
  }, [fetchListas]);

  function abrirNova() {
    setEditandoId(null);
    setNome('');
    setDescricao('');
    setTelefones([]);
    setModalAberto(true);
  }

  function abrirEdicao(lista: ListaContatos) {
    setEditandoId(lista.id);
    setNome(lista.nome);
    setDescricao(lista.descricao ?? '');
    setTelefones(lista.telefones);
    setModalAberto(true);
  }

  function adicionarTelefone() {
    const tel = telefoneInput.replace(/\D/g, '').trim();
    if (tel.length >= 10 && !telefones.includes(tel)) {
      setTelefones((prev) => [...prev, tel]);
      setTelefoneInput('');
    }
  }

  function removerTelefone(tel: string) {
    setTelefones((prev) => prev.filter((t) => t !== tel));
  }

  async function salvar() {
    if (!nome.trim()) return;
    setSalvando(true);
    try {
      const payload = { nome: nome.trim(), descricao: descricao.trim() || undefined, telefones };
      if (editandoId) {
        await api.put(`/whatsapp/listas/${editandoId}`, payload);
      } else {
        await api.post('/whatsapp/listas', payload);
      }
      setModalAberto(false);
      await fetchListas();
    } catch {
      // silently fail
    } finally {
      setSalvando(false);
    }
  }

  async function deletar(id: string) {
    if (!confirm('Tem certeza que deseja excluir esta lista?')) return;
    try {
      await api.delete(`/whatsapp/listas/${id}`);
      await fetchListas();
    } catch {
      // silently fail
    }
  }

  async function usarNoDisparo(lista: ListaContatos) {
    if (onUsarNoDisparo) {
      onUsarNoDisparo(lista.telefones, lista.nome);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">{listas.length} lista(s) salva(s)</p>
        <Button onClick={abrirNova} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Nova lista
        </Button>
      </div>

      {listas.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-8">Nenhuma lista criada.</p>
      ) : (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Nome</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Descrição</th>
                <th className="text-center px-3 py-2 text-xs font-medium text-gray-500 w-20">Contatos</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 w-28">Criada em</th>
                <th className="text-center px-3 py-2 text-xs font-medium text-gray-500 w-32">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {listas.map((lista) => (
                <tr key={lista.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-3 py-2 font-medium text-gray-800">{lista.nome}</td>
                  <td className="px-3 py-2 text-gray-500 text-xs max-w-[200px] truncate">
                    {lista.descricao ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className="bg-green-50 text-green-700 text-xs px-2 py-0.5 rounded-full font-medium">
                      {lista.telefones.length}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500">
                    {new Date(lista.createdAt).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-center gap-1">
                      {onUsarNoDisparo && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => usarNoDisparo(lista)}
                          title="Usar no disparo"
                          className="text-green-600 hover:text-green-700"
                        >
                          <Send className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => abrirEdicao(lista)}
                        title="Editar"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deletar(lista.id)}
                        title="Excluir"
                        className="text-red-500 hover:text-red-700"
                      >
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

      {/* Modal Nova/Editar Lista */}
      <Dialog open={modalAberto} onOpenChange={setModalAberto}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{editandoId ? 'Editar lista' : 'Nova lista'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nome *</label>
              <Input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Cooperados região norte"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Descrição</label>
              <Input
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Descrição opcional"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Telefones</label>
              <div className="flex gap-2">
                <Input
                  value={telefoneInput}
                  onChange={(e) => setTelefoneInput(e.target.value)}
                  placeholder="(27) 99999-0000"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      adicionarTelefone();
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={adicionarTelefone}
                  disabled={telefoneInput.replace(/\D/g, '').length < 10}
                  className="shrink-0"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {telefones.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2 max-h-32 overflow-y-auto">
                  {telefones.map((tel) => (
                    <span
                      key={tel}
                      className="inline-flex items-center gap-1 bg-green-50 text-green-700 text-xs px-2 py-1 rounded-full border border-green-200"
                    >
                      {tel.replace(/(\d{2})(\d{2})(\d{5})(\d{4})/, '+$1 ($2) $3-$4')}
                      <button
                        type="button"
                        onClick={() => removerTelefone(tel)}
                        className="text-green-500 hover:text-red-500 transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <p className="text-[10px] text-gray-400 mt-1">{telefones.length} telefone(s)</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setModalAberto(false)}>Cancelar</Button>
            <Button onClick={salvar} disabled={salvando || !nome.trim()}>
              {salvando ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              {editandoId ? 'Salvar' : 'Criar lista'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
