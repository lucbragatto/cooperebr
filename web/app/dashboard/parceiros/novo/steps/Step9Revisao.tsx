'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

interface WizardData {
  // Steps 1-5 (parceiro, usina, lista espera, plano SaaS, modelo cobranca)
  parceiro?: { nome?: string; tipoParceiro?: string; cidade?: string; estado?: string; cnpj?: string; email?: string; telefone?: string; endereco?: string; bairro?: string; cep?: string };
  usina?: { nome?: string; potenciaKwp?: number; cidade?: string; estado?: string; statusHomologacao?: string };
  listaEspera?: { membros?: number };
  planoSaas?: { nome?: string; valor?: number };
  modeloCobranca?: { tipo?: string; detalhes?: string };
  // Steps 6-9
  asaas: {
    temAsaas: boolean | null;
    asaasApiKey: string;
    asaasAmbiente: string;
    asaasConfigurarDepois: boolean;
  };
  banco: {
    bb: boolean;
    sicoob: boolean;
    nenhum: boolean;
    bbClientId: string;
    bbClientSecret: string;
    bbConta: string;
    bbAgencia: string;
    bbAmbiente: string;
    sicoobClientId: string;
    sicoobConta: string;
    sicoobCooperativa: string;
  };
  documentos: {
    temModeloProprio: boolean | null;
    modeloContratoId: string;
    modeloProcuracaoId: string;
    modeloContratoNome: string;
    modeloProcuracaoNome: string;
  };
}

interface Step9Props {
  wizardData: WizardData;
  onAtivar: () => Promise<void>;
}

const mensagensProgresso = [
  'Criando parceiro...',
  'Configurando usina...',
  'Alocando membros da lista de espera...',
  'Configurando plano SaaS...',
  'Salvando integracoes...',
  'Parceiro ativado com sucesso!',
];

function ResumoItem({ label, valor, status }: { label: string; valor: string; status?: 'ok' | 'pendente' | 'none' }) {
  return (
    <div className="flex items-start justify-between py-2.5 border-b border-neutral-100 last:border-0">
      <span className="text-sm font-medium text-neutral-600">{label}</span>
      <span className="text-sm text-neutral-800 text-right flex items-center gap-2">
        {status === 'ok' && <span className="text-green-500">&#10003;</span>}
        {status === 'pendente' && <span className="text-amber-500">&#9888;</span>}
        {valor}
      </span>
    </div>
  );
}

export default function Step9Revisao({ wizardData, onAtivar }: Step9Props) {
  const router = useRouter();
  const [salvando, setSalvando] = useState(false);
  const [etapaSalvamento, setEtapaSalvamento] = useState(0);
  const [concluido, setConcluido] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { parceiro, usina, listaEspera, planoSaas, modeloCobranca, asaas, banco, documentos } = wizardData;

  // Status computados
  const asaasStatus = asaas.temAsaas && asaas.asaasApiKey ? 'ok' : 'pendente';
  const bancoStatus = banco.bb || banco.sicoob ? 'ok' : 'pendente';
  const docsStatus = documentos.modeloContratoId || documentos.modeloProcuracaoId ? 'ok' : 'pendente';

  async function handleAtivar() {
    setSalvando(true);
    setEtapaSalvamento(0);

    for (let i = 0; i < mensagensProgresso.length - 1; i++) {
      setEtapaSalvamento(i);
      await new Promise((r) => setTimeout(r, 800));
    }

    try {
      await onAtivar();
      setEtapaSalvamento(mensagensProgresso.length - 1);
      setConcluido(true);
      dispararConfetti();
    } catch {
      setSalvando(false);
    }
  }

  async function dispararConfetti() {
    try {
      const confetti = (await import('canvas-confetti')).default;
      const duracao = 3000;
      const fim = Date.now() + duracao;

      const frame = () => {
        confetti({
          particleCount: 3,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: ['#22c55e', '#16a34a', '#4ade80', '#fbbf24', '#3b82f6'],
        });
        confetti({
          particleCount: 3,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: ['#22c55e', '#16a34a', '#4ade80', '#fbbf24', '#3b82f6'],
        });

        if (Date.now() < fim) requestAnimationFrame(frame);
      };
      frame();
    } catch {
      // canvas-confetti not available, skip
    }
  }

  if (concluido) {
    return (
      <div className="text-center py-12 space-y-6">
        <div className="text-6xl">&#x1F389;</div>
        <h2 className="text-2xl font-bold text-green-700">Parceiro ativado com sucesso!</h2>
        <p className="text-neutral-500">Todas as configuracoes foram salvas.</p>
        <button
          onClick={() => router.push('/dashboard/parceiros')}
          className="px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition"
        >
          Ir para lista de parceiros
        </button>
      </div>
    );
  }

  if (salvando) {
    return (
      <div className="text-center py-12 space-y-6">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-green-200 border-t-green-600" />
        <p className="text-lg font-medium text-neutral-700">
          {mensagensProgresso[etapaSalvamento]}
        </p>
        <div className="w-64 mx-auto bg-neutral-200 rounded-full h-2">
          <div
            className="bg-green-500 h-2 rounded-full transition-all duration-500"
            style={{ width: `${((etapaSalvamento + 1) / mensagensProgresso.length) * 100}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-neutral-800">Revisao e Confirmacao</h2>
      <p className="text-sm text-neutral-500">Confira o resumo de tudo que foi configurado.</p>

      <div className="bg-white border border-neutral-200 rounded-lg p-4 divide-y divide-neutral-100">
        <ResumoItem
          label="Parceiro"
          valor={parceiro?.nome ? `${parceiro.nome} (${parceiro.tipoParceiro || 'COOPERATIVA'}) - ${parceiro.cidade || ''}/${parceiro.estado || ''}` : 'A configurar'}
        />
        <ResumoItem
          label="Usina"
          valor={usina?.nome ? `${usina.nome} (${usina.potenciaKwp} kWp) - ${usina.statusHomologacao || 'CADASTRADA'}` : 'Nao configurada'}
          status={usina?.nome ? 'ok' : 'pendente'}
        />
        <ResumoItem
          label="Lista de espera"
          valor={listaEspera?.membros ? `${listaEspera.membros} membros serao alocados` : 'Sem membros em espera'}
        />
        <ResumoItem
          label="Plano SaaS"
          valor={planoSaas?.nome ? `${planoSaas.nome} - R$${planoSaas.valor?.toFixed(2)}/mes` : 'A configurar'}
          status={planoSaas?.nome ? 'ok' : 'pendente'}
        />
        <ResumoItem
          label="Modelo de cobranca"
          valor={modeloCobranca?.tipo ? `${modeloCobranca.tipo} - ${modeloCobranca.detalhes || ''}` : 'A configurar'}
        />
        <ResumoItem
          label="Asaas"
          valor={asaasStatus === 'ok' ? 'Configurado' : 'Pendente'}
          status={asaasStatus}
        />
        <ResumoItem
          label="Banco"
          valor={
            banco.bb && banco.sicoob
              ? 'BB + Sicoob'
              : banco.bb
              ? 'Banco do Brasil'
              : banco.sicoob
              ? 'Sicoob'
              : 'Nao configurado'
          }
          status={bancoStatus}
        />
        <ResumoItem
          label="Documentos"
          valor={
            documentos.temModeloProprio === true
              ? 'Modelo proprio'
              : documentos.modeloContratoId
              ? 'Modelo padrao'
              : 'A configurar'
          }
          status={docsStatus}
        />
      </div>

      <button
        onClick={handleAtivar}
        className="w-full py-4 bg-green-600 text-white text-lg font-bold rounded-xl hover:bg-green-700 transition shadow-lg shadow-green-200"
      >
        &#x1F680; Ativar Parceiro
      </button>
      <p className="text-xs text-center text-neutral-400">
        Voce podera editar qualquer configuracao depois no perfil do parceiro
      </p>
    </div>
  );
}
