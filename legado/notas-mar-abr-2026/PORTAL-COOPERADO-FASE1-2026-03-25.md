# Portal do Cooperado — Fase 1 (2026-03-25)

## O que foi implementado

### Backend
- `GET /cooperados/meu-perfil` — retorna dados do cooperado logado (match por CPF/email do JWT) com resumo (desconto, próximo vencimento, status, kWh, docs/faturas pendentes)
- `PUT /cooperados/meu-perfil` — cooperado edita seus próprios dados (nome, email, telefone — campos seguros apenas)

### Frontend

**Middleware (`web/middleware.ts`)**
- Protege `/portal/*` — exige token + perfil COOPERADO
- `/portal/login` acessível sem auth; redireciona se já logado como COOPERADO
- Admins/SUPER_ADMIN/OPERADOR redirecionados para `/dashboard`

**Auth (`web/lib/auth.ts`)**
- `logoutPortal()` — limpa cookies e redireciona para `/portal/login`

**Layout (`web/app/portal/layout.tsx`)**
- Mobile-first, sem sidebar
- Header: logo + nome do membro + link Minha Conta + botão Sair
- Bottom nav: Início | UCs | Financeiro | Documentos | Indicações
- Login page renderiza sem shell

**Login (`web/app/portal/login/page.tsx`)**
- Campo único CPF/email/celular + senha
- Valida que perfil é COOPERADO após login
- Link "Esqueci minha senha" → /esqueci-senha
- Texto "Primeiro acesso? Entre em contato com seu parceiro."

**Início (`web/app/portal/page.tsx`)**
- Card boas-vindas com nome
- Card resumo: desconto %, próximo vencimento, status da conta
- Card créditos: kWh alocados
- Card alertas: docs pendentes + faturas em aberto (badges vermelhos)
- Botão WhatsApp para enviar convite com link de indicação

**Minha Conta (`web/app/portal/conta/page.tsx`)**
- Dados pessoais: nome, CPF (readonly), email, telefone
- Alterar senha: senha atual + nova + confirmar (POST /auth/alterar-senha)
- Seção informativa sobre recuperação de senha

## Próximas fases
- Fase 2: UCs (listar UCs do cooperado)
- Fase 3: Financeiro (cobranças, boletos, histórico)
- Fase 4: Documentos (upload, status)
- Fase 5: Indicações (link de referral, histórico)
