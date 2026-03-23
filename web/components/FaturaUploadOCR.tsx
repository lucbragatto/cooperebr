'use client';

import { useEffect, useRef, useState } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Camera,
  CheckCircle,
  FileText,
  Image as ImageIcon,
  RefreshCw,
  Trash2,
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

interface FaturaProcessada {
  id: string;
  status: string;
  dadosExtraidos: DadosExtraidos;
  mediaKwhCalculada: number;
  mesesUtilizados: number;
  mesesDescartados: number;
  thresholdUtilizado: number;
  arquivoUrl: string;
}

interface FaturaUploadOCRProps {
  cooperadoId: string;
  onFaturaProcessada?: (faturaId: string) => void;
}

export default function FaturaUploadOCR({ cooperadoId, onFaturaProcessada }: FaturaUploadOCRProps) {
  const [tab, setTab] = useState<Tab>('pdf');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [processando, setProcessando] = useState(false);
  const [resultado, setResultado] = useState<ProcessarResult | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [confirmado, setConfirmado] = useState(false);
  const [erro, setErro] = useState('');
  const [excluindo, setExcluindo] = useState(false);
  const [showExcluirDialog, setShowExcluirDialog] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api
      .get<FaturaProcessada[]>(`/faturas/cooperado/${cooperadoId}`)
      .then((r) => {
        const aprovada = r.data.find((f) => f.status === 'APROVADA');
        if (aprovada) {
          setResultado({
            faturaId: aprovada.id,
            dadosExtraidos: aprovada.dadosExtraidos,
            mediaKwhCalculada: aprovada.mediaKwhCalculada,
            mesesUtilizados: aprovada.mesesUtilizados,
            mesesDescartados: aprovada.mesesDescartados,
            thresholdUtilizado: aprovada.thresholdUtilizado,
            arquivoUrl: aprovada.arquivoUrl,
          });
          setConfirmado(true);
        }
      })
      .catch(() => {});
  }, [cooperadoId]);

  function onTabChange(t: Tab) {
    setTab(t);
    setArquivo(null);
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleFile(file: File) {
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

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDrag(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
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
        cooperadoId,
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
      onFaturaProcessada?.(resultado.faturaId);
    } catch {
      setErro('Erro ao confirmar fatura.');
    } finally {
      setConfirmando(false);
    }
  }

  function reprocessar() {
    setResultado(null);
    setConfirmado(false);
    setArquivo(null);
    setPreview(null);
    setErro('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function excluirFatura() {
    if (!resultado?.faturaId) return;
    setExcluindo(true);
    setErro('');
    try {
      await api.delete(`/faturas/${resultado.faturaId}`);
      setShowExcluirDialog(false);
      reprocessar();
    } catch {
      setErro('Erro ao excluir fatura.');
    } finally {
      setExcluindo(false);
    }
  }

  const historico = resultado?.dadosExtraidos.historicoConsumo ?? [];
  const ultimos12 = historico.slice(-12);
  const totalEconomia = ultimos12.reduce((acc, m) => acc + m.valorRS * PERCENTUAL_DESCONTO, 0);

  return (
    <div className="space-y-4">
      {erro && <p className="text-red-500 mb-4 text-sm">{erro}</p>}

      {/* Upload area */}
      {!resultado && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Upload de Fatura</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Tabs */}
            <div className="flex gap-2 mb-4">
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

            {/* Drop zone with drag & drop */}
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={onDrop}
              className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
                drag
                  ? 'border-green-500 bg-green-50'
                  : arquivo
                    ? 'border-green-400 bg-green-50'
                    : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
              }`}
            >
              {arquivo ? (
                <Upload className="h-8 w-8 mx-auto mb-2 text-green-600" />
              ) : (
                <Upload className="h-8 w-8 mx-auto mb-2 text-gray-400" />
              )}
              <p className="text-sm text-gray-600">
                {arquivo ? arquivo.name : 'Arraste ou clique para selecionar PDF/imagem da fatura'}
              </p>
              {arquivo && (
                <p className="text-xs text-gray-400 mt-1">{formatBytes(arquivo.size)}</p>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept={tabConfig[tab].accept}
                capture={tabConfig[tab].capture}
                onChange={onFileChange}
                className="hidden"
              />
            </div>

            {/* Image preview */}
            {preview && (
              <div className="mt-4 flex justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview} alt="Preview" className="max-h-64 rounded-md object-contain" />
              </div>
            )}

            {arquivo && (
              <div className="mt-4">
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
        <div className="space-y-4">
          {/* Dados do titular */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dados do Titular</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <Campo label="Nome" value={resultado.dadosExtraidos.titular} />
              <Campo label={resultado.dadosExtraidos.tipoDocumento} value={resultado.dadosExtraidos.documento} />
              <Campo
                label="Endereço"
                value={[resultado.dadosExtraidos.enderecoInstalacao, resultado.dadosExtraidos.bairro, `${resultado.dadosExtraidos.cidade}/${resultado.dadosExtraidos.estado}`].filter(Boolean).join(', ')}
              />
              <Campo label="UC" value={resultado.dadosExtraidos.numeroUC} />
              <Campo label="Distribuidora" value={resultado.dadosExtraidos.distribuidora} />
              <Campo label="Classificacao" value={resultado.dadosExtraidos.classificacao} />
            </CardContent>
          </Card>

          {/* Consumo e proposta */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Consumo e Proposta</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <Campo label="Consumo atual (kWh)" value={resultado.dadosExtraidos.consumoAtualKwh.toLocaleString('pt-BR')} />
              <Campo label="Total a pagar" value={resultado.dadosExtraidos.totalAPagar.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} />
              <Campo label="Bandeira tarifaria" value={bandeiraLabel[resultado.dadosExtraidos.bandeiraTarifaria] ?? resultado.dadosExtraidos.bandeiraTarifaria} />
              <Campo label="Media calculada (kWh/mes)" value={resultado.mediaKwhCalculada.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} />
              <Campo label="Meses utilizados" value={resultado.mesesUtilizados} />
              <Campo label="Meses descartados" value={resultado.mesesDescartados} />
            </CardContent>
          </Card>

          {/* Grafico historico */}
          {historico.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Historico de Consumo</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={historico} margin={{ top: 10, right: 20, left: 0, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="mesAno" angle={-45} textAnchor="end" tick={{ fontSize: 11 }} interval={0} />
                    <YAxis tick={{ fontSize: 11 }} unit=" kWh" width={70} />
                    <Tooltip formatter={(value) => [`${Number(value ?? 0).toLocaleString('pt-BR')} kWh`, 'Consumo']} />
                    <Legend verticalAlign="top" />
                    <Bar dataKey="consumoKwh" name="Consumo (kWh)" fill="#22c55e" radius={[4, 4, 0, 0]} />
                    <ReferenceLine
                      y={resultado.mediaKwhCalculada}
                      stroke="#f59e0b"
                      strokeDasharray="6 3"
                      strokeWidth={2}
                      label={{ value: `Media: ${Number(resultado.mediaKwhCalculada).toFixed(0)} kWh`, position: 'insideTopRight', fontSize: 11, fill: '#f59e0b' }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Economia estimada */}
          {ultimos12.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Economia Estimada (15% de desconto)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 text-xs text-gray-500 font-medium">Mes</th>
                        <th className="text-right py-2 text-xs text-gray-500 font-medium">Consumo kWh</th>
                        <th className="text-right py-2 text-xs text-gray-500 font-medium">Valor pago</th>
                        <th className="text-right py-2 text-xs text-gray-500 font-medium">Com 15% desconto</th>
                        <th className="text-right py-2 text-xs text-gray-500 font-medium">Economia</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ultimos12.map((m) => (
                        <tr key={m.mesAno} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="py-2 text-gray-800">{m.mesAno}</td>
                          <td className="py-2 text-right text-gray-800">{m.consumoKwh.toLocaleString('pt-BR')}</td>
                          <td className="py-2 text-right text-gray-800">{m.valorRS.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                          <td className="py-2 text-right text-gray-800">{(m.valorRS * (1 - PERCENTUAL_DESCONTO)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                          <td className="py-2 text-right text-green-600 font-medium">{(m.valorRS * PERCENTUAL_DESCONTO).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="font-semibold border-t-2 border-gray-200">
                        <td colSpan={4} className="py-3 text-gray-800">Total anual de economia estimada</td>
                        <td className="py-3 text-right text-green-600">{totalEconomia.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-3 flex-wrap">
            {confirmado ? (
              <>
                <p className="flex items-center gap-2 text-green-600 font-medium text-sm">
                  <CheckCircle className="h-5 w-5" />
                  Fatura aprovada e salva com sucesso!
                </p>
                <Button variant="outline" size="sm" onClick={reprocessar}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Reprocessar
                </Button>
                <Button variant="destructive" size="sm" onClick={() => setShowExcluirDialog(true)}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir
                </Button>
              </>
            ) : (
              <Button onClick={confirmar} disabled={confirmando}>
                <CheckCircle className="h-4 w-4 mr-2" />
                {confirmando ? 'Salvando...' : 'Confirmar e Salvar'}
              </Button>
            )}
          </div>
        </div>
      )}

      <Dialog open={showExcluirDialog} onOpenChange={setShowExcluirDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir fatura</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir esta fatura? Esta acao nao pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExcluirDialog(false)} disabled={excluindo}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={excluirFatura} disabled={excluindo}>
              {excluindo ? 'Excluindo...' : 'Excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
