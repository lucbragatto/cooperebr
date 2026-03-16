'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import type { Cooperado, StatusCooperado } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft, FileText, Pencil } from 'lucide-react';

const statusVariant: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  ATIVO: 'default',
  PENDENTE: 'secondary',
  SUSPENSO: 'outline',
  ENCERRADO: 'destructive',
};

const statusLabel: Record<string, string> = {
  ATIVO: 'Ativo',
  PENDENTE: 'Pendente',
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

export default function CooperadoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [cooperado, setCooperado] = useState<Cooperado | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [modoEdicao, setModoEdicao] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [form, setForm] = useState({
    nomeCompleto: '',
    email: '',
    cpf: '',
    telefone: '',
    status: '' as StatusCooperado,
  });

  useEffect(() => {
    api.get<Cooperado>(`/cooperados/${id}`)
      .then((r) => {
        setCooperado(r.data);
        setForm({
          nomeCompleto: r.data.nomeCompleto,
          email: r.data.email,
          cpf: r.data.cpf,
          telefone: r.data.telefone ?? '',
          status: r.data.status,
        });
      })
      .catch(() => setErro('Cooperado não encontrado.'))
      .finally(() => setCarregando(false));
  }, [id]);

  function iniciarEdicao() {
    if (!cooperado) return;
    setForm({
      nomeCompleto: cooperado.nomeCompleto,
      email: cooperado.email,
      cpf: cooperado.cpf,
      telefone: cooperado.telefone ?? '',
      status: cooperado.status,
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
      const { data } = await api.put<Cooperado>(`/cooperados/${id}`, form);
      setCooperado(data);
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
        <h2 className="text-2xl font-bold text-gray-800">Detalhe do Cooperado</h2>
        {cooperado && !modoEdicao && (
          <div className="ml-auto flex gap-2">
            <Link href={`/dashboard/cooperados/${id}/fatura`}>
              <Button size="sm" variant="outline">
                <FileText className="h-4 w-4 mr-2" />
                Processar Fatura
              </Button>
            </Link>
            <Button size="sm" variant="outline" onClick={iniciarEdicao}>
              <Pencil className="h-4 w-4 mr-2" />
              Editar
            </Button>
          </div>
        )}
      </div>

      {carregando && <p className="text-gray-500">Carregando...</p>}
      {erro && <p className="text-red-500">{erro}</p>}
      {mensagem && (
        <p className={`mb-4 text-sm ${mensagem.startsWith('Erro') ? 'text-red-500' : 'text-green-600'}`}>
          {mensagem}
        </p>
      )}

      {cooperado && !modoEdicao && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{cooperado.nomeCompleto}</span>
              <Badge variant={statusVariant[cooperado.status]}>
                {statusLabel[cooperado.status]}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-6">
            <Campo label="ID" value={cooperado.id} />
            <Campo label="CPF" value={cooperado.cpf} />
            <Campo label="Email" value={cooperado.email} />
            <Campo label="Telefone" value={cooperado.telefone} />
            <Campo label="Status" value={statusLabel[cooperado.status]} />
            <Campo label="Criado em" value={new Date(cooperado.createdAt).toLocaleString('pt-BR')} />
            <Campo label="Atualizado em" value={new Date(cooperado.updatedAt).toLocaleString('pt-BR')} />
          </CardContent>
        </Card>
      )}

      {cooperado && modoEdicao && (
        <Card>
          <CardHeader>
            <CardTitle>Editar Cooperado</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-6">
            <div>
              <label className={labelClass}>Nome Completo</label>
              <input
                className={inputClass}
                value={form.nomeCompleto}
                onChange={(e) => setForm({ ...form, nomeCompleto: e.target.value })}
              />
            </div>
            <div>
              <label className={labelClass}>Email</label>
              <input
                className={inputClass}
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div>
              <label className={labelClass}>CPF</label>
              <input
                className={inputClass}
                value={form.cpf}
                onChange={(e) => setForm({ ...form, cpf: e.target.value })}
              />
            </div>
            <div>
              <label className={labelClass}>Telefone</label>
              <input
                className={inputClass}
                value={form.telefone}
                onChange={(e) => setForm({ ...form, telefone: e.target.value })}
              />
            </div>
            <div>
              <label className={labelClass}>Status</label>
              <select
                className={inputClass}
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as StatusCooperado })}
              >
                <option value="PENDENTE">Pendente</option>
                <option value="ATIVO">Ativo</option>
                <option value="SUSPENSO">Suspenso</option>
                <option value="ENCERRADO">Encerrado</option>
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
