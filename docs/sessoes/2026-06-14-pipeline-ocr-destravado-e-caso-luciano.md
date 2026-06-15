# Sessão 14/06/2026 — Pipeline IMAP→OCR destravado + Caso Luciano (Concierge ES) + Modelo CEMIG/MG

## TL;DR

Sessão maratona (~7h, manhã+tarde+noite) que **(a)** destravou o pipeline IMAP→OCR (parado 6m por Kaspersky/SSL), **(b)** processou 37 novas FaturaProcessada elevando universo Concierge de 9→48 cooperados, **(c)** **DESCOBRIU bug P1 no detector Tese 3 via pergunta do Luciano** ("e a cobrança de PIS/COFINS sobre a energia compensada?") e corrigiu com patch base-declarada-fallback — caso Luciano passou de R$ 0 → **R$ 57,98/mês = R$ 4.348 em 60m+SELIC**, **(d)** implementou 3 detectores novos (Tese 4 GERAR Lei estadual ES 11.253/2021 com filtro de geradoras + CDE Escassez Hídrica + ICMS Gross-Up), **(e)** processou pasta com 47 PDFs (ex_clientes + atuais) revelando **R$ 5.959/mês mapeado = R$ 446.933 em 60m+SELIC** (boa praça R$ 2.541, FATURA EDP LOJA 09 R$ 744, LOJA 10 R$ 692, ILHA ALECRIM R$ 372 — descoberta crítica: **ex-clientes valem 4× mais indébito que atuais**), **(f)** analisou 6 faturas individuais com profundidade incluindo Consorcio Sinergia Ambiental (parceiro CoopereBR + cliente SISGD) com R$ 1.669/mês Tese 2+4 = R$ 125.170 em 60m+SELIC, **(g)** catalogou modelo CEMIG/MG (conformidade — sem indébito direto), **(h)** descobriu bug cadastro: cooperado Leonardo Capucho Pissinati tem fatura amarrada da EXFISHES Terminal Pesqueiro SPE Ltda (CNPJ 46416512000134) — R$ 2.077/mês = R$ 155.789 em 60m+SELIC. **TOTAL INDÉBITO MAPEADO CONSOLIDADO: ~R$ 8.485/mês = R$ 636.369 em 60m+SELIC.** Achado arquitetural do Luciano: detector Tese 3 ignorava PIS/COFINS agregado na lateral "Reservado ao Fisco" — bug P1 corrigido. Refinamento técnico do Luciano à noite: Tese 4 GERAR só aplica a UCs geradoras (TUSD_G presente) — filtro adicionado pra evitar falso positivo em consumidores Grupo A genéricos.

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
