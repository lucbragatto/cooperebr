'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Building, Users, Zap, Trash2, Plus, RefreshCw } from 'lucide-react';
import Link from 'next/link';

interface Unidade {
  id: string;
  numero: string;
  fracaoIdeal: number | null;
  percentualFixo: number | null;
  ativo: boolean;
  cooperado?: { id: string; nomeCompleto: string; email: string; telefone: string } | null;
}

interface Condominio {
  id: string;
  nome: string;
  cnpj: string | null;
  endereco: string;
  cidade: string;
  estado: string;
  cep: string | null;
  modeloRateio: string;
  excedentePolitica: string;
  excedentePixChave: string | null;
  excedentePixTipo: string | null;
  aliquotaIR: number;
  aliquotaPIS: number;
  aliquotaCOFINS: number;
  taxaAdministrativa: number;
  ativo: boolean;
  sindicoNome: string | null;
  sindicoCpf: string | null;
  sindicoEmail: string | null;
  sindicoTelefone: string | null;
  administradora?: { razaoSocial: string; cnpj: string } | null;
  unidades: Unidade[];
}

const RATEIO_LABELS: Record<string, string> = {
  PROPORCIONAL_CONSUMO: 'Proporcional ao Consumo',
  IGUALITARIO: 'Igualitário',
  FRACAO_IDEAL: 'Fração Ideal',
  PERSONALIZADO: 'Personalizado',
};

const EXCEDENTE_LABELS: Record<string, string> = {
  CREDITO_PROXIMO_MES: 'Crédito no Próximo Mês',
  PIX_MENSAL: 'PIX Mensal',
  ABATER_TAXA_CONDOMINIO: 'Abater Taxa Condominial',
};

export default function CondominioDetalhePage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [cond, setCond] = useState<Condominio | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [novaUnidade, setNovaUnidade] = useState({ numero: '', fracaoIdeal: '', percentualFixo: '' });
  const [adicionando, setAdicionando] = useState(false);
  const [simulandoRateio, setSimulandoRateio] = useState(false);
  const [energiaSimulacao, setEnergiaSimulacao] = useState('1000');
  const [resultadoRateio, setResultadoRateio] = useState<any[]>([]);

  useEffect(() => {
    if (!id) return;
    api.get<Condominio>(`/condominios/${id}`)
      .then(r => setCond(r.data))
      .catch(() => setErro('Erro ao carregar condomínio'))
      .finally(() => setCarregando(false));
  }, [id]);

  async function adicionarUnidade() {
    if (!novaUnidade.numero.trim()) return;
    setAdicionando(true);
    try {
      await api.post(`/condominios/${id}/unidades`, {
        numero: novaUnidade.numero,
        fracaoIdeal: novaUnidade.fracaoIdeal ? Number(novaUnidade.fracaoIdeal) : undefined,
        percentualFixo: novaUnidade.percentualFixo ? Number(novaUnidade.percentualFixo) : undefined,
      });
      const r = await api.get<Condominio>(`/condominios/${id}`);
      setCond(r.data);
      setNovaUnidade({ numero: '', fracaoIdeal: '', percentualFixo: '' });
    } catch (err: any) {
      setErro(err?.response?.data?.message || 'Erro ao adicionar unidade');
    } finally {
      setAdicionando(false);
    }
  }

  async function removerUnidade(unidadeId: string) {
    if (!confirm('Remover esta unidade?')) return;
    try {
      await api.delete(`/condominios/${id}/unidades/${unidadeId}`);
      setCond(prev => prev ? { ...prev, unidades: prev.unidades.filter(u => u.id !== unidadeId) } : prev);
    } catch (err: any) {
      setErro(err?.response?.data?.message || 'Erro ao remover unidade');
    }
  }

  async function simularRateio() {
    setSimulandoRateio(true);
    try {
      const r = await api.post(`/condominios/${id}/rateio`, { energiaTotal: Number(energiaSimulacao) });
      setResultadoRateio(r.data);
    } catch (err: any) {
      setErro(err?.response?.data?.message || 'Erro ao simular rateio');
    } finally {
      setSimulandoRateio(false);
    }
  }

  async function desativar() {
    if (!confirm('Desativar este condomínio?')) return;
    setSalvando(true);
    try {
      await api.delete(`/condominios/${id}`);
      router.push('/dashboard/condominios');
    } catch (err: any) {
      setErro(err?.response?.data?.message || 'Erro ao desativar');
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-gray-200 animate-pulse rounded w-1/3" />
        <div className="grid grid-cols-2 gap-4">
          {[1, 2].map(i => <div key={i} className="h-40 bg-gray-200 animate-pulse rounded" />)}
        </div>
      </div>
    );
  }

  if (!cond) {
    return <div className="text-center py-12 text-gray-500">Condomínio não encontrado.</div>;
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />Voltar
        </Button>
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Building className="h-6 w-6 text-blue-500" /> {cond.nome}
          </h2>
          <p className="text-sm text-gray-500">{cond.endereco} — {cond.cidade}/{cond.estado}</p>
        </div>
        <Badge className={cond.ativo ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}>
          {cond.ativo ? 'Ativo' : 'Inativo'}
        </Badge>
      </div>

      {erro && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{erro}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Info básicas */}
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Dados do Condomínio</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {cond.cnpj && <div><span className="text-gray-500">CNPJ:</span> <span className="font-medium">{cond.cnpj}</span></div>}
              <div><span className="text-gray-500">CEP:</span> <span className="font-medium">{cond.cep ?? '—'}</span></div>
              <div><span className="text-gray-500">Rateio:</span> <Badge variant="outline">{RATEIO_LABELS[cond.modeloRateio] ?? cond.modeloRateio}</Badge></div>
              <div><span className="text-gray-500">Excedente:</span> <Badge variant="outline">{EXCEDENTE_LABELS[cond.excedentePolitica] ?? cond.excedentePolitica}</Badge></div>
              {cond.excedentePolitica === 'PIX_MENSAL' && cond.excedentePixChave && (
                <div className="col-span-2">
                  <span className="text-gray-500">Chave PIX:</span>{' '}
                  <span className="font-medium font-mono">{cond.excedentePixChave}</span>
                  <Badge variant="outline" className="ml-2 text-xs">{cond.excedentePixTipo}</Badge>
                </div>
              )}
              {cond.administradora && (
                <div className="col-span-2">
                  <span className="text-gray-500">Administradora:</span>{' '}
                  <span className="font-medium">{cond.administradora.razaoSocial}</span>
                </div>
              )}
              {cond.sindicoNome && (
                <div className="col-span-2">
                  <span className="text-gray-500">Síndico:</span>{' '}
                  <span className="font-medium">{cond.sindicoNome}</span>
                  {cond.sindicoTelefone && <span className="text-gray-500"> — {cond.sindicoTelefone}</span>}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Impostos */}
        <Card>
          <CardHeader><CardTitle className="text-base">Impostos sobre Excedente</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">IR:</span>
              <span className="font-medium">{cond.aliquotaIR ?? 0}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">PIS:</span>
              <span className="font-medium">{cond.aliquotaPIS ?? 0}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">COFINS:</span>
              <span className="font-medium">{cond.aliquotaCOFINS ?? 0}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Taxa Adm:</span>
              <span className="font-medium">{cond.taxaAdministrativa ?? 0}%</span>
            </div>
            <div className="border-t pt-2 flex justify-between font-semibold">
              <span>Total Deduções:</span>
              <span className="text-red-600">
                {((cond.aliquotaIR ?? 0) + (cond.aliquotaPIS ?? 0) + (cond.aliquotaCOFINS ?? 0) + (cond.taxaAdministrativa ?? 0)).toFixed(2)}%
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Unidades */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" /> Unidades ({cond.unidades.length})
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Unidade</TableHead>
                <TableHead>Cooperado</TableHead>
                <TableHead>Fração Ideal</TableHead>
                <TableHead>% Fixo</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cond.unidades.map(u => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.numero}</TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {u.cooperado ? <Link href={`/dashboard/cooperados/${u.cooperado.id}`} className="text-blue-600 hover:underline font-medium">{u.cooperado.nomeCompleto}</Link> : <span className="text-gray-400">—</span>}
                  </TableCell>
                  <TableCell className="text-sm">{u.fracaoIdeal != null ? `${(u.fracaoIdeal * 100).toFixed(2)}%` : '—'}</TableCell>
                  <TableCell className="text-sm">{u.percentualFixo != null ? `${u.percentualFixo}%` : '—'}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => removerUnidade(u.id)}>
                      <Trash2 className="h-3 w-3 text-red-500" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {/* Linha de adição */}
              <TableRow>
                <TableCell>
                  <Input placeholder="Ex: Apt 101" value={novaUnidade.numero} onChange={e => setNovaUnidade(p => ({ ...p, numero: e.target.value }))} className="h-8 text-xs" />
                </TableCell>
                <TableCell><span className="text-gray-400 text-xs">—</span></TableCell>
                <TableCell>
                  <Input type="number" step="0.001" placeholder="0.05" value={novaUnidade.fracaoIdeal} onChange={e => setNovaUnidade(p => ({ ...p, fracaoIdeal: e.target.value }))} className="h-8 text-xs w-20" />
                </TableCell>
                <TableCell>
                  <Input type="number" step="0.01" placeholder="5" value={novaUnidade.percentualFixo} onChange={e => setNovaUnidade(p => ({ ...p, percentualFixo: e.target.value }))} className="h-8 text-xs w-20" />
                </TableCell>
                <TableCell>
                  <Button size="sm" variant="outline" onClick={adicionarUnidade} disabled={adicionando || !novaUnidade.numero.trim()}>
                    <Plus className="h-3 w-3 mr-1" /> Adicionar
                  </Button>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Simulador de rateio */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4 text-yellow-500" /> Simulador de Rateio
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 mb-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Energia total (kWh)</label>
              <Input
                type="number"
                value={energiaSimulacao}
                onChange={e => setEnergiaSimulacao(e.target.value)}
                className="w-32"
              />
            </div>
            <div className="pt-5">
              <Button onClick={simularRateio} disabled={simulandoRateio}>
                <RefreshCw className={`h-4 w-4 mr-2 ${simulandoRateio ? 'animate-spin' : ''}`} />
                Simular
              </Button>
            </div>
          </div>

          {resultadoRateio.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Unidade</TableHead>
                  <TableHead>Cooperado</TableHead>
                  <TableHead>kWh Alocado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resultadoRateio.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{r.numero}</TableCell>
                    <TableCell className="text-sm text-gray-600">{r.cooperado?.nomeCompleto ?? '—'}</TableCell>
                    <TableCell className="font-medium text-green-700">{r.kwhAlocado} kWh</TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-gray-50 font-semibold">
                  <TableCell colSpan={2}>Total</TableCell>
                  <TableCell className="text-green-700">
                    {resultadoRateio.reduce((acc, r) => acc + r.kwhAlocado, 0).toFixed(2)} kWh
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Ações */}
      <div className="flex justify-between items-center">
        <Link href={`/dashboard/financeiro/pix-excedente?condominioId=${id}`}>
          <Button variant="outline">
            <Zap className="h-4 w-4 mr-2" /> Histórico de PIX
          </Button>
        </Link>
        <Button variant="destructive" onClick={desativar} disabled={salvando}>
          {salvando ? 'Aguarde...' : 'Desativar Condomínio'}
        </Button>
      </div>
    </div>
  );
}
