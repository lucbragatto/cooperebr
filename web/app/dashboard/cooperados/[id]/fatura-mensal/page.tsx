'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft,
  CheckCircle,
  FileText,
  Loader2,
  Upload,
} from 'lucide-react';

interface DadosExtraidos {
  titular: string;
  documento: string;
  tipoDocumento: string;
  enderecoInstalacao: string;
  numeroUC: string;
  distribuidora: string;
  classificacao: string;
  mesReferencia: string;
  totalAPagar: number;
  consumoAtualKwh: number;
  tarifaTUSD: number;
  tarifaTE: number;
  bandeiraTarifaria: string;
  possuiCompensacao: boolean;
  creditosRecebidosKwh: number;
  saldoTotalKwh: number;
  historicoConsumo: Array<{ mesAno: string; consumoKwh: number; valorRS: number }>;
  [key: string]: unknown;
}

interface FaturaMensalResult {
  faturaId: string;
  mesReferencia: number;
  anoReferencia: number;
  mediaKwhCalculada: number;
  mesesUtilizados: number;
  mesesDescartados: number;
  cotaAtualizada: boolean;
}

function Campo({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className="text-sm font-medium text-gray-800">{value ?? '—'}</p>
    </div>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function FaturaMensalPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [nomeCooperado, setNomeCooperado] = useState('');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);
  const [extraindo, setExtraindo] = useState(false);
  const [dadosExtraidos, setDadosExtraidos] = useState<DadosExtraidos | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [resultado, setResultado] = useState<FaturaMensalResult | null>(null);
  const [erro, setErro] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get(`/cooperados/${id}`)
      .then((r) => setNomeCooperado(r.data.nomeCompleto))
      .catch(() => setErro('Cooperado não encontrado.'));
  }, [id]);

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDrag(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }

  function handleFile(file: File) {
    setArquivo(file);
    setDadosExtraidos(null);
    setResultado(null);
    setErro('');
  }

  async function extrair() {
    if (!arquivo) return;
    setExtraindo(true);
    setErro('');
    try {
      const arquivoBase64 = await fileToBase64(arquivo);
      const tipoArquivo = arquivo.type === 'application/pdf' ? 'pdf' : 'imagem';
      const { data } = await api.post<DadosExtraidos>('/faturas/extrair', {
        arquivoBase64,
        tipoArquivo,
      });
      setDadosExtraidos(data);
    } catch {
      setErro('Erro ao extrair dados da fatura. Verifique o arquivo e tente novamente.');
    } finally {
      setExtraindo(false);
    }
  }

  async function confirmarSalvar() {
    if (!dadosExtraidos) return;
    const mesRef = dadosExtraidos.mesReferencia; // "MM/AAAA"
    const [mesStr, anoStr] = mesRef.split('/');
    const mes = parseInt(mesStr, 10);
    const ano = parseInt(anoStr, 10);
    if (!mes || !ano) {
      setErro('Mês de referência não identificado na fatura.');
      return;
    }

    setSalvando(true);
    setErro('');
    try {
      const { data } = await api.post<FaturaMensalResult>(
        `/cooperados/${id}/fatura-mensal`,
        {
          dadosOcr: dadosExtraidos,
          mesReferencia: mes,
          anoReferencia: ano,
        },
      );
      setResultado(data);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setErro(err.response?.data?.message ?? 'Erro ao salvar fatura mensal.');
    } finally {
      setSalvando(false);
    }
  }

  function reset() {
    setArquivo(null);
    setDadosExtraidos(null);
    setResultado(null);
    setErro('');
    if (fileRef.current) fileRef.current.value = '';
  }

  const bandeiraLabel: Record<string, string> = {
    VERDE: 'Verde', AMARELA: 'Amarela', VERMELHA_1: 'Vermelha 1', VERMELHA_2: 'Vermelha 2',
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.push(`/dashboard/cooperados/${id}`)}>
          <ArrowLeft className="h-4 w-4 mr-2" />Voltar
        </Button>
        <h2 className="text-2xl font-bold text-gray-800">
          Upload Fatura Mensal{nomeCooperado ? ` — ${nomeCooperado}` : ''}
        </h2>
      </div>

      {erro && <p className="text-red-500 text-sm">{erro}</p>}

      {/* Sucesso */}
      {resultado && (
        <Card>
          <CardContent className="py-8 text-center space-y-4">
            <CheckCircle className="h-12 w-12 text-green-600 mx-auto" />
            <h3 className="text-lg font-semibold text-gray-800">Fatura mensal registrada!</h3>
            <div className="grid grid-cols-2 gap-4 max-w-md mx-auto text-sm">
              <Campo label="Competência" value={`${String(resultado.mesReferencia).padStart(2, '0')}/${resultado.anoReferencia}`} />
              <Campo label="Média kWh calculada" value={resultado.mediaKwhCalculada.toLocaleString('pt-BR')} />
              <Campo label="Meses utilizados" value={resultado.mesesUtilizados} />
              <Campo label="Meses descartados" value={resultado.mesesDescartados} />
            </div>
            {resultado.cotaAtualizada && (
              <p className="text-sm text-green-600 font-medium">
                Cota kWh mensal do cooperado atualizada para {resultado.mediaKwhCalculada.toLocaleString('pt-BR')} kWh.
              </p>
            )}
            <div className="flex justify-center gap-3 pt-2">
              <Button onClick={reset}>Nova fatura</Button>
              <Button variant="outline" onClick={() => router.push(`/dashboard/cooperados/${id}`)}>
                Voltar ao perfil
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upload */}
      {!resultado && !dadosExtraidos && (
        <Card>
          <CardHeader><CardTitle className="text-sm font-semibold text-gray-700">Selecionar fatura do mês</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={onDrop}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                drag ? 'border-green-500 bg-green-50' : arquivo ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
              }`}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,image/*"
                className="hidden"
                onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }}
              />
              {arquivo ? (
                <div className="space-y-1">
                  <FileText className="h-8 w-8 text-green-600 mx-auto" />
                  <p className="text-sm font-medium text-green-800">{arquivo.name}</p>
                  <p className="text-xs text-green-600">{(arquivo.size / 1024).toFixed(0)} KB — clique para trocar</p>
                </div>
              ) : (
                <div className="space-y-1">
                  <Upload className="h-8 w-8 text-gray-400 mx-auto" />
                  <p className="text-sm text-gray-600">Arraste ou <span className="text-green-700 font-medium">clique para selecionar</span></p>
                  <p className="text-xs text-gray-400">PDF ou imagem (JPG, PNG)</p>
                </div>
              )}
            </div>

            <Button onClick={extrair} disabled={!arquivo || extraindo} className="w-full">
              {extraindo ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Extraindo dados com IA...</>
              ) : (
                <><Upload className="h-4 w-4 mr-2" />Extrair dados da fatura</>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Dados extraídos — confirmação */}
      {dadosExtraidos && !resultado && (
        <>
          <Card>
            <CardHeader><CardTitle>Dados Extraídos</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <Campo label="Titular" value={dadosExtraidos.titular} />
              <Campo label="UC" value={dadosExtraidos.numeroUC} />
              <Campo label="Distribuidora" value={dadosExtraidos.distribuidora} />
              <Campo label="Mês referência" value={dadosExtraidos.mesReferencia} />
              <Campo label="Consumo atual (kWh)" value={dadosExtraidos.consumoAtualKwh?.toLocaleString('pt-BR')} />
              <Campo label="Total a pagar" value={dadosExtraidos.totalAPagar?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} />
              <Campo label="TUSD (R$/kWh)" value={dadosExtraidos.tarifaTUSD?.toFixed(5)} />
              <Campo label="TE (R$/kWh)" value={dadosExtraidos.tarifaTE?.toFixed(5)} />
              <Campo label="Bandeira" value={bandeiraLabel[dadosExtraidos.bandeiraTarifaria] ?? dadosExtraidos.bandeiraTarifaria} />
              <Campo label="Compensação" value={dadosExtraidos.possuiCompensacao ? 'Sim' : 'Não'} />
              <Campo label="Créditos recebidos (kWh)" value={dadosExtraidos.creditosRecebidosKwh} />
              <Campo label="Saldo total (kWh)" value={dadosExtraidos.saldoTotalKwh} />
            </CardContent>
          </Card>

          {dadosExtraidos.historicoConsumo?.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Histórico de Consumo</CardTitle></CardHeader>
              <CardContent>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="grid grid-cols-3 gap-2 px-3 py-1.5 bg-gray-50 border-b text-xs font-medium text-gray-500">
                    <div>Mês</div>
                    <div className="text-right">kWh</div>
                    <div className="text-right">R$</div>
                  </div>
                  {dadosExtraidos.historicoConsumo.map((h, i) => (
                    <div key={i} className="grid grid-cols-3 gap-2 px-3 py-1.5 border-b border-gray-100 last:border-0 text-xs">
                      <div>{h.mesAno}</div>
                      <div className="text-right">{h.consumoKwh?.toLocaleString('pt-BR')}</div>
                      <div className="text-right">{h.valorRS > 0 ? `R$ ${h.valorRS.toFixed(2)}` : '—'}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex gap-3 pb-8">
            <Button onClick={confirmarSalvar} disabled={salvando}>
              {salvando ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Salvando...</>
              ) : (
                <><CheckCircle className="h-4 w-4 mr-2" />Confirmar e salvar</>
              )}
            </Button>
            <Button variant="outline" onClick={reset}>Cancelar</Button>
          </div>
        </>
      )}
    </div>
  );
}
