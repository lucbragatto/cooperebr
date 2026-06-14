import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Turbopack (padrão Next.js 16) tem suporte nativo ao Tailwind v4
  // NÃO usar webpack nem postcss junto com Turbopack — causa rebuild loop

  // Fase 2H — redirect 301 legacy /parceiro/membros/* → /dashboard/cooperados/*.
  // O legacy era origem do cross-talk B1 (13/05). Com Fase 2A-2E IDOR fixes
  // server-side já consolidados, a fonte única passa a ser /dashboard/cooperados.
  //
  // Sprint Higiene de Rotas (14/06/2026 — Decisão Luciano D1): convergência
  // /parceiro/* → /dashboard/*. As 19 telas-fantasma (redirects + re-exports)
  // foram deletadas. Estes 301s preservam deep-links externos (emails antigos,
  // bookmarks, links em docs).
  async redirects() {
    return [
      // Legacy 2H (mantido)
      { source: '/parceiro/membros', destination: '/dashboard/cooperados', permanent: true },
      { source: '/parceiro/membros/:path*', destination: '/dashboard/cooperados/:path*', permanent: true },

      // Higiene: mesma slug em /dashboard (14 redirects diretos)
      { source: '/parceiro/cobrancas', destination: '/dashboard/cobrancas', permanent: true },
      { source: '/parceiro/cobrancas/:path*', destination: '/dashboard/cobrancas/:path*', permanent: true },
      { source: '/parceiro/whatsapp', destination: '/dashboard/whatsapp', permanent: true },
      { source: '/parceiro/whatsapp/:path*', destination: '/dashboard/whatsapp/:path*', permanent: true },
      { source: '/parceiro/indicacoes', destination: '/dashboard/indicacoes', permanent: true },
      { source: '/parceiro/indicacoes/:path*', destination: '/dashboard/indicacoes/:path*', permanent: true },
      { source: '/parceiro/convenios', destination: '/dashboard/convenios', permanent: true },
      { source: '/parceiro/convenios/:path*', destination: '/dashboard/convenios/:path*', permanent: true },
      { source: '/parceiro/usuarios', destination: '/dashboard/usuarios', permanent: true },
      { source: '/parceiro/usuarios/:path*', destination: '/dashboard/usuarios/:path*', permanent: true },
      { source: '/parceiro/clube-vantagens', destination: '/dashboard/clube-vantagens', permanent: true },
      { source: '/parceiro/clube-vantagens/:path*', destination: '/dashboard/clube-vantagens/:path*', permanent: true },
      { source: '/parceiro/usinas', destination: '/dashboard/usinas', permanent: true },
      { source: '/parceiro/usinas/:path*', destination: '/dashboard/usinas/:path*', permanent: true },
      { source: '/parceiro/contratos', destination: '/dashboard/contratos', permanent: true },
      { source: '/parceiro/contratos/:path*', destination: '/dashboard/contratos/:path*', permanent: true },
      { source: '/parceiro/planos', destination: '/dashboard/planos', permanent: true },
      { source: '/parceiro/planos/:path*', destination: '/dashboard/planos/:path*', permanent: true },
      { source: '/parceiro/ucs', destination: '/dashboard/ucs', permanent: true },
      { source: '/parceiro/ucs/:path*', destination: '/dashboard/ucs/:path*', permanent: true },
      { source: '/parceiro/modelos-cobranca', destination: '/dashboard/modelos-cobranca', permanent: true },
      { source: '/parceiro/modelos-cobranca/:path*', destination: '/dashboard/modelos-cobranca/:path*', permanent: true },
      { source: '/parceiro/condominios', destination: '/dashboard/condominios', permanent: true },
      { source: '/parceiro/condominios/:path*', destination: '/dashboard/condominios/:path*', permanent: true },
      { source: '/parceiro/relatorios', destination: '/dashboard/relatorios', permanent: true },
      { source: '/parceiro/relatorios/:path*', destination: '/dashboard/relatorios/:path*', permanent: true },
      { source: '/parceiro/motor-proposta', destination: '/dashboard/motor-proposta', permanent: true },
      { source: '/parceiro/motor-proposta/:path*', destination: '/dashboard/motor-proposta/:path*', permanent: true },

      // Higiene: financeiro (root + 4 sub-pages)
      { source: '/parceiro/financeiro', destination: '/dashboard/financeiro', permanent: true },
      { source: '/parceiro/financeiro/:path*', destination: '/dashboard/financeiro/:path*', permanent: true },

      // Higiene: faturas → faturas/central (estava re-exportada do central)
      { source: '/parceiro/faturas', destination: '/dashboard/faturas/central', permanent: true },

      // Higiene: configuracoes (mesma slug — foi movida pra /dashboard/configuracoes)
      { source: '/parceiro/configuracoes', destination: '/dashboard/configuracoes', permanent: true },
      { source: '/parceiro/configuracoes/:path*', destination: '/dashboard/configuracoes/:path*', permanent: true },

      // Higiene: convites → convites-pessoas (renomeado pra desambiguar
      // do /dashboard/convites que é "gerenciar convites de indicação")
      { source: '/parceiro/convites', destination: '/dashboard/convites-pessoas', permanent: true },
      { source: '/parceiro/convites/:path*', destination: '/dashboard/convites-pessoas/:path*', permanent: true },

      // Higiene: agregadores → administradoras (slug canônica do backend)
      { source: '/parceiro/agregadores', destination: '/dashboard/administradoras', permanent: true },
      { source: '/parceiro/agregadores/:path*', destination: '/dashboard/administradoras/:path*', permanent: true },

      // Higiene: home /parceiro → /dashboard (rotaPorContexto.admin_parceiro também muda)
      { source: '/parceiro', destination: '/dashboard', permanent: true },
    ];
  },
};

export default nextConfig;
