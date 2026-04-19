# Implementacoes - 2026-04-01

## 1. CONV-02: Fix bug MLM duplicado (URGENTE)

**Arquivo:** `backend/src/convite-indicacao/convite-indicacao.service.ts`

**Problema:** O metodo `concluirCadastro` criava indicacoes nivel 1 duplicadas quando chamado mais de uma vez para o mesmo cooperado.

**Solucao:** Adicionada verificacao de duplicata antes do `tx.indicacao.create`:
- Busca indicacao existente com `findFirst({ where: { cooperadoIndicadoId, nivel: 1 } })`
- Se ja existe, retorna a indicacao existente com log de warning
- Se nao existe, cria normalmente

---

## 2. Dashboard de Convites com Configuracao de Lembretes

### 2a. Backend - Endpoints

**Arquivo:** `backend/src/convite-indicacao/convite-indicacao.controller.ts`

Novos endpoints:
- `GET /convite-indicacao/dashboard` - Lista paginada com filtros (status, periodo, page)
- `GET /convite-indicacao/stats` - Totais por status para cards
- `GET /convite-indicacao/config-lembretes` - Busca configuracao atual de lembretes
- `PUT /convite-indicacao/config-lembretes` - Salva configuracao (ADMIN/SUPER_ADMIN)

### 2b. Backend - Service

**Arquivo:** `backend/src/convite-indicacao/convite-indicacao.service.ts`

Novos metodos:
- `getDashboard()` - Retorna convites com campos: nomeConvidado, telefoneConvidado, dataConvite, status, tentativasLembrete, ultimoLembrete, indicadoPor
- `getStats()` - Reutiliza `getEstatisticas()` existente
- `getConfigLembretes()` - Busca config via ConfigTenant (chaves: cooldownDias, maxTentativas, habilitado)
- `salvarConfigLembretes()` - Upsert das configs no ConfigTenant

Config armazenada via `ConfigTenant` com chaves:
- `convite.lembrete.cooldownDias` (padrao: 3)
- `convite.lembrete.maxTentativas` (padrao: 3)
- `convite.lembrete.habilitado` (padrao: true)

### 2c. Frontend - Pagina de Dashboard

**Arquivo:** `web/app/dashboard/convites/page.tsx` (NOVO)

Funcionalidades:
- Cards: Total enviados, Pendentes, Convertidos, Expirados
- Tabela paginada: Telefone, Indicado por, Data envio, Status badge, Tentativas, Ultimo lembrete, Acoes
- Filtros: status (dropdown), periodo (7/30/90 dias)
- Botao "Reenviar" por linha (convites PENDENTE/LEMBRETE_ENVIADO)
- Secao "Config. Lembretes" com formulario: cooldown dias, max tentativas, toggle habilitar

**Arquivo:** `web/app/dashboard/layout.tsx`

- Adicionado item "Convites" (icone Mail) no menu lateral para ADMIN, SUPER_ADMIN e OPERADOR

---

## 3. Bugs QA Corrigidos

### WA-BOT-04: Limpeza cooperados PROXY_* zumbi

**Arquivo:** `backend/src/cooperados/cooperados.job.ts`

Novo cron job `limparCooperadosProxyZumbi()`:
- Roda as 03:00
- Deleta cooperados com CPF `PROXY_*`, status `PENDENTE`, criados ha mais de 24h
- Somente se nao tem contratos vinculados (`contratos: { none: {} }`)

### CLB-02: Validacao de ranges no upsertConfig do Clube

**Arquivo:** `backend/src/clube-vantagens/clube-vantagens.service.ts`

Validacoes adicionadas no metodo `upsertConfig()`:
- `kwhMinimo >= 0` - Nao permite valores negativos
- `kwhMaximo > kwhMinimo` - Maximo deve ser maior que minimo
- `beneficioPercentual` entre 0 e 100 - Percentual valido
- Validacao pre-existente de sobreposicao de faixas mantida

### PC-05: Grafico UC ignora ucId

**Arquivo:** `backend/src/cooperados/cooperados.service.ts`

Correcao no metodo `minhasCobrancas()`:
- Alterado filtro Prisma de spread operator para construcao explicita com `is:`
- `contrato: { is: contratoWhere }` garante que o filtro ucId e aplicado corretamente

---

## Verificacao

- `npm run build` (nest build): OK
- `npx tsc --noEmit`: OK (zero erros)
- `pm2 restart cooperebr-backend`: OK (status: online)
