'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, Eye } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

const BADGE_TIPO: Record<string, { label: string; icone: string }> = {
  COOPERATIVA: { label: 'Cooperativa', icone: '🏢' },
  CONSORCIO: { label: 'Consórcio', icone: '🤝' },
  ASSOCIACAO: { label: 'Associação', icone: '🏛️' },
  CONDOMINIO: { label: 'Condomínio', icone: '🏘️' },
};

interface Cooperativa {
  id: string;
  nome: string;
  cnpj: string;
  email: string | null;
  telefone: string | null;
  cidade: string | null;
  estado: string | null;
  ativo: boolean;
  tipoParceiro: string;
  tipoMembro: string;
  tipoMembroPlural: string;
  qtdUsinas: number;
  qtdCooperados: number;
}

export default function CooperativasPage() {
  const [cooperativas, setCooperativas] = useState<Cooperativa[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [excluindo, setExcluindo] = useState<string | null>(null);
  const [dialogAberto, setDialogAberto] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    api.get<Cooperativa[]>('/cooperativas')
      .then((r) => setCooperativas(r.data))
      .finally(() => setCarregando(false));
  }, []);

  async function handleExcluir() {
    if (!excluindo) return;
    try {
      await api.delete(`/cooperativas/${excluindo}`);
      setCooperativas((prev) => prev.filter((c) => c.id !== excluindo));
      setDialogAberto(false);
      setExcluindo(null);
    } catch (e: any) {
      setErro(e?.response?.data?.message || 'Erro ao excluir.');
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Parceiros</h2>
        <Link href="/dashboard/cooperativas/nova">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Novo Parceiro
          </Button>
        </Link>
      </div>

      {erro && <p className="text-sm text-red-500 mb-4">{erro}</p>}

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium text-gray-600">
            {carregando ? 'Carregando...' : `${cooperativas.length} registros`}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>CNPJ</TableHead>
                <TableHead>Cidade/UF</TableHead>
                <TableHead>Usinas</TableHead>
                <TableHead>Membros Ativos</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {carregando ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <TableCell key={j}>
                        <div className="h-4 bg-gray-200 animate-pulse rounded w-3/4" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : cooperativas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-gray-400 py-8">
                    Nenhum parceiro cadastrado
                  </TableCell>
                </TableRow>
              ) : (
                cooperativas.map((c) => {
                  const badge = BADGE_TIPO[c.tipoParceiro] || { label: c.tipoParceiro, icone: '👤' };
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.nome}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="gap-1">
                          <span>{badge.icone}</span> {badge.label}
                        </Badge>
                      </TableCell>
                      <TableCell>{c.cnpj}</TableCell>
                      <TableCell>{c.cidade ? `${c.cidade}/${c.estado}` : '—'}</TableCell>
                      <TableCell>{c.qtdUsinas}</TableCell>
                      <TableCell>{c.qtdCooperados}</TableCell>
                      <TableCell className="text-right space-x-1">
                        <Link href={`/dashboard/cooperativas/${c.id}`}>
                          <Button variant="ghost" size="sm"><Eye className="h-4 w-4" /></Button>
                        </Link>
                        <Link href={`/dashboard/cooperativas/${c.id}/editar`}>
                          <Button variant="ghost" size="sm"><Pencil className="h-4 w-4" /></Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-500 hover:text-red-700"
                          onClick={() => { setExcluindo(c.id); setDialogAberto(true); setErro(''); }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar exclusão</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir este parceiro? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          {erro && <p className="text-sm text-red-500">{erro}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogAberto(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleExcluir}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
