# Modo Observador (Shadow Mode) — Fases A + B Implementadas

**Data:** 26/03/2026

---

## Fase A — Schema + API Backend

### Prisma Schema
- **ObservacaoAtiva** (`observacoes_ativas`): modelo principal com observadorId, observadoId/Telefone, escopo, expiresAt, cooperativaId
- **LogObservacao** (`logs_observacao`): auditoria imutável (ATIVADA, ENCERRADA, MENSAGEM_ESPELHADA, ACAO_REGISTRADA)
- **EscopoObservacao** enum: WHATSAPP_ENVIADO, WHATSAPP_RECEBIDO, WHATSAPP_TOTAL, ACOES_PLATAFORMA, TUDO
- Relations adicionadas em Usuario (@relation("Observador")) e Cooperativa
- `prisma db push` executado com sucesso

### Módulo NestJS (`backend/src/observador/`)
- **observador.module.ts**: importa WhatsappModule (forwardRef), exporta ObservadorService
- **observador.service.ts**:
  - `ativar(dto, perfil)` — cria observação, limite de 10 para ADMIN, expiração padrão 4h
  - `encerrar(id, usuarioId)` — desativa + notifica observador via WhatsApp
  - `listarAtivas(cooperativaId, observadorId, perfil)` — filtra por perfil
  - `historico(cooperativaId, perfil)` — últimas 24h encerradas
  - `espelharMensagem(telefone, texto, direcao)` — busca observações ativas compatíveis, reenvia formatado
  - `registrarAcao(observadoId, descricao)` — para ações na plataforma
  - `@Cron(EVERY_5_MINUTES) expirarAutomaticas()` — encerra expiradas + notifica
- **observador.controller.ts**:
  - `POST /observador` — ativar (SUPER_ADMIN, ADMIN)
  - `DELETE /observador/:id` — encerrar
  - `GET /observador` — listar ativas
  - `GET /observador/historico` — últimas 24h
  - `GET /observador/buscar-usuarios?q=` — autocomplete para modal

### Integração WhatsApp
- **WhatsappSenderService.enviarMensagem()**: após enviar, chama `observadorService.espelharMensagem(tel, texto, 'ENVIADA')`
- **WhatsappBotService.processarMensagem()**: ao receber, chama `observadorService.espelharMensagem(tel, corpo, 'RECEBIDA')`
- Dependência circular resolvida com `forwardRef`

### Controle de acesso
- SUPER_ADMIN: qualquer cooperativa, sem limite
- ADMIN: apenas sua cooperativa, max 10 simultâneas
- OPERADOR/COOPERADO: sem acesso

---

## Fase B — Frontend

### Página `/dashboard/observador`
- Lista de observações ativas com indicador visual (verde=ativo, cinza=encerrado)
- Tabs: Ativas / Histórico 24h
- Cada card mostra: telefone/nome, escopo, tempo restante, botão Encerrar
- Auto-refresh a cada 30 segundos

### Modal de Ativação
- Busca por nome/CPF/telefone com autocomplete
- Campo de telefone manual
- Dropdown de escopo (5 opções)
- Seletor de expiração (1h / 4h / 24h / Sem expiração)
- Campo de motivo opcional
- Botão "Ativar Observação"

### Ícone Rápido
- Ícone de olho (Eye) ao lado do nome do cooperado na tabela `/dashboard/cooperados`
- Ao clicar: abre modal de ativação com usuário preenchido (via window.__observadorAbrirModal ou redirect)

### Navegação
- Item "Observador" adicionado na sidebar em Administração (ADMIN/SUPER_ADMIN)

---

## Arquivos criados/modificados

### Criados:
- `backend/src/observador/observador.module.ts`
- `backend/src/observador/observador.service.ts`
- `backend/src/observador/observador.controller.ts`
- `web/app/dashboard/observador/page.tsx`

### Modificados:
- `backend/prisma/schema.prisma` — 2 models + 1 enum + 2 relations
- `backend/src/app.module.ts` — import ObservadorModule
- `backend/src/whatsapp/whatsapp.module.ts` — import ObservadorModule (forwardRef)
- `backend/src/whatsapp/whatsapp-sender.service.ts` — inject ObservadorService, espelhar ENVIADA
- `backend/src/whatsapp/whatsapp-bot.service.ts` — inject ObservadorService, espelhar RECEBIDA
- `web/app/dashboard/layout.tsx` — nav item Observador
- `web/app/dashboard/cooperados/page.tsx` — Eye icon na tabela

---

## Validação
- `prisma db push` ✅
- `npx tsc --noEmit` ✅ (0 erros)
