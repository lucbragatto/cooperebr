// PostCSS config mantido para compatibilidade com ferramentas de build (next build)
// Em desenvolvimento com Turbopack, este arquivo é ignorado
// O Tailwind v4 é processado nativamente pelo Turbopack via @import "tailwindcss"
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
