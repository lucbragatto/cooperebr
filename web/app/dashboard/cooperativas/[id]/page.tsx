'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { ArrowLeft, Pencil } from 'lucide-react';

const BADGE_TIPO: Record<string, { label: string; icone: string }> = {
  COOPERATIVA: { label: 'Cooperativa', icone: '🏢' },
  CONSORCIO: { label: 'Consórcio', icone: '🤝' },
  ASSOCIACAO: { label: 'Associação', icone: '🏛️' },
  CONDOMINIO: { label: 'Condomínio', icone: '🏘️' },
};

function Campo({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className="text-sm font-medium text-gray-800">{value ?? '—'}</p>
    </div>
  );
}

interface Cooperativa {
  id: string;
  nome: string;
  cnpj: string;
  email: string | null;
  telefone: string | null;
  endereco: string | null;
  numero: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  ativo: boolean;
  tipoParceiro: string;
  tipoMembro: string;
  tipoMembroPlural: string;
  planoSaas?: { id: string; nome: string; mensalidadeBase: number } | null;
  statusSaas?: string;
  diaVencimentoSaas?: number;
  usinas: any[];
  createdAt: string;
  updatedAt: string;
}

export default function CooperativaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [coop, setCoop] = useState<Cooperativa | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => {
    api.get<Cooperativa>(`/cooperativas/${id}`)
      .then((r) => setCoop(r.data))
      .catch(() => setErro('Parceiro não encontrado.'))
      .finally(() => setCarregando(false));
  }, [id]);

  const badge = coop ? (BADGE_TIPO[coop.tipoParceiro] || { label: coop.tipoParceiro, icone: '👤' }) : null;

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        <h2 className="text-2xl font-bold text-gray-800">Detalhe do Parceiro</h2>
        {coop && (
          <Link href={`/dashboard/cooperativas/${id}/editar`} className="ml-auto">
            <Button size="sm" variant="outline">
              <Pencil className="h-4 w-4 mr-2" />
              Editar
            </Button>
          </Link>
        )}
      </div>

      {carregando && <p className="text-gray-500">Carregando...</p>}
      {erro && <p className="text-red-500">{erro}</p>}

      {coop && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                {coop.nome}
                <Badge className={coop.ativo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                  {coop.ativo ? 'Ativo' : 'Inativo'}
                </Badge>
                {badge && (
                  <Badge variant="outline" className="gap-1">
                    <span>{badge.icone}</span> {badge.label}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-6">
              <Campo label="CNPJ" value={coop.cnpj} />
              <Campo label="Email" value={coop.email} />
              <Campo label="Telefone" value={coop.telefone} />
              <Campo label="Endereço" value={
                [coop.endereco, coop.numero].filter(Boolean).join(', ') || '—'
              } />
              <Campo label="Bairro" value={coop.bairro} />
              <Campo label="Cidade/UF" value={coop.cidade ? `${coop.cidade}/${coop.estado}` : '—'} />
              <Campo label="CEP" value={coop.cep} />
              <Campo label="Criado em" value={new Date(coop.createdAt).toLocaleString('pt-BR')} />
            </CardContent>
          </Card>

          {/* Plano SaaS */}
          {coop.planoSaas && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="text-base">Plano SaaS</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <Campo label="Plano" value={coop.planoSaas.nome} />
                <Campo label="Mensalidade" value={`R$ ${Number(coop.planoSaas.mensalidadeBase).toFixed(2)}`} />
                <Campo label="Dia Vencimento" value={coop.diaVencimentoSaas ?? 10} />
                <Campo label="Status SaaS" value={
                  <Badge variant="outline" className={
                    coop.statusSaas === 'ATIVO' ? 'bg-green-50 text-green-700' :
                    coop.statusSaas === 'INADIMPLENTE' ? 'bg-red-50 text-red-700' :
                    'bg-yellow-50 text-yellow-700'
                  }>
                    {coop.statusSaas}
                  </Badge>
                } />
              </CardContent>
            </Card>
          )}

          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-base">Usinas Vinculadas ({coop.usinas?.length ?? 0})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Potência (kWp)</TableHead>
                    <TableHead>Cidade/UF</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(!coop.usinas || coop.usinas.length === 0) ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-gray-400 py-6">
                        Nenhuma usina vinculada
                      </TableCell>
                    </TableRow>
                  ) : (
                    coop.usinas.map((u: any) => (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">{u.nome}</TableCell>
                        <TableCell>{Number(u.potenciaKwp).toFixed(2)}</TableCell>
                        <TableCell>{u.cidade}/{u.estado}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{u.statusHomologacao}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Link href={`/dashboard/usinas/${u.id}`}>
                            <Button variant="ghost" size="sm">Ver</Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
