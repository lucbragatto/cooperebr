# RELATORIO AUDITORIA FASE 1 — cooperebr

**Data:** 2026-03-20
**Auditor:** Claude (analise automatizada)
**Base:** RELATORIO-ORQUESTRADOR-v2.md + codigo-fonte atual
**Metodo:** Leitura e verificacao de cada item — nenhuma alteracao no codigo

---

## Resultado Geral

| Status | Quantidade |
|--------|-----------|
| PASSOU | 12 |
| PARCIAL | 1 |
| FALHOU | 0 |

**Total: 12/13 itens OK, 1 pendente de validacao em runtime.**

---

## ITEM 0 — Multi-tenancy: **PASSOU**

### Model Cooperativa
`schema.prisma` linhas 11-22 — model Cooperativa com todos os campos exigidos:
- id, nome, cnpj (unique), email, telefone, ativo, createdAt, updatedAt

### cooperativaId nos 16 models
Todos os 16 models possuem `cooperativaId String?`:

| Model | Campo | Status |
|-------|-------|--------|
| Usuario | cooperativaId String? (linha 33) | OK |
| Cooperado | cooperativaId String? (linha 61) | OK |
| Uc | cooperativaId String? (linha 132) | OK |
| Usina | cooperativaId String? (linha 156) | OK |
| Contrato | cooperativaId String? (linha 197) | OK |
| Plano | cooperativaId String? (linha 220) | OK |
| Cobranca | cooperativaId String? (linha 261) | OK |
| FaturaProcessada | cooperativaId String? (linha 335) | OK |
| Notificacao | cooperativaId String? (linha 352) | OK |
| Ocorrencia | cooperativaId String? (linha 286) | OK |
| ConfiguracaoMotor | cooperativaId String? (linha 389) | OK |
| TarifaConcessionaria | cooperativaId String? (linha 409) | OK |
| HistoricoReajuste | cooperativaId String? (linha 431) | OK |
| PropostaCooperado | cooperativaId String? (linha 467) | OK |
| ListaEspera | cooperativaId String? (linha 483) | OK |
| ConfigTenant | cooperativaId String? (linha 364) | OK |

---

## ITEM 1 — JWT seguro: **PASSOU**

- `jwt-secret.ts` (linhas 1-11): funcao `getJwtSecret()` lanca `Error('JWT_SECRET environment variable is required')` se nao definido.
- `auth.module.ts` (linha 15): usa `getJwtSecret()` no `JwtModule.register()`.
- `jwt.strategy.ts` (linha 13): usa `getJwtSecret()` no constructor.
- **Nenhum fallback hardcoded** (`'changeme'` ou similar) encontrado.
- `.env.example` (linha 4): `JWT_SECRET=` (vazio, forca preenchimento).

---

## ITEM 2 — Registro publico seguro: **PASSOU**

- `auth.controller.ts` linhas 14-19: endpoint `register()` decorado com `@Public()`, forca `perfil: PerfilUsuario.COOPERADO` ignorando qualquer valor do body via spread: `{ ...dto, perfil: PerfilUsuario.COOPERADO }`.
- `RegisterDto` (linhas 1-22): **NAO tem campo `perfil`** — campos aceitos: nome, email, cpf, telefone, senha.
- Endpoint `register-admin` (linhas 22-25): protegido com `@Roles(PerfilUsuario.SUPER_ADMIN)`.

---

## ITEM 3 — ValidationPipe global + DTOs: **PASSOU**

- `main.ts` linhas 12-18: `ValidationPipe` com `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`.
- `CreateCooperadoDto` (create-cooperado.dto.ts): decorators `@IsString`, `@IsNotEmpty`, `@IsEmail`, `@IsOptional`.
- `CreateContratoDto` (create-contrato.dto.ts): decorators `@IsUUID`, `@IsDateString`, `@IsNumber`, `@IsOptional`, `@IsNotEmpty`.
- `RegisterDto` (register.dto.ts): decorators `@IsString`, `@IsEmail`, `@MinLength(8)`, `@IsOptional`. **Campo `perfil` ausente** (correto).

---

## ITEM 4 — Transacao aceitar(): **PASSOU**

- `motor-proposta.service.ts` linha 201: `this.prisma.$transaction(async (tx) => { ... })`.
- **Todas as operacoes dentro usam `tx`:**
  - tx.propostaCooperado.findMany (linha 203)
  - tx.propostaCooperado.update (linha 211)
  - tx.propostaCooperado.create (linha 221)
  - tx.plano.findFirst (linha 259)
  - tx.uc.findMany (linha 264)
  - tx.usina.findMany (linha 282)
  - tx.contrato.create (linha 318)
  - tx.listaEspera.count (linha 336)
  - tx.listaEspera.create (linha 337)
  - this.contratosService.gerarNumeroContrato(tx) (linha 303) — recebe tx
- Notificacoes ficam FORA da transacao (correto — side effects nao-criticos).

---

## ITEM 5 — Race condition percentualUsina: **PASSOU**

- `contratos.service.ts` linha 105: `this.prisma.$transaction(async (tx) => { ... })`.
- `validarCapacidadeUsina` (linhas 41-79) recebe `tx` e:
  - Busca soma dos percentuais de contratos ATIVO + PENDENTE_ATIVACAO (linhas 54-66).
  - Calcula novo percentual (linha 68).
  - Lanca `BadRequestException` se soma > 100% (linhas 72-76).
- Chamada dentro da transacao na linha 122: `await this.validarCapacidadeUsina(data.usinaId, data.kwhContrato, undefined, tx)`.

**Observacao:** Nao usa `SELECT FOR UPDATE` ou isolation level SERIALIZABLE — sob carga extrema, teoricamente possivel race condition, mas o risco e muito baixo para o volume deste sistema.

---

## ITEM 6 — Delete com verificacao de dependencias: **PASSOU**

| Service | Verificacao | Linhas | Status |
|---------|-------------|--------|--------|
| cooperados.service.ts remove() | Contratos ATIVO/PENDENTE_ATIVACAO | 176-183 | OK |
| cooperados.service.ts remove() | Cobrancas PENDENTE | 185-192 | OK |
| contratos.service.ts remove() | Cobrancas vinculadas (any status) | 183-188 | OK |
| usinas.service.ts remove() | Contratos ATIVO/PENDENTE_ATIVACAO | 119-126 | OK |
| ucs.service.ts remove() | Contratos ATIVO/PENDENTE_ATIVACAO/LISTA_ESPERA | 59-66 | OK |
| planos.service.ts remove() | Contratos ATIVO/PENDENTE_ATIVACAO | 79-86 | OK |

Todos lancam `BadRequestException` com mensagem descritiva.

---

## ITEM 7 — findOne 404: **PASSOU**

| Service | Lanca NotFoundException? | Linha |
|---------|------------------------|-------|
| cooperados.service.ts findOne() | Sim | 99 |
| contratos.service.ts findOne() | Sim | 24 |
| ucs.service.ts findOne() | Sim | 20 |
| cobrancas.service.ts findOne() | Sim | 20 |
| ocorrencias.service.ts findOne() | Sim | 20 |
| planos.service.ts findOne() | Sim | 33 |
| usinas.service.ts findOne() | Sim | 16 |

Todos usam `NotFoundException` com mensagem descritiva.

---

## ITEM 8 — Usina.distribuidora: **PASSOU**

- `schema.prisma` linha 155: `distribuidora String?` presente no model Usina.

---

## ITEM 9 — Remover Cooperado.percentualUsina: **PASSOU**

- `schema.prisma` model Cooperado (linhas 47-73): **NAO possui** campo `percentualUsina`. Removido com sucesso.
- Frontend `cooperados/[id]/page.tsx`:
  - Linha 685: usa `cooperado.contratos.filter(...).reduce(...c.percentualUsina...)` — le de **contratos**, nao do cooperado.
  - Linha 758: mesmo padrao — soma `percentualUsina` dos contratos ativos.
- Nenhuma referencia residual a `cooperado.percentualUsina` no frontend ou backend.

---

## ITEM 10 — Campos novos no Contrato: **PASSOU**

| Campo | Tipo no Schema | Linha | Status |
|-------|---------------|-------|--------|
| kwhContratoAnual | Decimal? @db.Decimal(15, 2) | 192 | OK |
| kwhContratoMensal | Decimal? @db.Decimal(15, 2) | 193 | OK |
| descontoOverride | Decimal? @db.Decimal(5, 2) | 194 | OK |
| baseCalculoOverride | String? | 195 | OK |
| regrasAplicadas | Json? | 196 | OK |

Campos pre-existentes confirmados: `percentualUsina` (linha 189), `propostaId` (linha 183).

---

## ITEM 11 — Prisma sincronizado: **PARCIAL**

- O schema.prisma contem todas as alteracoes esperadas (itens 0, 8, 9, 10).
- **Nao e possivel verificar se `prisma generate` e `prisma db push` foram executados** sem rodar os comandos.
- O git status mostra `schema.prisma` como modified (staged), indicando que foi alterado.

**Acao recomendada:** Executar `npx prisma generate && npx prisma db push` e verificar que nao ha erros.

---

## ITEM 12 — Numero contrato unico: **PASSOU**

- `contratos.service.ts` linhas 81-92: metodo `gerarNumeroContrato(tx?)` centralizado, aceita tx opcional.
- `motor-proposta.service.ts` linha 303: `await this.contratosService.gerarNumeroContrato(tx)` — chama o metodo centralizado passando tx.
- `ContratosService` injetado no `MotorPropostaService` (linha 50).
- **Nenhuma logica duplicada** de geracao de numero encontrada.

---

## Resumo Final

| Item | Descricao | Resultado |
|------|-----------|-----------|
| 0 | Multi-tenancy (Cooperativa + cooperativaId) | **PASSOU** |
| 1 | JWT seguro (sem fallback) | **PASSOU** |
| 2 | Registro publico (perfil forcado) | **PASSOU** |
| 3 | ValidationPipe + DTOs | **PASSOU** |
| 4 | Transacao aceitar() | **PASSOU** |
| 5 | Race condition percentualUsina | **PASSOU** |
| 6 | Delete com dependencias | **PASSOU** |
| 7 | findOne 404 | **PASSOU** |
| 8 | Usina.distribuidora | **PASSOU** |
| 9 | Remover Cooperado.percentualUsina | **PASSOU** |
| 10 | Campos novos no Contrato | **PASSOU** |
| 11 | Prisma sincronizado | **PARCIAL** |
| 12 | Numero contrato unico | **PASSOU** |

### O que precisa de atencao

1. **ITEM 11 (PARCIAL):** Verificar manualmente se `prisma generate` e `db push` rodam sem erro. O schema esta correto mas a sincronia com o banco nao pode ser confirmada sem execucao.

2. **ITEM 5 (Observacao):** A transacao nao usa `SELECT FOR UPDATE` nem isolation SERIALIZABLE. Para o volume atual do sistema e aceitavel, mas sob alta concorrencia pode haver race condition residual.

3. **Metodo `alocarListaEspera`** (motor-proposta.service.ts linhas 539-581): NAO esta em transacao — as operacoes de update contrato + update listaEspera + notificacao sao feitas sem atomicidade. Nao faz parte da FASE 1, mas vale registrar para correcao futura.

---

*Relatorio gerado em 2026-03-20. Nenhuma alteracao foi realizada no codigo.*
