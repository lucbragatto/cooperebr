'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import api from '@/lib/api';
import { useTipoParceiro } from '@/hooks/useTipoParceiro';
import type { Usina, StatusUsina } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, ArrowLeft, Download, Loader2, Pencil, TrendingUp, ArrowRightLeft, Zap, Users, DollarSign, Activity, BarChart3 } from 'lucide-react';
import {
  Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

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
const selCls = `${cls} bg-white`;

const statusLabels: Record<StatusUsina, string> = {
  CADASTRADA: 'Cadastrada',
  AGUARDANDO_HOMOLOGACAO: 'Aguardando Homologacao',
  HOMOLOGADA: 'Homologada',
  EM_PRODUCAO: 'Em Producao',
  SUSPENSA: 'Suspensa',
};

const statusColors: Record<StatusUsina, string> = {
  CADASTRADA: 'bg-gray-100 text-gray-700',
  AGUARDANDO_HOMOLOGACAO: 'bg-yellow-100 text-yellow-800',
  HOMOLOGADA: 'bg-blue-100 text-blue-700',
  EM_PRODUCAO: 'bg-green-100 text-green-700',
  SUSPENSA: 'bg-red-100 text-red-700',
};

const usinaSchema = z.object({
  nome: z.string().min(1, 'Nome obrigatório'),
  potenciaKwp: z.coerce.number().positive('Deve ser maior que 0'),
  capacidadeKwh: z.coerce.number().positive('Deve ser maior que 0').nullable(),
  producaoMensalKwh: z.coerce.number().positive('Deve ser maior que 0').nullable(),
  cidade: z.string().min(1, 'Cidade obrigatória'),
  estado: z.string().min(2, 'Estado obrigatório'),
  statusHomologacao: z.enum(['CADASTRADA', 'AGUARDANDO_HOMOLOGACAO', 'HOMOLOGADA', 'EM_PRODUCAO', 'SUSPENSA']),
  distribuidora: z.string().nullable(),
  observacoes: z.string().nullable(),
  proprietarioNome: z.string().nullable(),
  proprietarioCpfCnpj: z.string().nullable(),
  proprietarioTelefone: z.string().nullable(),
  proprietarioEmail: z.string().nullable(),
  proprietarioTipo: z.enum(['PF', 'PJ']),
});

type UsinaFormData = z.infer<typeof usinaSchema>;

export default function UsinaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { tipoMembro, tipoMembroPlural } = useTipoParceiro();
  const [usina, setUsina] = useState<Usina | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [sheetAberto, setSheetAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [lista, setLista] = useState<any>(null);
  const [gerandoLista, setGerandoLista] = useState(false);
  const [cooperadosAlocados, setCooperadosAlocados] = useState<any[]>([]);
  const [capacidadeInfo, setCapacidadeInfo] = useState<{usado: number; total: number} | null>(null);
  const [distribuicao, setDistribuicao] = useState<any>(null);
  const [saudeFinanceira, setSaudeFinanceira] = useState<any>(null);
  const [ocupacao, setOcupacao] = useState<any>(null);

  // Migração states
  const [migrarModalAberto, setMigrarModalAberto] = useState(false);
  const [migrarCooperadoId, setMigrarCooperadoId] = useState('');
  const [migrarUsinaDestinoId, setMigrarUsinaDestinoId] = useState('');
  const [migrarKwhNovo, setMigrarKwhNovo] = useState('');
  const [migrarMotivo, setMigrarMotivo] = useState('');
  const [migrarProcessando, setMigrarProcessando] = useState(false);
  const [migrarMsg, setMigrarMsg] = useState('');

  const [ajustarModalAberto, setAjustarModalAberto] = useState(false);
  const [ajustarCooperadoId, setAjustarCooperadoId] = useState('');
  const [ajustarKwhNovo, setAjustarKwhNovo] = useState('');
  const [ajustarMotivo, setAjustarMotivo] = useState('');
  const [ajustarProcessando, setAjustarProcessando] = useState(false);
  const [ajustarMsg, setAjustarMsg] = useState('');

  const [migrarTodosAberto, setMigrarTodosAberto] = useState(false);
  const [migrarTodosDestinoId, setMigrarTodosDestinoId] = useState('');
  const [migrarTodosMotivo, setMigrarTodosMotivo] = useState('');
  const [migrarTodosProcessando, setMigrarTodosProcessando] = useState(false);
  const [migrarTodosMsg, setMigrarTodosMsg] = useState('');
  const [migrarTodosResultado, setMigrarTodosResultado] = useState<any>(null);

  const [usinasDisponiveis, setUsinasDisponiveis] = useState<any[]>([]);
  const [historicoMigracoes, setHistoricoMigracoes] = useState<any[]>([]);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<UsinaFormData>({
    resolver: zodResolver(usinaSchema) as any,
  });

  useEffect(() => {
    api.get<Usina & { distribuidora?: string | null }>(`/usinas/${id}`)
      .then((r) => setUsina(r.data))
      .catch(() => setErro('Usina não encontrada.'))
      .finally(() => setCarregando(false));
  }, [id]);

  useEffect(() => {
    if (!usina) return;
    api.get(`/usinas/${id}/lista-concessionaria`)
      .then((r) => {
        setCooperadosAlocados(r.data.cooperados || []);
        const total = Number(r.data.usina?.capacidadeKwh || 0);
        const usado = (r.data.cooperados || []).reduce((acc: number, c: any) => acc + Number(c.kwhContratado || 0), 0);
        setCapacidadeInfo({ usado, total });
      })
      .catch(() => { /* silently ignore */ });

    api.get(`/usinas/${id}/distribuicao`)
      .then((r) => setDistribuicao(r.data))
      .catch(() => { /* silently ignore */ });

    api.get(`/usinas/${id}/saude-financeira`)
      .then((r) => setSaudeFinanceira(r.data))
      .catch(() => { /* silently ignore */ });

    api.get(`/usinas/${id}/ocupacao`)
      .then((r) => setOcupacao(r.data))
      .catch(() => { /* silently ignore */ });

    // Carregar usinas disponíveis para migração
    api.get('/usinas')
      .then((r) => setUsinasDisponiveis((r.data || []).filter((u: any) => u.id !== id)))
      .catch(() => {});

    // Carregar histórico de migrações
    api.get(`/migracoes-usina/historico-usina/${id}`)
      .then((r) => setHistoricoMigracoes(r.data || []))
      .catch(() => {});
  }, [usina, id]);

  function abrirSheet() {
    if (!usina) return;
    reset({
      nome: usina.nome,
      potenciaKwp: Number(usina.potenciaKwp),
      capacidadeKwh: usina.capacidadeKwh ? Number(usina.capacidadeKwh) : null,
      producaoMensalKwh: usina.producaoMensalKwh ? Number(usina.producaoMensalKwh) : null,
      cidade: usina.cidade,
      estado: usina.estado,
      statusHomologacao: usina.statusHomologacao || 'CADASTRADA',
      distribuidora: (usina as any).distribuidora ?? null,
      observacoes: usina.observacoes || null,
      proprietarioNome: (usina as any).proprietarioNome ?? null,
      proprietarioCpfCnpj: (usina as any).proprietarioCpfCnpj ?? null,
      proprietarioTelefone: (usina as any).proprietarioTelefone ?? null,
      proprietarioEmail: (usina as any).proprietarioEmail ?? null,
      proprietarioTipo: (usina as any).proprietarioTipo ?? 'PF',
    });
    setMensagem('');
    setSheetAberto(true);
  }

  async function onSubmit(data: UsinaFormData) {
    setSalvando(true);
    setMensagem('');
    try {
      const { data: res } = await api.put<Usina>(`/usinas/${id}`, {
        ...data,
        capacidadeKwh: data.capacidadeKwh || null,
        producaoMensalKwh: data.producaoMensalKwh || null,
        observacoes: data.observacoes || null,
        distribuidora: data.distribuidora || null,
        proprietarioNome: data.proprietarioNome || null,
        proprietarioCpfCnpj: data.proprietarioCpfCnpj || null,
        proprietarioTelefone: data.proprietarioTelefone || null,
        proprietarioEmail: data.proprietarioEmail || null,
        proprietarioTipo: data.proprietarioTipo,
      });
      setUsina(res);
      setSheetAberto(false);
      setMensagem('Salvo com sucesso!');
    } catch (e: any) {
      const msg = e?.response?.data?.message || 'Erro ao salvar.';
      setMensagem(typeof msg === 'string' ? `Erro: ${msg}` : `Erro: ${JSON.stringify(msg)}`);
    } finally {
      setSalvando(false);
    }
  }

  async function handleMigrarCooperado() {
    setMigrarProcessando(true);
    setMigrarMsg('');
    try {
      await api.post('/migracoes-usina/cooperado', {
        cooperadoId: migrarCooperadoId,
        usinaDestinoId: migrarUsinaDestinoId,
        kwhNovo: migrarKwhNovo ? Number(migrarKwhNovo) : undefined,
        motivo: migrarMotivo || undefined,
      });
      setMigrarMsg('Migração realizada com sucesso!');
      setMigrarModalAberto(false);
      // Refresh data
      api.get(`/usinas/${id}/lista-concessionaria`).then((r) => setCooperadosAlocados(r.data.cooperados || [])).catch(() => {});
      api.get(`/usinas/${id}/distribuicao`).then((r) => setDistribuicao(r.data)).catch(() => {});
      api.get(`/migracoes-usina/historico-usina/${id}`).then((r) => setHistoricoMigracoes(r.data || [])).catch(() => {});
    } catch (e: any) {
      const msg = e?.response?.data?.message || 'Erro ao migrar.';
      setMigrarMsg(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setMigrarProcessando(false);
    }
  }

  async function handleAjustarKwh() {
    setAjustarProcessando(true);
    setAjustarMsg('');
    try {
      await api.post('/migracoes-usina/ajustar-kwh', {
        cooperadoId: ajustarCooperadoId,
        kwhNovo: ajustarKwhNovo ? Number(ajustarKwhNovo) : undefined,
        motivo: ajustarMotivo || undefined,
      });
      setAjustarMsg('Ajuste realizado com sucesso!');
      setAjustarModalAberto(false);
      api.get(`/usinas/${id}/lista-concessionaria`).then((r) => setCooperadosAlocados(r.data.cooperados || [])).catch(() => {});
      api.get(`/usinas/${id}/distribuicao`).then((r) => setDistribuicao(r.data)).catch(() => {});
    } catch (e: any) {
      const msg = e?.response?.data?.message || 'Erro ao ajustar.';
      setAjustarMsg(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setAjustarProcessando(false);
    }
  }

  async function handleMigrarTodos() {
    setMigrarTodosProcessando(true);
    setMigrarTodosMsg('');
    setMigrarTodosResultado(null);
    try {
      const { data } = await api.post('/migracoes-usina/usina-total', {
        usinaOrigemId: id,
        usinaDestinoId: migrarTodosDestinoId,
        motivo: migrarTodosMotivo || undefined,
      });
      setMigrarTodosResultado(data);
      setMigrarTodosMsg(`Migração concluída: ${data.sucesso}/${data.total} com sucesso.`);
      api.get(`/usinas/${id}/lista-concessionaria`).then((r) => setCooperadosAlocados(r.data.cooperados || [])).catch(() => {});
      api.get(`/usinas/${id}/distribuicao`).then((r) => setDistribuicao(r.data)).catch(() => {});
      api.get(`/migracoes-usina/historico-usina/${id}`).then((r) => setHistoricoMigracoes(r.data || [])).catch(() => {});
    } catch (e: any) {
      const msg = e?.response?.data?.message || 'Erro na migração em massa.';
      setMigrarTodosMsg(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setMigrarTodosProcessando(false);
    }
  }

  const status = usina?.statusHomologacao as StatusUsina;

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        <h2 className="text-2xl font-bold text-gray-800">Detalhe da Usina</h2>
        {usina && (
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

      {usina && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                {usina.nome}
                {status && (
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColors[status] ?? 'bg-gray-100 text-gray-600'}`}>
                    {statusLabels[status] ?? status}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-6">
              <Campo label="ID" value={usina.id} />
              <Campo label="Nome" value={usina.nome} />
              <Campo label="Potencia (kWp)" value={Number(usina.potenciaKwp).toFixed(2)} />
              <Campo label="Capacidade (kWh/mes)" value={usina.capacidadeKwh ? Number(usina.capacidadeKwh).toFixed(2) : '—'} />
              <Campo label="Producao Mensal (kWh)" value={usina.producaoMensalKwh ? Number(usina.producaoMensalKwh).toFixed(2) : '—'} />
              <Campo label="Distribuidora" value={(usina as any).distribuidora ?? '—'} />
              <Campo label="Cidade" value={usina.cidade} />
              <Campo label="Estado" value={usina.estado} />
              <Campo label="Status Homologacao" value={
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColors[status] ?? 'bg-gray-100'}`}>
                  {statusLabels[status] ?? status}
                </span>
              } />
              <Campo label="Data Homologacao" value={usina.dataHomologacao ? new Date(usina.dataHomologacao).toLocaleDateString('pt-BR') : '—'} />
              <Campo label="Inicio Producao" value={usina.dataInicioProducao ? new Date(usina.dataInicioProducao).toLocaleDateString('pt-BR') : '—'} />
              {(usina as any).proprietarioNome && (
                <>
                  <Campo label="Proprietário" value={(usina as any).proprietarioNome} />
                  <Campo label="CPF/CNPJ Proprietário" value={(usina as any).proprietarioCpfCnpj} />
                  <Campo label="Tipo" value={(usina as any).proprietarioTipo === 'PJ' ? 'Pessoa Jurídica' : 'Pessoa Física'} />
                </>
              )}
              {usina.observacoes && <Campo label="Observacoes" value={usina.observacoes} />}
              <Campo label="Criado em" value={new Date(usina.createdAt).toLocaleString('pt-BR')} />
              <Campo label="Atualizado em" value={new Date(usina.updatedAt).toLocaleString('pt-BR')} />
            </CardContent>
          </Card>

          {/* Saúde Financeira */}
          {saudeFinanceira && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <DollarSign className="h-4 w-4 text-green-600" />
                  Saúde Financeira — {String(saudeFinanceira.mesReferencia).padStart(2, '0')}/{saudeFinanceira.anoReferencia}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                  <div className="bg-blue-50 rounded-lg p-3">
                    <p className="text-xs text-blue-600 font-medium">kWh Gerado</p>
                    <p className="text-xl font-bold text-blue-800">{Number(saudeFinanceira.kwhGerado).toLocaleString('pt-BR')}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-600 font-medium">Contratos Ativos</p>
                    <p className="text-xl font-bold text-gray-800">{saudeFinanceira.contratosAtivos}</p>
                  </div>
                  <div className="bg-amber-50 rounded-lg p-3">
                    <p className="text-xs text-amber-600 font-medium">Total Cobrado</p>
                    <p className="text-xl font-bold text-amber-800">R$ {saudeFinanceira.totalCobrado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-3">
                    <p className="text-xs text-green-600 font-medium">Total Recebido</p>
                    <p className="text-xl font-bold text-green-800">R$ {saudeFinanceira.totalRecebido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div className={`rounded-lg p-3 ${saudeFinanceira.totalInadimplente > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
                    <p className={`text-xs font-medium ${saudeFinanceira.totalInadimplente > 0 ? 'text-red-600' : 'text-green-600'}`}>Inadimplente</p>
                    <p className={`text-xl font-bold ${saudeFinanceira.totalInadimplente > 0 ? 'text-red-800' : 'text-green-800'}`}>R$ {saudeFinanceira.totalInadimplente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                  </div>
                </div>

                {saudeFinanceira.inadimplentes.length > 0 && (
                  <>
                    <p className="text-sm font-semibold text-red-700 mb-2">Inadimplentes ({saudeFinanceira.inadimplentes.length})</p>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>Valor</TableHead>
                          <TableHead>Dias em Atraso</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {saudeFinanceira.inadimplentes.map((i: any) => (
                          <TableRow key={i.cobrancaId}>
                            <TableCell className="font-medium">{i.nome}</TableCell>
                            <TableCell>R$ {i.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                            <TableCell>
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${i.diasAtraso > 30 ? 'bg-red-100 text-red-800' : i.diasAtraso > 15 ? 'bg-yellow-100 text-yellow-800' : 'bg-orange-100 text-orange-800'}`}>
                                {i.diasAtraso} dias
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Ocupação vs Capacidade */}
          {ocupacao && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Activity className="h-4 w-4 text-blue-600" />
                  Ocupação vs. Capacidade Real
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">Ocupação</span>
                    <span className="font-medium">{ocupacao.percentualOcupado.toFixed(1)}% — {ocupacao.kwhOcupado.toLocaleString('pt-BR')} / {ocupacao.capacidadeKwh.toLocaleString('pt-BR')} kWh</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-4">
                    <div
                      className={`h-4 rounded-full transition-all ${ocupacao.percentualOcupado > 95 ? 'bg-red-500' : ocupacao.percentualOcupado > 80 ? 'bg-yellow-500' : 'bg-green-500'}`}
                      style={{ width: `${Math.min(ocupacao.percentualOcupado, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Disponível: {ocupacao.kwhDisponivel.toLocaleString('pt-BR')} kWh</p>
                </div>

                {ocupacao.breakdown.length > 0 && (
                  <>
                    <p className="text-sm font-semibold text-gray-700 mb-2">Breakdown por Parceiro</p>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Parceiro</TableHead>
                          <TableHead>% Usina</TableHead>
                          <TableHead>kWh Reservado</TableHead>
                          <TableHead>Contratos</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {ocupacao.breakdown.map((b: any, i: number) => (
                          <TableRow key={i}>
                            <TableCell className="font-medium">{b.cooperativaNome}</TableCell>
                            <TableCell>{b.percentual.toFixed(2)}%</TableCell>
                            <TableCell>{b.kwhReservado.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</TableCell>
                            <TableCell>{b.qtdContratos}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Distribuição de Créditos do Mês */}
          {distribuicao && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                  Distribuição de Créditos do Mês
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* KPI cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="bg-blue-50 rounded-lg p-4">
                    <p className="text-xs text-blue-600 font-medium">Capacidade Total</p>
                    <p className="text-2xl font-bold text-blue-800">{distribuicao.capacidadeTotal.toLocaleString('pt-BR')} <span className="text-sm font-normal">kWh/mês</span></p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4">
                    <p className="text-xs text-green-600 font-medium">Total Alocado</p>
                    <p className="text-2xl font-bold text-green-800">{distribuicao.totalAlocado.toLocaleString('pt-BR')} <span className="text-sm font-normal">kWh</span></p>
                    <p className="text-xs text-green-600 mt-1">{distribuicao.percentualAlocado.toFixed(1)}% da capacidade</p>
                  </div>
                  <div className={`rounded-lg p-4 ${distribuicao.saldoDisponivel < 0 ? 'bg-red-50' : 'bg-amber-50'}`}>
                    <p className={`text-xs font-medium ${distribuicao.saldoDisponivel < 0 ? 'text-red-600' : 'text-amber-600'}`}>Saldo Disponível</p>
                    <p className={`text-2xl font-bold ${distribuicao.saldoDisponivel < 0 ? 'text-red-800' : 'text-amber-800'}`}>{distribuicao.saldoDisponivel.toLocaleString('pt-BR')} <span className="text-sm font-normal">kWh</span></p>
                    <p className={`text-xs mt-1 ${distribuicao.saldoDisponivel < 0 ? 'text-red-600' : 'text-amber-600'}`}>{distribuicao.percentualDisponivel.toFixed(1)}% livre</p>
                  </div>
                </div>

                {/* Alertas */}
                {distribuicao.alertas?.length > 0 && (
                  <div className="space-y-2 mb-4">
                    {distribuicao.alertas.map((a: any, i: number) => (
                      <div key={i} className={`flex items-start gap-2 p-3 rounded-lg text-sm ${a.tipo === 'EXCESSO' ? 'bg-red-50 text-red-800 border border-red-200' : 'bg-amber-50 text-amber-800 border border-amber-200'}`}>
                        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                        {a.mensagem}
                      </div>
                    ))}
                  </div>
                )}

                {/* Tabela de cooperados */}
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>UC</TableHead>
                      <TableHead>Cota kWh</TableHead>
                      <TableHead>% do Total</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {distribuicao.cooperados.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-gray-400 py-6">
                          Nenhum cooperado vinculado
                        </TableCell>
                      </TableRow>
                    ) : (
                      distribuicao.cooperados.map((c: any, i: number) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{c.nome}</TableCell>
                          <TableCell>{c.ucNumero || '—'}</TableCell>
                          <TableCell>{c.kwhContratado.toLocaleString('pt-BR')}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="w-16 bg-gray-200 rounded-full h-1.5">
                                <div className="bg-green-600 h-1.5 rounded-full" style={{ width: `${Math.min(c.percentual, 100)}%` }} />
                              </div>
                              <span className="text-xs">{c.percentual.toFixed(1)}%</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.contratoStatus === 'ATIVO' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                              {c.contratoStatus === 'ATIVO' ? 'Ativo' : 'Pend. Ativação'}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Cooperados Alocados */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-base">{tipoMembroPlural} Alocados</CardTitle>
              {capacidadeInfo && capacidadeInfo.total > 0 && (
                <div className="mt-2">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Capacidade utilizada</span>
                    <span>{capacidadeInfo.usado.toFixed(0)} / {capacidadeInfo.total.toFixed(0)} kWh ({capacidadeInfo.total > 0 ? ((capacidadeInfo.usado / capacidadeInfo.total) * 100).toFixed(1) : 0}%)</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div
                      className="bg-green-600 h-2.5 rounded-full transition-all"
                      style={{ width: `${Math.min((capacidadeInfo.usado / capacidadeInfo.total) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>UC</TableHead>
                    <TableHead>kWh Contratado</TableHead>
                    <TableHead>% Usina</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data Adesão</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cooperadosAlocados.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-gray-400 py-6">
                        {`Nenhum ${tipoMembro.toLowerCase()} alocado nesta usina`}
                      </TableCell>
                    </TableRow>
                  ) : (
                    cooperadosAlocados.map((c: any, i: number) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{c.nomeCompleto}</TableCell>
                        <TableCell>{c.numeroUC}</TableCell>
                        <TableCell>{c.kwhContratado}</TableCell>
                        <TableCell>{c.percentualUsina}%</TableCell>
                        <TableCell>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.statusContrato === 'ATIVO' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                            {c.statusContrato === 'ATIVO' ? 'Ativo' : 'Pend. Ativacao'}
                          </span>
                        </TableCell>
                        <TableCell>{new Date(c.dataAdesao).toLocaleDateString('pt-BR')}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Lista para concessionaria */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Lista para Concessionaria</span>
                <div className="flex gap-2">
                  {lista && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const header = 'Nome,CPF,Numero UC,kWh Contratado,% Usina,Data Adesao,Distribuidora,Contrato';
                        const rows = lista.cooperados.map((c: any) =>
                          `"${c.nomeCompleto}","${c.cpf}","${c.numeroUC}",${c.kwhContratado},${c.percentualUsina},"${new Date(c.dataAdesao).toLocaleDateString('pt-BR')}","${c.distribuidora}","${c.contrato}"`
                        );
                        const csv = [header, ...rows].join('\n');
                        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        const nomeArquivo = `lista-concessionaria-${usina.nome.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().slice(0, 7)}.csv`;
                        a.href = url;
                        a.download = nomeArquivo;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      CSV
                    </Button>
                  )}
                  <Button
                    size="sm"
                    disabled={gerandoLista}
                    onClick={async () => {
                      setGerandoLista(true);
                      try {
                        const { data } = await api.get(`/usinas/${id}/lista-concessionaria`);
                        setLista(data);
                      } catch {
                        setMensagem('Erro ao gerar lista.');
                      } finally {
                        setGerandoLista(false);
                      }
                    }}
                  >
                    {gerandoLista ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                    {lista ? 'Atualizar' : 'Gerar lista'}
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            {lista && (
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>CPF</TableHead>
                      <TableHead>UC</TableHead>
                      <TableHead>kWh</TableHead>
                      <TableHead>% Usina</TableHead>
                      <TableHead>Adesao</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lista.cooperados.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-gray-400 py-6">
                          {`Nenhum ${tipoMembro.toLowerCase()} ativo nesta usina`}
                        </TableCell>
                      </TableRow>
                    ) : (
                      lista.cooperados.map((c: any, i: number) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{c.nomeCompleto}</TableCell>
                          <TableCell>{c.cpf}</TableCell>
                          <TableCell>{c.numeroUC}</TableCell>
                          <TableCell>{c.kwhContratado}</TableCell>
                          <TableCell>{c.percentualUsina}%</TableCell>
                          <TableCell>{new Date(c.dataAdesao).toLocaleDateString('pt-BR')}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            )}
          </Card>

          {/* Ações de Migração */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ArrowRightLeft className="h-4 w-4 text-blue-600" />
                Migração de Usina
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { setMigrarMsg(''); setMigrarModalAberto(true); }}
                >
                  <ArrowRightLeft className="h-4 w-4 mr-1" />
                  Migrar cooperado
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { setAjustarMsg(''); setAjustarModalAberto(true); }}
                >
                  <Zap className="h-4 w-4 mr-1" />
                  Ajustar kWh
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => { setMigrarTodosMsg(''); setMigrarTodosResultado(null); setMigrarTodosAberto(true); }}
                >
                  <Users className="h-4 w-4 mr-1" />
                  Migrar todos os membros
                </Button>
              </div>

              {(migrarMsg || ajustarMsg) && (
                <p className={`mt-3 text-sm ${(migrarMsg + ajustarMsg).toLowerCase().includes('erro') ? 'text-red-500' : 'text-green-600'}`}>
                  {migrarMsg || ajustarMsg}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Histórico de Migrações */}
          {historicoMigracoes.length > 0 && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="text-base">Histórico de Migrações</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead>kWh Ant.</TableHead>
                      <TableHead>kWh Novo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historicoMigracoes.map((m: any) => (
                      <TableRow key={m.id}>
                        <TableCell>{new Date(m.criadoEm).toLocaleDateString('pt-BR')}</TableCell>
                        <TableCell>
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-blue-100 text-blue-800">
                            {m.tipo === 'MUDANCA_USINA' ? 'Mudança' : m.tipo === 'AJUSTE_KWH' ? 'Ajuste kWh' : m.tipo === 'MIGRACAO_TOTAL_USINA' ? 'Migração Total' : m.tipo}
                          </span>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">{m.motivo || '—'}</TableCell>
                        <TableCell>{m.kwhAnterior ?? '—'}</TableCell>
                        <TableCell>{m.kwhNovo ?? '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Dialog — Migrar Cooperado */}
      <Dialog open={migrarModalAberto} onOpenChange={setMigrarModalAberto}>
        <DialogContent>
          <DialogHeader><DialogTitle>Migrar Cooperado para outra Usina</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className={lbl}>Cooperado (selecione da lista)</label>
              <select className={selCls} value={migrarCooperadoId} onChange={(e) => setMigrarCooperadoId(e.target.value)}>
                <option value="">Selecione...</option>
                {(distribuicao?.cooperados ?? []).map((c: any) => (
                  <option key={c.cooperadoId} value={c.cooperadoId}>{c.nome} — UC {c.ucNumero}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={lbl}>Usina Destino</label>
              <select className={selCls} value={migrarUsinaDestinoId} onChange={(e) => setMigrarUsinaDestinoId(e.target.value)}>
                <option value="">Selecione...</option>
                {usinasDisponiveis.map((u: any) => (
                  <option key={u.id} value={u.id}>{u.nome} — {u.cidade}/{u.estado}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={lbl}>Novo kWh mensal</label>
              <input className={cls} type="number" step="0.01" value={migrarKwhNovo} onChange={(e) => setMigrarKwhNovo(e.target.value)} placeholder="Manter atual se vazio" />
            </div>
            <div>
              <label className={lbl}>Motivo</label>
              <textarea className={cls} rows={2} value={migrarMotivo} onChange={(e) => setMigrarMotivo(e.target.value)} placeholder="Ex: Melhor distribuição de créditos" />
            </div>
            {migrarMsg && <p className={`text-sm ${migrarMsg.toLowerCase().includes('erro') ? 'text-red-500' : 'text-green-600'}`}>{migrarMsg}</p>}
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setMigrarModalAberto(false)}>Cancelar</Button>
            <Button disabled={migrarProcessando || !migrarCooperadoId || !migrarUsinaDestinoId} onClick={handleMigrarCooperado}>
              {migrarProcessando && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Migrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog — Ajustar kWh */}
      <Dialog open={ajustarModalAberto} onOpenChange={setAjustarModalAberto}>
        <DialogContent>
          <DialogHeader><DialogTitle>Ajustar kWh do Cooperado</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className={lbl}>Cooperado</label>
              <select className={selCls} value={ajustarCooperadoId} onChange={(e) => setAjustarCooperadoId(e.target.value)}>
                <option value="">Selecione...</option>
                {(distribuicao?.cooperados ?? []).map((c: any) => (
                  <option key={c.cooperadoId} value={c.cooperadoId}>{c.nome} — {c.kwhContratado} kWh</option>
                ))}
              </select>
            </div>
            <div>
              <label className={lbl}>Novo kWh mensal</label>
              <input className={cls} type="number" step="0.01" value={ajustarKwhNovo} onChange={(e) => setAjustarKwhNovo(e.target.value)} />
            </div>
            <div>
              <label className={lbl}>Motivo</label>
              <textarea className={cls} rows={2} value={ajustarMotivo} onChange={(e) => setAjustarMotivo(e.target.value)} />
            </div>
            {ajustarMsg && <p className={`text-sm ${ajustarMsg.toLowerCase().includes('erro') ? 'text-red-500' : 'text-green-600'}`}>{ajustarMsg}</p>}
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setAjustarModalAberto(false)}>Cancelar</Button>
            <Button disabled={ajustarProcessando || !ajustarCooperadoId || !ajustarKwhNovo} onClick={handleAjustarKwh}>
              {ajustarProcessando && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Ajustar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog — Migrar Todos */}
      <Dialog open={migrarTodosAberto} onOpenChange={setMigrarTodosAberto}>
        <DialogContent>
          <DialogHeader><DialogTitle>Migrar TODOS os membros desta usina</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
              <strong>Atenção:</strong> Esta ação migrará todos os {cooperadosAlocados.length} cooperados ativos para a usina destino. Esta ação não pode ser desfeita facilmente.
            </div>
            <div>
              <label className={lbl}>Usina Destino</label>
              <select className={selCls} value={migrarTodosDestinoId} onChange={(e) => setMigrarTodosDestinoId(e.target.value)}>
                <option value="">Selecione...</option>
                {usinasDisponiveis.map((u: any) => (
                  <option key={u.id} value={u.id}>{u.nome} — {u.cidade}/{u.estado}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={lbl}>Motivo</label>
              <textarea className={cls} rows={2} value={migrarTodosMotivo} onChange={(e) => setMigrarTodosMotivo(e.target.value)} placeholder="Ex: Desativação da usina origem" />
            </div>
            {migrarTodosMsg && <p className={`text-sm ${migrarTodosMsg.toLowerCase().includes('erro') ? 'text-red-500' : 'text-green-600'}`}>{migrarTodosMsg}</p>}
            {migrarTodosResultado && migrarTodosResultado.falhas?.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm">
                <strong>Falhas ({migrarTodosResultado.falhas.length}):</strong>
                <ul className="mt-1 list-disc list-inside">
                  {migrarTodosResultado.falhas.map((f: any, i: number) => (
                    <li key={i}>{f.nome}: {f.erro}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setMigrarTodosAberto(false)}>Cancelar</Button>
            <Button variant="destructive" disabled={migrarTodosProcessando || !migrarTodosDestinoId} onClick={handleMigrarTodos}>
              {migrarTodosProcessando && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Confirmar migração total
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sheet — Editar Usina */}
      <Sheet open={sheetAberto} onOpenChange={setSheetAberto}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader><SheetTitle>Editar Usina</SheetTitle></SheetHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
            <div>
              <label className={lbl}>Nome *</label>
              <input className={cls} {...register('nome')} />
              {errors.nome && <p className="text-xs text-red-500 mt-1">{errors.nome.message}</p>}
            </div>
            <div>
              <label className={lbl}>Potencia (kWp) *</label>
              <input className={cls} type="number" step="0.01" {...register('potenciaKwp')} />
              {errors.potenciaKwp && <p className="text-xs text-red-500 mt-1">{errors.potenciaKwp.message}</p>}
            </div>
            <div>
              <label className={lbl}>Capacidade (kWh/mes)</label>
              <input className={cls} type="number" step="0.01" {...register('capacidadeKwh')} />
              {errors.capacidadeKwh && <p className="text-xs text-red-500 mt-1">{errors.capacidadeKwh.message}</p>}
            </div>
            <div>
              <label className={lbl}>Producao Mensal (kWh)</label>
              <input className={cls} type="number" step="0.01" {...register('producaoMensalKwh')} />
            </div>
            <div>
              <label className={lbl}>Distribuidora</label>
              <input className={cls} {...register('distribuidora')} placeholder="Ex: CEMIG, CPFL, Enel" />
            </div>
            <div>
              <label className={lbl}>Status Homologacao *</label>
              <select className={selCls} {...register('statusHomologacao')}>
                <option value="CADASTRADA">Cadastrada</option>
                <option value="AGUARDANDO_HOMOLOGACAO">Aguardando Homologacao</option>
                <option value="HOMOLOGADA">Homologada pela Concessionaria</option>
                <option value="EM_PRODUCAO">Em Producao</option>
                <option value="SUSPENSA">Suspensa</option>
              </select>
            </div>
            <div>
              <label className={lbl}>Cidade *</label>
              <input className={cls} {...register('cidade')} />
              {errors.cidade && <p className="text-xs text-red-500 mt-1">{errors.cidade.message}</p>}
            </div>
            <div>
              <label className={lbl}>Estado *</label>
              <input className={cls} {...register('estado')} />
              {errors.estado && <p className="text-xs text-red-500 mt-1">{errors.estado.message}</p>}
            </div>
            <div>
              <label className={lbl}>Observacoes</label>
              <textarea className={cls} rows={3} {...register('observacoes')} placeholder="Notas sobre a usina" />
            </div>
            <hr className="my-2" />
            <p className="text-xs font-semibold text-gray-600">Proprietário</p>
            <div>
              <label className={lbl}>Tipo</label>
              <select className={selCls} {...register('proprietarioTipo')}>
                <option value="PF">Pessoa Física</option>
                <option value="PJ">Pessoa Jurídica</option>
              </select>
            </div>
            <div>
              <label className={lbl}>Nome</label>
              <input className={cls} {...register('proprietarioNome')} />
            </div>
            <div>
              <label className={lbl}>CPF/CNPJ</label>
              <input className={cls} {...register('proprietarioCpfCnpj')} />
            </div>
            <div>
              <label className={lbl}>Telefone</label>
              <input className={cls} {...register('proprietarioTelefone')} />
            </div>
            <div>
              <label className={lbl}>Email</label>
              <input className={cls} {...register('proprietarioEmail')} />
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
