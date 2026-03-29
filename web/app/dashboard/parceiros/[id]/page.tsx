'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { ArrowLeft, Copy, Check, Users, UserCheck, Clock, UserX, Gift } from 'lucide-react';
import Link from 'next/link';

export default function ParceiroPainelPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [dados, setDados] = useState<any>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    api.get(`/cooperativas/${id}/painel-parceiro`)
      .then((r) => setDados(r.data))
      .catch(() => setErro('Parceiro não encontrado.'))
      .finally(() => setCarregando(false));
  }, [id]);

  function copiarLink() {
    if (!dados?.linkConvite) return;
    const url = `${window.location.origin}${dados.linkConvite}`;
    navigator.clipboard.writeText(url);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  if (carregando) return <p className="text-gray-500">Carregando...</p>;
  if (erro) return <p className="text-red-500">{erro}</p>;
  if (!dados) return null;

  const { cooperativa, totalMembros, ativos, pendentes, inativos, totalIndicacoes, linkConvite, membrosRecentes } = dados;

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        <h2 className="text-2xl font-bold text-gray-800">Painel do Parceiro</h2>
      </div>

      {/* Info do parceiro */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{cooperativa.nome}</CardTitle>
          <p className="text-sm text-gray-500">
            {cooperativa.tipoParceiro} &middot; CNPJ: {cooperativa.cnpj}
            {cooperativa.cidade && ` &middot; ${cooperativa.cidade}/${cooperativa.estado}`}
          </p>
        </CardHeader>
      </Card>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-4 w-4 text-blue-600" />
              <span className="text-xs text-gray-500">Total {cooperativa.tipoMembroPlural}</span>
            </div>
            <p className="text-2xl font-bold text-gray-800">{totalMembros}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <UserCheck className="h-4 w-4 text-green-600" />
              <span className="text-xs text-gray-500">Ativos</span>
            </div>
            <p className="text-2xl font-bold text-green-700">{ativos}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-yellow-600" />
              <span className="text-xs text-gray-500">Pendentes</span>
            </div>
            <p className="text-2xl font-bold text-yellow-700">{pendentes}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <UserX className="h-4 w-4 text-red-600" />
              <span className="text-xs text-gray-500">Inativos</span>
            </div>
            <p className="text-2xl font-bold text-red-700">{inativos}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <Gift className="h-4 w-4 text-purple-600" />
              <span className="text-xs text-gray-500">Indicações</span>
            </div>
            <p className="text-2xl font-bold text-purple-700">{totalIndicacoes}</p>
          </CardContent>
        </Card>
      </div>

      {/* Card convite */}
      <Card className="mb-6 border-green-200 bg-green-50">
        <CardContent className="pt-4 pb-3 px-4">
          <p className="text-sm font-medium text-green-800 mb-2">Convidar {cooperativa.tipoMembro}</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-white border border-green-300 rounded px-3 py-1.5 text-sm text-gray-700 truncate">
              {typeof window !== 'undefined' ? `${window.location.origin}${linkConvite}` : linkConvite}
            </code>
            <Button size="sm" variant="outline" onClick={copiarLink} className="shrink-0">
              {copiado ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
              {copiado ? 'Copiado!' : 'Copiar'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Membros recentes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{cooperativa.tipoMembroPlural} Recentes</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Código Indicação</TableHead>
                <TableHead>Indicações Feitas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {membrosRecentes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-gray-400 py-6">
                    Nenhum membro cadastrado
                  </TableCell>
                </TableRow>
              ) : (
                membrosRecentes.map((m: any) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.id ? <Link href={`/dashboard/cooperados/${m.id}`} className="text-blue-600 hover:underline font-medium">{m.nome}</Link> : m.nome}</TableCell>
                    <TableCell>
                      {m.codigoIndicacao ? (
                        <code className="bg-gray-100 px-2 py-0.5 rounded text-xs">{m.codigoIndicacao}</code>
                      ) : '—'}
                    </TableCell>
                    <TableCell>
                      {m.indicacoes > 0 ? (
                        <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full text-xs font-medium">{m.indicacoes}</span>
                      ) : '0'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
