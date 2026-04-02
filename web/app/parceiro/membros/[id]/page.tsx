'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, User, FileText, CreditCard, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import api from '@/lib/api';

export default function ParceiroMembroDetalhePage() {
  const params = useParams();
  const id = params.id as string;
  const [membro, setMembro] = useState<any>(null);
  const [contratos, setContratos] = useState<any[]>([]);
  const [cobrancas, setCobrancas] = useState<any[]>([]);
  const [documentos, setDocumentos] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    async function carregar() {
      try {
        const [membroRes, contratosRes, cobrancasRes, docsRes] = await Promise.allSettled([
          api.get(`/cooperados/${id}`),
          api.get(`/contratos`, { params: { cooperadoId: id } }),
          api.get(`/cobrancas`, { params: { cooperadoId: id } }),
          api.get(`/documentos/cooperado/${id}`),
        ]);

        if (membroRes.status === 'fulfilled') setMembro(membroRes.value.data);
        if (contratosRes.status === 'fulfilled') {
          const d = contratosRes.value.data;
          setContratos(Array.isArray(d) ? d : d?.data ?? []);
        }
        if (cobrancasRes.status === 'fulfilled') {
          const d = cobrancasRes.value.data;
          setCobrancas(Array.isArray(d) ? d : d?.data ?? []);
        }
        if (docsRes.status === 'fulfilled') {
          const d = docsRes.value.data;
          setDocumentos(Array.isArray(d) ? d : []);
        }
      } catch {
        // ignore
      } finally {
        setCarregando(false);
      }
    }
    carregar();
  }, [id]);

  if (carregando) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!membro) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Membro não encontrado.</p>
        <Link href="/parceiro/membros" className="text-blue-600 hover:underline text-sm mt-2 inline-block">
          Voltar
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/parceiro/membros"
          className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{membro.nomeCompleto}</h1>
          <p className="text-sm text-gray-500">{membro.cpf} &middot; {membro.email}</p>
        </div>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
              <User className="w-4 h-4" /> Dados
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p><span className="text-gray-500">Status:</span> <Badge>{membro.status}</Badge></p>
            <p><span className="text-gray-500">Telefone:</span> {membro.telefone ?? 'N/A'}</p>
            <p><span className="text-gray-500">Tipo:</span> {membro.tipoCooperado ?? 'COM_UC'}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
              <Zap className="w-4 h-4" /> Contratos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {contratos.length === 0 ? (
              <p className="text-sm text-gray-400">Nenhum contrato</p>
            ) : (
              <div className="space-y-2">
                {contratos.slice(0, 5).map((c: any) => (
                  <div key={c.id} className="text-sm border-l-2 border-blue-200 pl-2">
                    <p className="font-medium">{c.numero ?? c.id.slice(0, 8)}</p>
                    <p className="text-xs text-gray-500">{c.status}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
              <FileText className="w-4 h-4" /> Documentos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {documentos.length === 0 ? (
              <p className="text-sm text-gray-400">Nenhum documento</p>
            ) : (
              <div className="space-y-1">
                {documentos.map((d: any) => (
                  <div key={d.id} className="flex items-center gap-2 text-sm">
                    <Badge className={
                      d.status === 'APROVADO' ? 'bg-green-100 text-green-700' :
                      d.status === 'REPROVADO' ? 'bg-red-100 text-red-700' :
                      'bg-yellow-100 text-yellow-700'
                    }>
                      {d.status}
                    </Badge>
                    <span className="truncate">{d.tipo}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Cobranças */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <CreditCard className="w-4 h-4" /> Cobranças Recentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {cobrancas.length === 0 ? (
            <p className="text-sm text-gray-400">Nenhuma cobrança registrada.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="py-2 pr-4">Ref.</th>
                    <th className="py-2 pr-4">Valor</th>
                    <th className="py-2 pr-4">Vencimento</th>
                    <th className="py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {cobrancas.slice(0, 10).map((c: any) => (
                    <tr key={c.id} className="border-b last:border-0">
                      <td className="py-2 pr-4">{c.mesReferencia}/{c.anoReferencia}</td>
                      <td className="py-2 pr-4">
                        R$ {Number(c.valorLiquido ?? c.valor ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-2 pr-4">{c.dataVencimento ? new Date(c.dataVencimento).toLocaleDateString('pt-BR') : '-'}</td>
                      <td className="py-2">
                        <Badge className={
                          c.status === 'PAGO' ? 'bg-green-100 text-green-700' :
                          c.status === 'VENCIDO' ? 'bg-red-100 text-red-700' :
                          'bg-yellow-100 text-yellow-700'
                        }>
                          {c.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
