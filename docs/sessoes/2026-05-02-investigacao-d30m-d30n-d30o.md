# Investigação D-30M + D-30N + D-30O com validação prévia — 02/05/2026

**Modo:** read-only puro. Aplicação da Decisão 14/15 (validação prévia) em 3 débitos
catalogados na mesma sessão (30/04 noite, commit `f3a0434`).

**Aplica regra de validação prévia + retomada + ritual de Decisão 19.**

---

## Por que reinvestigar

D-30M foi descoberto como **falso positivo** em sessão anterior (manhã 02/05) —
classificado como P1 "bug bloqueador" mas pipeline está correto. Origem do erro:
classificação foi feita **contando registros** (9 Indicação PRIMEIRA_FATURA_PAGA + 0
BeneficioIndicacao = "bug") **sem ler o código** que cria BeneficioIndicacao.

D-30N e D-30O foram catalogados na **mesma sessão** com mesma metodologia (E2E
investigação 30/04 noite). Vale aplicar mesmo rigor antes de tratar como verdade.

---

## D-30M — Validação E2E do bônus MLM cascata

### Diagnóstico anterior (30/04 noite, P1)

> "Bônus MLM cascata quebrado — 9 Indicação PRIMEIRA_FATURA_PAGA com 0 BeneficioIndicacao."

### Validação prévia (02/05 manhã)

**Pipeline confirmado correto e cabeado:**

- `cobrancas.service.ts:519-528` emite evento `cobranca.primeira.paga` quando `totalPagas === 1`
- `indicacoes.service.ts:22` ouve com `@OnEvent('cobranca.primeira.paga')`
- `indicacoes.service.ts:286` cria `BeneficioIndicacao` em `processarPrimeiraFaturaPaga()`

**ConfigIndicacao da CoopereBR:**
- `ativo=true`
- `modalidade=PERCENTUAL_PRIMEIRA_FATURA`
- `maxNiveis=2`
- `niveisConfig=[{nivel:1, percentual:10%}, {nivel:2, percentual:2%}]`

**Por que 9 Indicações estão `PRIMEIRA_FATURA_PAGA` com 0 BeneficioIndicacao:**

As 9 vieram de **seed histórico** (jun-ago/2025). `primeiraFaturaPagaEm` setado direto
no banco — fluxo real nunca passou. Cobranças PAGAS recentes (5 últimas, 23-27/04)
são todas de cooperados **não indicados** — ConfigIndicacao não disparou pra ninguém.

### Reclassificação aplicada

- **De:** P1 "Bônus MLM cascata quebrado"
- **Para:** P2 "Validação E2E do bônus MLM cascata pendente"
- **Bloqueio:** **NÃO bloqueia produção.** Validar quando primeiro cooperado indicado
  pagar via Caminho B (Asaas produção).

---

## D-30N — AuditLog interceptor

### Diagnóstico anterior (30/04 noite, P2)

> "AuditLog interceptor não ativado — tabela existe, 0 registros."

### Validação prévia (02/05 manhã)

```bash
$ grep -rln "AuditLog\|auditLog" backend/src/
(zero arquivos retornados)
```

- Schema `model AuditLog` existe em `prisma/schema.prisma:1740` (campos completos:
  `usuarioId`, `acao`, `recurso`, `metadata`, `ip`, índices)
- **Nenhum arquivo TypeScript** referencia `AuditLog` ou `auditLog`
- Não há `AuditLogInterceptor`, `@Auditavel`, `AuditModule`, `auditLog.gravar()`

### Diagnóstico revisado

**Não é "interceptor inativo".** É **"interceptor não implementado".** Sprint 13a
Dia 1 criou apenas o schema; código TypeScript que escreve no `auditLog` nunca foi
escrito. Escopo de fix é maior que parecia.

**O que falta criar (não apenas ativar):**
- `AuditLogInterceptor` NestJS (lê `@Auditavel` decorator, grava em DB)
- Decorator `@Auditavel({ acao: 'cooperativa.suspender' })`
- Helper `auditLog.gravar(...)` pra services chamarem direto
- `AuditModule` registrando provider + APP_INTERCEPTOR
- Aplicar `@Auditavel` em endpoints sensíveis (cooperativas, planos, suspensão, etc.)

### Classificação mantida

P2 — **mas escopo revisado**. Estimativa antes era "ativar"; agora é "implementar
do zero". Sprint 5 (Módulo Regulatório ANEEL precisa de audit pra mudanças de flags)
ou Sprint 6 (Auditoria IDOR Geral) absorvem.

---

## D-30O — FaturaProcessada.mesReferencia null

### Diagnóstico anterior (30/04 noite, P2)

> "Todas 5 FaturaProcessada com mesReferencia=null — bug OCR."

### Validação prévia (02/05 manhã)

Existem **2 caminhos** que chamam `criarFaturaProcessada`:

| Caminho | Linha | Passa `mesReferencia`? |
|---|---|---|
| `upload-concessionaria` (admin upload manual) | `faturas.service.ts:463` | ✅ `mesReferencia: dto.mesReferencia` |
| `extrair` (OCR direto via wizard / `/cadastro` público) | `faturas.service.ts:302` | ❌ NÃO passa |

Todas as 5 FaturaProcessada do banco vieram do caminho `:302` (caminho
`upload-concessionaria` nunca foi exercitado em produção).

### Diagnóstico revisado

**Bug real, mas fix simples.** O OCR já extrai `dadosExtraidos.mesReferencia`
corretamente — só falta copiar pro campo top-level.

**Fix proposto** (~5 linhas em `faturas.service.ts:302+`):

```ts
const fatura = await this.criarFaturaProcessada({
  cooperadoId: dto.cooperadoId,
  ucId: dto.ucId ?? null,
  mesReferencia: dadosExtraidos.mesReferencia ?? null,  // ← ADICIONAR
  ...
});
```

**Estimativa:** 5-10 min Code + 1-2 specs Jest. Pode ir antes do Sprint 2.

### Classificação mantida

P2 — fix antecipado factível (não precisa esperar Sprint 2).

---

## Lições aprendidas (registrar no histórico do ritual)

1. **Diagnósticos baseados em contagem mentem.** D-30M parecia bug grave (P1)
   mas era fluxo nunca exercitado.

2. **"Não está rodando" ≠ "Está quebrado".** D-30M e D-30O ambos estão "não rodando"
   por motivos diferentes:
   - D-30M: pipeline correto, dados de seed nunca passaram pelo fluxo
   - D-30O: pipeline tem 1 caminho com bug, outro caminho correto

3. **Schema sem código = falso positivo.** D-30N tinha "tabela existe, 0 registros" —
   parecia "interceptor inativo" mas é **"interceptor inexistente"**. Escopo dobrou.

4. **Validação prévia é barata, classificação errada é cara.** 30 min de leitura de
   código revisou 3 débitos da mesma origem. Sem revisão, time gastaria semanas
   tratando D-30M como P1 ou implementando "ativação" de algo que nem existe.

---

## Resultado consolidado

| Débito | Antes (30/04) | Depois (02/05) | Mudança |
|---|---|---|---|
| D-30M | P1 "bug" | P2 "validação E2E pendente" | Não é bug. |
| D-30N | P2 "ativar" | P2 "implementar do zero" | Escopo expandido. |
| D-30O | P2 "bug OCR" | P2 "bug fix simples" | Causa raiz identificada, fix em ~5 linhas. |

**Ações pra Luciano decidir:**

A. Aceitar reclassificações (D-30M P1→P2, D-30N escopo, D-30O fix simples) — sem aplicar nada.
B. Aplicar fix D-30O agora (~10 min, antecipa Sprint 2)
C. Combinar A + B
D. Outra

**Recomendação Code:** **C**. D-30O é fix isolado e barato. Faz sentido limpar
agora pra evitar que próxima sessão precise reabrir contexto.

---

*Investigação read-only conduzida em 2026-05-02 manhã. Aplica regra de validação
prévia + retomada (Decisão 14/15) + ritual (Decisão 19). Nenhum fix aplicado.*
