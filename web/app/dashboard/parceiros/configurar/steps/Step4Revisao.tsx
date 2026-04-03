'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { TipoOperacao, ConfiguracoesData } from '../page';

interface Step4Props {
  dadosEmpresa: Record<string, string>;
  tiposOperacao: TipoOperacao;
  configuracoes: ConfiguracoesData;
  onSalvar: () => Promise<void>;
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

const TIPO_LABELS: Record<string, string> = {
  usina: 'Usina própria (GD)',
  condominio: 'Condomínio (rateio)',
  empresa: 'Empresa (comercial)',
  ev: 'Carregador veicular (EV)',
};

const mensagensProgresso = [
  'Salvando dados da empresa...',
  'Configurando modelo de cobrança...',
  'Salvando integrações...',
  'Configuração concluída!',
];

export default function Step4Revisao({ dadosEmpresa, tiposOperacao, configuracoes, onSalvar }: Step4Props) {
  const router = useRouter();
  const [salvando, setSalvando] = useState(false);
  const [etapaSalvamento, setEtapaSalvamento] = useState(0);
  const [concluido, setConcluido] = useState(false);
  const [erro, setErro] = useState('');

  const tiposSelecionados = Object.entries(tiposOperacao)
    .filter(([, v]) => v)
    .map(([k]) => TIPO_LABELS[k] || k);

  const asaasStatus = configuracoes.temAsaas && configuracoes.asaasApiKey ? 'ok' : 'pendente';
  const bancoStatus = configuracoes.bb || configuracoes.sicoob ? 'ok' : 'pendente';
  const docsStatus = configuracoes.temModeloProprio !== null ? 'ok' : 'pendente';
  const cobrancaStatus = configuracoes.modeloCobranca ? 'ok' : 'pendente';

  async function handleSalvar() {
    setSalvando(true);
    setErro('');
    setEtapaSalvamento(0);

    for (let i = 0; i < mensagensProgresso.length - 1; i++) {
      setEtapaSalvamento(i);
      await new Promise((r) => setTimeout(r, 600));
    }

    try {
      await onSalvar();
      setEtapaSalvamento(mensagensProgresso.length - 1);
      setConcluido(true);
      dispararConfetti();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao salvar configurações';
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
        <h2 className="text-2xl font-bold text-green-700">Cooperativa configurada!</h2>
        <p className="text-neutral-500">Todas as configurações foram salvas com sucesso.</p>
        <button
          onClick={() => router.push('/dashboard')}
          className="px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition"
        >
          Ir para o Dashboard
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
      <h2 className="text-lg font-semibold text-neutral-800">Confirmação</h2>
      <p className="text-sm text-neutral-500">Confira o resumo das configurações antes de salvar.</p>

      <div className="bg-white border border-neutral-200 rounded-lg p-4 divide-y divide-neutral-100">
        <ResumoItem
          label="Empresa"
          valor={dadosEmpresa.nome ? `${dadosEmpresa.nome}${dadosEmpresa.cidade ? ` — ${dadosEmpresa.cidade}/${dadosEmpresa.estado}` : ''}` : 'A configurar'}
          status={dadosEmpresa.nome ? 'ok' : 'pendente'}
        />
        <ResumoItem
          label="Tipos de operação"
          valor={tiposSelecionados.join(', ') || 'Nenhum selecionado'}
          status={tiposSelecionados.length > 0 ? 'ok' : 'pendente'}
        />
        <ResumoItem
          label="Modelo de cobrança"
          valor={configuracoes.modeloCobranca || 'A configurar'}
          status={cobrancaStatus}
        />
        {(tiposOperacao.condominio) && (
          <ResumoItem
            label="Unidades"
            valor={`${configuracoes.unidades.length} unidade(s) cadastrada(s)`}
          />
        )}
        {(tiposOperacao.usina || tiposOperacao.empresa) && (
          <ResumoItem
            label="Membros"
            valor={`${configuracoes.membros.length} membro(s) adicionado(s)`}
          />
        )}
        <ResumoItem
          label="Asaas"
          valor={asaasStatus === 'ok' ? 'Configurado' : 'Pendente'}
          status={asaasStatus}
        />
        <ResumoItem
          label="Banco"
          valor={
            configuracoes.bb && configuracoes.sicoob
              ? 'BB + Sicoob'
              : configuracoes.bb
              ? 'Banco do Brasil'
              : configuracoes.sicoob
              ? 'Sicoob'
              : 'Não configurado'
          }
          status={bancoStatus}
        />
        <ResumoItem
          label="Documentos"
          valor={
            configuracoes.temModeloProprio === true
              ? 'Modelo próprio'
              : configuracoes.temModeloProprio === false
              ? 'Modelo padrão'
              : 'A configurar'
          }
          status={docsStatus}
        />
      </div>

      {erro && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{erro}</p>
        </div>
      )}

      <button
        onClick={handleSalvar}
        className="w-full py-4 bg-green-600 text-white text-lg font-bold rounded-xl hover:bg-green-700 transition shadow-lg shadow-green-200"
      >
        Salvar Configurações
      </button>
      <p className="text-xs text-center text-neutral-400">
        Você poderá editar qualquer configuração depois no painel
      </p>
    </div>
  );
}
