'use client';

import { useEffect, useState, useRef, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Zap, DollarSign, TrendingDown, Send, Plus, Search } from 'lucide-react';

// ─── Autocomplete de busca para Cooperado / Condomínio ────────────────────────

interface SearchOption { id: string; label: string; sub?: string }

function BuscaAutoComplete({
  label,
  placeholder,
  endpoint,
  value,
  displayValue,
  onChange,
}: {
  label: string;
  placeholder: string;
  endpoint: string;
  value: string;
  displayValue: string;
  onChange: (id: string, nome: string) => void;
}) {
  const [query, setQuery] = useState(displayValue);
  const [opcoes, setOpcoes] = useState<SearchOption[]>([]);
  const [aberto, setAberto] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setQuery(displayValue); }, [displayValue]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const buscar = useCallback((termo: string) => {
    if (termo.length < 2) { setOpcoes([]); return; }
    setBuscando(true);
    api.get(`${endpoint}?search=${encodeURIComponent(termo)}`)
      .then((r) => {
        const items: SearchOption[] = Array.isArray(r.data)
          ? r.data.slice(0, 10).map((item: any) => ({
              id: item.id,
              label: item.nomeCompleto ?? item.nome ?? item.id,
              sub: item.cpf ?? item.endereco ?? undefined,
            }))
          : (r.data.items ?? []).slice(0, 10).map((item: any) => ({
              id: item.id,
              label: item.nomeCompleto ?? item.nome ?? item.id,
              sub: item.cpf ?? item.endereco ?? undefined,
            }));
        setOpcoes(items);
        setAberto(items.length > 0);
      })
      .catch(() => setOpcoes([]))
      .finally(() => setBuscando(false));
  }, [endpoint]);

  function handleInputChange(v: string) {
    setQuery(v);
    if (value) onChange('', '');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => buscar(v), 350);
  }

  function selecionar(opt: SearchOption) {
    onChange(opt.id, opt.label);
    setQuery(opt.label);
    setAberto(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <label className="text-xs font-medium text-gray-700 block mb-1">{label}</label>
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400" />
        <Input
          value={query}
          onChange={e => handleInputChange(e.target.value)}
          onFocus={() => { if (opcoes.length > 0) setAberto(true); }}
          placeholder={placeholder}
          className="h-8 text-xs pl-7"
        />
        {buscando && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">...</span>}
      </div>
      {aberto && opcoes.length > 0 && (
        <div className="absolute z-50 w-full mt-1 max-h-48 overflow-auto bg-white border border-gray-200 rounded-md shadow-lg">
          {opcoes.map(opt => (
            <button
              key={opt.id}
              type="button"
              onClick={() => selecionar(opt)}
              className="w-full text-left px-3 py-1.5 text-xs hover:bg-blue-50 border-b border-gray-50 last:border-0"
            >
              <span className="font-medium text-gray-800">{opt.label}</span>
              {opt.sub && <span className="ml-2 text-gray-400">{opt.sub}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface Transferencia {
  id: string;
  cooperadoId: string | null;
  condominioId: string | null;
  valorBruto: number;
  valorImpostos: number;
  valorLiquido: number;
  aliquotaIR: number;
  aliquotaPIS: number;
  aliquotaCOFINS: number;
  pixChave: string;
  pixTipo: string;
  mesReferencia: string;
  kwhExcedente: number | null;
  tarifaKwh: number | null;
  status: string;
  observacao: string | null;
  createdAt: string;
}

interface Resumo {
  totalTransferencias: number;
  valorBrutoTotal: number;
  valorLiquidoTotal: number;
  impostosRetidosTotal: number;
  kwhExcedenteTotal: number;
  porStatus: { status: string; quantidade: number; valorLiquido: number }[];
}

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  SIMULADO: { label: 'Simulado', className: 'bg-gray-100 text-gray-700' },
  PENDENTE: { label: 'Pendente', className: 'bg-yellow-100 text-yellow-700' },
  ENVIADO: { label: 'Enviado', className: 'bg-blue-100 text-blue-700' },
  CONFIRMADO: { label: 'Confirmado', className: 'bg-green-100 text-green-700' },
  FALHOU: { label: 'Falhou', className: 'bg-red-100 text-red-700' },
};

const fmt = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

function PixExcedenteContent() {
  const searchParams = useSearchParams();
  const condominioIdParam = searchParams?.get('condominioId');

  const [transferencias, setTransferencias] = useState<Transferencia[]>([]);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [modalAberto, setModalAberto] = useState(false);

  // Form nova transferência
  const [form, setForm] = useState({
    cooperadoId: '',
    condominioId: condominioIdParam ?? '',
    kwhExcedente: '',
    tarifaKwh: '',
    mesReferencia: new Date().toISOString().slice(0, 7),
    aliquotaIR: '0',
    aliquotaPIS: '0',
    aliquotaCOFINS: '0',
    pixChave: '',
    pixTipo: '',
  });
  const [processando, setProcessando] = useState(false);
  const [resultado, setResultado] = useState<any>(null);
  const [cooperadoNome, setCooperadoNome] = useState('');
  const [condominioNome, setCondominioNome] = useState('');

  function carregarDados() {
    setCarregando(true);
    const params = new URLSearchParams();
    if (condominioIdParam) params.set('condominioId', condominioIdParam);

    Promise.all([
      api.get<{ items: Transferencia[] }>(`/financeiro/pix-excedente?${params}`),
      api.get<Resumo>('/financeiro/pix-excedente/resumo'),
    ])
      .then(([listR, resumoR]) => {
        setTransferencias(listR.data.items);
        setResumo(resumoR.data);
      })
      .catch(() => setErro('Erro ao carregar dados'))
      .finally(() => setCarregando(false));
  }

  useEffect(() => { carregarDados(); }, []);

  async function processarPix() {
    if (!form.kwhExcedente || !form.tarifaKwh) {
      setErro('Preencha kWh excedente e tarifa kWh');
      return;
    }
    if (!form.cooperadoId && !form.condominioId) {
      setErro('Informe cooperado ou condomínio');
      return;
    }
    setProcessando(true);
    setErro('');
    try {
      const r = await api.post('/financeiro/pix-excedente', {
        cooperadoId: form.cooperadoId || undefined,
        condominioId: form.condominioId || undefined,
        kwhExcedente: Number(form.kwhExcedente),
        tarifaKwh: Number(form.tarifaKwh),
        mesReferencia: form.mesReferencia,
        aliquotaIR: Number(form.aliquotaIR),
        aliquotaPIS: Number(form.aliquotaPIS),
        aliquotaCOFINS: Number(form.aliquotaCOFINS),
        pixChave: form.pixChave || undefined,
        pixTipo: form.pixTipo || undefined,
      });
      setResultado(r.data);
      carregarDados();
    } catch (err: any) {
      setErro(err?.response?.data?.message || 'Erro ao processar PIX');
    } finally {
      setProcessando(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Zap className="h-6 w-6 text-yellow-500" />
          <h2 className="text-2xl font-bold text-gray-800">PIX Excedente</h2>
        </div>
        <Button onClick={() => { setModalAberto(true); setResultado(null); }}>
          <Plus className="h-4 w-4 mr-2" /> Processar Excedente
        </Button>
      </div>

      {erro && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{erro}</div>}

      {/* Cards resumo */}
      {resumo && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-gray-500 text-xs mb-1"><Send className="h-3 w-3" /> Transferências</div>
              <span className="text-2xl font-bold">{resumo.totalTransferencias}</span>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-gray-500 text-xs mb-1"><DollarSign className="h-3 w-3" /> Valor Bruto</div>
              <span className="text-2xl font-bold text-gray-800">R$ {fmt(resumo.valorBrutoTotal)}</span>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-gray-500 text-xs mb-1"><TrendingDown className="h-3 w-3 text-red-500" /> Impostos</div>
              <span className="text-2xl font-bold text-red-600">R$ {fmt(resumo.impostosRetidosTotal)}</span>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-gray-500 text-xs mb-1"><Zap className="h-3 w-3 text-green-500" /> Valor Líquido</div>
              <span className="text-2xl font-bold text-green-600">R$ {fmt(resumo.valorLiquidoTotal)}</span>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal nova transferência */}
      {modalAberto && (
        <Card className="mb-6 border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="text-base text-blue-800">Processar PIX de Excedente</CardTitle>
          </CardHeader>
          <CardContent>
            {resultado ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="font-semibold text-green-800 mb-3">✅ Transferência registrada!</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-gray-600">kWh Excedente:</span> <span className="font-medium">{resultado.kwhExcedente}</span></div>
                  <div><span className="text-gray-600">Tarifa:</span> <span className="font-medium">R$ {resultado.tarifaKwh}/kWh</span></div>
                  <div><span className="text-gray-600">Valor Bruto:</span> <span className="font-medium">R$ {fmt(resultado.valorBruto)}</span></div>
                  <div><span className="text-gray-600">Impostos:</span> <span className="font-medium text-red-600">-R$ {fmt(resultado.impostos.total)}</span></div>
                  <div className="col-span-2 border-t pt-2">
                    <span className="text-gray-600">Valor Líquido (PIX):</span>{' '}
                    <span className="text-xl font-bold text-green-700">R$ {fmt(resultado.valorLiquido)}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-600">Chave PIX:</span>{' '}
                    <span className="font-mono font-medium">{resultado.pix.chave}</span>
                    <Badge variant="outline" className="ml-2 text-xs">{resultado.pix.tipo}</Badge>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" onClick={() => { setModalAberto(false); setResultado(null); }}>Fechar</Button>
                  <Button size="sm" variant="outline" onClick={() => setResultado(null)}>Nova transferência</Button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <BuscaAutoComplete
                  label="Cooperado"
                  placeholder="Buscar por nome ou CPF..."
                  endpoint="/cooperados"
                  value={form.cooperadoId}
                  displayValue={cooperadoNome}
                  onChange={(id, nome) => { setForm(p => ({ ...p, cooperadoId: id })); setCooperadoNome(nome); }}
                />
                <BuscaAutoComplete
                  label="Condomínio"
                  placeholder="Buscar por nome..."
                  endpoint="/condominios"
                  value={form.condominioId}
                  displayValue={condominioNome}
                  onChange={(id, nome) => { setForm(p => ({ ...p, condominioId: id })); setCondominioNome(nome); }}
                />
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">kWh Excedente *</label>
                  <Input type="number" value={form.kwhExcedente} onChange={e => setForm(p => ({ ...p, kwhExcedente: e.target.value }))} placeholder="500" className="h-8 text-xs" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">Tarifa kWh (R$) *</label>
                  <Input type="number" step="0.01" value={form.tarifaKwh} onChange={e => setForm(p => ({ ...p, tarifaKwh: e.target.value }))} placeholder="0.85" className="h-8 text-xs" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">Mês Referência</label>
                  <Input type="month" value={form.mesReferencia} onChange={e => setForm(p => ({ ...p, mesReferencia: e.target.value }))} className="h-8 text-xs" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">Alíquota IR %</label>
                  <Input type="number" step="0.01" value={form.aliquotaIR} onChange={e => setForm(p => ({ ...p, aliquotaIR: e.target.value }))} className="h-8 text-xs" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">PIS %</label>
                  <Input type="number" step="0.01" value={form.aliquotaPIS} onChange={e => setForm(p => ({ ...p, aliquotaPIS: e.target.value }))} className="h-8 text-xs" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">COFINS %</label>
                  <Input type="number" step="0.01" value={form.aliquotaCOFINS} onChange={e => setForm(p => ({ ...p, aliquotaCOFINS: e.target.value }))} className="h-8 text-xs" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">Tipo Chave PIX</label>
                  <select
                    value={form.pixTipo}
                    onChange={e => setForm(p => ({ ...p, pixTipo: e.target.value, pixChave: '' }))}
                    className="h-8 text-xs w-full border border-gray-200 rounded-md px-2"
                  >
                    <option value="">Selecione...</option>
                    <option value="CPF">CPF</option>
                    <option value="CNPJ">CNPJ</option>
                    <option value="EMAIL">E-mail</option>
                    <option value="TELEFONE">Telefone</option>
                    <option value="ALEATORIA">Chave aleatória</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">Chave PIX</label>
                  <Input
                    value={form.pixChave}
                    onChange={e => {
                      let v = e.target.value;
                      if (form.pixTipo === 'CPF') v = v.replace(/\D/g, '').slice(0, 11).replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, (_, a, b, c, d) => d ? `${a}.${b}.${c}-${d}` : v.replace(/\D/g, '').length > 6 ? `${a}.${b}.${c}` : v.replace(/\D/g, '').length > 3 ? `${a}.${b}` : a);
                      if (form.pixTipo === 'TELEFONE') v = v.replace(/\D/g, '').slice(0, 11);
                      if (form.pixTipo === 'CNPJ') v = v.replace(/\D/g, '').slice(0, 14);
                      setForm(p => ({ ...p, pixChave: v }));
                    }}
                    placeholder={
                      form.pixTipo === 'CPF' ? '000.000.000-00' :
                      form.pixTipo === 'CNPJ' ? '00.000.000/0000-00' :
                      form.pixTipo === 'EMAIL' ? 'email@exemplo.com' :
                      form.pixTipo === 'TELEFONE' ? '11999999999' :
                      form.pixTipo === 'ALEATORIA' ? 'Cole a chave aleatória' :
                      'Selecione o tipo primeiro'
                    }
                    disabled={!form.pixTipo}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="col-span-2 flex gap-2 items-end">
                  <Button onClick={processarPix} disabled={processando} className="h-8">
                    {processando ? 'Calculando...' : 'Calcular e Registrar'}
                  </Button>
                  <Button variant="outline" onClick={() => setModalAberto(false)} className="h-8">Cancelar</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tabela de histórico */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico de Transferências PIX</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mês</TableHead>
                <TableHead>kWh</TableHead>
                <TableHead>Valor Bruto</TableHead>
                <TableHead>Impostos</TableHead>
                <TableHead>Valor Líquido</TableHead>
                <TableHead>Chave PIX</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {carregando ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <TableCell key={j}><div className="h-4 bg-gray-200 animate-pulse rounded" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : transferencias.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-gray-400">
                    Nenhuma transferência registrada
                  </TableCell>
                </TableRow>
              ) : (
                transferencias.map(t => {
                  const statusInfo = STATUS_LABELS[t.status] ?? { label: t.status, className: 'bg-gray-100' };
                  return (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.mesReferencia}</TableCell>
                      <TableCell className="text-sm">{t.kwhExcedente?.toFixed(1) ?? '—'}</TableCell>
                      <TableCell className="text-sm">R$ {fmt(t.valorBruto)}</TableCell>
                      <TableCell className="text-sm text-red-600">-R$ {fmt(t.valorImpostos)}</TableCell>
                      <TableCell className="font-semibold text-green-700">R$ {fmt(t.valorLiquido)}</TableCell>
                      <TableCell className="text-xs font-mono">{t.pixChave} <Badge variant="outline" className="text-xs ml-1">{t.pixTipo}</Badge></TableCell>
                      <TableCell>
                        <Badge className={statusInfo.className}>{statusInfo.label}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-gray-500">
                        {new Date(t.createdAt).toLocaleDateString('pt-BR')}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

export default function PixExcedentePage() {
  return (
    <Suspense fallback={<div>Carregando...</div>}>
      <PixExcedenteContent />
    </Suspense>
  );
}
