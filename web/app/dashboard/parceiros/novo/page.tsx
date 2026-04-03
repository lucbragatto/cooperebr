'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle } from 'lucide-react';
import api from '@/lib/api';
import Step1Dados from './steps/Step1Dados';
import Step2Usina from './steps/Step2Usina';
import Step4PlanoSaas from './steps/Step4PlanoSaas';
import Step4Confirmacao from './steps/Step4Confirmacao';

const STEP_LABELS = [
  'Dados do Parceiro',
  'Usina Solar',
  'Plano SaaS',
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

export default function NovoParceiro() {
  const router = useRouter();
  const [etapa, setEtapa] = useState(0);

  const [dadosParceiro, setDadosParceiro] = useState<Record<string, string>>({});
  const [dadosUsina, setDadosUsina] = useState<Record<string, unknown>>({});
  const [dadosPlanoSaas, setDadosPlanoSaas] = useState<Record<string, unknown>>({});

  function avancar() {
    setEtapa((e) => Math.min(3, e + 1));
  }

  async function handleAtivarParceiro() {
    // 1. Criar cooperativa
    const { data: cooperativa } = await api.post('/cooperativas', {
      ...dadosParceiro,
      tipoParceiro: dadosParceiro.tipoParceiro || 'COOPERATIVA',
    });
    const cooperativaId = cooperativa.id;

    // 2. Criar usina se configurada
    if (dadosUsina.modo === 'nova' && dadosUsina.nome) {
      await api.post('/usinas', {
        nome: dadosUsina.nome,
        potenciaKwp: Number(dadosUsina.potenciaKwp) || 0,
        cidade: dadosUsina.cidade,
        estado: dadosUsina.estado,
        distribuidora: dadosUsina.distribuidora,
        statusHomologacao: dadosUsina.statusHomologacao,
        cooperativaId,
      });
    } else if (dadosUsina.modo === 'existente' && dadosUsina.usinaId) {
      await api.put(`/usinas/${dadosUsina.usinaId}`, { cooperativaId });
    }

    // 3. Vincular plano SaaS se selecionado
    if (dadosPlanoSaas.id) {
      await api.put(`/cooperativas/${cooperativaId}`, {
        planoSaasId: dadosPlanoSaas.id,
        diaVencimentoSaas: dadosPlanoSaas.diaVencimento,
        statusSaas: dadosPlanoSaas.statusInicial,
      });
    }
  }

  function renderStep() {
    switch (etapa) {
      case 0:
        return (
          <Step1Dados
            defaultValues={dadosParceiro}
            onSubmit={(dados) => { setDadosParceiro(dados); avancar(); }}
          />
        );
      case 1:
        return (
          <Step2Usina
            defaultValues={dadosUsina}
            onSubmit={(dados) => { setDadosUsina(dados); avancar(); }}
          />
        );
      case 2:
        return (
          <Step4PlanoSaas
            defaultValues={dadosPlanoSaas}
            onSubmit={(dados) => { setDadosPlanoSaas(dados); avancar(); }}
          />
        );
      case 3:
        return (
          <Step4Confirmacao
            wizardData={{
              parceiro: dadosParceiro,
              usina: dadosUsina,
              planoSaas: dadosPlanoSaas,
            }}
            onAtivar={handleAtivarParceiro}
          />
        );
      default:
        return null;
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-neutral-800">Novo Parceiro</h1>
        <Link href="/dashboard/parceiros" className="text-sm text-neutral-500 hover:text-neutral-700">
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
