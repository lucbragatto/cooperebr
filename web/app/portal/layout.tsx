'use client';

import { usePathname } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { getUsuario, logoutPortal } from '@/lib/auth';
import {
  Award,
  Coins,
  FileText,
  Home,
  LogOut,
  Receipt,
  User,
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { useContexto } from '@/hooks/useContexto';
import ContextoSwitcher from '@/components/ContextoSwitcher';

type Item = { href: string; label: string; icon: LucideIcon };

// Barra inferior (celular): 5 abas, padrão iOS
const abas: Item[] = [
  { href: '/portal', label: 'Início', icon: Home },
  { href: '/portal/tokens', label: 'Tokens', icon: Coins },
  { href: '/portal/clube', label: 'Clube', icon: Award },
  { href: '/portal/indicacoes', label: 'Indicar', icon: Users },
  { href: '/portal/conta', label: 'Conta', icon: User },
];

// Menu lateral (computador): tudo à vista
const menu: Item[] = [
  ...abas.slice(0, 4),
  { href: '/portal/financeiro', label: 'Financeiro', icon: Receipt },
  { href: '/portal/ucs', label: 'Minhas UCs', icon: Zap },
  { href: '/portal/documentos', label: 'Documentos', icon: FileText },
  { href: '/portal/conta', label: 'Minha conta', icon: User },
];

function ativo(pathname: string, href: string) {
  return href === '/portal' ? pathname === '/portal' : pathname.startsWith(href);
}

function iniciais(nome?: string) {
  const partes = (nome ?? '').trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return 'C';
  return ((partes[0][0] ?? '') + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase();
}

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const usuario = getUsuario();
  const { contextos, contextoAtivo, trocarContexto } = useContexto();

  // Páginas públicas sem casco
  if (pathname === '/portal/login' || pathname.startsWith('/portal/assinar')) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-[#f5f7f2] text-[#101510] lg:flex">
      {/* Menu lateral — computador */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-[#101510] p-5 text-white lg:flex">
        <Link href="/portal" className="flex items-center gap-3 px-2 py-1" aria-label="Início do clube">
          <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-white">
            <Image src="/brand/logo-cooperebr.jpg" alt="" width={40} height={40} className="h-full w-full object-cover" />
          </span>
          <span className="leading-tight">
            <span className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-[#a9b3a4]">COOPERE-BR</span>
            <span className="block text-[15px] font-semibold">Clube Solar</span>
          </span>
        </Link>

        <nav className="mt-8 flex-1 space-y-1" aria-label="Menu do portal">
          {menu.map(({ href, label, icon: Icon }) => {
            const on = ativo(pathname, href);
            return (
              <Link
                key={href + label}
                href={href}
                aria-current={on ? 'page' : undefined}
                className={`flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition ${
                  on ? 'bg-[#d7ff65] text-[#102012]' : 'text-[#c4ccbf] hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                {label}
              </Link>
            );
          })}
        </nav>

        <button
          type="button"
          onClick={logoutPortal}
          className="flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-[#c4ccbf] hover:bg-white/10 hover:text-white"
        >
          <LogOut className="h-5 w-5" aria-hidden="true" />
          Sair
        </button>
      </aside>

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        {/* Topo — vidro fosco, estilo iOS */}
        <header className="sticky top-0 z-30 border-b border-black/5 bg-[#f5f7f2]/80 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
          <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
            <Link href="/portal" className="flex items-center gap-2.5 lg:hidden" aria-label="Início do clube">
              <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-white ring-1 ring-black/5">
                <Image src="/brand/logo-cooperebr.jpg" alt="" width={32} height={32} className="h-full w-full object-cover" />
              </span>
              <span className="text-[15px] font-semibold">Clube Solar</span>
            </Link>
            <span className="hidden text-sm text-[#5b6656] lg:block">Área do cooperado</span>

            <div className="flex items-center gap-2">
              <ContextoSwitcher
                contextos={contextos}
                contextoAtivo={contextoAtivo}
                onTrocar={trocarContexto}
                compact
              />
              <Link
                href="/portal/conta"
                aria-label="Minha conta"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[#101510] text-xs font-semibold text-[#d7ff65]"
              >
                {iniciais(usuario?.nome)}
              </Link>
              <button
                type="button"
                onClick={logoutPortal}
                aria-label="Sair"
                className="flex h-9 w-9 items-center justify-center rounded-full text-[#5b6656] hover:bg-black/5 lg:hidden"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-32 pt-4 sm:px-6 lg:pb-12 lg:pt-8">
          {children}
          <div className="mt-10 text-center">
            <Link href="/portal/desligamento" className="text-xs text-[#8a9385] hover:text-[#5b6656]">
              Solicitar desligamento
            </Link>
          </div>
        </main>

        {/* Barra de abas — celular */}
        <nav
          className="fixed inset-x-0 bottom-0 z-30 border-t border-black/5 bg-white/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
          aria-label="Navegação principal"
        >
          <div className="mx-auto flex max-w-lg items-stretch justify-around px-2">
            {abas.map(({ href, label, icon: Icon }) => {
              const on = ativo(pathname, href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={on ? 'page' : undefined}
                  className="flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium"
                >
                  <span
                    className={`flex h-8 w-12 items-center justify-center rounded-full transition ${
                      on ? 'bg-[#101510] text-[#d7ff65]' : 'text-[#5b6656]'
                    }`}
                  >
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className={on ? 'text-[#101510]' : 'text-[#5b6656]'}>{label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
