'use client';

import { useRef, useState } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, FileUp, Loader2, MessageCircle, Upload } from 'lucide-react';
import Link from 'next/link';

interface ResultadoSimulacao {
  sucesso: boolean;
  mensagemWhatsApp: string;
  propostaId?: string;
  dadosExtraidos?: Record<string, unknown>;
}

const cls = 'w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500';
const lbl = 'block text-xs font-medium text-gray-600 mb-1';

export default function WhatsAppPage() {
  const [telefone, setTelefone] = useState('');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<ResultadoSimulacao | null>(null);
  const [erro, setErro] = useState('');
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File) {
    setArquivo(file);
    setErro('');
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDrag(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }

  function toBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function simular() {
    if (!arquivo) { setErro('Selecione um arquivo de fatura.'); return; }
    if (!telefone.trim()) { setErro('Informe o número de telefone.'); return; }
    setErro('');
    setLoading(true);
    setResultado(null);
    try {
      const arquivoBase64 = await toBase64(arquivo);
      const tipoArquivo = arquivo.type === 'application/pdf' ? 'pdf' : 'imagem';
      const { data } = await api.post<ResultadoSimulacao>('/whatsapp/processar-fatura', {
        arquivoBase64,
        tipoArquivo,
        telefone: telefone.trim(),
      });
      setResultado(data);
    } catch {
      setErro('Erro ao processar. Verifique o arquivo e tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 transition-colors">
        <ArrowLeft className="h-4 w-4" />Voltar
      </Link>

      <div className="flex items-center gap-3">
        <MessageCircle className="h-6 w-6 text-green-600" />
        <h2 className="text-2xl font-bold text-gray-800">Simular via WhatsApp</h2>
      </div>
      <p className="text-sm text-gray-500">Teste o fluxo de processamento de fatura como se fosse recebido pelo WhatsApp.</p>

      <Card>
        <CardHeader><CardTitle className="text-sm font-semibold text-gray-700">Dados da simulação</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className={lbl}>Telefone do remetente</label>
            <input
              className={cls}
              value={telefone}
              onChange={e => setTelefone(e.target.value)}
              placeholder="(27) 99999-0000"
            />
          </div>

          <div>
            <label className={lbl}>Fatura (PDF ou imagem)</label>
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDrag(true); }}
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
                onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }}
              />
              {arquivo ? (
                <div className="space-y-1">
                  <FileUp className="h-8 w-8 text-green-600 mx-auto" />
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
          </div>

          {erro && <p className="text-sm text-red-600">{erro}</p>}

          <Button onClick={simular} disabled={loading} className="w-full">
            {loading ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processando fatura com IA...</>
            ) : (
              <><MessageCircle className="h-4 w-4 mr-2" />Simular processamento</>
            )}
          </Button>
        </CardContent>
      </Card>

      {resultado && (
        <>
          {/* Preview da mensagem WhatsApp */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-green-600" />
                Mensagem que seria enviada no WhatsApp
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`rounded-xl p-4 text-sm whitespace-pre-wrap leading-relaxed ${
                resultado.sucesso ? 'bg-green-50 border border-green-200 text-gray-800' : 'bg-red-50 border border-red-200 text-red-800'
              }`}>
                {resultado.mensagemWhatsApp}
              </div>
            </CardContent>
          </Card>

          {/* Dados extraídos */}
          {resultado.dadosExtraidos && (
            <Card>
              <CardHeader><CardTitle className="text-sm font-semibold text-gray-700">Dados extraídos da fatura</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {Object.entries(resultado.dadosExtraidos)
                    .filter(([k]) => k !== 'historicoConsumo')
                    .map(([key, val]) => (
                      <div key={key} className="flex justify-between gap-2 border-b border-gray-100 py-1.5">
                        <span className="text-gray-500 text-xs">{key}</span>
                        <span className="text-gray-900 text-xs font-medium text-right truncate max-w-[200px]">
                          {typeof val === 'object' ? JSON.stringify(val) : String(val ?? '—')}
                        </span>
                      </div>
                    ))}
                </div>

                {/* Histórico de consumo */}
                {Array.isArray((resultado.dadosExtraidos as Record<string, unknown>).historicoConsumo) && (
                  <div className="mt-4">
                    <p className="text-xs font-medium text-gray-600 mb-2">Histórico de consumo extraído</p>
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <div className="grid grid-cols-3 gap-2 px-3 py-1.5 bg-gray-50 border-b text-xs font-medium text-gray-500">
                        <div>Mês</div>
                        <div className="text-right">kWh</div>
                        <div className="text-right">R$</div>
                      </div>
                      {((resultado.dadosExtraidos as Record<string, unknown>).historicoConsumo as Array<{ mesAno: string; consumoKwh: number; valorRS: number }>).map((h, i) => (
                        <div key={i} className="grid grid-cols-3 gap-2 px-3 py-1.5 border-b border-gray-100 last:border-0 text-xs">
                          <div>{h.mesAno}</div>
                          <div className="text-right">{h.consumoKwh}</div>
                          <div className="text-right">{h.valorRS > 0 ? `R$ ${h.valorRS.toFixed(2)}` : '—'}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
