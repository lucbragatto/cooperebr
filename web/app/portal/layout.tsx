'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { getUsuario, logoutPortal } from '@/lib/auth';
import {
  Home,
  Zap,
  DollarSign,
  FileText,
  Users,
  LogOut,
  User,
} from 'lucide-react';

const navItems = [
  { href: '/portal', label: 'Início', icon: Home },
  { href: '/portal/ucs', label: 'UCs', icon: Zap },
  { href: '/portal/financeiro', label: 'Financeiro', icon: DollarSign },
  { href: '/portal/documentos', label: 'Documentos', icon: FileText },
  { href: '/portal/indicacoes', label: 'Indicações', icon: Users },
];

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const usuario = getUsuario();

  // Login page renders without shell
  if (pathname === '/portal/login') {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold text-green-700 tracking-tight">COOPERE-BR</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/portal/conta"
            className="flex items-center gap-2 text-sm text-gray-700 hover:text-green-700 transition-colors"
          >
            <User className="w-4 h-4" />
            <span className="hidden sm:inline max-w-[140px] truncate">
              {usuario?.nome?.split(' ')[0] ?? 'Membro'}
            </span>
          </Link>
          <button
            onClick={logoutPortal}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-red-600 transition-colors p-2"
            title="Sair"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto pb-20 px-4 py-4 max-w-lg mx-auto w-full">
        {children}
      </main>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-30 safe-area-bottom">
        <div className="flex justify-around items-center max-w-lg mx-auto">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = href === '/portal'
              ? pathname === '/portal'
              : pathname.startsWith(href);

            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center py-2 px-3 min-w-[60px] text-xs transition-colors ${
                  isActive
                    ? 'text-green-700 font-semibold'
                    : 'text-gray-500 hover:text-green-600'
                }`}
              >
                <Icon className={`w-5 h-5 mb-0.5 ${isActive ? 'stroke-[2.5]' : ''}`} />
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
