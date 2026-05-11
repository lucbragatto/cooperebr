'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import EconomiaProjetada from '@/components/EconomiaProjetada';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface PropostaData {
  id: string;
  cooperadoId: string;
  kwhContrato: number;
  descontoPercentual: number;
  economiaMensal: number;
  economiaAnual: number;
  /** Fase C.3 (Reforço 3): campos novos retornados pelo backend, backwards-compat (clientes antigos ignoram). */
  economia5Anos?: number;
  economia15Anos?: number;
  valorCooperado: number;
  valorMesRecente: number;
  kwhMesRecente: number;
  status: string;
  cooperado: {
    nomeCompleto: string;
    cpf: string;
    email: string;
    telefone: string | null;
  };
}

function fmtBRL(v: number | undefined | null) {
  if (v == null) return '—';
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function AprovarPropostaContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [proposta, setProposta] = useState<PropostaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [nome, setNome] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<'aceita' | 'recusada' | null>(null);

  useEffect(() => {
    if (!token) {
      setErro('Token não informado na URL.');
      setLoading(false);
      return;
    }
    fetch(`${API_URL}/motor-proposta/proposta-por-token/${token}`)
      .then(async (res) => {
        if (!res.ok) throw new Error('Proposta não encontrada');
        return res.json();
      })
      .then((data) => {
        setProposta(data);
        setNome(data.cooperado?.nomeCompleto ?? '');
      })
      .catch(() => setErro('Proposta não encontrada ou link expirado.'))
      .finally(() => setLoading(false));
  }, [token]);

  const handleAcao = async (aceite: boolean) => {
    if (!nome.trim()) {
      alert('Informe seu nome para continuar.');
      return;
    }
    setEnviando(true);
    try {
      const res = await fetch(`${API_URL}/motor-proposta/aprovar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, nome: nome.trim(), aceite }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Erro ao processar');
      }
      setResultado(aceite ? 'aceita' : 'recusada');
    } catch (err: any) {
      alert(err.message || 'Erro ao processar sua resposta.');
    } finally {
      setEnviando(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center">
        <div className="text-gray-500 text-lg">Carregando proposta...</div>
      </div>
    );
  }

  if (erro) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center">
          <div className="text-red-500 text-5xl mb-4">!</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Link inválido</h2>
          <p className="text-gray-500">{erro}</p>
        </div>
      </div>
    );
  }

  if (resultado) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center">
          {resultado === 'aceita' ? (
            <>
              <div className="text-green-500 text-6xl mb-4">&#10003;</div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Proposta aceita!</h2>
              <p className="text-gray-500 mb-4">
                Obrigado, {nome}! Sua proposta foi aprovada com sucesso.
              </p>
              <p className="text-gray-400 text-sm">
                Em breve entraremos em contato para os próximos passos.
              </p>
            </>
          ) : (
            <>
              <div className="text-red-400 text-6xl mb-4">&#10007;</div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Proposta recusada</h2>
              <p className="text-gray-500">
                Sua resposta foi registrada. Se mudar de ideia, entre em contato conosco.
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 py-8 px-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-green-700">CoopereBR</h1>
          <p className="text-gray-500 mt-1">Cooperativa de Energia Solar</p>
        </div>

        {/* Card principal */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* Header card */}
          <div className="bg-green-600 text-white p-6">
            <h2 className="text-xl font-bold">Proposta de Adesão</h2>
            <p className="text-green-100 text-sm mt-1">
              {proposta?.cooperado?.nomeCompleto}
            </p>
          </div>

          <div className="p-6 space-y-4">
            {/* Dados da proposta */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Consumo médio</p>
                <p className="text-lg font-bold text-gray-800">
                  {Number(proposta?.kwhMesRecente ?? 0).toFixed(0)} kWh
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Fatura atual</p>
                <p className="text-lg font-bold text-gray-800">
                  {fmtBRL(proposta?.valorMesRecente)}
                </p>
              </div>
              <div className="bg-green-50 rounded-lg p-3">
                <p className="text-xs text-green-600 uppercase tracking-wide">Desconto</p>
                <p className="text-lg font-bold text-green-700">
                  {Number(proposta?.descontoPercentual ?? 0).toFixed(1)}%
                </p>
              </div>
              <div className="bg-green-50 rounded-lg p-3">
                <p className="text-xs text-green-600 uppercase tracking-wide">Valor CoopereBR</p>
                <p className="text-lg font-bold text-green-700">
                  {fmtBRL(proposta?.valorCooperado)}
                  <span className="text-xs font-normal text-green-500"> /kWh</span>
                </p>
              </div>
            </div>

            {/* Economia destacada (mensal + ano) */}
            <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-xl p-4 text-white text-center">
              <p className="text-sm opacity-90">Sua economia estimada</p>
              <p className="text-3xl font-bold mt-1">{fmtBRL(proposta?.economiaMensal)}<span className="text-base font-normal opacity-80">/mês</span></p>
              <p className="text-sm opacity-80 mt-1">{fmtBRL(proposta?.economiaAnual)} por ano</p>
            </div>

            {/* Fase C.3: card detalhado com projeção 1/5/15 anos (D-P-6 do playbook) */}
            <EconomiaProjetada
              valorEconomiaMes={proposta?.economiaMensal ?? null}
              valorEconomiaAno={proposta?.economiaAnual ?? null}
              valorEconomia5anos={proposta?.economia5Anos ?? null}
              valorEconomia15anos={proposta?.economia15Anos ?? null}
              titulo="Projeção de economia"
            />


            {/* Campo nome */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Seu nome completo</label>
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                placeholder="Digite seu nome completo"
              />
            </div>

            {/* Botões */}
            <div className="flex gap-3">
              <button
                onClick={() => handleAcao(true)}
                disabled={enviando}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50"
              >
                {enviando ? 'Processando...' : 'Aceitar proposta'}
              </button>
              <button
                onClick={() => handleAcao(false)}
                disabled={enviando}
                className="flex-1 bg-red-50 hover:bg-red-100 text-red-600 font-semibold py-3 px-4 rounded-lg transition-colors border border-red-200 disabled:opacity-50"
              >
                Recusar
              </button>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          CoopereBR &copy; {new Date().getFullYear()} &mdash; Energia solar compartilhada
        </p>
      </div>
    </div>
  );
}

export default function AprovarPropostaPage() {
  return (
    <Suspense fallback={<div>Carregando...</div>}>
      <AprovarPropostaContent />
    </Suspense>
  );
}
