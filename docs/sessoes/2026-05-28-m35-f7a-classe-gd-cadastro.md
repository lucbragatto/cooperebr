# M35 — Sub-Sprint Refinamento Telas Usinas F.7a Classe GD + Auditoria

> Sessão: 28/05/2026 (continuação direta pós-M34).
> Marco: **M35 — F.7a: Classe GD no cadastro + statusHomologacao + script auditoria + D-novo-BG/BH catalogados**.

## TL;DR

F.7a entregue como SÓ REGISTRO (constraint Luciano verbatim: "nao iremos tratar o fio b agora, quero apenas que coloquemos essa informação nos cadastros porque assim, quando tratarmos o modulo do fio b, vamos mandar aplicar na usinas que marcarmos como gd ii e iii"). Campo `classeGdAnotada` já existia no schema (Bloco H' 16/05) e em `UpdateUsinaDto` — **faltava só em `CreateUsinaDto` + UI cadastro**. Adicionado validação `@IsIn(['GD_I', 'GD_II', 'GD_III'])` + select nativo no form com help inline didático. `statusHomologacao` também ganhou dropdown opcional pra cadastrar usinas legadas direto em `EM_PRODUCAO`. Script auditoria read-only rodou nas 10 usinas: 7 PENDENTE, 3 DIVERGÊNCIA (incluindo cooperebr1 GD_I marcado intencionalmente — D-novo-BG). D-novo-BH catalogado (sprint próprio futuro: Despesas Operacionais Camada 2).

## Marco entregue

M35 — F.7a Cadastro Classe GD + Auditoria + 2 débitos catalogados.

## Commit do dia (1)

| Hash | Mensagem |
|---|---|
| (este) | feat(usinas): F.7a — Classe GD + statusHomologacao no cadastro + script auditoria + cataloga D-novo-BG/BH |

## Entregas

### Backend

- **`CreateUsinaDto`** (`backend/src/usinas/dto/create-usina.dto.ts`): adicionado `@IsIn(['GD_I', 'GD_II', 'GD_III'])` em `classeGdAnotada?: string` + `@IsIn([...5 valores enum StatusUsina])` em `statusHomologacao?: string`. Imports atualizados com `IsIn`.
- **`UsinasService.create()`** (`backend/src/usinas/usinas.service.ts`): tipo da assinatura agora declara `classeGdAnotada?: string`. Persistência via spread `...data` já cobre — sem mudança no corpo do método.
- **3 specs novos** em `usinas.service.spec.ts` cobrindo: persiste classeGdAnotada / aceita sem ele / persiste statusHomologacao. 4/4 verde.

### Frontend

- **`/dashboard/usinas/nova/page.tsx`**:
  - 2 campos novos no `useState` form: `classeGdAnotada: ''` + `statusHomologacao: ''`
  - 2 ifs no `handleSubmit` payload (só envia se preenchido)
  - **Select Classe GD** logo após "Capacidade mensal" — dropdown nativo amber theme com 4 opções (Não classificado + GD_I/II/III com descrição). **Help inline azul** didático explicando cada classe + nota "Campo informativo — não impacta cálculo atual"
  - **Select Status Homologação** após "Contrato distribuidora" — 6 opções (padrão CADASTRADA + 5 enum). Help text sutil: "Padrão CADASTRADA. Marque outro só se for usina legada já em operação."

### Script auditoria

- **`backend/scripts/auditoria-classe-gd.ts`** (200 linhas, READ-ONLY puro)
  - Query `prisma.usina.findMany` com `select` enxuto + JOIN cooperativa
  - Helper `sugerirClasse(potenciaKwp)` aplicando faixas REN 1.000/2021
  - Helper `determinarStatus(atual, sugestao)` → OK | PENDENTE | DIVERGÊNCIA | FORA_SCEE
  - Print console formatado + grava `docs/relatorios/<data>-auditoria-classe-gd.md`
  - Uso: `npx ts-node backend/scripts/auditoria-classe-gd.ts`

### Relatório auditoria (gerado)

`docs/relatorios/2026-05-27-auditoria-classe-gd.md` — 10 usinas:

| Status | Total |
|---|---|
| ✅ OK | 0 |
| 📋 PENDENTE | 7 |
| ⚠️ DIVERGÊNCIA | 3 |
| 🚫 FORA_SCEE | 0 |

**3 divergências detectadas:**
- `cooperebr1` Linhares: marcado GD_I com 1.250 kWp (REN sugere GD_III) — **intencional** conforme Luciano, vide D-novo-BG
- `cooperebr2` Linhares 2: marcado GD_II com 1.370 kWp (REN sugere GD_III)
- `Usina Solar Norte`: marcado GD_II com 1.250 kWp (REN sugere GD_III)

Possível padrão: Luciano marca conforme classificação tributária da CoopereBR (preserve GD_I/II por algum critério fiscal), não pela REN strict.

### Débitos catalogados

- **D-novo-BG (P3)** — Anomalia classificação GD Linhares cooperebr1. Decisão produto pendente, aguarda módulo Fio B futuro.
- **D-novo-BH (P1)** — Módulo Despesas Operacionais Usina (Camada 2). Sprint próprio futuro (~10-15h) depois F.7b + antes Sprint Contabilidade Tributária.

## Validação

- 4/4 specs verdes (`usinas.service.spec.ts`)
- `nest build` OK
- `npm run build` web OK (140 páginas, 24.3s Turbopack — D-novo-AS aplicada)
- PM2 backend + frontend online
- **Smoke 3/3 verde com JWT real:**
  - POST `/usinas` com `classeGdAnotada=GD_II + statusHomologacao=EM_PRODUCAO` → 201, persiste corretos ✅
  - Banco confirma após POST (SELECT direto)
  - POST com `classeGdAnotada=GD_XYZ` (inválido) → 400 ✅ (validação `@IsIn` ativa)
  - Cleanup automático (DELETE da usina fake)

## Constraints respeitadas

- ✅ "SÓ REGISTRO, ZERO lógica Fio B" — zero código de cálculo, zero alteração em motor-proposta/cobrancas/fatura
- ✅ Decisão 23: Fase 1 read-only completa antes de tocar código
- ✅ `<select>` nativo (não Shadcn — pattern 19/05 evita conflito Select × Dialog)
- ✅ Help inline didático (regra 19/05)
- ✅ Multi-tenant intacto (campo informativo, sem guard adicional)
- ✅ `npm run build` web (D-novo-AS)
- ✅ Sem force push, commit em português

## Próximo passo — F.7b Refator Tela Edição (~3-4.5h)

- **D-novo-BB** (P1): refatorar Sheet `<Sheet>` em `web/app/dashboard/usinas/[id]/page.tsx:1122-1211` (15 campos) → página dedicada `/dashboard/usinas/[id]/editar/page.tsx` (Padrão UX Dual 17/05 Tipo B). Componente compartilhado `UsinaForm` extraído pra reuso entre `/nova` e `/editar`.
- **D-novo-BC** (P2): paridade completa de campos edição vs cadastro:
  - Adicionar campos AUSENTES no Sheet atual: `apelidoInterno`, endereço Bloco H' (4 campos), `cnpjUsina`, `formaAquisicao`, `formaPagamentoDono` + valores condicionais, `numeroContratoEdp`, `dataContratoEdp`, `classeGdAnotada` (vem de F.7a), `statusHomologacao` (vem de F.7a)
  - Campos extras só-edição: `dataHomologacao`, `dataInicioProducao`, `observacoes`, `statusOperacional`, `modeloCobrancaOverride`, `politicaBandeira`, `valorKwhPadrao`
  - `responsabilidadeDespesas` permanece em `/proprietario` (tela M30 — não duplicar)

## Pré-requisitos leitura próxima sessão

- `docs/sessoes/2026-05-28-m35-f7a-classe-gd-cadastro.md` (este doc)
- `web/app/dashboard/usinas/nova/page.tsx` (referência form com Classe GD)
- `web/app/dashboard/usinas/[id]/page.tsx:1122-1211` (Sheet atual a remover)
- Memória `padrao_ux_edicao_inline_vs_pagina_propria_17_05.md` (Padrão Dual)

## Carry-overs

- F.4 smoke produção (bloqueado Luciano operacional — preencher cooperebr1 real)
- D-novo-BA correção planilha definitiva (depois Luciano fornecer)
- D-novo-BG decisão Fio B (futuro)
- D-novo-BH módulo Despesas Camada 2 (sprint próprio futuro)
- D-novo-AL/AM/AN/AO/AS.1/.2/BE/J/K (anteriores, não-bloqueantes)

## Frase comandante

Próxima sessão Code arranca **F.7b refator Sheet → página própria** + paridade de campos (depende leitura `/nova/page.tsx` atualizada com classeGdAnotada/statusHomologacao + Sheet atual `[id]/page.tsx`). Extrair componente compartilhado `UsinaForm` é o vetor principal de DRY. Estimativa ~3-4.5h.
