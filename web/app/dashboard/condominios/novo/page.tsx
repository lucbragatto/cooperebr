'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';

interface Unidade {
  numero: string;
  fracaoIdeal: string;
  percentualFixo: string;
}

interface Administradora {
  id: string;
  razaoSocial: string;
}

export default function NovoCondominioPage() {
  const router = useRouter();
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [administradoras, setAdministradoras] = useState<Administradora[]>([]);

  const [form, setForm] = useState({
    nome: '',
    cnpj: '',
    endereco: '',
    cidade: '',
    estado: '',
    cep: '',
    administradoraId: '',
    sindicoNome: '',
    sindicoCpf: '',
    sindicoEmail: '',
    sindicoTelefone: '',
    modeloRateio: 'PROPORCIONAL_CONSUMO',
    excedentePolitica: 'CREDITO_PROXIMO_MES',
    excedentePixChave: '',
    excedentePixTipo: '',
    aliquotaIR: '0',
    aliquotaPIS: '0',
    aliquotaCOFINS: '0',
    taxaAdministrativa: '0',
  });

  const [unidades, setUnidades] = useState<Unidade[]>([{ numero: '', fracaoIdeal: '', percentualFixo: '' }]);

  useEffect(() => {
    api.get<Administradora[]>('/administradoras').then(r => setAdministradoras(r.data)).catch(() => {});
  }, []);

  function setField(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function addUnidade() {
    setUnidades(prev => [...prev, { numero: '', fracaoIdeal: '', percentualFixo: '' }]);
  }

  function removeUnidade(idx: number) {
    setUnidades(prev => prev.filter((_, i) => i !== idx));
  }

  function updateUnidade(idx: number, field: keyof Unidade, value: string) {
    setUnidades(prev => prev.map((u, i) => i === idx ? { ...u, [field]: value } : u));
  }

  async function salvar() {
    if (!form.nome || !form.endereco || !form.cidade || !form.estado) {
      setErro('Preencha os campos obrigatorios: nome, endereco, cidade e estado.');
      return;
    }
    setSalvando(true);
    setErro('');
    try {
      const { data: cond } = await api.post('/condominios', {
        ...form,
        administradoraId: form.administradoraId || undefined,
        aliquotaIR: Number(form.aliquotaIR),
        aliquotaPIS: Number(form.aliquotaPIS),
        aliquotaCOFINS: Number(form.aliquotaCOFINS),
        taxaAdministrativa: Number(form.taxaAdministrativa),
      });

      // Adicionar unidades
      for (const u of unidades) {
        if (!u.numero.trim()) continue;
        await api.post(`/condominios/${cond.id}/unidades`, {
          numero: u.numero,
          fracaoIdeal: u.fracaoIdeal ? Number(u.fracaoIdeal) : undefined,
          percentualFixo: u.percentualFixo ? Number(u.percentualFixo) : undefined,
        });
      }

      router.push(`/dashboard/condominios/${cond.id}`);
    } catch (err: any) {
      setErro(err?.response?.data?.message || 'Erro ao criar condominio');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard/condominios">
          <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <h2 className="text-2xl font-bold text-gray-800">Novo Condominio</h2>
      </div>

      {erro && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{erro}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Dados basicos */}
        <Card>
          <CardHeader><CardTitle className="text-base">Dados Basicos</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-sm font-medium text-gray-700">Nome *</label>
              <Input value={form.nome} onChange={e => setField('nome', e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">CNPJ</label>
              <Input value={form.cnpj} onChange={e => setField('cnpj', e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Endereco *</label>
              <Input value={form.endereco} onChange={e => setField('endereco', e.target.value)} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-sm font-medium text-gray-700">Cidade *</label>
                <Input value={form.cidade} onChange={e => setField('cidade', e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">UF *</label>
                <Input value={form.estado} onChange={e => setField('estado', e.target.value)} maxLength={2} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">CEP</label>
                <Input value={form.cep} onChange={e => setField('cep', e.target.value)} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Administradora</label>
              <select value={form.administradoraId} onChange={e => setField('administradoraId', e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm">
                <option value="">Nenhuma</option>
                {administradoras.map(a => <option key={a.id} value={a.id}>{a.razaoSocial}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-sm font-medium text-gray-700">Sindico</label>
                <Input value={form.sindicoNome} onChange={e => setField('sindicoNome', e.target.value)} placeholder="Nome" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Tel. Sindico</label>
                <Input value={form.sindicoTelefone} onChange={e => setField('sindicoTelefone', e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Configuracao */}
        <Card>
          <CardHeader><CardTitle className="text-base">Configuracao</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-sm font-medium text-gray-700">Modelo de Rateio</label>
              <select value={form.modeloRateio} onChange={e => setField('modeloRateio', e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm">
                <option value="PROPORCIONAL_CONSUMO">Proporcional ao Consumo</option>
                <option value="IGUALITARIO">Igualitario</option>
                <option value="FRACAO_IDEAL">Fracao Ideal</option>
                <option value="PERSONALIZADO">Personalizado</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Politica de Excedente</label>
              <select value={form.excedentePolitica} onChange={e => setField('excedentePolitica', e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm">
                <option value="CREDITO_PROXIMO_MES">Credito no Proximo Mes</option>
                <option value="PIX_MENSAL">PIX Mensal</option>
                <option value="ABATER_TAXA_CONDOMINIO">Abater Taxa Condominial</option>
              </select>
            </div>
            {form.excedentePolitica === 'PIX_MENSAL' && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-sm font-medium text-gray-700">Chave PIX</label>
                  <Input value={form.excedentePixChave} onChange={e => setField('excedentePixChave', e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Tipo Chave</label>
                  <select value={form.excedentePixTipo} onChange={e => setField('excedentePixTipo', e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm">
                    <option value="">Selecionar...</option>
                    <option value="CPF">CPF</option>
                    <option value="CNPJ">CNPJ</option>
                    <option value="EMAIL">Email</option>
                    <option value="TELEFONE">Telefone</option>
                    <option value="ALEATORIA">Aleatoria</option>
                  </select>
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-sm font-medium text-gray-700">Aliquota IR %</label>
                <Input type="number" step="0.01" value={form.aliquotaIR} onChange={e => setField('aliquotaIR', e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Taxa Administrativa %</label>
                <Input type="number" step="0.01" value={form.taxaAdministrativa} onChange={e => setField('taxaAdministrativa', e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Unidades */}
      <Card className="mt-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Unidades</CardTitle>
            <Button variant="outline" size="sm" onClick={addUnidade}><Plus className="h-4 w-4 mr-1" /> Adicionar</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {unidades.map((u, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input placeholder="Numero/Apto" value={u.numero} onChange={e => updateUnidade(i, 'numero', e.target.value)} className="w-40" />
                <Input type="number" placeholder="Fracao ideal" value={u.fracaoIdeal} onChange={e => updateUnidade(i, 'fracaoIdeal', e.target.value)} className="w-32" />
                <Input type="number" placeholder="% fixo" value={u.percentualFixo} onChange={e => updateUnidade(i, 'percentualFixo', e.target.value)} className="w-32" />
                {unidades.length > 1 && (
                  <Button variant="ghost" size="sm" onClick={() => removeUnidade(i)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 flex justify-end">
        <Button onClick={salvar} disabled={salvando}>{salvando ? 'Salvando...' : 'Criar Condominio'}</Button>
      </div>
    </div>
  );
}
