'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import type { Cooperado } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft,
  Camera,
  CheckCircle,
  FileText,
  Image as ImageIcon,
  Upload,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface HistoricoItem {
  mesAno: string;
  consumoKwh: number;
  valorRS: number;
}

interface DadosExtraidos {
  titular: string;
  documento: string;
  tipoDocumento: 'CPF' | 'CNPJ';
  enderecoInstalacao: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
  numeroUC: string;
  codigoMedidor: string;
  distribuidora: string;
  classificacao: string;
  modalidadeTarifaria: string;
  tensaoNominal: string;
  tipoFornecimento: string;
  mesReferencia: string;
  vencimento: string;
  totalAPagar: number;
  consumoAtualKwh: number;
  bandeiraTarifaria: string;
  possuiCompensacao: boolean;
  creditosRecebidosKwh: number;
  historicoConsumo: HistoricoItem[];
}

interface ProcessarResult {
  faturaId: string;
  dadosExtraidos: DadosExtraidos;
  mediaKwhCalculada: number;
  mesesUtilizados: number;
  mesesDescartados: number;
  thresholdUtilizado: number;
  arquivoUrl: string;
}

type Tab = 'pdf' | 'foto' | 'imagem';

const PERCENTUAL_DESCONTO = 0.15;

const bandeiraLabel: Record<string, string> = {
  VERDE: 'Verde',
  AMARELA: 'Amarela',
  VERMELHA_1: 'Vermelha 1',
  VERMELHA_2: 'Vermelha 2',
};

const tabConfig: Record<Tab, { label: string; accept: string; capture?: 'environment' | 'user' }> = {
  pdf: { label: 'Selecionar PDF', accept: 'application/pdf' },
  foto: { label: 'Tirar Foto', accept: 'image/*', capture: 'environment' },
  imagem: { label: 'Selecionar Imagem', accept: 'image/jpeg,image/png' },
};

function Campo({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className="text-sm font-medium text-gray-800">{value ?? '—'}</p>
    </div>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function ProcessarFaturaPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [cooperado, setCooperado] = useState<Cooperado | null>(null);
  const [tab, setTab] = useState<Tab>('pdf');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [processando, setProcessando] = useState(false);
  const [resultado, setResultado] = useState<ProcessarResult | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [confirmado, setConfirmado] = useState(false);
  const [erro, setErro] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api
      .get<Cooperado>(`/cooperados/${id}`)
      .then((r) => setCooperado(r.data))
      .catch(() => setErro('Cooperado não encontrado.'));
  }, [id]);

  function onTabChange(t: Tab) {
    setTab(t);
    setArquivo(null);
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setArquivo(file);
    setResultado(null);
    setConfirmado(false);
    setErro('');

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (ev) => setPreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
    }
  }

  async function processar() {
    if (!arquivo) return;
    setProcessando(true);
    setErro('');
    setResultado(null);
    try {
      const arquivoBase64 = await fileToBase64(arquivo);
      const tipoArquivo = arquivo.type === 'application/pdf' ? 'pdf' : 'imagem';
      const { data } = await api.post<ProcessarResult>('/faturas/processar', {
        cooperadoId: id,
        arquivoBase64,
        tipoArquivo,
      });
      setResultado(data);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setErro(err.response?.data?.message ?? 'Erro ao processar fatura. Tente novamente.');
    } finally {
      setProcessando(false);
    }
  }

  async function confirmar() {
    if (!resultado?.faturaId) return;
    setConfirmando(true);
    setErro('');
    try {
      await api.patch(`/faturas/${resultado.faturaId}/aprovar`);
      setConfirmado(true);
    } catch {
      setErro('Erro ao confirmar proposta.');
    } finally {
      setConfirmando(false);
    }
  }

  const historico = resultado?.dadosExtraidos.historicoConsumo ?? [];
  const ultimos12 = historico.slice(-12);
  const totalEconomia = ultimos12.reduce((acc, m) => acc + m.valorRS * PERCENTUAL_DESCONTO, 0);

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="sm" onClick={() => router.push(`/dashboard/cooperados/${id}`)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        <h2 className="text-2xl font-bold text-gray-800">
          Processar Fatura{cooperado ? ` — ${cooperado.nomeCompleto}` : ''}
        </h2>
      </div>

      {erro && <p className="text-red-500 mb-4 text-sm">{erro}</p>}

      {/* Upload area */}
      {!resultado && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Selecionar Arquivo</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Tabs */}
            <div className="flex gap-2 mb-6">
              {(['pdf', 'foto', 'imagem'] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => onTabChange(t)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    tab === t
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {t === 'pdf' && <FileText className="h-4 w-4" />}
                  {t === 'foto' && <Camera className="h-4 w-4" />}
                  {t === 'imagem' && <ImageIcon className="h-4 w-4" />}
                  {tabConfig[t].label}
                </button>
              ))}
            </div>

            {/* Drop zone */}
            <div
              className="border-2 border-dashed border-gray-300 rounded-lg p-10 text-center cursor-pointer hover:border-green-500 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-8 w-8 mx-auto mb-2 text-gray-400" />
              <p className="text-sm text-gray-500">
                {arquivo ? arquivo.name : 'Clique para selecionar'}
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept={tabConfig[tab].accept}
                capture={tabConfig[tab].capture}
                onChange={onFileChange}
                className="hidden"
              />
            </div>

            {/* PDF preview */}
            {arquivo && !preview && (
              <div className="mt-4 p-3 bg-gray-50 rounded-md flex items-center gap-3">
                <FileText className="h-6 w-6 text-red-500 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-800">{arquivo.name}</p>
                  <p className="text-xs text-gray-500">{formatBytes(arquivo.size)}</p>
                </div>
              </div>
            )}

            {/* Image preview */}
            {preview && (
              <div className="mt-4 flex justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview} alt="Preview" className="max-h-64 rounded-md object-contain" />
              </div>
            )}

            {arquivo && (
              <div className="mt-5">
                <Button onClick={processar} disabled={processando} className="w-full">
                  {processando
                    ? 'Analisando fatura com IA... (pode levar 20-30 segundos)'
                    : 'Processar Fatura'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {resultado && (
        <div className="space-y-6">
          {/* Card 1 — Dados do titular */}
          <Card>
            <CardHeader>
              <CardTitle>Dados do Titular</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <Campo label="Nome" value={resultado.dadosExtraidos.titular} />
              <Campo
                label={resultado.dadosExtraidos.tipoDocumento}
                value={resultado.dadosExtraidos.documento}
              />
              <Campo
                label="Endereço"
                value={[
                  resultado.dadosExtraidos.enderecoInstalacao,
                  resultado.dadosExtraidos.bairro,
                  `${resultado.dadosExtraidos.cidade}/${resultado.dadosExtraidos.estado}`,
                ]
                  .filter(Boolean)
                  .join(', ')}
              />
              <Campo label="UC" value={resultado.dadosExtraidos.numeroUC} />
              <Campo label="Distribuidora" value={resultado.dadosExtraidos.distribuidora} />
              <Campo label="Classificação" value={resultado.dadosExtraidos.classificacao} />
            </CardContent>
          </Card>

          {/* Card 2 — Consumo e proposta */}
          <Card>
            <CardHeader>
              <CardTitle>Consumo e Proposta</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-3 gap-4">
              <Campo
                label="Consumo atual (kWh)"
                value={resultado.dadosExtraidos.consumoAtualKwh.toLocaleString('pt-BR')}
              />
              <Campo
                label="Total a pagar"
                value={resultado.dadosExtraidos.totalAPagar.toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                })}
              />
              <Campo
                label="Bandeira tarifária"
                value={
                  bandeiraLabel[resultado.dadosExtraidos.bandeiraTarifaria] ??
                  resultado.dadosExtraidos.bandeiraTarifaria
                }
              />
              <Campo
                label="Média calculada (kWh/mês)"
                value={resultado.mediaKwhCalculada.toLocaleString('pt-BR', {
                  maximumFractionDigits: 0,
                })}
              />
              <Campo label="Meses utilizados" value={resultado.mesesUtilizados} />
              <Campo label="Meses descartados" value={resultado.mesesDescartados} />
            </CardContent>
          </Card>

          {/* Card 3 — Gráfico de histórico */}
          {historico.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Histórico de Consumo</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={historico}
                    margin={{ top: 10, right: 20, left: 0, bottom: 40 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="mesAno"
                      angle={-45}
                      textAnchor="end"
                      tick={{ fontSize: 11 }}
                      interval={0}
                    />
                    <YAxis tick={{ fontSize: 11 }} unit=" kWh" width={70} />
                    <Tooltip
                      formatter={(value) => [
                        `${Number(value ?? 0).toLocaleString('pt-BR')} kWh`,
                        'Consumo',
                      ]}
                    />
                    <Legend verticalAlign="top" />
                    <Bar
                      dataKey="consumoKwh"
                      name="Consumo (kWh)"
                      fill="#22c55e"
                      radius={[4, 4, 0, 0]}
                    />
                    <ReferenceLine
                      y={resultado.mediaKwhCalculada}
                      stroke="#f59e0b"
                      strokeDasharray="6 3"
                      strokeWidth={2}
                      label={{
                        value: `Média: ${resultado.mediaKwhCalculada.toFixed(0)} kWh`,
                        position: 'insideTopRight',
                        fontSize: 11,
                        fill: '#f59e0b',
                      }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Card 4 — Economia estimada */}
          {ultimos12.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Economia Estimada (15% de desconto)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 text-xs text-gray-500 font-medium">Mês</th>
                        <th className="text-right py-2 text-xs text-gray-500 font-medium">
                          Consumo kWh
                        </th>
                        <th className="text-right py-2 text-xs text-gray-500 font-medium">
                          Valor pago
                        </th>
                        <th className="text-right py-2 text-xs text-gray-500 font-medium">
                          Com 15% desconto
                        </th>
                        <th className="text-right py-2 text-xs text-gray-500 font-medium">
                          Economia
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {ultimos12.map((m) => (
                        <tr key={m.mesAno} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="py-2 text-gray-800">{m.mesAno}</td>
                          <td className="py-2 text-right text-gray-800">
                            {m.consumoKwh.toLocaleString('pt-BR')}
                          </td>
                          <td className="py-2 text-right text-gray-800">
                            {m.valorRS.toLocaleString('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            })}
                          </td>
                          <td className="py-2 text-right text-gray-800">
                            {(m.valorRS * (1 - PERCENTUAL_DESCONTO)).toLocaleString('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            })}
                          </td>
                          <td className="py-2 text-right text-green-600 font-medium">
                            {(m.valorRS * PERCENTUAL_DESCONTO).toLocaleString('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="font-semibold border-t-2 border-gray-200">
                        <td colSpan={4} className="py-3 text-gray-800">
                          Total anual de economia estimada
                        </td>
                        <td className="py-3 text-right text-green-600">
                          {totalEconomia.toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-3 pb-8">
            {confirmado ? (
              <p className="flex items-center gap-2 text-green-600 font-medium">
                <CheckCircle className="h-5 w-5" />
                Proposta confirmada e salva com sucesso!
              </p>
            ) : (
              <Button onClick={confirmar} disabled={confirmando}>
                <CheckCircle className="h-4 w-4 mr-2" />
                {confirmando ? 'Salvando...' : 'Confirmar e Salvar Proposta'}
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => router.push(`/dashboard/cooperados/${id}`)}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
