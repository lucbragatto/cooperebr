# Correções Menu Lateral + Modal Usuários — 2026-03-25

## layout.tsx — Menu lateral por perfil

- **Visibilidade por perfil:** Menu agora filtrado por `getNavSections(perfil)`:
  - SUPER_ADMIN: vê tudo (incluindo seção "Gestão Global" com Planos/Faturas SaaS)
  - ADMIN: vê tudo exceto "Gestão Global"
  - OPERADOR: Dashboard, Membros, UCs, Contratos, Cobranças, Ocorrências, WhatsApp, Indicações, Meu Convite
  - COOPERADO: Dashboard, Meu Convite, Indicações
- **Seção "Administração"** criada logo após Dashboard com Usuários + Parceiros (visível para ADMIN e SUPER_ADMIN)
- **Parceiros** agora acessível por ADMIN (antes era só SUPER_ADMIN)
- Nav organizada em seções com títulos: Administração, Operacional, Financeiro, Gestão Global

## usuarios/page.tsx — Modal Novo Usuário

- Label **"Cooperativa" → "Parceiro"**
- Modal ampliado de `sm:max-w-md` para `sm:max-w-lg`
- Perfil padrão mudou de **COOPERADO → OPERADOR**
- **SUPER_ADMIN pode criar outro SUPER_ADMIN** (opção aparece no Select quando `isSuperAdmin`)
- **alert()/confirm() nativos substituídos** por `AlertDialog` shadcn para reset de senha e exclusão (UX-02)
