# Recuperação de Senha via WhatsApp — 2026-03-25

## Resumo
Implementada recuperação de senha com suporte a WhatsApp além do email existente.

## Alterações no Backend

### Novos endpoints
- `POST /auth/verificar-canal` — Recebe `{ identificador }` (CPF/email/telefone), retorna `{ temWhatsapp, temEmail, telefone?, email? }` com dados mascarados
- `POST /auth/esqueci-senha-whatsapp` — Recebe `{ identificador }`, gera resetToken (UUID, 1h expiração), envia link via WhatsappSenderService

### Arquivos alterados
- `backend/prisma/schema.prisma` — Adicionados campos `resetToken` (String? @unique) e `resetTokenExpiry` (DateTime?) ao model Usuario
- `backend/src/auth/auth.service.ts` — Novos métodos: `verificarCanal()`, `esqueciSenhaWhatsapp()`, helpers `buscarPorIdentificador()`, `mascararTelefone()`, `mascararEmail()`. Atualizado `esqueciSenha()` para aceitar identificador (não só email). Atualizado `redefinirSenha()` para aceitar token próprio (WhatsApp) além do access_token Supabase
- `backend/src/auth/auth.controller.ts` — Novos endpoints verificar-canal e esqueci-senha-whatsapp
- `backend/src/auth/auth.module.ts` — Importado WhatsappModule para injetar WhatsappSenderService
- `backend/src/auth/dto/identificador.dto.ts` — Novo DTO para endpoints com identificador
- `backend/src/auth/dto/esqueci-senha.dto.ts` — Aceita `email` ou `identificador`
- `backend/src/auth/dto/redefinir-senha.dto.ts` — Aceita `access_token` (Supabase) ou `token` (WhatsApp)

## Alterações no Frontend

### `web/app/esqueci-senha/page.tsx` — Redesenhado em 3 passos:
1. Campo único CPF/email/celular + Continuar
2. Se ambos canais disponíveis: escolha WhatsApp (botão verde com ícone) ou Email
3. Confirmação com mensagem apropriada ao canal

### `web/app/redefinir-senha/page.tsx`
- Adicionado suporte ao query param `?token=XXX` (fluxo WhatsApp) além do `access_token` (Supabase)

## Fluxo de negócio
- Só WhatsApp → envia direto
- Só Email → envia direto
- Ambos → mostra escolha ao usuário
- Nenhum → mensagem "Entre em contato com o administrador"
