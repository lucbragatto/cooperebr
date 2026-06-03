# Sessão 02/06 noite tarde — Finalização Convênio Médico (Pontos 1+2a) + HOTFIX build + D-FISCAL-2 FECHADO + Sprint Convite-Convênio Fatia 1

## TL;DR

Maratona pós-M20 que finalizou o Caso 1 custeio (3 pontos), fechou o arco D-FISCAL-2 com 3 commits adicionais, diagnosticou e corrigiu um bug operacional crítico (build do backend quebrado há 3 dias por pasta órfã `src/agents`), iniciou o Sprint Convite-Convênio (Fatia 1 de 8 entregue: schema delta com aprovação dupla magic link + quota). Estado atual: convênio médico **USÁVEL pelo admin** ponta-a-ponta (cadastro modo teste + tarifa fixa/% + consolidada + lente fiscal). Convite com aprovação dupla = sprint próprio em andamento. Smoke E2E real Caso 1 ainda pendente Luciano.

## Commits da sessão (7 trabalho + 1 fechamento)

| Hash | Tipo | Mensagem |
|---|---|---|
| `cfb4208` | feat | D-novo-CAD-CUSTEADO-FATURA — modo teste libera fatura + preserva vínculo convênio (0 UCs) |
| `3665099` | feat | D-novo-CT-TARIFA-FIXA-EMPRESA — tarifa fixa R$/kWh negociada com a empresa (além do % desconto) |
| `37fa529` | docs | catalogar SEC-AUTOINSCRICAO-CUSTEADA + PORTAL-CUSTEADO + reframe CONVITE-CONVENIO |
| `2666412` | feat | D-FISCAL-2.5 — lente fiscal read-only + aposenta CRUD CT + descarta convenio teste |
| `13eb1d7` | docs | D-FISCAL-2.6 — corrige exemplo Hangar no relatório conformidade |
| `12bff1e` | feat | convite-convenio — schema delta — status pendente/rejeitado + origem + quota + aprovação magic link |
| _(hotfix tsconfig.build src/agents foi anexado no commit `12bff1e` Fatia 1)_ | | |

## Marco entregue

**D-FISCAL-2 FECHADO** (arco completo Caso 1 custeio fiscal) + **Sprint Convite-Convênio iniciado (Fatia 1/8)**.

## Entregas técnicas

### Ponto 1 — D-novo-CAD-CUSTEADO-FATURA (cfb4208)

**Problema:** admin não conseguia cadastrar médicos custeados via wizard `/dashboard/cooperados/novo` porque Step1 exigia upload/OCR da fatura e o toggle "custeado" só aparecia no Step3.

**Solução:**
- Backend: `CreateCooperadoDto` aceita `ambienteTeste?: boolean` (@IsBoolean @IsOptional); `CooperadosService.create` propaga via spread; `MotorPropostaService.aceitar:683` no early-return 0 UCs chama `adicionarMembro(tx)` ANTES de retornar quando `custeioContext` presente → preserva vínculo do convênio mesmo SEM UC.
- Frontend: state `modoTeste` no header do wizard (toggle banner amber permanente) + badge "MODO TESTE" no título + `validarEtapa` relaxa cases 0/2/3 quando modoTeste; `Step2Dados` ganha prop `modoTeste` e envia `ambienteTeste=true` no payload.
- Specs: `cooperados-ambiente-teste.spec.ts` (3/3) + ampliação `motor-proposta.service.aceitar-custeio.spec.ts` (7/7 com cenário D-novo-CAD).

### Ponto 2a — D-novo-CT-TARIFA-FIXA-EMPRESA (3665099)

**Problema:** Caso 1 só permitia `% desconto sobre tarifa concessionária`. Faltava o modo "tarifa fixa R$/kWh negociada com a empresa".

**Solução:**
- Schema aditivo: enum `TipoTarifaEmpresa { PERCENTUAL_DESCONTO | VALOR_FIXO }` + 2 campos em `ContratoConvenio` (`tipoTarifaEmpresa @default(PERCENTUAL_DESCONTO)` + `tarifaFixaKwhEmpresa Decimal?(10,5)`). Default preserva 3 convênios vivos.
- Service `ConveniosCusteioService` ganhou 2 ramos no cálculo (PERCENTUAL_DESCONTO usa `tarifa_concessionária × (1-desconto%)`; VALOR_FIXO usa `tarifaFixaKwhEmpresa` direto).
- Frontend `ConvenioCusteioBloco.tsx`: select tipoTarifa nativo + input tarifaFixa condicional (regra HELP banner).
- Specs: `convenios-custeio.service.spec.ts` (43/43 com novos cenários VALOR_FIXO + UPDATE parcial preserva tipo).

### HOTFIX — build do backend quebrado há 3 dias

**Sintoma:** PATCH `/convenios/:id` retornava `400 "property tipoTarifaEmpresa should not exist"` mesmo com source compilando.

**Diagnóstico (root-cause):** Pasta `backend/src/agents/` é 100% untracked (`?? src/agents/`), criada 31/05, contém 3 sub-módulos órfãos (`repasses-despesas`, `sentinela`, `common/tools`) com **15 erros TS persistentes**. `nest build` chama `tsc` em modo parcialmente emissor: emite o que conseguir, mas com `exit code != 0`. O build do Ponto 2a (19:56) saiu com erros, `pm2 restart` NÃO foi disparado, e o `dist/src/convenios/convenios.dto.js` ficou desatualizado em relação ao source. Resultado: backend rejeitando campos novos por 3 dias.

**Fix:**
- Rebuild forçado → grep confirmou `UpdateConvenioDto.prototype.tipoTarifaEmpresa` linha 511 no dist novo.
- PM2 restart + smoke `PATCH` validado.
- **Formalização preventiva:** `tsconfig.build.json` ganhou `"src/agents/**"` no exclude. Build agora limpa, zero erros tsc. Aplicado no commit `12bff1e` da Fatia 1.

**LIÇÃO REGISTRADA:** *"build passou" mentia.* Sempre verificar dist (`grep` no .js compilado) após `npm run build`, especialmente quando há pastas com erros conhecidos. Não confiar em "compila" sem confirmar o artefato.

**Débito novo:** **D-novo-AGENTS-ORPHAN P3** — pasta `src/agents` órfã (sub-módulos nunca commitados, sem owner). Decidir: deletar OU consertar OU adicionar ao `.gitignore`. Catalogar pós-Sprint Convite.

### D-FISCAL-2.5 (2666412) — lente fiscal read-only

Repurposa `/dashboard/contabilidade/convenios` (mesma URL, evita lente órfã) como **lente fiscal read-only** sobre `ContratoConvenio` legado:
- Tabela 9 colunas (Empresa | Tipo | Pagador | Natureza Art. 79/86/88 | Fluxo | Gera lançamento? | Membros | Status | Ações).
- 3 filtros (natureza fiscal / geraLancamentoContabil / pagador).
- 2 botões/linha: Eye → `/dashboard/convenios/[id]` (detalhe) · Pencil → `/dashboard/convenios/[id]/editar` (CRUD real).
- Banner amber explícito "Lente fiscal read-only — pra criar/editar use Convênios principal".
- Sidebar: label "Convênios (Art. 88)" → "Convênios (lente fiscal)".

**Aposentação CRUD CT:**
- Páginas `novo/` e `[id]/editar/` deletadas.
- `ConveniosCtController` marcado `@deprecated` + `OnModuleInit` emite WARN no boot ("DEPRECATED ... será removido em 1 sprint").
- Endpoint `/convenios/:id/movimentos-contabeis` (D-FISCAL-2.2 + roteamento 2.4.4c) **mantido intacto** — está no ConveniosController legado.

**Registro órfão deletado:** `Convenio CT id=cmpva0sqb0007vawsslk9af3r ("teste")`, criado 01/06, 0 FK em `LancamentoCaixa`. Antes count=1, depois count=0. Model `Convenio` + coluna `LancamentoCaixa.convenioContabilId` mantidos (cleanup P3 futuro).

### D-FISCAL-2.6 (13eb1d7) — correção Hangar

Linha 46 de `docs/relatorios/2026-05-31-conformidade-contabil-multi-regime.md`:
- **Antes:** *"convenio Hangar Academia (cooperado PJ que financia custeio)"*
- **Depois:** *"convênios de custeio recebido (Caso 1 D-FISCAL-2.4 — empresa terceira paga a conta de N cooperados, ex.: clínica custeando médicos cooperados)"*

Hangar Academia é membro PJ da CoopereBR (cooperado PJ que paga a própria conta), não é convênio Caso 1. Grep `hangar` no relatório agora retorna zero ocorrências.

### Workflow investigação convite (6 agentes paralelos)

Antes do reframe do D-novo-CONVITE-CONVENIO, lançamos investigação com 6 sub-agentes paralelos para mapear vetor de fraude e gaps UX. Achados consolidados:

1. **Vetor de fraude D-novo-SEC-AUTOINSCRICAO-CUSTEADA P1** — caminho público `/cadastro` JÁ aceita `convenioCusteioId` no body (D-FISCAL-2.4.3 wired). Link `?conv=` divulgado abertamente = qualquer pessoa com CPF válido vira MEMBRO_ATIVO custeado pela empresa pagadora sem fricção. Bloqueia divulgar links públicos de custeio até aprovação dupla.
2. **Gap UX D-novo-PORTAL-CUSTEADO P2** — membro custeado entra no Portal e vê Faturas/Saldo/Cobranças vazias sem aviso "você é custeado pela empresa X". `meuPerfil()` em `cooperados.service.ts:40-96` não retorna flag de custeio.
3. **Confirmação stateless** — `ConviteIndicacao` existente é MLM-shape (exige `cooperadoIndicadorId NOT NULL`); decisão produto: invite custeio = link stateless `?conv=` sem persistir model novo, magic link de aprovação da empresa = model NOVO `AprovacaoConvenioMembro`.
4. **Padrão consolidado** — `ConviteProprietarioService` (M31, 26/05) é template ideal pra reuso (token `crypto.randomBytes(32).hex`, TTL 7d, expiresAt/usedAt derivado, endpoints `@Public()`).

### Débitos catalogados (37fa529)

- **D-novo-SEC-AUTOINSCRICAO-CUSTEADA P1** — bloqueia divulgar link público até aprovação dupla.
- **D-novo-PORTAL-CUSTEADO P2** — banner + flag de custeio em `meuPerfil()`.
- **D-novo-CONVITE-CONVENIO P1 reframe** — sprint próprio com 4 fases.
- (**D-novo-SEC-AMBIENTE-TESTE P3** já catalogado no cfb4208 — confirmado linha 902.)

### Sprint Convite-Convênio — Fase 1 mapeada (A-J) + decisões travadas

Fase 1 read-only completa (Decisão 23) mapeou:
- **A** status MembroConvenio + filtro `ativo:true` na consolidada
- **B** 3 caminhos de admissão (admin/CSV/público) sem param `origem`
- **C** `?conv=` no cadastro público — falta apenas leitura + lock UI
- **D** botão "Gerar link" na tela detalhe convênio
- **E ⭐** auth aprovação empresa — escolhido HÍBRIDO (magic link no núcleo + login portal como camada, mesmo endpoint)
- **F** filtro PENDENTE + section "Pendentes" na tela admin
- **G** notificações (4 helpers novos email/WA)
- **H** fallback rejeição: SEM_UC fica PENDENTE pro admin (não cancela)
- **I** quota + dedup CPF — hoje ZERO, adicionar
- **J** Portal UX: `meuPerfil()` ganha flag + banner

**Decisões travadas:**
1. Auth empresa = HÍBRIDO magic link + portal
2. Lock dropdown convênio quando `?conv=` = disabled
3. Lock tipoCobranca = fixo CUSTEADA
4. `?conv=` inválido = erro amigável
5. Botão tela detalhe = dialog modal (MVP)
6. TTL magic link = 7d (consistência ConviteProprietario)
7. Quota = ambos opcionais (limiteMembros + kwhAlocadoMaxMensal)
8. SEM_UC rejeitado = fica PENDENTE pro admin
9. Reenvio magic link = sim (reusa pattern)
10. AuditLog = 5 eventos (criação, aceite, aprovação empresa, aprovação admin, rejeições)
11. Rate-limit = 3/h por CPF, 30-60/h por IP
12. Contador pendentes = badge sidebar

### Sprint Convite-Convênio — Fatia 1 (12bff1e) — Schema delta

**Mudanças schema (100% aditivo, defaults preservam 3 convênios + 215 membros):**

| # | Mudança | Tipo |
|---|---|---|
| 1 | `StatusMembroConvenio` +4 valores: `PENDENTE_APROVACAO_EMPRESA/ADMIN`, `MEMBRO_REJEITADO_EMPRESA/ADMIN` | Enum aditivo |
| 2 | `AdmissionOrigem` (`ADMIN_MANUAL/CSV/CONVITE_PUBLICO`) | Enum NOVO |
| 3 | `ConvenioCooperado` +6 campos: `origem` default ADMIN_MANUAL + 4 timestamps + `motivoRejeicao` + back-rel `aprovacao` | Aditivo |
| 4 | `ContratoConvenio` +2 campos: `limiteMembros Int?` + `kwhAlocadoMaxMensal Decimal?(10,2)` | Aditivo |
| 5 | `AprovacaoConvenioMembro` (NOVO) — 10 cols: id, membroId @unique, token @unique, expiresAt, usedAt, decisao, motivoRejeicao, aprovadorIp, aprovadorUserAgent, createdAt | Tabela nova |

`ConviteConvenioMembro` NÃO criado (link stateless `?conv=`).

**Validação pós-migration (read-only):**
- 3 ContratoConvenio: todos com `limiteMembros=null, kwhAlocadoMaxMensal=null` (defaults preservados).
- 215 ConvenioCooperado: 100% `origem=ADMIN_MANUAL`, status=MEMBRO_ATIVO, ativo=true.
- AprovacaoConvenioMembro: count=0.
- `pg_enum StatusMembroConvenio`: 7 valores (3 originais + 4 novos).
- `pg_enum AdmissionOrigem`: 3 valores.

**Build limpo:** `tsconfig.build.json` ganhou `src/agents/**` no exclude → `nest build` zero erros tsc. Dist refletindo (18 ocorrências dos novos campos no `convenios.controller.d.ts`).

**PM2 restart:** *"Nest application successfully started +11485ms"* + *"Backend rodando na porta 3000"*.

## Estado atual

**Convênio médico USÁVEL pelo admin:**
- Cadastro de médico custeado via wizard com toggle "Modo teste" → libera fatura, preserva vínculo do convênio sem UC, marca cooperado `ambienteTeste=true`.
- Cobrança consolidada com 2 modos: `PERCENTUAL_DESCONTO` (tarifa concessionária × (1-desconto%)) OU `VALOR_FIXO` (tarifa fixa R$/kWh negociada).
- Tela admin `/dashboard/convenios/[id]/cobrancas-consolidadas` opera ponta-a-ponta (gerar/listar/estornar).
- Lente fiscal `/dashboard/contabilidade/convenios` mostra classificação Art. 79/86/88 read-only.
- Relatório conformidade 31/05 corrigido (Hangar removido como exemplo errado).

**Convite com aprovação dupla = sprint em andamento:** Fatia 1/8 entregue (schema). Próximas 7 fatias mapeadas (~22-30h total).

**Smoke E2E real Caso 1 ainda pendente Luciano:** abrir `/dashboard/convenios/cmpwof5h6000avaf8547cj3pb/cobrancas-consolidadas` → "Gerar agora" maio/2026 → R$ 126.289,60 esperado (PERCENTUAL) OU R$ 160.000,00 se mudar pra tarifa fixa R$ 0.80.

**IDEIA NOVA (Luciano, 02/06 noite):** **portal da empresa conveniada self-service de convites** — empresa gera e ENVIA convite pros seus médicos via WhatsApp/email + aprova pendentes na própria tela. Vira **Fatia 9 do sprint** (perna "portal login" do híbrido), depende de provisionar login da empresa no portal. Recomendação: WhatsApp+email primeiro; Telegram = net-new (zero código hoje, a avaliar depois).

## Decisões catalogadas (esta sessão)

- **D-novo-SEC-AUTOINSCRICAO-CUSTEADA P1** — vetor fraude link público sem aprovação.
- **D-novo-PORTAL-CUSTEADO P2** — Portal UX cooperado custeado.
- **D-novo-CONVITE-CONVENIO P1 reframe** — sprint próprio (Fatia 1/8 já feita).
- **D-novo-AGENTS-ORPHAN P3** (não-catalogado formalmente ainda — pendente próximo housekeeping): pasta `src/agents` untracked com 15 erros TS.
- **Sprint Convite-Convênio decisões 1-12** travadas (auth híbrido, lock UI, TTL, quota, rate-limit etc — ver doc-sessão Fase 1 acima).

## Pré-requisitos leitura próxima sessão

1. `docs/CONTROLE-EXECUCAO.md` (ONDE PARAMOS + FRASE DE RETOMADA — esta sessão)
2. `~/.claude/projects/C--Users-Luciano-cooperebr/memory/MEMORY.md`
3. Este doc-sessão (`2026-06-02-convenio-medico-finalizacao-e-convite-fase1.md`) — contexto pleno
4. `docs/sessoes/2026-06-02-dfiscal-244-caso1-completo.md` — sessão M20 anterior (Caso 1)
5. `docs/debitos-tecnicos.md` — header atualizado + 3 débitos novos P1/P1/P2 + Fatia 1 schema delta
6. `backend/prisma/schema.prisma:313-340` (enum + AdmissionOrigem), `:1404-1411` (quota), `:1439-1480` (ConvenioCooperado + AprovacaoConvenioMembro)
7. `backend/src/proprietario/convite-proprietario.service.ts` — template padrão a reusar na Fatia 2/3
8. `backend/src/convenios/convenios-membros.service.ts` — onde injetar param `origem` + dedup + quota
9. `backend/src/publico/publico.controller.ts:457` — caminho `convenioCusteioId` no cadastroWebV2 (vai precisar do irmão `/auto-inscrever`)
10. `web/app/cadastro/page.tsx:144,158-160,496` — pontos de leitura `?conv=` + state convenioCusteioId
11. `web/app/dashboard/convenios/[id]/page.tsx:108-115` — local botão "Gerar link"
12. `CLAUDE.md` + `.claude/CLAUDE.md` — regras de projeto

## Carry-overs (não-bloqueantes)

- 15 erros TS em `src/agents/` agora EXCLUÍDOS do build (resolvido via tsconfig) — débito de housekeeping (deletar pasta OU consertar OU `.gitignore`) ainda pendente.
- Smoke E2E real CV-2026-0001 (Luciano manual).
- D-novo-UX-Dialog-Backdrop P3.
- D-novo-CT-TARIFA-ALOCACAO P3.
- D-novo-CT-VALIDACAO-FISCAL P0 (gate fiscal interno).
- 43+ untracked scripts/relatórios — Sprint Housekeeping futuro.
- 256 legados allowlist lint:tenant — esvaziar incrementalmente.
- Convenção MENSAL (Mini-Bloco H'.9 17/05) ainda não aplicada — 2 usinas em ANUAL.
- IDEIA Fatia 9 (portal self-service da empresa) — registrada, depende de login portal pra empresa.

## Regras aplicadas na sessão

- Decisão 23 (Fase 1 read-only) — aplicada 4 vezes (Ponto 1, Ponto 2a, D-FISCAL-2.5, Sprint Convite Fase 1).
- Decisão 24 (frase de retomada local único).
- Regra rebuild backend obrigatório + verificar dist (formalizada pós-hotfix).
- Regra HELP obrigatório (19/05).
- Regra selects NATIVOS dentro de Dialog/wizard (19/05).
- Schema aditivo sem `--accept-data-loss`; ritual PM2 (stop → port livre → db push → start) — aplicado 2× (Ponto 2a + Fatia 1).
- `isAmbienteReal()` em testes — NUNCA `NODE_ENV`.
- Regra contatos teste: `27981341348` + `lucbragatto@gmail.com` (catalogada em CLAUDE.md).
- `@TenantResource @AuditLog` em handlers de mutação novos.
- `@AsPlatform()` em cron de plataforma.
- `Math.round(x*100)/100` em valores monetários.
- Padrão ConviteProprietario M31 como template canônico pra magic link.

## Frase comandante (próxima sessão)

> Frase canônica única em [`## FRASE DE RETOMADA — próxima sessão Code`](../CONTROLE-EXECUCAO.md#frase-de-retomada--próxima-sessão-code) do `CONTROLE-EXECUCAO.md` (Decisão 24 — local único, atualizada 02/06 noite tarde no fechamento desta sessão).

## Próximo passo

**Rodar Fatia 2 do Sprint Convite-Convênio** — backend admissão pública:
- Endpoint `POST /publico/convenios/auto-inscrever` `@Public()`.
- Param `origem=CONVITE_PUBLICO` em `adicionarMembro` → membro nasce `status=PENDENTE_APROVACAO_EMPRESA, ativo=false`.
- Dedup CPF por convênio (impedir 2 cadastros do mesmo CPF no mesmo convênio).
- Quota check (`limiteMembros` count + `kwhAlocadoMaxMensal` soma alocações).
- Rate-limit: 3/h por CPF, 30-60/h por IP.
