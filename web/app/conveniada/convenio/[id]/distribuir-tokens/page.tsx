'use client';

/**
 * Sprint Clube P1 — F3 Bloco C (12/06/2026).
 *
 * Tela da empresa cooperada PJ distribuir tokens (já comprados no F2) pra
 * funcionários (MEMBRO_ATIVO do convênio). Backend: POST /cooper-token/
 * empresa/distribuir (Bloco B). Helper /cooper-token/empresa/convenio/
 * :id/membros-disponiveis lista saldo + ativos + pendentes.
 *
 * Modos:
 *  - PREVIEW: dry-run, mostra alertas (saldo insuficiente, membros inválidos)
 *    SEM gravar — usado quando user clica "Pré-visualizar".
 *  - CONFIRM: grava em $transaction Serializable. Modal final com PIN +
 *    radio das 3 naturezas + checkbox CLT condicional + motivo PREMIACAO.
 *
 * clientRequestId useRef padrão F4 C.2:
 *  - gerado na primeira PRÉ-VISUALIZAÇÃO ou no abrir do modal
 *  - PRESERVADO durante toda a sessão de confirmação (duplo-clique no
 *    Confirmar envia o MESMO UUID → backend detecta via ledger.findFirst
 *    referenciaTabela='MASS_WRITE_DISTRIBUICAO' e retorna idempotente)
 *  - regenerado APENAS em sucesso ou cancelar (erro mantém UUID pra retry)
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { PinInput } from '@/components/ui/pin-input';
import { HelpBox } from '@/components/ui/help-box';
import {
  ArrowLeft,
  Coins,
  Send,
  ShieldCheck,
  AlertCircle,
  Loader2,
  Users,
  CheckCircle2,
} from 'lucide-react';

interface MembroAtivo {
  membroId: string;
  cooperadoId: string;
  nomeCompleto: string;
  email: string;
  matricula: string | null;
}

interface MembrosDisponiveisResponse {
  convenio: {
    id: string;
    numero: string;
    empresaNome: string;
    status: string;
  };
  saldoEmpresa: {
    saldoDisponivel: number;
    totalEmitido: number;
    totalResgatado: number;
  };
  config: { valorTokenReais: number };
  membros: {
    ativos: MembroAtivo[];
    pendentes: { total: number; breakdown: { empresa: number; admin: number } };
    inativosCount: number;
  };
}

type Natureza = 'ORIGEM_REGULAMENTO' | 'VOLUNTARIA' | 'PREMIACAO';
type Etapa = 'selecao' | 'confirmacao';

interface DistribuicaoLinha {
  membro: MembroAtivo;
  selecionado: boolean;
  quantidade: string; // string pra controle de input
}

export default function DistribuirTokensPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const convenioId = params.id;

  const [data, setData] = useState<MembrosDisponiveisResponse | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erroCarregamento, setErroCarregamento] = useState('');

  // Linhas editáveis da distribuição.
  const [linhas, setLinhas] = useState<DistribuicaoLinha[]>([]);
  const [quantidadeIgual, setQuantidadeIgual] = useState('');

  // Etapa do fluxo + modal.
  const [etapa, setEtapa] = useState<Etapa>('selecao');
  const [pin, setPin] = useState('');
  const [natureza, setNatureza] = useState<Natureza>('ORIGEM_REGULAMENTO');
  const [empresaDeclaraTetoClt, setEmpresaDeclaraTetoClt] = useState(false);
  const [motivoPremiacao, setMotivoPremiacao] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [mensagemSucesso, setMensagemSucesso] = useState('');
  const [erro, setErro] = useState<{
    motivo:
      | 'PIN_NAO_DEFINIDO'
      | 'PIN_BLOQUEADO'
      | 'PIN_INCORRETO'
      | 'EXCEDE_LIMITE'
      | 'SALDO_INSUFICIENTE'
      | 'MEMBROS_INVALIDOS'
      | 'CLT_FALTANTE'
      | 'GENERICO';
    mensagem: string;
    desbloqueiaEm?: string;
  } | null>(null);

  // F3 Bloco C — idempotency-key estável por sessão de confirmação (padrão C.2).
  const clientRequestIdRef = useRef<string | null>(null);

  // ─── Load inicial ───────────────────────────────────────────────────────
  useEffect(() => {
    setCarregando(true);
    setErroCarregamento('');
    api
      .get<MembrosDisponiveisResponse>(
        `/cooper-token/empresa/convenio/${convenioId}/membros-disponiveis`,
      )
      .then((r) => {
        setData(r.data);
        setLinhas(
          r.data.membros.ativos.map((m) => ({
            membro: m,
            selecionado: false,
            quantidade: '',
          })),
        );
      })
      .catch((err: any) => {
        setErroCarregamento(
          err.response?.data?.message ??
            'Erro ao carregar membros disponíveis. Verifique se você é a empresa conveniada deste convênio.',
        );
      })
      .finally(() => setCarregando(false));
  }, [convenioId]);

  // ─── Computeds ──────────────────────────────────────────────────────────
  const linhasSelecionadas = useMemo(
    () => linhas.filter((l) => l.selecionado && parseFloat(l.quantidade) > 0),
    [linhas],
  );

  const totaisLote = useMemo(() => {
    const somaQuantidade = linhasSelecionadas.reduce(
      (s, l) => s + (parseFloat(l.quantidade) || 0),
      0,
    );
    const valorToken = data?.config.valorTokenReais ?? 0.45;
    const somaValorReais = Math.round(somaQuantidade * valorToken * 100) / 100;
    const saldoDisponivel = data?.saldoEmpresa.saldoDisponivel ?? 0;
    const saldoRestante =
      Math.round((saldoDisponivel - somaQuantidade) * 10000) / 10000;
    return {
      somaQuantidade,
      somaValorReais,
      saldoRestante,
      saldoInsuficiente: somaQuantidade > saldoDisponivel,
      total: linhasSelecionadas.length,
    };
  }, [linhasSelecionadas, data]);

  // ─── Handlers ───────────────────────────────────────────────────────────
  function togglarSelecao(idx: number) {
    setLinhas((ls) =>
      ls.map((l, i) =>
        i === idx ? { ...l, selecionado: !l.selecionado } : l,
      ),
    );
  }

  function setQuantidade(idx: number, v: string) {
    setLinhas((ls) =>
      ls.map((l, i) =>
        i === idx ? { ...l, quantidade: v, selecionado: true } : l,
      ),
    );
  }

  function selecionarTodos(marcar: boolean) {
    setLinhas((ls) => ls.map((l) => ({ ...l, selecionado: marcar })));
  }

  function limparTudo() {
    setLinhas((ls) =>
      ls.map((l) => ({ ...l, selecionado: false, quantidade: '' })),
    );
    setQuantidadeIgual('');
  }

  function aplicarIgual() {
    const q = parseFloat(quantidadeIgual);
    if (!q || q <= 0) {
      return;
    }
    setLinhas((ls) =>
      ls.map((l) =>
        l.selecionado ? { ...l, quantidade: String(q) } : l,
      ),
    );
  }

  function abrirConfirmacao() {
    setErro(null);
    if (linhasSelecionadas.length === 0) {
      setErro({ motivo: 'GENERICO', mensagem: 'Selecione pelo menos 1 funcionário com quantidade > 0.' });
      return;
    }
    if (totaisLote.saldoInsuficiente) {
      setErro({
        motivo: 'SALDO_INSUFICIENTE',
        mensagem: `Saldo da empresa (${data?.saldoEmpresa.saldoDisponivel.toFixed(4)} tokens) é menor que o total do lote (${totaisLote.somaQuantidade.toFixed(4)}). Compre mais tokens ou reduza as quantidades.`,
      });
      return;
    }
    // F3 Bloco C — gera UUID UMA VEZ por sessão de confirmação (preserva entre cliques).
    if (!clientRequestIdRef.current) {
      clientRequestIdRef.current = crypto.randomUUID();
    }
    setEtapa('confirmacao');
  }

  function voltarPraSelecao() {
    setEtapa('selecao');
    setPin('');
    setErro(null);
    // NÃO regenera UUID — voltar não é uma nova sessão.
  }

  function cancelarTudo() {
    setEtapa('selecao');
    setPin('');
    setErro(null);
    setMensagemSucesso('');
    // Cancelar = nova sessão.
    clientRequestIdRef.current = null;
  }

  function validarConfirmacaoLocal(): string | null {
    if (!/^\d{6}$/.test(pin)) {
      return 'PIN deve ter 6 dígitos numéricos.';
    }
    if (natureza === 'VOLUNTARIA' && !empresaDeclaraTetoClt) {
      return 'Você precisa confirmar que respeitou o teto de 50% da remuneração (CLT 458 §2º) antes de prosseguir.';
    }
    if (natureza === 'PREMIACAO' && motivoPremiacao.trim().length < 3) {
      return 'Premiação exige descrição com motivo/meta (CLT 457 §2º).';
    }
    return null;
  }

  async function confirmarComPin() {
    const erroLocal = validarConfirmacaoLocal();
    if (erroLocal) {
      setErro({ motivo: natureza === 'VOLUNTARIA' ? 'CLT_FALTANTE' : 'GENERICO', mensagem: erroLocal });
      return;
    }
    if (!clientRequestIdRef.current) {
      clientRequestIdRef.current = crypto.randomUUID();
    }

    setEnviando(true);
    setErro(null);
    try {
      const r = await api.post('/cooper-token/empresa/distribuir', {
        convenioId,
        clientRequestId: clientRequestIdRef.current,
        pin,
        modo: 'CONFIRM',
        distribuicoes: linhasSelecionadas.map((l) => ({
          destinatarioCooperadoId: l.membro.cooperadoId,
          quantidade: parseFloat(l.quantidade),
        })),
        naturezaDistribuicao: natureza,
        // F3 C.1 GAP-F3-3 — envia o valor do token que a UI usou pra calcular
        // o preview (saldo restante, total R$). Backend compara com config
        // atual; divergiu → BadRequest pedindo recarga.
        valorTokenEsperado: data?.config.valorTokenReais ?? 0.45,
        ...(natureza === 'VOLUNTARIA' ? { empresaDeclaraTetoClt: true } : {}),
        ...(natureza === 'PREMIACAO' ? { descricao: motivoPremiacao.trim() } : {}),
      });
      const idempotente = r.data?.idempotente === true;
      setMensagemSucesso(
        idempotente
          ? `Este lote já havia sido processado anteriormente — sem novo débito (idempotência preservou).`
          : `Distribuição concluída! ${totaisLote.total} funcionário(s) receberam ${totaisLote.somaQuantidade.toFixed(4)} tokens no total (R$ ${totaisLote.somaValorReais.toFixed(2)}).`,
      );
      // Sucesso → próxima sessão começa fresca.
      clientRequestIdRef.current = null;
      // Recarregar saldo (pode ter mudado).
      setTimeout(() => router.refresh(), 1500);
    } catch (err: any) {
      const msg: string = err.response?.data?.message ?? 'Erro ao distribuir tokens';
      if (/PIN.*não foi definido|PIN_NAO_DEFINIDO/i.test(msg)) {
        setErro({
          motivo: 'PIN_NAO_DEFINIDO',
          mensagem: 'PIN da empresa ainda não foi configurado. Defina no portal de segurança antes de distribuir.',
        });
      } else if (/PIN bloqueado|PIN_BLOQUEADO/i.test(msg)) {
        const match = msg.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[\d.Z+-:]*)/);
        setErro({
          motivo: 'PIN_BLOQUEADO',
          mensagem: 'PIN bloqueado por excesso de tentativas.',
          desbloqueiaEm: match?.[1],
        });
        setPin('');
      } else if (/PIN incorreto|PIN_INCORRETO/i.test(msg)) {
        setErro({ motivo: 'PIN_INCORRETO', mensagem: 'PIN incorreto. Tente novamente.' });
        setPin('');
      } else if (/excede.*limite/i.test(msg)) {
        setErro({ motivo: 'EXCEDE_LIMITE', mensagem: msg });
      } else if (/Saldo insuficiente/i.test(msg)) {
        setErro({ motivo: 'SALDO_INSUFICIENTE', mensagem: msg });
      } else if (/MEMBROS_INVALIDOS|funcionários.*MEMBRO_ATIVO/i.test(msg)) {
        setErro({ motivo: 'MEMBROS_INVALIDOS', mensagem: msg });
      } else {
        setErro({ motivo: 'GENERICO', mensagem: msg });
      }
    } finally {
      setEnviando(false);
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────
  if (carregando) {
    return (
      <div className="p-8 flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando funcionários...
      </div>
    );
  }
  if (erroCarregamento || !data) {
    return (
      <div className="p-8 max-w-xl">
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-md p-4 text-sm">
          {erroCarregamento || 'Erro desconhecido.'}
        </div>
        <Link href={`/conveniada/convenio/${convenioId}`}>
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href={`/conveniada/convenio/${convenioId}`}
            className="text-xs text-muted-foreground hover:underline flex items-center gap-1"
          >
            <ArrowLeft className="h-3 w-3" /> Voltar ao convênio
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">
            Distribuir tokens aos funcionários
          </h1>
          <p className="text-sm text-muted-foreground">
            Convênio {data.convenio.numero} — {data.convenio.empresaNome}
          </p>
        </div>
        <Card className="px-4 py-3 bg-amber-50 border-amber-200">
          <div className="flex items-center gap-2 text-amber-900">
            <Coins className="h-5 w-5" />
            <div>
              <p className="text-xs">Saldo da empresa</p>
              <p className="text-xl font-bold">
                {data.saldoEmpresa.saldoDisponivel.toFixed(4)}{' '}
                <span className="text-sm font-normal">CooperTokens</span>
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Help inline */}
      <HelpBox id="distribuir-tokens-help" titulo="Como distribuir">
        Selecione os funcionários e quantos tokens cada um recebe. Use{' '}
        <strong>"Quantidade igual"</strong> pra dar o mesmo valor a todos
        selecionados, ou edite por funcionário pra valores diferentes. No fim,
        confirme com PIN da empresa. Os tokens saem do <strong>seu saldo</strong>{' '}
        e entram no saldo de cada funcionário pra ele usar em desconto de fatura
        ou em parceiros do Clube.
      </HelpBox>

      {/* Contador pendentes */}
      {data.membros.pendentes.total > 0 && (
        <div className="bg-orange-50 border border-orange-200 text-orange-900 rounded-md p-3 text-sm">
          <strong>{data.membros.pendentes.total} funcionário(s) pendente(s)</strong>{' '}
          — aprove antes pra incluí-los no próximo lote (
          {data.membros.pendentes.breakdown.empresa} aguardando você,{' '}
          {data.membros.pendentes.breakdown.admin} com admin da cooperativa).
        </div>
      )}

      {data.membros.ativos.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p>Nenhum funcionário ativo neste convênio.</p>
            <Link
              href={`/conveniada/convenio/${convenioId}`}
              className="text-sm text-blue-600 underline mt-2 inline-block"
            >
              Voltar ao convênio
            </Link>
          </CardContent>
        </Card>
      ) : etapa === 'selecao' ? (
        <>
          {/* Ações em lote */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Ações rápidas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2 items-end">
                <div className="w-40">
                  <Label className="text-xs">Quantidade igual</Label>
                  <Input
                    type="number"
                    min={0.0001}
                    step={0.0001}
                    value={quantidadeIgual}
                    onChange={(e) => setQuantidadeIgual(e.target.value)}
                    placeholder="Ex: 50"
                  />
                </div>
                <Button variant="outline" size="sm" onClick={aplicarIgual}>
                  Aplicar aos selecionados
                </Button>
                <div className="w-px h-8 bg-gray-200" />
                <Button variant="outline" size="sm" onClick={() => selecionarTodos(true)}>
                  Selecionar todos
                </Button>
                <Button variant="outline" size="sm" onClick={() => selecionarTodos(false)}>
                  Deselecionar todos
                </Button>
                <Button variant="ghost" size="sm" onClick={limparTudo}>
                  Limpar tudo
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Lista membros */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="h-4 w-4" /> Funcionários ativos ({data.membros.ativos.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                {linhas.map((l, idx) => (
                  <div
                    key={l.membro.membroId}
                    className={`flex items-center gap-3 p-2 rounded border ${
                      l.selecionado ? 'border-amber-300 bg-amber-50/50' : 'border-gray-200'
                    }`}
                  >
                    <Checkbox
                      checked={l.selecionado}
                      onCheckedChange={() => togglarSelecao(idx)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {l.membro.nomeCompleto}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {l.membro.email}
                        {l.membro.matricula && ` · Mat. ${l.membro.matricula}`}
                      </p>
                    </div>
                    <div className="w-32">
                      <Input
                        type="number"
                        min={0.0001}
                        step={0.0001}
                        value={l.quantidade}
                        onChange={(e) => setQuantidade(idx, e.target.value)}
                        placeholder="0"
                        className="text-right"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Card preview */}
          {linhasSelecionadas.length > 0 && (
            <Card
              className={
                totaisLote.saldoInsuficiente
                  ? 'border-red-300 bg-red-50/50'
                  : 'border-green-300 bg-green-50/30'
              }
            >
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Pré-visualização do lote</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Funcionários</p>
                    <p className="font-bold">{totaisLote.total}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Soma tokens</p>
                    <p className="font-bold">{totaisLote.somaQuantidade.toFixed(4)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Equivalente R$</p>
                    <p className="font-bold">R$ {totaisLote.somaValorReais.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Saldo após distribuição</p>
                    <p
                      className={`font-bold ${
                        totaisLote.saldoRestante < 0 ? 'text-red-600' : 'text-green-700'
                      }`}
                    >
                      {totaisLote.saldoRestante.toFixed(4)} CooperTokens
                    </p>
                  </div>
                </div>
                {totaisLote.saldoInsuficiente && (
                  <div className="bg-red-100 border border-red-200 text-red-800 rounded p-2 text-xs flex items-start gap-2 mt-2">
                    <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <p>
                      Saldo insuficiente. Reduza as quantidades ou{' '}
                      <Link href="/portal/comprar-tokens" className="underline font-semibold">
                        compre mais tokens
                      </Link>
                      .
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Botão prosseguir */}
          <div className="flex justify-end gap-2">
            <Link href={`/conveniada/convenio/${convenioId}`}>
              <Button variant="outline">Cancelar</Button>
            </Link>
            <Button
              onClick={abrirConfirmacao}
              disabled={linhasSelecionadas.length === 0 || totaisLote.saldoInsuficiente}
            >
              <Send className="h-4 w-4 mr-2" />
              Prosseguir ({linhasSelecionadas.length})
            </Button>
          </div>

          {/* Erro local */}
          {erro && (
            <div className="bg-red-50 border border-red-200 text-red-800 rounded-md p-3 text-sm">
              {erro.mensagem}
            </div>
          )}
        </>
      ) : (
        /* ───────── ETAPA CONFIRMACAO ───────── */
        <Card className="border-2 border-amber-300">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-900">
              <ShieldCheck className="h-5 w-5" />
              Confirmar distribuição
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {mensagemSucesso ? (
              <div className="bg-green-50 border border-green-200 text-green-800 rounded-md p-4 flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="font-medium">Sucesso!</p>
                  <p className="text-sm mt-1">{mensagemSucesso}</p>
                  <Link
                    href={`/conveniada/convenio/${convenioId}`}
                    className="text-sm underline mt-3 inline-block"
                  >
                    Voltar ao convênio →
                  </Link>
                </div>
              </div>
            ) : (
              <>
                {/* Resumo */}
                <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-sm space-y-1">
                  <p>
                    <strong>{totaisLote.total} funcionário(s)</strong> vão receber{' '}
                    <strong>{totaisLote.somaQuantidade.toFixed(4)} tokens</strong> no total
                    (equivalente a R$ {totaisLote.somaValorReais.toFixed(2)}).
                  </p>
                  <p>
                    Saldo da empresa após:{' '}
                    <strong>{totaisLote.saldoRestante.toFixed(4)} CooperTokens</strong>.
                  </p>
                </div>

                {/* Natureza */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    Natureza jurídica da distribuição
                  </Label>
                  <div className="space-y-2">
                    <label className="flex items-start gap-2 cursor-pointer p-2 rounded border hover:bg-gray-50">
                      <input
                        type="radio"
                        name="natureza"
                        value="ORIGEM_REGULAMENTO"
                        checked={natureza === 'ORIGEM_REGULAMENTO'}
                        onChange={(e) => setNatureza(e.target.value as Natureza)}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium">Prevista no regulamento</p>
                        <p className="text-xs text-muted-foreground">
                          Distribuição prevista no regulamento do plano/estatuto da empresa
                          (CLT 458 §2º cumprido por regulamento).
                        </p>
                      </div>
                    </label>
                    <label className="flex items-start gap-2 cursor-pointer p-2 rounded border hover:bg-gray-50">
                      <input
                        type="radio"
                        name="natureza"
                        value="VOLUNTARIA"
                        checked={natureza === 'VOLUNTARIA'}
                        onChange={(e) => setNatureza(e.target.value as Natureza)}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium">Voluntária</p>
                        <p className="text-xs text-muted-foreground">
                          Benefício não-salarial voluntário (CLT 458 §2º — exige respeito ao
                          teto de 50% da remuneração).
                        </p>
                      </div>
                    </label>
                    <label className="flex items-start gap-2 cursor-pointer p-2 rounded border hover:bg-gray-50">
                      <input
                        type="radio"
                        name="natureza"
                        value="PREMIACAO"
                        checked={natureza === 'PREMIACAO'}
                        onChange={(e) => setNatureza(e.target.value as Natureza)}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium">Premiação por meta/desempenho</p>
                        <p className="text-xs text-muted-foreground">
                          Prêmio por desempenho (CLT 457 §2º — excluído da remuneração;
                          exige descrição do motivo/meta).
                        </p>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Condicionais por natureza */}
                {natureza === 'VOLUNTARIA' && (
                  <div className="bg-amber-50 border border-amber-300 rounded-md p-3">
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={empresaDeclaraTetoClt}
                        onChange={(e) => setEmpresaDeclaraTetoClt(e.target.checked)}
                        className="mt-1"
                      />
                      <span className="text-sm text-amber-900">
                        <strong>Declaro</strong> que esta distribuição respeita o teto de{' '}
                        <strong>50% da remuneração mensal</strong> de cada funcionário
                        (CLT 458 §2º). O SISGD não valida automaticamente — essa declaração
                        é da empresa.
                      </span>
                    </label>
                  </div>
                )}
                {natureza === 'PREMIACAO' && (
                  <div className="space-y-2">
                    <Label className="text-sm">
                      Motivo/meta da premiação <span className="text-red-500">*</span>
                    </Label>
                    <Textarea
                      value={motivoPremiacao}
                      onChange={(e) => setMotivoPremiacao(e.target.value)}
                      placeholder="Ex: Meta de vendas Q2 2026 atingida"
                      rows={2}
                    />
                  </div>
                )}

                {/* PIN */}
                <div>
                  <Label className="text-sm mb-2 block">PIN da empresa (6 dígitos)</Label>
                  <PinInput
                    value={pin}
                    onChange={(v) => {
                      setPin(v);
                      if (erro?.motivo === 'PIN_INCORRETO') setErro(null);
                    }}
                    erro={
                      erro?.motivo === 'PIN_INCORRETO' ||
                      erro?.motivo === 'PIN_BLOQUEADO' ||
                      erro?.motivo === 'PIN_NAO_DEFINIDO'
                    }
                    disabled={enviando || erro?.motivo === 'PIN_BLOQUEADO' || erro?.motivo === 'PIN_NAO_DEFINIDO'}
                  />
                </div>

                {/* Erro humano */}
                {erro && (
                  <div className="bg-red-50 border border-red-200 text-red-800 rounded-md p-3 text-sm space-y-2">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                      <div className="space-y-1 flex-1">
                        <p className="font-medium">{erro.mensagem}</p>
                        {erro.motivo === 'PIN_NAO_DEFINIDO' && (
                          <Link
                            href="/portal/seguranca/definir-pin"
                            className="text-red-900 underline text-xs font-semibold inline-block"
                          >
                            Configurar PIN agora →
                          </Link>
                        )}
                        {erro.motivo === 'PIN_BLOQUEADO' && erro.desbloqueiaEm && (
                          <p className="text-xs">
                            Tente novamente após{' '}
                            <strong>
                              {new Date(erro.desbloqueiaEm).toLocaleString('pt-BR', {
                                dateStyle: 'short',
                                timeStyle: 'short',
                              })}
                            </strong>
                            .
                          </p>
                        )}
                        {(erro.motivo === 'EXCEDE_LIMITE' || erro.motivo === 'SALDO_INSUFICIENTE') && (
                          <p className="text-xs">
                            Ajuste o limite em{' '}
                            <Link href="/portal/seguranca" className="underline font-semibold">
                              /portal/seguranca
                            </Link>{' '}
                            ou{' '}
                            <Link href="/portal/comprar-tokens" className="underline font-semibold">
                              compre mais tokens
                            </Link>
                            .
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Botões */}
                <div className="flex gap-2 justify-end pt-2">
                  <Button variant="ghost" onClick={cancelarTudo} disabled={enviando}>
                    Cancelar tudo
                  </Button>
                  <Button variant="outline" onClick={voltarPraSelecao} disabled={enviando}>
                    Voltar
                  </Button>
                  <Button
                    onClick={confirmarComPin}
                    disabled={
                      enviando ||
                      pin.length !== 6 ||
                      erro?.motivo === 'PIN_BLOQUEADO' ||
                      erro?.motivo === 'PIN_NAO_DEFINIDO'
                    }
                  >
                    {enviando ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <ShieldCheck className="h-4 w-4 mr-2" />
                    )}
                    {enviando ? 'Distribuindo...' : 'Confirmar com PIN'}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
