'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { logout, getUsuario } from '@/lib/auth';
import type { Usuario } from '@/types';
import {
  LayoutDashboard,
  Users,
  Zap,
  Sun,
  FileText,
  CreditCard,
  AlertTriangle,
  LogOut,
  Tag,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/cooperados', label: 'Cooperados', icon: Users },
  { href: '/dashboard/ucs', label: 'UCs', icon: Zap },
  { href: '/dashboard/usinas', label: 'Usinas', icon: Sun },
  { href: '/dashboard/contratos', label: 'Contratos', icon: FileText },
  { href: '/dashboard/planos', label: 'Planos', icon: Tag },
  { href: '/dashboard/cobrancas', label: 'Cobranças', icon: CreditCard },
  { href: '/dashboard/ocorrencias', label: 'Ocorrências', icon: AlertTriangle },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [usuario, setUsuario] = useState<Usuario | null>(null);

  useEffect(() => { setUsuario(getUsuario()); }, []);

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r flex flex-col">
        <div className="px-6 py-5 border-b">
          <h1 className="text-xl font-bold text-green-700">COOPERE-BR</h1>
          <p className="text-xs text-gray-400 mt-0.5">Painel Administrativo</p>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  active
                    ? 'bg-green-50 text-green-700'
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
