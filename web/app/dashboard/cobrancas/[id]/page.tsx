'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import type { Cobranca, StatusCobranca } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Pencil, CheckCircle } from 'lucide-react';

const statusClasses: Record<string, string> = {
  PENDENTE: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  PAGO: 'bg-green-100 text-green-800 border-green-200',
  VENCIDO: 'bg-red-100 text-red-800 border-red-200',
  CANCELADO: 'bg-gray-100 text-gray-800 border-gray-200',
};

const statusLabel: Record<string, string> = {
  PENDENTE: 'Pendente',
  PAGO: 'Pago',
  VENCIDO: 'Vencido',
  CANCELADO: 'Cancelado',
};

function formatBRL(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

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

export default function CobrancaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [cobranca, setCobranca] = useState<Cobranca | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [modoEdicao, setModoEdicao] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [form, setForm] = useState({
    status: '' as StatusCobranca,
    dataPagamento: '',
  });

  useEffect(() => {
    api.get<Cobranca>(`/cobrancas/${id}`)
      .then((r) => {
        setCobranca(r.data);
        setForm({
          status: r.data.status,
          dataPagamento: r.data.dataPagamento ? r.data.dataPagamento.slice(0, 10) : '',
        });
      })
      .catch(() => setErro('Cobrança não encontrada.'))
      .finally(() => setCarregando(false));
  }, [id]);

  function iniciarEdicao() {
    if (!cobranca) return;
    setForm({
      status: cobranca.status,
      dataPagamento: cobranca.dataPagamento ? cobranca.dataPagamento.slice(0, 10) : '',
    });
    setMensagem('');
    setModoEdicao(true);
  }

  function cancelar() {
    setModoEdicao(false);
    setMensagem('');
  }

  async function salvar(payload?: { status: StatusCobranca; dataPagamento: string }) {
    setSalvando(true);
    setMensagem('');
    try {
      const body = payload ?? form;
      const { data } = await api.put<Cobranca>(`/cobrancas/${id}`, body);
      setCobranca(data);
      setForm({
        status: data.status,
        dataPagamento: data.dataPagamento ? data.dataPagamento.slice(0, 10) : '',
      });
      setModoEdicao(false);
      setMensagem('Salvo com sucesso!');
    } catch {
      setMensagem('Erro ao salvar. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

  function darBaixa() {
    const hoje = new Date().toISOString().slice(0, 10);
    salvar({ status: 'PAGO', dataPagamento: hoje });
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        <h2 className="text-2xl font-bold text-gray-800">Detalhe da Cobrança</h2>
        {cobranca && !modoEdicao && (
          <div className="ml-auto flex gap-2">
            {cobranca.status !== 'PAGO' && cobranca.status !== 'CANCELADO' && (
              <Button size="sm" variant="default" onClick={darBaixa} disabled={salvando}>
                <CheckCircle className="h-4 w-4 mr-2" />
                Dar Baixa
              </Button>
            )}
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

      {cobranca && !modoEdicao && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>
                Cobrança {String(cobranca.mesReferencia).padStart(2, '0')}/{cobranca.anoReferencia}
              </span>
              <Badge className={statusClasses[cobranca.status]}>
                {statusLabel[cobranca.status]}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-6">
            <Campo label="ID" value={cobranca.id} />
            <Campo label="Cooperado" value={(cobranca as any).contrato?.cooperado?.nomeCompleto} />
            <Campo label="Contrato" value={cobranca.contrato?.numero} />
            <Campo label="Mês/Ano Referência" value={`${String(cobranca.mesReferencia).padStart(2, '0')}/${cobranca.anoReferencia}`} />
            <Campo label="Valor Bruto" value={formatBRL(cobranca.valorBruto)} />
            <Campo label="Desconto (%)" value={`${cobranca.percentualDesconto}%`} />
            <Campo label="Valor Desconto" value={formatBRL(cobranca.valorDesconto)} />
            <Campo label="Valor Líquido" value={formatBRL(cobranca.valorLiquido)} />
            <Campo label="Status" value={statusLabel[cobranca.status]} />
            <Campo label="Vencimento" value={new Date(cobranca.dataVencimento).toLocaleDateString('pt-BR')} />
            <Campo label="Pagamento" value={cobranca.dataPagamento ? new Date(cobranca.dataPagamento).toLocaleDateString('pt-BR') : null} />
            <Campo label="Criado em" value={new Date(cobranca.createdAt).toLocaleString('pt-BR')} />
            <Campo label="Atualizado em" value={new Date(cobranca.updatedAt).toLocaleString('pt-BR')} />
          </CardContent>
        </Card>
      )}

      {cobranca && modoEdicao && (
        <Card>
          <CardHeader>
            <CardTitle>Editar Cobrança</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-6">
            <div>
              <label className={labelClass}>Status</label>
              <select
                className={inputClass}
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as StatusCobranca })}
              >
                <option value="PENDENTE">Pendente</option>
                <option value="PAGO">Pago</option>
                <option value="VENCIDO">Vencido</option>
                <option value="CANCELADO">Cancelado</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Data de Pagamento</label>
              <input
                className={inputClass}
                type="date"
                value={form.dataPagamento}
                onChange={(e) => setForm({ ...form, dataPagamento: e.target.value })}
              />
            </div>
            <div className="col-span-2 flex gap-3 mt-2">
              <Button onClick={() => salvar()} disabled={salvando}>
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
