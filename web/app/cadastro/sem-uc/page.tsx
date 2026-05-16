'use client';

/**
 * Bloco C (16/05/2026) — Cadastro público SEM unidade consumidora.
 * Para indicadores puros (MLM) e participantes do CooperToken Clube sem UC própria.
 */

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Sun, ArrowLeft, Info, Loader2, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

function formatarDoc(valor: string, tipo: 'PF' | 'PJ'): string {
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

function CadastroSemUcContent() {
  const searchParams = useSearchParams();
  const tenantParam = searchParams.get('tenant') ?? '';
  const codigoRef = searchParams.get('ref') ?? '';

  const [form, setForm] = useState({
    tipoPessoa: 'PF' as 'PF' | 'PJ',
    nome: '',
    cpf: '',
    email: '',
    telefone: '',
    codigoRef,
    representanteLegalNome: '',
    representanteLegalCpf: '',
    representanteLegalCargo: '',
  });
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState(false);
  const [dadosSucesso, setDadosSucesso] = useState<{ id: string; codigoIndicacao?: string } | null>(null);

  function set<K extends keyof typeof form>(field: K, value: (typeof form)[K]) {
    setForm((p) => ({ ...p, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro('');

    if (!form.nome.trim()) return setErro(form.tipoPessoa === 'PJ' ? 'Razão social é obrigatória.' : 'Nome é obrigatório.');
    if (!form.cpf.trim()) return setErro(form.tipoPessoa === 'PJ' ? 'CNPJ é obrigatório.' : 'CPF é obrigatório.');
    if (!form.email.trim()) return setErro('Email é obrigatório.');
    if (!tenantParam) return setErro('Parceiro não identificado (use ?tenant=…).');

    setEnviando(true);
    try {
      const url = new URL(`${API_URL}/publico/cadastro-sem-uc`);
      url.searchParams.set('tenant', tenantParam);
      const payload: Record<string, unknown> = {
        nome: form.nome,
        cpf: form.cpf.replace(/\D/g, ''),
        email: form.email,
        tipoPessoa: form.tipoPessoa,
      };
      if (form.telefone) payload.telefone = form.telefone.replace(/\D/g, '');
      if (form.codigoRef) payload.codigoRef = form.codigoRef;
      if (form.tipoPessoa === 'PJ') {
        if (form.representanteLegalNome) payload.representanteLegalNome = form.representanteLegalNome;
        if (form.representanteLegalCpf) payload.representanteLegalCpf = form.representanteLegalCpf.replace(/\D/g, '');
        if (form.representanteLegalCargo) payload.representanteLegalCargo = form.representanteLegalCargo;
      }
      const res = await fetch(url.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.message ?? data?.error ?? 'Falha ao cadastrar');
      }
      setDadosSucesso(data.data);
      setSucesso(true);
    } catch (err: any) {
      setErro(err?.message ?? 'Erro inesperado.');
    } finally {
      setEnviando(false);
    }
  }

  if (sucesso) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex flex-col">
        <header className="py-6 px-4 text-center">
          <div className="flex items-center justify-center gap-2">
            <Sun className="h-8 w-8 text-green-600" />
            <h1 className="text-2xl font-bold text-green-700">CoopereBR</h1>
          </div>
        </header>
        <main className="flex-1 flex items-start justify-center px-4 pb-12">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="flex justify-center mb-2">
                <CheckCircle className="w-12 h-12 text-green-600" />
              </div>
              <CardTitle className="text-xl text-green-800">Cadastro recebido!</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-gray-700">
              <p>
                Você foi cadastrado(a) como <strong>Indicador Puro</strong> da CoopereBR. Em breve, um(a) colaborador(a) entrará em contato para confirmar seus dados e enviar seu <strong>código de indicação</strong>.
              </p>
              {dadosSucesso?.codigoIndicacao && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-xs text-gray-600">Seu código de indicação:</p>
                  <p className="font-mono font-semibold text-green-700 break-all">{dadosSucesso.codigoIndicacao}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex flex-col">
      <header className="py-6 px-4 text-center">
        <div className="flex items-center justify-center gap-2">
          <Sun className="h-8 w-8 text-green-600" />
          <h1 className="text-2xl font-bold text-green-700">CoopereBR</h1>
        </div>
      </header>

      <main className="flex-1 flex items-start justify-center px-4 pb-12">
        <Card className="w-full max-w-md">
          <CardHeader>
            <Link href={tenantParam ? `/cadastro?tenant=${tenantParam}${codigoRef ? `&ref=${codigoRef}` : ''}` : '/cadastro'} className="inline-flex items-center text-xs text-gray-500 hover:text-gray-700 mb-2">
              <ArrowLeft className="w-3 h-3 mr-1" /> Voltar pro cadastro completo
            </Link>
            <CardTitle className="text-xl text-green-800">Cadastro Indicador Puro</CardTitle>
            <CardDescription>Sem unidade consumidora própria — apenas para receber tokens e indicar amigos.</CardDescription>
          </CardHeader>

          <CardContent>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900 flex gap-2 mb-4">
              <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>
                Se você <strong>tem uma conta de luz</strong> e quer economizar nela,
                <Link href={tenantParam ? `/cadastro?tenant=${tenantParam}${codigoRef ? `&ref=${codigoRef}` : ''}` : '/cadastro'} className="underline ml-1">use o cadastro completo</Link>.
                Este formulário é só pra quem quer participar como indicador (MLM) e/ou Clube de Tokens.
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="space-y-1">
                <Label>Tipo de pessoa</Label>
                <div className="flex gap-4 text-sm">
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input type="radio" value="PF" checked={form.tipoPessoa === 'PF'} onChange={() => set('tipoPessoa', 'PF')} />
                    Pessoa Física
                  </label>
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input type="radio" value="PJ" checked={form.tipoPessoa === 'PJ'} onChange={() => set('tipoPessoa', 'PJ')} />
                    Pessoa Jurídica
                  </label>
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="nome">{form.tipoPessoa === 'PJ' ? 'Razão social *' : 'Nome completo *'}</Label>
                <Input id="nome" value={form.nome} onChange={(e) => set('nome', e.target.value)} required autoFocus />
              </div>

              <div className="space-y-1">
                <Label htmlFor="cpf">{form.tipoPessoa === 'PJ' ? 'CNPJ *' : 'CPF *'}</Label>
                <Input
                  id="cpf"
                  value={form.cpf}
                  onChange={(e) => set('cpf', formatarDoc(e.target.value, form.tipoPessoa))}
                  placeholder={form.tipoPessoa === 'PJ' ? '00.000.000/0001-00' : '000.000.000-00'}
                  required
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="email">Email *</Label>
                <Input id="email" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} required />
              </div>

              <div className="space-y-1">
                <Label htmlFor="telefone">WhatsApp</Label>
                <Input id="telefone" value={form.telefone} onChange={(e) => set('telefone', e.target.value)} placeholder="27 9 9999-9999" />
              </div>

              {form.tipoPessoa === 'PJ' && (
                <>
                  <hr className="my-2" />
                  <p className="text-xs font-medium text-gray-600">Representante legal</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Nome</Label>
                      <Input value={form.representanteLegalNome} onChange={(e) => set('representanteLegalNome', e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Cargo</Label>
                      <Input value={form.representanteLegalCargo} onChange={(e) => set('representanteLegalCargo', e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">CPF do representante</Label>
                    <Input value={form.representanteLegalCpf} onChange={(e) => set('representanteLegalCpf', formatarDoc(e.target.value, 'PF'))} />
                  </div>
                </>
              )}

              <div className="space-y-1">
                <Label htmlFor="codigoRef">Código de indicação (se foi indicado)</Label>
                <Input id="codigoRef" value={form.codigoRef} onChange={(e) => set('codigoRef', e.target.value)} placeholder="opcional" />
              </div>

              {erro && <p className="text-sm text-red-600">{erro}</p>}

              <Button type="submit" className="w-full bg-green-600 hover:bg-green-700" disabled={enviando}>
                {enviando ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando…
                  </>
                ) : (
                  'Cadastrar como Indicador Puro'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

export default function CadastroSemUcPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin w-6 h-6 text-green-600" /></div>}>
      <CadastroSemUcContent />
    </Suspense>
  );
}
