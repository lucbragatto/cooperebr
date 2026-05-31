'use client';

/**
 * D-novo-BR-CT CT.6 (31/05/2026) — Apuração Mensal Segregada.
 *
 * Preview + fechar + status validação. Badge GATE WALTER quando
 * validadoContador=false. Ações em Dialog Tipo C (padrão UX 17/05).
 *
 * ⚠️ Números são preview do motor. Walter (contador) valida antes de virar
 * valor fiscal real (DCTF/SPED).
 */

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, AlertTriangle, CheckCircle2, FileText, RefreshCw, ShieldCheck } from 'lucide-react';

type Preview = {
  cooperativaId: string;
  cooperativaNome: string;
  ano: number;
  mes: number;
  competencia: string;
  receitaPropria: string;
  receitaAuxiliar: string;
  receitaNaoCoop: string;
  despesaPropria: string;
  despesaAuxiliar: string;
  despesaNaoCoop: string;
  sobrasBrutas: string;
  resultadoNaoCoop: string;
  pisDevido: string;
  cofinsDevido: string;
  irpjDevido: string;
  csllDevido: string;
  fundoReserva: string;
  fates: string;
  sobrasDistribuiveis: string;
  fundamentoIsencao: string | null;
  configuracao: {
    pisAliquota: string;
    cofinsAliquota: string;
    irpjPercentualPresuncao: string;
    csllPercentualPresuncao: string;
    isencaoPisCofinsAtiva: boolean;
    avisoPresuncao: string;
  };
  avisoValidacao: string;
};

const hoje = new Date();
const MES_INICIAL = hoje.getMonth() + 1;
const ANO_INICIAL = hoje.getFullYear();

export default function ApuracaoMensalPage() {
  const [ano, setAno] = useState(ANO_INICIAL);
  const [mes, setMes] = useState(MES_INICIAL);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [data, setData] = useState<Preview | null>(null);
  const [confirmarFechar, setConfirmarFechar] = useState(false);
  const [fechando, setFechando] = useState(false);

  async function carregar() {
    setLoading(true);
    setErro('');
    try {
      const { data } = await api.get<Preview>(
        `/contabilidade-tributaria/apuracao/${ano}/${mes}`,
      );
      setData(data);
    } catch (err: any) {
      setErro(err?.response?.data?.message || 'Falha ao carregar preview');
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ano, mes]);

  async function fecharApuracao() {
    setFechando(true);
    try {
      await api.post(`/contabilidade-tributaria/apuracao/${ano}/${mes}/fechar`);
      setConfirmarFechar(false);
      await carregar();
    } catch (err: any) {
      setErro(err?.response?.data?.message || 'Falha ao fechar apuração');
    } finally {
      setFechando(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-cyan-700" />
            Apuração Contábil-Tributária Segregada
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Lei 5.764/71 (cooperativismo) · RIR/2018 · STF Tema 536 · STJ Tema 986
          </p>
        </div>
      </div>

      {/* Banner help — regra 19/05 */}
      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
        <h2 className="font-semibold text-blue-900 text-sm flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          Como funciona a apuração segregada
        </h2>
        <ul className="text-xs text-blue-800 mt-2 space-y-1 list-disc list-inside">
          <li><strong>Ato próprio (Art. 79):</strong> cooperativa × cooperado — isento de IRPJ/CSLL (RIR Art. 182) e PIS/COFINS (STF Tema 536 sob flag)</li>
          <li><strong>Ato auxiliar (Art. 88):</strong> convênios — fluxo entrada=saída, sem retenção (não tributa)</li>
          <li><strong>Ato não-coop (Art. 86):</strong> terceiros sem vínculo — tributa Lucro Presumido + integra FATES</li>
          <li><strong>Fundos (Art. 28):</strong> Fundo de Reserva 10% + FATES 5% sobre sobras (mais resultado não-coop)</li>
        </ul>
        <p className="text-xs text-amber-800 mt-3 bg-amber-50 border border-amber-300 rounded p-2">
          ⚠️ <strong>Gate Walter:</strong> os números abaixo são calculados pelo motor SISGD mas NÃO devem ser usados pra DCTF/SPED até o contador validar. O snapshot só vira oficial após "Fechar Apuração" + "Validar" pelo Walter.
        </p>
      </div>

      {/* Seletor competência */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Competência</CardTitle>
        </CardHeader>
        <CardContent className="flex items-end gap-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Ano</label>
            <input
              type="number"
              value={ano}
              onChange={(e) => setAno(Number(e.target.value))}
              min={2024}
              max={2099}
              className="border rounded px-2 py-1.5 w-24 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Mês</label>
            <select
              value={mes}
              onChange={(e) => setMes(Number(e.target.value))}
              className="border rounded px-2 py-1.5 text-sm"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {String(m).padStart(2, '0')}
                </option>
              ))}
            </select>
          </div>
          <Button variant="outline" size="sm" onClick={carregar} disabled={loading}>
            <RefreshCw className="h-3.5 w-3.5 mr-1" />
            Recalcular
          </Button>
        </CardContent>
      </Card>

      {erro && (
        <div className="bg-red-50 border-l-4 border-red-500 p-3 text-sm text-red-700 rounded">
          {erro}
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-cyan-700" />
        </div>
      )}

      {!loading && data && (
        <>
          {/* Badge GATE WALTER no topo do resultado */}
          <div className="bg-amber-100 border-2 border-amber-500 p-3 rounded text-center">
            <Badge variant="outline" className="bg-amber-200 border-amber-700 text-amber-900">
              ⚠️ PENDENTE VALIDAÇÃO CONTADOR
            </Badge>
            <p className="text-xs text-amber-800 mt-1">{data.avisoValidacao}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <KpiCard titulo="Sobras brutas (próprio)" valor={data.sobrasBrutas} cor="green" />
            <KpiCard titulo="Resultado não-coop" valor={data.resultadoNaoCoop} cor="purple" />
            <KpiCard titulo="Sobras a distribuir" valor={data.sobrasDistribuiveis} cor="amber" />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Receitas / Despesas por natureza</CardTitle>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead className="text-xs text-gray-500 border-b">
                  <tr>
                    <th className="text-left py-2">Natureza</th>
                    <th className="text-right py-2">Receita / Ingresso</th>
                    <th className="text-right py-2">Despesa / Dispêndio</th>
                  </tr>
                </thead>
                <tbody>
                  <LinhaTabela rotulo="Ato próprio (Art. 79)" r={data.receitaPropria} d={data.despesaPropria} />
                  <LinhaTabela rotulo="Ato auxiliar (Art. 88)" r={data.receitaAuxiliar} d={data.despesaAuxiliar} />
                  <LinhaTabela rotulo="Ato não-coop (Art. 86)" r={data.receitaNaoCoop} d={data.despesaNaoCoop} />
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tributos devidos (Lucro Presumido)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <MetricInline rotulo="PIS" valor={data.pisDevido} />
                <MetricInline rotulo="COFINS" valor={data.cofinsDevido} />
                <MetricInline rotulo="IRPJ" valor={data.irpjDevido} />
                <MetricInline rotulo="CSLL" valor={data.csllDevido} />
              </div>
              {data.fundamentoIsencao && (
                <p className="text-xs text-emerald-700 mt-3 bg-emerald-50 border border-emerald-200 rounded p-2">
                  ✅ <strong>PIS/COFINS sobre próprio = 0</strong> · {data.fundamentoIsencao}
                </p>
              )}
              <p className="text-xs text-amber-700 mt-2 bg-amber-50 border border-amber-200 rounded p-2">
                ⚠️ {data.configuracao.avisoPresuncao}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Fundos obrigatórios (Lei 5.764/71 Art. 28)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <MetricInline rotulo="Fundo de Reserva (10%)" valor={data.fundoReserva} />
                <MetricInline rotulo="FATES (5% + não-coop)" valor={data.fates} />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-2 sticky bottom-0 bg-white border-t pt-3">
            <Button
              variant="outline"
              onClick={() =>
                window.open(
                  `/api/contabilidade-tributaria/relatorios/memorial-calculo-fiscal?ano=${ano}&mes=${mes}`,
                  '_blank',
                )
              }
            >
              <FileText className="h-4 w-4 mr-1" />
              Memorial PDF
            </Button>
            <Button onClick={() => setConfirmarFechar(true)} className="bg-cyan-700 hover:bg-cyan-800">
              <CheckCircle2 className="h-4 w-4 mr-1" />
              Fechar Apuração
            </Button>
          </div>
        </>
      )}

      {/* Dialog Tipo C — confirmação de ação */}
      <Dialog open={confirmarFechar} onOpenChange={setConfirmarFechar}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fechar apuração {data?.competencia}?</DialogTitle>
            <DialogDescription>
              Esta ação cria um <strong>snapshot IMUTÁVEL</strong> do mês. Após fechar:
              <ul className="list-disc list-inside mt-2 text-xs space-y-1">
                <li>Lançamentos retroativos são bloqueados (somente SUPER_ADMIN reabre)</li>
                <li>Snapshot fica marcado <strong>"PENDENTE VALIDAÇÃO CONTADOR"</strong> até Walter validar</li>
                <li>Os números podem ser auditados via Memorial PDF + DREs</li>
              </ul>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmarFechar(false)}>
              Cancelar
            </Button>
            <Button onClick={fecharApuracao} disabled={fechando} className="bg-cyan-700 hover:bg-cyan-800">
              {fechando && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Confirmar fechamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KpiCard({ titulo, valor, cor }: { titulo: string; valor: string; cor: 'green' | 'purple' | 'amber' }) {
  const colorMap = {
    green: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
  } as const;
  return (
    <div className={`border rounded-lg p-4 ${colorMap[cor]}`}>
      <div className="text-xs uppercase font-medium opacity-80">{titulo}</div>
      <div className="text-2xl font-bold mt-1">R$ {fmtNum(valor)}</div>
    </div>
  );
}

function LinhaTabela({ rotulo, r, d }: { rotulo: string; r: string; d: string }) {
  return (
    <tr className="border-b">
      <td className="py-2">{rotulo}</td>
      <td className="text-right py-2 tabular-nums">R$ {fmtNum(r)}</td>
      <td className="text-right py-2 tabular-nums text-rose-700">R$ {fmtNum(d)}</td>
    </tr>
  );
}

function MetricInline({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="border rounded p-2 bg-gray-50">
      <div className="text-xs text-gray-500">{rotulo}</div>
      <div className="font-semibold tabular-nums">R$ {fmtNum(valor)}</div>
    </div>
  );
}

function fmtNum(s: string): string {
  const n = Number(s);
  if (Number.isNaN(n)) return s;
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
