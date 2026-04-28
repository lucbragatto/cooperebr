# Correções Wizard & WhatsApp — 2026-03-25

## Wizard Membro

### WZ-01: Validação por step (steps 3-6)
- **Arquivo:** `web/app/dashboard/cooperados/novo/page.tsx`
- **Problema:** Steps 3-6 retornavam `null` na validação, permitindo avançar sem completar etapas obrigatórias
- **Correção:** Adicionadas validações:
  - Step 3 (Simulação): exige `planoSelecionadoId` ou `simulacao`
  - Step 4 (Proposta): exige `propostaAceita === true`
  - Step 5 (Documentos): exige pelo menos 1 documento
  - Step 6 (Contrato): exige `contratoGerado === true`
- **Commit:** `256cba7`

### WZ-02: Fallback silencioso de 15% no desconto
- **Arquivo:** `web/app/dashboard/cooperados/novo/steps/Step7Alocacao.tsx`
- **Problema:** `simulacaoData.simulacao?.desconto ?? 15` usava fallback hardcoded de 15%
- **Correção:** Removido fallback; adicionado guard no início de `finalizar()` que bloqueia se `simulacao` ausente e usina selecionada
- **Commit:** `256cba7`

### WZ-03: cooperativaId ausente na criação do cooperado
- **Arquivos:** `backend/src/cooperados/cooperados.controller.ts`, `dto/create-cooperado.dto.ts`, `cooperados.service.ts`
- **Problema:** Cooperado era criado sem vínculo com cooperativa
- **Correção:** Backend agora injeta `cooperativaId` do `req.user.cooperativaId` automaticamente; DTO e service atualizados para aceitar o campo
- **Commit:** `256cba7`

## Wizard Parceiro

### WP-01: Step3Espera com cooperativaId undefined
- **Arquivo:** `web/app/dashboard/parceiros/novo/steps/Step3Espera.tsx`
- **Problema:** Step3 tentava usar cooperativaId que ainda não existia
- **Correção:** O código já tinha guard (`if (!cooperativaId) return`), mas faltava UX clara. Adicionada mensagem informando que a etapa é opcional até criação do parceiro
- **Commit:** `5b504a9`

## WhatsApp

### WA-01: Race condition em criação de conversa
- **Arquivo:** `backend/src/whatsapp/whatsapp-bot.service.ts`
- **Problema:** `findUnique` + `create` separados permitiam race condition com mensagens concorrentes
- **Correção:** Substituído por `prisma.conversaWhatsapp.upsert` atômico
- **Commit:** `8975b7b`

### WA-02: Busca por telefone com slice(-8)
- **Arquivo:** `backend/src/whatsapp/whatsapp-bot.service.ts` (2 ocorrências)
- **Problema:** `telefoneNorm.slice(-8)` podia casar múltiplos cooperados com sufixo igual
- **Correção:** Busca agora usa telefone completo com normalização via OR: telefone puro, sem DDI 55, com DDI 55
- **Commit:** `8975b7b`

### WA-04: Webhook não awaita processarMensagem
- **Arquivo:** `backend/src/whatsapp/whatsapp-fatura.controller.ts`
- **Problema:** `.catch()` em fire-and-forget causava falhas silenciosas sem stack trace
- **Correção:** Adicionado `await` + `try/catch` com log completo (mensagem + stack)
- **Commit:** `01c716b`
