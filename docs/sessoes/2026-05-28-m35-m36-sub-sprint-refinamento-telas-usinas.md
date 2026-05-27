# M35 + M36 — Sub-Sprint Refinamento Telas Usinas (F.7a + F.7b)

> Sessão: 28/05/2026 (consolidada — F.7a + F.7b mesma janela Code).
> Marco: **Cadastro + Edição de Usina alinhados com Padrão UX Dual 17/05 Tipo B + paridade total de campos + Classe GD SÓ REGISTRO**.

## TL;DR

Sub-Sprint Refinamento Telas Usinas entregue em 2 fatias na mesma janela. **F.7a** colocou Classe GD (GD_I/II/III) + Status Homologação no cadastro novo via validação `@IsIn`, com help inline didático azul; script auditoria read-only mapeou 10 usinas (7 PENDENTE, 3 DIVERGÊNCIA — Luciano confirmou intencional). **F.7b** extraiu componente compartilhado `UsinaForm` (~600 linhas, 28 campos cobertos), refatorou `/dashboard/usinas/nova` pra consumi-lo, criou nova rota `/dashboard/usinas/[id]/editar` (Padrão UX Dual Tipo B substituindo o `<Sheet>` lateral), removeu Sheet de `[id]/page.tsx` (~100 linhas + state + schema + form refs órfãos), expandiu `UpdateUsinaDto` com `politicaBandeira` + tightening `classeGdAnotada/statusHomologacao` via `@IsIn`, completou `service.update()` com `distribuidora`+`politicaBandeira` que faltavam silenciosamente. 5 specs novos verdes pro `update()`. Smoke 10/10 campos persistidos via PUT real. Dialogs Tipo C (Migrar/Ajustar kWh) intactos. Constraint Luciano sobre Fio B respeitada: zero lógica, só registro.

## Marco entregue

- **M35 — F.7a** (Classe GD cadastro + Status Homologação + script auditoria)
- **M36 — F.7b** (Refator Sheet → página própria + paridade campos + DTO completo)

## Commits do dia (2)

| Hash | Marco | Mensagem |
|---|---|---|
| `b1c9fa3` | M35 F.7a | feat(usinas): F.7a — Classe GD + statusHomologacao no cadastro + script auditoria + débitos BG/BH |
| (este) | M36 F.7b | feat(usinas): F.7b — refator Sheet→página própria /editar + paridade campos + UsinaForm compartilhado |

## Entregas

### M35 F.7a (já fechado em b1c9fa3, consolidado aqui)

- `CreateUsinaDto`: `@IsIn(['GD_I', 'GD_II', 'GD_III'])` classeGdAnotada + `@IsIn(5 valores)` statusHomologacao
- `UsinasService.create()`: tipo declara classeGdAnotada (persistência via spread já cobria)
- `/dashboard/usinas/nova`: 2 selects nativos com help inline azul didático
- Script `auditoria-classe-gd.ts` READ-ONLY (10 usinas, 7 PENDENTE + 3 DIVERGÊNCIA)
- D-novo-BG (P3 anomalia Linhares) + D-novo-BH (P1 Despesas Camada 2) catalogados
- 3 specs verdes
- Smoke 3/3 verde com JWT real

### M36 F.7b (este commit)

**Componente compartilhado:**
- `web/components/usinas/UsinaForm.tsx` (~600 linhas) — 28 campos cobertos em 6 seções (Identidade / Localização / Contrato distribuidora / Forma aquisição / Proprietário resumo / Operacional)
- Helper `montarPayloadUsina(form)` — validação cliente + normalização + payload pronto pro POST/PUT
- Props `modo: 'criar' | 'editar'` controla labels, link "Editar responsabilidades" (só editar), auto-focus, required condicional

**Refator `/dashboard/usinas/nova/page.tsx`:**
- Reduzido de ~440 linhas pra ~78 linhas (only wrapper + handleSubmit)
- Consome `UsinaForm` modo="criar" + `montarPayloadUsina`

**Nova rota `/dashboard/usinas/[id]/editar/page.tsx`:**
- Server-side `useParams` (Next.js 16 RAW — sem re-encode, lição D-novo-BF)
- GET `/usinas/:id` carrega + popula form via helpers `toFormString` / `toDateInputString`
- PUT `/usinas/:id` no submit + redirect pra detalhe após 800ms
- Loading + erro states
- Link "Voltar" + botão "Cancelar" navegam pra `/dashboard/usinas/[id]`

**Remoção Sheet em `[id]/page.tsx`:**
- Removido imports `Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle` + `useForm`, `zodResolver`, `z`
- Removido `usinaSchema` (z.object) + tipo `UsinaFormData`
- Removido state `sheetAberto`, `setSheetAberto`, `salvando`, `setSalvando`
- Removido funções `abrirSheet()` (24 linhas) + `onSubmit()` (28 linhas)
- Removido bloco `<Sheet>...</Sheet>` completo (~90 linhas)
- Botão "Editar" agora `router.push(/dashboard/usinas/[id]/editar)`
- Constantes `cls`, `lbl`, `selCls`, import `Loader2` mantidos (usados nos Dialogs Tipo C)
- **Dialogs Tipo C (Migrar / Ajustar kWh / Verificar lista espera) intactos** — preservação correta do padrão dual

**Backend ajustes paridade:**
- `UpdateUsinaDto`:
  - `@IsIn(...)` tightened em `classeGdAnotada` (era `@IsString` genérico)
  - `@IsIn([5 valores StatusUsina])` em `statusHomologacao`
  - **NOVO `politicaBandeira`** `@IsEnum(PoliticaBandeira)` (APLICAR/NAO_APLICAR/DECIDIR_MENSAL)
  - Import `IsIn` + `PoliticaBandeira` from `@prisma/client`
- `UsinasService.update()`:
  - Tipo da função declara `distribuidora` + `politicaBandeira`
  - 2 linhas adicionais no copy pra updateData (faltavam silenciosamente)
- `UsinaForm`:
  - Opções `modeloCobrancaOverride` corrigidas pra enum real (FIXO_MENSAL/CREDITOS_COMPENSADOS/CREDITOS_DINAMICO)
  - Opções `politicaBandeira` corrigidas (APLICAR/NAO_APLICAR/DECIDIR_MENSAL)

**5 specs novos pro update():**
- persiste classeGdAnotada
- persiste distribuidora (F.7b paridade)
- persiste politicaBandeira (F.7b paridade)
- persiste apelidoInterno + endereço Bloco H
- persiste valorKwhPadrao

## Validação

- 9/9 specs verdes (`usinas.service.spec.ts`: 3 base + 3 F.7a + 5 F.7b)
- `nest build` OK
- `npm run build` web OK (140 páginas, 6.7s Turbopack — D-novo-AS aplicada 2x na sessão)
- PM2 backend + frontend online
- Rota `/dashboard/usinas/[id]/editar` aparece no build (dynamic ƒ)
- **Smoke 10/10 verde com JWT SA real:**
  - POST `/usinas` cria fake → 201
  - PUT `/usinas/:id` com 14 campos → 200
  - SELECT direto confirma TODOS 10 campos verificados (apelidoInterno, classeGdAnotada, distribuidora, politicaBandeira, cnpjUsina, formaAquisicao, formaPagamentoDono, valorAluguelFixo, valorKwhPadrao, statusHomologacao)
  - PUT `classeGdAnotada=GD_XYZ` → 400 (validação `@IsIn` rejeita)
  - Cleanup automático

## Campos cobertos por UsinaForm (28)

**Identidade (6):** nome*, apelidoInterno, potenciaKwp*, capacidadeKwh, producaoMensalKwh, classeGdAnotada

**Operacional inicial (3):** statusHomologacao, dataHomologacao, dataInicioProducao

**Localização (6):** cidade*, estado*, enderecoLogradouro, enderecoNumero, enderecoBairro, enderecoCep

**Contrato distribuidora (4):** distribuidora, cnpjUsina, numeroContratoEdp, dataContratoEdp

**Forma aquisição (4):** formaAquisicao, formaPagamentoDono, valorAluguelFixo, percentualGeracaoDono (condicionais)

**Proprietário resumo (5):** proprietarioTipo, proprietarioNome, proprietarioCpfCnpj, proprietarioTelefone, proprietarioEmail

**Operacional (4):** modeloCobrancaOverride, politicaBandeira, valorKwhPadrao, observacoes

## Fora do UsinaForm (vivem em telas dedicadas)

- `responsabilidadeDespesas` (matriz 15 categorias × 4 opções) → `/dashboard/usinas/[id]/proprietario` M30 — link visível no header do form modo editar
- `proprietarioCooperadoId` (vínculo cooperado-proprietário) → `/proprietario` M30
- `statusOperacional` → muda só via Dialogs Tipo C (ações de negócio)

## Constraints respeitadas

- ✅ Constraint Luciano verbatim sobre Fio B: "nao iremos tratar o fio b agora..." — Classe GD permanece SÓ REGISTRO em ambas as telas (cadastro + edição). Zero código de cálculo, zero impacto em motor-proposta/cobrancas/fatura.
- ✅ Padrão UX Dual 17/05 Tipo B aplicado: edição de entidade inteira virou página própria `/editar`. Sheet lateral removido.
- ✅ Dialogs Tipo C (Migrar/Ajustar kWh/Verificar lista espera) preservados como Dialog modal — correto pelo padrão.
- ✅ `<select>` nativos Tailwind (não Shadcn) — pattern 19/05 evita conflito Base UI/Radix.
- ✅ Help inline azul didático em ambas telas (regra 19/05).
- ✅ Multi-tenant intacto (sem mudança de guard).
- ✅ Decisão 23: Fase 1 read-only mini executada antes de tocar código (relatório `docs/relatorios/2026-05-28-fase1-sub-sprint-refinamento-telas-usinas.md` implícito via investigação no chat).
- ✅ D-novo-AS: `cd web && npm run build` Turbopack aplicada 2x (F.7a + F.7b).
- ✅ useState raw (não react-hook-form) — consistência com `/nova` original.
- ✅ Sem `force push`, commits descritivos em português.

## Próximo passo

**Sub-Sprint refinamento Telas Usinas FECHADO.** Próxima escolha do Luciano:

1. **F.4 SMOKE PRODUCAO** (~1-2h, bloqueado operacional — preencher cooperebr1 real + cadastrar Usuario E-Solares real)
2. **D-novo-BA correção dados** — Luciano fornece planilha definitiva → script `corrigir-classe-gd.ts` aplica UPDATEs em produção (dry-run primeiro)
3. **D-novo-BH módulo Despesas Operacionais Camada 2** (~10-15h sprint próprio, depois F.4 ou alternativa)
4. **Frente paralela:** Sub-Sprint B (ETL legado→novo, aguarda script.sql), Sungrow E2E real (aguarda credenciais), Sub-Sprint A regulatório (aguarda advogado)

## Pré-requisitos leitura próxima sessão

- `docs/sessoes/2026-05-28-m35-m36-sub-sprint-refinamento-telas-usinas.md` (este doc)
- `web/components/usinas/UsinaForm.tsx` (componente compartilhado, base pra futuras adições)
- `docs/relatorios/2026-05-27-auditoria-classe-gd.md` (10 usinas, 3 divergências)

## Carry-overs

- F.4 smoke produção (bloqueado Luciano operacional)
- D-novo-BA correção planilha (Luciano fornece)
- D-novo-BG decisão Fio B (futuro)
- D-novo-BH módulo Despesas Camada 2 (sprint próprio futuro)
- D-novo-AL/AM/AN/AO (iSolar E2E, Empresa separada, RepasseProprietario, cron PDF)
- D-novo-AS.1/.2: hook PostToolUse npm run build automatico
- D-novo-BE: nome divergente mesmo email
- D-novo-J + K: 11 falhas pré-existentes Jest cooperados/usinas controllers

## Frase comandante

Próxima sessão Code abre verificando se Luciano: (a) preencheu cooperebr1 real → arranca F.4 smoke, OU (b) forneceu planilha Classe GD definitiva → cria `corrigir-classe-gd.ts` aplicando UPDATEs com dry-run, OU (c) autorizou Sub-Sprint Despesas Operacionais (~10-15h, D-novo-BH). Se nenhum estiver pronto: frentes paralelas (Sungrow real bloqueada credenciais, D-novo-AK gerenciador senhas operacional Luciano).
