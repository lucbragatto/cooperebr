'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import type { Ocorrencia, StatusOcorrencia, PrioridadeOcorrencia } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Pencil } from 'lucide-react';
import Link from 'next/link';
import { useTipoParceiro } from '@/hooks/useTipoParceiro';

const prioridadeClasses: Record<string, string> = {
  ALTA: 'bg-red-100 text-red-800 border-red-200',
  MEDIA: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  BAIXA: 'bg-blue-100 text-blue-800 border-blue-200',
  CRITICA: 'bg-red-200 text-red-900 border-red-300',
};

const prioridadeLabel: Record<string, string> = {
  ALTA: 'Alta',
  MEDIA: 'Média',
  BAIXA: 'Baixa',
  CRITICA: 'Crítica',
};

const statusLabel: Record<string, string> = {
  ABERTA: 'Aberta',
  EM_ANDAMENTO: 'Em Andamento',
  RESOLVIDA: 'Resolvida',
  CANCELADA: 'Cancelada',
};

const tipoLabel: Record<string, string> = {
  FALTA_ENERGIA: 'Falta de Energia',
  MEDICAO_INCORRETA: 'Medição Incorreta',
  PROBLEMA_FATURA: 'Problema na Fatura',
  SOLICITACAO: 'Solicitação',
  OUTROS: 'Outros',
};

function Campo({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className="text-sm font-medium text-gray-800">{value ?? '—'}</p>
    </div>
  );
}

const inputClass =
  'w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500';
const labelClass = 'text-xs text-gray-500 mb-0.5 block';

export default function OcorrenciaDetailPage() {
  const { tipoMembro } = useTipoParceiro();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [ocorrencia, setOcorrencia] = useState<Ocorrencia | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [modoEdicao, setModoEdicao] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [form, setForm] = useState({
    status: '' as StatusOcorrencia,
    prioridade: '' as PrioridadeOcorrencia,
    resolucao: '',
  });

  useEffect(() => {
    api.get<Ocorrencia>(`/ocorrencias/${id}`)
      .then((r) => {
        setOcorrencia(r.data);
        setForm({
          status: r.data.status,
          prioridade: r.data.prioridade,
          resolucao: r.data.resolucao ?? '',
        });
      })
      .catch(() => setErro('Ocorrência não encontrada.'))
      .finally(() => setCarregando(false));
  }, [id]);

  function iniciarEdicao() {
    if (!ocorrencia) return;
    setForm({
      status: ocorrencia.status,
      prioridade: ocorrencia.prioridade,
      resolucao: ocorrencia.resolucao ?? '',
    });
    setMensagem('');
    setModoEdicao(true);
  }

  function cancelar() {
    setModoEdicao(false);
    setMensagem('');
  }

  async function salvar() {
    setSalvando(true);
    setMensagem('');
    try {
      const { data } = await api.put<Ocorrencia>(`/ocorrencias/${id}`, form);
      setOcorrencia(data);
      setModoEdicao(false);
      setMensagem('Salvo com sucesso!');
    } catch {
      setMensagem('Erro ao salvar. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        <h2 className="text-2xl font-bold text-gray-800">Detalhe da Ocorrência</h2>
        {ocorrencia && !modoEdicao && (
          <Button size="sm" variant="outline" onClick={iniciarEdicao} className="ml-auto">
            <Pencil className="h-4 w-4 mr-2" />
            Editar
          </Button>
        )}
      </div>

      {carregando && <p className="text-gray-500">Carregando...</p>}
      {erro && <p className="text-red-500">{erro}</p>}
      {mensagem && (
        <p className={`mb-4 text-sm ${mensagem.startsWith('Erro') ? 'text-red-500' : 'text-green-600'}`}>
          {mensagem}
        </p>
      )}

      {ocorrencia && !modoEdicao && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{tipoLabel[ocorrencia.tipo] ?? ocorrencia.tipo}</span>
              <Badge className={prioridadeClasses[ocorrencia.prioridade]}>
                {prioridadeLabel[ocorrencia.prioridade] ?? ocorrencia.prioridade}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-6">
            <Campo label="ID" value={ocorrencia.id} />
            <Campo label={tipoMembro} value={ocorrencia.cooperado ? <Link href={`/dashboard/cooperados/${ocorrencia.cooperadoId}`} className="text-blue-600 hover:underline font-medium">{ocorrencia.cooperado.nomeCompleto}</Link> : '—'} />
            <Campo label="UC" value={ocorrencia.uc ? <Link href={`/dashboard/ucs/${ocorrencia.ucId}`} className="text-blue-600 hover:underline font-medium">{ocorrencia.uc.numero}</Link> : '—'} />
            <Campo label="Tipo" value={tipoLabel[ocorrencia.tipo] ?? ocorrencia.tipo} />
            <Campo label="Prioridade" value={prioridadeLabel[ocorrencia.prioridade] ?? ocorrencia.prioridade} />
            <Campo label="Status" value={statusLabel[ocorrencia.status] ?? ocorrencia.status} />
            <div className="col-span-2">
              <p className="text-xs text-gray-500 mb-0.5">Descrição</p>
              <p className="text-sm font-medium text-gray-800">{ocorrencia.descricao}</p>
            </div>
            {ocorrencia.resolucao && (
              <div className="col-span-2">
                <p className="text-xs text-gray-500 mb-0.5">Resolução</p>
                <p className="text-sm font-medium text-gray-800">{ocorrencia.resolucao}</p>
              </div>
            )}
            <Campo label="Criado em" value={new Date(ocorrencia.createdAt).toLocaleString('pt-BR')} />
            <Campo label="Atualizado em" value={new Date(ocorrencia.updatedAt).toLocaleString('pt-BR')} />
          </CardContent>
        </Card>
      )}

      {ocorrencia && modoEdicao && (
        <Card>
          <CardHeader>
            <CardTitle>Editar Ocorrência</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-6">
            <div>
              <label className={labelClass}>Status</label>
              <select
                className={inputClass}
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as StatusOcorrencia })}
              >
                <option value="ABERTA">Aberta</option>
                <option value="EM_ANDAMENTO">Em Andamento</option>
                <option value="RESOLVIDA">Resolvida</option>
                <option value="CANCELADA">Cancelada</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Prioridade</label>
              <select
                className={inputClass}
                value={form.prioridade}
                onChange={(e) => setForm({ ...form, prioridade: e.target.value as PrioridadeOcorrencia })}
              >
                <option value="BAIXA">Baixa</option>
                <option value="MEDIA">Média</option>
                <option value="ALTA">Alta</option>
                <option value="CRITICA">Crítica</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className={labelClass}>Resolução</label>
              <textarea
                className={`${inputClass} resize-none`}
                rows={4}
                value={form.resolucao}
                onChange={(e) => setForm({ ...form, resolucao: e.target.value })}
                placeholder="Descreva a resolução da ocorrência..."
              />
            </div>
            <div className="col-span-2 flex gap-3 mt-2">
              <Button onClick={salvar} disabled={salvando}>
                {salvando ? 'Salvando...' : 'Salvar'}
              </Button>
              <Button variant="outline" onClick={cancelar} disabled={salvando}>
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
