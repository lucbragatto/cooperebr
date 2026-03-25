'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Shield,
  Building2,
  User,
  Sun,
  ChevronDown,
  ArrowRightLeft,
} from 'lucide-react';
import type { ContextoUsuario, TipoContexto } from '@/types';
import { rotaPorContexto, setContextoAtivo } from '@/hooks/useContexto';

const iconesPorTipo: Record<TipoContexto, typeof Shield> = {
  super_admin: Shield,
  admin_parceiro: Building2,
  cooperado: User,
  proprietario_usina: Sun,
};

const coresPorTipo: Record<TipoContexto, string> = {
  super_admin: 'text-purple-700 bg-purple-50',
  admin_parceiro: 'text-blue-700 bg-blue-50',
  cooperado: 'text-green-700 bg-green-50',
  proprietario_usina: 'text-amber-700 bg-amber-50',
};

interface Props {
  contextos: ContextoUsuario[];
  contextoAtivo: TipoContexto | null;
  onTrocar: (tipo: TipoContexto) => void;
  compact?: boolean;
}

export default function ContextoSwitcher({ contextos, contextoAtivo, onTrocar, compact }: Props) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setAberto(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (contextos.length <= 1) return null;

  const atual = contextos.find((c) => c.tipo === contextoAtivo);
  const Icon = atual ? iconesPorTipo[atual.tipo] : ArrowRightLeft;
  const cor = atual ? coresPorTipo[atual.tipo] : 'text-gray-600 bg-gray-50';

  function handleSelect(ctx: ContextoUsuario) {
    setAberto(false);
    setContextoAtivo(ctx.tipo);
    onTrocar(ctx.tipo);
    router.push(rotaPorContexto(ctx.tipo));
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setAberto((v) => !v)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border border-gray-200 hover:border-gray-300 ${cor}`}
      >
        <Icon className="w-4 h-4" />
        {!compact && (
          <span className="max-w-[180px] truncate">
            {atual?.label ?? 'Selecionar contexto'}
          </span>
        )}
        <ChevronDown className="w-3.5 h-3.5 opacity-50" />
      </button>

      {aberto && (
        <div className="absolute right-0 top-full mt-1.5 w-72 bg-white rounded-lg shadow-lg border z-50">
          <div className="px-3 py-2 border-b">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Trocar contexto
            </p>
          </div>
          {contextos.map((ctx) => {
            const CtxIcon = iconesPorTipo[ctx.tipo];
            const isActive = ctx.tipo === contextoAtivo;
            return (
              <button
                key={ctx.tipo}
                onClick={() => handleSelect(ctx)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left transition-colors hover:bg-gray-50 ${
                  isActive ? 'bg-gray-50 font-medium' : 'text-gray-700'
                }`}
              >
                <span
                  className={`flex items-center justify-center w-8 h-8 rounded-full ${coresPorTipo[ctx.tipo]}`}
                >
                  <CtxIcon className="w-4 h-4" />
                </span>
                <span className="flex-1 min-w-0 truncate">{ctx.label}</span>
                {isActive && (
                  <span className="text-[10px] font-bold text-green-600 uppercase">Ativo</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
