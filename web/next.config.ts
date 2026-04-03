import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Configuração vazia — silencia o aviso e usa Turbopack padrão
    // O Fast Refresh foi corrigido via globals.css (source restrita ao web/)
  },
};

export default nextConfig;
