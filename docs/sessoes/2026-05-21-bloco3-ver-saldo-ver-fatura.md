# Sessão 2026-05-21 (tarde/noite) — Sprint Bot Autoatendimento / Bloco 3: Ver saldo + Ver fatura

## TL;DR

Sessão Code dedicada que entregou o **Bloco 3 do Sprint Bot Autoatendimento WhatsApp** — completou as 2 opções que ainda viravam loop no Menu do Cooperado ("1 Ver saldo de créditos" e "2 Ver próxima fatura"). Premissa corrigida na abertura: **"saldo de créditos" = créditos de ENERGIA (kWh) da distribuidora, NÃO tokens do CooperToken** (o saldo vive em `FaturaProcessada.saldoKwhAtual`, extraído via OCR Claude AI da fatura mensal). Fase 1 read-only mapeou: o handler hardcoded já implementava as 2 opções mas (a) mostrava `kwhContratoMensal` rotulado como "Seus créditos" (ambiguidade conceitual) e (b) usava status `'PENDENTE'` em query de cobrança quando o banco vai pra `'A_VENCER'` (bot mente sobre faturas). Luciano aprovou **Opção C** (mostrar PLANO contratado + SALDO da distribuidora com rótulos separados, fallback de linhas que somem quando dado ausente) + 4 decisões de produto pendentes. Fase 2 implementou 2 ações no motor (`CONSULTAR_SALDO_CREDITOS` + `CONSULTAR_PROXIMA_FATURA`) com guard cooperadoId + multi-tenant defense in depth, 2 estados/etapas globais novas, 2 modelos globais novos no Banco de Mensagens, gatilhos "1" e "2" do MENU_COOPERADO repointados (campo `acao` órfão removido). 109/109 specs verdes (era 89). 2 débitos novos catalogados (D-novo-U bug do hardcoded + D-novo-V melhoria futura de motor de template). 5 commits empacotados (3 trabalho + 2 débitos).

## Marco entregue

**M18 — Sprint Bot Autoatendimento WhatsApp: Bloco 3 (Ver saldo + Ver próxima fatura) implementado**

## Commits do dia (5)

| Hash | Mensagem |
|---|---|
| `3d3e8c4` | feat(wa): Bloco 3 — Ver saldo + Ver fatura no motor dinâmico |
| `6fb2571` | feat(wa): Bloco 3 — script idempotente + seed alinhado MENU_COOPERADO |
| `7f1f885` | docs(debitos): cataloga D-novo-U — handler hardcoded ver fatura usa status PENDENTE inexistente |
| `8fd1dd1` | docs(debitos): cataloga D-novo-V — modelos Bloco 3 com lógica condicional no código (P3 melhoria) |
| (a seguir) | docs(sessao): fechamento M18 — Bloco 3 Sprint Bot Autoatendimento |

## Entregas técnicas

### Fase 1 read-only — achados centrais

**Onde vive o saldo de créditos de ENERGIA (kWh):**
- `FaturaProcessada.saldoKwhAtual` Decimal(10,2) — populado via OCR Claude AI (prompt em `faturas.service.ts:1470-1472`: *"APENAS extraia se aparecer EXPLICITAMENTE no PDF. NÃO calcule por diferença"*)
- Outros campos relacionados: `saldoKwhAnterior`, `validadeCreditos` (créditos GD vencem em 60 meses)
- **3 condicionantes:** só existe se cooperado mandou fatura + status APROVADA; pode estar desatualizado; pode ser 0/null se OCR não encontrou
- **Confirmação no banco DEV:** Luciano (cooperado real) NÃO tem `FaturaProcessada` APROVADA — ele veria "sem dados"

**Próxima fatura:** `Cobranca` com `status IN ('A_VENCER', 'VENCIDO')` ordenado por `dataVencimento asc`.

**Bug latente do hardcoded:** `whatsapp-bot.service.ts:791-794` usa `status: { in: ['PENDENTE', 'VENCIDO'] }` mas distribuição real no banco DEV é A_VENCER=7, VENCIDO=3, PAGO=35, **PENDENTE=0**. Bot responde "sem faturas pendentes" mesmo com cobranças A_VENCER. **D-novo-U catalogado.**

**Ambiguidade conceitual do produto atual:** handler hardcoded mostrava `Contrato.kwhContratoMensal` (kWh contratado) rotulado como "Seus créditos" — descrição do menu admite o desvio ("Seus kWh contratados"). São conceitos completamente diferentes (kWh contratado da usina ≠ saldo de energia injetada na distribuidora).

### Decisões de produto Luciano (21/05 noite)

1. **Opção C aprovada** para "Ver saldo de créditos": mostra PLANO contratado + SALDO da distribuidora com rótulos separados, NÃO confundir conceitos
2. **Link Asaas** quando AsaasCobranca tem `linkPagamento` (só link existente, não inventar)
3. **`validadeCreditos=null`** → omitir a linha (não mostrar "—")
4. **Cooperado sem cooperadoId** → mensagem amigável de cadastro (mesma linha do `ENVIAR_LINK_INDICACAO`)

### Backend (`whatsapp-fluxo-motor.service.ts`)

**`executarAcao()` ganhou 2 cases novos:**
- `CONSULTAR_SALDO_CREDITOS` → `executarConsultarSaldoCreditos()`
- `CONSULTAR_PROXIMA_FATURA` → `executarConsultarProximaFatura()`

**`executarConsultarSaldoCreditos()`** — padrão defensivo igual ENVIAR_LINK_INDICACAO:
- Guard `cooperadoId` (sem id → mensagem amigável de cadastro, não consulta dados)
- `Contrato.findMany({ cooperadoId, status: 'ATIVO', cooperativaId? })` — multi-tenant defense in depth, soma `kwhContratoMensal`
- `FaturaProcessada.findFirst({ cooperadoId, status: 'APROVADA', cooperativaId? })` ordem desc, lê `saldoKwhAtual`/`validadeCreditos`/`mesReferencia`/`createdAt`
- Busca modelo `saldo_creditos_resultado` no banco respeitando escopo tenant
- Monta vars com fallback: `linha_saldo` (some se saldoKwh=0/null), `linha_validade` (some se null), `linha_ultima_fatura` (CTA "envie fatura" quando ausente)
- Renderiza template + anexa rodapé universal + envia + incrementa uso do modelo

**`executarConsultarProximaFatura()`** — mesma estrutura:
- Guard `cooperadoId`
- `Cobranca.findFirst` com `where.contrato` filtrado por cooperadoId+cooperativaId + `status IN ['A_VENCER', 'VENCIDO']` (corrige D-novo-U)
- Quando cobrança existe: `AsaasCobranca.findFirst({ cobrancaId })` desc — link só se `linkPagamento` existe (não inventa)
- Monta `bloco_fatura` (Valor + Vencimento + Status) e `link_pagamento` condicional
- Quando NÃO há cobrança: `bloco_fatura = "Você não tem faturas em aberto"`
- Modelo `proxima_fatura_resultado` consumido com vars

**5 helpers de formatação privados:** `formatarKwh`, `formatarMoeda`, `formatarData`, `formatarMesAno`, `formatarStatusCobranca` (A_VENCER → "A vencer", VENCIDO → "Vencida", etc).

### Specs (`whatsapp-fluxo-motor.service.spec.ts`)

**109/109 verdes** (era 89). **20 specs novos** distribuídos em 2 describes:

`executarAcao(CONSULTAR_SALDO_CREDITOS)` — 10 cenários:
- SEM cooperadoId → mensagem cadastro, não consulta nada
- MULTI-TENANT com/sem cooperativaId na conversa
- CASO COMPLETO (plano + saldo + validade renderizados)
- FALLBACK saldoKwhAtual=null → linha do saldo some
- FALLBACK validadeCreditos=null → linha da validade some
- FALLBACK nenhuma FaturaProcessada → CTA pra enviar fatura
- Modelo não encontrado → não envia, loga warn
- Soma kwhContratoMensal de MÚLTIPLOS contratos ATIVOS
- ZERO SIDE EFFECT em simular() — retorna acaoAutomatica mas não consulta dados

`executarAcao(CONSULTAR_PROXIMA_FATURA)` — 10 cenários:
- SEM cooperadoId → mensagem cadastro
- **D-novo-U guard**: query usa `['A_VENCER', 'VENCIDO']` (NÃO 'PENDENTE')
- MULTI-TENANT com/sem cooperativaId
- Nenhuma cobrança pendente → mensagem "em dia" + NÃO busca AsaasCobranca
- Cobrança COM AsaasCobranca.linkPagamento → inclui link
- Cobrança SEM AsaasCobranca → NÃO inventa link
- valorLiquido null → fallback pra valorBruto
- Modelo não encontrado → não envia
- Rodapé universal sempre anexado

### Dados (banco DEV — 1 script idempotente)

**`fix-bloco-3-menu-cooperado-saldo-fatura.ts`** (3 partes):
- **Parte 1:** INSERT 2 etapas globais (`VER_SALDO_CREDITOS` ordem 50 + `VER_PROXIMA_FATURA` ordem 51), modeloMensagemId: null, acaoAutomatica set, ativo: true
- **Parte 2:** INSERT 2 modelos globais (`saldo_creditos_resultado` + `proxima_fatura_resultado`, categoria BOT, ativo: true) — atualiza conteúdo se divergente
- **Parte 3:** REPOINTA gatilhos do `MENU_COOPERADO`:
  - "1" `MENU_COOPERADO + acao=VER_CREDITOS` → `VER_SALDO_CREDITOS` (sem acao)
  - "2" `MENU_COOPERADO + acao=VER_FATURA` → `VER_PROXIMA_FATURA` (sem acao)

ANTES/DEPOIS visível em todas as mudanças. 2ª execução confirmada idempotente (tudo skip).

### Seed alinhado

`prisma/seeds/seed-fluxos-bot.mjs`:
- 2 etapas novas adicionadas (ordens 50/51)
- Gatilhos "1" e "2" do MENU_COOPERADO sem `acao` órfã
- **Aproveitado o mesmo array:** gatilho "5" também alinhado (estava com loop + `acao: 'GERAR_LINK_INDICACAO'` órfã; banco já cabeia pra `ENVIAR_CONVITE` desde Bloco 0 v2 R5 — seed estava desalinhado)

### Documentos

- `docs/PLANO-ATE-PRODUCAO.md` Seção 3b — Bloco 3 marcado ✅ com descrição detalhada da entrega. Estimativa entregue revista pra ~24h. Specs em 109/109. Restante do sprint: ~13-25h em Blocos 1.b, 4, 5, 6, 7, 8.
- `docs/debitos-tecnicos.md` — 2 entradas novas (D-novo-U + D-novo-V).

## Bugs resolvidos / catalogados

| # | Severidade | Causa raiz | Fix | Status |
|---|---|---|---|---|
| Opção "1 Ver saldo de créditos" virava loop | UX produção | Gatilho com `proximoEstado: MENU_COOPERADO + acao: VER_CREDITOS` órfã (motor não processa `acao`) | Estado novo VER_SALDO_CREDITOS com `acaoAutomatica: CONSULTAR_SALDO_CREDITOS` | ✅ RESOLVIDO (`3d3e8c4`, `6fb2571`) |
| Opção "2 Ver próxima fatura" virava loop | UX produção | Gatilho com `proximoEstado: MENU_COOPERADO + acao: VER_FATURA` órfã | Estado novo VER_PROXIMA_FATURA com `acaoAutomatica: CONSULTAR_PROXIMA_FATURA` | ✅ RESOLVIDO (`3d3e8c4`, `6fb2571`) |
| Ambiguidade conceitual "kWh contratado vs saldo de créditos" | UX produto | Handler hardcoded mostrava `kwhContratoMensal` rotulado como "Seus créditos" | Opção C — rótulos separados ("Plano contratado" vs "Saldo na distribuidora") | ✅ RESOLVIDO (decisão produto + impl no `3d3e8c4`) |
| Handler hardcoded `ver fatura` usa `status: 'PENDENTE'` (nunca existe) | P2 latente | `whatsapp-bot.service.ts:791-794` usa `PENDENTE` mas cobranças vão pra `A_VENCER`; bot mente sobre faturas em fallback | Caminho dinâmico do Bloco 3 corrige (`A_VENCER, VENCIDO`); fix do hardcoded fica pra Sprint Housekeeping | 🟡 CATALOGADO D-novo-U |
| Modelos do Bloco 3 com lógica condicional no código | P3 melhoria | Modelos no banco são esqueleto; linhas condicionais + bloco de fatura + CTA estão hardcoded nas ações do motor — admin não consegue editar pelo painel | Mini-engine de template `{{#if}}/{{#unless}}/{{#case}}` (~8-12h, vinculado a D-novo-T Iniciativa Fluxos Customizáveis) | 🟡 CATALOGADO D-novo-V |
| Seed `seed-fluxos-bot.mjs` desalinhado no gatilho "5" | dado/seed | Loop + `acao: GERAR_LINK_INDICACAO` órfã; banco já cabeava pra ENVIAR_CONVITE desde Bloco 0 v2 R5 | Atualizado pro mesmo padrão (sem `acao` órfã) | ✅ RESOLVIDO incidentalmente no `6fb2571` |

## Decisões estratégicas catalogadas

Nenhuma memória persistente nova criada nesta sessão. Aplicadas memórias existentes:

- `sprint_bot_autoatendimento_20_05.md` — escopo do sprint, Bloco 3 seguido à risca
- `iniciativa_fluxos_customizaveis_20_05.md` — referenciada em D-novo-V como solução-mãe futura
- `regra_validacao_previa_e_retomada.md` Decisão 23 (Fase 1 read-only OBRIGATÓRIA — aplicada com correção de premissa do Luciano sobre "saldo = kWh, não tokens")
- `regra_validacao_previa_e_retomada.md` Decisão 14 (grep amplo antes de catalogar D-novo-U e D-novo-V — confirmados livres)
- `decisao_24_frase_retomada_unica.md` (frase única no CONTROLE-EXECUCAO)
- `feedback_fase1_readonly_obrigatoria.md` — Fase 1 entregou desenho completo + decisão de produto pendente ANTES de qualquer escrita

**Decisão de produto catalogada (não vira memória nova):** Opção C aprovada por Luciano 21/05 noite (Plano contratado + Saldo distribuidora com rótulos separados). Caso reverter, mudança fica isolada em `executarConsultarSaldoCreditos`.

## Próximo passo

**Bloco 4 do Sprint Bot Autoatendimento WhatsApp — Atualizar Cadastro.**

4 etapas novas (AGUARDANDO_NOVO_NOME / AGUARDANDO_NOVO_EMAIL / AGUARDANDO_NOVO_TELEFONE / AGUARDANDO_NOVO_CEP) + 4 ações persistentes que atualizam `Cooperado` no banco com validação (email válido, CEP formato `00000-000`). Os 4 modelos correspondentes (`aguardando_novo_nome`, `aguardando_novo_email`, `aguardando_novo_telefone`, `aguardando_novo_cep`) **já existem no Banco de Mensagens** desde o Bloco 2 (commit `1097f72`). Estimativa: ~6-8h Code.

## Pré-requisitos leitura próxima sessão

- `docs/CONTROLE-EXECUCAO.md` (estado atualizado + FRASE DE RETOMADA)
- `docs/sessoes/2026-05-21-bloco3-ver-saldo-ver-fatura.md` (esta sessão)
- `docs/PLANO-ATE-PRODUCAO.md` Seção 3b (status Sprint Bot Autoatendimento)
- Memória `sprint_bot_autoatendimento_20_05.md` (Bloco 4 detalhado)
- Código a inspecionar na Fase 1 read-only do Bloco 4:
  - `backend/src/whatsapp/whatsapp-fluxo-motor.service.ts` — onde adicionar 4 cases novos em `executarAcao()` (padrão Bloco 3 do `CONSULTAR_*`)
  - `backend/src/cooperados/cooperados.service.ts` — verificar se há método `update()` exposto pra atualização parcial (nome/email/telefone/endereço) ou precisa criar
  - Estados atuais `ATUALIZACAO_CADASTRO` no seed + banco — confirmar quem cabeia gatilhos 1-4 hoje
  - Validação: CPF tem `class-validator` no DTO de criação; verificar se há helpers compartilhados pra email e CEP
- Decisões produto pendentes pro Luciano (não bloqueiam Fase 1):
  - O que fazer quando email novo conflita com email de OUTRO cooperado (unique constraint)? Erro amigável + cancela atualização? Aceitar via campo `+suffix`?
  - CEP inválido / API ViaCEP fora: persistir só CEP digitado, ou bloquear?

## Carry-overs (não-bloqueantes)

**Blocos pendentes do Sprint Bot Autoatendimento (~13-25h restantes):**
- 🔴 Bloco 1.b — ME CHAME DEPOIS (~3-5h, exige job de reagendamento)
- 🔴 **Bloco 4 — Atualizar Cadastro (PRÓXIMO, ~6-8h, modelos prontos)**
- 🔴 Bloco 5 — Atualizar Contrato (~4-6h, decisão produto)
- 🔴 Bloco 6 — Cadastro Proxy (~6-8h, modelos prontos)
- 🔴 Bloco 7 — NPS no fluxo (~2-3h, modelo pronto)
- 🔴 Bloco 8 — Menu Fatura/Inadimplente (~4-6h, decisão produto)

**Após Sprint Bot Autoatendimento (fila operacional 3d):**
- M15 Sprint 5a Neutro Fio B (3-5 dias, cria módulo Fio B)
- Cadastrar usina cooperebr2 (depende M15)
- Onboarding Sinergia (depende M15 + Sprint 6 IDOR + D-novo-Q Contatos Teste)

**Decisões produto pendentes pro Luciano (carry-over M17/Bloco 3):**
- Desativar 1 das 2 etapas globais ATIVAS duplicadas no INICIAL
- Atualizar Contrato (Bloco 5): ação automática vs solicitação + humano
- Menu Fatura / Menu Inadimplente (Bloco 8): dinâmico vs hardcoded
- `{{distribuidora}}` vazia em AGUARDANDO_DISPOSITIVO_EMAIL
- Horário hardcoded em `aguardando_atendente`
- Variáveis-fantasma na UI ModalMensagem (~30min UX admin)

**Outros débitos catalogados:**
- D-novo-Q Contatos Teste persistentes (6-8h Code)
- **D-novo-U** (1-2h Code) — fix do handler hardcoded em Sprint Housekeeping
- **D-novo-V** (~8-12h Code) — motor de template com `{{#if}}/{{#unless}}`, vinculado a D-novo-T (Iniciativa Fluxos Customizáveis)
- Sprint Housekeeping (~3-5h)
- HTML jornada Sugestão #6
- D-novo-H refator técnico (~6-8h)
- Iniciativa Fluxos Customizáveis (D-novo-T, futuro, ~100-200h+)

## Regras aplicadas na sessão

- ✅ **Decisão 23** — Fase 1 read-only OBRIGATÓRIA antes de Fase 2 (aplicada com correção de premissa "saldo = kWh, não tokens")
- ✅ **Decisão 14** — grep amplo antes de catalogar D-novo-U e D-novo-V (confirmados livres; match anterior em `D-novo-X` era placeholder genérico na lição da Decisão 14 original)
- ✅ **Decisão 24** — frase de retomada em local único (atualizada no `CONTROLE-EXECUCAO` ao fim)
- ✅ **`git status --short` antes de cada commit** (5 commits separados por natureza: 2 código, 1 dados, 2 débitos)
- ✅ **Protocolo PM2** — stop → script → restart limpo
- ✅ **Multi-tenant defense in depth** — todas as 3 queries novas (Contrato, FaturaProcessada, Cobranca via contrato) filtram por `cooperativaId` quando conhecida
- ✅ **Status correto `['A_VENCER', 'VENCIDO']`** em CONSULTAR_PROXIMA_FATURA (NÃO usa 'PENDENTE' — bug do hardcoded D-novo-U)
- ✅ **Link Asaas só quando existe** — não inventa
- ✅ **Fallback explícito** — saldoKwhAtual=null linha some, validadeCreditos=null linha some
- ✅ **Rodapé universal anexado** em toda resposta (após render do template)
- ✅ **ZERO side-effect em simular()** — testado explicitamente
- ✅ **Não-paralelo com claude.ai** — sessão Code 100% pelo Luciano direto
- ✅ **Sem push e sem /fechamento durante implementação** — só ao final (regra do prompt da Fase 2 + ritual de fechamento canônico)

## Frase comandante

Frase canônica única em `docs/CONTROLE-EXECUCAO.md` seção `## FRASE DE RETOMADA — próxima sessão Code` (Decisão 24 — local único, atualizada 21/05 noite fechamento M18 Bloco 3).
