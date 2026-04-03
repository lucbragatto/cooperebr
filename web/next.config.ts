import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Turbopack (padrão Next.js 16) tem suporte nativo ao Tailwind v4
  // NÃO usar webpack nem postcss junto com Turbopack — causa rebuild loop
};

export default nextConfig;
