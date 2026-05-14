import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Turbopack (padrão Next.js 16) tem suporte nativo ao Tailwind v4
  // NÃO usar webpack nem postcss junto com Turbopack — causa rebuild loop

  // Fase 2H — redirect 301 legacy /parceiro/membros/* → /dashboard/cooperados/*.
  // O legacy era origem do cross-talk B1 (13/05). Com Fase 2A-2E IDOR fixes
  // server-side já consolidados, a fonte única passa a ser /dashboard/cooperados.
  async redirects() {
    return [
      {
        source: '/parceiro/membros',
        destination: '/dashboard/cooperados',
        permanent: true,
      },
      {
        source: '/parceiro/membros/:path*',
        destination: '/dashboard/cooperados/:path*',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
