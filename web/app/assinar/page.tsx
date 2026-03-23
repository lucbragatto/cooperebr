'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface PropostaData {
  id: string;
  cooperadoId: string;
  kwhContrato: number;
  descontoPercentual: number;
  economiaMensal: number;
  economiaAnual: number;
  termoAdesaoAssinadoEm: string | null;
  termoAdesaoAssinadoPor: string | null;
  procuracaoAssinadaEm: string | null;
  procuracaoAssinadaPor: string | null;
  cooperado: {
    nomeCompleto: string;
    cpf: string;
    email: string;
    telefone: string | null;
  };
}

const TERMO_ADESAO = `
TERMO DE ADESÃO À COOPERATIVA DE ENERGIA SOLAR — CoopereBR

Pelo presente instrumento, o(a) COOPERADO(A) abaixo identificado(a), declara sua livre e espontânea vontade de aderir à CoopereBR — Cooperativa de Energia Solar, nos termos do Estatuto Social e das normas regulamentares vigentes.

CLÁUSULA 1 — DO OBJETO
O presente Termo tem por objeto a adesão do Cooperado à CoopereBR para participação no rateio de energia elétrica gerada por usinas fotovoltaicas, conforme regulamentação da ANEEL (Resolução Normativa nº 482/2012 e suas alterações).

CLÁUSULA 2 — DAS OBRIGAÇÕES DO COOPERADO
I. Manter seus dados cadastrais atualizados junto à cooperativa;
II. Efetuar o pagamento mensal da cota de energia no prazo estipulado;
III. Autorizar a compensação dos créditos de energia junto à distribuidora local;
IV. Respeitar o Estatuto Social e as deliberações da Assembleia Geral.

CLÁUSULA 3 — DOS DIREITOS DO COOPERADO
I. Participar das assembleias gerais com direito a voto;
II. Receber os créditos de energia proporcionais à sua cota contratada;
III. Ter acesso a informações sobre a geração e compensação de energia;
IV. Solicitar desligamento a qualquer tempo, respeitado o prazo mínimo de permanência.

CLÁUSULA 4 — DA VIGÊNCIA
Este Termo entra em vigor na data de sua assinatura e permanece válido enquanto perdurar a relação cooperativa, podendo ser rescindido por qualquer das partes mediante notificação prévia de 30 (trinta) dias.

CLÁUSULA 5 — DO FORO
Fica eleito o foro da comarca da sede da cooperativa para dirimir quaisquer dúvidas oriundas deste instrumento.
`.trim();

const PROCURACAO = `
PROCURAÇÃO — AUTORIZAÇÃO PARA COMPENSAÇÃO DE ENERGIA

Pelo presente instrumento particular de procuração, o(a) outorgante abaixo identificado(a), cooperado(a) da CoopereBR — Cooperativa de Energia Solar, nomeia e constitui a CoopereBR como sua bastante procuradora para:

1. Representá-lo(a) perante a distribuidora de energia elétrica para fins de adesão ao sistema de compensação de energia elétrica, nos termos da Resolução Normativa ANEEL nº 482/2012 e suas alterações;

2. Solicitar a inclusão da unidade consumidora do outorgante como beneficiária dos créditos de energia gerados pelas usinas da cooperativa;

3. Realizar alterações cadastrais junto à distribuidora, exclusivamente no que se refere ao sistema de compensação de energia;

4. Acompanhar e gerir os créditos de energia compensados na fatura da unidade consumidora do outorgante;

5. Receber notificações e comunicados da distribuidora relativos à compensação de energia.

A presente procuração é outorgada em caráter irrevogável e irretratável pelo prazo de vigência do contrato de adesão à cooperativa, podendo ser revogada somente mediante comunicação formal com antecedência mínima de 30 (trinta) dias.

O outorgante declara estar ciente de que esta procuração não confere poderes para alteração de titularidade, encerramento ou qualquer outra modificação que não esteja diretamente relacionada ao sistema de compensação de energia da cooperativa.
`.trim();

export default function AssinarPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const docParam = searchParams.get('doc');

  const [proposta, setProposta] = useState<PropostaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [tipoDoc, setTipoDoc] = useState<'TERMO' | 'PROCURACAO'>(
    docParam === 'PROCURACAO' ? 'PROCURACAO' : 'TERMO',
  );
  const [nomeAssinante, setNomeAssinante] = useState('');
  const [aceite, setAceite] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [assinado, setAssinado] = useState(false);
  const [ambosAssinados, setAmbosAssinados] = useState(false);

  useEffect(() => {
    if (!token) {
      setErro('Token não informado na URL.');
      setLoading(false);
      return;
    }
    fetch(`${API_URL}/motor-proposta/documento-por-token/${token}`)
      .then(async (res) => {
        if (!res.ok) throw new Error('Não encontrado');
        return res.json();
      })
      .then((data) => {
        setProposta(data);
        setNomeAssinante(data.cooperado?.nomeCompleto ?? '');
        // Se o Termo já foi assinado, ir direto para Procuração
        if (data.termoAdesaoAssinadoEm && !data.procuracaoAssinadaEm) {
          setTipoDoc('PROCURACAO');
        }
      })
      .catch(() => setErro('Documento não encontrado ou link expirado.'))
      .finally(() => setLoading(false));
  }, [token]);

  const handleAssinar = async () => {
    if (!nomeAssinante.trim()) {
      alert('Informe seu nome completo.');
      return;
    }
    if (!aceite) {
      alert('Você precisa marcar que leu e concorda com os termos.');
      return;
    }
    setEnviando(true);
    try {
      const res = await fetch(`${API_URL}/motor-proposta/assinar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          tipoDocumento: tipoDoc,
          nomeAssinante: nomeAssinante.trim(),
          aceite: true,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Erro ao assinar');
      }
      const result = await res.json();
      setAssinado(true);
      setAmbosAssinados(result.ambosAssinados);
    } catch (err: any) {
      alert(err.message || 'Erro ao processar assinatura.');
    } finally {
      setEnviando(false);
    }
  };

  const irParaProcuracao = () => {
    setTipoDoc('PROCURACAO');
    setAceite(false);
    setAssinado(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center">
        <div className="text-gray-500 text-lg">Carregando documento...</div>
      </div>
    );
  }

  if (erro) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center">
          <div className="text-red-500 text-5xl mb-4">!</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Link inválido</h2>
          <p className="text-gray-500">{erro}</p>
        </div>
      </div>
    );
  }

  // Tela final — ambos assinados
  if (assinado && ambosAssinados) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center">
          <div className="text-green-500 text-6xl mb-4">&#10003;</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Documentos assinados!</h2>
          <p className="text-gray-500 mb-2">
            Tanto o Termo de Adesão quanto a Procuração foram assinados com sucesso.
          </p>
          <p className="text-gray-400 text-sm">
            Seu processo de adesão à CoopereBR está avançando. Em breve entraremos em contato.
          </p>
        </div>
      </div>
    );
  }

  // Tela pós-assinatura do Termo — ir para Procuração
  if (assinado && tipoDoc === 'TERMO') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center">
          <div className="text-green-500 text-6xl mb-4">&#10003;</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-3">Termo de Adesão assinado!</h2>
          <p className="text-gray-500 mb-4">
            Agora assine a Procuração para completar seu processo de adesão.
          </p>
          <button
            onClick={irParaProcuracao}
            className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            Assinar Procuração
          </button>
        </div>
      </div>
    );
  }

  // Tela pós-assinatura da Procuração (sem Termo assinado antes — caso isolado)
  if (assinado && tipoDoc === 'PROCURACAO') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center">
          <div className="text-green-500 text-6xl mb-4">&#10003;</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Procuração assinada!</h2>
          <p className="text-gray-400 text-sm">
            Seu processo de adesão à CoopereBR está avançando. Em breve entraremos em contato.
          </p>
        </div>
      </div>
    );
  }

  const textoDocumento = tipoDoc === 'TERMO' ? TERMO_ADESAO : PROCURACAO;
  const tituloDoc = tipoDoc === 'TERMO' ? 'Termo de Adesão' : 'Procuração';

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-purple-700">CoopereBR</h1>
          <p className="text-gray-500 mt-1">Assinatura Digital</p>
        </div>

        {/* Indicador de progresso */}
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
            tipoDoc === 'TERMO' ? 'bg-purple-600 text-white' : (proposta?.termoAdesaoAssinadoEm ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500')
          }`}>
            {proposta?.termoAdesaoAssinadoEm ? '1. Termo' : '1. Termo de Adesão'}
          </div>
          <div className="h-px w-8 bg-gray-300" />
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
            tipoDoc === 'PROCURACAO' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-500'
          }`}>
            2. Procuração
          </div>
        </div>

        {/* Card do documento */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="bg-purple-600 text-white p-6">
            <h2 className="text-xl font-bold">{tituloDoc}</h2>
            <p className="text-purple-100 text-sm mt-1">
              {proposta?.cooperado?.nomeCompleto} — CPF: {proposta?.cooperado?.cpf}
            </p>
          </div>

          <div className="p-6 space-y-4">
            {/* Texto do documento */}
            <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto border">
              <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans leading-relaxed">
                {textoDocumento}
              </pre>
            </div>

            {/* Campo nome */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nome completo do assinante
              </label>
              <input
                type="text"
                value={nomeAssinante}
                onChange={(e) => setNomeAssinante(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                placeholder="Digite seu nome completo"
              />
            </div>

            {/* Checkbox aceite */}
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={aceite}
                onChange={(e) => setAceite(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
              />
              <span className="text-sm text-gray-600">
                Li e concordo integralmente com os termos do <strong>{tituloDoc}</strong> acima apresentado.
              </span>
            </label>

            {/* Botão assinar */}
            <button
              onClick={handleAssinar}
              disabled={enviando || !aceite || !nomeAssinante.trim()}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {enviando ? 'Assinando...' : `Assinar ${tituloDoc} digitalmente`}
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          CoopereBR &copy; {new Date().getFullYear()} &mdash; Assinatura digital com validade jurídica
        </p>
      </div>
    </div>
  );
}
