'use client';

/**
 * Sprint Portal Empresa 9.1 (04/06/2026) — Dashboard do convênio (portal
 * da empresa conveniada). Segue o mockup
 * Downloads/mockup-portal-empresa-conveniada.html.
 *
 * Núcleo (9.1):
 *  1. Header: dados da empresa + natureza (badge) + forma de cobrança.
 *  2. <GestaoConvitesSection source='empresa'> — gerar/enviar convite + lista.
 *  3. <MembrosPendentesSection source='empresa'> — aprovar/recusar IN-PORTAL.
 *  4. Cobranças F1 (filtradas server-side: PENDENTE/A_VENCER/PAGO/VENCIDO
 *     + EMITIDO; AGUARDANDO_EMISSAO/FALHA_EMISSAO escondidas).
 *  5. HELP boxes obrigatórios em cada bloco (textos do mockup, regra 19/05).
 *
 * Capacidade kWh + pagar/gerar = fatia 9.2 (futuro).
 * Tokens & benefícios = fase futura (out of ENERGIA scope).
 */

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import {
  ArrowLeft,
  Building2,
  Briefcase,
  Loader2,
  AlertTriangle,
  DollarSign,
  ExternalLink,
  Receipt,
  CalendarClock,
  Mail,
  Phone,
  Zap,
} from 'lucide-react';
import { HelpBox } from '@/components/ui/help-box';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { GestaoConvitesSection } from '@/components/convenios/GestaoConvitesSection';
import { MembrosPendentesSection } from '@/components/convenios/MembrosPendentesSection';
import { EnvioLoteSection } from '@/components/convenios/EnvioLoteSection';

type StatusCob = 'PENDENTE' | 'A_VENCER' | 'PAGO' | 'CANCELADO' | 'VENCIDO';
type Natureza = 'AUXILIAR' | 'PROPRIO' | 'NAO_COOPERATIVO';
type Base = 'CONSUMO_REAL' | 'ALOCACAO_FIXA';

interface DashboardResponse {
  convenio: {
    id: string;
    numero: string;
    empresaNome: string;
    empresaCnpj: string | null;
    empresaEmail: string | null;
    empresaTelefone: string | null;
    conveniadoNome: string | null;
    conveniadoEmail: string | null;
    conveniadoTelefone: string | null;
    naturezaAtoCooperativo: Natureza | null;
    baseCobrancaCusteio: Base | null;
    kwhAlocadoMensal: number | null;
    descontoKwhCusteio: string | null;
    diaEnvioRelatorio: number;
    status: string;
    createdAt: string;
    cooperativa: { id: string; nome: string } | null;
  };
  contadoresMembros: Record<string, number>;
  cobrancas: Array<{
    id: string;
    mesReferencia: number;
    anoReferencia: number;
    valorLiquido: string;
    valorPago: string | null;
    status: StatusCob;
    dataVencimento: string;
    dataPagamento: string | null;
    // Fatia 0.4 — discriminação opcional do clube.
    valorMensalidadeClube?: string | null;
    asaasCobrancas: Array<{
      linkPagamento: string | null;
      boletoUrl: string | null;
      pixCopiaECola: string | null;
      status: string;
    }>;
  }>;
}

const STATUS_COB: Record<StatusCob, { label: string; cor: string }> = {
  PENDENTE: { label: 'Pendente', cor: 'bg-gray-100 text-gray-700 border-gray-300' },
  A_VENCER: { label: 'A vencer', cor: 'bg-blue-100 text-blue-700 border-blue-300' },
  PAGO: { label: 'Paga', cor: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
  VENCIDO: { label: 'Vencida', cor: 'bg-amber-100 text-amber-700 border-amber-300' },
  CANCELADO: { label: 'Cancelada', cor: 'bg-red-100 text-red-700 border-red-300' },
};

const NATUREZA_LABEL: Record<Natureza, { texto: string; cor: string }> = {
  AUXILIAR: {
    texto: 'Ato Cooperativo Auxiliar (Art. 88)',
    cor: 'bg-emerald-50 text-emerald-700 border-emerald-300',
  },
  PROPRIO: {
    texto: 'Ato Cooperativo Próprio (Art. 79)',
    cor: 'bg-blue-50 text-blue-700 border-blue-300',
  },
  NAO_COOPERATIVO: {
    texto: 'Não cooperativo',
    cor: 'bg-slate-50 text-slate-700 border-slate-300',
  },
};

function mesNome(m: number) {
  return ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][m - 1] ?? String(m);
}

function moeda(v: string | number | null) {
  const n = typeof v === 'string' ? Number(v) : (v ?? 0);
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function dataBr(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR');
}

// ────────────────────────────────────────────────────────────────────────
// Sprint Onboarding Bloco 2 Fatia 2.4 (07/06/2026) — Consumo dos funcionários
// ────────────────────────────────────────────────────────────────────────

type KwhStatus =
  | 'OK'
  | 'SEM_MEMBROS'
  | 'SEM_UCS_CUSTEADAS'
  | 'SEM_FATURAS_NO_MES'
  | 'SEM_CONSUMO_CAPTURADO';
type KwhFonte = 'fatura' | 'cota' | 'rateio' | 'sem-dado';

interface KwhConsumoEntrada {
  cooperadoId: string;
  nome: string;
  ucs: Array<{ numeroMascarado: string; distribuidora: string }>;
  kwh: number;
  fonte: KwhFonte;
  percentual: number;
  semFaturaNoMes?: boolean;
  isPagador?: boolean;
}

interface KwhConsumoResponse {
  convenioId: string;
  convenioNome: string;
  base: 'CONSUMO_REAL' | 'ALOCACAO_FIXA';
  mesReferencia: number;
  anoReferencia: number;
  mesRefStr: string;
  status: KwhStatus;
  /** Soma DINÂMICA do consumo dos membros. */
  kwhTotal: number;
  /** Crédito de energia INICIALMENTE disponível na assinatura (referência). */
  disponivelAssinatura: number | null;
  /** kwhTotal > disponivelAssinatura → sinaliza (sem bloquear). */
  excedente?: boolean;
  /** Valor da ENERGIA a pagar (sem clube) = kwhTotal × tarifa. null se status != OK. */
  valorAPagar: number | null;
  /** R$/kWh efetivo aplicado. null se valorAPagar=null. */
  tarifaKwh: number | null;
  /** Motivo quando valorAPagar=null (ex: tarifa não configurada). */
  motivoSemValor?: string;
  membros: KwhConsumoEntrada[];
}

/** Default: mês anterior corrente no formato YYYY-MM. */
function defaultMesAnterior(): string {
  const hoje = new Date();
  const mes = hoje.getMonth() + 1;
  const ano = hoje.getFullYear();
  const m = mes === 1 ? 12 : mes - 1;
  const a = mes === 1 ? ano - 1 : ano;
  return `${a}-${String(m).padStart(2, '0')}`;
}

/** Gera lista dos últimos 12 meses (incluindo o anterior corrente). */
function gerarOpcoesMes(): Array<{ value: string; label: string }> {
  const opts: Array<{ value: string; label: string }> = [];
  const hoje = new Date();
  let mes = hoje.getMonth() + 1;
  let ano = hoje.getFullYear();
  // Começa do mês ANTERIOR corrente (regra do endpoint — sem futuro).
  mes = mes === 1 ? 12 : mes - 1;
  ano = mes === 12 ? ano - 1 : ano;
  for (let i = 0; i < 12; i++) {
    opts.push({
      value: `${ano}-${String(mes).padStart(2, '0')}`,
      label: `${mesNome(mes)}/${ano}`,
    });
    mes = mes === 1 ? 12 : mes - 1;
    if (mes === 12) ano -= 1;
  }
  return opts;
}

interface ConsumoFuncionariosCardProps {
  convenioId: string;
}

function ConsumoFuncionariosCard({ convenioId }: ConsumoFuncionariosCardProps) {
  const [mesSel, setMesSel] = useState<string>(defaultMesAnterior());
  const [data, setData] = useState<KwhConsumoResponse | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const opcoesMes = gerarOpcoesMes();

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const r = await api.get<KwhConsumoResponse>(
        `/portal/meus-convenios/${convenioId}/kwh-consumo`,
        { params: { mes: mesSel } },
      );
      setData(r.data);
    } catch (err: any) {
      setErro(err?.response?.data?.message ?? err?.message ?? 'Erro ao carregar consumo');
      setData(null);
    } finally {
      setCarregando(false);
    }
  }, [convenioId, mesSel]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const renderEstadoSemDados = () => {
    if (!data) return null;
    const msgs: Record<KwhStatus, string> = {
      OK: '',
      SEM_MEMBROS:
        'Nenhum funcionário cadastrado neste convênio ainda. Use o card de convites pra começar.',
      SEM_UCS_CUSTEADAS:
        'Os funcionários ainda não têm UC custeada. O admin da cooperativa precisa ativar o contrato custeado de cada um.',
      SEM_FATURAS_NO_MES:
        `Nenhuma fatura aprovada em ${data.mesRefStr} ainda. As faturas chegam pela concessionária e o admin precisa aprovar pelo OCR.`,
      SEM_CONSUMO_CAPTURADO:
        'Funcionários cadastrados, mas o consumo médio (kWh/mês) de cada um ainda não foi capturado. O admin da cooperativa precisa cadastrar o consumo de cada funcionário pra calcular o total.',
    };
    return (
      <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-600">
        {msgs[data.status]}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base text-orange-700 flex items-center gap-2">
          <Zap className="h-4 w-4" /> Consumo dos funcionários — kWh por mês
        </CardTitle>
        <p className="text-xs text-slate-500">
          Quanto cada funcionário consumiu — e quanto da sua fatura é dele.
        </p>
      </CardHeader>
      <CardContent>
        <HelpBox id="conveniada-kwh-consumo-help" titulo="Como ler esta tabela">
          <strong>Disponível (assinatura):</strong> o crédito de energia da sua assinatura
          mensal — referência, não limite duro.
          <br />
          <strong>Total atual (soma):</strong> a soma do consumo dos funcionários no mês.
          Pode ficar acima (excedente) ou abaixo (sobra) do disponível.
          <br />
          <strong>Valor a pagar:</strong> Total × preço do kWh negociado no seu convênio.
          <em> É o MESMO número da cobrança consolidada (sem surpresa na fatura).</em>
          <br />
          <strong>%:</strong> participação de cada funcionário no total. Soma 100%.
          <br />
          <strong>Base "Consumo real":</strong> soma as faturas APROVADAS de cada UC no mês.
          Se aparecer <em>"sem fatura aprovada"</em>, a fatura ainda não foi processada
          pelo OCR — o admin da cooperativa resolve.
          <br />
          <strong>Base "Pacote fixo":</strong> soma o consumo médio cadastrado (kWh/mês)
          de cada funcionário. Se o total subir muito acima do disponível, fale com o
          admin pra ampliar a assinatura.
        </HelpBox>

        {/* Selector de mês */}
        <div className="mt-3 flex items-center gap-2">
          <label htmlFor="kwh-mes-select" className="text-xs font-medium text-slate-600">
            Mês:
          </label>
          <select
            id="kwh-mes-select"
            value={mesSel}
            onChange={(e) => setMesSel(e.target.value)}
            className="text-xs px-2 py-1 rounded border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-orange-400"
          >
            {opcoesMes.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {/* Estados */}
        {carregando && (
          <div className="mt-4 flex items-center gap-2 text-sm text-slate-600">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando consumo...
          </div>
        )}

        {!carregando && erro && (
          <div className="mt-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <div>{erro}</div>
          </div>
        )}

        {!carregando && !erro && data && (
          <>
            {/* Competência no topo */}
            <div className="mt-3 text-xs text-slate-500">
              Competência: <strong className="text-slate-700">{data.mesRefStr}</strong>
            </div>

            {/* Header 3 colunas: Disponível (assinatura) × Total atual (soma) × Valor a pagar */}
            <div className="mt-2 rounded-md border border-orange-200 bg-orange-50 px-4 py-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-slate-600 font-semibold">
                    Disponível (assinatura)
                  </div>
                  <div className="text-lg font-bold text-slate-700 font-mono">
                    {data.disponivelAssinatura !== null
                      ? `${data.disponivelAssinatura.toLocaleString('pt-BR')} kWh`
                      : '—'}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    crédito de energia mensal
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-orange-700 font-semibold">
                    Total atual (soma)
                  </div>
                  <div className="text-2xl font-bold text-orange-900 font-mono">
                    {data.kwhTotal.toLocaleString('pt-BR')} kWh
                  </div>
                  <div className="text-[10px] text-slate-600 mt-0.5">
                    {data.base === 'ALOCACAO_FIXA'
                      ? 'Soma do consumo dos funcionários'
                      : 'Soma das faturas APROVADAS'}
                  </div>
                </div>
                <div className="sm:text-right">
                  <div className="text-[10px] uppercase tracking-wide text-emerald-700 font-semibold">
                    Valor a pagar
                  </div>
                  <div className="text-2xl font-bold text-emerald-900 font-mono">
                    {data.valorAPagar !== null
                      ? data.valorAPagar.toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        })
                      : '—'}
                  </div>
                  <div className="text-[10px] text-slate-600 mt-0.5">
                    {data.valorAPagar !== null && data.tarifaKwh !== null
                      ? `${data.kwhTotal.toLocaleString('pt-BR')} kWh × R$ ${data.tarifaKwh.toFixed(5)}/kWh`
                      : (data.motivoSemValor ?? 'tarifa não configurada no convênio')}
                  </div>
                </div>
              </div>
              {/* Sobra/Excedente em linha separada (sem ocupar a 3ª coluna principal) */}
              {data.disponivelAssinatura !== null && data.kwhTotal > 0 && (
                <div className="mt-3 pt-2 border-t border-orange-200 text-[11px] text-slate-700 flex items-center justify-between gap-2">
                  <span>
                    {data.excedente
                      ? `⚠ Acima do disponível: +${(data.kwhTotal - data.disponivelAssinatura).toLocaleString('pt-BR')} kWh`
                      : `Sobra do crédito: ${(data.disponivelAssinatura - data.kwhTotal).toLocaleString('pt-BR')} kWh`}
                  </span>
                  <span className="text-slate-500">
                    {data.base === 'ALOCACAO_FIXA' ? 'Pacote fixo' : 'Consumo real'}
                  </span>
                </div>
              )}
            </div>

            {/* Warning de excedente (sinaliza sem bloquear) */}
            {data.excedente && (
              <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <div>
                  <strong>Total acima do disponível:</strong> os funcionários estão
                  consumindo mais que o crédito da assinatura. A cobrança usa o total
                  consumido (não trava em 0); se quiser ampliar a assinatura, fale com
                  o admin da cooperativa.
                </div>
              </div>
            )}

            {/* Tabela ou estado vazio */}
            {data.status !== 'OK' ? (
              renderEstadoSemDados()
            ) : data.membros.length === 0 ? (
              <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-600">
                Pacote de {data.kwhTotal.toLocaleString('pt-BR')} kWh contratado, mas
                sem funcionários cadastrados ainda. Use o card de convites pra começar.
              </div>
            ) : (
              <Table className="mt-3">
                <TableHeader>
                  <TableRow>
                    <TableHead>Funcionário</TableHead>
                    <TableHead>UC</TableHead>
                    <TableHead className="text-right">kWh</TableHead>
                    <TableHead className="text-right">%</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.membros.map((m) => (
                    <TableRow key={m.cooperadoId}>
                      <TableCell className="font-medium">
                        {m.nome}
                        {m.isPagador && (
                          <Badge
                            variant="outline"
                            className="ml-2 bg-blue-50 text-blue-700 border-blue-300 text-[10px]"
                          >
                            Sua empresa
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-slate-600 font-mono">
                        {m.ucs.length === 0
                          ? '—'
                          : m.ucs
                              .map(
                                (u) =>
                                  `${u.numeroMascarado} (${u.distribuidora})`,
                              )
                              .join(', ')}
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold">
                        {m.kwh.toLocaleString('pt-BR')}
                      </TableCell>
                      <TableCell className="text-right text-xs text-slate-600">
                        {m.percentual.toFixed(2).replace('.', ',')}%
                      </TableCell>
                      <TableCell>
                        {m.semFaturaNoMes ? (
                          <Badge
                            variant="outline"
                            className="bg-amber-50 text-amber-700 border-amber-300 text-[10px]"
                          >
                            {data.base === 'ALOCACAO_FIXA'
                              ? 'Sem consumo cadastrado'
                              : 'Sem fatura aprovada'}
                          </Badge>
                        ) : m.fonte === 'cota' ? (
                          <Badge
                            variant="outline"
                            className="bg-blue-50 text-blue-700 border-blue-300 text-[10px]"
                          >
                            Consumo médio
                          </Badge>
                        ) : m.fonte === 'rateio' ? (
                          <Badge
                            variant="outline"
                            className="bg-slate-50 text-slate-700 border-slate-300 text-[10px]"
                          >
                            Pacote rateado
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="bg-emerald-50 text-emerald-700 border-emerald-300 text-[10px]"
                          >
                            Fatura processada
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function ConveniadaConvenioDashboard() {
  const params = useParams();
  const convenioId = params.id as string;

  const [data, setData] = useState<DashboardResponse | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      const r = await api.get<DashboardResponse>(
        `/portal/meus-convenios/${convenioId}/dashboard`,
      );
      setData(r.data);
    } catch (err: any) {
      setErro(err?.response?.data?.message ?? err?.message ?? 'Erro ao carregar');
    } finally {
      setCarregando(false);
    }
  }, [convenioId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  if (carregando) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8 flex items-center gap-2 text-sm text-slate-600">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando dashboard...
      </div>
    );
  }

  if (erro || !data) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-900 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <div>{erro ?? 'Convênio não encontrado.'}</div>
        </div>
      </div>
    );
  }

  const c = data.convenio;
  const natureza = c.naturezaAtoCooperativo ? NATUREZA_LABEL[c.naturezaAtoCooperativo] : null;
  const responsavelNome = c.conveniadoNome ?? c.empresaNome;
  const responsavelEmail = c.conveniadoEmail ?? c.empresaEmail;
  const responsavelTelefone = c.conveniadoTelefone ?? c.empresaTelefone;
  const descontoPct = c.descontoKwhCusteio ? Number(c.descontoKwhCusteio) : 0;
  const baseTexto =
    c.baseCobrancaCusteio === 'ALOCACAO_FIXA'
      ? `Pacote fixo (${(c.kwhAlocadoMensal ?? 0).toLocaleString('pt-BR')} kWh/mês)`
      : c.baseCobrancaCusteio === 'CONSUMO_REAL'
        ? 'Consumo real dos membros (soma das faturas)'
        : '—';

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-5">
      {/* Toplink se houver múltiplos convênios */}
      <div className="flex items-center gap-2">
        <Link href="/conveniada" className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1">
          <ArrowLeft className="h-3 w-3" /> Meus convênios
        </Link>
      </div>

      {/* Help geral (mockup) */}
      <HelpBox id="conveniada-overview" titulo="Esta é a área da sua empresa">
        <p>
          Aqui você convida seus funcionários, acompanha quem se cadastrou, aprova os cadastros,
          vê quanta energia precisa e paga a cooperativa. Tudo num lugar só.
        </p>
      </HelpBox>

      {/* 1. Dados da empresa + natureza */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-orange-700 flex items-center gap-2">
            <Building2 className="h-4 w-4" /> Dados da empresa &amp; convênio
          </CardTitle>
          <p className="text-xs text-slate-500">
            Convênio {c.numero} · {c.status === 'ATIVO' ? 'ativo' : c.status.toLowerCase()} desde{' '}
            {dataBr(c.createdAt)}
          </p>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="space-y-1.5">
            <div>
              <span className="text-slate-500">Razão social:</span>{' '}
              <span className="font-semibold">{c.empresaNome}</span>
            </div>
            <div>
              <span className="text-slate-500">CNPJ:</span>{' '}
              <span className="font-semibold">{c.empresaCnpj ?? '—'}</span>
            </div>
            <div>
              <span className="text-slate-500">Responsável:</span>{' '}
              <span className="font-semibold">{responsavelNome}</span>
            </div>
            <div className="flex flex-wrap gap-3 text-xs text-slate-600">
              {responsavelTelefone && (
                <span className="flex items-center gap-1">
                  <Phone className="h-3 w-3" /> {responsavelTelefone}
                </span>
              )}
              {responsavelEmail && (
                <span className="flex items-center gap-1">
                  <Mail className="h-3 w-3" /> {responsavelEmail}
                </span>
              )}
            </div>
          </div>
          <div className="space-y-1.5">
            {natureza && (
              <div>
                <span className="text-slate-500">Natureza do convênio:</span>{' '}
                <Badge variant="outline" className={natureza.cor}>
                  {natureza.texto}
                </Badge>
              </div>
            )}
            <div>
              <span className="text-slate-500">Forma de cobrança:</span>{' '}
              <span className="font-semibold">
                {descontoPct > 0 ? `${descontoPct}% de desconto sobre tarifa` : 'Tarifa cheia'}
              </span>
            </div>
            <div>
              <span className="text-slate-500">Base:</span>{' '}
              <span className="font-semibold">{baseTexto}</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-slate-600">
              <CalendarClock className="h-3 w-3" /> Cobrança gerada todo dia{' '}
              <strong>{c.diaEnvioRelatorio}</strong> do mês
            </div>
          </div>
        </CardContent>
        {c.naturezaAtoCooperativo === 'AUXILIAR' && (
          <CardContent className="pt-0">
            <HelpBox id="natureza-auxiliar-help" titulo='O que é "Ato Cooperativo Auxiliar"?'>
              Significa que o custeio que sua empresa faz é tratado como uma operação de apoio
              entre cooperados — sem impostos de venda.{' '}
              <em>Ex: a CoopereBR não cobra PIS/COFINS sobre o que você deposita pra custear a
              energia dos seus funcionários.</em>
            </HelpBox>
          </CardContent>
        )}
      </Card>

      {/* 2. Convites — reuso */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-orange-700 flex items-center gap-2">
            <Briefcase className="h-4 w-4" /> Convites — convide seus funcionários
          </CardTitle>
          <p className="text-xs text-slate-500">
            Gere um convite com o nome e o WhatsApp da pessoa. O sistema envia o link por WhatsApp.
          </p>
        </CardHeader>
        <CardContent>
          <HelpBox id="conveniada-convites-help" titulo="Como funciona o convite">
            Você digita o nome e o WhatsApp → a pessoa recebe um link, confirma por um código
            (prova que o celular é dela) e se cadastra.{' '}
            <em>Ex: convide "Dra. Ana, 27 99999-0000" → ela recebe no WhatsApp e se cadastra em
            2 minutos.</em>
          </HelpBox>
          <div className="mt-3">
            <GestaoConvitesSection convenioId={convenioId} source="empresa" />
          </div>
        </CardContent>
      </Card>

      {/* 2.5 Convidar em lote — Sprint Convite-Lote LOTE.4 (07/06/2026) */}
      <EnvioLoteSection
        convenioId={convenioId}
        source="empresa"
        onAcaoConcluida={carregar}
      />

      {/* 3. Aprovações pendentes — reuso com source='empresa' */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-orange-700">
            ✅ Aprovações pendentes — confirme seus funcionários
          </CardTitle>
          <p className="text-xs text-slate-500">
            Quem se cadastrou e está esperando você confirmar que é da sua empresa.
          </p>
        </CardHeader>
        <CardContent>
          <MembrosPendentesSection
            convenioId={convenioId}
            source="empresa"
            onAcaoConcluida={carregar}
          />
        </CardContent>
      </Card>

      {/* 4. Financeiro — cobranças */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-orange-700 flex items-center gap-2">
            <DollarSign className="h-4 w-4" /> Financeiro — cobranças da cooperativa
          </CardTitle>
          <p className="text-xs text-slate-500">
            O valor da energia custeada dos seus funcionários, mês a mês.
          </p>
        </CardHeader>
        <CardContent>
          <HelpBox id="conveniada-financeiro-help" titulo="Como pagar">
            Cada mês a cooperativa gera uma cobrança consolidada com a energia de todos os
            funcionários. Você paga via PIX ou boleto pelo link.{' '}
            <em>Ex: clique em "PIX" na cobrança do mês corrente → pague pelo app do banco.</em>
          </HelpBox>
          {data.cobrancas.length === 0 ? (
            <div className="mt-3 px-6 py-8 text-center text-sm text-slate-500">
              Nenhuma cobrança consolidada disponível ainda. Quando o admin gerar (ou o cron
              rodar), aparecerá aqui com link de pagamento.
            </div>
          ) : (
            <Table className="mt-3">
              <TableHeader>
                <TableRow>
                  <TableHead>Competência</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Pago em</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Pagamento</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.cobrancas.map((cob) => {
                  const lbl = STATUS_COB[cob.status] ?? {
                    label: cob.status,
                    cor: 'bg-gray-100',
                  };
                  const asaas = cob.asaasCobrancas?.[0];
                  const linkPag = asaas?.linkPagamento ?? asaas?.boletoUrl ?? null;
                  return (
                    <TableRow key={cob.id}>
                      <TableCell className="font-medium">
                        {mesNome(cob.mesReferencia)}/{cob.anoReferencia}
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold">
                        {moeda(cob.valorLiquido)}
                        {Number(cob.valorMensalidadeClube ?? 0) > 0 && (
                          <div className="text-[10px] text-amber-700 font-normal whitespace-nowrap">
                            Energia {moeda(Number(cob.valorLiquido) - Number(cob.valorMensalidadeClube ?? 0))} ·
                            {' '}Clube {moeda(cob.valorMensalidadeClube ?? 0)}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">{dataBr(cob.dataVencimento)}</TableCell>
                      <TableCell className="text-xs text-emerald-700">
                        {dataBr(cob.dataPagamento)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={lbl.cor}>
                          {lbl.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {cob.status === 'PAGO' ? (
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 text-xs">
                            <Receipt className="h-3 w-3 mr-1" />
                            Quitada
                          </Badge>
                        ) : linkPag ? (
                          <a
                            href={linkPag}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-orange-700 hover:text-orange-900 inline-flex items-center gap-1 font-medium"
                          >
                            <ExternalLink className="h-3 w-3" /> PIX/Boleto
                          </a>
                        ) : (
                          <span className="text-xs text-slate-400">aguardando emissão</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 5. Consumo dos funcionários — Bloco 2 Fatia 2.4 (ATIVADO 07/06/2026) */}
      <ConsumoFuncionariosCard convenioId={convenioId} />

      {/* 6. Tokens & benefícios — FASE FUTURA (fora do escopo ENERGIA) */}
      <Card className="opacity-70 border-dashed">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-slate-500 flex items-center gap-2">
            🎟️ Tokens &amp; benefícios
            <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-300 text-[10px]">
              FASE FUTURA
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-slate-500 space-y-1">
          <p>
            Acompanhamento dos tokens dos funcionários na rede de benefícios — fase
            posterior, fora do escopo ENERGIA.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
