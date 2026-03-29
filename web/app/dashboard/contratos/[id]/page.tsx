'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import api from '@/lib/api';
import type { Contrato, StatusContrato } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, Pencil } from 'lucide-react';
import Link from 'next/link';
import {
  Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
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

function Campo({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className="text-sm font-medium text-gray-800">{value ?? '—'}</p>
    </div>
  );
}

const cls = 'w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500';
const lbl = 'text-xs text-gray-500 mb-0.5 block';

const contratoSchema = z.object({
  kwhContratoAnual: z.coerce.number().positive('Deve ser maior que 0').nullable(),
  percentualDesconto: z.coerce.number().min(0, 'Min 0').max(100, 'Max 100'),
  descontoOverride: z.coerce.number().min(0).max(100).nullable(),
  dataFim: z.string().optional(),
  status: z.enum(['PENDENTE_ATIVACAO', 'EM_APROVACAO', 'AGUARDANDO_ASSINATURA', 'ASSINATURA_SOLICITADA', 'APROVADO', 'ATIVO', 'SUSPENSO', 'ENCERRADO', 'LISTA_ESPERA']),
});

type ContratoFormData = z.infer<typeof contratoSchema>;

export default function ContratoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { tipoMembro } = useTipoParceiro();
  const [contrato, setContrato] = useState<(Contrato & { kwhContratoAnual?: number | null; kwhContratoMensal?: number | null; kwhContrato?: number | null; descontoOverride?: number | null; percentualUsina?: number | null }) | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [sheetAberto, setSheetAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState('');

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ContratoFormData>({
    resolver: zodResolver(contratoSchema) as any,
  });

  useEffect(() => {
    api.get(`/contratos/${id}`)
      .then((r) => setContrato(r.data as any))
      .catch(() => setErro('Contrato não encontrado.'))
      .finally(() => setCarregando(false));
  }, [id]);

  function abrirSheet() {
    if (!contrato) return;
    reset({
      kwhContratoAnual: contrato.kwhContratoAnual ? Number(contrato.kwhContratoAnual) : null,
      percentualDesconto: Number(contrato.percentualDesconto),
      descontoOverride: contrato.descontoOverride ? Number(contrato.descontoOverride) : null,
      dataFim: contrato.dataFim ? contrato.dataFim.slice(0, 10) : '',
      status: contrato.status,
    });
    setMensagem('');
    setSheetAberto(true);
  }

  async function onSubmit(data: ContratoFormData) {
    setSalvando(true);
    setMensagem('');
    try {
      const payload: Record<string, unknown> = {
        percentualDesconto: data.percentualDesconto,
        status: data.status,
      };
      if (data.kwhContratoAnual) payload.kwhContratoAnual = data.kwhContratoAnual;
      if (data.descontoOverride !== null && data.descontoOverride !== undefined) {
        payload.descontoOverride = data.descontoOverride;
      }
      if (data.dataFim) payload.dataFim = data.dataFim;
      const { data: res } = await api.put(`/contratos/${id}`, payload);
      setContrato(res as any);
      setSheetAberto(false);
      setMensagem('Salvo com sucesso!');
    } catch (e: any) {
      const msg = e?.response?.data?.message || 'Erro ao salvar.';
      setMensagem(typeof msg === 'string' ? `Erro: ${msg}` : `Erro: ${JSON.stringify(msg)}`);
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
        {contrato && (
          <Button size="sm" variant="outline" onClick={abrirSheet} className="ml-auto">
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

      {contrato && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Contrato {contrato.numero}</span>
              <Badge className={statusClasses[contrato.status]}>
                {statusLabel[contrato.status] ?? contrato.status}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-6">
            <Campo label="ID" value={contrato.id} />
            <Campo label="Numero" value={contrato.numero} />
            <Campo label={tipoMembro} value={contrato.cooperado ? <Link href={`/dashboard/cooperados/${contrato.cooperadoId}`} className="text-blue-600 hover:underline font-medium">{contrato.cooperado.nomeCompleto}</Link> : '—'} />
            <Campo label="UC" value={contrato.uc ? <Link href={`/dashboard/ucs/${contrato.ucId}`} className="text-blue-600 hover:underline font-medium">{contrato.uc.numero}</Link> : '—'} />
            <Campo label="Usina" value={contrato.usina ? <Link href={`/dashboard/usinas/${contrato.usinaId}`} className="text-blue-600 hover:underline font-medium">{contrato.usina.nome}</Link> : '—'} />
            <Campo label="Desconto (%)" value={`${contrato.percentualDesconto}%`} />
            {contrato.descontoOverride != null && (
              <Campo label="Desconto Override (%)" value={`${contrato.descontoOverride}%`} />
            )}
            <Campo label="kWh Contrato Anual" value={contrato.kwhContratoAnual ? Number(contrato.kwhContratoAnual).toFixed(2) : '—'} />
            <Campo label="kWh Contrato Mensal" value={contrato.kwhContratoMensal ? Number(contrato.kwhContratoMensal).toFixed(2) : (contrato.kwhContrato ? Number(contrato.kwhContrato).toFixed(2) : '—')} />
            {contrato.percentualUsina != null && (
              <Campo label="% Usina" value={`${Number(contrato.percentualUsina).toFixed(4)}%`} />
            )}
            <Campo label="Status" value={statusLabel[contrato.status] ?? contrato.status} />
            <Campo label="Data Inicio" value={new Date(contrato.dataInicio).toLocaleDateString('pt-BR')} />
            <Campo label="Data Fim" value={contrato.dataFim ? new Date(contrato.dataFim).toLocaleDateString('pt-BR') : '—'} />
            <Campo label="Criado em" value={new Date(contrato.createdAt).toLocaleString('pt-BR')} />
            <Campo label="Atualizado em" value={new Date(contrato.updatedAt).toLocaleString('pt-BR')} />
          </CardContent>
        </Card>
      )}

      {/* Sheet — Editar Contrato */}
      <Sheet open={sheetAberto} onOpenChange={setSheetAberto}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader><SheetTitle>Editar Contrato {contrato?.numero}</SheetTitle></SheetHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
            <div>
              <label className={lbl}>kWh Contrato Anual</label>
              <input className={cls} type="number" step="0.01" {...register('kwhContratoAnual')} />
              {errors.kwhContratoAnual && <p className="text-xs text-red-500 mt-1">{errors.kwhContratoAnual.message}</p>}
              <p className="text-xs text-gray-400 mt-1">Se alterado, recalcula kWh mensal e % da usina</p>
            </div>
            <div>
              <label className={lbl}>Desconto (%) *</label>
              <input className={cls} type="number" step="0.01" min="0" max="100" {...register('percentualDesconto')} />
              {errors.percentualDesconto && <p className="text-xs text-red-500 mt-1">{errors.percentualDesconto.message}</p>}
            </div>
            <div>
              <label className={lbl}>Desconto Override (%)</label>
              <input className={cls} type="number" step="0.01" min="0" max="100" {...register('descontoOverride')} />
              <p className="text-xs text-gray-400 mt-1">Se definido, sobrescreve a cascata de desconto</p>
            </div>
            <div>
              <label className={lbl}>Data Fim</label>
              <input className={cls} type="date" {...register('dataFim')} />
            </div>
            <div>
              <label className={lbl}>Status *</label>
              <select className={`${cls} bg-white`} {...register('status')}>
                <option value="PENDENTE_ATIVACAO">Pendente Ativação</option>
                <option value="EM_APROVACAO">Em Aprovação</option>
                <option value="AGUARDANDO_ASSINATURA">Aguard. Assinatura</option>
                <option value="ASSINATURA_SOLICITADA">Assinatura Solicitada</option>
                <option value="APROVADO">Aprovado</option>
                <option value="ATIVO">Ativo</option>
                <option value="SUSPENSO">Suspenso</option>
                <option value="ENCERRADO">Encerrado</option>
                <option value="LISTA_ESPERA">Lista de Espera</option>
              </select>
            </div>
            {mensagem && mensagem.startsWith('Erro') && (
              <p className="text-sm text-red-500">{mensagem}</p>
            )}
            <SheetFooter className="flex gap-2">
              <Button type="submit" disabled={salvando} className="flex-1">
                {salvando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Salvar
              </Button>
              <Button type="button" variant="outline" onClick={() => setSheetAberto(false)}>Cancelar</Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
