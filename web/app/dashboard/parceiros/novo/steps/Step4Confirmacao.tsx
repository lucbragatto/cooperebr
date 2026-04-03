'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface WizardData {
  parceiro: Record<string, unknown>;
  usina: Record<string, unknown>;
  planoSaas: Record<string, unknown>;
}

interface Step4Props {
  wizardData: WizardData;
  onAtivar: () => Promise<void>;
}

function ResumoItem({ label, valor, status }: { label: string; valor: string; status?: 'ok' | 'pendente' }) {
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

const mensagensProgresso = [
  'Criando parceiro...',
  'Configurando usina...',
  'Salvando plano SaaS...',
  'Parceiro criado com sucesso!',
];

export default function Step4Confirmacao({ wizardData, onAtivar }: Step4Props) {
  const router = useRouter();
  const [salvando, setSalvando] = useState(false);
  const [etapaSalvamento, setEtapaSalvamento] = useState(0);
  const [concluido, setConcluido] = useState(false);
  const [erro, setErro] = useState('');

  const { parceiro, usina, planoSaas } = wizardData;

  async function handleAtivar() {
    setSalvando(true);
    setErro('');
    setEtapaSalvamento(0);

    for (let i = 0; i < mensagensProgresso.length - 1; i++) {
      setEtapaSalvamento(i);
      await new Promise((r) => setTimeout(r, 600));
    }

    try {
      await onAtivar();
      setEtapaSalvamento(mensagensProgresso.length - 1);
      setConcluido(true);
      dispararConfetti();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao criar parceiro';
      setErro(message);
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
        <h2 className="text-2xl font-bold text-green-700">Parceiro criado com sucesso!</h2>
        <p className="text-neutral-500">
          O parceiro pode agora acessar o painel e configurar sua cooperativa.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => router.push('/dashboard/parceiros')}
            className="px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition"
          >
            Ir para lista de parceiros
          </button>
          <button
            onClick={() => router.push('/dashboard/parceiros/novo')}
            className="px-6 py-3 bg-white text-neutral-700 border border-neutral-300 rounded-lg font-medium hover:bg-neutral-50 transition"
          >
            Criar outro parceiro
          </button>
        </div>
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
      <h2 className="text-lg font-semibold text-neutral-800">Confirmação</h2>
      <p className="text-sm text-neutral-500">Confira os dados antes de criar o parceiro.</p>

      <div className="bg-white border border-neutral-200 rounded-lg p-4 divide-y divide-neutral-100">
        <ResumoItem
          label="Parceiro"
          valor={
            parceiro?.nome
              ? `${parceiro.nome} (${parceiro.tipoParceiro || 'COOPERATIVA'})${parceiro.cidade ? ` — ${parceiro.cidade}/${parceiro.estado}` : ''}`
              : 'A configurar'
          }
          status={parceiro?.nome ? 'ok' : 'pendente'}
        />
        <ResumoItem
          label="CNPJ"
          valor={(parceiro?.cnpj as string) || 'Não informado'}
        />
        <ResumoItem
          label="Email"
          valor={(parceiro?.email as string) || 'Não informado'}
        />
        <ResumoItem
          label="Usina"
          valor={
            usina?.modo === 'nova'
              ? `${usina.nome} (${usina.potenciaKwp} kWp) — ${usina.statusHomologacao || 'Nova'}`
              : usina?.modo === 'existente'
              ? 'Usina existente vinculada'
              : 'Sem usina (configurar depois)'
          }
          status={usina?.modo ? 'ok' : 'pendente'}
        />
        <ResumoItem
          label="Plano SaaS"
          valor={
            planoSaas?.nome
              ? `${planoSaas.nome} — R$${Number(planoSaas.valor || 0).toFixed(2)}/mês`
              : 'A configurar'
          }
          status={planoSaas?.nome ? 'ok' : 'pendente'}
        />
      </div>

      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-800">
          Após a criação, o parceiro poderá configurar modelo de cobrança, integrações (Asaas, banco),
          membros e documentos no wizard de configuração da cooperativa.
        </p>
      </div>

      {erro && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{erro}</p>
        </div>
      )}

      <button
        onClick={handleAtivar}
        className="w-full py-4 bg-green-600 text-white text-lg font-bold rounded-xl hover:bg-green-700 transition shadow-lg shadow-green-200"
      >
        Criar Parceiro
      </button>
      <p className="text-xs text-center text-neutral-400">
        Todas as demais configurações poderão ser feitas depois
      </p>
    </div>
  );
}
