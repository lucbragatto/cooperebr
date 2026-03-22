'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import type { Contrato, StatusContrato } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Pencil } from 'lucide-react';

const statusClasses: Record<string, string> = {
  ATIVO: 'bg-green-100 text-green-800 border-green-200',
  SUSPENSO: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  ENCERRADO: 'bg-red-100 text-red-800 border-red-200',
};

const statusLabel: Record<string, string> = {
  ATIVO: 'Ativo',
  SUSPENSO: 'Suspenso',
  ENCERRADO: 'Encerrado',
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

export default function ContratoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [contrato, setContrato] = useState<Contrato | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [modoEdicao, setModoEdicao] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [form, setForm] = useState({
    percentualDesconto: '',
    dataFim: '',
    status: '' as StatusContrato,
  });

  useEffect(() => {
    api.get<Contrato>(`/contratos/${id}`)
      .then((r) => {
        setContrato(r.data);
        setForm({
          percentualDesconto: String(r.data.percentualDesconto),
          dataFim: r.data.dataFim ? r.data.dataFim.slice(0, 10) : '',
          status: r.data.status,
        });
      })
      .catch(() => setErro('Contrato não encontrado.'))
      .finally(() => setCarregando(false));
  }, [id]);

  function iniciarEdicao() {
    if (!contrato) return;
    setForm({
      percentualDesconto: String(contrato.percentualDesconto),
      dataFim: contrato.dataFim ? contrato.dataFim.slice(0, 10) : '',
      status: contrato.status,
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
      const payload: Record<string, unknown> = {
        percentualDesconto: parseFloat(form.percentualDesconto),
        status: form.status,
      };
      if (form.dataFim) payload.dataFim = form.dataFim;
      const { data } = await api.put<Contrato>(`/contratos/${id}`, payload);
      setContrato(data);
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
        <h2 className="text-2xl font-bold text-gray-800">Detalhe do Contrato</h2>
        {contrato && !modoEdicao && (
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

      {contrato && !modoEdicao && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Contrato {contrato.numero}</span>
              <Badge className={statusClasses[contrato.status]}>
                {statusLabel[contrato.status]}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-6">
            <Campo label="ID" value={contrato.id} />
            <Campo label="Número" value={contrato.numero} />
            <Campo label="Cooperado" value={contrato.cooperado?.nomeCompleto} />
            <Campo label="UC" value={contrato.uc?.numero} />
            <Campo label="Usina" value={contrato.usina?.nome} />
            <Campo label="Desconto (%)" value={`${contrato.percentualDesconto}%`} />
            <Campo label="Status" value={statusLabel[contrato.status]} />
            <Campo label="Data Início" value={new Date(contrato.dataInicio).toLocaleDateString('pt-BR')} />
            <Campo label="Data Fim" value={contrato.dataFim ? new Date(contrato.dataFim).toLocaleDateString('pt-BR') : null} />
            <Campo label="Criado em" value={new Date(contrato.createdAt).toLocaleString('pt-BR')} />
            <Campo label="Atualizado em" value={new Date(contrato.updatedAt).toLocaleString('pt-BR')} />
          </CardContent>
        </Card>
      )}

      {contrato && modoEdicao && (
        <Card>
          <CardHeader>
            <CardTitle>Editar Contrato</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-6">
            <div>
              <label className={labelClass}>Desconto (%)</label>
              <input
                className={inputClass}
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={form.percentualDesconto}
                onChange={(e) => setForm({ ...form, percentualDesconto: e.target.value })}
              />
            </div>
            <div>
              <label className={labelClass}>Data Fim</label>
              <input
                className={inputClass}
                type="date"
                value={form.dataFim}
                onChange={(e) => setForm({ ...form, dataFim: e.target.value })}
              />
            </div>
            <div>
              <label className={labelClass}>Status</label>
              <select
                className={inputClass}
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as StatusContrato })}
              >
                <option value="PENDENTE_ATIVACAO">Pendente Ativacao</option>
                <option value="ATIVO">Ativo</option>
                <option value="SUSPENSO">Suspenso</option>
                <option value="ENCERRADO">Encerrado</option>
                <option value="LISTA_ESPERA">Lista de Espera</option>
              </select>
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
