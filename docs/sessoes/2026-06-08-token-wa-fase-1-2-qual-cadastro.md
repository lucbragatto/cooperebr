# Sprint Token-WA Fase 1+2 completa + hardening + "Qual cadastro?" multi-cadastro — 08/06/2026

## TL;DR

Sessão maratona de 22 commits entregou: (1) Sprint Token-WA Fase 1 (consultas read-only saldo/extrato CooperToken pelo bot WhatsApp); (2) Sprint Token-WA Fase 2 completa em 8 fatias F2.1→F2.8 (schema aditivo PIN + AparelhoVinculado + OtpDesafio + TokenTransacao; otp-helper genérico; PinCooperadoService com lockout; LimiteTokenService 2 níveis; TokenNotificacaoService; smoke E2E 22/22; submenu "Alterar limite" no WA); (3) F2.9 hardening P0 (JWT sem fallback, updateMany cooperativaId anti-IDOR, validarPin private, lockout 30min, somarGastoHoje em America/Sao_Paulo, status ATIVO guard, OtpDesafio.cooperativaId); (4) F2.10 implementação `VERIFICAR_COOPERADO` que estava faltando + opção 8 CooperTokens no menu hardcoded + setup SISGD teste (490 tokens); (5) Adendo schema TokenTransacao rica (merchantNome/descricao/categoria/localCidade/tipoOperacao/referenciaExterna pra extrato estilo cartão); (6) **Destrava bot WA**: webhook ?secret= no whatsapp-service/.env + telefone Luciano normalizado pra E.164; (7) Fixes UX: render `**` patológico eliminado, persona "P"→"Coop", acentos em mensagens visitante, tenant default por env DEFAULT_TENANT_ID; (8) Sprint "Qual cadastro?" 4 fixes (helper matcher + WhatsApp escolha + Portal multi-cadastro anti-IDOR + ContextoSwitcher chama backend); (9) **Adendo: reconhecimento automático na entrada** (INÍCIO/MENU dispara reconhecimento antes do fluxo padrão); (10) Catalogado D-novo-WA-PHONE-NORMALIZE P2. **310/310+ specs verde** (89 unit Fase 2 + 14 matcher + 11 multi-cadastro WA + 11 multi-cadastro portal + 5 tenant default + 266 motor + 16 obter-contextos + smoke E2E 22/22).

## Marco entregue

**M26 — Sprint Token-WA Fase 1 + Fase 2 completa + hardening + "Qual cadastro?" multi-cadastro**

## Commits do dia (22)

| Hash | Mensagem |
|---|---|
| ccf0074 | feat(token-wa): Fase 1 — consultas read-only de CooperTokens pelo bot |
| 481cebc | feat(token-wa): F2.1 schema aditivo — PIN + limites 2 niveis + 3 tabelas |
| 124f3d5 | refactor(security): F2.2 extrai otp-helper.ts generico de ConvitesConvenioService |
| 7c3b824 | feat(token-wa): F2.3 PinCooperadoService — hash + rate-limit + lockout |
| be82b0c | feat(token-wa): F2.4 AparelhoVinculadoService + OtpDesafioService |
| 83953f6 | feat(token-wa): F2.5 LimiteTokenService — 2 niveis (cooperativa x cooperado) |
| 0ba29ae | feat(token-wa): F2.6 TokenNotificacaoService — 2 lados + OTP alto valor por email |
| 5204f91 | test(token-wa): F2.7 smoke E2E Fase 2 — 22/22 verde + specs Jest consolidados |
| 9ca604c | feat(token-wa): F2.8 opcao "Alterar meu limite" no submenu CooperTokens (WA) |
| 8e867a5 | feat(token-wa): adendo Fase 2/3 — TokenTransacao rica + LancamentoCaixa TOKEN_TRANSACAO |
| f4d20c7 | feat(token-wa): F2.9 hardening P0 + destrava bot WA + cataloga D-novo-WA-PHONE-NORMALIZE |
| f8b629b | feat(token-wa): F2.10 implementa VERIFICAR_COOPERADO + opcao 8 hardcoded + setup SISGD teste |
| de4e725 | fix(wa-bot): elimina render "**" patologico quando variavel vazia |
| dcce884 | fix(wa-bot): persona CoopereAI renomeada de 'P' para 'Coop' |
| 29dd88e | fix(wa-bot): acentos em mensagens do funil visitante + script audit templates |
| 0e8c084 | fix(wa-bot): tenant default pra render quando conversa sem cooperativaId |
| 97b61f3 | feat(cooperados): helper compartilhado pra localizar todos cadastros do mesmo dono |
| 09d5531 | feat(wa-bot): escolha de cadastro quando telefone tem 2+ cooperados |
| a04fd54 | feat(auth): portal multi-cadastro - obterContextos lista cada cooperado + trocar anti-IDOR |
| 7d3a9ec | feat(web): seletor de contexto chama backend trocar-contexto com cooperadoId |
| 83ef5bf | feat(wa-bot): reconhecer cooperado na ENTRADA (INICIO/MENU/saudacao) |
| 8f51f58 | fix(wa-bot): INICIAL global aponta pra menu_principal + gatilhos 1/2/3/4 |

## Entregas técnicas

### Sprint Token-WA Fase 1 (consultas read-only)
- Submenu MENU_COOPERTOKENS no bot WA (opção "8" no MENU_COOPERADO).
- Ações `CONSULTAR_SALDO_TOKENS`, `CONSULTAR_EXTRATO_TOKENS`, `EXTRATO_TOKENS_PAGINAR` no `WhatsappFluxoMotorService`.
- 3 etapas globais novas + 2 modelos (`menu_cooper_tokens`, `saldo_tokens_resultado`) via `scripts/seed-menu-cooper-tokens-fase1.ts`.
- Specs 12/12 (5 saldo + 4 extrato + 3 paginação).

### Sprint Token-WA Fase 2 (segurança) — F2.1→F2.8
- **F2.1** Schema delta aditivo: `Cooperado` +PIN (hash/salt/tentativas/lockout/definidoEm) + auto-limites; `Cooperativa` +tetos transação/diário; 3 models novos (`AparelhoVinculado`, `OtpDesafio`, `TokenTransacao` com jti uso-único anti-replay).
- **F2.2** Helper genérico `common/security/otp-helper.ts` (gerarCodigoOtp/gerarSaltOtp/hashOtp/compararOtp/gerarTokenHex/gerarIdCurto). ConvitesConvenioService refatorado via wrappers static delegate.
- **F2.3** `PinCooperadoService` em `cooperados/`: definirPin, validarPin (private), validarPinComLockout, alterarPin, resetarPin, temPin. Anti-IDOR multi-tenant em 404.
- **F2.4** `OtpDesafioService` em `common/security/` (genérico) + `AparelhoVinculadoService` em `cooperados/` (device binding 2-passos com OTP).
- **F2.5** `LimiteTokenService` 2 níveis: teto cooperativa × auto-limite cooperado; verificarValor com gasto diário; clamp automático.
- **F2.6** `TokenNotificacaoService` em `cooper-token/`: notificarPagador, notificarRecebedor, enviarOtpAltoValorPorEmail (HTML com OTP destacado + motivo step-up).
- **F2.7** Smoke E2E `scripts/smoke-token-wa-fase2.ts` 22/22 verde (PIN + AparelhoVinculado + LimiteToken end-to-end real no DB).
- **F2.8** "Alterar meu limite" no submenu CooperTokens (3 ações novas no motor + seed F2.8 etapas + gatilho "3" no MENU_COOPERTOKENS).

### Adendo Fase 2/3 — TokenTransacao rica
- 6 campos aditivos pra extrato estilo cartão: `merchantNome`, `descricao`, `categoria`, `localCidade`, `tipoOperacao` (PAGAMENTO/TRANSFERENCIA/RECEBIMENTO/RESGATE/COMPRA_TOKEN), `referenciaExterna`.
- `OrigemLancamento` +1 valor `TOKEN_TRANSACAO` pra hook futuro Fase 3 → `LancamentoCaixa`.

### F2.9 Hardening P0 (segurança)
- Remove fallback `'fallback-dev-secret'` do JWT (motor:2114) → throw se ausente.
- UPDATE com cooperativaId em PIN/Aparelho/Limite (updateMany defesa em profundidade contra IDOR).
- `validarPin` agora **private** (consumidores externos usam validarPinComLockout).
- Lockout PIN: 15min → 30min.
- `somarGastoHoje` (LimiteTokenService) em **America/Sao_Paulo** via `Intl.DateTimeFormat`.
- Guard `status=ATIVO` no fluxo "alterar limite" do bot WA.
- `OtpDesafio.cooperativaId` aditivo nullable + propagação no service.

### F2.10 + correções bot WA
- Implementa ação `VERIFICAR_COOPERADO` que estava declarada em gatilho do MENU_PRINCIPAL global mas não tinha implementação no motor (motor caía no default → bot silencioso → cooperado nunca chegava em MENU_COOPERADO).
- Adiciona opção 8 "💎 CooperTokens" no menu hardcoded `whatsapp-bot.service.ts:672-684` (paridade com seed F1.3).
- Setup SISGD: cooperado PJ SEM_UC + ContratoConvenio EMPRESA + 490 tokens creditados via `scripts/setup-sisgd-clube-teste.ts`.

### Fixes UX bot WA
- Render `**` patológico: defensivo no `renderizarTemplate` — quando var vazia E entre asteriscos, remove asteriscos. Cobre 8 modelos com padrão `*{{var}}*`.
- Persona CoopereAI: `"Você é o P"` → `"Você é o Coop"` em `coopere-ai.service.ts:13`.
- Acentos: 6 strings hardcoded + 4 modelos no banco corrigidos (você/não/só/é só/está).
- **Tenant default por env** `DEFAULT_TENANT_ID=cmn0ho8bx0000uox8wu96u6fd` (CoopereBR) — `carregarContextoCooperativa(undefined)` tenta env → única cooperativa ativa → null.

### Sprint "Qual cadastro?" multi-cadastro (4 fixes)
- **Fix 1**: helper `cooperados/cooperado-matcher.helper.ts` (variantesTelefone, acharCooperadosPorTelefone, acharCooperadosPorUsuario, formatarLabelCadastro). 14/14 specs.
- **Fix 2 WhatsApp**: refatora `executarVerificarCooperado`; >1 cadastros → `MENU_ESCOLHA_CADASTRO` + persiste candidatos em dadosTemp. Nova ação `ESCOLHER_CADASTRO_COOPERADO` com anti-IDOR (re-lê do banco, valida índice). Comando universal `TROCAR CADASTRO`. Seed `scripts/seed-menu-escolha-cadastro.ts`.
- **Fix 3+4 Portal**: `obterContextosUsuario` substitui findFirst por findMany — 1 contexto cooperado por cadastro (labels PF/PJ diferenciados). `trocarContexto` aceita `cooperadoIdEscolhido` + valida posse (anti-IDOR Forbidden em cooperadoId de terceiro / sem escolha / tipo inexistente). 16/16 specs (5 ajustados + 11 novos).
- **Fix 3 web**: `ContextoSwitcher` chama `POST /auth/trocar-contexto` com cooperadoId + grava JWT novo. Erro do backend interrompe troca local (consistência).

### Adendo "qual cadastro?" — reconhecimento automático na entrada
- Helper público `tentarReconhecerVisitante(conversa)` no motor.
- `executarComandoUniversalReal('INICIO'|'MENU')` dispara reconhecimento ANTES do fluxo padrão se conversa.cooperadoId=null. Cooperado reconhecido pula direto pra MENU_COOPERADO (1) ou MENU_ESCOLHA_CADASTRO (>1).
- `handleMenuPrincipalInicio` no bot.ts faz o mesmo pra path "ola"/"oi"/"menu".
- INICIAL global aponta pra `menu_principal` (4 opções) em vez de `boas_vindas` (envie foto) + gatilhos 1/2/3/4 alinhados com tenant CoopereBR.

### Bot WA — destrava operacional
- `whatsapp-service/.env`: `BACKEND_WEBHOOK_URL` ganhou `?secret=cooperebr_wh_2026` (estava sem). Antes backend rejeitava 401 silenciosamente.
- Telefone Luciano normalizado: `(27)98134-1348` → `5527981341348` E.164 BR (`scripts/fix-telefone-luciano.ts`).
- Cooperado "teste" duplicado com mesmo telefone teve telefone anonimizado → null (`scripts/cleanup-conversa-luciano.ts`).

## Bugs resolvidos / catalogados

| # | Severidade | Causa raiz | Fix | Status |
|---|---|---|---|---|
| Webhook 401 silencioso | P0 | `BACKEND_WEBHOOK_URL` sem `?secret=` | Edit inline `.env` + restart WA | RESOLVIDO |
| Telefone Luciano não casava | P0 | `(27)98134-1348` formatado vs E.164 do WA | UPDATE direto + script catalogado | RESOLVIDO |
| Bot silencioso no "1 Já sou cooperado" | P0 | Ação `VERIFICAR_COOPERADO` não implementada no motor | F2.10 implementa case + método | RESOLVIDO |
| Render `**` em "Sou o assistente da **" | P0 | `*{{parceiro}}*` com var vazia | Defensivo regex no `renderizarTemplate` + tenant default env | RESOLVIDO |
| Persona "Sou o P" | P1 | SYSTEM_PROMPT truncado | "P" → "Coop (CoopereAI)" | RESOLVIDO |
| Menu visitante "envie foto" em INÍCIO | P1 | INICIAL global modeloMensagemId=boas_vindas + gatilhos vazios | Script alinha global com menu_principal + 4 gatilhos | RESOLVIDO |
| JWT fallback `fallback-dev-secret` | P0 | Hardcoded em `?? 'fallback-dev-secret'` | Throw se ausente | RESOLVIDO |
| Lockout PIN 15min insuficiente | P1 | Hardening Fase 2.9 | 15min → 30min | RESOLVIDO |
| `somarGastoHoje` em fuso UTC | P1 | `setHours(0)` local | `Intl.DateTimeFormat` America/Sao_Paulo | RESOLVIDO |
| UPDATEs sem cooperativaId guard | P1 | `update` simples por id | `updateMany` com cooperativaId | RESOLVIDO |
| `validarPin` exposto pra brute-force sem rate-limit | P0 | Public method usável sem lockout | Tornou private | RESOLVIDO |
| Telefone duplicado bate em 1º cooperado só | P1 | `findMany.[0]` em VERIFICAR_COOPERADO | Fluxo "qual cadastro?" >1 cadastros | RESOLVIDO |
| Portal: 1 cooperado por Usuario só | P1 | `findFirst` em `obterContextosUsuario` | findMany + 1 contexto por cadastro | RESOLVIDO |
| Portal: troca contexto sem JWT refresh | P1 | Front só atualizava localStorage | ContextoSwitcher chama backend + grava JWT | RESOLVIDO |
| ESCOLHER_CADASTRO confiar em payload | P0 | Sem validação anti-IDOR | Re-lê dadosTemp.candidatosCadastro do banco | RESOLVIDO |
| Portal trocar pra cadastro de terceiro | P0 | trocarContexto não validava posse | Re-busca contextos pelo usuario.id + Forbidden | RESOLVIDO |
| `D-novo-WA-PHONE-NORMALIZE` | P2 | Telefones formatados não casam matcher | Fix paliativo dev + fix amplo catalogado | CATALOGADO em `docs/debitos-tecnicos.md` |
| Visitante "INÍCIO" sem reconhecimento → INICIAL "envie foto" | P1 | Motor só transitava sem tentar reconhecer | Reconhecimento automático em INICIO/MENU/saudação | RESOLVIDO |
| 3 ações declaradas em gatilho não implementadas (`PROCESSAR_OCR`, `MOSTRAR_MENU_PRINCIPAL`) | P2 | Pré-existentes | Catalogado pra futuro | CATALOGADO |

## Decisões estratégicas catalogadas

- Estratégia tenant default: env `DEFAULT_TENANT_ID` (escolha B do Luciano, não A — porque há 2 cooperativas no banco).
- Lockout PIN 30min (era 15min) — decisão hardening F2.9.
- TokenTransacao com 6 campos extrato estilo cartão desde F2.1 (evita 2ª migration na Fase 3).
- "Só consultas sem PIN; dinheiro só com PIN" — invariante mantida em multi-cadastro.
- Sprint "Qual cadastro?" multi-canal (WA + Portal) com anti-IDOR forte em ambos.
- Pausa antes da Fase 3 (TokenTransacao + QR + pagamento — move dinheiro) conforme decisão Luciano.

## Próximo passo

Decisão Luciano: **Fase 3 do Token-WA** (TokenTransacao + QR + pagamento real) **OU** outro bloco do roadmap A→H. Validar primeiro o fluxo "qual cadastro?" pelo WA com Luciano (mandar "INÍCIO" → deve aparecer "Qual cadastro? 1 LUCIANO (PF) 2 SISGDSOLAR (PJ)" sem precisar passar pelo menu visitante).

## Pré-requisitos leitura próxima sessão

- `docs/CONTROLE-EXECUCAO.md` (estado + frase comandante).
- `docs/sessoes/2026-06-08-token-wa-fase-1-2-qual-cadastro.md` (esta sessão).
- `docs/debitos-tecnicos.md` — D-novo-WA-PHONE-NORMALIZE P2 + débitos abertos.
- Memória `~/.claude/projects/.../memory/` (especialmente specs Fase 2 + decisões "qual cadastro?").
- `backend/scripts/smoke-token-wa-fase2.ts` (referência pra smokes futuros).

## Carry-overs (não-bloqueantes)

- **D-novo-WA-PHONE-NORMALIZE P2**: matcher tolerante no bot (já melhorado parcialmente via `acharCooperadosPorTelefone`); migração ampla da base com auditoria prévia ainda pendente.
- **3 ações declaradas mas não implementadas**: `PROCESSAR_OCR` (acaoAutomatica AGUARDANDO_FOTO_FATURA), `MOSTRAR_MENU_PRINCIPAL` (acaoAutomatica INICIAL global) — caem em default warn. Não bloqueia uso atual.
- **17 modelos BOT órfãos** (sem etapa associada) — provavelmente usados via código direto. Auditar quando refator.
- **Tenant CoopereBR INICIAL override** sem gatilho.acao=VERIFICAR_COOPERADO no "1" (global já tem). Visitante reconhecido salta direto via tentarReconhecerEEntrarMenu — drift válido por enquanto.
- **Empresa_conveniada + proprietario_usina em obterContextosUsuario**: ainda iteram só sobre `cooperados[0]`. Quando 2º cooperado virar pagador/proprietário, iterar.
- **Fase 3 Token-WA** (TokenTransacao + QR + pagamento) não iniciada — pausa explícita Luciano.

## Regras aplicadas na sessão

- **Decisão 23**: validação prévia (Fase 1 read-only) em todos os fixes — auditorias de templates, fluxos, multi-cadastro, "qual cadastro?".
- **Regra contato de teste**: telefone Luciano `5527981341348` + email `lucbragatto@gmail.com` impreteríveis nos seeds.
- **Anti-IDOR multi-tenant**: applied em todos os UPDATEs sensíveis (PIN/Aparelho/Limite/MENU_ESCOLHA_CADASTRO/trocarContexto).
- **Specs verdes obrigatórias**: cada commit feature/fix acompanhado de specs Jest (não merge com vermelho).
- **Rebuild PM2** ritual stop→build→restart em toda mudança de código backend.
- **Rebuild web** em mudança que afeta serving (ContextoSwitcher + lib/auth.ts).
- **Commits pequenos em português** — 22 commits temáticos.
- **Decisão 24**: frase de retomada em local único (CONTROLE-EXECUCAO + doc-sessão).
- **F2.9 hardening**: JWT sem fallback, lockouts realistas, timezone-aware, anti-IDOR defesa em profundidade.

## Frase comandante

PASSO 0 — Verificações operacionais OBRIGATÓRIAS antes de qualquer leitura:

1. Confirmar que esta é NOVA conversa Code (não continuação de janela anterior). Verificar que subagent `cooperebr-qa-funcional` aparece na lista de agents disponíveis. Se não aparecer, parar e avisar (sessão não indexou subagent project-specific).

2. Rodar `git status --short` (diretriz inegociável catalogada 18/05). Se houver arquivos modificados que NÃO sou eu desta sessão, PAUSAR + Decisão 23. Esperado pós-fechamento: working tree limpo, último commit é o de fechamento (`docs(sessao): fechamento M26 — ...`).

PASSO 1 — Frase de retomada principal:

Sessão 08/06 entregou M26 (Token-WA Fase 1+2 completa + hardening F2.9 + F2.10 VERIFICAR_COOPERADO + Sprint "Qual cadastro?" multi-cadastro + adendo reconhecimento automático na entrada). 22 commits (`ccf0074..8f51f58`). Bot WA destravado (webhook `?secret=` + telefone Luciano E.164). Fluxo "qual cadastro?" funcional em WhatsApp (MENU_ESCOLHA_CADASTRO + anti-IDOR) e Portal (ContextoSwitcher chama backend com cooperadoId + Forbidden anti-IDOR). Reconhecimento automático no INÍCIO/MENU/saudação (sem precisar clicar "1"). SISGD setup teste com 490 tokens. **Próxima sessão Code: decisão entre (a) Fase 3 do Token-WA (TokenTransacao + QR + pagamento real — Move dinheiro, exige PIN/limite já implementados) OU (b) outro bloco do roadmap A→H.** Validar primeiro fluxo "qual cadastro?" pelo WA com Luciano. Pré-requisitos leitura: `docs/sessoes/2026-06-08-token-wa-fase-1-2-qual-cadastro.md` + `docs/debitos-tecnicos.md` (D-novo-WA-PHONE-NORMALIZE P2) + `backend/scripts/smoke-token-wa-fase2.ts` (referência smokes). Carry-overs não-bloqueantes: matcher telefone amplo (D-novo-WA-PHONE-NORMALIZE), 3 ações declaradas sem implementação, 17 modelos BOT órfãos, empresa_conveniada/proprietario_usina iterando só `cooperados[0]`. Diretrizes específicas: F2.9 hardening preservar (anti-IDOR + lockout 30min + timezone-aware); invariante "só consultas sem PIN" mantida; Fase 3 NÃO iniciada (pausa explícita Luciano).
