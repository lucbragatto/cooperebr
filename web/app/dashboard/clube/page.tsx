'use client';

/**
 * Sprint Clube Unificado P1 — Fase 1 HUB (10/06/2026)
 *
 * Hub agrega as 6 entradas do Clube/Token que estavam espalhadas no menu
 * admin (CooperToken, Vantagens, Ranking, Planos do Clube, Tokens Recebidos,
 * Financeiro Tokens). Cada card navega pra rota existente — páginas internas
 * FICAM onde estão (deep-links + ConvenioCusteioBloco continuam funcionando).
 *
 * Próximas fases ampliam o hub com cards novos (F1.5 Configuração da Economia,
 * F5 Distribuir Tokens, F6 Resgate) — sem mover rotas.
 *
 * Help inline (regra UX 19/05): banner azul explica o que é o Clube.
 */

import Link from 'next/link';
import {
  Coins,
  Gift,
  Tag,
  Trophy,
  ArrowDownCircle,
  LineChart,
  Info,
  Settings,
  Users,
  Mail,
  UserPlus,
  Send,
  type LucideIcon,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface ClubeCard {
  href: string;
  titulo: string;
  descricao: string;
  icon: LucideIcon;
  /** Tailwind cor do ícone — distingue visualmente cards de naturezas diferentes. */
  corIcone: string;
}

const CARDS: ClubeCard[] = [
  {
    href: '/dashboard/cooper-token',
    titulo: 'CooperToken',
    descricao: 'Moeda do Clube — saldos, ledger, transações e configuração.',
    icon: Coins,
    corIcone: 'text-amber-600',
  },
  {
    href: '/dashboard/clube-vantagens',
    titulo: 'Clube de Vantagens',
    descricao: 'Tiers BRONZE→DIAMANTE, benefícios e parceiros do clube.',
    icon: Gift,
    corIcone: 'text-pink-600',
  },
  {
    href: '/dashboard/clube/planos',
    titulo: 'Planos do Clube',
    descricao: 'Planos de adesão do Clube vinculados aos convênios.',
    icon: Tag,
    corIcone: 'text-emerald-600',
  },
  {
    href: '/dashboard/clube-vantagens/ranking',
    titulo: 'Ranking',
    descricao: 'Ranking de indicadores e progressão MLM.',
    icon: Trophy,
    corIcone: 'text-yellow-600',
  },
  {
    href: '/dashboard/cooper-token-parceiro',
    titulo: 'Tokens Recebidos',
    descricao: 'Saldos por parceiro do clube (estabelecimentos).',
    icon: ArrowDownCircle,
    corIcone: 'text-cyan-700',
  },
  {
    href: '/dashboard/cooper-token-financeiro',
    titulo: 'Financeiro Tokens',
    descricao: 'Movimentação financeira do CooperToken (compras, taxas, resgates).',
    icon: LineChart,
    corIcone: 'text-indigo-600',
  },
  // Sprint Clube P1 — Fase 1.5 Bloco 4 (10/06/2026): card de Configuração da
  // Economia (Taxa de Operação + Oxidação DECAY_CONTINUO). Pagina dedicada
  // em /dashboard/cooper-token/config — substitui a edicao duplicada que
  // estava em /parceiro/configuracoes (la fica so um link agora).
  {
    href: '/dashboard/cooper-token/config',
    titulo: 'Configuração da Economia',
    descricao: 'Taxas de operação (emissão/QR/transferência/resgate) + oxidação dos tokens.',
    icon: Settings,
    corIcone: 'text-slate-700',
  },
  // Sprint Clube P1 — Fase 1.1 (10/06/2026): MLM entra no Clube. O ranking
  // ja era "progressao MLM" no proprio hub; agora indicacoes + convites de
  // indicacao + meu convite tambem ficam centralizados aqui (era 3 itens
  // soltos no menu lateral ADMIN/SUPER_ADMIN). Cooperado/Operador mantem
  // os atalhos diretos no menu — eles nao tem item Clube ainda.
  {
    href: '/dashboard/indicacoes',
    titulo: 'Indicações',
    descricao: 'Programa MLM — cadeia de indicações + bônus em tokens.',
    icon: Users,
    corIcone: 'text-fuchsia-700',
  },
  {
    href: '/dashboard/convites',
    titulo: 'Convites de Indicação',
    descricao: 'Convites para novos cooperados via indicação (MLM).',
    icon: Mail,
    corIcone: 'text-violet-700',
  },
  {
    href: '/dashboard/meu-convite',
    titulo: 'Meu Convite',
    descricao: 'Seu link pessoal de convite + métricas dos seus indicados.',
    icon: UserPlus,
    corIcone: 'text-purple-700',
  },
  // Sprint Higiene Bloco C (14/06/2026): op admin-token movida de
  // /parceiro/enviar-tokens pra /dashboard/cooper-token/enviar.
  {
    href: '/dashboard/cooper-token/enviar',
    titulo: 'Enviar Tokens',
    descricao: 'Crédito manual de CooperTokens pra cooperado (operação admin).',
    icon: Send,
    corIcone: 'text-teal-700',
  },
];

export default function ClubeHubPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Clube</h1>
        <p className="text-sm text-slate-500 mt-1">
          Tudo do Clube num lugar só — moeda, vantagens, planos e financeiro.
        </p>
      </div>

      {/* Help inline (regra UX 19/05) */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 flex gap-3">
        <Info className="h-5 w-5 text-blue-700 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-900">
          <p className="font-semibold mb-1">O que fica aqui</p>
          <p>
            Aqui fica tudo do Clube — a <strong>moeda</strong> (CooperToken),
            as <strong>vantagens</strong>, os <strong>planos</strong> e o{' '}
            <strong>financeiro</strong>. Cada card abre uma função que já
            existia no menu — só foram reunidas pra ficar fácil de achar.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {CARDS.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.href}
              href={card.href}
              className="group focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 rounded-lg"
            >
              <Card className="h-full transition-all hover:shadow-md hover:border-cyan-300 cursor-pointer">
                <CardContent className="p-5 flex gap-4 items-start">
                  <div
                    className={`shrink-0 rounded-lg bg-slate-50 p-3 group-hover:bg-white transition-colors`}
                  >
                    <Icon className={`h-6 w-6 ${card.corIcone}`} />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-base font-semibold text-slate-900 group-hover:text-cyan-800">
                      {card.titulo}
                    </h2>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      {card.descricao}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
