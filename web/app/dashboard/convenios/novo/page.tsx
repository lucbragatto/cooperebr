'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';

const tipoOpcoes = [
  { value: 'CONDOMINIO', label: 'Condomínio' },
  { value: 'ADMINISTRADORA', label: 'Administradora' },
  { value: 'ASSOCIACAO', label: 'Associação' },
  { value: 'SINDICATO', label: 'Sindicato' },
  { value: 'EMPRESA', label: 'Empresa' },
  { value: 'CLUBE', label: 'Clube' },
  { value: 'OUTRO', label: 'Outro' },
];

interface Faixa {
  minMembros: number;
  maxMembros: number | null;
  descontoMembros: number;
  descontoConveniado: number;
}

export default function NovoConvenioPage() {
  const router = useRouter();
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const [form, setForm] = useState({
    nome: '',
    tipo: 'OUTRO',
    cnpj: '',
    email: '',
    telefone: '',
    conveniadoNome: '',
    conveniadoCpf: '',
    conveniadoEmail: '',
    conveniadoTelefone: '',
    criarCooperadoSemUc: true,
    registrarComoIndicacao: true,
    diaEnvioRelatorio: 5,
    tierMinimoClube: '',
    modalidade: 'STANDALONE',
    taxaAprovacaoSisgd: '',
  });

  const [faixas, setFaixas] = useState<Faixa[]>([
    { minMembros: 1, maxMembros: 2, descontoMembros: 3, descontoConveniado: 1 },
    { minMembros: 3, maxMembros: 6, descontoMembros: 5, descontoConveniado: 2.5 },
    { minMembros: 7, maxMembros: 11, descontoMembros: 8, descontoConveniado: 4 },
    { minMembros: 12, maxMembros: null, descontoMembros: 12, descontoConveniado: 6 },
  ]);

  function setField(field: string, value: any) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function addFaixa() {
    const last = faixas[faixas.length - 1];
    setFaixas([...faixas, {
      minMembros: (last?.maxMembros ?? 0) + 1,
      maxMembros: null,
      descontoMembros: 0,
      descontoConveniado: 0,
    }]);
  }

  function removeFaixa(i: number) {
    setFaixas(faixas.filter((_, idx) => idx !== i));
  }

  function updateFaixa(i: number, field: keyof Faixa, value: any) {
    setFaixas(faixas.map((f, idx) => idx === i ? { ...f, [field]: value } : f));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    setSalvando(true);

    try {
      const payload: any = {
        nome: form.nome,
        tipo: form.tipo,
        cnpj: form.cnpj || undefined,
        email: form.email || undefined,
        telefone: form.telefone || undefined,
        conveniadoNome: form.conveniadoNome || undefined,
        conveniadoCpf: form.conveniadoCpf || undefined,
        conveniadoEmail: form.conveniadoEmail || undefined,
        conveniadoTelefone: form.conveniadoTelefone || undefined,
        criarCooperadoSemUc: form.criarCooperadoSemUc,
        registrarComoIndicacao: form.registrarComoIndicacao,
        diaEnvioRelatorio: form.diaEnvioRelatorio,
        tierMinimoClube: form.tierMinimoClube || undefined,
        modalidade: form.modalidade,
        taxaAprovacaoSisgd: form.taxaAprovacaoSisgd ? parseFloat(form.taxaAprovacaoSisgd) : undefined,
        configBeneficio: {
          criterio: 'MEMBROS_ATIVOS',
          efeitoMudancaFaixa: 'SOMENTE_PROXIMAS',
          faixas,
        },
      };

      const res = await api.post('/convenios', payload);
      router.push(`/dashboard/convenios/${res.data.id}`);
    } catch (err: any) {
      setErro(err.response?.data?.message ?? 'Erro ao criar convênio');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/convenios">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <h1 className="text-2xl font-bold">Novo Convênio</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {erro && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">{erro}</div>
        )}

        <Card>
          <CardHeader><CardTitle>Dados do Convênio</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Nome *</Label>
              <Input value={form.nome} onChange={e => setField('nome', e.target.value)} required />
            </div>
            <div>
              <Label>Tipo *</Label>
              <select
                className="w-full border rounded-md px-3 py-2"
                value={form.tipo}
                onChange={e => setField('tipo', e.target.value)}
              >
                {tipoOpcoes.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <Label>CNPJ</Label>
              <Input value={form.cnpj} onChange={e => setField('cnpj', e.target.value)} />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={e => setField('email', e.target.value)} />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input value={form.telefone} onChange={e => setField('telefone', e.target.value)} />
            </div>
            <div>
              <Label>Dia Envio Relatório</Label>
              <Input type="number" min={1} max={28} value={form.diaEnvioRelatorio} onChange={e => setField('diaEnvioRelatorio', parseInt(e.target.value))} />
            </div>
            <div>
              <Label>Tier mínimo do Clube de Vantagens</Label>
              <select className="w-full border rounded-md px-3 py-2" value={form.tierMinimoClube} onChange={e => setField('tierMinimoClube', e.target.value)}>
                <option value="">Sem requisito</option>
                <option value="BRONZE">Bronze</option>
                <option value="PRATA">Prata</option>
                <option value="OURO">Ouro</option>
                <option value="DIAMANTE">Diamante</option>
              </select>
            </div>
            <div>
              <Label>Modalidade</Label>
              <div className="flex gap-4 mt-1">
                <label className="flex items-center gap-2">
                  <input type="radio" name="modalidade" value="STANDALONE" checked={form.modalidade === 'STANDALONE'} onChange={e => setField('modalidade', e.target.value)} />
                  <span className="text-sm">Standalone (só meus membros)</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" name="modalidade" value="GLOBAL" checked={form.modalidade === 'GLOBAL'} onChange={e => setField('modalidade', e.target.value)} />
                  <span className="text-sm">Global (rede SISGD)</span>
                </label>
              </div>
            </div>
            {form.modalidade === 'GLOBAL' && (
              <>
                <div className="col-span-2 bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded text-sm">
                  Convênios globais serão enviados para aprovação do SISGD antes de ficarem disponíveis na rede.
                </div>
                <div>
                  <Label>Taxa de aprovação SISGD (R$)</Label>
                  <Input type="number" min={0} step={0.01} value={form.taxaAprovacaoSisgd} onChange={e => setField('taxaAprovacaoSisgd', e.target.value)} placeholder="0.00" />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Conveniado (Representante)</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Nome do Conveniado</Label>
              <Input value={form.conveniadoNome} onChange={e => setField('conveniadoNome', e.target.value)} />
            </div>
            <div>
              <Label>CPF</Label>
              <Input value={form.conveniadoCpf} onChange={e => setField('conveniadoCpf', e.target.value)} />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={form.conveniadoEmail} onChange={e => setField('conveniadoEmail', e.target.value)} />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input value={form.conveniadoTelefone} onChange={e => setField('conveniadoTelefone', e.target.value)} />
            </div>
            <div className="col-span-2 flex items-center gap-4">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.criarCooperadoSemUc} onChange={e => setField('criarCooperadoSemUc', e.target.checked)} />
                <span className="text-sm">Criar cooperado SEM_UC para o conveniado</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.registrarComoIndicacao} onChange={e => setField('registrarComoIndicacao', e.target.checked)} />
                <span className="text-sm">Registrar membros como indicações do conveniado</span>
              </label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Faixas de Desconto Progressivo</CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={addFaixa}>
                <Plus className="h-4 w-4 mr-1" /> Faixa
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="grid grid-cols-5 gap-2 text-sm font-medium text-muted-foreground">
                <div>Mín. Membros</div>
                <div>Máx. Membros</div>
                <div>Desc. Membros (%)</div>
                <div>Desc. Conveniado (%)</div>
                <div></div>
              </div>
              {faixas.map((f, i) => (
                <div key={i} className="grid grid-cols-5 gap-2">
                  <Input type="number" min={0} value={f.minMembros} onChange={e => updateFaixa(i, 'minMembros', parseInt(e.target.value))} />
                  <Input type="number" min={0} value={f.maxMembros ?? ''} placeholder="Sem limite" onChange={e => updateFaixa(i, 'maxMembros', e.target.value ? parseInt(e.target.value) : null)} />
                  <Input type="number" min={0} max={100} step={0.1} value={f.descontoMembros} onChange={e => updateFaixa(i, 'descontoMembros', parseFloat(e.target.value))} />
                  <Input type="number" min={0} max={100} step={0.1} value={f.descontoConveniado} onChange={e => updateFaixa(i, 'descontoConveniado', parseFloat(e.target.value))} />
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeFaixa(i)} disabled={faixas.length <= 1}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Link href="/dashboard/convenios">
            <Button type="button" variant="outline">Cancelar</Button>
          </Link>
          <Button type="submit" disabled={salvando}>
            {salvando ? 'Salvando...' : 'Criar Convênio'}
          </Button>
        </div>
      </form>
    </div>
  );
}
