'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Sun, ArrowLeft, ArrowRight, Check, Loader2, User, MapPin, Zap,
  FileCheck, X, SkipForward, Upload, Camera, FileText, AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { mapearOcrParaInstalacao } from '@/lib/ocr-mapping';
// F4 Bloco D carona (12/06/2026) — helper único de telefone (fix strip 55).
import { formatarTelefone as formatarTelefoneHelper } from '@/lib/formatar-telefone';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

const DISTRIBUIDORAS = [
  { value: 'EDP_ES', label: 'EDP ES' },
  { value: 'EDP_SP', label: 'EDP SP' },
  { value: 'CEMIG', label: 'CEMIG' },
  { value: 'ENEL_SP', label: 'Enel SP' },
  { value: 'LIGHT_RJ', label: 'Light RJ' },
  { value: 'CELESC', label: 'Celesc' },
  { value: 'OUTRAS', label: 'Outras' },
] as const;

// Best-effort: mapeia string vinda do OCR (ex: "EDP ES DISTRIB DE ENERGIA SA")
// para o enum DistribuidoraEnum do backend.
function mapearDistribuidoraOcr(raw: string | undefined | null): string {
  if (!raw) return '';
  const s = String(raw).toUpperCase();
  if (/EDP.*ES|ESPIRITO.*SANTO/.test(s)) return 'EDP_ES';
  if (/EDP.*SP|SAO.*PAULO|BANDEIRANTE/.test(s)) return 'EDP_SP';
  if (/CEMIG/.test(s)) return 'CEMIG';
  if (/ENEL.*SP|ELETROPAULO/.test(s)) return 'ENEL_SP';
  if (/LIGHT/.test(s)) return 'LIGHT_RJ';
  if (/CELESC/.test(s)) return 'CELESC';
  return 'OUTRAS';
}

const DESCONTO_PERCENTUAL_FALLBACK = 0.20;

// ─── Masks ───────────────────────────────────────────────

function formatarCPF(valor: string): string {
  const nums = valor.replace(/\D/g, '').slice(0, 11);
  if (nums.length <= 3) return nums;
  if (nums.length <= 6) return `${nums.slice(0, 3)}.${nums.slice(3)}`;
  if (nums.length <= 9) return `${nums.slice(0, 3)}.${nums.slice(3, 6)}.${nums.slice(6)}`;
  return `${nums.slice(0, 3)}.${nums.slice(3, 6)}.${nums.slice(6, 9)}-${nums.slice(9)}`;
}

// F4 Bloco D carona (12/06/2026) — agora vem de @/lib/formatar-telefone
// (helper unico + fix strip 55 prefix).
const formatarTelefone = formatarTelefoneHelper;

function formatarCEP(valor: string): string {
  const nums = valor.replace(/\D/g, '').slice(0, 8);
  if (nums.length <= 5) return nums;
  return `${nums.slice(0, 5)}-${nums.slice(5)}`;
}

function formatarMoeda(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// ─── Types ───────────────────────────────────────────────

interface DadosPessoais {
  nome: string;
  cpf: string;
  email: string;
  telefone: string;
}

interface Endereco {
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
}

interface Instalacao {
  numeroUC: string;                       // número que aparece na fatura (vai para `numero` canônico no backend)
  numeroUCLegado: string;                 // número antigo de 9 dígitos, opcional (vai para `numeroUC` no backend)
  numeroConcessionariaOriginal: string;   // string completa como aparece na fatura (formato preservado), opcional
  distribuidora: string;                  // valor do enum DistribuidoraEnum
  consumoMedioKwh: string;
}

interface HistoricoItem {
  mesAno: string;
  consumoKwh: number;
  valorRS: number;
}

interface OcrDados {
  nome?: string;
  cpf?: string;
  // D-novo-OCR-UC-PREFILL (05/06) — 3 variantes da UC retornadas pelo OCR
  numero?: string;                          // canônico 10 dig (formato SISGD)
  numeroUC?: string;                        // legado 9 dig (forma EDP antiga)
  numeroConcessionariaOriginal?: string;    // string preservada (formato EDP-ES atual)
  distribuidora?: string;
  consumoMedioKwh?: number;
  totalAPagar?: number;
  endereco?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  historicoConsumo?: HistoricoItem[];
  temCreditosInjetados?: boolean;
  energiaInjetadaKwh?: number;
  energiaFornecidaKwh?: number;
  saldoCreditosKwh?: number;
  valorCompensadoReais?: number;
}

interface PlanoOption {
  id: string;
  nome: string;
  descricao?: string | null;
  descontoBase: string;
  cooperTokenAtivo: boolean;
  modeloCobranca: string;
}

const STEPS = [
  { label: 'Dados pessoais', icon: User },
  { label: 'Endereco', icon: MapPin },
  { label: 'Instalacao', icon: Zap },
  { label: 'Revisao', icon: FileCheck },
];

function CadastroPageInner() {
  const searchParams = useSearchParams();
  const refCode = searchParams.get('ref');

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const [erro, setErro] = useState('');
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [aceitouTermos, setAceitouTermos] = useState(false);
  const [aceitaClube, setAceitaClube] = useState(false);
  const [planos, setPlanos] = useState<PlanoOption[]>([]);
  const [planoSelecionadoId, setPlanoSelecionadoId] = useState<string>('');
  const planoSelecionado = planos.find((p) => p.id === planoSelecionadoId) ?? null;

  // D-FISCAL-2.4.3 — Caso 1 custeio (empresa paga total)
  const [tipoCobranca, setTipoCobranca] = useState<'PROPRIA' | 'CUSTEADA'>('PROPRIA');
  const [conveniosCusteio, setConveniosCusteio] = useState<Array<{ id: string; empresaNome: string }>>([]);
  const [convenioCusteioId, setConvenioCusteioId] = useState<string>('');

  // OCR state
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrSucesso, setOcrSucesso] = useState(false);
  const [ocrErro, setOcrErro] = useState('');
  // D-novo-OCR-RESILIENCIA (05/06/2026) — motivo categorizado retornado pelo
  // backend distingue recuperáveis (overload/rate-limit/timeout → mostra
  // "Tentar de novo") de terminais (truncated/invalid-json/unknown → modo manual).
  const [ocrMotivoRecuperavel, setOcrMotivoRecuperavel] = useState(false);
  const [ocrDados, setOcrDados] = useState<OcrDados>({});
  const [historicoConsumo, setHistoricoConsumo] = useState<HistoricoItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Modo manual (OCR falhou)
  const [modoManual, setModoManual] = useState(false);
  const [faturaArquivo, setFaturaArquivo] = useState<File | null>(null);
  const [valorUltimaFatura, setValorUltimaFatura] = useState('');

  // Créditos injetados (fluxo especial)
  const [creditosInjetados, setCreditosInjetados] = useState(false);
  const [creditosLoading, setCreditosLoading] = useState(false);
  const [creditosEnviado, setCreditosEnviado] = useState(false);

  // Documento pendente (tela sucesso)
  const [mostrarUploadDoc, setMostrarUploadDoc] = useState(false);
  const [docEnviado, setDocEnviado] = useState(false);
  const [enviarDepois, setEnviarDepois] = useState(false);
  const docInputRef = useRef<HTMLInputElement>(null);

  // ─── Convite / Indicador ─────────────────────────────────
  const [nomeIndicador, setNomeIndicador] = useState<string | null>(null);
  const [bannerVisivel, setBannerVisivel] = useState(true);
  const [descontoPercentual, setDescontoPercentual] = useState(DESCONTO_PERCENTUAL_FALLBACK);

  // ─── Convergência Fatia 2 (04/06/2026) — convite custeio ─────────
  // ?conv=<token> → wizard pra cadastro custeado (empresa paga a energia
  // do funcionário). Diferente de ?ref= (indicador MLM): aqui não há MLM.
  type EtapaOtp = 'aguardando' | 'solicitando' | 'codigo-enviado' | 'validado';
  interface ConviteData {
    empresaNome: string;
    nomeConvidado: string;
    telefoneSufixo: string;
    convenioId: string;
    permiteSemUc?: boolean;
  }
  const conviteToken = searchParams.get('conv');
  const [conviteData, setConviteData] = useState<ConviteData | null>(null);
  const [conviteErro, setConviteErro] = useState<string>('');
  const [otpEtapa, setOtpEtapa] = useState<EtapaOtp>('aguardando');
  const [otpCodigo, setOtpCodigo] = useState('');
  const [otpErro, setOtpErro] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [consentimentoDocs, setConsentimentoDocs] = useState(false);
  // Sprint Convênio-Token-Cooperado (20/06/2026) — slice "recebe créditos GD
  // como DADO". Cliente declara se já recebe créditos de outra cooperativa/
  // gerador. NÃO bloqueia o cadastro — é DADO defensivo anti-double-count
  // SCEE + insumo pro futuro fluxo de migração (Fase 3 do convênio).
  const [jaRecebeCreditosGd, setJaRecebeCreditosGd] = useState(false);
  const [fornecedorGdAtual, setFornecedorGdAtual] = useState('');
  // Uploads opcionais via /publico/cadastro/upload-doc (Fatia 1 endpoint)
  type TipoUploadConvite = 'RG_FRENTE' | 'RG_VERSO' | 'CNH_FRENTE' | 'CNH_VERSO' | 'SELFIE';
  const [uploadsConvite, setUploadsConvite] = useState<Partial<Record<TipoUploadConvite, { ref: string; publicUrl: string }>>>({});
  const [uploadConviteLoading, setUploadConviteLoading] = useState<TipoUploadConvite | null>(null);
  const [uploadConviteErro, setUploadConviteErro] = useState<string>('');

  // Modo teste — espelho do backend (Fatia 1 unificou isAmbienteReal).
  // NEXT_PUBLIC_AMBIENTE_REAL='true' (prod) → strict; senão (dev) → relaxa.
  const ehModoTeste = process.env.NEXT_PUBLIC_AMBIENTE_REAL !== 'true';

  async function uploadDocConvite(tipo: TipoUploadConvite, file: File) {
    if (!conviteToken) return;
    setUploadConviteErro('');
    setUploadConviteLoading(tipo);
    try {
      const form = new FormData();
      form.append('token', conviteToken);
      form.append('tipo', tipo);
      form.append('arquivo', file);
      const r = await fetch(`${API_URL}/publico/cadastro/upload-doc`, {
        method: 'POST',
        body: form,
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.message?.mensagem ?? data?.message ?? 'Falha ao enviar arquivo');
      setUploadsConvite((s) => ({ ...s, [tipo]: { ref: data.ref, publicUrl: data.publicUrl } }));
    } catch (err: any) {
      setUploadConviteErro(err?.message ?? 'Erro no upload.');
    } finally {
      setUploadConviteLoading(null);
    }
  }

  useEffect(() => {
    fetch(`${API_URL}/publico/desconto-padrao`)
      .then((r) => r.json())
      .then((data) => {
        if (data.percentual && data.percentual > 0) setDescontoPercentual(data.percentual);
      })
      .catch(() => {});
  }, []);

  // Buscar planos do tenant (multi-tenant: tenant via ?tenant= ou env NEXT_PUBLIC_COOPERATIVA_ID)
  useEffect(() => {
    const tenant = searchParams.get('tenant') ?? process.env.NEXT_PUBLIC_COOPERATIVA_ID;
    const qs = new URLSearchParams({ publico: 'true' });
    if (tenant) qs.set('cooperativaId', tenant);
    fetch(`${API_URL}/planos/ativos?${qs.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setPlanos(data);
      })
      .catch(() => {});
  }, [searchParams]);

  // D-FISCAL-2.4.3 — Buscar convênios pagador=EMPRESA disponíveis pro custeio.
  useEffect(() => {
    const tenant = searchParams.get('tenant') ?? process.env.NEXT_PUBLIC_COOPERATIVA_ID;
    if (!tenant) return;
    fetch(`${API_URL}/publico/convenios-pagador-empresa?tenant=${encodeURIComponent(tenant)}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setConveniosCusteio(data);
      })
      .catch(() => setConveniosCusteio([]));
  }, [searchParams]);

  useEffect(() => {
    if (!refCode) return;
    fetch(`${API_URL}/publico/convite/${refCode}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.valido && data.nomeIndicador) {
          setNomeIndicador(data.nomeIndicador);
        }
      })
      .catch(() => {});
  }, [refCode]);

  const [pessoais, setPessoais] = useState<DadosPessoais>({
    nome: '',
    cpf: '',
    email: '',
    telefone: '',
  });

  const [endereco, setEndereco] = useState<Endereco>({
    cep: '',
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    estado: '',
  });

  const [instalacao, setInstalacao] = useState<Instalacao>({
    numeroUC: '',
    numeroUCLegado: '',
    numeroConcessionariaOriginal: '',
    distribuidora: '',
    consumoMedioKwh: '',
  });

  // ─── Convergência Fatia 2 (04/06/2026) — fetch convite + OTP handlers ─
  // Carrega ?conv=<token> e travia o wizard pra modo custeado. Defesa
  // LGPD: backend só retorna sufixos + nome do convidado.
  useEffect(() => {
    if (!conviteToken) return;
    fetch(`${API_URL}/publico/convites/${conviteToken}`)
      .then(async (r) => {
        if (!r.ok) {
          const data = await r.json().catch(() => ({}));
          throw new Error(data?.message || 'Convite inválido ou expirado.');
        }
        return r.json();
      })
      .then((data: any) => {
        if (data?.valido === false) {
          setConviteErro(data?.motivo || 'Convite inválido ou expirado.');
          return;
        }
        setConviteData({
          empresaNome: data.empresaNome ?? 'empresa cooperada',
          nomeConvidado: data.nomeConvidado ?? '',
          telefoneSufixo: data.telefoneSufixo ?? '',
          convenioId: data.convenioId,
          permiteSemUc: data.permiteSemUc ?? false,
        });
        if (data.nomeConvidado) {
          setPessoais((p) => ({ ...p, nome: data.nomeConvidado }));
        }
        setTipoCobranca('CUSTEADA');
        if (data.convenioId) setConvenioCusteioId(data.convenioId);
      })
      .catch((err) => {
        setConviteErro(err?.message ?? 'Erro ao validar convite.');
      });
  }, [conviteToken]);

  async function solicitarOtp() {
    if (!conviteToken) return;
    setOtpErro('');
    setOtpLoading(true);
    setOtpEtapa('solicitando');
    try {
      const r = await fetch(`${API_URL}/publico/convites/${conviteToken}/solicitar-otp`, { method: 'POST' });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.message?.mensagem ?? data?.message ?? 'Erro ao solicitar código');
      setOtpEtapa('codigo-enviado');
    } catch (err: any) {
      setOtpErro(err?.message ?? 'Erro ao solicitar código.');
      setOtpEtapa('aguardando');
    } finally {
      setOtpLoading(false);
    }
  }

  async function validarOtp() {
    if (!conviteToken) return;
    if (otpCodigo.replace(/\D/g, '').length !== 6) {
      setOtpErro('Código deve ter 6 dígitos.');
      return;
    }
    setOtpErro('');
    setOtpLoading(true);
    try {
      const r = await fetch(`${API_URL}/publico/convites/${conviteToken}/validar-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo: otpCodigo.replace(/\D/g, '') }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.message?.mensagem ?? data?.message ?? 'Código inválido');
      setOtpEtapa('validado');
    } catch (err: any) {
      setOtpErro(err?.message ?? 'Código inválido.');
    } finally {
      setOtpLoading(false);
    }
  }

  // ─── Tarifa dinâmica por distribuidora (BUG-11-002) ─────
  const [tarifaKwh, setTarifaKwh] = useState(0);

  useEffect(() => {
    const concParam = instalacao.distribuidora && instalacao.distribuidora !== 'Outra'
      ? `?concessionaria=${encodeURIComponent(instalacao.distribuidora)}`
      : '';
    fetch(`${API_URL}/motor-proposta/tarifa-concessionaria/atual${concParam}`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.tusdNova && data?.teNova) {
          setTarifaKwh(Number(data.tusdNova) + Number(data.teNova));
        }
      })
      .catch(() => {});
  }, [instalacao.distribuidora]);

  // ─── Helpers ─────────────────────────────────────────────

  function updatePessoais(field: keyof DadosPessoais, value: string) {
    setPessoais({ ...pessoais, [field]: value });
  }

  function updateEndereco(field: keyof Endereco, value: string) {
    setEndereco({ ...endereco, [field]: value });
  }

  function updateInstalacao(field: keyof Instalacao, value: string) {
    setInstalacao({ ...instalacao, [field]: value });
  }

  // ─── OCR Upload ──────────────────────────────────────────

  async function handleOcrUpload(file: File) {
    setOcrLoading(true);
    setOcrErro('');
    setOcrMotivoRecuperavel(false);
    setOcrSucesso(false);

    try {
      const formData = new FormData();
      formData.append('fatura', file);

      const res = await fetch(`${API_URL}/publico/processar-fatura-ocr`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (data.sucesso && data.dados) {
        setOcrDados(data.dados);
        setOcrSucesso(true);

        // Pre-fill pessoais
        if (data.dados.nome) setPessoais((p) => ({ ...p, nome: data.dados.nome }));
        if (data.dados.cpf) {
          setPessoais((p) => ({ ...p, cpf: formatarCPF(data.dados.cpf) }));
        }

        // Pre-fill endereco
        if (data.dados.endereco || data.dados.bairro || data.dados.cidade) {
          setEndereco((e) => ({
            ...e,
            logradouro: data.dados.endereco || e.logradouro,
            bairro: data.dados.bairro || e.bairro,
            cidade: data.dados.cidade || e.cidade,
            estado: data.dados.estado || e.estado,
            cep: data.dados.cep ? formatarCEP(data.dados.cep) : e.cep,
          }));
        }

        // Pre-fill instalacao — D-novo-OCR-UC-PREFILL (05/06):
        // Usa mapper puro (web/lib/ocr-mapping.ts) com prioridade
        // canônico (numero) → legado (numeroUC) → dígitos-do-original
        // (numeroConcessionariaOriginal). Resolve faturas EDP-ES atuais
        // que só trazem o número em formato com pontos — antes o form
        // ficava vazio e quebrava o golden path do convite.
        const ucMapeada = mapearOcrParaInstalacao({
          numero: data.dados.numero,
          numeroUC: data.dados.numeroUC,
          numeroConcessionariaOriginal: data.dados.numeroConcessionariaOriginal,
        });
        if (ucMapeada.numeroUC) {
          setInstalacao((i) => ({
            ...i,
            numeroUC: ucMapeada.numeroUC,
            numeroUCLegado: ucMapeada.numeroUCLegado || i.numeroUCLegado,
            numeroConcessionariaOriginal:
              ucMapeada.numeroConcessionariaOriginal || i.numeroConcessionariaOriginal,
          }));
        }
        if (data.dados.distribuidora) setInstalacao((i) => ({ ...i, distribuidora: mapearDistribuidoraOcr(data.dados.distribuidora) }));
        if (data.dados.consumoMedioKwh) setInstalacao((i) => ({ ...i, consumoMedioKwh: String(data.dados.consumoMedioKwh) }));

        // Historico
        if (data.dados.historicoConsumo?.length > 0) {
          setHistoricoConsumo(data.dados.historicoConsumo);
        }

        // Detectar créditos injetados — fluxo especial
        if (data.dados.temCreditosInjetados || (data.dados.energiaInjetadaKwh && data.dados.energiaInjetadaKwh > 0)) {
          setCreditosInjetados(true);
        }
      } else {
        // D-novo-OCR-RESILIENCIA (05/06/2026) — backend retorna `motivo` categorizado.
        // Recuperáveis (Anthropic ocupada / timeout / rate-limit) → NÃO cai em modo
        // manual: usuário pode reupload a mesma fatura em alguns segundos.
        // Terminais (truncated / JSON inválido / unknown) → vai pra modo manual.
        const motivoRecuperavel = ['anthropic-overload', 'anthropic-rate-limit', 'anthropic-server', 'timeout'].includes(data.motivo);
        setOcrErro(data.mensagem || 'Nao foi possivel ler automaticamente.');
        setOcrMotivoRecuperavel(motivoRecuperavel);
        if (!motivoRecuperavel) {
          setModoManual(true);
          setFaturaArquivo(file);
        }
      }
    } catch {
      setOcrErro('Erro ao processar fatura.');
      setOcrMotivoRecuperavel(false);
      setModoManual(true);
      setFaturaArquivo(file);
    } finally {
      setOcrLoading(false);
    }
  }

  // ─── CEP lookup ──────────────────────────────────────────

  async function buscarCEP(cep: string) {
    const nums = cep.replace(/\D/g, '');
    if (nums.length !== 8) return;
    setBuscandoCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${nums}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setEndereco({
          ...endereco,
          cep,
          logradouro: data.logradouro || endereco.logradouro,
          bairro: data.bairro || endereco.bairro,
          cidade: data.localidade || endereco.cidade,
          estado: data.uf || endereco.estado,
        });
      }
    } catch {
      // silently fail
    } finally {
      setBuscandoCep(false);
    }
  }

  // ─── Navigation ──────────────────────────────────────────

  // Convergência Fatia 2 (04/06/2026) — modoManual NÃO pula mais a etapa
  // de UC (D-novo-CAD-MODO-MANUAL-NAV fechado). Wizard agora SEMPRE passa
  // pela etapa 2 (numeroUC obrigatório em REAL — fecha D-novo-CAD-UC-FALSA).
  function avancar() {
    setErro('');
    setStep(step + 1);
  }
  function pular() { setErro(''); setStep(step + 1); }
  function voltar() {
    setErro('');
    setStep(step - 1);
  }

  // ─── Simulacao ───────────────────────────────────────────

  function calcularSimulacao() {
    const consumo = Number(instalacao.consumoMedioKwh) || 0;
    const contaAtual = Math.round(consumo * tarifaKwh * 100) / 100;
    // Fonte do percentual: plano selecionado → /desconto-padrao → 0.20 (este último só se planos vazio)
    const descontoPlano = planoSelecionado
      ? Number(planoSelecionado.descontoBase) / 100
      : descontoPercentual;
    const economia = Math.round(contaAtual * descontoPlano * 100) / 100;
    const contaCoopereBR = Math.round((contaAtual - economia) * 100) / 100;
    const creditosKwhMensal = Math.round(consumo * descontoPlano);
    return {
      contaAtual,
      contaCoopereBR,
      economiaMensal: economia,
      economiaAnual: Math.round(economia * 12 * 100) / 100,
      creditosKwhMensal,
    };
  }

  // ─── Submit ──────────────────────────────────────────────

  async function handleSubmit() {
    // Convergência Fatia 2 — gate UNIFICADO via NEXT_PUBLIC_AMBIENTE_REAL
    // (espelha o backend isAmbienteReal). Legacy NEXT_PUBLIC_MODO_TESTE
    // ainda respeitado pra compatibilidade.
    const modoTeste = ehModoTeste || process.env.NEXT_PUBLIC_MODO_TESTE === 'true';
    if (!modoTeste) {
      if (!pessoais.nome || !pessoais.cpf || !pessoais.email || !pessoais.telefone) {
        setErro('Preencha todos os dados pessoais obrigatórios.');
        return;
      }
      if (!aceitouTermos) {
        setErro('Voce precisa aceitar os termos de adesao.');
        return;
      }
      // D-FISCAL-2.4.3 — em modo custeio, plano é dispensado (override no backend pra "Custeado por convênio")
      if (tipoCobranca === 'CUSTEADA') {
        if (!convenioCusteioId) {
          setErro('Selecione a empresa cooperada pagadora para continuar.');
          return;
        }
      } else if (planos.length > 0 && !planoSelecionadoId) {
        setErro('Selecione um plano para continuar.');
        return;
      }
    } else {
      if (!pessoais.nome || !pessoais.cpf || !pessoais.email || !pessoais.telefone) {
        console.warn('[modoTeste] Dados pessoais incompletos — submit permitido');
      }
    }
    setErro('');
    setLoading(true);

    try {
      const tenant = searchParams.get('tenant') ?? process.env.NEXT_PUBLIC_COOPERATIVA_ID;
      const payload: Record<string, unknown> = {
        nome: pessoais.nome.trim(),
        cpf: pessoais.cpf,
        email: pessoais.email.trim(),
        telefone: pessoais.telefone,
        endereco: {
          cep: endereco.cep.replace(/\D/g, ''),
          logradouro: endereco.logradouro,
          numero: endereco.numero,
          complemento: endereco.complemento,
          bairro: endereco.bairro,
          cidade: endereco.cidade,
          estado: endereco.estado,
        },
        instalacao: {
          numeroUC: instalacao.numeroUC,
          numeroUCLegado: instalacao.numeroUCLegado || undefined,
          numeroConcessionariaOriginal: instalacao.numeroConcessionariaOriginal || undefined,
          distribuidora: instalacao.distribuidora,
          consumoMedioKwh: Number(instalacao.consumoMedioKwh) || 0,
        },
        planoSelecionado: planoSelecionado?.cooperTokenAtivo ? 'FATURA_CHEIA_TOKEN' : 'DESCONTO_DIRETO',
        planoId: planoSelecionado?.id || undefined,
        cooperativaId: tenant || undefined,
        aceitaClube,
      };

      // D-FISCAL-2.4.3 — Caso 1 custeio: convenioCusteioId vai pro backend e força plano custeado + vínculo.
      if (tipoCobranca === 'CUSTEADA' && convenioCusteioId) {
        payload.convenioCusteioId = convenioCusteioId;
      }

      // Convergência Fatia 2 — quando veio via convite custeio, propaga
      // token + origem=CONVITE_PUBLICO + permiteSemUc + consentimentoDocs.
      if (conviteToken && conviteData) {
        payload.token = conviteToken;
        payload.origem = 'CONVITE_PUBLICO';
        if (conviteData.permiteSemUc) {
          payload.permiteSemUc = true;
        }
      }
      if (consentimentoDocs) {
        payload.consentimentoDocs = true;
      }

      // Sprint Convênio-Token-Cooperado (20/06/2026) — slice GD como DADO.
      if (jaRecebeCreditosGd) {
        payload.jaRecebeCreditosGd = true;
        if (fornecedorGdAtual.trim()) {
          payload.fornecedorGdAtual = fornecedorGdAtual.trim();
        }
      }

      // No fluxo ?conv= NÃO há indicador MLM (decisão Luciano: convite custeio
      // não dispara MLM). codigoRef só vale fora do convite.
      if (refCode && !conviteToken) {
        payload.codigoRef = refCode;
      }

      if (valorUltimaFatura) {
        payload.valorUltimaFatura = Number(valorUltimaFatura) || 0;
      }

      if (historicoConsumo.length > 0) {
        payload.historicoConsumo = historicoConsumo.map(h => ({
          mesAno: h.mesAno,
          consumoKwh: h.consumoKwh,
          valorRS: h.valorRS,
        }));
      }

      // Enviar arquivo da fatura como base64 (modo manual)
      if (faturaArquivo) {
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve((reader.result as string).split(',')[1]);
          reader.readAsDataURL(faturaArquivo);
        });
        payload.faturaBase64 = base64;
        payload.faturaNome = faturaArquivo.name;
        payload.faturaTipo = faturaArquivo.type;
      }

      // Sprint Hardening Tenant-Spoof (20/06/2026) — tenant via query param
      // sempre. Backend valida existência + ativo + descarta body.cooperativaId.
      const tenantQs = tenant ? `?tenant=${encodeURIComponent(tenant)}` : '';
      const res = await fetch(`${API_URL}/publico/cadastro-web${tenantQs}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Erro ao enviar cadastro');
      setSucesso(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao enviar. Tente novamente.';
      setErro(message);
    } finally {
      setLoading(false);
    }
  }

  // ─── Confirmar contato — lead com créditos injetados ──────
  async function handleConfirmarContatoCreditos() {
    setCreditosLoading(true);
    setErro('');

    try {
      // Sprint Hardening Tenant-Spoof (20/06/2026) — tenant via query param.
      const tenant = searchParams.get('tenant') ?? process.env.NEXT_PUBLIC_COOPERATIVA_ID;
      const payload: Record<string, unknown> = {
        nome: pessoais.nome.trim() || 'Não informado',
        cpf: pessoais.cpf || '00000000000',
        email: pessoais.email.trim() || 'nao@informado.com',
        telefone: pessoais.telefone || '0000000000',
        endereco: {
          cep: endereco.cep.replace(/\D/g, '') || '',
          logradouro: endereco.logradouro || '',
          numero: endereco.numero || '',
          complemento: endereco.complemento || '',
          bairro: endereco.bairro || ocrDados.bairro || '',
          cidade: endereco.cidade || ocrDados.cidade || '',
          estado: endereco.estado || ocrDados.estado || '',
        },
        instalacao: (() => {
          // D-novo-OCR-UC-PREFILL (05/06) — fallback consistente com mapper:
          // se o usuário não preencheu, usa mesma prioridade canônico → legado
          // → dígitos-do-original (em vez do fallback antigo só pra `numeroUC`).
          const fallback = mapearOcrParaInstalacao({
            numero: ocrDados.numero,
            numeroUC: ocrDados.numeroUC,
            numeroConcessionariaOriginal: ocrDados.numeroConcessionariaOriginal,
          });
          return {
            numeroUC: instalacao.numeroUC || fallback.numeroUC || '',
            numeroUCLegado: instalacao.numeroUCLegado || fallback.numeroUCLegado || undefined,
            numeroConcessionariaOriginal:
              instalacao.numeroConcessionariaOriginal ||
              fallback.numeroConcessionariaOriginal ||
              undefined,
            distribuidora: instalacao.distribuidora || mapearDistribuidoraOcr(ocrDados.distribuidora) || '',
            consumoMedioKwh: Number(instalacao.consumoMedioKwh) || ocrDados.consumoMedioKwh || 0,
          };
        })(),
        temCreditosInjetados: true,
        // FIX A (Frente 2 vitrines mínimas, 01/07/2026) — a tela especial de
        // créditos injetados é intrinsecamente "já recebe créditos GD" (foi o
        // OCR que detectou). Persistir pra o motor roteador M48 classificar
        // corretamente como A_MIGRACAO ou AMBIGUO_ADMIN e notificar admin.
        jaRecebeCreditosGd: true,
        dadosOcr: {
          energiaFornecidaKwh: ocrDados.energiaFornecidaKwh || 0,
          energiaInjetadaKwh: ocrDados.energiaInjetadaKwh || 0,
          saldoCreditosKwh: ocrDados.saldoCreditosKwh || 0,
          valorCompensadoReais: ocrDados.valorCompensadoReais || 0,
          valorTotalFatura: ocrDados.totalAPagar || 0,
        },
      };

      if (fornecedorGdAtual.trim()) {
        payload.fornecedorGdAtual = fornecedorGdAtual.trim();
      }

      if (refCode) {
        payload.codigoRef = refCode;
      }

      const tenantQs = tenant ? `?tenant=${encodeURIComponent(tenant)}` : '';
      const res = await fetch(`${API_URL}/publico/cadastro-web${tenantQs}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Erro ao enviar');
      setCreditosEnviado(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao enviar. Tente novamente.';
      setErro(message);
    } finally {
      setCreditosLoading(false);
    }
  }

  // ─── Enviar docs depois (marca pendencia) ────────────────

  async function marcarPendenciaDocumentos() {
    try {
      // Sprint Hardening Tenant-Spoof (20/06/2026) — tenant via query param.
      const tenant = searchParams.get('tenant') ?? process.env.NEXT_PUBLIC_COOPERATIVA_ID;
      const tenantQs = tenant ? `?tenant=${encodeURIComponent(tenant)}` : '';
      await fetch(`${API_URL}/publico/cadastro-web${tenantQs}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: pessoais.nome.trim(),
          cpf: pessoais.cpf,
          email: pessoais.email.trim(),
          telefone: pessoais.telefone,
          endereco: { cep: endereco.cep.replace(/\D/g, ''), logradouro: endereco.logradouro, numero: endereco.numero, complemento: endereco.complemento, bairro: endereco.bairro, cidade: endereco.cidade, estado: endereco.estado },
          instalacao: { numeroUC: instalacao.numeroUC, numeroUCLegado: instalacao.numeroUCLegado || undefined, numeroConcessionariaOriginal: instalacao.numeroConcessionariaOriginal || undefined, distribuidora: instalacao.distribuidora, consumoMedioKwh: Number(instalacao.consumoMedioKwh) || 0 },
          planoSelecionado: planoSelecionado?.cooperTokenAtivo ? 'FATURA_CHEIA_TOKEN' : 'DESCONTO_DIRETO',
          aceitaClube,
          pendenciaDocumentos: true,
        }),
      });
    } catch {
      // best effort
    }
    setEnviarDepois(true);
  }

  // ─── Render steps ────────────────────────────────────────

  function renderStep0() {
    const tenantParam = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('tenant') : null;
    const refParam = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('ref') : null;
    const semUcHref = `/cadastro/sem-uc${tenantParam ? `?tenant=${encodeURIComponent(tenantParam)}${refParam ? `&ref=${encodeURIComponent(refParam)}` : ''}` : ''}`;
    return (
      <div className="space-y-4">
        {/* Banner Bloco C — link pro cadastro SEM_UC */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900">
          Sem conta de luz no seu nome? <a href={semUcHref} className="underline font-semibold">Quero ser apenas Indicador (MLM/Tokens) →</a>
        </div>

        {/* Upload fatura section */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
          <h3 className="font-semibold text-gray-800 flex items-center gap-2">
            <FileText className="h-5 w-5 text-amber-600" /> Sua conta de luz
          </h3>
          <p className="text-sm text-gray-600">
            Tenha sua fatura em maos (PDF salvo ou foto). O sistema tentara ler os dados automaticamente.
          </p>
          <div className="bg-amber-100 border border-amber-300 rounded-md p-3 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-800">
              Caso o sistema nao consiga extrair os dados, nossa equipe entrara em contato para ajudar.
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleOcrUpload(file);
            }}
          />

          {ocrLoading ? (
            <div className="flex items-center justify-center gap-2 py-4 text-green-700">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm font-medium">Analisando sua fatura...</span>
            </div>
          ) : ocrSucesso ? (
            <div className="bg-green-50 border border-green-200 rounded-md p-3 flex items-center gap-2">
              <Check className="h-4 w-4 text-green-600" />
              <span className="text-sm text-green-800">Fatura lida com sucesso! Campos preenchidos automaticamente.</span>
            </div>
          ) : (
            <>
              {ocrErro && !modoManual && (
                <div
                  className={`border rounded-md p-3 text-sm ${
                    ocrMotivoRecuperavel
                      ? 'bg-amber-50 border-amber-200 text-amber-800'
                      : 'bg-red-50 border-red-200 text-red-700'
                  }`}
                >
                  {ocrErro}
                  {ocrMotivoRecuperavel && (
                    <span className="block mt-1 text-xs text-amber-700">
                      Clique abaixo pra reenviar a mesma fatura.
                    </span>
                  )}
                </div>
              )}
              {!modoManual && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full gap-2 border-dashed border-2 border-amber-300 hover:border-amber-400 hover:bg-amber-50 py-6"
                >
                  <Upload className="h-5 w-5 text-amber-600" />
                  <span>{ocrMotivoRecuperavel ? 'Tentar enviar de novo' : 'Enviar foto ou PDF da fatura'}</span>
                </Button>
              )}
            </>
          )}
        </div>

        {/* Modo manual: mensagem amigável + campos simplificados */}
        {modoManual && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
            <p className="text-sm text-blue-800 font-medium">
              Nao foi possivel ler automaticamente. Preencha os dados essenciais abaixo para continuarmos.
            </p>
            <div className="flex items-start gap-2 bg-blue-100 border border-blue-300 rounded-md p-3">
              <FileText className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
              <p className="text-xs text-blue-700">
                Nossa equipe recebera seu arquivo e finalizara o cadastro. Voce sera contatado em breve.
              </p>
            </div>
          </div>
        )}

        <div className="border-t pt-4">
          <p className="text-xs text-gray-500 mb-3">
            {ocrSucesso ? 'Confira e ajuste os dados se necessario:' : modoManual ? 'Preencha os dados essenciais:' : 'Ou preencha manualmente:'}
          </p>
        </div>

        <div>
          <Label htmlFor="nome">Nome completo *</Label>
          <Input
            id="nome"
            placeholder="Seu nome completo"
            value={pessoais.nome}
            onChange={(e) => updatePessoais('nome', e.target.value)}
            className="h-10"
          />
        </div>
        <div>
          <Label htmlFor="cpf">CPF *</Label>
          <Input
            id="cpf"
            placeholder="000.000.000-00"
            value={pessoais.cpf}
            onChange={(e) => updatePessoais('cpf', formatarCPF(e.target.value))}
            className="h-10"
          />
        </div>
        <div>
          <Label htmlFor="email">Email *</Label>
          <Input
            id="email"
            type="email"
            placeholder="seu@email.com"
            value={pessoais.email}
            onChange={(e) => updatePessoais('email', e.target.value)}
            className="h-10"
          />
        </div>
        <div>
          <Label htmlFor="telefone">Telefone / WhatsApp *</Label>
          <Input
            id="telefone"
            placeholder="(27) 99999-9999"
            value={pessoais.telefone}
            onChange={(e) => updatePessoais('telefone', formatarTelefone(e.target.value))}
            className="h-10"
          />
        </div>

        {/* Campos extras no modo manual — UC + consumo + valor */}
        {modoManual && (
          <>
            <div className="border-t pt-4">
              <p className="text-xs text-gray-500 mb-3">Dados da sua conta de luz:</p>
            </div>
            <div>
              <Label htmlFor="numeroUC-manual">Numero da instalacao (UC) *</Label>
              <Input
                id="numeroUC-manual"
                placeholder="Numero que consta na conta de luz"
                value={instalacao.numeroUC}
                onChange={(e) => updateInstalacao('numeroUC', e.target.value)}
                className="h-10"
              />
              <p className="text-xs text-gray-500 mt-1">
                Encontre este numero no canto superior da sua conta de luz.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="consumo-manual">Consumo ultimo mes (kWh) *</Label>
                <Input
                  id="consumo-manual"
                  type="number"
                  placeholder="Ex: 350"
                  min="1"
                  value={instalacao.consumoMedioKwh}
                  onChange={(e) => updateInstalacao('consumoMedioKwh', e.target.value)}
                  className="h-10"
                />
              </div>
              <div>
                <Label htmlFor="valor-manual">Valor da fatura (R$)</Label>
                <Input
                  id="valor-manual"
                  type="number"
                  placeholder="Ex: 280"
                  min="0"
                  step="0.01"
                  value={valorUltimaFatura}
                  onChange={(e) => setValorUltimaFatura(e.target.value)}
                  className="h-10"
                />
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  function renderStep1() {
    return (
      <div className="space-y-4">
        {ocrSucesso && (
          <div className="bg-green-50 border border-green-200 rounded-md p-2 flex items-center gap-2 text-sm text-green-700">
            <Check className="h-4 w-4" /> Dados lidos da sua fatura
          </div>
        )}
        <div>
          <Label htmlFor="cep">CEP *</Label>
          <div className="relative">
            <Input
              id="cep"
              placeholder="29000-000"
              value={endereco.cep}
              onChange={(e) => {
                const formatted = formatarCEP(e.target.value);
                updateEndereco('cep', formatted);
                if (formatted.replace(/\D/g, '').length === 8) {
                  buscarCEP(formatted);
                }
              }}
              className="h-10"
            />
            {buscandoCep && (
              <Loader2 className="absolute right-3 top-2.5 h-5 w-5 animate-spin text-green-600" />
            )}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <Label htmlFor="logradouro">Logradouro *</Label>
            <Input
              id="logradouro"
              placeholder="Rua, Av..."
              value={endereco.logradouro}
              onChange={(e) => updateEndereco('logradouro', e.target.value)}
              className="h-10"
            />
          </div>
          <div>
            <Label htmlFor="numero">Numero *</Label>
            <Input
              id="numero"
              placeholder="123"
              value={endereco.numero}
              onChange={(e) => updateEndereco('numero', e.target.value)}
              className="h-10"
            />
          </div>
        </div>
        <div>
          <Label htmlFor="complemento">Complemento</Label>
          <Input
            id="complemento"
            placeholder="Apto, bloco..."
            value={endereco.complemento}
            onChange={(e) => updateEndereco('complemento', e.target.value)}
            className="h-10"
          />
        </div>
        <div>
          <Label htmlFor="bairro">Bairro *</Label>
          <Input
            id="bairro"
            placeholder="Bairro"
            value={endereco.bairro}
            onChange={(e) => updateEndereco('bairro', e.target.value)}
            className="h-10"
          />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <Label htmlFor="cidade">Cidade *</Label>
            <Input
              id="cidade"
              placeholder="Cidade"
              value={endereco.cidade}
              onChange={(e) => updateEndereco('cidade', e.target.value)}
              className="h-10"
            />
          </div>
          <div>
            <Label htmlFor="estado">UF *</Label>
            <Input
              id="estado"
              placeholder="ES"
              maxLength={2}
              value={endereco.estado}
              onChange={(e) => updateEndereco('estado', e.target.value.toUpperCase())}
              className="h-10"
            />
          </div>
        </div>
      </div>
    );
  }

  function renderStep2() {
    return (
      <div className="space-y-4">
        {ocrSucesso && (
          <div className="bg-green-50 border border-green-200 rounded-md p-2 flex items-center gap-2 text-sm text-green-700">
            <Check className="h-4 w-4" /> Dados lidos da sua fatura
          </div>
        )}
        <div>
          <Label htmlFor="numeroUC">Numero da instalacao (UC) *</Label>
          <Input
            id="numeroUC"
            placeholder="Numero como aparece na sua fatura"
            value={instalacao.numeroUC}
            onChange={(e) => updateInstalacao('numeroUC', e.target.value)}
            className="h-10"
          />
          <p className="text-xs text-gray-500 mt-1">
            O numero da sua fatura. Aceitamos o formato com pontos da EDP-ES (ex: 0.000.512.828.054-91) ou o formato antigo de 10 digitos. Se subiu a fatura, ja preenchemos pra voce.
          </p>
        </div>
        <div>
          <Label htmlFor="numeroUCLegado">Numero antigo da EDP — opcional</Label>
          <Input
            id="numeroUCLegado"
            placeholder="Ex: 160085263 (9 digitos)"
            value={instalacao.numeroUCLegado}
            onChange={(e) => updateInstalacao('numeroUCLegado', e.target.value)}
            className="h-10"
          />
          <p className="text-xs text-gray-500 mt-1">
            <strong>Preencha SO se a EDP ja te enviou um numero antigo de 9 digitos</strong> (carta ou documento oficial pra listas de compensacao GD/SCEE). Esse numero NAO esta na sua fatura nova — voce nao precisa procurar.
          </p>
        </div>
        <div>
          <Label htmlFor="numeroConcessionariaOriginal">Numero exato impresso na fatura — opcional</Label>
          <Input
            id="numeroConcessionariaOriginal"
            placeholder="0.000.512.828.054-91"
            maxLength={50}
            value={instalacao.numeroConcessionariaOriginal}
            onChange={(e) => updateInstalacao('numeroConcessionariaOriginal', e.target.value)}
            className="h-10"
          />
          <p className="text-xs text-gray-500 mt-1">
            Opcional. Copia do formato com pontuacao/hifen exatamente como aparece. Se subiu a fatura, ja preenchemos pra voce.
          </p>
        </div>
        <div>
          <Label htmlFor="distribuidora">Distribuidora *</Label>
          <select
            id="distribuidora"
            value={instalacao.distribuidora}
            onChange={(e) => updateInstalacao('distribuidora', e.target.value)}
            className="flex h-10 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="">Selecione a distribuidora</option>
            {DISTRIBUIDORAS.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="consumoMedio">Consumo medio mensal (kWh) *</Label>
          <Input
            id="consumoMedio"
            type="number"
            placeholder="Ex: 350"
            min="1"
            value={instalacao.consumoMedioKwh}
            onChange={(e) => updateInstalacao('consumoMedioKwh', e.target.value)}
            className="h-10"
          />
          <p className="text-xs text-gray-500 mt-1">
            Veja o consumo medio nos ultimos 12 meses na sua conta de luz.
          </p>
        </div>

        {/* Historico de consumo chart */}
        {historicoConsumo.length > 0 && (
          <div className="bg-gray-50 rounded-lg p-4 mt-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Historico de consumo (12 meses)</h4>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={historicoConsumo.slice(-12)} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="mesAno" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip
                  formatter={(value) => [`${value} kWh`, 'Consumo']}
                  labelStyle={{ fontSize: 12 }}
                />
                <Bar dataKey="consumoKwh" fill="#16a34a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    );
  }

  function renderStep3() {
    const sim = calcularSimulacao();

    return (
      <div className="space-y-5">
        {/* 4a. Resumo compacto */}
        <div className="bg-gray-50 rounded-lg p-4 space-y-2">
          <h3 className="font-semibold text-gray-800 text-sm">Seus dados</h3>
          <div className="grid grid-cols-2 gap-1 text-sm">
            <div><span className="text-gray-500">Nome:</span> {pessoais.nome || '—'}</div>
            <div><span className="text-gray-500">Email:</span> {pessoais.email || '—'}</div>
            <div><span className="text-gray-500">UC:</span> {instalacao.numeroUC || '—'}</div>
            <div><span className="text-gray-500">Distribuidora:</span> {instalacao.distribuidora || '—'}</div>
          </div>
        </div>

        {/* 4b. Simulacao de economia — escondida no modo custeio (D-FISCAL-2.4.3) */}
        {tipoCobranca === 'PROPRIA' && Number(instalacao.consumoMedioKwh) > 0 && (
          <div className="space-y-3">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
              <Zap className="h-4 w-4 text-green-600" /> Simulacao de economia
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                <p className="text-xs text-red-600 font-medium mb-1">Conta atual</p>
                <p className="text-xl font-bold text-red-700">{formatarMoeda(sim.contaAtual)}</p>
                <p className="text-xs text-red-500">por mes</p>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                <p className="text-xs text-green-600 font-medium mb-1">Com CoopereBR</p>
                <p className="text-xl font-bold text-green-700">{formatarMoeda(sim.contaCoopereBR)}</p>
                <p className="text-xs text-green-500">por mes</p>
              </div>
            </div>

            <div className="bg-gradient-to-r from-green-600 to-emerald-500 rounded-lg p-4 text-center text-white">
              {planoSelecionado?.cooperTokenAtivo ? (
                <>
                  <p className="text-sm font-medium opacity-90">Voce recebe</p>
                  <p className="text-2xl font-bold">{sim.creditosKwhMensal} créditos kWh/mês</p>
                  <p className="text-sm opacity-80 mt-1">{sim.creditosKwhMensal * 12} créditos kWh por ano</p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium opacity-90">Voce economiza</p>
                  <p className="text-2xl font-bold">{formatarMoeda(sim.economiaMensal)}/mes</p>
                  <p className="text-sm opacity-80 mt-1">{formatarMoeda(sim.economiaAnual)} por ano</p>
                </>
              )}
            </div>

            <div className="bg-gray-50 rounded-lg p-3">
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={[
                  { label: 'Conta atual', valor: sim.contaAtual },
                  { label: 'Com CoopereBR', valor: sim.contaCoopereBR },
                ]} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(value) => [formatarMoeda(Number(value)), 'Valor']} />
                  <Bar dataKey="valor" radius={[6, 6, 0, 0]}>
                    <Cell fill="#ef4444" />
                    <Cell fill="#16a34a" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-gray-400 mt-2 text-center">
              *Simulação baseada na tarifa média da sua distribuidora. Valores reais podem variar.
            </p>
          </div>
        )}

        {/* D-FISCAL-2.4.3 — Tipo de cobrança (radio + selector custeio) */}
        {conveniosCusteio.length > 0 && (
          <div className="space-y-3 rounded-xl border-2 border-blue-200 bg-blue-50 p-4">
            <h3 className="font-semibold text-blue-900 text-sm">Tipo de cobrança</h3>
            <p className="text-xs text-blue-800 leading-relaxed">
              Sua energia é paga por uma empresa cooperada? Se sim, selecione-a abaixo. Você não terá cobrança — a empresa cuida disso.
            </p>
            <div className="space-y-2">
              <label className="flex items-start gap-2 cursor-pointer rounded-lg bg-white border border-blue-200 p-3 hover:border-blue-400">
                <input
                  type="radio"
                  name="tipoCobranca"
                  value="PROPRIA"
                  checked={tipoCobranca === 'PROPRIA'}
                  onChange={() => {
                    setTipoCobranca('PROPRIA');
                    setConvenioCusteioId('');
                  }}
                  className="mt-0.5 w-4 h-4 accent-blue-600"
                />
                <div>
                  <span className="text-sm font-semibold text-gray-800">Eu pago minha conta</span>
                  <p className="text-xs text-gray-600 mt-0.5">Receba desconto direto na sua fatura.</p>
                </div>
              </label>
              <label className="flex items-start gap-2 cursor-pointer rounded-lg bg-white border border-blue-200 p-3 hover:border-blue-400">
                <input
                  type="radio"
                  name="tipoCobranca"
                  value="CUSTEADA"
                  checked={tipoCobranca === 'CUSTEADA'}
                  onChange={() => setTipoCobranca('CUSTEADA')}
                  className="mt-0.5 w-4 h-4 accent-blue-600"
                />
                <div className="flex-1">
                  <span className="text-sm font-semibold text-gray-800">Sou custeado por uma empresa cooperada</span>
                  <p className="text-xs text-gray-600 mt-0.5">A empresa paga o total. Você não recebe cobrança.</p>
                </div>
              </label>
            </div>
            {tipoCobranca === 'CUSTEADA' && (
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-blue-900">
                  Empresa pagadora <span className="text-red-600">*</span>
                </label>
                <select
                  value={convenioCusteioId}
                  onChange={(e) => setConvenioCusteioId(e.target.value)}
                  className="w-full rounded-md border border-blue-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">— selecione a empresa —</option>
                  {conveniosCusteio.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.empresaNome}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-blue-700">
                  Seu cadastro será criado e vinculado à empresa — você não escolhe plano nem recebe cobrança individual.
                </p>
              </div>
            )}
          </div>
        )}

        {/* 4c. Escolha do plano — esconde no modo custeado */}
        {tipoCobranca === 'PROPRIA' && planos.length > 0 && !planoSelecionadoId && (
          <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-sm text-amber-800">
            Para finalizar, escolha um plano abaixo:
          </div>
        )}
        {tipoCobranca === 'PROPRIA' && planos.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-semibold text-gray-800">Escolha seu plano</h3>
            {planos.map((p) => {
              const selected = p.id === planoSelecionadoId;
              const descontoPct = Number(p.descontoBase);
              const consumoNum = Number(instalacao.consumoMedioKwh) || 0;
              const economiaPreview = Math.round(consumoNum * tarifaKwh * (descontoPct / 100) * 100) / 100;
              const creditosPreview = Math.round(consumoNum * (descontoPct / 100));
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPlanoSelecionadoId(p.id)}
                  className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${
                    selected ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{p.cooperTokenAtivo ? '🪙' : '💰'}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-800">{p.nome}</span>
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                          {descontoPct}%
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        {p.cooperTokenAtivo
                          ? (consumoNum > 0
                              ? `Pague o valor cheio e receba ${creditosPreview} créditos de kWh/mês no Clube de Vantagens.`
                              : 'Pague o valor cheio e acumule CooperTokens para usar no Clube de Vantagens ou na fatura.')
                          : (consumoNum > 0
                              ? `Economize ${formatarMoeda(economiaPreview)}/mês direto na sua conta de luz.`
                              : 'Pague menos na sua conta de luz todos os meses. Desconto aplicado automaticamente.')
                        }
                      </p>
                      {p.descricao && (
                        <p className="text-xs text-gray-500 mt-1">{p.descricao}</p>
                      )}
                    </div>
                    {selected && <Check className="h-5 w-5 text-green-600 shrink-0" />}
                  </div>
                </button>
              );
            })}
          </div>
        )}
        {planos.length === 0 && (
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600">
            Nenhum plano disponível no momento — seguiremos com simulação estimada.
          </div>
        )}

        {/* Convergência Fatia 2 (04/06/2026) — Uploads opcionais (KYC).
            Só aparece no fluxo convite + OTP validado. Os arquivos vão pro
            /publico/cadastro/upload-doc (Fatia 1) e são movidos no backend
            quando cadastroWebV2 conclui (cooperados/<id>/docs/). */}
        {conviteData && (
          <div className="space-y-2 border border-amber-200 rounded-lg p-4 bg-amber-50/40">
            <h3 className="font-semibold text-amber-900 text-sm flex items-center gap-2">
              📎 Documentos (opcional — admin pode pedir depois)
            </h3>
            <p className="text-xs text-gray-600 mb-2">
              Anexe agora pra acelerar a aprovação. Tire foto direto pela câmera (mobile-friendly).
            </p>
            <div className="grid grid-cols-1 gap-2">
              {([
                { tipo: 'RG_FRENTE' as TipoUploadConvite, label: 'RG ou CNH (frente)' },
                { tipo: 'RG_VERSO' as TipoUploadConvite, label: 'RG ou CNH (verso)' },
                { tipo: 'SELFIE' as TipoUploadConvite, label: 'Selfie (foto sua agora)' },
              ]).map(({ tipo, label }) => {
                const enviado = uploadsConvite[tipo];
                return (
                  <label key={tipo} className="flex items-center gap-2 cursor-pointer text-sm">
                    <input
                      type="file"
                      accept={tipo === 'SELFIE' ? 'image/*' : 'image/*,application/pdf'}
                      capture={tipo === 'SELFIE' ? 'user' : 'environment'}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) uploadDocConvite(tipo, f);
                      }}
                      className="hidden"
                      disabled={uploadConviteLoading === tipo}
                    />
                    <span
                      className={`flex-1 inline-flex items-center justify-between border rounded px-3 py-2 ${enviado ? 'bg-green-50 border-green-300 text-green-700' : 'bg-white border-gray-300 text-gray-700'}`}
                    >
                      <span>
                        {enviado ? '✓ ' : ''}{label}
                        {uploadConviteLoading === tipo && ' (enviando...)'}
                      </span>
                      <span className="text-xs underline">
                        {enviado ? 'Trocar' : 'Anexar'}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
            {uploadConviteErro && (
              <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2 mt-2">
                {uploadConviteErro}
              </p>
            )}
          </div>
        )}

        {/* 4d. Checkboxes de termos */}
        <div className="space-y-3">
          <label className="flex items-start gap-3 p-4 border border-green-200 rounded-lg bg-green-50 cursor-pointer">
            <input
              type="checkbox"
              checked={aceitouTermos}
              onChange={(e) => setAceitouTermos(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
            />
            <span className="text-sm text-gray-700 leading-relaxed">
              Li e aceito os <span className="text-green-700 font-medium underline">termos de adesao</span> da
              cooperativa CoopereBR.
            </span>
          </label>

          <label className="flex items-start gap-3 p-4 border border-purple-200 rounded-lg bg-purple-50 cursor-pointer">
            <input
              type="checkbox"
              checked={aceitaClube}
              onChange={(e) => setAceitaClube(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
            />
            <span className="text-sm text-gray-700 leading-relaxed">
              ✨ Quero fazer parte do <span className="text-purple-700 font-medium underline">Clube de Vantagens</span> e
              aceito os termos do clube — descontos e beneficios exclusivos com parceiros!
            </span>
          </label>

          {/* Convergência Fatia 2 (04/06/2026) — consentimento LGPD pra docs
              (RG/CNH/selfie). Só aparece no fluxo convite (vai ter upload
              opcional na próxima fatia 9.x). Grava Cooperado.consentimentoDocsAceito. */}
          {conviteData && (
            <label className="flex items-start gap-3 p-4 border border-amber-200 rounded-lg bg-amber-50 cursor-pointer">
              <input
                type="checkbox"
                checked={consentimentoDocs}
                onChange={(e) => setConsentimentoDocs(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
              />
              <span className="text-sm text-gray-700 leading-relaxed">
                🛡 Autorizo o tratamento dos meus <strong>documentos pessoais</strong> (RG/CNH
                e selfie, quando enviados) pela CoopereBR <strong>exclusivamente para validação
                do cadastro cooperativo</strong>, conforme a LGPD. Posso revogar este consentimento
                a qualquer momento.
              </span>
            </label>
          )}

          {/* Sprint Convênio-Token-Cooperado (20/06/2026) — slice "recebe
              créditos GD como DADO". NÃO bloqueia o cadastro — só registra.
              Useful pra futuro fluxo de migração de cooperativa concorrente. */}
          <label className="flex items-start gap-3 p-4 border border-slate-200 rounded-lg bg-slate-50 cursor-pointer">
            <input
              type="checkbox"
              checked={jaRecebeCreditosGd}
              onChange={(e) => setJaRecebeCreditosGd(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-gray-300 text-slate-600 focus:ring-slate-500"
            />
            <span className="text-sm text-gray-700 leading-relaxed">
              ⚡ Já recebo créditos de energia (geração distribuída) de outra
              cooperativa, usina ou gerador. <span className="block text-xs text-gray-500 mt-1">
                Ex.: já participo de outra cooperativa/usina de energia. Isso{' '}
                <strong>não bloqueia</strong> seu cadastro — é só pra registro
                e pra te ajudar caso precise migrar depois.
              </span>
            </span>
          </label>
          {jaRecebeCreditosGd && (
            <div className="ml-7 -mt-2">
              <label className="block text-xs text-gray-600 mb-1">
                De qual cooperativa/usina (opcional)?
              </label>
              <input
                type="text"
                value={fornecedorGdAtual}
                onChange={(e) => setFornecedorGdAtual(e.target.value)}
                maxLength={200}
                placeholder="Ex.: Cooperativa Solar Verde / Usina Sertão"
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
              />
            </div>
          )}
        </div>

        {/* Botão modo teste removido — produção */}
      </div>
    );
  }

  // ─── Tela especial: créditos injetados ───────────────────

  if (creditosInjetados && !creditosEnviado) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex flex-col">
        <header className="py-6 px-4 text-center">
          <div className="flex items-center justify-center gap-2">
            <Sun className="h-8 w-8 text-green-600" />
            <h1 className="text-2xl font-bold text-green-700">CoopereBR</h1>
          </div>
        </header>
        <main className="flex-1 flex items-start justify-center px-4 pb-12">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="text-5xl mb-2">🌿</div>
              <CardTitle className="text-xl text-green-800">
                Sua conta ja tem energia solar!
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-600 text-sm leading-relaxed">
                Detectamos que sua Unidade Consumidora
                {ocrDados.numeroUC ? ` (UC ${ocrDados.numeroUC})` : ''} ja possui creditos de energia injetada.
                Isso significa que voce ja pode estar participando de um sistema de geracao distribuida.
              </p>
              <p className="text-gray-600 text-sm leading-relaxed">
                Para entender como a CoopereBR pode complementar ou melhorar sua situacao atual,
                um dos nossos colaboradores entrara em contato com voce em breve! 😊
              </p>
              <p className="text-gray-500 text-xs">
                Salvamos os dados da sua conta para preparar a melhor proposta para voce.
              </p>

              {ocrDados.energiaInjetadaKwh && ocrDados.energiaInjetadaKwh > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Energia injetada:</span>
                    <span className="font-medium text-green-700">{ocrDados.energiaInjetadaKwh} kWh</span>
                  </div>
                  {ocrDados.saldoCreditosKwh != null && ocrDados.saldoCreditosKwh > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Saldo de creditos:</span>
                      <span className="font-medium text-green-700">{ocrDados.saldoCreditosKwh} kWh</span>
                    </div>
                  )}
                  {ocrDados.valorCompensadoReais != null && ocrDados.valorCompensadoReais > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Valor compensado:</span>
                      <span className="font-medium text-green-700">{formatarMoeda(ocrDados.valorCompensadoReais)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Dados de contato básicos */}
              <div className="space-y-3 pt-2">
                <div>
                  <Label className="text-sm">Nome completo</Label>
                  <Input
                    value={pessoais.nome}
                    onChange={(e) => setPessoais({ ...pessoais, nome: e.target.value })}
                    placeholder="Seu nome"
                  />
                </div>
                <div>
                  <Label className="text-sm">Telefone</Label>
                  <Input
                    value={pessoais.telefone}
                    onChange={(e) => setPessoais({ ...pessoais, telefone: formatarTelefone(e.target.value) })}
                    placeholder="(27) 99999-9999"
                  />
                </div>
                <div>
                  <Label className="text-sm">Email</Label>
                  <Input
                    value={pessoais.email}
                    onChange={(e) => setPessoais({ ...pessoais, email: e.target.value })}
                    placeholder="seu@email.com"
                    type="email"
                  />
                </div>
                <div>
                  <Label className="text-sm">Quem fornece sua energia hoje? (opcional)</Label>
                  <Input
                    value={fornecedorGdAtual}
                    onChange={(e) => setFornecedorGdAtual(e.target.value)}
                    maxLength={200}
                    placeholder="Ex.: Cooperativa Solar Verde / Usina Sertão"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Nos ajuda a preparar a melhor proposta pra sua situação.
                  </p>
                </div>
              </div>

              {erro && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                  {erro}
                </div>
              )}

              <Button
                className="w-full bg-green-600 hover:bg-green-700"
                onClick={handleConfirmarContatoCreditos}
                disabled={creditosLoading}
              >
                {creditosLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  'Confirmar contato'
                )}
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  if (creditosEnviado) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex flex-col">
        <header className="py-6 px-4 text-center">
          <div className="flex items-center justify-center gap-2">
            <Sun className="h-8 w-8 text-green-600" />
            <h1 className="text-2xl font-bold text-green-700">CoopereBR</h1>
          </div>
        </header>
        <main className="flex-1 flex items-start justify-center px-4 pb-12">
          <Card className="w-full max-w-md">
            <CardContent className="text-center space-y-5 pt-8 pb-8">
              <div className="text-5xl">🌿</div>
              <h2 className="text-xl font-bold text-gray-800">
                Obrigado! Recebemos seus dados.
              </h2>
              <p className="text-gray-600 text-sm">
                Nossa equipe entrara em contato em breve para avaliar como a CoopereBR
                pode complementar a geracao distribuida da sua UC.
              </p>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-800">
                Fique tranquilo — vamos preparar uma proposta personalizada para o seu caso!
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  // ─── Success screen ──────────────────────────────────────

  if (sucesso) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex flex-col">
        <header className="py-6 px-4 text-center">
          <div className="flex items-center justify-center gap-2">
            <Sun className="h-8 w-8 text-green-600" />
            <h1 className="text-2xl font-bold text-green-700">CoopereBR</h1>
          </div>
        </header>
        <main className="flex-1 flex items-start justify-center px-4 pb-12">
          <Card className="w-full max-w-md">
            <CardContent className="text-center space-y-5 pt-8 pb-8">
              <div className="text-6xl">☀️</div>
              <h2 className="text-2xl font-bold text-gray-800">
                Bem-vindo a familia CoopereBR! 🌞
              </h2>
              <p className="text-gray-600">
                Seu cadastro foi recebido e esta em analise. Em breve entraremos em contato.
              </p>

              {nomeIndicador && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-800">
                  Voce foi indicado por <strong>{nomeIndicador}</strong> — ele ja foi notificado da sua chegada! 🎉
                </div>
              )}

              <div className="space-y-2 text-left bg-gray-50 rounded-lg p-4">
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <span className="text-green-600">✅</span> Voce ja faz parte do Clube de Vantagens
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <span className="text-green-600">✅</span> Energia limpa e economia garantida
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <span className="text-green-600">✅</span> Sem obras, sem investimento
                </div>
              </div>

              {/* Secao documentos */}
              {!docEnviado && !enviarDepois && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3 text-left">
                  <h3 className="font-semibold text-blue-800 text-sm">Um ultimo passo — Documentos</h3>
                  <p className="text-sm text-blue-700">
                    Para finalizar sua adesao, precisamos do documento do responsavel pela instalacao (RG ou CNH).
                    Isso NAO impede a conclusao do seu cadastro.
                  </p>
                  <input
                    ref={docInputRef}
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={() => setDocEnviado(true)}
                  />
                  <Button
                    type="button"
                    onClick={() => docInputRef.current?.click()}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white gap-2"
                  >
                    <Camera className="h-4 w-4" /> Enviar documentos agora
                  </Button>
                  <button
                    type="button"
                    onClick={marcarPendenciaDocumentos}
                    className="w-full text-sm text-blue-600 hover:text-blue-800 underline"
                  >
                    Enviar depois
                  </button>
                </div>
              )}

              {docEnviado && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-800 flex items-center gap-2">
                  <Check className="h-4 w-4" /> Documento recebido! Obrigado.
                </div>
              )}

              {enviarDepois && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-600">
                  Tudo certo! Enviaremos um lembrete para voce.
                </div>
              )}

              <a
                href="https://wa.me/552740421630"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
              >
                Acompanhar pelo WhatsApp →
              </a>
            </CardContent>
          </Card>
        </main>
        <footer className="py-4 text-center text-xs text-gray-400 border-t">
          CoopereBR — Cooperativa de Energia Solar
        </footer>
      </div>
    );
  }

  // ─── Main render ─────────────────────────────────────────

  const progressValue = ((step + 1) / STEPS.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex flex-col">
      {/* Header */}
      <header className="py-6 px-4 text-center">
        <div className="flex items-center justify-center gap-2">
          <Sun className="h-8 w-8 text-green-600" />
          <h1 className="text-2xl font-bold text-green-700">CoopereBR</h1>
        </div>
        <p className="text-sm text-gray-500 mt-1">Cadastro de novo cooperado</p>
        {/* Convergência Fatia 2 — badge MODO TESTE em DEV (regra 19/05). */}
        {ehModoTeste && (
          <div className="mt-2 inline-block bg-amber-100 border border-amber-300 rounded-full px-3 py-0.5 text-[10px] font-semibold text-amber-900">
            ⚠ MODO TESTE — validações relaxadas (não use em produção)
          </div>
        )}
      </header>

      {/* Main */}
      <main className="flex-1 flex items-start justify-center px-4 pb-12">
        <div className="w-full max-w-lg space-y-4">
          {/* Convergência Fatia 2 — Convite custeio: banner "convidado por empresa" */}
          {conviteData && (
            <div className="relative bg-gradient-to-r from-orange-600 to-amber-500 rounded-xl p-5 text-white shadow-lg">
              <p className="text-lg font-bold mb-1">
                🏢 Você foi convidado pela <strong>{conviteData.empresaNome}</strong>
              </p>
              <p className="text-sm text-white/90 leading-relaxed">
                Sua empresa custeia sua energia — você não paga a conta de luz dela. Complete
                o cadastro abaixo pra ativar o benefício.
              </p>
              {conviteData.permiteSemUc && (
                <p className="text-xs text-white/85 mt-2">
                  ℹ Este convite aceita cadastro <strong>sem fatura de luz própria</strong>{' '}
                  (você está vinculado ao consumo da empresa).
                </p>
              )}
            </div>
          )}

          {/* Convite inválido/expirado → erro claro + sugere voltar */}
          {conviteToken && conviteErro && (
            <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-900">
              <p className="font-semibold mb-1">Convite indisponível</p>
              <p>{conviteErro}</p>
              <p className="mt-2 text-xs">Solicite um novo convite à empresa.</p>
            </div>
          )}

          {/* OTP gate: bloqueia o wizard até validar OTP do convite */}
          {conviteData && !conviteErro && otpEtapa !== 'validado' && (
            <div className="bg-white border border-amber-300 rounded-xl p-5 space-y-3">
              <p className="text-base font-semibold text-amber-900">
                🔐 Confirme seu WhatsApp
              </p>
              <p className="text-sm text-gray-700">
                Pra garantir que é você, vamos enviar um código de 6 dígitos pro número que a empresa
                cadastrou {conviteData.telefoneSufixo ? <>(<strong>{conviteData.telefoneSufixo}</strong>)</> : ''}.
              </p>
              {otpEtapa === 'aguardando' && (
                <Button
                  onClick={solicitarOtp}
                  disabled={otpLoading}
                  className="w-full bg-amber-600 hover:bg-amber-700 text-white"
                >
                  {otpLoading ? 'Enviando...' : 'Enviar código por WhatsApp'}
                </Button>
              )}
              {otpEtapa === 'codigo-enviado' && (
                <div className="space-y-2">
                  <p className="text-xs text-gray-600">
                    Código enviado! Digite os 6 dígitos abaixo (válido por 10min).
                  </p>
                  <Input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="000000"
                    value={otpCodigo}
                    onChange={(e) => setOtpCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="text-center text-lg font-mono tracking-widest"
                  />
                  <div className="flex gap-2">
                    <Button
                      onClick={validarOtp}
                      disabled={otpLoading || otpCodigo.length !== 6}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                    >
                      {otpLoading ? 'Validando...' : 'Confirmar código'}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={solicitarOtp}
                      disabled={otpLoading}
                      className="text-xs"
                    >
                      Reenviar
                    </Button>
                  </div>
                </div>
              )}
              {otpErro && (
                <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">
                  {otpErro}
                </p>
              )}
            </div>
          )}

          {/* Banner de boas-vindas (quando veio com ?ref=) — só mostra se NÃO veio ?conv= */}
          {nomeIndicador && bannerVisivel && !conviteData && (
            <div className="relative bg-gradient-to-r from-green-600 to-emerald-500 rounded-xl p-5 text-white shadow-lg">
              <button
                onClick={() => setBannerVisivel(false)}
                className="absolute top-3 right-3 text-white/70 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
              <p className="text-lg font-bold mb-2">
                🌿 {nomeIndicador} te convidou para a CoopereBR!
              </p>
              <p className="text-sm text-white/90 leading-relaxed mb-2">
                Ao concluir seu cadastro, voce entra para um grupo exclusivo de pessoas
                que economizam energia e cuidam do planeta. ♻️
              </p>
              <p className="text-sm text-white/90 leading-relaxed mb-2">
                ✨ Voce tambem passa a fazer parte do nosso exclusivo Clube de Vantagens —
                descontos e beneficios reais com parceiros que compartilham os mesmos valores.
              </p>
              <p className="text-xs text-white/70 mt-3">
                {nomeIndicador} sera notificado que voce esta iniciando seu cadastro!
              </p>
            </div>
          )}

          {/* Convergência Fatia 2 — wizard só aparece após OTP validado (no fluxo ?conv=).
              Sem ?conv= ativo, sempre mostra (caminho legado). */}
          {(!conviteData || otpEtapa === 'validado') && !conviteErro && (
          <Card>
            {/* Badge persistente de convite */}
            {nomeIndicador && !conviteData && (
              <div className="bg-green-50 border-b border-green-100 px-4 py-2 text-sm text-green-700 flex items-center gap-2">
                🤝 Convidado por <strong>{nomeIndicador}</strong>
              </div>
            )}
            {conviteData && (
              <div className="bg-orange-50 border-b border-orange-200 px-4 py-2 text-sm text-orange-800 flex items-center gap-2">
                🏢 Custeio confirmado por <strong>{conviteData.empresaNome}</strong>
              </div>
            )}

            {/* Step indicator */}
            <CardHeader>
              <div className="flex justify-between mb-3">
                {STEPS.map((s, i) => {
                  const Icon = s.icon;
                  const isActive = i === step;
                  const isDone = i < step;
                  return (
                    <div key={i} className="flex flex-col items-center gap-1">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                          isDone
                            ? 'bg-green-600 text-white'
                            : isActive
                              ? 'bg-green-100 text-green-700 ring-2 ring-green-600'
                              : 'bg-gray-100 text-gray-400'
                        }`}
                      >
                        {isDone ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                      </div>
                      <span className={`text-xs hidden sm:block ${isActive ? 'text-green-700 font-medium' : 'text-gray-400'}`}>
                        {s.label}
                      </span>
                    </div>
                  );
                })}
              </div>
              <Progress value={progressValue} className="h-1.5" />
              <CardTitle className="mt-3">{STEPS[step].label}</CardTitle>
              <CardDescription>
                Passo {step + 1} de {STEPS.length}
              </CardDescription>
            </CardHeader>

            <CardContent>
              {step === 0 && renderStep0()}
              {step === 1 && renderStep1()}
              {step === 2 && renderStep2()}
              {step === 3 && renderStep3()}

              {erro && (
                <p className="text-sm text-red-600 text-center mt-4">{erro}</p>
              )}

              {/* Navigation buttons */}
              <div className="flex justify-between mt-6 gap-3">
                {step > 0 ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={voltar}
                    className="gap-1"
                  >
                    <ArrowLeft className="h-4 w-4" /> Voltar
                  </Button>
                ) : (
                  <div />
                )}

                {step < STEPS.length - 1 ? (
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={pular}
                      className="gap-1 text-gray-500 hover:text-gray-700"
                    >
                      Pular <SkipForward className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      onClick={avancar}
                      className="bg-green-600 hover:bg-green-700 text-white gap-1"
                    >
                      Proximo <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    onClick={handleSubmit}
                    disabled={loading}
                    className="bg-green-600 hover:bg-green-700 text-white gap-1"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>Enviar cadastro <Check className="h-4 w-4" /></>
                    )}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-xs text-gray-400 border-t">
        CoopereBR — Cooperativa de Energia Solar
      </footer>
    </div>
  );
}

export default function CadastroPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-green-600" />
      </div>
    }>
      <CadastroPageInner />
    </Suspense>
  );
}
