'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { CheckCircle, XCircle, Loader2, Sun } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface DadosCooperado {
  id: string;
  nomeCompleto: string;
  cidade?: string;
  estado?: string;
  ucs: { numero: string; distribuidora?: string }[];
  cooperativa?: { nome: string };
}

type Estado = 'carregando' | 'valido' | 'erro' | 'confirmando' | 'confirmado';

export default function AssinarPage() {
  const { token } = useParams<{ token: string }>();
  const [estado, setEstado] = useState<Estado>('carregando');
  const [dados, setDados] = useState<DadosCooperado | null>(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (!token) return;
    fetch(`${API_URL}/cooperados/verificar-token/${token}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.message || 'Token inválido ou expirado');
        }
        return res.json();
      })
      .then((data) => {
        setDados(data);
        setEstado('valido');
      })
      .catch((err) => {
        setErro(err.message);
        setEstado('erro');
      });
  }, [token]);

  const confirmar = async () => {
    setEstado('confirmando');
    try {
      const res = await fetch(`${API_URL}/cooperados/confirmar-assinatura/${token}`, {
        method: 'POST',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || 'Erro ao confirmar');
      }
      setEstado('confirmado');
    } catch (err: any) {
      setErro(err.message);
      setEstado('erro');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2">
            <Sun className="w-8 h-8 text-yellow-500" />
            <span className="text-2xl font-bold text-green-700">SISGD</span>
          </div>
        </div>

        {estado === 'carregando' && (
          <div className="bg-white rounded-xl shadow-lg p-8 text-center">
            <Loader2 className="w-10 h-10 text-green-600 animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Verificando seu convite...</p>
          </div>
        )}

        {estado === 'erro' && (
          <div className="bg-white rounded-xl shadow-lg p-8 text-center">
            <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-gray-800 mb-2">Link indisponivel</h2>
            <p className="text-gray-600 text-sm">{erro}</p>
          </div>
        )}

        {(estado === 'valido' || estado === 'confirmando') && dados && (
          <div className="bg-white rounded-xl shadow-lg p-6 space-y-5">
            <div className="text-center">
              <h2 className="text-xl font-bold text-gray-800">Confirmar Adesao</h2>
              <p className="text-sm text-gray-500 mt-1">Energia solar sem investimento</p>
            </div>

            <div className="bg-green-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Nome:</span>
                <span className="font-medium text-gray-800">{dados.nomeCompleto}</span>
              </div>
              {dados.ucs.length > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">UC:</span>
                  <span className="font-medium text-gray-800">{dados.ucs[0].numero}</span>
                </div>
              )}
              {dados.ucs[0]?.distribuidora && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Distribuidora:</span>
                  <span className="font-medium text-gray-800">{dados.ucs[0].distribuidora}</span>
                </div>
              )}
              {dados.cidade && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Cidade:</span>
                  <span className="font-medium text-gray-800">
                    {dados.cidade}{dados.estado ? ` - ${dados.estado}` : ''}
                  </span>
                </div>
              )}
              {dados.cooperativa && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Cooperativa:</span>
                  <span className="font-medium text-gray-800">{dados.cooperativa.nome}</span>
                </div>
              )}
            </div>

            <p className="text-xs text-gray-500 text-center leading-relaxed">
              Ao confirmar, voce concorda em participar da CoopereBR e receber energia solar com desconto em sua conta de luz.
            </p>

            <button
              onClick={confirmar}
              disabled={estado === 'confirmando'}
              className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {estado === 'confirmando' ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Confirmando...
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5" />
                  Confirmar minha adesao
                </>
              )}
            </button>
          </div>
        )}

        {estado === 'confirmado' && (
          <div className="bg-white rounded-xl shadow-lg p-8 text-center space-y-4">
            <CheckCircle className="w-14 h-14 text-green-500 mx-auto" />
            <h2 className="text-xl font-bold text-gray-800">Parabens!</h2>
            <p className="text-gray-600">
              Seu cadastro foi confirmado. Nossa equipe entrara em contato em breve.
            </p>
            <div className="pt-2">
              <Sun className="w-8 h-8 text-yellow-500 mx-auto opacity-60" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
