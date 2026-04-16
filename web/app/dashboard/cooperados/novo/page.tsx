'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CheckCircle } from 'lucide-react';
import { useTipoParceiro } from '@/hooks/useTipoParceiro';
import Step1Fatura, { type Step1Data } from './steps/Step1Fatura';
import Step2Dados, { type Step2Data } from './steps/Step2Dados';
import Step3Simulacao, { type Step3Data } from './steps/Step3Simulacao';
import Step4Proposta, { type Step4Data } from './steps/Step4Proposta';
import Step5Documentos, { type Step5Data } from './steps/Step5Documentos';
import Step6Contrato, { type Step6Data } from './steps/Step6Contrato';
import Step7Alocacao from './steps/Step7Alocacao';

// ─── Stepper ────────────────────────────────────────────────────────────────────

function Stepper({ etapa, labels }: { etapa: number; labels: string[] }) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-2 mb-6">
      {labels.map((label, i) => {
        const done = i < etapa;
        const active = i === etapa;
        return (
          <div key={i} className="flex items-center gap-1 shrink-0">
            <div
              className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition ${
                done
                  ? 'bg-green-600 text-white'
                  : active
                  ? 'bg-green-100 text-green-700 ring-2 ring-green-400'
                  : 'bg-neutral-100 text-neutral-400'
              }`}
            >
              {done ? <CheckCircle className="w-4 h-4" /> : i + 1}
            </div>
            <span
              className={`text-[10px] hidden sm:inline ${
                active ? 'text-green-700 font-semibold' : done ? 'text-green-600' : 'text-neutral-400'
              }`}
            >
              {label}
            </span>
            {i < labels.length - 1 && <div className="w-4 h-px bg-neutral-200 mx-0.5" />}
          </div>
        );
      })}
    </div>
  );
}

// ─── Progress Bar ───────────────────────────────────────────────────────────────

function ProgressBar({ current, total }: { current: number; total: number }) {
  const pct = ((current + 1) / total) * 100;
  return (
    <div className="w-full bg-neutral-200 rounded-full h-1.5 mb-6">
      <div className="bg-green-500 h-1.5 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────────

export default function NovoMembroWizard() {
  const { tipoMembro, tipoMembroPlural, tipoParceiro } = useTipoParceiro();
  const [etapa, setEtapa] = useState(0);

  const STEP_LABELS = [
    'Fatura',
    'Dados pessoais',
    'Simulação',
    'Proposta',
    'Documentos',
    'Contrato',
    'Alocação',
  ];

  // ─── State for each step ──────────────────────────────────────────────────────

  const [step1, setStep1] = useState<Step1Data>({
    ocr: null,
    historico: [],
    mesesSelecionados: new Set(),
    componentesMarcados: new Set(['tarifaTUSD', 'tarifaTE', 'valorBandeira', 'icms', 'pisCofins', 'contribIluminacaoPublica', 'multaJuros', 'outrosEncargos', 'descontos']),
    componentesEditados: {},
    baseDesconto: 'KWH',
  });

  const [step2, setStep2] = useState<Step2Data>({
    nomeCompleto: '',
    cpf: '',
    email: '',
    telefone: '',
    endereco: '',
    bairro: '',
    cidade: '',
    estado: '',
    cep: '',
    tipoPessoa: 'PF',
    representanteLegalNome: '',
    representanteLegalCpf: '',
    representanteLegalCargo: '',
    formaPagamento: 'BOLETO',
    codigoIndicacao: '',
    cooperadoId: '',
    ucId: '',
  });

  const [step3, setStep3] = useState<Step3Data>({
    planoSelecionadoId: '',
    descontoCustom: 0,
    simulacao: null,
    resultadoMotor: null,
  });

  const [step4, setStep4] = useState<Step4Data>({
    propostaEnviada: false,
    canalEnvio: null,
    aprovacaoPresencial: false,
    propostaAceita: false,
    propostaId: '',
  });

  const [step5, setStep5] = useState<Step5Data>({
    documentosConferidos: false,
  });

  const [step6, setStep6] = useState<Step6Data>({
    contratoGerado: false,
    statusAssinatura: 'pendente',
  });

  // ─── Update helpers ───────────────────────────────────────────────────────────

  function updateStep1(partial: Partial<Step1Data>) {
    setStep1(prev => ({ ...prev, ...partial }));

    // Pre-fill step 2 with OCR data when OCR completes.
    // Sempre sobrescreve — dados da fatura têm prioridade sobre valores anteriores.
    if (partial.ocr) {
      const ocr = partial.ocr;
      setStep2(prev => ({
        ...prev,
        nomeCompleto: ocr.titular || prev.nomeCompleto || '',
        cpf: ocr.documento || prev.cpf || '',
        endereco: ocr.enderecoInstalacao || prev.endereco || '',
        bairro: ocr.bairro || prev.bairro || '',
        cidade: ocr.cidade || prev.cidade || '',
        estado: ocr.estado || prev.estado || '',
        cep: ocr.cep || prev.cep || '',
        tipoPessoa: ocr.tipoDocumento === 'CNPJ' ? 'PJ' : 'PF',
        cooperadoId: '',
        ucId: '',
      }));
    }
  }

  function updateStep2(partial: Partial<Step2Data>) {
    setStep2(prev => ({ ...prev, ...partial }));
  }

  function updateStep3(partial: Partial<Step3Data>) {
    setStep3(prev => ({ ...prev, ...partial }));
  }

  function updateStep4(partial: Partial<Step4Data>) {
    setStep4(prev => ({ ...prev, ...partial }));
  }

  function updateStep5(partial: Partial<Step5Data>) {
    setStep5(prev => ({ ...prev, ...partial }));
  }

  function updateStep6(partial: Partial<Step6Data>) {
    setStep6(prev => ({ ...prev, ...partial }));
  }

  // ─── Validation ───────────────────────────────────────────────────────────────

  function validarEtapa(): string | null {
    switch (etapa) {
      case 0:
        if (!step1.ocr) return 'Processe a fatura antes de avançar.';
        return null;
      case 1:
        if (!step2.nomeCompleto.trim()) return 'Nome é obrigatório.';
        if (!step2.cpf.trim()) return `${step2.tipoPessoa === 'PJ' ? 'CNPJ' : 'CPF'} é obrigatório.`;
        if (!step2.email.trim()) return 'Email é obrigatório.';
        if (!step2.telefone.trim()) return 'Telefone é obrigatório.';
        if (!step2.cooperadoId) return 'Salve o cooperado antes de avançar.';
        return null;
      case 2:
        if (!step3.resultadoMotor) return 'Execute o cálculo do motor antes de avançar.';
        if (!step3.planoSelecionadoId) return 'Selecione um plano antes de avançar.';
        return null;
      case 3:
        if (!step4.propostaId) return 'Aceite a proposta antes de avançar.';
        return null;
      case 4:
        if (!step5.documentosConferidos) return 'Confirme a documentação antes de avançar.';
        return null;
      case 5:
        if (!step6.contratoGerado) return 'Gere o contrato antes de avançar.';
        return null;
      default:
        return null;
    }
  }

  const [erroValidacao, setErroValidacao] = useState('');

  function avancar() {
    const erro = validarEtapa();
    if (erro) {
      setErroValidacao(erro);
      return;
    }
    setErroValidacao('');
    setEtapa(e => Math.min(6, e + 1));
  }

  function voltar() {
    setErroValidacao('');
    setEtapa(e => Math.max(0, e - 1));
  }

  // ─── Render step ──────────────────────────────────────────────────────────────

  function renderStep() {
    switch (etapa) {
      case 0:
        return <Step1Fatura data={step1} onChange={updateStep1} tipoMembro={tipoMembro} />;
      case 1:
        return <Step2Dados data={step2} faturaData={step1} onChange={updateStep2} tipoMembro={tipoMembro} />;
      case 2:
        return <Step3Simulacao data={step3} faturaData={step1} cooperadoId={step2.cooperadoId} onChange={updateStep3} tipoMembro={tipoMembro} />;
      case 3:
        return <Step4Proposta data={step4} dadosPessoais={step2} simulacaoData={step3} onChange={updateStep4} tipoMembro={tipoMembro} />;
      case 4:
        return <Step5Documentos data={step5} cooperadoId={step2.cooperadoId} onChange={updateStep5} tipoMembro={tipoMembro} />;
      case 5:
        return <Step6Contrato data={step6} propostaId={step4.propostaId} dadosPessoais={step2} simulacaoData={step3} onChange={updateStep6} tipoMembro={tipoMembro} />;
      case 6:
        return (
          <Step7Alocacao
            dadosPessoais={step2}
            propostaData={step4}
            tipoMembro={tipoMembro}
          />
        );
      default:
        return null;
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-neutral-800">Novo {tipoMembro}</h1>
        <Link href="/dashboard/cooperados" className="text-sm text-neutral-500 hover:text-neutral-700">
          &larr; Voltar
        </Link>
      </div>

      <ProgressBar current={etapa} total={STEP_LABELS.length} />
      <Stepper etapa={etapa} labels={STEP_LABELS} />

      <div className="bg-white rounded-xl border border-neutral-200 p-6 shadow-sm">
        {renderStep()}
      </div>

      {erroValidacao && (
        <p className="text-sm text-red-600 mt-3">{erroValidacao}</p>
      )}

      {/* Navigation buttons — hidden on last step (Step7 handles its own) */}
      {etapa < 6 && (
        <div className="flex justify-between mt-6">
          <button
            onClick={voltar}
            disabled={etapa === 0}
            className="px-5 py-2.5 text-sm font-medium text-neutral-600 bg-white border border-neutral-300 rounded-lg hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Anterior
          </button>
          <button
            onClick={avancar}
            className="px-5 py-2.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700"
          >
            {etapa === 5 ? 'Finalizar' : 'Próximo'}
          </button>
        </div>
      )}
    </div>
  );
}
