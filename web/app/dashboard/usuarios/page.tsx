'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import { getUsuario } from '@/lib/auth';
import type { Usuario } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Pencil, KeyRound, Trash2 } from 'lucide-react';

type UsuarioLista = {
  id: string;
  nome: string;
  email: string;
  telefone?: string | null;
  perfil: string;
  cooperativaId: string | null;
  ativo: boolean;
  createdAt: string;
};

const perfilLabels: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  OPERADOR: 'Operador',
  COOPERADO: 'Cooperado',
};

const perfilColors: Record<string, string> = {
  SUPER_ADMIN: 'bg-purple-100 text-purple-800',
  ADMIN: 'bg-blue-100 text-blue-800',
  OPERADOR: 'bg-yellow-100 text-yellow-800',
  COOPERADO: 'bg-green-100 text-green-800',
};

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<UsuarioLista[]>([]);
  const [filtroPerfil, setFiltroPerfil] = useState('TODOS');
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<UsuarioLista | null>(null);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const currentUser = getUsuario();
  const isSuperAdmin = currentUser?.perfil === 'SUPER_ADMIN';

  // Form state
  const [formNome, setFormNome] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formSenha, setFormSenha] = useState('');
  const [formPerfil, setFormPerfil] = useState('OPERADOR');
  const [formCooperativaId, setFormCooperativaId] = useState('');
  const [formAtivo, setFormAtivo] = useState(true);

  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean; title: string; description: string; action?: () => void;
  }>({ open: false, title: '', description: '' });

  // Reset senha dialog state (canal)
  const [resetDialog, setResetDialog] = useState<{
    open: boolean; usuario: UsuarioLista | null; enviando: boolean;
  }>({ open: false, usuario: null, enviando: false });

  // Cooperativas for SUPER_ADMIN
  const [cooperativas, setCooperativas] = useState<{ id: string; nome: string }[]>([]);

  const buscarUsuarios = useCallback(async () => {
    try {
      const { data } = await api.get<UsuarioLista[]>('/auth/usuarios');
      setUsuarios(data);
    } catch {
      // silently ignore
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    buscarUsuarios();
  }, [buscarUsuarios]);

  useEffect(() => {
    if (isSuperAdmin) {
      api.get<{ id: string; nome: string }[]>('/cooperativas').then(({ data }) => {
        setCooperativas(data);
      }).catch(() => {});
    }
  }, [isSuperAdmin]);

  function abrirCriar() {
    setEditando(null);
    setFormNome('');
    setFormEmail('');
    setFormSenha('');
    setFormPerfil('OPERADOR');
    setFormCooperativaId('');
    setFormAtivo(true);
    setErro('');
    setModalAberto(true);
  }

  function abrirEditar(u: UsuarioLista) {
    setEditando(u);
    setFormNome(u.nome);
    setFormEmail(u.email);
    setFormSenha('');
    setFormPerfil(u.perfil);
    setFormCooperativaId(u.cooperativaId || '');
    setFormAtivo(u.ativo);
    setErro('');
    setModalAberto(true);
  }

  async function handleSalvar() {
    setErro('');
    if (!editando && formSenha.length < 8) {
      setErro('A senha deve ter pelo menos 8 caracteres.');
      return;
    }
    setSalvando(true);
    try {
      if (editando) {
        await api.put(`/auth/usuarios/${editando.id}`, {
          nome: formNome,
          email: formEmail,
          perfil: formPerfil,
          ativo: formAtivo,
        });
      } else {
        await api.post('/auth/criar-usuario', {
          nome: formNome,
          email: formEmail,
          senha: formSenha,
          perfil: formPerfil,
          ...(formCooperativaId ? { cooperativaId: formCooperativaId } : {}),
        });
      }
      setModalAberto(false);
      buscarUsuarios();
    } catch (err: any) {
      setErro(err?.response?.data?.message || 'Erro ao salvar usuário.');
    } finally {
      setSalvando(false);
    }
  }

  function handleResetSenha(u: UsuarioLista) {
    setResetDialog({ open: true, usuario: u, enviando: false });
  }

  async function enviarResetPorCanal(canal: 'whatsapp' | 'email') {
    const u = resetDialog.usuario;
    if (!u) return;
    setResetDialog((prev) => ({ ...prev, enviando: true }));
    try {
      if (canal === 'whatsapp') {
        await api.post('/auth/esqueci-senha-whatsapp', { identificador: u.telefone || u.email });
      } else {
        await api.post('/auth/esqueci-senha', { email: u.email });
      }
      setResetDialog({ open: false, usuario: null, enviando: false });
      setConfirmDialog({ open: true, title: 'Enviado!', description: `Link de redefinição enviado por ${canal === 'whatsapp' ? 'WhatsApp' : 'email'}.` });
    } catch {
      setResetDialog({ open: false, usuario: null, enviando: false });
      setConfirmDialog({ open: true, title: 'Erro', description: 'Não foi possível enviar o link de redefinição.' });
    }
  }

  function handleDeletar(u: UsuarioLista) {
    setConfirmDialog({
      open: true,
      title: 'Excluir usuário',
      description: `Tem certeza que deseja excluir o usuário ${u.nome}? Esta ação não pode ser desfeita.`,
      action: async () => {
        try {
          await api.delete(`/auth/usuarios/${u.id}`);
          buscarUsuarios();
        } catch {
          setConfirmDialog({ open: true, title: 'Erro', description: 'Erro ao excluir usuário.' });
        }
      },
    });
  }

  const usuariosFiltrados = filtroPerfil === 'TODOS'
    ? usuarios
    : usuarios.filter((u) => u.perfil === filtroPerfil);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Usuários</h1>
        <Button onClick={abrirCriar} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo usuário
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Lista de Usuários</CardTitle>
            <Select value={filtroPerfil} onValueChange={setFiltroPerfil}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TODOS">Todos os perfis</SelectItem>
                <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
                <SelectItem value="ADMIN">Admin</SelectItem>
                <SelectItem value="OPERADOR">Operador</SelectItem>
                <SelectItem value="COOPERADO">Cooperado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {carregando ? (
            <p className="text-sm text-gray-500 py-8 text-center">Carregando...</p>
          ) : usuariosFiltrados.length === 0 ? (
            <p className="text-sm text-gray-500 py-8 text-center">Nenhum usuário encontrado.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Perfil</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data criação</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usuariosFiltrados.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.nome}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>
                      <Badge className={perfilColors[u.perfil] || ''} variant="secondary">
                        {perfilLabels[u.perfil] || u.perfil}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={u.ativo ? 'default' : 'destructive'}>
                        {u.ativo ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell>{new Date(u.createdAt).toLocaleDateString('pt-BR')}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => abrirEditar(u)} title="Editar">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleResetSenha(u)} title="Redefinir senha">
                          <KeyRound className="h-4 w-4" />
                        </Button>
                        {isSuperAdmin && (
                          <Button variant="ghost" size="sm" onClick={() => handleDeletar(u)} title="Excluir" className="text-red-600 hover:text-red-700">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Modal Criar / Editar */}
      <Dialog open={modalAberto} onOpenChange={setModalAberto}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editando ? 'Editar Usuário' : 'Novo Usuário'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Nome</Label>
              <Input value={formNome} onChange={(e) => setFormNome(e.target.value)} />
            </div>

            <div className="space-y-1">
              <Label>Email</Label>
              <Input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} />
            </div>

            {!editando && (
              <div className="space-y-1">
                <Label>Senha</Label>
                <Input
                  type="password"
                  placeholder="Mínimo 8 caracteres"
                  value={formSenha}
                  onChange={(e) => setFormSenha(e.target.value)}
                />
              </div>
            )}

            <div className="space-y-1">
              <Label>Perfil</Label>
              <Select value={formPerfil} onValueChange={setFormPerfil}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent style={{ zIndex: 9999 }}>
                  {isSuperAdmin && <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>}
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="OPERADOR">Operador</SelectItem>
                  <SelectItem value="COOPERADO">Cooperado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isSuperAdmin && !editando && cooperativas.length > 0 && (
              <div className="space-y-1">
                <Label>Parceiro</Label>
                <Select value={formCooperativaId} onValueChange={setFormCooperativaId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent className="w-[--radix-select-trigger-width] max-w-none" style={{ zIndex: 9999 }}>
                    {cooperativas.map((c) => (
                      <SelectItem key={c.id} value={c.id} className="whitespace-normal break-words">{c.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {editando && (
              <div className="flex items-center gap-2">
                <Label>Ativo</Label>
                <input
                  type="checkbox"
                  checked={formAtivo}
                  onChange={(e) => setFormAtivo(e.target.checked)}
                  className="rounded border-gray-300"
                />
              </div>
            )}

            {erro && <p className="text-sm text-red-600">{erro}</p>}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalAberto(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSalvar} disabled={salvando}>
              {salvando ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de escolha de canal para redefinição de senha */}
      <Dialog open={resetDialog.open} onOpenChange={(open) => !open && setResetDialog({ open: false, usuario: null, enviando: false })}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Redefinir senha</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <p className="text-sm text-gray-600">Como deseja enviar o link de redefinição para <strong>{resetDialog.usuario?.nome}</strong>?</p>
            {resetDialog.usuario?.telefone && (
              <Button
                className="w-full gap-2 bg-green-600 hover:bg-green-700"
                onClick={() => enviarResetPorCanal('whatsapp')}
                disabled={resetDialog.enviando}
              >
                📱 Enviar pelo WhatsApp
                <span className="text-xs opacity-80">({resetDialog.usuario.telefone})</span>
              </Button>
            )}
            {resetDialog.usuario?.email && (
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={() => enviarResetPorCanal('email')}
                disabled={resetDialog.enviando}
              >
                ✉️ Enviar por Email
                <span className="text-xs text-gray-500">({resetDialog.usuario.email})</span>
              </Button>
            )}
            {!resetDialog.usuario?.telefone && !resetDialog.usuario?.email && (
              <p className="text-sm text-red-600">Usuário sem WhatsApp ou email cadastrado.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setResetDialog({ open: false, usuario: null, enviando: false })}>
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmação (substitui alert/confirm nativos) */}
      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => !open && setConfirmDialog((prev) => ({ ...prev, open: false }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmDialog.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{confirmDialog.action ? 'Cancelar' : 'OK'}</AlertDialogCancel>
            {confirmDialog.action && (
              <AlertDialogAction onClick={() => { confirmDialog.action!(); setConfirmDialog((prev) => ({ ...prev, open: false })); }}>
                Confirmar
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
