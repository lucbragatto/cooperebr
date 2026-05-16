'use client';

/**
 * Bloco C (16/05/2026) — Cadastro de cooperado SEM unidade consumidora (Indicador Puro).
 *
 * Cooperado SEM_UC participa do programa de indicação (MLM) e/ou recebe tokens CoopereToken
 * sem precisar ter UC própria. Banco/service já tratam (TipoCooperado.SEM_UC, getChecklist,
 * etc). Esta página apenas torna a categoria acessível pela UI admin.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, UserPlus, Info } from 'lucide-react';

function formatarCpfCnpj(valor: string, tipo: 'PF' | 'PJ'): string {
  const nums = valor.replace(/\D/g, '');
  if (tipo === 'PF') {
    const v = nums.slice(0, 11);
    if (v.length <= 3) return v;
    if (v.length <= 6) return `${v.slice(0, 3)}.${v.slice(3)}`;
    if (v.length <= 9) return `${v.slice(0, 3)}.${v.slice(3, 6)}.${v.slice(6)}`;
    return `${v.slice(0, 3)}.${v.slice(3, 6)}.${v.slice(6, 9)}-${v.slice(9)}`;
  }
  const v = nums.slice(0, 14);
  if (v.length <= 2) return v;
  if (v.length <= 5) return `${v.slice(0, 2)}.${v.slice(2)}`;
  if (v.length <= 8) return `${v.slice(0, 2)}.${v.slice(2, 5)}.${v.slice(5)}`;
  if (v.length <= 12) return `${v.slice(0, 2)}.${v.slice(2, 5)}.${v.slice(5, 8)}/${v.slice(8)}`;
  return `${v.slice(0, 2)}.${v.slice(2, 5)}.${v.slice(5, 8)}/${v.slice(8, 12)}-${v.slice(12)}`;
}

export default function NovoCooperadoSemUcPage() {
  const router = useRouter();

  const [form, setForm] = useState({
    tipoPessoa: 'PF' as 'PF' | 'PJ',
    nomeCompleto: '',
    cpf: '',
    email: '',
    telefone: '',
    codigoIndicacao: '',
    representanteLegalNome: '',
    representanteLegalCpf: '',
    representanteLegalCargo: '',
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  function set<K extends keyof typeof form>(field: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    setSucesso('');

    if (!form.nomeCompleto.trim()) {
      setErro(form.tipoPessoa === 'PJ' ? 'Razão social é obrigatória.' : 'Nome completo é obrigatório.');
      return;
    }
    if (!form.cpf.trim()) {
      setErro(form.tipoPessoa === 'PJ' ? 'CNPJ é obrigatório.' : 'CPF é obrigatório.');
      return;
    }
    if (!form.email.trim()) {
      setErro('Email é obrigatório.');
      return;
    }

    setSalvando(true);
    try {
      const payload: Record<string, unknown> = {
        nomeCompleto: form.nomeCompleto,
        cpf: form.cpf.replace(/\D/g, ''),
        email: form.email,
        tipoPessoa: form.tipoPessoa,
        tipoCooperado: 'SEM_UC',
        status: 'ATIVO',
      };
      if (form.telefone) payload.telefone = form.telefone.replace(/\D/g, '');
      if (form.tipoPessoa === 'PJ') {
        if (form.representanteLegalNome) payload.representanteLegalNome = form.representanteLegalNome;
        if (form.representanteLegalCpf) payload.representanteLegalCpf = form.representanteLegalCpf.replace(/\D/g, '');
        if (form.representanteLegalCargo) payload.representanteLegalCargo = form.representanteLegalCargo;
      }
      const res = await api.post<{ id: string }>('/cooperados', payload);
      const novoId = res.data?.id;
      setSucesso('Cooperado SEM_UC cadastrado com sucesso!');
      setTimeout(() => router.push(novoId ? `/dashboard/cooperados/${novoId}` : '/dashboard/cooperados'), 800);
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? 'Erro ao cadastrar cooperado.';
      setErro(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex items-center gap-3 mb-4">
        <Link href="/dashboard/cooperados">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Voltar
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Cooperado Indicador Puro (SEM UC)</h1>
          <p className="text-sm text-gray-500">Cadastro simplificado — sem unidade consumidora</p>
        </div>
      </div>

      <Card className="bg-blue-50 border-blue-200 mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-blue-800 flex items-center gap-2">
            <Info className="w-4 h-4" /> Quando usar este cadastro
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-blue-900 space-y-1">
          <p>Cooperado <strong>Indicador Puro</strong> não tem unidade consumidora própria. Participa apenas:</p>
          <ul className="list-disc list-inside text-blue-800 pl-2">
            <li>Do programa de indicação (MLM) — ganha comissões por indicar outros cooperados.</li>
            <li>Do CooperToken Clube — recebe tokens convertíveis em desconto/benefícios.</li>
          </ul>
          <p className="text-xs text-blue-700 mt-2">
            Se o cooperado <strong>tem</strong> unidade consumidora, use o <Link href="/dashboard/cooperados/novo" className="underline">wizard completo</Link>.
          </p>
        </CardContent>
      </Card>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="text-base font-medium text-gray-700 flex items-center gap-2">
            <UserPlus className="w-4 h-4" /> Dados do cooperado
          </CardTitle>
          <CardDescription>Campos com * são obrigatórios.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label>Tipo de pessoa</Label>
              <div className="flex gap-4 text-sm">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    value="PF"
                    checked={form.tipoPessoa === 'PF'}
                    onChange={() => set('tipoPessoa', 'PF')}
                  />
                  Pessoa Física
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    value="PJ"
                    checked={form.tipoPessoa === 'PJ'}
                    onChange={() => set('tipoPessoa', 'PJ')}
                  />
                  Pessoa Jurídica
                </label>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1 col-span-2">
                <Label htmlFor="nomeCompleto">
                  {form.tipoPessoa === 'PJ' ? 'Razão social *' : 'Nome completo *'}
                </Label>
                <Input
                  id="nomeCompleto"
                  value={form.nomeCompleto}
                  onChange={(e) => set('nomeCompleto', e.target.value)}
                  placeholder={form.tipoPessoa === 'PJ' ? 'Empresa LTDA' : 'João da Silva'}
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="cpf">{form.tipoPessoa === 'PJ' ? 'CNPJ *' : 'CPF *'}</Label>
                <Input
                  id="cpf"
                  value={form.cpf}
                  onChange={(e) => set('cpf', formatarCpfCnpj(e.target.value, form.tipoPessoa))}
                  placeholder={form.tipoPessoa === 'PJ' ? '00.000.000/0001-00' : '000.000.000-00'}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="telefone">Telefone (WhatsApp)</Label>
                <Input
                  id="telefone"
                  value={form.telefone}
                  onChange={(e) => set('telefone', e.target.value)}
                  placeholder="27 9 9999-9999"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
                placeholder="cooperado@example.com"
                required
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="codigoIndicacao">
                Código de indicação <span className="text-xs text-gray-400">(opcional — se foi indicado por outro cooperado)</span>
              </Label>
              <Input
                id="codigoIndicacao"
                value={form.codigoIndicacao}
                onChange={(e) => set('codigoIndicacao', e.target.value)}
                placeholder="CÓDIGO-INDICAÇÃO"
              />
            </div>

            {form.tipoPessoa === 'PJ' && (
              <>
                <hr className="my-2" />
                <p className="text-sm font-medium text-gray-600">Representante Legal</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Nome</Label>
                    <Input value={form.representanteLegalNome} onChange={(e) => set('representanteLegalNome', e.target.value)} placeholder="Nome do representante" />
                  </div>
                  <div className="space-y-1">
                    <Label>Cargo</Label>
                    <Input value={form.representanteLegalCargo} onChange={(e) => set('representanteLegalCargo', e.target.value)} placeholder="Sócio, Administrador..." />
                  </div>
                  <div className="space-y-1 col-span-2">
                    <Label>CPF do representante</Label>
                    <Input value={form.representanteLegalCpf} onChange={(e) => set('representanteLegalCpf', formatarCpfCnpj(e.target.value, 'PF'))} placeholder="000.000.000-00" />
                  </div>
                </div>
              </>
            )}

            {erro && <p className="text-sm text-red-600">{erro}</p>}
            {sucesso && <p className="text-sm text-green-600">{sucesso}</p>}

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={salvando}>
                {salvando ? 'Salvando...' : 'Cadastrar como Indicador Puro (SEM_UC)'}
              </Button>
              <Link href="/dashboard/cooperados/novo">
                <Button type="button" variant="outline">
                  Cancelar (ir ao wizard completo)
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
