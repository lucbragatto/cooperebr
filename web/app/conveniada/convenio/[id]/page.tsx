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

      {/* Bloco capacidade kWh + tokens — FASE FUTURA */}
      <Card className="opacity-70 border-dashed">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-slate-500 flex items-center gap-2">
            ⚡ Capacidade do plano · 🎟️ Tokens &amp; benefícios
            <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-300 text-[10px]">
              FASE FUTURA
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-slate-500 space-y-1">
          <p>
            <strong>Capacidade kWh:</strong> visão de pacote contratado × consumo dos funcionários
            ativos (próxima fatia 9.2).
          </p>
          <p>
            <strong>Tokens &amp; benefícios:</strong> acompanhamento dos tokens dos funcionários
            na rede de benefícios (fase posterior — fora do escopo ENERGIA).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
