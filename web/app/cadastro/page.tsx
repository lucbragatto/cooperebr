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

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

const DISTRIBUIDORAS = [
  'EDP-ES', 'CEMIG', 'CEMAT', 'ENERGISA', 'ENEL',
  'CPFL', 'CELESC', 'EQUATORIAL', 'NEOENERGIA', 'Outra',
];

// TODO: buscar tarifa da distribuidora selecionada via API
// Tarifa EDP-ES Fev/2026 (fallback fixo)
const TARIFA_KWH = 0.78931;
const DESCONTO_PERCENTUAL = 0.15;

// ─── Masks ───────────────────────────────────────────────

function formatarCPF(valor: string): string {
  const nums = valor.replace(/\D/g, '').slice(0, 11);
  if (nums.length <= 3) return nums;
  if (nums.length <= 6) return `${nums.slice(0, 3)}.${nums.slice(3)}`;
  if (nums.length <= 9) return `${nums.slice(0, 3)}.${nums.slice(3, 6)}.${nums.slice(6)}`;
  return `${nums.slice(0, 3)}.${nums.slice(3, 6)}.${nums.slice(6, 9)}-${nums.slice(9)}`;
}

function formatarTelefone(valor: string): string {
  const nums = valor.replace(/\D/g, '').slice(0, 11);
  if (nums.length <= 2) return nums;
  if (nums.length <= 7) return `(${nums.slice(0, 2)}) ${nums.slice(2)}`;
  return `(${nums.slice(0, 2)}) ${nums.slice(2, 7)}-${nums.slice(7)}`;
}

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
  numeroUC: string;
  distribuidora: string;
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
  numeroUC?: string;
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
  const [planoSelecionado, setPlanoSelecionado] = useState<'DESCONTO_DIRETO' | 'FATURA_CHEIA_TOKEN' | ''>('');

  // OCR state
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrSucesso, setOcrSucesso] = useState(false);
  const [ocrErro, setOcrErro] = useState('');
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
    distribuidora: '',
    consumoMedioKwh: '',
  });

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

        // Pre-fill instalacao
        if (data.dados.numeroUC) setInstalacao((i) => ({ ...i, numeroUC: data.dados.numeroUC }));
        if (data.dados.distribuidora) setInstalacao((i) => ({ ...i, distribuidora: data.dados.distribuidora }));
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
        setOcrErro(data.mensagem || 'Nao foi possivel ler automaticamente.');
        setModoManual(true);
        setFaturaArquivo(file);
      }
    } catch {
      setOcrErro('Erro ao processar fatura.');
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

  function avancar() {
    setErro('');
    // No modo manual, step 0 pula direto para revisão (step 3)
    if (modoManual && step === 0) {
      setStep(3);
    } else {
      setStep(step + 1);
    }
  }
  function pular() { setErro(''); setStep(step + 1); }
  function voltar() {
    setErro('');
    // No modo manual, da revisão volta para step 0
    if (modoManual && step === 3) {
      setStep(0);
    } else {
      setStep(step - 1);
    }
  }

  // ─── Simulacao ───────────────────────────────────────────

  function calcularSimulacao() {
    const consumo = Number(instalacao.consumoMedioKwh) || 0;
    const contaAtual = Math.round(consumo * TARIFA_KWH * 100) / 100;
    const economia = Math.round(contaAtual * DESCONTO_PERCENTUAL * 100) / 100;
    const contaCoopereBR = Math.round((contaAtual - economia) * 100) / 100;
    return { contaAtual, contaCoopereBR, economiaMensal: economia, economiaAnual: Math.round(economia * 12 * 100) / 100 };
  }

  // ─── Submit ──────────────────────────────────────────────

  async function handleSubmit() {
    const modoTeste = false; // produção — validações ativas
    if (!modoTeste) {
      if (!pessoais.nome || !pessoais.cpf || !pessoais.email || !pessoais.telefone) {
        setErro('Preencha todos os dados pessoais obrigatórios.');
        return;
      }
      if (!aceitouTermos) {
        setErro('Voce precisa aceitar os termos de adesao.');
        return;
      }
      if (!planoSelecionado) {
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
          distribuidora: instalacao.distribuidora,
          consumoMedioKwh: Number(instalacao.consumoMedioKwh) || 0,
        },
        planoSelecionado: planoSelecionado || 'DESCONTO_DIRETO',
        aceitaClube,
      };

      if (refCode) {
        payload.codigoRef = refCode;
      }

      if (valorUltimaFatura) {
        payload.valorUltimaFatura = Number(valorUltimaFatura) || 0;
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

      const res = await fetch(`${API_URL}/publico/cadastro-web`, {
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
        instalacao: {
          numeroUC: instalacao.numeroUC || ocrDados.numeroUC || '',
          distribuidora: instalacao.distribuidora || ocrDados.distribuidora || '',
          consumoMedioKwh: Number(instalacao.consumoMedioKwh) || ocrDados.consumoMedioKwh || 0,
        },
        temCreditosInjetados: true,
        dadosOcr: {
          energiaFornecidaKwh: ocrDados.energiaFornecidaKwh || 0,
          energiaInjetadaKwh: ocrDados.energiaInjetadaKwh || 0,
          saldoCreditosKwh: ocrDados.saldoCreditosKwh || 0,
          valorCompensadoReais: ocrDados.valorCompensadoReais || 0,
          valorTotalFatura: ocrDados.totalAPagar || 0,
        },
      };

      if (refCode) {
        payload.codigoRef = refCode;
      }

      const res = await fetch(`${API_URL}/publico/cadastro-web`, {
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
      await fetch(`${API_URL}/publico/cadastro-web`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: pessoais.nome.trim(),
          cpf: pessoais.cpf,
          email: pessoais.email.trim(),
          telefone: pessoais.telefone,
          endereco: { cep: endereco.cep.replace(/\D/g, ''), logradouro: endereco.logradouro, numero: endereco.numero, complemento: endereco.complemento, bairro: endereco.bairro, cidade: endereco.cidade, estado: endereco.estado },
          instalacao: { numeroUC: instalacao.numeroUC, distribuidora: instalacao.distribuidora, consumoMedioKwh: Number(instalacao.consumoMedioKwh) || 0 },
          planoSelecionado: planoSelecionado || 'DESCONTO_DIRETO',
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
    return (
      <div className="space-y-4">
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
                <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-700">
                  {ocrErro}
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
                  <span>Enviar foto ou PDF da fatura</span>
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
            placeholder="Numero que consta na conta de luz"
            value={instalacao.numeroUC}
            onChange={(e) => updateInstalacao('numeroUC', e.target.value)}
            className="h-10"
          />
          <p className="text-xs text-gray-500 mt-1">
            Encontre este numero no canto superior da sua conta de luz.
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
              <option key={d} value={d}>{d}</option>
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

        {/* 4b. Simulacao de economia */}
        {Number(instalacao.consumoMedioKwh) > 0 && (
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
              <p className="text-sm font-medium opacity-90">Voce economiza</p>
              <p className="text-2xl font-bold">{formatarMoeda(sim.economiaMensal)}/mes</p>
              <p className="text-sm opacity-80 mt-1">{formatarMoeda(sim.economiaAnual)} por ano</p>
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

        {/* 4c. Escolha do plano */}
        {!planoSelecionado && (
          <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-sm text-amber-800">
            Para finalizar, escolha um plano abaixo:
          </div>
        )}
        <div className="space-y-3">
          <h3 className="font-semibold text-gray-800">Escolha seu plano</h3>

          <button
            type="button"
            onClick={() => setPlanoSelecionado('DESCONTO_DIRETO')}
            className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${
              planoSelecionado === 'DESCONTO_DIRETO'
                ? 'border-green-500 bg-green-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl">💰</span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-800">Desconto Direto</span>
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Mais popular</span>
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  Pague menos na sua conta de luz todos os meses. Desconto aplicado automaticamente.
                </p>
              </div>
              {planoSelecionado === 'DESCONTO_DIRETO' && (
                <Check className="h-5 w-5 text-green-600 shrink-0" />
              )}
            </div>
          </button>

          <button
            type="button"
            onClick={() => setPlanoSelecionado('FATURA_CHEIA_TOKEN')}
            className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${
              planoSelecionado === 'FATURA_CHEIA_TOKEN'
                ? 'border-green-500 bg-green-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl">🪙</span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-800">Acumular Tokens</span>
                  <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">Clube de Vantagens</span>
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  Pague o valor cheio e acumule CooperTokens para usar no Clube de Vantagens ou na fatura quando quiser.
                </p>
              </div>
              {planoSelecionado === 'FATURA_CHEIA_TOKEN' && (
                <Check className="h-5 w-5 text-green-600 shrink-0" />
              )}
            </div>
          </button>
        </div>

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
      </header>

      {/* Main */}
      <main className="flex-1 flex items-start justify-center px-4 pb-12">
        <div className="w-full max-w-lg space-y-4">
          {/* Banner de boas-vindas (quando veio com ?ref=) */}
          {nomeIndicador && bannerVisivel && (
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

          <Card>
            {/* Badge persistente de convite */}
            {nomeIndicador && (
              <div className="bg-green-50 border-b border-green-100 px-4 py-2 text-sm text-green-700 flex items-center gap-2">
                🤝 Convidado por <strong>{nomeIndicador}</strong>
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
                    {!(modoManual && step === 0) && (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={pular}
                        className="gap-1 text-gray-500 hover:text-gray-700"
                      >
                        Pular <SkipForward className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      type="button"
                      onClick={avancar}
                      className="bg-green-600 hover:bg-green-700 text-white gap-1"
                    >
                      {modoManual && step === 0 ? 'Continuar' : 'Proximo'} <ArrowRight className="h-4 w-4" />
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
