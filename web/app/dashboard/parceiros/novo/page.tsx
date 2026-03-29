'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle } from 'lucide-react';
import api from '@/lib/api';
import Step1Dados from './steps/Step1Dados';
import Step2Membros from './steps/Step2Membros';
import Step2Usina from './steps/Step2Usina';
import Step3Espera from './steps/Step3Espera';
import Step4PlanoSaas from './steps/Step4PlanoSaas';
import Step5Cobranca from './steps/Step5Cobranca';
import Step6Asaas from './steps/Step6Asaas';
import Step7Banco from './steps/Step7Banco';
import Step8Documentos from './steps/Step8Documentos';
import Step9Revisao from './steps/Step9Revisao';

const STEP_LABELS = [
  'Dados do Parceiro',
  'Membros',
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

export default function NovoParceiro() {
  const router = useRouter();
  const [etapa, setEtapa] = useState(0);

  // Steps 1-6 data — updated only on step submit (not per keystroke)
  const [dadosParceiro, setDadosParceiro] = useState<any>({});
  const [dadosMembros, setDadosMembros] = useState<any>({});
  const [dadosUsina, setDadosUsina] = useState<any>({});
  const [dadosListaEspera, setDadosListaEspera] = useState<any>({});
  const [dadosPlanoSaas, setDadosPlanoSaas] = useState<any>({});
  const [dadosModeloCobranca, setDadosModeloCobranca] = useState<any>({});

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

  function avancar() {
    setEtapa((e) => Math.min(9, e + 1));
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
        diaVencimentoSaas: dadosPlanoSaas.diaVencimento,
        statusSaas: dadosPlanoSaas.statusInicial,
      });
    }

    // 6. Configurar modelo de cobrança se selecionado
    if (dadosModeloCobranca.tipo) {
      await api.put(`/cooperativas/${cooperativaId}`, {
        modeloCobranca: dadosModeloCobranca.tipo,
        valorFixo: dadosModeloCobranca.valorFixo ? Number(dadosModeloCobranca.valorFixo) : undefined,
        valorKwh: dadosModeloCobranca.valorKwh ? Number(dadosModeloCobranca.valorKwh) : undefined,
        percentualDesconto: dadosModeloCobranca.percentualDesconto ? Number(dadosModeloCobranca.percentualDesconto) : undefined,
        descontoPadrao: dadosModeloCobranca.descontoPadrao ? Number(dadosModeloCobranca.descontoPadrao) : undefined,
        multaAtraso: dadosModeloCobranca.multaAtraso ? Number(dadosModeloCobranca.multaAtraso) : undefined,
        jurosDiarios: dadosModeloCobranca.jurosDiarios ? Number(dadosModeloCobranca.jurosDiarios) : undefined,
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
          <Step2Membros
            tipoParceiro={dadosParceiro.tipoParceiro || 'COOPERATIVA'}
            onSubmit={(dados) => { setDadosMembros(dados); avancar(); }}
          />
        );
      case 2:
        return (
          <Step2Usina
            defaultValues={dadosUsina}
            onSubmit={(dados) => { setDadosUsina(dados); avancar(); }}
          />
        );
      case 3:
        return (
          <Step3Espera
            onSubmit={(dados) => { setDadosListaEspera(dados); avancar(); }}
          />
        );
      case 4:
        return (
          <Step4PlanoSaas
            defaultValues={dadosPlanoSaas}
            onSubmit={(dados) => { setDadosPlanoSaas(dados); avancar(); }}
          />
        );
      case 5:
        return (
          <Step5Cobranca
            defaultValues={dadosModeloCobranca}
            onSubmit={(dados) => { setDadosModeloCobranca(dados); avancar(); }}
          />
        );
      case 6: return <Step6Asaas data={dadosAsaas} onChange={updateAsaas} />;
      case 7: return <Step7Banco data={dadosBanco} onChange={updateBanco} />;
      case 8: return <Step8Documentos data={dadosDocumentos} onChange={updateDocumentos} />;
      case 9:
        return (
          <Step9Revisao
            wizardData={{
              parceiro: dadosParceiro,
              membros: dadosMembros,
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

  // Steps 1-6 have their own "Próximo" button inside the component
  // Steps 6-8 use the external navigation buttons
  const showExternalNav = etapa >= 6 && etapa < 9;

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

      {/* Back button always available (except step 0), external Next only for steps 6-8 */}
      {etapa > 0 && (
        <div className={`flex ${showExternalNav ? 'justify-between' : 'justify-start'} mt-6`}>
          <button
            onClick={() => setEtapa((e) => Math.max(0, e - 1))}
            className="px-5 py-2.5 text-sm font-medium text-neutral-600 bg-white border border-neutral-300 rounded-lg hover:bg-neutral-50"
          >
            Anterior
          </button>
          {showExternalNav && (
            <button
              onClick={() => setEtapa((e) => Math.min(9, e + 1))}
              className="px-5 py-2.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700"
            >
              {etapa === 8 ? 'Revisar' : 'Proximo'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
