'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle } from 'lucide-react';
import api from '@/lib/api';
import Step6Asaas from './steps/Step6Asaas';
import Step7Banco from './steps/Step7Banco';
import Step8Documentos from './steps/Step8Documentos';
import Step9Revisao from './steps/Step9Revisao';

const STEP_LABELS = [
  'Dados do Parceiro',
  'Usina',
  'Lista de Espera',
  'Plano SaaS',
  'Modelo Cobranca',
  'Asaas',
  'Banco',
  'Documentos',
  'Revisao',
];

function Stepper({ etapa }: { etapa: number }) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-2 mb-6">
      {STEP_LABELS.map((label, i) => {
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
            {i < STEP_LABELS.length - 1 && <div className="w-4 h-px bg-neutral-200 mx-0.5" />}
          </div>
        );
      })}
    </div>
  );
}

// Placeholder component for steps 1-5 (to be replaced by the other agent's implementation)
function StepPlaceholder({ step, label }: { step: number; label: string }) {
  return (
    <div className="p-8 text-center border-2 border-dashed border-neutral-300 rounded-lg">
      <p className="text-neutral-400 text-sm">Passo {step}: {label}</p>
      <p className="text-xs text-neutral-300 mt-2">Implementado em outro modulo</p>
    </div>
  );
}

export default function NovoParceiro() {
  const router = useRouter();
  const [etapa, setEtapa] = useState(0);

  // Steps 1-5 data (to be populated by other agent's components)
  const [dadosParceiro, setDadosParceiro] = useState<any>({
    nome: '', tipoParceiro: 'COOPERATIVA', cnpj: '', email: '', telefone: '',
    endereco: '', numero: '', bairro: '', cidade: '', estado: '', cep: '',
  });
  const [dadosUsina, setDadosUsina] = useState<any>({
    nome: '', potenciaKwp: '', cidade: '', estado: '', statusHomologacao: 'CADASTRADA',
  });
  const [dadosListaEspera, setDadosListaEspera] = useState<any>({ membros: 0 });
  const [dadosPlanoSaas, setDadosPlanoSaas] = useState<any>({ id: '', nome: '', valor: 0 });
  const [dadosModeloCobranca, setDadosModeloCobranca] = useState<any>({ tipo: '', detalhes: '' });

  // Steps 6-9 data
  const [dadosAsaas, setDadosAsaas] = useState({
    temAsaas: null as boolean | null,
    asaasApiKey: '',
    asaasAmbiente: 'SANDBOX' as 'SANDBOX' | 'PRODUCAO',
    asaasConfigurarDepois: false,
  });

  const [dadosBanco, setDadosBanco] = useState({
    bb: false,
    sicoob: false,
    nenhum: false,
    bbClientId: '',
    bbClientSecret: '',
    bbConta: '',
    bbAgencia: '',
    bbAmbiente: 'SANDBOX' as 'SANDBOX' | 'PRODUCAO',
    sicoobClientId: '',
    sicoobCertificado: null as File | null,
    sicoobCertificadoNome: '',
    sicoobConta: '',
    sicoobCooperativa: '',
  });

  const [dadosDocumentos, setDadosDocumentos] = useState({
    temModeloProprio: null as boolean | null,
    modeloContratoId: '',
    modeloProcuracaoId: '',
    modeloContratoNome: '',
    modeloProcuracaoNome: '',
    modeloContratoVariaveis: [] as string[],
    modeloProcuracaoVariaveis: [] as string[],
  });

  function updateAsaas(partial: Partial<typeof dadosAsaas>) {
    setDadosAsaas((prev) => ({ ...prev, ...partial }));
  }
  function updateBanco(partial: Partial<typeof dadosBanco>) {
    setDadosBanco((prev) => ({ ...prev, ...partial }));
  }
  function updateDocumentos(partial: Partial<typeof dadosDocumentos>) {
    setDadosDocumentos((prev) => ({ ...prev, ...partial }));
  }

  async function handleAtivarParceiro() {
    // 1. Criar cooperativa
    const { data: cooperativa } = await api.post('/cooperativas', {
      ...dadosParceiro,
      tipoParceiro: dadosParceiro.tipoParceiro || 'COOPERATIVA',
    });
    const cooperativaId = cooperativa.id;

    // 2. Criar usina se configurada
    if (dadosUsina.nome) {
      await api.post('/usinas', {
        ...dadosUsina,
        potenciaKwp: Number(dadosUsina.potenciaKwp) || 0,
        cooperativaId,
      });
    }

    // 3. Configurar Asaas se tem API key
    if (dadosAsaas.temAsaas && dadosAsaas.asaasApiKey) {
      await api.post('/asaas/config', {
        apiKey: dadosAsaas.asaasApiKey,
        ambiente: dadosAsaas.asaasAmbiente,
      });
    }

    // 4. Configurar banco se selecionado
    if (dadosBanco.bb && dadosBanco.bbClientId) {
      await api.post('/integracao-bancaria/config', {
        banco: 'BB',
        ambiente: dadosBanco.bbAmbiente,
        clientId: dadosBanco.bbClientId,
        clientSecret: dadosBanco.bbClientSecret,
        agencia: dadosBanco.bbAgencia,
        conta: dadosBanco.bbConta,
        cooperativaId,
      });
    }
    if (dadosBanco.sicoob && dadosBanco.sicoobClientId) {
      await api.post('/integracao-bancaria/config', {
        banco: 'SICOOB',
        clientId: dadosBanco.sicoobClientId,
        clientSecret: '',
        conta: dadosBanco.sicoobConta,
        cooperativaId,
      });
    }

    // 5. Vincular plano SaaS se selecionado
    if (dadosPlanoSaas.id) {
      await api.put(`/cooperativas/${cooperativaId}`, {
        planoSaasId: dadosPlanoSaas.id,
      });
    }
  }

  function renderStep() {
    switch (etapa) {
      case 0: return <StepPlaceholder step={1} label="Dados do Parceiro" />;
      case 1: return <StepPlaceholder step={2} label="Usina" />;
      case 2: return <StepPlaceholder step={3} label="Lista de Espera" />;
      case 3: return <StepPlaceholder step={4} label="Plano SaaS" />;
      case 4: return <StepPlaceholder step={5} label="Modelo de Cobranca" />;
      case 5: return <Step6Asaas data={dadosAsaas} onChange={updateAsaas} />;
      case 6: return <Step7Banco data={dadosBanco} onChange={updateBanco} />;
      case 7: return <Step8Documentos data={dadosDocumentos} onChange={updateDocumentos} />;
      case 8:
        return (
          <Step9Revisao
            wizardData={{
              parceiro: dadosParceiro,
              usina: dadosUsina,
              listaEspera: dadosListaEspera,
              planoSaas: dadosPlanoSaas,
              modeloCobranca: dadosModeloCobranca,
              asaas: dadosAsaas,
              banco: dadosBanco,
              documentos: dadosDocumentos,
            }}
            onAtivar={handleAtivarParceiro}
          />
        );
      default: return null;
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

      {etapa < 8 && (
        <div className="flex justify-between mt-6">
          <button
            onClick={() => setEtapa((e) => Math.max(0, e - 1))}
            disabled={etapa === 0}
            className="px-5 py-2.5 text-sm font-medium text-neutral-600 bg-white border border-neutral-300 rounded-lg hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Anterior
          </button>
          <button
            onClick={() => setEtapa((e) => Math.min(8, e + 1))}
            className="px-5 py-2.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700"
          >
            {etapa === 7 ? 'Revisar' : 'Proximo'}
          </button>
        </div>
      )}
    </div>
  );
}
