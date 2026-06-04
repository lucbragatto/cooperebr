'use client';

/**
 * Sprint Portal Empresa 9.0/9.1 (04/06/2026) — Layout do portal da empresa
 * conveniada. Topbar minimalista (mockup é single-page por convênio — não
 * tem sidebar de navegação como /proprietario). ContextoSwitcher pra
 * trocar quando o Usuario tem múltiplos contextos.
 */

import { useEffect, useState } from 'react';
import { Briefcase, LogOut } from 'lucide-react';
import { logout, getUsuario } from '@/lib/auth';
import type { Usuario } from '@/types';
import { Button } from '@/components/ui/button';
import { useContexto } from '@/hooks/useContexto';
import ContextoSwitcher from '@/components/ContextoSwitcher';

export default function ConveniadaLayout({ children }: { children: React.ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const { contextos, contextoAtivo, trocarContexto } = useContexto();

  useEffect(() => {
    setUsuario(getUsuario());
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-slate-900 text-white">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-orange-300" />
            <div>
              <h1 className="text-base font-bold">SISGD · Portal da Empresa Conveniada</h1>
              <p className="text-xs opacity-70">CoopereBR — Geração Distribuída</p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <ContextoSwitcher
              contextos={contextos}
              contextoAtivo={contextoAtivo}
              onTrocar={trocarContexto}
            />
            <span className="hidden md:inline">
              Olá, <span className="font-medium">{usuario?.nome ?? 'Usuário'}</span>
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="text-white/90 hover:bg-white/10 hover:text-white gap-1"
              onClick={logout}
            >
              <LogOut className="h-3.5 w-3.5" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      <main>{children}</main>
    </div>
  );
}
