'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ShieldCheck, AlertTriangle, CheckCircle2, FileSpreadsheet, Play } from 'lucide-react';

interface PadraoDetectado {
  codigo: string;
  sinal: string;
  valorIndebitoMensal: number;
  valorIndebito60mSelic: number;
  fundamento: {
    tema: string;
    numero: string;
    ementa: string;
    classificacaoDossie: string;
    risco: string;
  };
  detalhe: string;
  rubricasEnvolvidas?: string[];
}

interface ResultadoConsolidado {
  padroes: PadraoDetectado[];
  indebitoMensalTotal: number;
  indebito60mSelicTotal: number;
}

interface PreviewResponse {
  fatura: any;
  resultado: ResultadoConsolidado | null;
  erro?: string;
}

function formatBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const RISCO_COR: Record<string, string> = {
  BAIXO: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  MEDIO: 'bg-amber-100 text-amber-700 border-amber-200',
  ALTO: 'bg-red-100 text-red-700 border-red-200',
};

const SINAL_COR: Record<string, string> = {
  INDEBITO_TRIBUTARIO: 'bg-red-50 border-red-200',
  FAVORAVEL_AO_CLIENTE: 'bg-emerald-50 border-emerald-200',
  SEM_DIVERGENCIA: 'bg-gray-50 border-gray-200',
};

export default function ConciergeDetalheCooperado() {
  const params = useParams();
  const cooperadoId = params.id as string;

  const [rodando, setRodando] = useState(false);
  const [resultado, setResultado] = useState<PreviewResponse | null>(null);
  const [erroPreview, setErroPreview] = useState<string | null>(null);

  // Preview demo - permite simular com fatura modelo de teste
  // (em sprint C4 vira fluxo de carregar FaturaProcessada real do cooperado)
  async function rodarPreviewDemo() {
    setRodando(true);
    setErroPreview(null);
    try {
      const body = {
        distribuidora: 'EDP_ES',
        metadados: {
          mesReferencia: '2026-04',
          classificacao: 'B - B1-RESIDENCIAL',
          modalidadeTarifaria: 'CONVENCIONAL',
          titularNome: 'LAURENTINO BICCAS NETO (demo)',
          numeroUC: '0.001.294.127.054-57',
          valorTotalFatura: 263.84,
          basePisCofinsDeclarada: 2630.19,
          aliquotaPisDeclarada: 0.0094,
          aliquotaCofinsDeclarada: 0.0432,
        },
        rubricas: [
          { descricao: 'TUSD - Energia Ativa Fornecida', valorTotalReais: 1881.45, baseCalculoIcms: 1881.45, aliquotaIcms: 0.17, valorIcms: 319.85, valorPisCofins: 82.14 },
          { descricao: 'TUSD - En. At. Inj. oUC oPT 10/2025', valorTotalReais: -77.22, baseCalculoIcms: -80.74, aliquotaIcms: 0.17, valorIcms: -13.73, valorPisCofins: 0 },
          { descricao: 'TUSD - En. At. Inj. oUC oPT 04/2025', valorTotalReais: -1596.23, baseCalculoIcms: -1669.11, aliquotaIcms: 0.17, valorIcms: -283.74, valorPisCofins: 0 },
          { descricao: 'TUSD - En. At. Inj. oUC oPT 03/2026', valorTotalReais: -68.86, baseCalculoIcms: -72.00, aliquotaIcms: 0.17, valorIcms: -12.24, valorPisCofins: 0 },
          { descricao: 'TE - Energia Ativa Fornecida', valorTotalReais: 1287.46, baseCalculoIcms: 1287.46, aliquotaIcms: 0.17, valorIcms: 218.87, valorPisCofins: 56.20 },
          { descricao: 'TE - En. At. Inj. oUC oPT 10/2025', valorTotalReais: -52.84, baseCalculoIcms: -55.26, aliquotaIcms: 0.17, valorIcms: -9.39, valorPisCofins: 0 },
          { descricao: 'TE - En. At. Inj. oUC oPT 04/2025', valorTotalReais: -1092.30, baseCalculoIcms: -1142.16, aliquotaIcms: 0.17, valorIcms: -194.17, valorPisCofins: 0 },
          { descricao: 'TE - En. At. Inj. oUC oPT 03/2026', valorTotalReais: -47.13, baseCalculoIcms: -49.28, aliquotaIcms: 0.17, valorIcms: -8.38, valorPisCofins: 0 },
          { descricao: 'Contribuição de Ilum. Pública', valorTotalReais: 29.51, baseCalculoIcms: 0, aliquotaIcms: 0, valorIcms: 0, valorPisCofins: 0 },
        ],
      };
      const r = await api.post<PreviewResponse>('/concierge/preview', body);
      setResultado(r.data);
    } catch (e: any) {
      setErroPreview(e?.response?.data?.message ?? e?.message ?? 'Erro');
    } finally {
      setRodando(false);
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div>
        <Link
          href="/dashboard/concierge"
          className="text-sm text-emerald-600 hover:underline flex items-center gap-1 mb-2"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar pra lista
        </Link>
        <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
          <ShieldCheck className="w-8 h-8 text-emerald-600" />
          Auditoria Tributária — Cooperado
        </h1>
        <p className="text-sm text-gray-500">ID: {cooperadoId}</p>
      </div>

      <Card className="p-6 bg-cyan-50 border-cyan-200">
        <div className="flex items-start gap-3">
          <FileSpreadsheet className="w-6 h-6 text-cyan-700 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-cyan-900">Preview de Auditoria</h3>
            <p className="text-sm text-cyan-800 mt-1">
              Roda os 3 detectores tributários (Tema 69 stricto + Tese 3 PIS/COFINS sobre
              SCEE + Tese 2 ICMS TUSD-G) sobre uma fatura modelo. Sprint C4 vai conectar
              ao OCR de FaturaProcessada do cooperado pra rodar com dados reais.
            </p>
            <Button
              onClick={rodarPreviewDemo}
              disabled={rodando}
              className="mt-3 bg-emerald-600 hover:bg-emerald-700"
            >
              <Play className="w-4 h-4 mr-2" />
              {rodando ? 'Rodando…' : 'Rodar auditoria demo (LAURENTINO ABR/26)'}
            </Button>
          </div>
        </div>
      </Card>

      {erroPreview && (
        <Card className="p-4 bg-red-50 border-red-200 text-red-800">{erroPreview}</Card>
      )}

      {resultado?.erro && (
        <Card className="p-4 bg-amber-50 border-amber-200 text-amber-800">
          Adapter retornou erro: {resultado.erro}
        </Card>
      )}

      {resultado?.resultado && (
        <>
          <Card className="p-6 bg-gradient-to-br from-red-50 to-orange-50 border-red-200">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <div className="text-xs text-red-600 uppercase tracking-wider font-semibold">
                  Indébito mensal detectado
                </div>
                <div className="text-3xl font-bold text-red-900 mt-1">
                  {formatBRL(resultado.resultado.indebitoMensalTotal)}
                </div>
              </div>
              <div>
                <div className="text-xs text-red-600 uppercase tracking-wider font-semibold">
                  Projeção 60 meses + SELIC
                </div>
                <div className="text-3xl font-bold text-red-900 mt-1">
                  {formatBRL(resultado.resultado.indebito60mSelicTotal)}
                </div>
              </div>
            </div>
          </Card>

          <div className="space-y-3">
            <h2 className="text-xl font-semibold text-gray-800">
              Padrões detectados ({resultado.resultado.padroes.length})
            </h2>
            {resultado.resultado.padroes.length === 0 ? (
              <Card className="p-6 bg-emerald-50 border-emerald-200">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                  <div>
                    <div className="font-semibold text-emerald-900">
                      Nenhum indébito detectado
                    </div>
                    <div className="text-sm text-emerald-700">
                      A concessionária parece aplicar a tributação corretamente nessa
                      fatura.
                    </div>
                  </div>
                </div>
              </Card>
            ) : (
              resultado.resultado.padroes.map((p, i) => (
                <Card
                  key={i}
                  className={`p-5 border-2 ${SINAL_COR[p.sinal] ?? ''}`}
                >
                  <div className="flex items-start gap-4">
                    {p.sinal === 'INDEBITO_TRIBUTARIO' ? (
                      <AlertTriangle className="w-6 h-6 text-red-600 mt-0.5 flex-shrink-0" />
                    ) : p.sinal === 'FAVORAVEL_AO_CLIENTE' ? (
                      <CheckCircle2 className="w-6 h-6 text-emerald-600 mt-0.5 flex-shrink-0" />
                    ) : (
                      <CheckCircle2 className="w-6 h-6 text-gray-400 mt-0.5 flex-shrink-0" />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="font-semibold text-gray-800">{p.codigo}</div>
                        <span
                          className={`text-xs px-2 py-0.5 rounded border ${
                            RISCO_COR[p.fundamento.risco] ?? RISCO_COR.MEDIO
                          }`}
                        >
                          Risco {p.fundamento.risco}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-4 mb-3">
                        <div>
                          <div className="text-xs text-gray-500">Mensal</div>
                          <div className="text-xl font-bold text-gray-800">
                            {formatBRL(p.valorIndebitoMensal)}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">60m + SELIC</div>
                          <div className="text-xl font-bold text-gray-800">
                            {formatBRL(p.valorIndebito60mSelic)}
                          </div>
                        </div>
                      </div>
                      <div className="text-xs text-gray-600 mb-2">
                        <strong>Fundamento:</strong> {p.fundamento.tema} ({p.fundamento.numero})
                      </div>
                      <details className="text-sm text-gray-700">
                        <summary className="cursor-pointer text-emerald-700 hover:underline">
                          Ver ementa jurídica e detalhamento técnico
                        </summary>
                        <div className="mt-3 space-y-2">
                          <div className="p-3 bg-white rounded border text-xs leading-relaxed">
                            <strong>Ementa:</strong> {p.fundamento.ementa}
                          </div>
                          <div className="p-3 bg-white rounded border text-xs font-mono leading-relaxed">
                            {p.detalhe}
                          </div>
                          {p.rubricasEnvolvidas && p.rubricasEnvolvidas.length > 0 && (
                            <div className="p-3 bg-white rounded border text-xs">
                              <strong>Rubricas:</strong>{' '}
                              {p.rubricasEnvolvidas.join(' · ')}
                            </div>
                          )}
                        </div>
                      </details>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
