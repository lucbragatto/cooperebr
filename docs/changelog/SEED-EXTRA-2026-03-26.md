# Seed Extra — Relatório de Execução
**Data:** 2026-03-26
**Script:** `backend/prisma/seed-extra.ts`
**Cooperativa:** cmn0ho8bx0000uox8wu96u6fd

---

## Correções Aplicadas (Bugs do QA)

### Bug #1 — PIX Excedente ignora alíquotas do Condomínio (CORRIGIDO)
**Arquivo:** `backend/src/financeiro/pix-excedente.service.ts`
**Problema:** Quando alíquotas não eram passadas no body, o serviço buscava em `configClubeVantagens` (que não tem esses campos), resultando em impostos zerados.
**Correção:** Agora busca alíquotas na seguinte ordem de prioridade:
1. Body (dto.aliquotaIR/PIS/COFINS) — se informados
2. Condomínio (via `condominioId`) — campos `aliquotaIR`, `aliquotaPIS`, `aliquotaCOFINS`
3. Condomínio do cooperado (via `cooperadoId` → unidadeCondominio → condominio)

### Bug #2 — Campo kWhGerado vs energiaTotal no rateio (CORRIGIDO)
**Arquivo:** `backend/src/condominios/condominios.controller.ts`
**Problema:** O spec diz `kWhGerado` mas o controller só aceitava `energiaTotal`. Enviar `kWhGerado` resultava em valor undefined.
**Correção:** O controller agora aceita ambos os campos (`kWhGerado` ou `energiaTotal`), priorizando `kWhGerado`. Também adicionada validação para valores <= 0.

---

## Dados Criados

### Usinas (2 novas)

| Usina | Potência | Cidade | Titular | CNPJ |
|-------|----------|--------|---------|------|
| Usina Solar Guarapari | 250 kWp | Guarapari/ES | Energia Verde Ltda | 11.111.111/0001-11 |
| Usina Solar Serra | 180 kWp | Serra/ES | Solar Serrana SA | 22.222.222/0001-22 |

### Cooperados Individuais (5 novos)

| Nome | CPF | Telefone | UCs | Status |
|------|-----|----------|-----|--------|
| Carlos Eduardo Prata | 123.456.789-01 | (27) 99100-0001 | 2 | ATIVO |
| Beatriz Santos | 234.567.890-12 | (27) 99100-0002 | 1 | ATIVO |
| Fernando Augusto | 345.678.901-23 | (27) 99100-0003 | 1 | ATIVO (INADIMPLENTE) |
| Luciana Meireles | 456.789.012-34 | (27) 99100-0004 | 3 | ATIVO |
| Roberto Fonseca | 567.890.123-45 | (27) 99100-0005 | 1 | ATIVO (Lista de espera) |

### Cobranças (24 novas)

| Cooperado | Total | PAGO | PENDENTE | VENCIDO |
|-----------|-------|------|----------|---------|
| Carlos Eduardo Prata | 12 | 6 | 3 | 3 |
| Beatriz Santos | 6 | 4 | 2 | 0 |
| Fernando Augusto | 3 | 0 | 1 | 2 |
| Luciana Meireles | 3 | 0 | 3 | 0 |

### Lista de Espera (4 novos)

| Posição | Nome | Dias aguardando |
|---------|------|-----------------|
| 1 | Roberto Fonseca | 45 dias |
| 2 | Thiago Barros | 30 dias |
| 3 | Camila Ribeiro | 25 dias |
| 4 | Diego Mendonça | 20 dias |

### Progressão Clube de Vantagens (3 novos)

| Cooperado | Nível | kWh Acumulado | Indicados |
|-----------|-------|---------------|-----------|
| Carlos Eduardo Prata | PRATA | 12.000 | 3 |
| Beatriz Santos | BRONZE | 2.500 | 1 |
| Luciana Meireles | OURO | 25.000 | 6 |

### Indicações (10 novas)

| Indicador | Indicados | Status |
|-----------|-----------|--------|
| Carlos Eduardo | Beatriz, Fernando, Luciana | PRIMEIRA_FATURA_PAGA |
| Beatriz | Fernando | PRIMEIRA_FATURA_PAGA |
| Luciana | Carlos, Beatriz, Fernando, Roberto, Thiago, Camila | 5 pagos + 1 pendente |

---

## Totais no Sistema

| Entidade | Quantidade |
|----------|------------|
| Cooperados | 88 |
| Contratos | 78 |
| Cobranças | 40 |
| Usinas | 6 |
| Lista de espera | 30 |
| Indicações | 10 |
| Progressão Clube | 7 |
