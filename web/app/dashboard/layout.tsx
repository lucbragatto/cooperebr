'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { logout, getUsuario } from '@/lib/auth';
import type { Usuario, Notificacao } from '@/types';
import api from '@/lib/api';
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
  Bell,
  FileCheck,
  FileX,
  FilePlus,
  Info,
  Clock,
  UserCheck,
  Receipt,
  MessageCircle,
  Building2,
  Settings,
  Shield,
  DollarSign,
  Globe,
  Gift,
  UserPlus,
  Eye,
  BarChart3,
  TrendingUp,
  Mail,
  Wallet,
  ArrowDownCircle,
  ArrowUpCircle,
  ClipboardList,
  LineChart,
  Coins,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTipoParceiro } from '@/hooks/useTipoParceiro';
import { useContexto } from '@/hooks/useContexto';
import ContextoSwitcher from '@/components/ContextoSwitcher';

type NavItem = { href: string; label: string; icon: typeof LayoutDashboard };
type NavSection = { title?: string; titleIcon?: typeof LayoutDashboard; items: NavItem[] };

function getNavSections(perfil: string): NavSection[] {
  if (perfil === 'COOPERADO') {
    return [{
      items: [
        { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { href: '/dashboard/meu-convite', label: 'Meu Convite', icon: UserPlus },
        { href: '/dashboard/indicacoes', label: 'Indicações', icon: Gift },
      ],
    }];
  }

  if (perfil === 'OPERADOR') {
    return [{
      items: [
        { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { href: '/dashboard/cooperados', label: '__MEMBROS__', icon: Users },
        { href: '/dashboard/ucs', label: 'UCs', icon: Zap },
        { href: '/dashboard/contratos', label: 'Contratos', icon: FileText },
        { href: '/dashboard/cobrancas', label: 'Cobranças', icon: CreditCard },
        { href: '/dashboard/ocorrencias', label: 'Ocorrências', icon: AlertTriangle },
        { href: '/dashboard/whatsapp', label: 'WhatsApp', icon: MessageCircle },
        { href: '/dashboard/indicacoes', label: 'Indicações', icon: Gift },
        { href: '/dashboard/meu-convite', label: 'Meu Convite', icon: UserPlus },
        { href: '/dashboard/convites', label: 'Convites', icon: Mail },
      ],
    }];
  }

  // ADMIN e SUPER_ADMIN
  const sections: NavSection[] = [
    {
      items: [
        { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      ],
    },
    {
      title: 'Administração',
      items: [
        { href: '/dashboard/usuarios', label: 'Usuários', icon: Users },
        ...(perfil === 'SUPER_ADMIN' ? [{ href: '/dashboard/cooperativas', label: 'Parceiros SISGD', icon: Building2 }] : []),
        { href: '/dashboard/observador', label: 'Observador', icon: Eye },
      ],
    },
    {
      title: 'Operacional',
      items: [
        { href: '/dashboard/cooperados', label: '__MEMBROS__', icon: Users },
        { href: '/dashboard/ucs', label: 'UCs', icon: Zap },
        { href: '/dashboard/usinas', label: 'Usinas', icon: Sun },
        { href: '/dashboard/usinas/listas', label: 'Listas Concessionária', icon: FileText },
        { href: '/dashboard/contratos', label: 'Contratos', icon: FileText },
        { href: '/dashboard/planos', label: 'Planos', icon: Tag },
        { href: '/dashboard/ocorrencias', label: 'Ocorrências', icon: AlertTriangle },
        { href: '/dashboard/motor-proposta', label: 'Motor de Proposta', icon: Zap },
        { href: '/dashboard/motor-proposta/lista-espera', label: 'Lista de Espera', icon: Clock },
        { href: '/dashboard/whatsapp', label: 'WhatsApp', icon: MessageCircle },
        { href: '/dashboard/whatsapp-config', label: 'Config. WhatsApp', icon: Settings },
        { href: '/dashboard/indicacoes', label: 'Indicações', icon: Gift },
        { href: '/dashboard/meu-convite', label: 'Meu Convite', icon: UserPlus },
        { href: '/dashboard/convites', label: 'Convites', icon: Mail },
        { href: '/dashboard/cooper-token', label: 'CooperToken', icon: Coins },
        { href: '/dashboard/clube-vantagens', label: 'Clube de Vantagens', icon: Gift },
        { href: '/dashboard/clube-vantagens/ranking', label: 'Ranking Indicadores', icon: Tag },
        { href: '/dashboard/convenios', label: 'Convênios', icon: UserCheck },
        { href: '/dashboard/condominios', label: 'Condomínios', icon: Building2 },
        { href: '/dashboard/administradoras', label: 'Agregadores', icon: Building2 },
      ],
    },
    {
      title: 'Faturamento',
      titleIcon: TrendingUp,
      items: [
        { href: '/dashboard/faturas/central', label: 'Central de Faturas', icon: FileText },
        { href: '/dashboard/cobrancas', label: 'Cobranças', icon: CreditCard },
        { href: '/dashboard/modelos-cobranca', label: 'Modelos de Cobrança', icon: Receipt },
        { href: '/dashboard/financeiro/pix-excedente', label: 'PIX Excedente', icon: Zap },
      ],
    },
    {
      title: 'Financeiro',
      titleIcon: DollarSign,
      items: [
        { href: '/dashboard/financeiro', label: 'Dashboard Financeiro', icon: Wallet },
        { href: '/dashboard/financeiro/contas-receber', label: 'Contas a Receber', icon: ArrowDownCircle },
        { href: '/dashboard/financeiro/contas-pagar', label: 'Contas a Pagar', icon: ArrowUpCircle },
        { href: '/dashboard/financeiro/despesas', label: 'Despesas Correntes', icon: ClipboardList },
        { href: '/dashboard/financeiro/fluxo-caixa', label: 'Fluxo de Caixa', icon: LineChart },
        { href: '/dashboard/configuracoes/financeiro', label: 'Plano de Contas', icon: DollarSign },
        { href: '/dashboard/cooper-token-parceiro', label: 'Tokens Recebidos', icon: ArrowDownCircle },
        { href: '/dashboard/cooper-token-financeiro', label: 'Financeiro Tokens', icon: Coins },
      ],
    },
    {
      title: 'Relatórios',
      items: [
        { href: '/dashboard/relatorios/inadimplencia', label: 'Inadimplência', icon: BarChart3 },
        { href: '/dashboard/relatorios/projecao-receita', label: 'Projeção Receita', icon: TrendingUp },
        { href: '/dashboard/relatorios/expansao', label: 'Expansão / Investidores', icon: Globe },
        { href: '/dashboard/proprietario', label: 'Portal Proprietário', icon: Sun },
      ],
    },
    {
      title: 'Configurações',
      items: [
        { href: '/dashboard/configuracoes/asaas', label: 'Asaas (Pagamentos)', icon: Settings },
        { href: '/dashboard/configuracoes/email', label: 'Email do Parceiro (SMTP+IMAP)', icon: Mail },
        { href: '/dashboard/configuracoes/email-faturas', label: 'Email de Faturas', icon: Mail },
        { href: '/dashboard/configuracoes/seguranca', label: 'Segurança', icon: Shield },
      ],
    },
  ];

  // Gestão Global — somente SUPER_ADMIN
  if (perfil === 'SUPER_ADMIN') {
    sections.push({
      title: 'Gestão Global',
      titleIcon: Globe,
      items: [
        { href: '/dashboard/saas/planos', label: 'Planos SaaS', icon: Tag },
        { href: '/dashboard/saas/faturas', label: 'Faturas SaaS', icon: CreditCard },
      ],
    });
  }

  return sections;
}

function tempoAtras(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'agora mesmo';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return `há ${d} dia${d > 1 ? 's' : ''}`;
}

function IconeNotificacao({ tipo }: { tipo: string }) {
  if (tipo === 'DOCUMENTO_APROVADO') return <FileCheck className="h-4 w-4 text-green-600 shrink-0" />;
  if (tipo === 'DOCUMENTO_REPROVADO') return <FileX className="h-4 w-4 text-red-600 shrink-0" />;
  if (tipo === 'DOCUMENTO_ENVIADO') return <FilePlus className="h-4 w-4 text-blue-600 shrink-0" />;
  if (tipo === 'COOPERADO_PRONTO') return <UserCheck className="h-4 w-4 text-green-600 shrink-0" />;
  return <Info className="h-4 w-4 text-gray-500 shrink-0" />;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { tipoMembroPlural } = useTipoParceiro();
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [naoLidas, setNaoLidas] = useState(0);
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [aberto, setAberto] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { contextos, contextoAtivo, trocarContexto, meData } = useContexto();

  useEffect(() => { setUsuario(getUsuario()); }, []);

  const buscarCount = useCallback(async () => {
    try {
      const { data } = await api.get<{ count: number }>('/notificacoes/nao-lidas');
      setNaoLidas(data.count);
    } catch {
      // silently ignore
    }
  }, []);

  const buscarNotificacoes = useCallback(async () => {
    try {
      const { data } = await api.get<Notificacao[]>('/notificacoes');
      setNotificacoes(data.slice(0, 10));
    } catch {
      // silently ignore
    }
  }, []);

  useEffect(() => {
    buscarCount();
    const id = setInterval(buscarCount, 30000);
    return () => clearInterval(id);
  }, [buscarCount]);

  useEffect(() => {
    if (aberto) buscarNotificacoes();
  }, [aberto, buscarNotificacoes]);

  // Fecha o dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setAberto(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function marcarTodasComoLidas() {
    try {
      await api.patch('/notificacoes/ler-todas');
      setNaoLidas(0);
      setNotificacoes((prev) => prev.map((n) => ({ ...n, lida: true })));
    } catch {
      // silently ignore
    }
  }

  async function handleClickNotificacao(n: Notificacao) {
    setAberto(false);
    if (!n.lida) {
      try {
        await api.patch(`/notificacoes/${n.id}/ler`);
        setNaoLidas((c) => Math.max(0, c - 1));
        setNotificacoes((prev) =>
          prev.map((item) => (item.id === n.id ? { ...item, lida: true } : item)),
        );
      } catch {
        // silently ignore
      }
    }
    if (n.link) router.push(n.link);
  }

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r flex flex-col">
        <div className="px-6 py-5 border-b">
          <h1 className="text-xl font-bold text-green-700">SISGD</h1>
          {(() => {
            const cooperativaNome = meData?.contextos?.find(c => c.tipo === 'admin_parceiro')?.cooperativaNome;
            if (usuario?.perfil === 'ADMIN' && cooperativaNome) {
              return (
                <p className="text-xs text-blue-600 mt-0.5 flex items-center gap-1">
                  <Building2 className="w-3 h-3" />
                  {cooperativaNome}
                </p>
              );
            }
            return <p className="text-xs text-gray-400 mt-0.5">Painel Administrativo</p>;
          })()}
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {getNavSections(usuario?.perfil ?? '').map((section, si) => (
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
                const active = pathname === href;
                const displayLabel = label === '__MEMBROS__' ? tipoMembroPlural : label;
                const isGlobal = section.title === 'Gestão Global';
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      active
                        ? isGlobal ? 'bg-purple-50 text-purple-700' : 'bg-green-50 text-green-700'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {displayLabel}
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

            {/* Sino de notificações */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setAberto((v) => !v)}
                className="relative p-1.5 rounded-md hover:bg-gray-100 transition-colors"
                aria-label="Notificações"
              >
                <Bell className="h-5 w-5 text-gray-600" />
                {naoLidas > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center h-4 w-4 rounded-full bg-red-500 text-white text-[10px] font-bold">
                    {naoLidas > 9 ? '9+' : naoLidas}
                  </span>
                )}
              </button>

              {aberto && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-lg shadow-lg border z-50 flex flex-col max-h-[480px]">
                  {/* Header dropdown */}
                  <div className="flex items-center justify-between px-4 py-3 border-b">
                    <span className="font-semibold text-sm text-gray-800">Notificações</span>
                    <button
                      onClick={marcarTodasComoLidas}
                      className="text-xs text-green-700 hover:underline"
                    >
                      Marcar todas como lidas
                    </button>
                  </div>

                  {/* Lista */}
                  <div className="overflow-y-auto flex-1">
                    {notificacoes.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-6">
                        Nenhuma notificação.
                      </p>
                    ) : (
                      notificacoes.map((n) => (
                        <button
                          key={n.id}
                          onClick={() => handleClickNotificacao(n)}
                          className={`w-full text-left flex gap-3 px-4 py-3 border-b last:border-0 hover:bg-gray-50 transition-colors ${
                            !n.lida ? 'bg-green-50' : ''
                          }`}
                        >
                          <div className="pt-0.5">
                            <IconeNotificacao tipo={n.tipo} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">{n.titulo}</p>
                            <p className="text-xs text-gray-500 line-clamp-2">{n.mensagem}</p>
                            <p className="text-[10px] text-gray-400 mt-0.5">{tempoAtras(n.createdAt)}</p>
                          </div>
                          {!n.lida && (
                            <span className="mt-1.5 h-2 w-2 rounded-full bg-green-500 shrink-0" />
                          )}
                        </button>
                      ))
                    )}
                  </div>

                  {/* Footer */}
                  <div className="border-t px-4 py-2">
                    <Link
                      href="/dashboard/notificacoes"
                      onClick={() => setAberto(false)}
                      className="text-xs text-green-700 hover:underline"
                    >
                      Ver todas
                    </Link>
                  </div>
                </div>
              )}
            </div>

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
