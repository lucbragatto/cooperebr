# CONTEXTO-PROJETO — cooperebr

**Referência principal para qualquer desenvolvedor ou agente que trabalhar neste projeto.**
**Atualizado em:** 2026-03-20

---

## 1. O QUE É O COOPEREBR

### Resumo executivo

Plataforma SaaS para gestão de **cooperativas de energia solar** no modelo de **Geração Distribuída (GD)** regulamentado pela ANEEL. O sistema gerencia o ciclo completo: cadastro de cooperados, vinculação a usinas fotovoltaicas, criação de contratos, processamento de faturas da concessionária via OCR (Claude AI), geração de cobranças da cooperativa e distribuição de créditos de energia.

### Stack

- **Backend:** NestJS + Prisma ORM + PostgreSQL (Supabase)
- **Frontend:** Next.js 16 + Shadcn/UI + Tailwind CSS
- **OCR de faturas:** Integração com Claude (Anthropic)
- **Auth:** JWT com roles (SUPER_ADMIN, ADMIN, OPERADOR, COOPERADO)

### Modelo de negócio

1. A cooperativa possui **usinas solares** que geram energia e injetam na rede da distribuidora.
2. **Cooperados** (pessoas físicas/jurídicas) aderem à cooperativa via contrato, recebendo uma cota (%) da geração de uma usina.
3. A concessionária aplica **créditos de energia** na fatura do cooperado proporcionalmente à sua cota.
4. A cooperativa cobra do cooperado um valor com **desconto** sobre o que ele pagaria normalmente à concessionária — o cooperado economiza, a cooperativa margeia a diferença.
5. Regra ANEEL: a **Unidade Consumidora (UC)** do cooperado só pode receber créditos de usina da **mesma distribuidora** (área de concessão).

### Entidades principais (15+ modelos Prisma)

Cooperado, UC (Unidade Consumidora), Usina, Contrato, Cobrança, PropostaCooperado, Plano, Tarifa, FaturaProcessada, Notificação, Documento, Ocorrência, ListaEspera, ConfiguracaoMotor, ConfigTenant.

### Funcionalidades operacionais

- 39+ rotas de API, 20+ páginas no frontend
- Motor de propostas com cálculo de desconto e alocação automática de usina
- Processamento de faturas via OCR inteligente (Claude AI)
- Sistema de notificações com polling automático (30s)
- Dashboard de KPIs administrativo
- Wizard de cadastro COM_UC em 4 etapas integrado ao OCR
- Relatório "Lista Concessionária" por usina (requisito regulatório)

---

## 2. DECISÕES ARQUITETURAIS TOMADAS

### 2.1 Ciclo de vida do Cooperado

```
CADASTRADO → EM_ANALISE → APROVADO → ATIVO → SUSPENSO → ENCERRADO
```

- **APROVADO** = checklist completo, aguarda ativação manual do admin
- **ATIVO** = pode receber cobranças e créditos
- Status legado `PENDENTE` deve ser migrado para `CADASTRADO`

**Estado atual:** O schema ainda usa o enum antigo (PENDENTE, ATIVO, SUSPENSO, ENCERRADO). Migração pendente — requer servidor parado.

### 2.2 Ciclo de vida do Contrato

```
PENDENTE_ATIVACAO → ATIVO → SUSPENSO → ENCERRADO
LISTA_ESPERA (sem usina disponível)
```

- Contrato nasce como **PENDENTE_ATIVACAO** (não ATIVO)
- Quando admin ativa o cooperado → todos contratos PENDENTE_ATIVACAO → ATIVO em cascata
- Cobrança SÓ gerada para contratos ATIVO

**Estado atual:** Enum e default já implementados no schema.

### 2.3 kWh do Contrato — modelo ANUAL

- Base: histórico 12 meses da fatura (admin pode excluir meses discrepantes)
- `kwhContratoAnual` = total 12 meses (ex: 3.420 kWh)
- `kwhContratoMensal` = kwhContratoAnual / 12
- Contrato é anual, renovado automaticamente
- Cancelamento: cooperado avisa com X dias de antecedência, paga durante o aviso

### 2.4 percentualUsina pertence ao CONTRATO

- `Contrato.percentualUsina` = kwhContratoAnual / (usina.capacidadeKwhMensal × 12) × 100
- Soma dos % de todos os contratos ATIVOS + PENDENTE_ATIVACAO de uma usina ≤ 100%
- Validação com transação Prisma (evitar race condition)
- `Cooperado.percentualUsina` é campo legado — deve ser removido

**Estado atual:** Campo existe no Contrato. Campo legado do Cooperado ainda não foi removido.

### 2.5 Regra geográfica ANEEL

- UC só pode ser vinculada a usina da **mesma distribuidora**
- Ao criar contrato/proposta, filtrar usinas por `distribuidora.id` da UC

**Estado atual:** UC tem distribuidora como String nullable. Usina **não tem** campo distribuidora — precisa ser adicionado.

### 2.6 Hierarquia de desconto (cascata)

```
1. Contrato.descontoOverride (não null?) → usa
2. ConfiguracaoCobranca onde usinaId = contrato.usinaId → usa
3. ConfiguracaoCobranca onde usinaId = null (geral da cooperativa) → usa
4. Nenhum → erro "Cooperativa sem plano de cobrança configurado"
```

**Estado atual:** Não implementado. Desconto vem de ConfiguracaoMotor.descontoPadrao (valor único global).

### 2.7 Desconto sobre TUSD+TE

O desconto incide sobre **TUSD + TE** (componentes tarifários). Isso é intencional — protege a margem da cooperativa.

### 2.8 Terminologia oficial

| Antes (confuso) | Correto |
|---|---|
| Aba "Fatura" | "Fatura Concessionária" |
| FaturaProcessada APROVADA | "Dados Conferidos" |
| Aba "Cobranças" | "Cobranças Cooperativa" |
| "Motor Proposta" | manter (técnico) |

---

## 3. O QUE JÁ FOI IMPLEMENTADO (2026-03-20)

### Backend

- [x] Status PENDENTE_ATIVACAO no enum StatusContrato (default no schema)
- [x] Cascata: ativar cooperado → contratos PENDENTE_ATIVACAO → ATIVO (parcial, sem transação)
- [x] Cascata: reativar cooperado → contratos SUSPENSO → ATIVO (RN-04)
- [x] percentualUsina movido de Cooperado para Contrato (parcial — campo legado ainda existe)
- [x] Validação de 100% de capacidade na usina (sem $transaction — race condition possível)
- [x] propostaId FK no modelo Contrato (rastreabilidade proposta↔contrato)
- [x] Verificação de cobranças vinculadas antes de deletar contrato (BUG-06)
- [x] percentualUsina: soma todos contratos ativos em vez de sobrescrever em loop (BUG-08)
- [x] JWT_SECRET lido de .env (mas fallback 'changeme' precisa ser removido)
- [x] ValidationPipe global (parcial — DTOs criados para auth, cooperados, contratos)
- [x] Registro público forçando perfil COOPERADO (SEC-02)

### Frontend

- [x] Lista de cooperados reformulada (usina, contrato, checklist)
- [x] Visão geral com card checklist + botão ativar
- [x] Abas renomeadas (Fatura Concessionária, Cobranças Cooperativa)
- [x] Aba proposta: histórico sempre visível, excluir proposta

### Schema Prisma

- [x] Enum StatusContrato: PENDENTE_ATIVACAO, ATIVO, SUSPENSO, ENCERRADO, LISTA_ESPERA
- [x] Contrato.percentualUsina (Decimal 8,4)
- [x] Contrato.propostaId (FK para PropostaCooperado)
- [ ] **Pendente:** `prisma generate` + `prisma db push` (rodar com servidor parado)

---

## 4. PRÓXIMOS PASSOS — FASE 1 (Estabilização)

Lista priorizada de 12 itens. Devem ser feitos **antes de qualquer deploy em produção**.

| # | Item | Tipo | Arquivos principais |
|---|------|------|---------------------|
| 1 | **Remover fallback JWT "changeme"** — lançar erro se JWT_SECRET indefinido | Segurança crítica | auth.module.ts, jwt.strategy.ts |
| 2 | **Forçar perfil=COOPERADO** no register público | Segurança crítica | auth.controller.ts |
| 3 | **ValidationPipe global + DTOs** com class-validator | Segurança | main.ts, todos os controllers |
| 4 | **Envolver aceitar() em prisma.$transaction** | Integridade | motor-proposta.service.ts |
| 5 | **Race condition percentualUsina** — usar $transaction com SELECT FOR UPDATE | Integridade | contratos.service.ts, motor-proposta.service.ts |
| 6 | **Delete com verificação de dependências** em cooperado, contrato, UC, plano | Integridade | cooperados.service.ts, contratos.service.ts |
| 7 | **findOne() retornar 404** em vez de null com HTTP 200 | Qualidade | todos os services |
| 8 | **Adicionar Usina.distribuidora** (String?) no schema | Schema | schema.prisma |
| 9 | **Remover Cooperado.percentualUsina** (campo legado) | Schema | schema.prisma + grep de referências |
| 10 | **Adicionar campos ao Contrato:** kwhContratoAnual, kwhContratoMensal, descontoOverride, baseCalculoOverride, regrasAplicadas | Schema | schema.prisma |
| 11 | **Rodar prisma generate + db push** | Infra | backend/ |
| 12 | **Centralizar geração de número de contrato** (CTR-YYYY-NNNN) com transação | Integridade | contratos.service.ts, motor-proposta.service.ts |

### Dependências entre itens

- Itens 1–7: podem ser feitos **em paralelo** (sem mudança de schema)
- Itens 8–10: sequenciais (mudanças de schema)
- Item 11: depende de 8–10 estarem concluídos
- Item 12: depende de item 4

---

## 5. PRÓXIMOS PASSOS — FASE 2 (Nova modelagem de planos/cobrança)

**NÃO iniciar antes da FASE 1 estar estável e testada.**

### 5.1 Novo ciclo do Cooperado (requer migração de dados)

1. Adicionar CADASTRADO, EM_ANALISE, APROVADO ao enum StatusCooperado
2. Migrar dados: PENDENTE → CADASTRADO
3. Remover PENDENTE do enum
4. Implementar máquina de estados no service
5. Atualizar frontend para novo fluxo

### 5.2 Nova modelagem de cobrança

| # | Ação | Descrição |
|---|------|-----------|
| 1 | Renomear enum ModeloCobranca → TipoModeloCobrancaLegado | Conflito de nome: enum atual vs model futuro |
| 2 | Criar model **ModeloCobranca** | Campos: tipo (FIXO_MEDIO, COMPENSADO_FIXO, COMPENSADO_DINAMICO), baseCalculo, calculoDesconto, descontoMinimo/Maximo, etc. |
| 3 | Criar model **ConfiguracaoCobranca** | Por cooperativa ou por usina, com vigência, regra de volume, desconto |
| 4 | Criar model **GeracaoMensal** | kWh gerado por usina por mês (inserido pelo admin) |
| 5 | Reformular **Cobrança** | Adicionar: kwhEntregue, kwhConsumido, kwhCompensado, kwhSaldoAnterior, kwhSaldoFinal, precoKwh, snapshots |
| 6 | Migrar dados Plano → ModeloCobranca + ConfiguracaoCobranca | Migration de dados |
| 7 | Implementar **lógica de cascata de desconto** | Contrato → Usina → Cooperativa → erro |
| 8 | Tela de configuração de planos (super admin) | Frontend |
| 9 | Tela de seleção de plano (admin cooperativa) | Frontend |

### 5.3 Fase 3 — Features avançadas (futuro)

- Dashboard do cooperado (saldo de créditos, histórico)
- Relatório para concessionária (por usina, % por UC)
- Renovação automática de contratos
- Antecipação de recebíveis (exportação de dados)
- Notificações automáticas (geração abaixo do previsto, saldo zerado)
- Soft delete em todas as entidades
- Audit trail (userId, ação, timestamp)
- Cron jobs (marcar cobranças VENCIDO, expirar propostas)
- Testes unitários e de integração

---

## 6. REGRAS DE NEGÓCIO CRÍTICAS

### 6.1 Geração Distribuída — ANEEL

- A usina injeta energia na rede da distribuidora.
- Os créditos são distribuídos proporcionalmente entre as UCs dos cooperados vinculados.
- **UC e Usina devem pertencer à mesma distribuidora** (área de concessão). Sem isso, a ANEEL não reconhece os créditos.
- Usina deve estar com `statusHomologacao: EM_PRODUCAO` para receber novos contratos.

### 6.2 Cálculo de kWh

- `kwhContratoAnual` = soma do consumo dos últimos 12 meses da UC (admin pode excluir outliers)
- `kwhContratoMensal` = kwhContratoAnual / 12
- `percentualUsina` = kwhContratoAnual / (usina.capacidadeKwhMensal × 12) × 100
- **Soma de percentualUsina de TODOS os contratos (ATIVO + PENDENTE_ATIVACAO) de uma usina ≤ 100%**
- Se > 100%: contrato vai para LISTA_ESPERA

### 6.3 Modelos de cobrança

Existem 3 modelos (hoje como enum, futuramente como tabela):

| Modelo | Descrição |
|--------|-----------|
| **FIXO_MENSAL** | Cooperado paga valor fixo baseado na média anual de consumo × tarifa × desconto |
| **CREDITOS_COMPENSADOS** | Cobrança baseada na geração real da usina naquele mês × cota do cooperado |
| **CREDITOS_DINAMICO** | Compensação real com saldo acumulado mês a mês (créditos não usados transitam) |

### 6.4 Cálculo do desconto

- O desconto incide sobre **TUSD + TE** (componentes tarifários da fatura da concessionária)
- Isso é **intencional** — protege a margem da cooperativa
- O cálculo pode ser "por fora" (desconto sobre o total) ou "por dentro" (desconto antes de compor o total)
- Faixas de desconto: configuráveis por modelo (descontoMinimo/descontoMaximo)

### 6.5 Hierarquia de desconto (cascata, FASE 2)

```
1. Contrato.descontoOverride → se definido, usa este
2. ConfiguracaoCobranca da usina → se existir para a usina
3. ConfiguracaoCobranca geral da cooperativa → fallback
4. Nenhum configurado → ERRO (impedir geração de cobrança)
```

### 6.6 Contratos

- Contrato é **anual**, renovado automaticamente
- Nasce como **PENDENTE_ATIVACAO** — só vira ATIVO quando admin ativa o cooperado
- Cobrança SÓ é gerada para contratos com status **ATIVO**
- Ao suspender cooperado → contratos ATIVO → SUSPENSO
- Ao reativar cooperado → contratos SUSPENSO → ATIVO
- Deletar contrato: verificar se existem cobranças vinculadas antes

---

## 7. ALERTAS E RISCOS

### CRÍTICOS — podem quebrar o sistema

| Risco | Detalhe | Mitigação |
|-------|---------|-----------|
| **JWT fallback "changeme"** | Se JWT_SECRET não estiver no .env, qualquer pessoa forja tokens | Remover fallback, lançar erro na inicialização |
| **Race condition percentualUsina** | Duas requisições simultâneas podem alocar > 100% de uma usina | Usar prisma.$transaction com isolation SERIALIZABLE |
| **aceitar() sem transação** | 7+ operações sequenciais — falha parcial corrompe dados | Envolver tudo em prisma.$transaction |
| **Conflito de nome ModeloCobranca** | Schema tem enum e FASE 2 quer model com mesmo nome — Prisma não permite | Renomear enum antes de criar model |

### ALTOS — impactam dados e operação

| Risco | Detalhe | Mitigação |
|-------|---------|-----------|
| **Migração StatusCooperado** | Dados existentes com PENDENTE; remover valor de enum PostgreSQL é delicado | Adicionar novos valores → migrar dados → remover antigo, com servidor parado |
| **Usina sem distribuidora** | Filtro geográfico ANEEL impossível sem esse campo | Adicionar campo, exigir preenchimento pelo admin |
| **Contrato manual vs motor** | Criação manual não valida capacidade, não cria ListaEspera, nasce ATIVO | Unificar regras ou bloquear criação manual |
| **Cooperado.percentualUsina legado** | Campo existe em paralelo com Contrato.percentualUsina — pode causar confusão | Grep por referências, limpar, remover do schema |
| **Frontend mostra só cobranças do 1º contrato** | Cooperados multi-contrato têm cobranças invisíveis | Iterar sobre todos os contratos |
| **Planos não afetam cálculo** | CRUD de planos existe mas motor ignora — feature decorativa | Integrar ou documentar como limitação |

### MÉDIOS — acumulam débito técnico

| Risco | Detalhe |
|-------|---------|
| `as any` em 15+ arquivos | Bypass de tipagem, bugs silenciosos |
| Sem paginação no backend | Performance degrada com crescimento da base |
| Sem máquina de estados | Qualquer transição de status é aceita (ENCERRADO → ATIVO) |
| Catch genérico no frontend | Operador não sabe o motivo da falha |
| Sem audit trail | Nenhuma rastreabilidade de quem fez o quê |
| 0% de cobertura de testes | Nenhum teste unitário ou de integração |
| Cobranca.mesReferencia como Int | BRIEFING quer DateTime — decisão de manter Int é pragmática mas diverge |

### Métricas do QA

- **66 issues únicas** identificadas (após deduplicação entre 7 relatórios)
- 8 críticas, 24 altas, 22 médias, 12 baixas
- ~190 issues brutas antes de deduplicação
- **O sistema NÃO está pronto para produção** sem resolver ao menos os itens da FASE 1

---

*Documento gerado em 2026-03-20. Fonte: BRIEFING-ARQUITETURA-v2.md, RELATORIO-ORQUESTRADOR-v2.md, RELATORIO-QA-FINAL.md.*
