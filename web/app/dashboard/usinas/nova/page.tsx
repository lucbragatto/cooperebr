'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft } from 'lucide-react';

export default function NovaUsinaPage() {
  const router = useRouter();

  const [form, setForm] = useState({
    nome: '',
    apelidoInterno: '',
    potenciaKwp: '',
    capacidadeKwh: '',
    cidade: '',
    estado: '',
    enderecoLogradouro: '',
    enderecoNumero: '',
    enderecoBairro: '',
    enderecoCep: '',
    distribuidora: '',
    cnpjUsina: '',
    formaAquisicao: '',
    formaPagamentoDono: '',
    valorAluguelFixo: '',
    percentualGeracaoDono: '',
    numeroContratoEdp: '',
    dataContratoEdp: '',
    proprietarioNome: '',
    proprietarioCpfCnpj: '',
    proprietarioTelefone: '',
    proprietarioEmail: '',
    proprietarioTipo: 'PF',
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  function set(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    setSucesso('');

    if (!form.nome.trim() || !form.potenciaKwp || !form.capacidadeKwh || !form.cidade.trim() || !form.estado.trim()) {
      setErro('Nome, potência, capacidade, cidade e estado são obrigatórios.');
      return;
    }

    const potencia = parseFloat(form.potenciaKwp);
    if (isNaN(potencia) || potencia <= 0) {
      setErro('Potência deve ser um número positivo.');
      return;
    }

    const capacidade = parseFloat(form.capacidadeKwh);
    if (isNaN(capacidade) || capacidade <= 0) {
      setErro('Capacidade deve ser um número positivo.');
      return;
    }

    setSalvando(true);
    try {
      const payload: any = {
        nome: form.nome,
        potenciaKwp: potencia,
        capacidadeKwh: capacidade,
        cidade: form.cidade,
        estado: form.estado,
      };
      if (form.apelidoInterno) payload.apelidoInterno = form.apelidoInterno;
      if (form.enderecoLogradouro) payload.enderecoLogradouro = form.enderecoLogradouro;
      if (form.enderecoNumero) payload.enderecoNumero = form.enderecoNumero;
      if (form.enderecoBairro) payload.enderecoBairro = form.enderecoBairro;
      if (form.enderecoCep) payload.enderecoCep = form.enderecoCep;
      if (form.distribuidora) payload.distribuidora = form.distribuidora;
      if (form.cnpjUsina) payload.cnpjUsina = form.cnpjUsina;
      if (form.formaAquisicao) payload.formaAquisicao = form.formaAquisicao;
      if (form.formaPagamentoDono) payload.formaPagamentoDono = form.formaPagamentoDono;
      if (form.formaPagamentoDono === 'FIXO') {
        const valor = parseFloat(form.valorAluguelFixo);
        if (isNaN(valor) || valor <= 0) {
          setErro('valorAluguelFixo é obrigatório (> 0) quando formaPagamentoDono = FIXO.');
          setSalvando(false);
          return;
        }
        payload.valorAluguelFixo = valor;
      }
      if (form.formaPagamentoDono === 'PERCENTUAL') {
        const pct = parseFloat(form.percentualGeracaoDono);
        if (isNaN(pct) || pct <= 0 || pct > 100) {
          setErro('percentualGeracaoDono deve ser entre 0,01 e 100 quando formaPagamentoDono = PERCENTUAL.');
          setSalvando(false);
          return;
        }
        payload.percentualGeracaoDono = pct;
      }
      if (form.numeroContratoEdp) payload.numeroContratoEdp = form.numeroContratoEdp;
      if (form.dataContratoEdp) payload.dataContratoEdp = form.dataContratoEdp;
      if (form.proprietarioNome) payload.proprietarioNome = form.proprietarioNome;
      if (form.proprietarioCpfCnpj) payload.proprietarioCpfCnpj = form.proprietarioCpfCnpj;
      if (form.proprietarioTelefone) payload.proprietarioTelefone = form.proprietarioTelefone;
      if (form.proprietarioEmail) payload.proprietarioEmail = form.proprietarioEmail;
      if (form.proprietarioTipo) payload.proprietarioTipo = form.proprietarioTipo;
      await api.post('/usinas', payload);
      setSucesso('Usina cadastrada com sucesso!');
      setTimeout(() => router.push('/dashboard/usinas'), 1000);
    } catch {
      setErro('Erro ao cadastrar usina.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard/usinas">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Voltar
          </Button>
        </Link>
        <h2 className="text-2xl font-bold text-gray-800">Nova Usina</h2>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="text-base font-medium text-gray-600">
            Dados da usina
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="nome">Nome (razão social ANEEL) *</Label>
                <Input
                  id="nome"
                  value={form.nome}
                  onChange={(e) => set('nome', e.target.value)}
                  placeholder="COOPERE BR - Usina Linhares 2"
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="apelidoInterno">Apelido interno</Label>
                <Input
                  id="apelidoInterno"
                  value={form.apelidoInterno}
                  onChange={(e) => set('apelidoInterno', e.target.value)}
                  placeholder="cooperebr1, cooperebr2"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="potenciaKwp">Potência instalada (kWp) *</Label>
                <Input
                  id="potenciaKwp"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.potenciaKwp}
                  onChange={(e) => set('potenciaKwp', e.target.value)}
                  placeholder="1000.00"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="capacidadeKwh">Capacidade mensal (kWh/mês) *</Label>
                <Input
                  id="capacidadeKwh"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.capacidadeKwh}
                  onChange={(e) => set('capacidadeKwh', e.target.value)}
                  placeholder="157000.00"
                  required
                />
              </div>
            </div>

            <hr className="my-2" />
            <p className="text-sm font-medium text-gray-600">Localização</p>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="cidade">Cidade *</Label>
                <Input
                  id="cidade"
                  value={form.cidade}
                  onChange={(e) => set('cidade', e.target.value)}
                  placeholder="Linhares"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="estado">UF *</Label>
                <Input
                  id="estado"
                  value={form.estado}
                  onChange={(e) => set('estado', e.target.value.toUpperCase())}
                  placeholder="ES"
                  maxLength={2}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-1">
                <Label>Logradouro</Label>
                <Input value={form.enderecoLogradouro} onChange={(e) => set('enderecoLogradouro', e.target.value)} placeholder="Estrada Linhares X Povoação" />
              </div>
              <div className="space-y-1">
                <Label>Número</Label>
                <Input value={form.enderecoNumero} onChange={(e) => set('enderecoNumero', e.target.value)} placeholder="SN" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Bairro</Label>
                <Input value={form.enderecoBairro} onChange={(e) => set('enderecoBairro', e.target.value)} placeholder="Área Rural" />
              </div>
              <div className="space-y-1">
                <Label>CEP</Label>
                <Input value={form.enderecoCep} onChange={(e) => set('enderecoCep', e.target.value)} placeholder="29900-001" />
              </div>
            </div>

            <hr className="my-2" />
            <p className="text-sm font-medium text-gray-600">Contrato distribuidora</p>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Distribuidora</Label>
                <select className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm" value={form.distribuidora} onChange={(e) => set('distribuidora', e.target.value)}>
                  <option value="">— Selecione —</option>
                  <option value="EDP_ES">EDP_ES</option>
                  <option value="EDP_SP">EDP_SP</option>
                  <option value="CEMIG">CEMIG</option>
                  <option value="ENEL_SP">ENEL_SP</option>
                  <option value="LIGHT_RJ">LIGHT_RJ</option>
                  <option value="CELESC">CELESC</option>
                  <option value="OUTRAS">OUTRAS</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label>CNPJ titular EDP (cnpjUsina)</Label>
                <Input value={form.cnpjUsina} onChange={(e) => set('cnpjUsina', e.target.value)} placeholder="00000000000000" maxLength={18} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Número contrato EDP (CUSD/CCER)</Label>
                <Input value={form.numeroContratoEdp} onChange={(e) => set('numeroContratoEdp', e.target.value)} placeholder="EDP-ES-04123/2025" />
              </div>
              <div className="space-y-1">
                <Label>Data contrato EDP</Label>
                <Input type="date" value={form.dataContratoEdp} onChange={(e) => set('dataContratoEdp', e.target.value)} />
              </div>
            </div>

            <hr className="my-2" />
            <p className="text-sm font-medium text-gray-600">Forma de aquisição</p>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Forma de aquisição</Label>
                <select className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm" value={form.formaAquisicao} onChange={(e) => set('formaAquisicao', e.target.value)}>
                  <option value="">— Selecione —</option>
                  <option value="CESSAO">Cessão</option>
                  <option value="ALUGUEL">Aluguel / Arrendamento</option>
                  <option value="PROPRIA">Própria</option>
                </select>
              </div>
              {form.formaAquisicao !== 'PROPRIA' && (
                <div className="space-y-1">
                  <Label>Forma de pagamento ao dono</Label>
                  <select className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm" value={form.formaPagamentoDono} onChange={(e) => set('formaPagamentoDono', e.target.value)}>
                    <option value="">— A definir —</option>
                    <option value="FIXO">Fixo mensal</option>
                    <option value="PERCENTUAL">Percentual sobre geração</option>
                  </select>
                </div>
              )}
            </div>

            {form.formaPagamentoDono === 'FIXO' && (
              <div className="space-y-1">
                <Label htmlFor="valorAluguelFixo">Valor do aluguel/cessão (R$/mês) *</Label>
                <Input
                  id="valorAluguelFixo"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={form.valorAluguelFixo}
                  onChange={(e) => set('valorAluguelFixo', e.target.value)}
                  placeholder="10000.00"
                />
              </div>
            )}

            {form.formaPagamentoDono === 'PERCENTUAL' && (
              <div className="space-y-1">
                <Label htmlFor="percentualGeracaoDono">Percentual da geração ao dono (%) *</Label>
                <Input
                  id="percentualGeracaoDono"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max="100"
                  value={form.percentualGeracaoDono}
                  onChange={(e) => set('percentualGeracaoDono', e.target.value)}
                  placeholder="25.00"
                />
              </div>
            )}

            <hr className="my-2" />
            <p className="text-sm font-medium text-gray-600">Proprietário da Usina</p>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Tipo</Label>
                <select className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm" value={form.proprietarioTipo} onChange={(e) => set('proprietarioTipo', e.target.value)}>
                  <option value="PF">Pessoa Física</option>
                  <option value="PJ">Pessoa Jurídica</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label>Nome do Proprietário</Label>
                <Input value={form.proprietarioNome} onChange={(e) => set('proprietarioNome', e.target.value)} placeholder="Nome completo / Razão social" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>CPF/CNPJ</Label>
                <Input value={form.proprietarioCpfCnpj} onChange={(e) => set('proprietarioCpfCnpj', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Telefone</Label>
                <Input value={form.proprietarioTelefone} onChange={(e) => set('proprietarioTelefone', e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input value={form.proprietarioEmail} onChange={(e) => set('proprietarioEmail', e.target.value)} type="email" />
            </div>

            {erro && <p className="text-sm text-red-600">{erro}</p>}
            {sucesso && <p className="text-sm text-green-600">{sucesso}</p>}

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={salvando}>
                {salvando ? 'Salvando...' : 'Salvar'}
              </Button>
              <Link href="/dashboard/usinas">
                <Button type="button" variant="outline">
                  Cancelar
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
