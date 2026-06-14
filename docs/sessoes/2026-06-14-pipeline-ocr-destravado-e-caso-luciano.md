# Sessão 14/06/2026 — Pipeline IMAP→OCR destravado + Caso Luciano (Concierge ES) + Modelo CEMIG/MG

## TL;DR

Sessão maratona (~5h) que destravou o pipeline IMAP→OCR (parado há 6 meses por Kaspersky/SSL), processou 37 novas FaturaProcessada elevando universo Concierge de 9 → 48 cooperados, identificou o Luciano como cooperado real (R$ 154/mês de indébito estimado, R$ 11.340 em 60m), catalogou modelo de auditoria CEMIG/MG (Marco Aurelio Almeida, conformidade tributária) e revelou 5 débitos técnicos novos.

## Entregas + SHAs

(Commits a serem feitos. Listar após `git add -p` + commits granulares.)

### Scripts criados (`backend/scripts/`)
- `processar-faturas-por-cooperado.ts` (V2) — pipeline NestJS standalone que itera cooperados sem fatura, busca por número de UC no IMAP, processa 1 fatura por pessoa, com checkpoint resumível
- `comparar-cadastro-com-fatura.ts` (Fase 1) — gera XLSX 5 abas (Vazios / Divergentes / Qualidade / kWh por cooperado / Resumo agregado)
- `diagnostico-distribuidora-uc.ts` — identifica 97% das UCs com distribuidora=OUTRAS
- `auditoria-cidade-distribuidora.ts` — dry-run mapeando cidades → distribuidoras corretas
- `listar-cooperados-com-fatura-real.ts` — filtra sintéticos por padrão `lucbragatto+xxx-NNNN`
- `identificar-fatura-luciano.ts` — busca Luciano real no banco
- `dump-fatura-cooperado.ts` — dump completo dos `dadosExtraidos` de qualquer cooperado

### Patches em produção (`backend/src/email-monitor/email-monitor.service.ts`)
- ✅ SSL fix `tls.rejectUnauthorized: false` — workaround Kaspersky local

### Documentos criados (`docs/concierge/`)
- `casos/luciano-bragatto-EDP_ES.md` — caso-modelo ES com Tema 69 + Tese 3 + Tese 6 calculados
- `modelos/cemig-MG-modelo.md` — catalogação layout CEMIG + verificação 6 teses + adapter futuro

### Arquivos PII fora do repo (workspace OneDrive Luciano)
- `comparacao-cadastro-fatura-2026-06-14.xlsx` (5 abas)
- `docs/concierge/wip/processar-checkpoint.json` (286 cooperados processados)

## Débitos técnicos descobertos (catalogar em `docs/debitos-tecnicos.md`)

| # | Débito | Magnitude | Severidade |
|---|---|---|---|
| 1 | Campo `Uc.distribuidora` não preenchido (97% OUTRAS) | Cross-cutting | **P1** |
| 2 | OCR atual não extrai rubricas detalhadas (bloqueia Concierge full) | Pipeline | **P1** |
| 3 | 20+ cooperados com fatura mock idêntica 481 kWh × R$ 135,60 | 41% "reais" | **P2** |
| 4 | Mês ref vazio em 11/48 faturas (23%) | Parser OCR incompleto | **P2** |
| 5 | Cooperado tem `cpf` + `documento` simultâneos | Schema duplicação | **P3** |

## Bugs descobertos durante validação

- IMAP `messageMove` causa deadlock após erro OCR PDF protegido — **mitigado** no V2 (nunca mais movimenta)
- `cooperado.cpfCnpj` não existe (campo certo é `cpf`) — **corrigido** no script Fase 1
- `Uc.classificacaoTarifaria` não existe (campo certo é `classificacao`) — **corrigido**
- `Uc.enderecoInstalacao` não existe (campo certo é `endereco`) — **corrigido**
- Cota Cooperado Luciano subestimada em 30% (796,92 vs ~1.139 real)

## Pendências abertas pra próxima sessão

1. **Investigar duplicação fatura mock 481 kWh** — separar reais (AESMP, ASSEJUFES) de sintéticos
2. **Re-OCR detalhado fatura Luciano** pra valor exato Concierge (Atual: estimativa ±30%)
3. **Adapter CEMIG futuro** (`backend/src/concierge/fatura-canonica/cemig.adapter.ts`)
4. **Atualizar onboarding** pra preencher distribuidora desde fatura inicial (resolve P1 #1)
5. **Buscar histórico Luciano (60m)** pra dossiê prescrição
6. **Resolver UC fantasma PENDENTE-GUARAPARI** do cadastro Luciano
7. **Atualizar cota Luciano** pra ~1.000 kWh/mês

## Decisões catalogadas

### D14/06-1 — Pipeline IMAP→OCR de produção mantém `processarManual` clássico
V2 (`processar-faturas-por-cooperado.ts`) foi ferramenta de catch-up retroativa. Não substitui o `EmailMonitorService` CRON 6h. **Não vira código de produção** — fica em `backend/scripts/`.

### D14/06-2 — Concierge precisa de adapter próprio de OCR/parse separado do dashboard
OCR atual (`faturas.service.ts`) extrai dados AGREGADOS pra dashboard. Concierge precisa rubricas detalhadas. **Decisão arquitetural:** Sprint Concierge MG/ES futuro inclui adapter próprio com prompt LLM rico.

### D14/06-3 — UPDATE em massa `distribuidora=EDP_ES` adiado
Os 308 cooperados ATIVOS são placeholders do sistema antigo. Vão ser substituídos via cadastro novo (sob a fatura). Não vale rodar UPDATE retroativo. **Quando cooperado real entrar via fatura, OCR detecta distribuidora e preenche corretamente desde o início.**

### D14/06-4 — Foco Concierge é EDP_ES, não CEMIG/MG
Auditoria CEMIG (caso Marco Aurelio) revelou que MG aparenta conformidade tributária com 3 teses majoritárias (Tema 69, Tese 3, Tese 6). EDP_ES não. **Concierge é primariamente produto ES.** MG precisa outras angulações (saldo SCEE expirando, CIP municipal, gross-up).

### D14/06-5 — Universo Concierge real é menor que 48
20+ cooperados têm fatura mock idêntica 09/2024. Universo real provavelmente ~15 cooperados (incluindo AESMP, ASSEJUFES, Luciano, Carolina, Diego, Theomax, Almir, etc).

## Próximo passo único e claro

**Re-OCR detalhado da fatura do Luciano** (caso modelo ES) pra extrair rubricas linha-a-linha e obter cálculo Concierge **EXATO** (não estimativa ±30%). Implementação: adicionar prompt Anthropic específico Concierge em `concierge.service.ts` ou criar `concierge-ocr.service.ts`.
