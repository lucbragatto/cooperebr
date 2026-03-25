'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { logout, getUsuario } from '@/lib/auth';
import type { Usuario } from '@/types';
import {
  LayoutDashboard,
  Users,
  DollarSign,
  Sun,
  UserPlus,
  Settings,
  LogOut,
  Building2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useContexto } from '@/hooks/useContexto';
import ContextoSwitcher from '@/components/ContextoSwitcher';

const navItems = [
  { href: '/parceiro', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/parceiro/membros', label: 'Membros', icon: Users },
  { href: '/parceiro/financeiro', label: 'Financeiro', icon: DollarSign },
  { href: '/parceiro/usinas', label: 'Usinas', icon: Sun },
  { href: '/parceiro/convites', label: 'Convites', icon: UserPlus },
  { href: '/parceiro/configuracoes', label: 'Configurações', icon: Settings },
];

export default function ParceiroLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const { contextos, contextoAtivo, trocarContexto, contextoObj } = useContexto();

  useEffect(() => {
    setUsuario(getUsuario());
  }, []);

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r flex flex-col">
        <div className="px-6 py-5 border-b">
          <h1 className="text-xl font-bold text-blue-700">COOPERE-BR</h1>
          <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
            <Building2 className="w-3 h-3" />
            {contextoObj?.cooperativaNome ?? 'Painel do Parceiro'}
          </p>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = href === '/parceiro'
              ? pathname === '/parceiro'
              : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  active
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="px-3 py-4 border-t">
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-gray-600 hover:text-red-600"
            onClick={logout}
          >
            <LogOut className="h-4 w-4" />
            Sair
          </Button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
          <div />
          <div className="flex items-center gap-3 text-sm text-gray-600">
            <ContextoSwitcher
              contextos={contextos}
              contextoAtivo={contextoAtivo}
              onTrocar={trocarContexto}
            />
            <span>
              Olá, <span className="font-medium">{usuario?.nome ?? 'Usuário'}</span>
            </span>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 text-gray-600 hover:text-red-600 hover:border-red-300"
              onClick={logout}
            >
              <LogOut className="h-3.5 w-3.5" />
              Sair
            </Button>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
