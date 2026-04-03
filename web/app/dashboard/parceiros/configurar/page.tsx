'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle } from 'lucide-react';
import api from '@/lib/api';
import Step1Empresa from './steps/Step1Empresa';
import Step2TipoOperacao from './steps/Step2TipoOperacao';
import Step3Configuracoes from './steps/Step3Configuracoes';
import Step4Revisao from './steps/Step4Revisao';

const STEP_LABELS = [
  'Dados da Empresa',
  'Tipo de Operação',
  'Configurações',
  'Confirmação',
];

function Stepper({ etapa }: { etapa: number }) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-6">
      {STEP_LABELS.map((label, i) => {
        const done = i < etapa;
        const active = i === etapa;
        return (
          <div key={i} className="flex items-center gap-1.5 shrink-0">
            <div
              className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold transition ${
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
              className={`text-xs ${
                active ? 'text-green-700 font-semibold' : done ? 'text-green-600' : 'text-neutral-400'
              }`}
            >
              {label}
            </span>
            {i < STEP_LABELS.length - 1 && <div className="w-6 h-px bg-neutral-200 mx-1" />}
          </div>
        );
      })}
    </div>
  );
}

export interface TipoOperacao {
  usina: boolean;
  condominio: boolean;
  empresa: boolean;
  ev: boolean;
}

export interface ConfiguracoesData {
  // Modelo de cobrança
  modeloCobranca: string;
  valorFixo: string;
  valorKwh: string;
  percentualDesconto: string;
  descontoPadrao: string;
  multaAtraso: string;
  jurosDiarios: string;
  // Asaas
  temAsaas: boolean | null;
  asaasApiKey: string;
  asaasAmbiente: 'SANDBOX' | 'PRODUCAO';
  asaasConfigurarDepois: boolean;
  // Banco
  bb: boolean;
  sicoob: boolean;
  nenhum: boolean;
  bbClientId: string;
  bbClientSecret: string;
  bbConta: string;
  bbAgencia: string;
  bbAmbiente: 'SANDBOX' | 'PRODUCAO';
  sicoobClientId: string;
  sicoobConta: string;
  sicoobCooperativa: string;
  // Documentos
  temModeloProprio: boolean | null;
  modeloContratoId: string;
  modeloProcuracaoId: string;
  modeloContratoNome: string;
  modeloProcuracaoNome: string;
  // Condomínio
  unidades: Array<{ numero: string; condominoNome: string }>;
  // Membros
  membros: Array<{ id?: string; nomeCompleto: string; cpf: string; email: string; isNovo: boolean }>;
}

const INITIAL_CONFIG: ConfiguracoesData = {
  modeloCobranca: '',
  valorFixo: '',
  valorKwh: '',
  percentualDesconto: '',
  descontoPadrao: '',
  multaAtraso: '2',
  jurosDiarios: '0.033',
  temAsaas: null,
  asaasApiKey: '',
  asaasAmbiente: 'SANDBOX',
  asaasConfigurarDepois: false,
  bb: false,
  sicoob: false,
  nenhum: false,
  bbClientId: '',
  bbClientSecret: '',
  bbConta: '',
  bbAgencia: '',
  bbAmbiente: 'SANDBOX',
  sicoobClientId: '',
  sicoobConta: '',
  sicoobCooperativa: '',
  temModeloProprio: null,
  modeloContratoId: '',
  modeloProcuracaoId: '',
  modeloContratoNome: '',
  modeloProcuracaoNome: '',
  unidades: [],
  membros: [],
};

export default function ConfigurarCooperativa() {
  const router = useRouter();
  const [etapa, setEtapa] = useState(0);

  const [dadosEmpresa, setDadosEmpresa] = useState<Record<string, string>>({});
  const [tiposOperacao, setTiposOperacao] = useState<TipoOperacao>({
    usina: false,
    condominio: false,
    empresa: false,
    ev: false,
  });
  const [configuracoes, setConfiguracoes] = useState<ConfiguracoesData>(INITIAL_CONFIG);

  function avancar() {
    setEtapa((e) => Math.min(3, e + 1));
  }

  function updateConfig(partial: Partial<ConfiguracoesData>) {
    setConfiguracoes((prev) => ({ ...prev, ...partial }));
  }

  async function handleSalvar() {
    // 1. Atualizar dados da cooperativa
    if (dadosEmpresa.nome) {
      await api.put('/cooperativas/minha', {
        ...dadosEmpresa,
      });
    }

    // 2. Configurar modelo de cobrança
    if (configuracoes.modeloCobranca) {
      await api.put('/cooperativas/minha', {
        modeloCobranca: configuracoes.modeloCobranca,
        valorFixo: configuracoes.valorFixo ? Number(configuracoes.valorFixo) : undefined,
        valorKwh: configuracoes.valorKwh ? Number(configuracoes.valorKwh) : undefined,
        percentualDesconto: configuracoes.percentualDesconto ? Number(configuracoes.percentualDesconto) : undefined,
        descontoPadrao: configuracoes.descontoPadrao ? Number(configuracoes.descontoPadrao) : undefined,
        multaAtraso: configuracoes.multaAtraso ? Number(configuracoes.multaAtraso) : undefined,
        jurosDiarios: configuracoes.jurosDiarios ? Number(configuracoes.jurosDiarios) : undefined,
      });
    }

    // 3. Configurar Asaas
    if (configuracoes.temAsaas && configuracoes.asaasApiKey) {
      await api.post('/asaas/config', {
        apiKey: configuracoes.asaasApiKey,
        ambiente: configuracoes.asaasAmbiente,
      });
    }

    // 4. Configurar banco
    if (configuracoes.bb && configuracoes.bbClientId) {
      await api.post('/integracao-bancaria/config', {
        banco: 'BB',
        ambiente: configuracoes.bbAmbiente,
        clientId: configuracoes.bbClientId,
        clientSecret: configuracoes.bbClientSecret,
        agencia: configuracoes.bbAgencia,
        conta: configuracoes.bbConta,
      });
    }
    if (configuracoes.sicoob && configuracoes.sicoobClientId) {
      await api.post('/integracao-bancaria/config', {
        banco: 'SICOOB',
        clientId: configuracoes.sicoobClientId,
        clientSecret: '',
        conta: configuracoes.sicoobConta,
      });
    }

    // 5. Salvar tipos de operação
    await api.put('/cooperativas/minha', {
      tiposOperacao: Object.entries(tiposOperacao)
        .filter(([, v]) => v)
        .map(([k]) => k.toUpperCase()),
    });
  }

  function renderStep() {
    switch (etapa) {
      case 0:
        return (
          <Step1Empresa
            defaultValues={dadosEmpresa}
            onSubmit={(dados) => { setDadosEmpresa(dados); avancar(); }}
          />
        );
      case 1:
        return (
          <Step2TipoOperacao
            tiposOperacao={tiposOperacao}
            onSubmit={(tipos) => { setTiposOperacao(tipos); avancar(); }}
          />
        );
      case 2:
        return (
          <Step3Configuracoes
            tiposOperacao={tiposOperacao}
            configuracoes={configuracoes}
            onChange={updateConfig}
            onSubmit={avancar}
          />
        );
      case 3:
        return (
          <Step4Revisao
            dadosEmpresa={dadosEmpresa}
            tiposOperacao={tiposOperacao}
            configuracoes={configuracoes}
            onSalvar={handleSalvar}
          />
        );
      default:
        return null;
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-neutral-800">Configurar Cooperativa</h1>
        <Link href="/dashboard" className="text-sm text-neutral-500 hover:text-neutral-700">
          &larr; Voltar
        </Link>
      </div>

      <Stepper etapa={etapa} />

      <div className="bg-white rounded-xl border border-neutral-200 p-6 shadow-sm">
        {renderStep()}
      </div>

      {etapa > 0 && etapa < 3 && (
        <div className="flex justify-start mt-6">
          <button
            onClick={() => setEtapa((e) => Math.max(0, e - 1))}
            className="px-5 py-2.5 text-sm font-medium text-neutral-600 bg-white border border-neutral-300 rounded-lg hover:bg-neutral-50"
          >
            Anterior
          </button>
        </div>
      )}
    </div>
  );
}
