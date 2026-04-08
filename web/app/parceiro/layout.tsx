'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { logout, getUsuario } from '@/lib/auth';
import api from '@/lib/api';
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
  FileText,
  ClipboardList,
  Calculator,
  MessageCircle,
  Gift,
  Award,
  Handshake,
  BarChart3,
  Building,
  UserCog,
  CreditCard,
  TrendingUp,
  Wallet,
  ArrowDownCircle,
  ArrowUpCircle,
  LineChart,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useContexto } from '@/hooks/useContexto';
import { useModulos } from '@/hooks/useModulos';
import ContextoSwitcher from '@/components/ContextoSwitcher';

type NavItem = { href: string; label: string; icon: typeof LayoutDashboard; modulo?: string };
type NavSection = { title?: string; titleIcon?: typeof LayoutDashboard; items: NavItem[] };

const allNavSections: NavSection[] = [
  {
    items: [
      { href: '/parceiro', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    title: 'Operacional',
    items: [
      { href: '/parceiro/membros', label: 'Membros', icon: Users, modulo: 'membros' },
      { href: '/parceiro/usinas', label: 'Usinas', icon: Sun, modulo: 'usinas' },
      { href: '/parceiro/ucs', label: 'UCs', icon: Building2, modulo: 'ucs' },
      { href: '/parceiro/contratos', label: 'Contratos', icon: FileText, modulo: 'contratos' },
      { href: '/parceiro/planos', label: 'Planos', icon: ClipboardList, modulo: 'planos' },
      { href: '/parceiro/motor-proposta', label: 'Motor de Proposta', icon: ClipboardList, modulo: 'motor_proposta' },
      { href: '/parceiro/whatsapp', label: 'WhatsApp', icon: MessageCircle, modulo: 'whatsapp' },
      { href: '/parceiro/indicacoes', label: 'Indicações', icon: Gift, modulo: 'indicacoes' },
      { href: '/parceiro/clube-vantagens', label: 'Clube de Vantagens', icon: Award, modulo: 'clube_vantagens' },
      { href: '/parceiro/convenios', label: 'Convênios', icon: Handshake, modulo: 'convenios' },
      { href: '/parceiro/agregadores', label: 'Agregadores', icon: Building },
      { href: '/parceiro/condominios', label: 'Condomínios', icon: Building, modulo: 'condominios' },
    ],
  },
  {
    title: 'Faturamento',
    titleIcon: TrendingUp,
    items: [
      { href: '/parceiro/faturas', label: 'Central de Faturas', icon: FileText, modulo: 'cobrancas' },
      { href: '/parceiro/cobrancas', label: 'Cobranças', icon: CreditCard, modulo: 'cobrancas' },
      { href: '/parceiro/modelos-cobranca', label: 'Modelos de Cobrança', icon: Calculator, modulo: 'modelos_cobranca' },
      { href: '/parceiro/receber-tokens', label: 'Receber Tokens', icon: Zap },
      { href: '/parceiro/clube/validar', label: 'Validar Resgate', icon: Award },
    ],
  },
  {
    title: 'Financeiro',
    titleIcon: DollarSign,
    items: [
      { href: '/parceiro/financeiro', label: 'Dashboard Financeiro', icon: Wallet },
      { href: '/parceiro/financeiro/contas-receber', label: 'Contas a Receber', icon: ArrowDownCircle },
      { href: '/parceiro/financeiro/contas-pagar', label: 'Contas a Pagar', icon: ArrowUpCircle },
      { href: '/parceiro/financeiro/despesas', label: 'Despesas Correntes', icon: ClipboardList },
      { href: '/parceiro/financeiro/fluxo-caixa', label: 'Fluxo de Caixa', icon: LineChart },
    ],
  },
  {
    title: 'Relatórios',
    items: [
      { href: '/parceiro/relatorios', label: 'Relatórios', icon: BarChart3, modulo: 'relatorios' },
    ],
  },
  {
    items: [
      { href: '/parceiro/usuarios', label: 'Usuários', icon: UserCog, modulo: 'usuarios' },
      { href: '/parceiro/convites', label: 'Convites', icon: UserPlus },
      { href: '/parceiro/configuracoes', label: 'Configurações', icon: Settings },
    ],
  },
];

export default function ParceiroLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [nomeCooperativa, setNomeCooperativa] = useState<string | null>(null);
  const { contextos, contextoAtivo, trocarContexto, contextoObj } = useContexto();
  const { temModulo } = useModulos();

  const navSections = allNavSections.map((section) => ({
    ...section,
    items: section.items.filter((item) => !item.modulo || temModulo(item.modulo)),
  })).filter((section) => section.items.length > 0);

  useEffect(() => {
    setUsuario(getUsuario());
  }, []);

  // Derive cooperativa name from context or fallback to contextos list / API
  useEffect(() => {
    if (contextoObj?.cooperativaNome) {
      setNomeCooperativa(contextoObj.cooperativaNome);
      return;
    }
    // Fallback: try to find admin_parceiro context in the list
    const parceiro = contextos.find((c) => c.tipo === 'admin_parceiro');
    if (parceiro?.cooperativaNome) {
      setNomeCooperativa(parceiro.cooperativaNome);
      return;
    }
    // Last resort: fetch from cooperativas API
    api.get('/cooperativas')
      .then((r) => {
        const nome = Array.isArray(r.data) ? r.data[0]?.nome : r.data?.nome;
        if (nome) setNomeCooperativa(nome);
      })
      .catch(() => {});
  }, [contextoObj, contextos]);

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r flex flex-col">
        <div className="px-6 py-5 border-b">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">SISGD</p>
          {nomeCooperativa ? (
            <p className="text-lg font-bold text-blue-700 mt-0.5 flex items-center gap-1.5">
              <Building2 className="w-4 h-4 shrink-0" />
              {nomeCooperativa}
            </p>
          ) : (
            <p className="text-lg font-bold text-blue-700 mt-0.5">SISGD</p>
          )}
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navSections.map((section, si) => (
            <div key={si}>
              {section.title && (
                <div className="pt-3 pb-1 px-3">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                    {section.titleIcon && <section.titleIcon className="h-3 w-3" />}
                    {section.title}
                  </p>
                </div>
              )}
              {section.items.map(({ href, label, icon: Icon }) => {
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
            </div>
          ))}
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
