'use client';

/**
 * Sprint Higiene de Rotas — Bloco B (14/06/2026, Decisão Luciano D2).
 *
 * Área dedicada do cooperado-ESTABELECIMENTO do Clube CooperToken.
 *
 * Diferente de:
 *   - /portal       (cooperado regular — abater fatura, gerar QR pra usar
 *                    em parceiros, comprar tokens se PJ)
 *   - /conveniada   (empresa cooperada PJ — distribuir tokens em lote
 *                    aos funcionários conveniados)
 *   - /dashboard    (admin do parceiro/SUPER_ADMIN — operação geral)
 *
 * Aqui mora: cooperado que ACEITA CooperToken como meio de pagamento
 * (vende produto/serviço, recebe via QR/PIN F4, resgata em R$ via PIX F6).
 *
 * GUARD: `me.ehEstabelecimento === true` (flag no Cooperado). Sem novo
 * contexto JWT v1 — reusa o contexto 'cooperado'. Cooperado regular que
 * acessar /estabelecimento vê empty-state amber com CTA "Fale com o
 * admin pra ativar o módulo Estabelecimento".
 *
 * Cor de tema: laranja (orange-700/600/50) — distingue do verde (portal/
 * dashboard) + azul (parceiro hoje, /dashboard amanhã) + slate (conveniada).
 */

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  Store,
  QrCode,
  Receipt,
  ShieldCheck,
  LogOut,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { logout, getUsuario } from '@/lib/auth';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { useContexto } from '@/hooks/useContexto';
import ContextoSwitcher from '@/components/ContextoSwitcher';

interface MeuPerfilEstabelecimento {
  id: string;
  ehEstabelecimento?: boolean;
  nomeCompleto?: string;
}

const navItems = [
  { href: '/estabelecimento/receber', label: 'Receber pagamento', icon: QrCode },
  { href: '/estabelecimento/recebimentos', label: 'Recebimentos', icon: Receipt },
  { href: '/estabelecimento/validar', label: 'Validar resgate', icon: ShieldCheck },
];

export default function EstabelecimentoLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [usuario, setUsuario] = useState(getUsuario());
  const [perfil, setPerfil] = useState<MeuPerfilEstabelecimento | null>(null);
  const [carregando, setCarregando] = useState(true);
  const { contextos, contextoAtivo, trocarContexto } = useContexto();

  useEffect(() => {
    setUsuario(getUsuario());
  }, []);

  useEffect(() => {
    let cancelado = false;
    api
      .get<MeuPerfilEstabelecimento>('/cooperados/meu-perfil')
      .then((r) => {
        if (!cancelado) setPerfil(r.data);
      })
      .catch(() => {
        if (!cancelado) setPerfil(null);
      })
      .finally(() => {
        if (!cancelado) setCarregando(false);
      });
    return () => {
      cancelado = true;
    };
  }, []);

  // GUARD: aguarda perfil carregar antes de decidir.
  if (carregando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-orange-50">
        <Loader2 className="h-6 w-6 animate-spin text-orange-700" />
      </div>
    );
  }

  // GUARD: cooperado regular (não-estabelecimento) — empty-state amber.
  if (!perfil?.ehEstabelecimento) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-orange-50 p-6">
        <div className="max-w-md w-full bg-white rounded-lg shadow border border-amber-200 p-6 space-y-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-6 w-6 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-2">
              <h1 className="font-semibold text-gray-900">
                Você ainda não é Estabelecimento do Clube
              </h1>
              <p className="text-sm text-gray-700">
                Esta área é exclusiva de cooperados-Estabelecimento — quem aceita
                CooperToken como meio de pagamento (recebe via QR/PIN dos cooperados
                e resgata em R$ via PIX na chave cadastrada).
              </p>
              <p className="text-sm text-gray-700">
                Fale com o admin da cooperativa pra ativar o módulo Estabelecimento
                no seu cadastro.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Link href="/portal">
              <Button variant="outline" size="sm">
                Voltar pro Portal
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="sm"
              onClick={logout}
              className="text-gray-600 hover:text-red-600"
            >
              <LogOut className="h-3.5 w-3.5 mr-1" />
              Sair
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-orange-50">
      {/* Sidebar laranja distinta */}
      <aside className="w-64 bg-white border-r flex flex-col">
        <div className="px-6 py-5 border-b border-orange-100">
          <div className="flex items-center gap-2">
            <Store className="h-5 w-5 text-orange-700" />
            <div>
              <h1 className="text-base font-bold text-gray-800">Balcão do Clube</h1>
              <p className="text-xs text-orange-700 mt-0.5">
                {perfil.nomeCompleto ?? 'Estabelecimento'}
              </p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/');
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  active
                    ? 'bg-orange-50 text-orange-800'
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
        <header className="bg-white border-b border-orange-100 px-6 py-4 flex items-center justify-between">
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

        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
