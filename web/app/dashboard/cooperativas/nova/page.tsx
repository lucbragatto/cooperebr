'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Sun } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

const TIPOS = [
  { valor: 'COOPERATIVA', label: '🏢 Cooperativa' },
  { valor: 'CONSORCIO', label: '🤝 Consórcio' },
  { valor: 'ASSOCIACAO', label: '🏛️ Associação' },
  { valor: 'CONDOMINIO', label: '🏘️ Condomínio' },
];

export default function NovaCooperativaPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    nome: '', cnpj: '', telefone: '', email: '',
    endereco: '', numero: '', bairro: '', cidade: '', estado: '', cep: '',
    tipoParceiro: 'COOPERATIVA',
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  // Dialog usina inline
  const [dialogUsina, setDialogUsina] = useState(false);
  const [novoParceiroId, setNovoParceiroId] = useState('');
  const [usinaForm, setUsinaForm] = useState({ nome: '', potenciaKwp: '', cidade: '', estado: '' });
  const [salvandoUsina, setSalvandoUsina] = useState(false);
  const [usinaErro, setUsinaErro] = useState('');

  // Dialog espera
  const [dialogEspera, setDialogEspera] = useState(false);
  const [qtdEspera, setQtdEspera] = useState(0);
  const [usinaIdCriada, setUsinaIdCriada] = useState('');
  const [resultadoEspera, setResultadoEspera] = useState('');

  function set(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(''); setSucesso('');

    if (!form.nome.trim() || !form.cnpj.trim()) {
      setErro('Nome e CNPJ são obrigatórios.');
      return;
    }

    setSalvando(true);
    try {
      const { data } = await api.post('/cooperativas', form);
      setSucesso('Parceiro cadastrado com sucesso!');
      setNovoParceiroId(data.id);
      setDialogUsina(true);
    } catch (e: any) {
      setErro(e?.response?.data?.message || 'Erro ao cadastrar parceiro.');
    } finally {
      setSalvando(false);
    }
  }

  async function handleSalvarUsina() {
    if (!usinaForm.nome.trim() || !usinaForm.potenciaKwp) {
      setUsinaErro('Nome e potência são obrigatórios.');
      return;
    }
    setSalvandoUsina(true);
    setUsinaErro('');
    try {
      const { data: usina } = await api.post('/usinas', {
        nome: usinaForm.nome,
        potenciaKwp: Number(usinaForm.potenciaKwp),
        cidade: usinaForm.cidade,
        estado: usinaForm.estado,
        cooperativaId: novoParceiroId,
      });
      setUsinaIdCriada(usina.id);

      // Verificar lista de espera
      try {
        const { data: espera } = await api.get(`/motor-proposta/lista-espera`);
        const aguardando = Array.isArray(espera) ? espera.filter((e: any) => e.status === 'AGUARDANDO') : [];
        if (aguardando.length > 0) {
          setQtdEspera(aguardando.length);
          setDialogUsina(false);
          setDialogEspera(true);
          return;
        }
      } catch {
        // sem lista de espera, ok
      }

      setDialogUsina(false);
      router.push(`/dashboard/cooperativas/${novoParceiroId}`);
    } catch (e: any) {
      setUsinaErro(e?.response?.data?.message || 'Erro ao cadastrar usina.');
    } finally {
      setSalvandoUsina(false);
    }
  }

  async function handleConfirmarEspera() {
    try {
      const { data } = await api.post(`/usinas/${usinaIdCriada}/verificar-espera`);
      const promovidos = data?.promovidos?.length ?? 0;
      setResultadoEspera(`${promovidos} membro(s) promovido(s) para Aguardando Concessionária`);
      setTimeout(() => router.push(`/dashboard/cooperativas/${novoParceiroId}`), 2000);
    } catch {
      setResultadoEspera('Erro ao verificar lista de espera.');
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard/cooperativas">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Voltar
          </Button>
        </Link>
        <h2 className="text-2xl font-bold text-gray-800">Novo Parceiro</h2>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="text-base font-medium text-gray-600">Dados do parceiro</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Nome *</Label>
                <Input value={form.nome} onChange={(e) => set('nome', e.target.value)} placeholder="CoopereBR" required />
              </div>
              <div className="space-y-1">
                <Label>CNPJ *</Label>
                <Input value={form.cnpj} onChange={(e) => set('cnpj', e.target.value)} placeholder="00.000.000/0001-00" required />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Tipo de organização</Label>
                <Select value={form.tipoParceiro} onValueChange={(v) => set('tipoParceiro', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS.map((t) => (
                      <SelectItem key={t.valor} value={t.valor}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Telefone</Label>
                <Input value={form.telefone} onChange={(e) => set('telefone', e.target.value)} placeholder="(27) 99999-0000" />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Email</Label>
              <Input value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="contato@cooperebr.com.br" type="email" />
            </div>

            <hr className="my-2" />
            <p className="text-sm font-medium text-gray-600">Endereço</p>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-1">
                <Label>Rua</Label>
                <Input value={form.endereco} onChange={(e) => set('endereco', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Número</Label>
                <Input value={form.numero} onChange={(e) => set('numero', e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>Bairro</Label>
                <Input value={form.bairro} onChange={(e) => set('bairro', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Cidade</Label>
                <Input value={form.cidade} onChange={(e) => set('cidade', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Estado</Label>
                <Input value={form.estado} onChange={(e) => set('estado', e.target.value)} maxLength={2} placeholder="ES" />
              </div>
            </div>
            <div className="w-1/3 space-y-1">
              <Label>CEP</Label>
              <Input value={form.cep} onChange={(e) => set('cep', e.target.value)} placeholder="29000-000" />
            </div>

            {erro && <p className="text-sm text-red-600">{erro}</p>}
            {sucesso && <p className="text-sm text-green-600">{sucesso}</p>}

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar'}</Button>
              <Link href="/dashboard/cooperativas">
                <Button type="button" variant="outline">Cancelar</Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Dialog: Cadastrar usina? */}
      <Dialog open={dialogUsina} onOpenChange={(open) => {
        if (!open) router.push(`/dashboard/cooperativas/${novoParceiroId}`);
        setDialogUsina(open);
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sun className="h-5 w-5 text-yellow-500" />
              Parceiro criado! Deseja cadastrar uma usina agora?
            </DialogTitle>
            <DialogDescription>
              Cadastre uma usina simplificada para este parceiro.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Nome da usina *</Label>
              <Input value={usinaForm.nome} onChange={(e) => setUsinaForm(p => ({ ...p, nome: e.target.value }))} placeholder="Usina Solar Alpha" />
            </div>
            <div className="space-y-1">
              <Label>Potência (kWp) *</Label>
              <Input type="number" step="0.01" value={usinaForm.potenciaKwp} onChange={(e) => setUsinaForm(p => ({ ...p, potenciaKwp: e.target.value }))} placeholder="500" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Cidade</Label>
                <Input value={usinaForm.cidade} onChange={(e) => setUsinaForm(p => ({ ...p, cidade: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Estado</Label>
                <Input value={usinaForm.estado} onChange={(e) => setUsinaForm(p => ({ ...p, estado: e.target.value }))} maxLength={2} placeholder="ES" />
              </div>
            </div>
            {usinaErro && <p className="text-sm text-red-600">{usinaErro}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogUsina(false); router.push(`/dashboard/cooperativas/${novoParceiroId}`); }}>
              Pular
            </Button>
            <Button onClick={handleSalvarUsina} disabled={salvandoUsina}>
              {salvandoUsina ? 'Salvando...' : 'Sim, cadastrar usina'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Lista de espera */}
      <Dialog open={dialogEspera} onOpenChange={setDialogEspera}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lista de espera</DialogTitle>
            <DialogDescription>
              {qtdEspera} membro(s) na lista de espera serão alocados automaticamente. Confirmar?
            </DialogDescription>
          </DialogHeader>
          {resultadoEspera && (
            <p className={`text-sm font-medium ${resultadoEspera.includes('Erro') ? 'text-red-600' : 'text-green-600'}`}>
              {resultadoEspera}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogEspera(false); router.push(`/dashboard/cooperativas/${novoParceiroId}`); }}>
              Não, pular
            </Button>
            <Button onClick={handleConfirmarEspera} disabled={!!resultadoEspera}>
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
