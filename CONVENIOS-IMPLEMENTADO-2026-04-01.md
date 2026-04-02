# Modulo Convenios/Parcerias - Implementado

**Data**: 2026-04-01
**Status**: Implementado e rodando em producao

---

## 1. O QUE FOI IMPLEMENTADO POR FASE

### Fase 1: Schema Prisma + Migrations
- 4 novos enums: `TipoConvenio`, `StatusConvenio`, `StatusMembroConvenio`, `EfeitoMudancaFaixa`
- `ContratoConvenio` expandido com 17 novos campos (tipo, conveniado, configBeneficio, cache de faixa, vinculos)
- `ConvenioCooperado` expandido com 6 novos campos (dataAdesao, descontoOverride, status, indicacaoId)
- Novo modelo `HistoricoFaixaConvenio` criado
- Relacoes inversas em `Cooperado`, `Condominio`, `Administradora`, `Indicacao`
- Indices otimizados: `cooperativaId+status`, `convenioId+status`, `convenioId+ativo`, `cooperadoId`
- Schema aplicado via `prisma db push`, client regenerado

### Fase 2: CRUD Convenio (backend)
- `convenios.service.ts` — CRUD completo com validacao de faixas, geracao de numero com retry P2002
- `convenios.controller.ts` — 15 endpoints REST com tenant isolation via cooperativaId
- `convenios.dto.ts` — DTOs com class-validator (CreateConvenioDto, UpdateConvenioDto, AddMembroDto, etc.)
- Criacao automatica de cooperado SEM_UC para conveniado sem UC

### Fase 3: Gestao de Membros + Indicacao Automatica
- `convenios-membros.service.ts` — adicionar/remover/update membro
- Validacao: cooperado so pode ser membro de 1 convenio por vez
- Validacao: cooperado deve pertencer a mesma cooperativa (cross-tenant check)
- Indicacao automatica ao adicionar membro (quando `registrarComoIndicacao=true`)
- Import em massa otimizado (1 recalculo no final, nao N+1)
- Reativacao de membros previamente desligados

### Fase 4: Progressao de Faixas
- `convenios-progressao.service.ts` — calculo de faixa baseado em configBeneficio JSON
- Faixa sobe E desce conforme numero de membros ativos
- Cache atualizado no convenio (faixaAtualIndex, membrosAtivosCache, descontoMembrosAtual, descontoConveniadoAtual)
- Historico registrado em HistoricoFaixaConvenio a cada mudanca
- Recalculo automatico ao adicionar/remover membro e ao alterar configBeneficio
- `convenios.job.ts` — cron diario as 3h para reconciliacao de faixas

### Fase 5: Integracao Desconto
- `configuracao-cobranca.service.ts` expandido — desconto do convenio e ADITIVO ao desconto base
- Hierarquia: contrato.override -> usina -> cooperativa (desconto base) + convenio (aditivo)
- Cap de 100% no total (base + convenio)
- Desconto de membro (override individual ou faixa do convenio)
- Desconto de conveniado (acumula de todos os convenios que representa, com cap por convenio)

### Fase 6: Portal do Conveniado (backend)
- `convenios-portal.controller.ts` — endpoints /convenios/meus e /convenios/meus/:id/dashboard
- Dashboard: faixa atual, proxima faixa, membros, historico, progresso
- Verificacao de ownership (conveniadoId = cooperadoId do JWT)

### Fase 7: Frontend Admin
- `web/app/dashboard/convenios/page.tsx` — listagem com busca, tipo, status
- `web/app/dashboard/convenios/novo/page.tsx` — formulario criacao com faixas editaveis
- `web/app/dashboard/convenios/[id]/page.tsx` — detalhe com cards resumo, faixas visuais, membros, historico
- Item "Convenios" adicionado na nav do dashboard (secao Operacional)

### Fase 8: Frontend Portal
- `web/app/portal/convenio/page.tsx` — dashboard do conveniado
- Cards: membros ativos, faixa atual, desconto membros, desconto conveniado
- Barra de progresso para proxima faixa
- Lista de membros e historico de progressao
- Suporte a multiplos convenios (seletor quando conveniado de N)
- Item "Meu Convenio" adicionado na nav do portal

### Fase 9: Notificacoes
- WhatsApp: `notificarFaixaConvenioAlterada()` — ao mudar de faixa
- WhatsApp: `notificarMembroConvenioAdicionado()` — ao ser adicionado a convenio
- Email: `templateRelatorioConvenio()` — template de relatorio mensal

---

## 2. ARQUIVOS CRIADOS

| Arquivo | Descricao |
|---------|-----------|
| `backend/src/convenios/convenios.module.ts` | Modulo NestJS |
| `backend/src/convenios/convenios.controller.ts` | Controller admin (15 endpoints) |
| `backend/src/convenios/convenios-portal.controller.ts` | Controller portal conveniado |
| `backend/src/convenios/convenios.service.ts` | Servico principal (CRUD + relatorio + portal) |
| `backend/src/convenios/convenios-membros.service.ts` | Servico de membros (add/remove/import) |
| `backend/src/convenios/convenios-progressao.service.ts` | Servico de progressao de faixas |
| `backend/src/convenios/convenios.job.ts` | Cron reconciliacao diaria |
| `backend/src/convenios/convenios.dto.ts` | DTOs com validacao |
| `web/app/dashboard/convenios/page.tsx` | Listagem admin |
| `web/app/dashboard/convenios/novo/page.tsx` | Formulario criacao |
| `web/app/dashboard/convenios/[id]/page.tsx` | Detalhe/edicao + membros + progressao |
| `web/app/portal/convenio/page.tsx` | Dashboard portal conveniado |

---

## 3. ARQUIVOS MODIFICADOS

| Arquivo | Alteracao |
|---------|-----------|
| `backend/prisma/schema.prisma` | Enums, campos ContratoConvenio/ConvenioCooperado, HistoricoFaixaConvenio, relacoes |
| `backend/src/app.module.ts` | Import ConveniosModule |
| `backend/src/configuracao-cobranca/configuracao-cobranca.service.ts` | resolverDesconto() expandido com desconto aditivo de convenio |
| `backend/src/financeiro/convenios.service.ts` | Correcao tipo cnpj nullable |
| `backend/src/whatsapp/whatsapp-ciclo-vida.service.ts` | Notificacoes de faixa e membro |
| `backend/src/email/email-templates.ts` | Template relatorio convenio |
| `web/app/dashboard/layout.tsx` | Nav: item Convenios |
| `web/app/portal/layout.tsx` | Nav: item Meu Convenio |

---

## 4. ENDPOINTS DISPONIVEIS

```
# CRUD Convenio (ADMIN)
POST   /convenios                          - Criar convenio
GET    /convenios                          - Listar (paginado, filtros tipo/status/busca)
GET    /convenios/:id                      - Detalhe com membros e historico
PATCH  /convenios/:id                      - Atualizar
DELETE /convenios/:id                      - Encerrar (soft delete)

# Membros (ADMIN/OPERADOR)
GET    /convenios/:id/membros              - Listar membros
POST   /convenios/:id/membros              - Adicionar membro
PATCH  /convenios/:id/membros/:cooperadoId - Override desconto/matricula
DELETE /convenios/:id/membros/:cooperadoId - Desligar membro
POST   /convenios/:id/importar             - Import em massa

# Progressao (ADMIN/OPERADOR)
GET    /convenios/:id/progressao           - Faixa atual + historico
POST   /convenios/:id/recalcular           - Forcar recalculo (admin)

# Relatorio (ADMIN/OPERADOR)
GET    /convenios/:id/relatorio            - Relatorio mensal (JSON ou CSV)

# Portal Conveniado (COOPERADO)
GET    /convenios/meus                     - Meus convenios
GET    /convenios/meus/:id/dashboard       - Dashboard do conveniado
```

---

## 5. TELAS CRIADAS

| Rota | Descricao |
|------|-----------|
| `/dashboard/convenios` | Listagem de convenios com busca e filtros |
| `/dashboard/convenios/novo` | Formulario de criacao com faixas progressivas |
| `/dashboard/convenios/[id]` | Detalhe: cards resumo, faixas visuais, gestao membros, historico |
| `/portal/convenio` | Dashboard do conveniado: faixa, progresso, membros |

---

## 6. RESULTADO DOS SUBAGENTES REVISORES

### Architect Agent
- **Aprovado**: estrategia de migracao, separacao em servicos, desconto aditivo, historico de faixas
- **Sugestoes aplicadas**: refatoracao resolverDesconto, validacao 1 convenio por membro

### Database Reviewer
- **Aprovado**: tipos Decimal(5,2), schema HistoricoFaixaConvenio, cache membrosAtivosCache
- **Ajustes aplicados**: indices compostos (cooperativaId+status, convenioId+status)
- **Pendencias futuras**: indice parcial WHERE status='ATIVO', FK cooperativaId, onDelete explicitos

### Security Reviewer
- **3 HIGH corrigidos**:
  - HIGH-1: Tenant isolation em todos endpoints by-id (cooperativaId passado do controller)
  - HIGH-2: Status validado com enum StatusConvenioDto
  - HIGH-3: Cross-tenant cooperado check em adicionarMembro
- **MEDIUM-2 corrigido**: randomUUID() para CPF/email de SEM_UC
- **Pendencias MEDIUM**: validacao formato email/cnpj, DTO importacao, CSV injection sanitization

### Code Reviewer
- **CRITICAL corrigido**: race condition gerarNumero() — retry com P2002
- **HIGH corrigidos**:
  - Import em massa otimizado (1 recalculo, nao N+1)
  - Recalculo faixa ao alterar configBeneficio
  - resolverDescontoConvenio unificado em configuracao-cobranca
- **Pendencia**: remover/redirecionar rotas duplicadas em financeiro/convenios.service.ts

### TypeScript Reviewer
- **Corrigidos**: enum comparison (`TipoConvenioDto.CONDOMINIO`), `ConfigBeneficio` exportado como tipo compartilhado, `as any` substituido por tipo correto em controller e service, import nao usado removido (`Decimal`), spread order fix no dashboardConveniado
- **Pendencias MEDIUM (nao bloqueiam)**: `req: any` nos controllers (padrao do projeto), `key={i}` em listas de faixas no frontend, tipagem `useState<any>` no frontend, error handling em `.catch()` no frontend

### TDD Guide
- **40 testes passando** em `convenios-progressao.service.spec.ts`
- Cobertura: 85% statements, 91% branches, 83% functions
- Testes de `calcularFaixa` (logica pura): 0, 1, 5, 12, 100 membros, faixas desordenadas, faixa unica
- Testes de `validarFaixas`: gaps, overlaps, limites 0-100
- Testes de `recalcularFaixa`: cache, historico, membros zerados, convenio inexistente

---

## 7. PENDENCIAS E LIMITACOES

### Para resolver em breve:
1. **Rotas duplicadas**: financeiro/convenios.service.ts ainda ativo — redirecionar para novo modulo
2. **Validacao formato**: email/cnpj/cpf nos DTOs (usar @IsEmail, @Matches)
3. **CSV injection**: sanitizar campos antes de gerar CSV
4. **DTO importacao**: criar ImportarMembrosDto com @ArrayMaxSize(500)

### Limitacoes conhecidas:
1. Campo `status` em ContratoConvenio permanece `String` (nao enum Prisma) para compatibilidade com dados existentes
2. `EfeitoMudancaFaixa` governa via JSON configBeneficio, nao campo separado
3. Creditos do conveniado SEM_UC: fluxo de conversao em dinheiro nao implementado (requer definicao de negocio)
4. Notificacao WhatsApp ao mudar faixa: template pronto mas nao integrado no fluxo de recalculo (call manual)

---

## 8. DECISOES IMPLEMENTADAS

| # | Decisao | Implementacao |
|---|---------|---------------|
| 1 | Conveniado gestor de N convenios | Sim — acumula beneficios |
| 2 | Cooperado membro de 1 convenio | Sim — validacao em adicionarMembro |
| 3 | Desconto ADITIVO | Sim — soma com base, cap 100% |
| 4 | Faixa sobe E desce | Sim — recalculo bidirecional |
| 5 | Conveniado SEM_UC | Sim — criacao automatica cooperado SEM_UC |
| 6 | Migrar ContratoConvenio | Sim — expandido in-place |
| 7 | Faixas na mesma config JSON | Sim — descontoMembros + descontoConveniado por faixa |
| 8 | Portal extensao | Sim — /portal/convenio como pagina adicional |
