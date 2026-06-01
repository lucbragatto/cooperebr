'use client';

/**
 * D-novo-BR-CT CT.6 (31/05/2026) — CRUD Convênios CT.2 (Art. 88 Lei 5.764/71).
 *
 * D-novo-PUX-A (01/06/2026) — Criar/editar viraram páginas próprias
 * (`/novo` e `/[id]/editar`). Deletar continua via Dialog (regra ESCLARECIDA
 * 01/06: confirmação/ação simples OK em Dialog).
 *
 * Help do convênio (HelpBox) no topo.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, Plus, FileCheck, Trash2, Pencil } from 'lucide-react';
import { ConvenioHelp } from '@/components/convenios/ConvenioHelp';

type Convenio = {
  id: string;
  nome: string;
  descricao: string | null;
  tipoBeneficio: string;
  fluxoFinanceiro: string;
  classificacaoFiscal: string;
  vigenciaInicio: string;
  vigenciaFim: string | null;
  ativo: boolean;
};

export default function ConveniosCtPage() {
  const [convenios, setConvenios] = useState<Convenio[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [removerId, setRemoverId] = useState<string | null>(null);
  const [removendo, setRemovendo] = useState(false);

  async function carregar() {
    setLoading(true);
    setErro('');
    try {
      const { data } = await api.get<Convenio[]>('/contabilidade-tributaria/convenios');
      setConvenios(data);
    } catch (err: any) {
      setErro(err?.response?.data?.message || 'Falha ao carregar');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  async function remover(id: string) {
    setRemovendo(true);
    try {
      await api.delete(`/contabilidade-tributaria/convenios/${id}`);
      setRemoverId(null);
      await carregar();
    } catch (err: any) {
      setErro(err?.response?.data?.message || 'Falha ao remover');
    } finally {
      setRemovendo(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <FileCheck className="h-6 w-6 text-cyan-700" />
            Convênios — Art. 88 Lei 5.764/71
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Convênios pra consecução do objeto social (ato cooperativo auxiliar)
          </p>
        </div>
        <Link href="/dashboard/contabilidade/convenios/novo">
          <Button className="bg-cyan-700 hover:bg-cyan-800">
            <Plus className="h-4 w-4 mr-1" /> Novo convênio
          </Button>
        </Link>
      </div>

      {/* Help do convênio (HelpBox dispensável — lembra fechado via localStorage) */}
      <ConvenioHelp />

      {erro && (
        <div className="bg-red-50 border-l-4 border-red-500 p-3 text-sm text-red-700 rounded">{erro}</div>
      )}

      {loading && (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-cyan-700" />
        </div>
      )}

      {!loading && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {convenios.length} convênio(s) cadastrado(s)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {convenios.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">
                Nenhum convênio cadastrado. Clique em "Novo convênio" para começar.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-xs text-gray-500 border-b">
                  <tr>
                    <th className="text-left py-2">Nome</th>
                    <th className="text-left py-2">Fluxo</th>
                    <th className="text-left py-2">Classificação Fiscal</th>
                    <th className="text-left py-2">Vigência</th>
                    <th className="text-center py-2">Status</th>
                    <th className="text-right py-2">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {convenios.map((c) => (
                    <tr key={c.id} className="border-b hover:bg-gray-50">
                      <td className="py-2">
                        <div className="font-medium">{c.nome}</div>
                        {c.descricao && (
                          <div className="text-xs text-gray-500">{c.descricao}</div>
                        )}
                      </td>
                      <td className="py-2 text-xs">{c.fluxoFinanceiro}</td>
                      <td className="py-2 text-xs text-gray-600">{c.classificacaoFiscal}</td>
                      <td className="py-2 text-xs">
                        {new Date(c.vigenciaInicio).toLocaleDateString('pt-BR')}
                        {c.vigenciaFim && (
                          <> → {new Date(c.vigenciaFim).toLocaleDateString('pt-BR')}</>
                        )}
                      </td>
                      <td className="text-center py-2">
                        {c.ativo ? (
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300">
                            Ativo
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-gray-100 text-gray-600">
                            Inativo
                          </Badge>
                        )}
                      </td>
                      <td className="text-right py-2">
                        <div className="flex justify-end gap-1">
                          <Link href={`/dashboard/contabilidade/convenios/${c.id}/editar`}>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-cyan-700 hover:bg-cyan-50"
                              title="Editar convênio"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setRemoverId(c.id)}
                            className="text-rose-700 hover:bg-rose-50"
                            title="Remover convênio"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Dialog Remover — confirmação simples OK (regra esclarecida 01/06) */}
      <Dialog open={!!removerId} onOpenChange={(o) => !o && setRemoverId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remover convênio?</DialogTitle>
            <DialogDescription>
              Esta ação é irreversível. Lançamentos passados que referenciam este convênio mantêm a classificação histórica.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoverId(null)} disabled={removendo}>
              Cancelar
            </Button>
            <Button
              onClick={() => removerId && remover(removerId)}
              disabled={removendo}
              className="bg-rose-700 hover:bg-rose-800"
            >
              {removendo && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Remover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
