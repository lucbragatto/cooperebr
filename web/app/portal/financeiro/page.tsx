'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  DollarSign, Calendar, TrendingDown, Download, CreditCard,
  CheckCircle, Clock, AlertTriangle, FileText, Upload, Loader2, Zap, Gift,
} from 'lucide-react';
import RelatorioFaturaCooperado from '@/components/RelatorioFaturaCooperado';

interface CobrancaItem {
  id: string;
  mesReferencia: number;
  anoReferencia: number;
  valorBruto: number;
  valorDesconto: number;
  valorLiquido: number;
  status: string;
  dataVencimento: string;
  dataPagamento: string | null;
  asaasCobrancas: { boletoUrl: string | null; linkPagamento: string | null }[];
}

interface FaturaItem {
  id: string;
  mesReferencia: string | null;
  dadosExtraidos: any;
  statusRevisao: string;
  cobrancaGeradaId: string | null;
  createdAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  PAGO: { label: 'Pago', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  A_VENCER: { label: 'A Vencer', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  VENCIDO: { label: 'Vencido', color: 'bg-red-100 text-red-700', icon: AlertTriangle },
  CANCELADO: { label: 'Cancelado', color: 'bg-gray-100 text-gray-500', icon: Clock },
};

type AbaPortal = 'cobrancas' | 'creditos' | 'faturas' | 'beneficios';

export default function PortalFinanceiroPage() {
  const [abaAtiva, setAbaAtiva] = useState<AbaPortal>('cobrancas');
  const [cobrancas, setCobrancas] = useState<CobrancaItem[]>([]);
  const [faturas, setFaturas] = useState<FaturaItem[]>([]);
  const [beneficios, setBeneficios] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [relatorioModal, setRelatorioModal] = useState<any>(null);
  const [relatorioData, setRelatorioData] = useState<any>(null);
  const [cooperadoId, setCooperadoId] = useState<string>('');

  // Upload self-service
  const [uploadOpen, setUploadOpen] = useState(false);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [mesRef, setMesRef] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState('');

  useEffect(() => {
    Promise.all([
      api.get('/cooperados/meu-perfil').then(async (r) => {
        const id = r.data.id;
        setCooperadoId(id);
        const [cobRes, fatRes, benRes] = await Promise.all([
          api.get('/cooperados/meu-perfil/cobrancas').catch(() => ({ data: [] })),
          api.get(`/faturas/cooperado/${id}`).catch(() => ({ data: [] })),
          api.get(`/indicacoes/beneficios?cooperadoId=${id}`).catch(() => ({ data: [] })),
        ]);
        setCobrancas(cobRes.data);
        setFaturas(fatRes.data);
        setBeneficios(benRes.data);
      }).catch(() => {}),
    ]).finally(() => setCarregando(false));
  }, []);

  async function abrirRelatorio(faturaId: string) {
    try {
      const { data } = await api.get(`/faturas/${faturaId}/relatorio`);
      setRelatorioData(data);
      setRelatorioModal(true);
    } catch {
      // silently ignore
    }
  }

  async function enviarFatura() {
    if (!arquivo || !mesRef) return;
    setUploading(true);
    setUploadMsg('');
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve) => {
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(arquivo);
      });
      const tipoArquivo = arquivo.type.includes('pdf') ? 'pdf' : 'imagem';
      const { data } = await api.post('/faturas/upload-concessionaria', {
        cooperadoId,
        arquivoBase64: base64,
        tipoArquivo,
        mesReferencia: mesRef,
      });
      setUploadMsg(data.statusRevisao === 'AUTO_APROVADO'
        ? 'Fatura processada e aprovada automaticamente!'
        : 'Fatura enviada para análise. Você será notificado.');
      setArquivo(null);
      const { data: novasFaturas } = await api.get(`/faturas/cooperado/${cooperadoId}`);
      setFaturas(novasFaturas);
    } catch (err: any) {
      setUploadMsg(err?.response?.data?.message ?? 'Erro ao processar fatura');
    } finally {
      setUploading(false);
    }
  }

  if (carregando) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-20 bg-gray-200 animate-pulse rounded-xl" />
        ))}
      </div>
    );
  }

  const totalEconomizado = cobrancas
    .filter((c) => c.status === 'PAGO')
    .reduce((acc, c) => acc + Number(c.valorDesconto), 0);

  const totalPago = cobrancas
    .filter((c) => c.status === 'PAGO')
    .reduce((acc, c) => acc + Number(c.valorLiquido), 0);

  const totalAberto = cobrancas
    .filter((c) => c.status !== 'PAGO' && c.status !== 'CANCELADO')
    .reduce((acc, c) => acc + Number(c.valorLiquido), 0);

  const totalCreditos = faturas.reduce((s, f) => s + Number((f.dadosExtraidos as any)?.creditosRecebidosKwh ?? 0), 0);
  const totalBeneficios = beneficios.reduce((s, b) => s + Number(b.valorDesconto ?? 0), 0);

  const proximoVencimento = cobrancas.find((c) => c.status === 'A_VENCER');

  const abas: { id: AbaPortal; label: string; icon: typeof CreditCard }[] = [
    { id: 'cobrancas', label: 'Minhas Cobranças', icon: CreditCard },
    { id: 'creditos', label: 'Meus Créditos', icon: Zap },
    { id: 'faturas', label: 'Faturas Concessionária', icon: FileText },
    { id: 'beneficios', label: 'Meus Benefícios', icon: Gift },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-gray-800">Financeiro</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                <TrendingDown className="w-5 h-5 text-green-700" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Total economizado</p>
                <p className="text-xl font-bold text-green-700">
                  R$ {totalEconomizado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="pt-3 pb-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-600 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-gray-500">Próx. vencimento</p>
                  <p className="text-sm font-semibold text-gray-800 truncate">
                    {proximoVencimento
                      ? new Date(proximoVencimento.dataVencimento).toLocaleDateString('pt-BR')
                      : '—'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-3 pb-3">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-green-600 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-gray-500">Total pago</p>
                  <p className="text-sm font-semibold text-gray-800 truncate">
                    R$ {totalPago.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Abas */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {abas.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setAbaAtiva(id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
              abaAtiva === id ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* ═══ Aba: Minhas Cobranças ═══ */}
      {abaAtiva === 'cobrancas' && (
        <div>
          {cobrancas.length === 0 ? (
            <Card>
              <CardContent className="pt-6 pb-6 text-center">
                <DollarSign className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">Nenhuma cobrança encontrada.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {cobrancas.map((c) => {
                const cfg = STATUS_CONFIG[c.status] ?? STATUS_CONFIG.A_VENCER;
                const StatusIcon = cfg.icon;
                const mesLabel = `${String(c.mesReferencia).padStart(2, '0')}/${c.anoReferencia}`;
                const boletoUrl = c.asaasCobrancas?.[0]?.boletoUrl ?? c.asaasCobrancas?.[0]?.linkPagamento;

                return (
                  <Card key={c.id}>
                    <CardContent className="pt-3 pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                          <StatusIcon className={`w-4 h-4 flex-shrink-0 ${c.status === 'PAGO' ? 'text-green-600' : c.status === 'VENCIDO' ? 'text-red-500' : 'text-yellow-500'}`} />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-800">{mesLabel}</p>
                            <p className="text-xs text-gray-500">
                              Venc.: {new Date(c.dataVencimento).toLocaleDateString('pt-BR')}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <div className="text-right">
                            <p className="text-sm font-bold text-gray-800">
                              R$ {Number(c.valorLiquido).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </p>
                            <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${cfg.color}`}>
                              {cfg.label}
                            </span>
                          </div>
                          {boletoUrl && c.status !== 'PAGO' && (
                            <a
                              href={boletoUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="p-1.5 text-gray-400 hover:text-green-600 transition-colors"
                              title="Download boleto"
                            >
                              <Download className="w-4 h-4" />
                            </a>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══ Aba: Meus Créditos ═══ */}
      {abaAtiva === 'creditos' && (
        <div className="space-y-3">
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <Zap className="w-5 h-5 text-blue-700" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Total de créditos compensados</p>
                  <p className="text-xl font-bold text-blue-700">
                    {totalCreditos.toLocaleString('pt-BR')} kWh
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Histórico Mensal</h3>
          {faturas.length === 0 ? (
            <Card>
              <CardContent className="pt-6 pb-6 text-center">
                <Zap className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">Nenhum crédito registrado.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {faturas.map((f) => {
                const d = f.dadosExtraidos as any;
                const kwh = Number(d?.creditosRecebidosKwh ?? 0);
                return (
                  <Card key={f.id}>
                    <CardContent className="pt-3 pb-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-800">
                            {f.mesReferencia ?? d?.mesReferencia ?? '—'}
                          </p>
                          <p className="text-xs text-gray-500">
                            Consumo: {d?.consumoAtualKwh ?? '—'} kWh
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-blue-700">
                            {kwh.toLocaleString('pt-BR')} kWh
                          </p>
                          <p className="text-xs text-gray-400">compensados</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══ Aba: Faturas Concessionária ═══ */}
      {abaAtiva === 'faturas' && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
              Faturas da Concessionária
            </h2>
            <Button size="sm" variant="outline" onClick={() => setUploadOpen(!uploadOpen)}>
              <Upload className="w-3.5 h-3.5 mr-1" />Enviar fatura
            </Button>
          </div>

          {/* Upload self-service */}
          {uploadOpen && (
            <Card className="mb-3 border-dashed border-2 border-green-300 bg-green-50">
              <CardContent className="pt-4 pb-4 space-y-3">
                <p className="text-sm text-gray-600">Escaneie ou fotografe sua fatura da concessionária e envie para análise.</p>
                <div className="flex flex-col gap-2">
                  <input
                    type="month"
                    value={mesRef}
                    onChange={(e) => setMesRef(e.target.value)}
                    className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
                  />
                  <input
                    type="file"
                    accept=".pdf,image/*"
                    className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
                    onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
                  />
                </div>
                {arquivo && (
                  <Button size="sm" onClick={enviarFatura} disabled={uploading}>
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
                    Enviar e Processar
                  </Button>
                )}
                {uploadMsg && (
                  <p className={`text-xs font-medium ${uploadMsg.includes('Erro') ? 'text-red-600' : 'text-green-700'}`}>
                    {uploadMsg}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {faturas.length === 0 ? (
            <Card>
              <CardContent className="pt-6 pb-6 text-center">
                <FileText className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">Nenhuma fatura processada.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {faturas.map((f) => {
                const d = f.dadosExtraidos as any;
                const sr = f.statusRevisao;
                return (
                  <Card
                    key={f.id}
                    className="cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => abrirRelatorio(f.id)}
                  >
                    <CardContent className="pt-3 pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                          <Zap className={`w-4 h-4 flex-shrink-0 ${
                            sr === 'AUTO_APROVADO' || sr === 'APROVADO' ? 'text-green-600' :
                            sr === 'PENDENTE_REVISAO' ? 'text-yellow-500' : 'text-gray-400'
                          }`} />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-800">
                              {f.mesReferencia ?? d?.mesReferencia ?? '—'}
                            </p>
                            <p className="text-xs text-gray-500">
                              {Number(d?.creditosRecebidosKwh ?? 0)} kWh compensados
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Badge variant="outline" className={`text-xs ${
                            sr === 'AUTO_APROVADO' || sr === 'APROVADO' ? 'bg-green-100 text-green-700' :
                            sr === 'PENDENTE_REVISAO' ? 'bg-yellow-100 text-yellow-700' : ''
                          }`}>
                            {sr === 'AUTO_APROVADO' ? 'Aprovado' : sr === 'APROVADO' ? 'Aprovado' : sr === 'PENDENTE_REVISAO' ? 'Em análise' : sr}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══ Aba: Meus Benefícios ═══ */}
      {abaAtiva === 'beneficios' && (
        <div className="space-y-3">
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                  <Gift className="w-5 h-5 text-purple-700" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Total em benefícios de indicação</p>
                  <p className="text-xl font-bold text-purple-700">
                    R$ {totalBeneficios.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {beneficios.length === 0 ? (
            <Card>
              <CardContent className="pt-6 pb-6 text-center">
                <Gift className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">Nenhum benefício de indicação aplicado.</p>
                <p className="text-xs text-gray-400 mt-1">Indique amigos para ganhar descontos!</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {beneficios.map((b: any, i: number) => (
                <Card key={b.id ?? i}>
                  <CardContent className="pt-3 pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-800">
                          {b.descricao ?? `Indicação — ${String(b.mesReferencia).padStart(2, '0')}/${b.anoReferencia}`}
                        </p>
                        <p className="text-xs text-gray-500">
                          {b.tipoDesconto === 'PERCENTUAL' ? `${b.valorDesconto}% de desconto` : `R$ ${Number(b.valorDesconto).toFixed(2)} de desconto`}
                        </p>
                      </div>
                      <Badge variant="outline" className="bg-purple-100 text-purple-700">
                        {b.status === 'APLICADO' ? 'Aplicado' : b.status ?? 'Ativo'}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal relatório */}
      <Dialog open={!!relatorioModal} onOpenChange={(open) => { if (!open) { setRelatorioModal(null); setRelatorioData(null); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Relatório Mensal</DialogTitle>
          </DialogHeader>
          {relatorioData && <RelatorioFaturaCooperado relatorio={relatorioData} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
