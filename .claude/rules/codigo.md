# Regra: Padrões de Código

## Geral

- **TypeScript strict** — sem `any` exceto em casos extremos (documentar o porquê)
- **Prisma** — nunca SQL raw em produção; sempre migrations (`prisma migrate dev`)
- **`npx prisma db push`** — apenas em desenvolvimento local, nunca em prod
- **Variáveis de ambiente** — nunca hardcodar credenciais; sempre via `.env`

## Backend (NestJS)

```typescript
// Estrutura de módulo padrão
src/modules/<dominio>/
  <dominio>.module.ts
  <dominio>.controller.ts
  <dominio>.service.ts
  dto/
    create-<dominio>.dto.ts
    update-<dominio>.dto.ts
```

- DTOs com `class-validator` para toda entrada
- Services retornam dados, Controllers retornam responses HTTP
- Erros: usar `HttpException` ou as exceções do NestJS (`NotFoundException`, etc.)
- Transações Prisma para operações que afetam múltiplas tabelas

## Frontend (Next.js)

- App Router — arquivos em `app/`
- Componentes server-side por padrão; `'use client'` só quando necessário
- Shadcn/UI para componentes — não reinventar
- Tailwind para estilos — sem CSS modules

## WhatsApp Service

- Estados de conversa persistidos no banco (não em memória)
- Timeout de sessão: verificar config atual
- Nunca enviar mensagem duplicada — verificar `WA-BOT-06`

## Shell (PowerShell)

- Encadear comandos com `;` (não `&&`)
- Exemplo: `cd backend; npm install`
