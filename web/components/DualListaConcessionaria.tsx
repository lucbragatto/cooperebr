'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Copy, Download, Loader2 } from 'lucide-react';

interface DualListaProps {
  usinaOrigemId: string;
  usinaDestinoId: string;
  onClose: () => void;
}

interface MembroLista {
  nomeCompleto: string;
  cpf: string;
  numeroUC: string;
  kwhContratado: number;
  percentualUsina: number;
  acao?: string;
}

interface DualListaData {
  origem: { usinaNome: string; cooperados: MembroLista[] };
  destino: { usinaNome: string; cooperados: MembroLista[] };
}

function copiarTexto(membros: MembroLista[], usinaNome: string) {
  const linhas = membros.map(
    (m) => `${m.nomeCompleto}\t${m.cpf}\t${m.numeroUC}\t${m.kwhContratado}\t${m.percentualUsina}%`
  );
  const texto = `Usina: ${usinaNome}\nNome\tCPF\tUC\tkWh\t%\n${linhas.join('\n')}`;
  navigator.clipboard.writeText(texto);
}

function baixarCSV(membros: MembroLista[], usinaNome: string) {
  const header = 'Nome,CPF,UC,kWh Contratado,% Usina';
  const rows = membros.map(
    (m) => `"${m.nomeCompleto}","${m.cpf}","${m.numeroUC}",${m.kwhContratado},${m.percentualUsina}`
  );
  const csv = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `lista-${usinaNome.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function CardLista({ titulo, membros }: { titulo: string; membros: MembroLista[] }) {
  return (
    <Card className="flex-1 min-w-0">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between gap-2">
          <span className="truncate">{titulo}</span>
          <div className="flex gap-1 shrink-0">
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => copiarTexto(membros, titulo)}>
              <Copy className="h-3 w-3 mr-1" /> Copiar
            </Button>
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => baixarCSV(membros, titulo)}>
              <Download className="h-3 w-3 mr-1" /> CSV
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Nome</TableHead>
              <TableHead className="text-xs">CPF</TableHead>
              <TableHead className="text-xs">UC</TableHead>
              <TableHead className="text-xs">kWh</TableHead>
              <TableHead className="text-xs">%</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {membros.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-gray-400 py-4 text-xs">
                  Nenhum membro
                </TableCell>
              </TableRow>
            ) : (
              membros.map((m, i) => (
                <TableRow key={i}>
                  <TableCell className="text-xs font-medium">{m.nomeCompleto}</TableCell>
                  <TableCell className="text-xs">{m.cpf}</TableCell>
                  <TableCell className="text-xs">{m.numeroUC}</TableCell>
                  <TableCell className="text-xs">{m.kwhContratado}</TableCell>
                  <TableCell className="text-xs">{m.percentualUsina}%</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export default function DualListaConcessionaria({ usinaOrigemId, usinaDestinoId, onClose }: DualListaProps) {
  const [dados, setDados] = useState<DualListaData | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => {
    api.get(`/migracoes-usina/dual-lista?usinaOrigemId=${usinaOrigemId}&usinaDestinoId=${usinaDestinoId}`)
      .then((r) => setDados(r.data))
      .catch(() => setErro('Erro ao carregar listas.'))
      .finally(() => setCarregando(false));
  }, [usinaOrigemId, usinaDestinoId]);

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Listas para Concessionaria</DialogTitle>
        </DialogHeader>

        {carregando && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        )}

        {erro && <p className="text-red-500 text-sm">{erro}</p>}

        {dados && (
          <div className="flex gap-4 overflow-x-auto">
            <CardLista
              titulo={`Origem: ${dados.origem.usinaNome}`}
              membros={dados.origem.cooperados}
            />
            <CardLista
              titulo={`Destino: ${dados.destino.usinaNome}`}
              membros={dados.destino.cooperados}
            />
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
