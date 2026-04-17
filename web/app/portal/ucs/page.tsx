'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Zap,
  MapPin,
  Building2,
  Plus,
  X,
  Upload,
  BarChart3,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface UcItem {
  id: string;
  numero: string;
  endereco: string;
  cidade: string;
  estado: string;
  distribuidora: string | null;
  contratos: { percentualDesconto: number; status: string }[];
  faturasProcessadas: { mediaKwhCalculada: number }[];
}

export default function PortalUcsPage() {
  const [ucs, setUcs] = useState<UcItem[]>([]);
  const [cooperadoId, setCooperadoId] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [ucSelecionada, setUcSelecionada] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.get('/cooperados/meu-perfil/ucs'),
      api.get('/cooperados/meu-perfil'),
    ])
      .then(([ucsRes, perfilRes]) => {
        setUcs(ucsRes.data);
        setCooperadoId(perfilRes.data.id);
      })
      .catch(() => {})
      .finally(() => setCarregando(false));
  }, []);

  if (carregando) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-28 bg-gray-200 animate-pulse rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-800">Minhas UCs</h1>
        <Button
          size="sm"
          className="bg-green-600 hover:bg-green-700 text-white"
          onClick={() => setModalAberto(true)}
        >
          <Plus className="w-4 h-4 mr-1" />
          Nova UC
        </Button>
      </div>

      {ucs.length === 0 ? (
        <Card>
          <CardContent className="pt-6 pb-6 text-center">
            <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
              <Zap className="w-7 h-7 text-gray-400" />
            </div>
            <h3 className="font-semibold text-gray-700 mb-1">
              Nenhuma UC vinculada
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Adicione sua unidade consumidora para começar a economizar.
            </p>
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={() => setModalAberto(true)}
            >
              <Plus className="w-4 h-4 mr-1" />
              Adicionar UC
            </Button>
          </CardContent>
        </Card>
      ) : (
        ucs.map((uc) => {
          const desconto = uc.contratos[0]
            ? Number(uc.contratos[0].percentualDesconto)
            : null;
          const consumoMedio = uc.faturasProcessadas[0]
            ? Number(uc.faturasProcessadas[0].mediaKwhCalculada)
            : null;
          const statusContrato = uc.contratos[0]?.status ?? null;

          return (
            <Card
              key={uc.id}
              className="cursor-pointer hover:ring-green-200 transition-all"
              onClick={() =>
                setUcSelecionada(ucSelecionada === uc.id ? null : uc.id)
              }
            >
              <CardContent className="pt-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                      <Zap className="w-5 h-5 text-green-700" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-800 truncate">
                        UC {uc.numero}
                      </p>
                      <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                        <MapPin className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">
                          {uc.endereco}, {uc.cidade}/{uc.estado}
                        </span>
                      </div>
                      {uc.distribuidora && (
                        <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                          <Building2 className="w-3 h-3 flex-shrink-0" />
                          <span>{uc.distribuidora}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  {statusContrato && (
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${
                        statusContrato === 'ATIVO'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}
                    >
                      {statusContrato === 'ATIVO' ? 'Ativo' : 'Pendente'}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-gray-100">
                  <div>
                    <p className="text-xs text-gray-500">Consumo médio</p>
                    <p className="text-sm font-semibold text-gray-800">
                      {consumoMedio
                        ? `${consumoMedio.toLocaleString('pt-BR')} kWh`
                        : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Desconto</p>
                    <p className="text-sm font-semibold text-green-700">
                      {desconto != null ? `${desconto}%` : '—'}
                    </p>
                  </div>
                </div>

                {/* Gráfico de consumo expandido */}
                {ucSelecionada === uc.id && <UcChart ucId={uc.id} />}
              </CardContent>
            </Card>
          );
        })
      )}

      {/* Modal Adicionar UC */}
      {modalAberto && (
        <ModalNovaUc cooperadoId={cooperadoId} onClose={() => setModalAberto(false)} onSuccess={() => {
          setModalAberto(false);
          api.get('/cooperados/meu-perfil/ucs').then((res) => setUcs(res.data));
        }} />
      )}
    </div>
  );
}

function UcChart({ ucId }: { ucId: string }) {
  const [dados, setDados] = useState<{ mes: string; kwh: number; valor: number }[]>([]);
  const [temKwh, setTemKwh] = useState(false);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    api
      .get(`/cooperados/meu-perfil/cobrancas?ucId=${ucId}`)
      .then((res) => {
        const cobrancas = (res.data as Record<string, unknown>[]).slice(0, 6).reverse();
        const algumKwh = cobrancas.some(
          (c) => c.kwhEntregue != null || c.kwhConsumido != null,
        );
        setTemKwh(algumKwh);
        setDados(
          cobrancas.map((c) => ({
            mes: `${String(c.mesReferencia).padStart(2, '0')}/${c.anoReferencia}`,
            kwh: Number(c.kwhEntregue ?? c.kwhConsumido ?? 0),
            valor: Number(c.valorLiquido ?? 0),
          })),
        );
      })
      .catch(() => {})
      .finally(() => setCarregando(false));
  }, [ucId]);

  if (carregando) return <div className="h-40 bg-gray-100 animate-pulse rounded-lg mt-3" />;
  if (dados.length === 0) {
    return (
      <div className="mt-3 pt-3 border-t border-gray-100 text-center text-sm text-gray-400 py-6">
        <BarChart3 className="w-6 h-6 mx-auto mb-1 text-gray-300" />
        Sem dados de consumo ainda
      </div>
    );
  }

  const dataKey = temKwh ? 'kwh' : 'valor';
  const label = temKwh ? 'kWh' : 'R$';

  return (
    <div className="mt-3 pt-3 border-t border-gray-100">
      <p className="text-xs text-gray-500 mb-2 font-medium">
        {temKwh ? 'Geração / Consumo (últimos meses)' : 'Cobranças (últimos meses)'}
      </p>
      <ResponsiveContainer width="100%" height={140}>
        <BarChart data={dados}>
          <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} width={50} />
          <Tooltip
            formatter={(value) => [`${label} ${value}`, label]}
            labelStyle={{ fontSize: 12 }}
          />
          <Bar dataKey={dataKey} fill="#16a34a" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ModalNovaUc({
  onClose,
  onSuccess,
}: {
  cooperadoId: string | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [etapa, setEtapa] = useState<1 | 2 | 3>(1);
  const [numero, setNumero] = useState('');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');

  // Dados retornados pelo endpoint nova-uc-com-fatura
  const [ucId, setUcId] = useState('');
  const [simulacao, setSimulacao] = useState<Record<string, number> | null>(null);
  const [dadosOcr, setDadosOcr] = useState<Record<string, unknown> | null>(null);
  const [outlier, setOutlier] = useState(false);

  // Dados retornados pelo endpoint confirmar-nova-uc
  const [contratoNumero, setContratoNumero] = useState<string | null>(null);
  const [emListaEspera, setEmListaEspera] = useState(false);

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  // ── Etapa 1: Upload + OCR ──────────────────────────────────────────────

  async function analisarFatura() {
    if (!numero.trim()) { setErro('Informe o número da UC.'); return; }
    if (!arquivo) { setErro('Envie a fatura (foto ou PDF).'); return; }
    setCarregando(true);
    setErro('');
    try {
      const formData = new FormData();
      formData.append('fatura', arquivo);
      formData.append('numeroUC', numero.trim());
      const { data: resp } = await api.post<{
        ok: boolean;
        ucId: string;
        outlierDetectado: boolean;
        simulacao: Record<string, number> | null;
        dadosOcr: Record<string, unknown> | null;
      }>('/cooperados/meu-perfil/nova-uc-com-fatura', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUcId(resp.ucId);
      setSimulacao(resp.simulacao);
      setDadosOcr(resp.dadosOcr);
      if (resp.outlierDetectado) {
        setOutlier(true);
      } else {
        setEtapa(2);
      }
    } catch (err: unknown) {
      const resp = (err as { response?: { status?: number; data?: { message?: string } } })?.response;
      if (resp?.status === 409) {
        setErro(resp.data?.message ?? 'UC já cadastrada.');
      } else {
        setErro(resp?.data?.message ?? 'Erro ao analisar fatura. Tente novamente.');
      }
    } finally {
      setCarregando(false);
    }
  }

  // ── Etapa 3: Confirmação ───────────────────────────────────────────────

  async function confirmarProposta() {
    setCarregando(true);
    setErro('');
    try {
      const { data: resp } = await api.post<{
        ok: boolean;
        propostaId: string | null;
        contratoNumero: string | null;
        emListaEspera: boolean;
      }>('/cooperados/meu-perfil/confirmar-nova-uc', {
        ucId,
        consumoKwh: dadosOcr?.consumoMedioKwh ? Number(dadosOcr.consumoMedioKwh) : undefined,
        valorFatura: dadosOcr?.totalAPagar ? Number(dadosOcr.totalAPagar) : undefined,
      });
      setContratoNumero(resp.contratoNumero);
      setEmListaEspera(resp.emListaEspera);
      setEtapa(3);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setErro(msg ?? 'Erro ao confirmar. Tente novamente.');
    } finally {
      setCarregando(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md p-5 relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
          <X className="w-5 h-5" />
        </button>

        {/* ── Etapa 1: Upload + OCR ── */}
        {etapa === 1 && !outlier && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-gray-800">Adicionar nova UC</h2>
            <p className="text-sm text-gray-500">Envie a fatura da sua unidade consumidora para análise automática.</p>
            <div>
              <Label htmlFor="numero-uc">Número da UC</Label>
              <Input id="numero-uc" placeholder="Ex: 0012345678" value={numero} onChange={(e) => setNumero(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="fatura-upload">Fatura (foto ou PDF)</Label>
              <label htmlFor="fatura-upload"
                className="flex items-center justify-center gap-2 w-full h-20 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-green-400 transition-colors text-sm text-gray-500">
                <Upload className="w-5 h-5" />
                {arquivo ? arquivo.name : 'Clique ou arraste para enviar'}
              </label>
              <input id="fatura-upload" type="file" accept="image/*,.pdf" className="hidden"
                onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
            </div>
            {erro && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{erro}</p>}
            <Button onClick={analisarFatura} disabled={carregando} className="w-full bg-green-600 hover:bg-green-700 text-white">
              {carregando ? 'Analisando fatura...' : 'Analisar fatura'}
            </Button>
          </div>
        )}

        {/* ── Outlier detectado ── */}
        {etapa === 1 && outlier && (
          <div className="space-y-4 text-center py-4">
            <div className="text-4xl">⚠️</div>
            <h2 className="text-lg font-bold text-gray-800">Consumo irregular detectado</h2>
            <p className="text-sm text-gray-600">
              Identificamos um padrão de consumo atípico na sua fatura. Nossa equipe entrará em contato para finalizar a inclusão da sua UC.
            </p>
            <p className="text-xs text-gray-500">UC {numero} foi registrada. Você será contatado em breve.</p>
            <Button onClick={onClose} variant="outline" className="w-full">Fechar</Button>
          </div>
        )}

        {/* ── Etapa 2: Simulação ── */}
        {etapa === 2 && simulacao && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-gray-800">Simulação de economia</h2>
            <p className="text-sm text-gray-500">Confira a economia estimada para sua nova UC.</p>

            <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">UC</span>
                <span className="font-medium text-gray-800">{numero}</span>
              </div>
              {dadosOcr?.distribuidora ? (
                <div className="flex justify-between">
                  <span className="text-gray-600">Distribuidora</span>
                  <span className="font-medium text-gray-800">{String(dadosOcr.distribuidora)}</span>
                </div>
              ) : null}
              <div className="flex justify-between">
                <span className="text-gray-600">Consumo médio</span>
                <span className="font-medium text-gray-800">{Math.round(Number(dadosOcr?.consumoMedioKwh ?? 0)).toLocaleString('pt-BR')} kWh/mês</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Valor atual</span>
                <span className="font-medium text-gray-800">{fmt(Number(dadosOcr?.totalAPagar ?? 0))}/mês</span>
              </div>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-green-700">Desconto</span>
                <span className="font-bold text-green-800">{Number(simulacao.descontoPercentual ?? 0).toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-green-700">Economia mensal</span>
                <span className="font-bold text-green-800">{fmt(Number(simulacao.economiaMensal ?? 0))}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-green-700">Economia anual</span>
                <span className="font-bold text-green-800">{fmt(Number(simulacao.economiaAnual ?? 0))}</span>
              </div>
            </div>

            {erro && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{erro}</p>}

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => { setEtapa(1); setErro(''); }} className="flex-1">
                Voltar
              </Button>
              <Button onClick={confirmarProposta} disabled={carregando} className="flex-1 bg-green-600 hover:bg-green-700 text-white">
                {carregando ? 'Criando contrato...' : 'Confirmar'}
              </Button>
            </div>
          </div>
        )}

        {/* ── Etapa 2 sem simulação (motor falhou) ── */}
        {etapa === 2 && !simulacao && (
          <div className="space-y-4 text-center py-4">
            <div className="text-4xl">📋</div>
            <h2 className="text-lg font-bold text-gray-800">UC cadastrada</h2>
            <p className="text-sm text-gray-600">
              Sua UC {numero} foi cadastrada, mas não foi possível calcular a simulação agora.
              Nossa equipe completará o processo.
            </p>
            <Button onClick={onSuccess} className="w-full bg-green-600 hover:bg-green-700 text-white">
              Fechar
            </Button>
          </div>
        )}

        {/* ── Etapa 3: Confirmação ── */}
        {etapa === 3 && (
          <div className="space-y-4 text-center py-4">
            <div className="text-4xl">🎉</div>
            <h2 className="text-lg font-bold text-green-700">UC adicionada com sucesso!</h2>
            {contratoNumero && !emListaEspera && (
              <p className="text-sm text-gray-600">
                Contrato <strong>#{contratoNumero}</strong> criado e aguardando ativação.
              </p>
            )}
            {emListaEspera && (
              <p className="text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                Você entrou na lista de espera por uma usina compatível. Será notificado quando houver vaga.
              </p>
            )}
            {!contratoNumero && !emListaEspera && (
              <p className="text-sm text-gray-600">
                Sua UC foi registrada. O contrato será criado quando houver usina disponível.
              </p>
            )}
            <Button onClick={onSuccess} className="w-full bg-green-600 hover:bg-green-700 text-white">
              Fechar
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
