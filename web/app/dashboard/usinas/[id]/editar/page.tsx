'use client';

/**
 * /dashboard/usinas/[id]/editar — Página dedicada de edição de Usina.
 *
 * F.7b (M36, 28/05/2026): Padrão UX Dual 17/05 Tipo B (entidade inteira →
 * página própria). Substitui o <Sheet> lateral que existia em [id]/page.tsx
 * pré-F.7b. Reusa componente compartilhado UsinaForm (web/components/usinas/).
 *
 * D-novo-BB resolvido + D-novo-BC paridade completa de campos.
 */

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';
import {
  UsinaForm,
  VALORES_INICIAIS,
  montarPayloadUsina,
  type UsinaFormData,
} from '@/components/usinas/UsinaForm';

interface UsinaResponse {
  id: string;
  nome: string;
  apelidoInterno?: string | null;
  potenciaKwp: number | string;
  capacidadeKwh?: number | string | null;
  producaoMensalKwh?: number | string | null;
  classeGdAnotada?: string | null;
  statusHomologacao?: string | null;
  dataHomologacao?: string | null;
  dataInicioProducao?: string | null;
  cidade: string;
  estado: string;
  enderecoLogradouro?: string | null;
  enderecoNumero?: string | null;
  enderecoBairro?: string | null;
  enderecoCep?: string | null;
  distribuidora?: string | null;
  cnpjUsina?: string | null;
  numeroContratoEdp?: string | null;
  dataContratoEdp?: string | null;
  formaAquisicao?: string | null;
  formaPagamentoDono?: string | null;
  valorAluguelFixo?: number | string | null;
  percentualGeracaoDono?: number | string | null;
  proprietarioNome?: string | null;
  proprietarioCpfCnpj?: string | null;
  proprietarioTelefone?: string | null;
  proprietarioEmail?: string | null;
  proprietarioTipo?: string | null;
  modeloCobrancaOverride?: string | null;
  politicaBandeira?: string | null;
  valorKwhPadrao?: number | string | null;
  observacoes?: string | null;
}

function toFormString(v: number | string | null | undefined): string {
  if (v === null || v === undefined) return '';
  return String(v);
}

function toDateInputString(v: string | null | undefined): string {
  if (!v) return '';
  // backend retorna ISO; <input type="date"> precisa de YYYY-MM-DD
  return v.slice(0, 10);
}

export default function EditarUsinaPage() {
  // Next.js 16: useParams retorna RAW encoded — para id cuid sem chars
  // especiais isso é transparente (lição D-novo-BF do M34, OK aqui)
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [form, setForm] = useState<UsinaFormData>({ ...VALORES_INICIAIS });
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [nomeOriginal, setNomeOriginal] = useState<string>('');

  useEffect(() => {
    if (!id) return;
    api
      .get<UsinaResponse>(`/usinas/${id}`)
      .then((r) => {
        const u = r.data;
        setNomeOriginal(u.nome);
        setForm({
          nome: u.nome ?? '',
          apelidoInterno: u.apelidoInterno ?? '',
          potenciaKwp: toFormString(u.potenciaKwp),
          capacidadeKwh: toFormString(u.capacidadeKwh ?? null),
          producaoMensalKwh: toFormString(u.producaoMensalKwh ?? null),
          classeGdAnotada: u.classeGdAnotada ?? '',
          statusHomologacao: u.statusHomologacao ?? '',
          dataHomologacao: toDateInputString(u.dataHomologacao),
          dataInicioProducao: toDateInputString(u.dataInicioProducao),
          cidade: u.cidade ?? '',
          estado: u.estado ?? '',
          enderecoLogradouro: u.enderecoLogradouro ?? '',
          enderecoNumero: u.enderecoNumero ?? '',
          enderecoBairro: u.enderecoBairro ?? '',
          enderecoCep: u.enderecoCep ?? '',
          distribuidora: u.distribuidora ?? '',
          cnpjUsina: u.cnpjUsina ?? '',
          numeroContratoEdp: u.numeroContratoEdp ?? '',
          dataContratoEdp: toDateInputString(u.dataContratoEdp),
          formaAquisicao: u.formaAquisicao ?? '',
          formaPagamentoDono: u.formaPagamentoDono ?? '',
          valorAluguelFixo: toFormString(u.valorAluguelFixo ?? null),
          percentualGeracaoDono: toFormString(u.percentualGeracaoDono ?? null),
          proprietarioNome: u.proprietarioNome ?? '',
          proprietarioCpfCnpj: u.proprietarioCpfCnpj ?? '',
          proprietarioTelefone: u.proprietarioTelefone ?? '',
          proprietarioEmail: u.proprietarioEmail ?? '',
          proprietarioTipo: u.proprietarioTipo ?? 'PF',
          modeloCobrancaOverride: u.modeloCobrancaOverride ?? '',
          politicaBandeira: u.politicaBandeira ?? '',
          valorKwhPadrao: toFormString(u.valorKwhPadrao ?? null),
          observacoes: u.observacoes ?? '',
        });
      })
      .catch(() => setErro('Usina não encontrada ou sem acesso.'))
      .finally(() => setCarregando(false));
  }, [id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    setSucesso('');

    const { payload, erro: erroValidacao } = montarPayloadUsina(form);
    if (erroValidacao) {
      setErro(erroValidacao);
      return;
    }

    setSalvando(true);
    try {
      await api.put(`/usinas/${id}`, payload);
      setSucesso('Alterações salvas com sucesso!');
      setTimeout(() => router.push(`/dashboard/usinas/${id}`), 800);
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? 'Erro ao salvar alterações.';
      setErro(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-amber-600 animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/dashboard/usinas/${id}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Voltar
          </Button>
        </Link>
        <h2 className="text-2xl font-bold text-gray-800">
          Editar Usina{nomeOriginal && `: ${nomeOriginal}`}
        </h2>
      </div>

      <UsinaForm
        modo="editar"
        usinaId={id}
        form={form}
        setForm={setForm}
        onSubmit={handleSubmit}
        onCancelar={() => router.push(`/dashboard/usinas/${id}`)}
        salvando={salvando}
        erro={erro}
        sucesso={sucesso}
      />
    </div>
  );
}
