'use client';

import { useState } from 'react';
import { Sun, ArrowLeft, ArrowRight, Check, Loader2, User, MapPin, Zap, FileCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

const DISTRIBUIDORAS = [
  'EDP-ES',
  'CEMIG',
  'CEMAT',
  'ENERGISA',
  'ENEL',
  'CPFL',
  'CELESC',
  'EQUATORIAL',
  'NEOENERGIA',
  'Outra',
];

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

function validarCPF(cpf: string): boolean {
  const nums = cpf.replace(/\D/g, '');
  if (nums.length !== 11) return false;
  if (/^(\d)\1+$/.test(nums)) return false;
  let soma = 0;
  for (let i = 0; i < 9; i++) soma += parseInt(nums[i]) * (10 - i);
  let resto = (soma * 10) % 11;
  if (resto === 10) resto = 0;
  if (resto !== parseInt(nums[9])) return false;
  soma = 0;
  for (let i = 0; i < 10; i++) soma += parseInt(nums[i]) * (11 - i);
  resto = (soma * 10) % 11;
  if (resto === 10) resto = 0;
  return resto === parseInt(nums[10]);
}

// ─── Types ───────────────────────────────────────────────

interface DadosPessoais {
  nome: string;
  cpf: string;
  email: string;
  telefone: string;
  dataNascimento: string;
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

const STEPS = [
  { label: 'Dados pessoais', icon: User },
  { label: 'Endereco', icon: MapPin },
  { label: 'Instalacao', icon: Zap },
  { label: 'Revisao', icon: FileCheck },
];

export default function CadastroPage() {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const [erro, setErro] = useState('');
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [aceitouTermos, setAceitouTermos] = useState(false);

  const [pessoais, setPessoais] = useState<DadosPessoais>({
    nome: '',
    cpf: '',
    email: '',
    telefone: '',
    dataNascimento: '',
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
          logradouro: data.logradouro || '',
          bairro: data.bairro || '',
          cidade: data.localidade || '',
          estado: data.uf || '',
        });
      }
    } catch {
      // silently fail — user can fill manually
    } finally {
      setBuscandoCep(false);
    }
  }

  // ─── Validation ──────────────────────────────────────────

  function validarStep(): string | null {
    if (step === 0) {
      if (!pessoais.nome.trim()) return 'Preencha o nome completo.';
      if (!validarCPF(pessoais.cpf)) return 'CPF invalido.';
      if (!pessoais.email.trim() || !pessoais.email.includes('@')) return 'Email invalido.';
      const telLimpo = pessoais.telefone.replace(/\D/g, '');
      if (telLimpo.length !== 11) return 'Telefone deve ter 11 digitos (DDD + 9 digitos).';
      if (!pessoais.dataNascimento) return 'Preencha a data de nascimento.';
    }
    if (step === 1) {
      if (endereco.cep.replace(/\D/g, '').length !== 8) return 'CEP invalido.';
      if (!endereco.logradouro.trim()) return 'Preencha o logradouro.';
      if (!endereco.numero.trim()) return 'Preencha o numero.';
      if (!endereco.bairro.trim()) return 'Preencha o bairro.';
      if (!endereco.cidade.trim()) return 'Preencha a cidade.';
      if (!endereco.estado.trim()) return 'Preencha o estado.';
    }
    if (step === 2) {
      if (!instalacao.numeroUC.trim()) return 'Preencha o numero da instalacao (UC).';
      if (!instalacao.distribuidora) return 'Selecione a distribuidora.';
      const consumo = Number(instalacao.consumoMedioKwh);
      if (!consumo || consumo <= 0) return 'Consumo medio deve ser maior que zero.';
    }
    return null;
  }

  function avancar() {
    const erroValidacao = validarStep();
    if (erroValidacao) {
      setErro(erroValidacao);
      return;
    }
    setErro('');
    setStep(step + 1);
  }

  function voltar() {
    setErro('');
    setStep(step - 1);
  }

  // ─── Submit ──────────────────────────────────────────────

  async function handleSubmit() {
    if (!aceitouTermos) {
      setErro('Voce precisa aceitar os termos de adesao.');
      return;
    }
    setErro('');
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/publico/cadastro-web`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: pessoais.nome.trim(),
          cpf: pessoais.cpf,
          email: pessoais.email.trim(),
          telefone: pessoais.telefone,
          dataNascimento: pessoais.dataNascimento,
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
            consumoMedioKwh: Number(instalacao.consumoMedioKwh),
          },
        }),
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

  // ─── Render steps ────────────────────────────────────────

  function renderStep0() {
    return (
      <div className="space-y-4">
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
        <div>
          <Label htmlFor="dataNascimento">Data de nascimento *</Label>
          <Input
            id="dataNascimento"
            type="date"
            value={pessoais.dataNascimento}
            onChange={(e) => updatePessoais('dataNascimento', e.target.value)}
            className="h-10"
          />
        </div>
      </div>
    );
  }

  function renderStep1() {
    return (
      <div className="space-y-4">
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
      </div>
    );
  }

  function renderStep3() {
    return (
      <div className="space-y-5">
        <div className="bg-gray-50 rounded-lg p-4 space-y-3">
          <h3 className="font-semibold text-gray-800 flex items-center gap-2">
            <User className="h-4 w-4 text-green-600" /> Dados pessoais
          </h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div><span className="text-gray-500">Nome:</span> {pessoais.nome}</div>
            <div><span className="text-gray-500">CPF:</span> {pessoais.cpf}</div>
            <div><span className="text-gray-500">Email:</span> {pessoais.email}</div>
            <div><span className="text-gray-500">Telefone:</span> {pessoais.telefone}</div>
            <div><span className="text-gray-500">Nascimento:</span> {pessoais.dataNascimento}</div>
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-4 space-y-3">
          <h3 className="font-semibold text-gray-800 flex items-center gap-2">
            <MapPin className="h-4 w-4 text-green-600" /> Endereco
          </h3>
          <div className="text-sm space-y-1">
            <div>{endereco.logradouro}, {endereco.numero}{endereco.complemento ? ` - ${endereco.complemento}` : ''}</div>
            <div>{endereco.bairro} - {endereco.cidade}/{endereco.estado}</div>
            <div>CEP: {endereco.cep}</div>
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-4 space-y-3">
          <h3 className="font-semibold text-gray-800 flex items-center gap-2">
            <Zap className="h-4 w-4 text-green-600" /> Dados da instalacao
          </h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div><span className="text-gray-500">UC:</span> {instalacao.numeroUC}</div>
            <div><span className="text-gray-500">Distribuidora:</span> {instalacao.distribuidora}</div>
            <div><span className="text-gray-500">Consumo medio:</span> {instalacao.consumoMedioKwh} kWh/mes</div>
          </div>
        </div>

        <label className="flex items-start gap-3 p-4 border border-green-200 rounded-lg bg-green-50 cursor-pointer">
          <input
            type="checkbox"
            checked={aceitouTermos}
            onChange={(e) => setAceitouTermos(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
          />
          <span className="text-sm text-gray-700 leading-relaxed">
            Li e aceito os <span className="text-green-700 font-medium underline">termos de adesao</span> da
            cooperativa, incluindo as regras de participacao na geracao distribuida de energia solar.
          </span>
        </label>
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
            <CardContent className="text-center space-y-4 pt-6">
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <Check className="h-8 w-8 text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-800">Cadastro enviado!</h2>
              <p className="text-gray-600">
                Recebemos seus dados. Nossa equipe vai analisar e entrar em contato
                pelo WhatsApp ou email em breve.
              </p>
              <p className="text-sm text-gray-500">
                Enquanto isso, fique atento ao seu WhatsApp para atualizacoes.
              </p>
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
        <Card className="w-full max-w-lg">
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
                <Button
                  type="button"
                  onClick={avancar}
                  className="bg-green-600 hover:bg-green-700 text-white gap-1"
                >
                  Proximo <ArrowRight className="h-4 w-4" />
                </Button>
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
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-xs text-gray-400 border-t">
        CoopereBR — Cooperativa de Energia Solar
      </footer>
    </div>
  );
}
