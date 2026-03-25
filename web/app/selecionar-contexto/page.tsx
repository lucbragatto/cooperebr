'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Building2, User, Sun, LogOut, Loader2 } from 'lucide-react';
import type { ContextoUsuario, MeResponse, TipoContexto } from '@/types';
import { setContextoAtivo, rotaPorContexto } from '@/hooks/useContexto';
import api from '@/lib/api';
import { logout } from '@/lib/auth';

const icones: Record<TipoContexto, typeof Shield> = {
  super_admin: Shield,
  admin_parceiro: Building2,
  cooperado: User,
  proprietario_usina: Sun,
};

const descricoes: Record<TipoContexto, string> = {
  super_admin: 'Gerenciar todas as cooperativas, usinas e configurações globais do sistema.',
  admin_parceiro: 'Gerenciar membros, cobranças, usinas e configurações do seu parceiro.',
  cooperado: 'Acessar suas UCs, cobranças, documentos e indicações como membro.',
  proprietario_usina: 'Acompanhar produção, repasses e contratos das suas usinas.',
};

const cores: Record<TipoContexto, { bg: string; border: string; icon: string; hover: string }> = {
  super_admin: {
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    icon: 'text-purple-600 bg-purple-100',
    hover: 'hover:border-purple-400 hover:shadow-purple-100',
  },
  admin_parceiro: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    icon: 'text-blue-600 bg-blue-100',
    hover: 'hover:border-blue-400 hover:shadow-blue-100',
  },
  cooperado: {
    bg: 'bg-green-50',
    border: 'border-green-200',
    icon: 'text-green-600 bg-green-100',
    hover: 'hover:border-green-400 hover:shadow-green-100',
  },
  proprietario_usina: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    icon: 'text-amber-600 bg-amber-100',
    hover: 'hover:border-amber-400 hover:shadow-amber-100',
  },
};

export default function SelecionarContextoPage() {
  const router = useRouter();
  const [meData, setMeData] = useState<MeResponse | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    async function carregar() {
      try {
        const { data } = await api.get<MeResponse>('/auth/me');
        setMeData(data);

        // Se só tem 1 contexto, redirecionar direto
        if (data.contextos.length === 1) {
          const tipo = data.contextos[0].tipo;
          setContextoAtivo(tipo);
          router.replace(rotaPorContexto(tipo));
          return;
        }

        // Se tem contexto salvo válido, redirecionar
        const salvo = localStorage.getItem('contexto_ativo') as TipoContexto | null;
        if (salvo && data.contextos.some((c) => c.tipo === salvo)) {
          router.replace(rotaPorContexto(salvo));
          return;
        }
      } catch {
        // Token inválido
      } finally {
        setCarregando(false);
      }
    }
    carregar();
  }, [router]);

  function handleSelect(ctx: ContextoUsuario) {
    setContextoAtivo(ctx.tipo);
    router.push(rotaPorContexto(ctx.tipo));
  }

  if (carregando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 text-green-600 animate-spin" />
      </div>
    );
  }

  if (!meData || meData.contextos.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Nenhum contexto encontrado para seu usuário.</p>
          <button onClick={logout} className="text-sm text-red-600 hover:underline">
            Sair
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-green-700 mb-1">COOPERE-BR</h1>
          <p className="text-gray-600">
            Olá, <span className="font-medium">{meData.usuario.nome.split(' ')[0]}</span>!
          </p>
          <p className="text-sm text-gray-500 mt-1">Escolha como deseja acessar o sistema:</p>
        </div>

        {/* Cards */}
        <div className="space-y-3">
          {meData.contextos.map((ctx) => {
            const Icon = icones[ctx.tipo];
            const cor = cores[ctx.tipo];
            return (
              <button
                key={ctx.tipo}
                onClick={() => handleSelect(ctx)}
                className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 ${cor.border} ${cor.bg} ${cor.hover} transition-all shadow-sm hover:shadow-md text-left`}
              >
                <span
                  className={`flex items-center justify-center w-12 h-12 rounded-xl ${cor.icon}`}
                >
                  <Icon className="w-6 h-6" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900">{ctx.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{descricoes[ctx.tipo]}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Logout */}
        <div className="mt-8 text-center">
          <button
            onClick={logout}
            className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-red-600 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sair da conta
          </button>
        </div>
      </div>
    </div>
  );
}
