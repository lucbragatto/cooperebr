'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import type { Contrato } from '@/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Eye, Pencil, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { useTipoParceiro } from '@/hooks/useTipoParceiro';

const statusClasses: Record<string, string> = {
  PENDENTE_ATIVACAO: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  EM_APROVACAO: 'bg-blue-100 text-blue-700 border-blue-200',
  AGUARDANDO_ASSINATURA: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  ASSINATURA_SOLICITADA: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  APROVADO: 'bg-teal-100 text-teal-700 border-teal-200',
  ATIVO: 'bg-green-100 text-green-800 border-green-200',
  SUSPENSO: 'bg-orange-100 text-orange-800 border-orange-200',
  ENCERRADO: 'bg-red-100 text-red-800 border-red-200',
  LISTA_ESPERA: 'bg-purple-100 text-purple-800 border-purple-200',
};

const statusLabel: Record<string, string> = {
  PENDENTE_ATIVACAO: 'Pendente Ativação',
  EM_APROVACAO: 'Em Aprovação',
  AGUARDANDO_ASSINATURA: 'Aguard. Assinatura',
  ASSINATURA_SOLICITADA: 'Assinatura Solicitada',
  APROVADO: 'Aprovado',
  ATIVO: 'Ativo',
  SUSPENSO: 'Suspenso',
  ENCERRADO: 'Encerrado',
  LISTA_ESPERA: 'Lista de Espera',
};

export default function ContratosPage() {
  const { tipoMembro } = useTipoParceiro();
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [excluindo, setExcluindo] = useState<string | null>(null);
  const [dialogAberto, setDialogAberto] = useState(false);
  const [erro, setErro] = useState('');
  const [filtroReajuste, setFiltroReajuste] = useState(false);

  useEffect(() => {
    api.get<Contrato[]>('/contratos')
      .then((r) => setContratos(r.data))
      .finally(() => setCarregando(false));
  }, []);

  async function handleExcluir() {
    if (!excluindo) return;
    try {
      await api.delete(`/contratos/${excluindo}`);
      setContratos((prev) => prev.filter((c) => c.id !== excluindo));
      setDialogAberto(false);
      setExcluindo(null);
      setErro('');
    } catch (e: any) {
      setErro(e?.response?.data?.message || 'Erro ao excluir.');
    }
  }

  const trintaDiasAtras = new Date();
  trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);
  const contratosFiltrados = filtroReajuste
    ? contratos.filter((c: any) => c.ultimoReajusteEm && new Date(c.ultimoReajusteEm) >= trintaDiasAtras)
    : contratos;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Contratos</h2>
        <div className="flex items-center gap-2">
          <Button
            variant={filtroReajuste ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFiltroReajuste(!filtroReajuste)}
          >
            Reajustados recentemente
          </Button>
          <Link href="/dashboard/contratos/novo">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Novo Contrato
            </Button>
          </Link>
        </div>
      </div>

      {erro && <p className="text-sm text-red-500 mb-4">{erro}</p>}

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium text-gray-600">
            {carregando ? 'Carregando...' : `${contratos.length} registros`}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>{tipoMembro}</TableHead>
                <TableHead>UC</TableHead>
                <TableHead>Usina</TableHead>
                <TableHead>Desconto (%)</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data Início</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {carregando ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <TableCell key={j}>
                        <div className="h-4 bg-gray-200 animate-pulse rounded w-3/4" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : contratos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-gray-400 py-8">
                    Nenhum contrato cadastrado
                  </TableCell>
                </TableRow>
              ) : (
                contratosFiltrados.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.numero}</TableCell>
                    <TableCell>{c.cooperado?.nomeCompleto ?? '—'}</TableCell>
                    <TableCell>{c.uc?.numero ?? '—'}</TableCell>
                    <TableCell>{c.usina?.nome ?? '—'}</TableCell>
                    <TableCell>{c.percentualDesconto}%</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Badge className={statusClasses[c.status]}>
                          {statusLabel[c.status]}
                        </Badge>
                        {(c as any).ultimoReajusteEm && new Date((c as any).ultimoReajusteEm) >= trintaDiasAtras && (
                          <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px]">Reajustado</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {new Date(c.dataInicio).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Link href={`/dashboard/contratos/${c.id}`}>
                        <Button variant="ghost" size="sm"><Eye className="h-4 w-4" /></Button>
                      </Link>
                      <Link href={`/dashboard/contratos/${c.id}`}>
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
                ))
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
              Tem certeza que deseja excluir este contrato? Esta ação não pode ser desfeita.
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
