'use client';

/**
 * D-FISCAL-2.3 (01/06/2026 noite) — Edição do convênio legado (consolidado).
 *
 * Foco: bloco fiscal (toggle geraLancamentoContabil + classificação) +
 * MovimentosConvenioSection reusada (parametrizada pros endpoints do
 * convênio consolidado /convenios/:id/movimentos-contabeis — D-FISCAL-2.2).
 *
 * useParams RAW (lição BF). Selects nativos (regra 19/05). Salva via
 * PATCH /convenios/:id (UpdateConvenioDto agora aceita os campos fiscais).
 */

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Loader2, FileCheck } from 'lucide-react';
import {
  ConvenioFiscalBloco,
  type ConvenioFiscalState,
} from '@/components/convenios/ConvenioFiscalBloco';
import {
  ConvenioCusteioBloco,
  type ConvenioCusteioState,
} from '@/components/convenios/ConvenioCusteioBloco';
import { MovimentosConvenioSection } from '@/components/convenios/MovimentosConvenioSection';

interface ConvenioApi {
  id: string;
  numero: string;
  empresaNome: string;
  empresaCnpj: string | null;
  empresaEmail: string | null;
  empresaTelefone: string | null;
  status: string;
  // Bloco fiscal (D-FISCAL-2.1)
  geraLancamentoContabil: boolean;
  naturezaAtoCooperativo: string | null;
  fluxoFinanceiro: string | null;
  classificacaoFiscal: string | null;
  vigenciaInicio: string | null;
  vigenciaFim: string | null;
  // Bloco custeio (D-FISCAL-2.4.1)
  pagador: 'CADA_MEMBRO' | 'EMPRESA' | null;
  pagadorCooperadoId: string | null;
  baseCobrancaCusteio: 'CONSUMO_REAL' | 'ALOCACAO_FIXA' | null;
  kwhAlocadoMensal: number | null;
  descontoKwhCusteio: number | string | null;
  // D-novo-CT-TARIFA-FIXA-EMPRESA (02/06/2026)
  tipoTarifaEmpresa: 'PERCENTUAL_DESCONTO' | 'VALOR_FIXO' | null;
  tarifaFixaKwhEmpresa: number | string | null;
}

export default function EditarConvenioLegadoPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [convenio, setConvenio] = useState<ConvenioApi | null>(null);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [msg, setMsg] = useState('');

  // Dados básicos
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');

  // Bloco fiscal
  const [fiscal, setFiscal] = useState<ConvenioFiscalState>({
    geraLancamentoContabil: false,
    naturezaAtoCooperativo: '',
    fluxoFinanceiro: '',
    classificacaoFiscal: '',
    vigenciaInicio: '',
    vigenciaFim: '',
  });

  // D-FISCAL-2.4.4e — bloco custeio (Caso 1: empresa paga total)
  // D-novo-CT-TARIFA-FIXA-EMPRESA — tipoTarifaEmpresa + tarifaFixaKwhEmpresa
  const [custeio, setCusteio] = useState<ConvenioCusteioState>({
    pagador: 'CADA_MEMBRO',
    pagadorCooperadoId: '',
    baseCobrancaCusteio: 'CONSUMO_REAL',
    kwhAlocadoMensal: '',
    descontoKwhCusteio: '',
    tipoTarifaEmpresa: 'PERCENTUAL_DESCONTO',
    tarifaFixaKwhEmpresa: '',
    // Sprint Onboarding Bloco 0 Fatia 0.2 (06/06/2026)
    planoClubeId: '',
  });

  async function carregar() {
    if (!id) return;
    setLoading(true);
    setErro('');
    try {
      const { data } = await api.get<ConvenioApi>(`/convenios/${id}`);
      setConvenio(data);
      setNome(data.empresaNome);
      setEmail(data.empresaEmail ?? '');
      setTelefone(data.empresaTelefone ?? '');
      setFiscal({
        geraLancamentoContabil: data.geraLancamentoContabil,
        naturezaAtoCooperativo: (data.naturezaAtoCooperativo as any) ?? '',
        fluxoFinanceiro: (data.fluxoFinanceiro as any) ?? '',
        classificacaoFiscal: data.classificacaoFiscal ?? '',
        vigenciaInicio: data.vigenciaInicio ? data.vigenciaInicio.substring(0, 10) : '',
        vigenciaFim: data.vigenciaFim ? data.vigenciaFim.substring(0, 10) : '',
      });
      // D-FISCAL-2.4.4e + D-novo-CT-TARIFA-FIXA-EMPRESA — bloco custeio
      setCusteio({
        pagador: (data.pagador as any) ?? 'CADA_MEMBRO',
        pagadorCooperadoId: data.pagadorCooperadoId ?? '',
        baseCobrancaCusteio: (data.baseCobrancaCusteio as any) ?? 'CONSUMO_REAL',
        kwhAlocadoMensal: data.kwhAlocadoMensal ?? '',
        descontoKwhCusteio:
          data.descontoKwhCusteio !== null && data.descontoKwhCusteio !== undefined
            ? Number(data.descontoKwhCusteio)
            : '',
        tipoTarifaEmpresa: (data.tipoTarifaEmpresa as any) ?? 'PERCENTUAL_DESCONTO',
        tarifaFixaKwhEmpresa:
          data.tarifaFixaKwhEmpresa !== null && data.tarifaFixaKwhEmpresa !== undefined
            ? Number(data.tarifaFixaKwhEmpresa)
            : '',
        // Sprint Onboarding Bloco 0 Fatia 0.2 — Plano de Clube vinculado.
        planoClubeId: (data as any).planoClubeId ?? '',
      });
    } catch (err: any) {
      setErro(err?.response?.data?.message ?? 'Falha ao carregar convênio');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    setMsg('');

    if (fiscal.geraLancamentoContabil) {
      if (!fiscal.naturezaAtoCooperativo) {
        setErro('Bloco fiscal: escolha a natureza do ato cooperativo.');
        return;
      }
      if (!fiscal.fluxoFinanceiro) {
        setErro('Bloco fiscal: escolha o fluxo financeiro.');
        return;
      }
    }

    // D-FISCAL-2.4.4e — validação custeio
    if (custeio.pagador === 'EMPRESA') {
      if (!custeio.pagadorCooperadoId) {
        setErro('Custeio: selecione a empresa pagadora (cooperado PJ).');
        return;
      }
      if (
        custeio.baseCobrancaCusteio === 'ALOCACAO_FIXA' &&
        (!custeio.kwhAlocadoMensal || Number(custeio.kwhAlocadoMensal) <= 0)
      ) {
        setErro('Custeio: ALOCACAO_FIXA exige kWh alocado por mês > 0.');
        return;
      }
      // D-novo-CT-TARIFA-FIXA-EMPRESA: VALOR_FIXO exige tarifaFixaKwhEmpresa>0
      if (
        custeio.tipoTarifaEmpresa === 'VALOR_FIXO' &&
        (!custeio.tarifaFixaKwhEmpresa || Number(custeio.tarifaFixaKwhEmpresa) <= 0)
      ) {
        setErro('Custeio: tarifa fixa R$/kWh exige valor > 0.');
        return;
      }
    }

    setSalvando(true);
    try {
      const payload: any = {
        nome,
        email: email || null,
        telefone: telefone || null,
        geraLancamentoContabil: fiscal.geraLancamentoContabil,
        naturezaAtoCooperativo: fiscal.geraLancamentoContabil
          ? fiscal.naturezaAtoCooperativo || null
          : null,
        fluxoFinanceiro: fiscal.geraLancamentoContabil
          ? fiscal.fluxoFinanceiro || null
          : null,
        classificacaoFiscal: fiscal.classificacaoFiscal.trim() || null,
        vigenciaInicio: fiscal.vigenciaInicio || null,
        vigenciaFim: fiscal.vigenciaFim || null,
        // D-FISCAL-2.4.4e — bloco custeio
        pagador: custeio.pagador,
        pagadorCooperadoId:
          custeio.pagador === 'EMPRESA' ? custeio.pagadorCooperadoId : null,
        baseCobrancaCusteio:
          custeio.pagador === 'EMPRESA' ? custeio.baseCobrancaCusteio : null,
        kwhAlocadoMensal:
          custeio.pagador === 'EMPRESA' && custeio.kwhAlocadoMensal !== ''
            ? Number(custeio.kwhAlocadoMensal)
            : null,
        descontoKwhCusteio:
          custeio.pagador === 'EMPRESA' && custeio.descontoKwhCusteio !== ''
            ? Number(custeio.descontoKwhCusteio)
            : null,
        // D-novo-CT-TARIFA-FIXA-EMPRESA
        tipoTarifaEmpresa:
          custeio.pagador === 'EMPRESA' ? custeio.tipoTarifaEmpresa : null,
        tarifaFixaKwhEmpresa:
          custeio.pagador === 'EMPRESA' && custeio.tarifaFixaKwhEmpresa !== ''
            ? Number(custeio.tarifaFixaKwhEmpresa)
            : null,
        // Sprint Onboarding Bloco 0 Fatia 0.2 — Plano de Clube vinculado.
        // Quando CADA_MEMBRO, envia null pra desvincular (UI já zerou via onChange).
        planoClubeId:
          custeio.pagador === 'EMPRESA' && custeio.planoClubeId
            ? custeio.planoClubeId
            : null,
      };
      await api.patch(`/convenios/${id}`, payload);
      setMsg('Convênio atualizado com sucesso.');
      await carregar();
    } catch (err: any) {
      setErro(err?.response?.data?.message ?? 'Falha ao salvar');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <Link href={`/dashboard/convenios/${id}`}>
          <Button variant="ghost" size="icon" title="Voltar pro detalhe">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <FileCheck className="h-6 w-6 text-cyan-700" />
            Editar Convênio
          </h1>
          {convenio && (
            <p className="text-sm text-gray-500 mt-0.5">
              {convenio.numero} · {convenio.empresaNome}
            </p>
          )}
        </div>
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-cyan-700" />
        </div>
      )}

      {!loading && convenio && (
        <>
          <form onSubmit={salvar} className="space-y-6">
            {erro && (
              <div className="bg-red-50 border-l-4 border-red-500 p-3 text-sm text-red-700 rounded">
                {erro}
              </div>
            )}
            {msg && (
              <div className="bg-emerald-50 border-l-4 border-emerald-500 p-3 text-sm text-emerald-700 rounded">
                {msg}
              </div>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Dados do convênio</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <Label htmlFor="nome">Nome *</Label>
                  <Input
                    id="nome"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    required
                    minLength={3}
                    maxLength={200}
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="telefone">Telefone</Label>
                  <Input
                    id="telefone"
                    value={telefone}
                    onChange={(e) => setTelefone(e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            {/* D-FISCAL-2.4.4e — bloco custeio (Caso 1) */}
            <Card>
              <CardContent className="pt-4">
                <ConvenioCusteioBloco
                  state={custeio}
                  onChange={(patch) => setCusteio((prev) => ({ ...prev, ...patch }))}
                  helpId={`convenio-editar-${id}-custeio`}
                />
              </CardContent>
            </Card>

            {/* D-FISCAL-2.3 — bloco fiscal */}
            <Card>
              <CardContent className="pt-4">
                <ConvenioFiscalBloco
                  state={fiscal}
                  onChange={(patch) => setFiscal((prev) => ({ ...prev, ...patch }))}
                  helpId={`convenio-editar-${id}-fiscal`}
                />
              </CardContent>
            </Card>

            <div className="flex justify-end gap-3 sticky bottom-0 bg-white border-t pt-3">
              <Link href={`/dashboard/convenios/${id}`}>
                <Button type="button" variant="outline" disabled={salvando}>
                  Cancelar
                </Button>
              </Link>
              <Button
                type="submit"
                disabled={salvando}
                className="bg-cyan-700 hover:bg-cyan-800"
              >
                {salvando && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                Salvar alterações
              </Button>
            </div>
          </form>

          {/* D-FISCAL-2.3 — Movimentos contábeis só aparecem se a flag está ligada */}
          {convenio.geraLancamentoContabil && convenio.fluxoFinanceiro && (
            <Card>
              <CardContent className="pt-4">
                <MovimentosConvenioSection
                  convenioId={convenio.id}
                  fluxoFinanceiro={convenio.fluxoFinanceiro}
                  nomeConvenio={convenio.empresaNome}
                  endpointBase={`/convenios/${convenio.id}/movimentos-contabeis`}
                />
              </CardContent>
            </Card>
          )}

          {!convenio.geraLancamentoContabil && (
            <div className="bg-amber-50 border-l-4 border-amber-500 p-3 text-xs text-amber-800 rounded">
              💡 <strong>Movimentos contábeis indisponíveis</strong> — ative "Gerar registro
              contábil" + escolha natureza/fluxo + salve pra liberar o registro de
              movimentos deste convênio.
            </div>
          )}
        </>
      )}
    </div>
  );
}
