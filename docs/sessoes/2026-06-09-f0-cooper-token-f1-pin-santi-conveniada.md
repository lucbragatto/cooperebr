# F0 CooperToken + F1 Definir PIN (3 canais) + Santi 1ª conveniada + 2 mapas read-only — 09/06/2026

## TL;DR

Sessão maratona entregou 5 commits de trabalho em frentes complementares: (1) **F0 Fase 2 CooperToken** corrigiu 2 bugs P0 de conformidade do circuito QR — remove crédito indevido ao `saldoParceiro` em pagamento peer-to-peer (cessão entre cooperados não emite saldo novo pra cooperativa) e elimina dupla aplicação de `TAXA_QR` em `processarQrParceiro` (parceiro recebia 98,01 num bruto de 100 quando deveria receber 99); (2) **F1 fluxo "Definir PIN" em 3 canais** — módulo backend `meu-perfil` (`GET pin-status` + `POST definir-pin` com 409 anti-rewrite + throttle 10/min), portal `/portal/seguranca/definir-pin` com `isPinFraco` espelhado + help inline azul, Bot WA com 3 estados/4 ações + OTP+últimos-4-do-CPF anti-SIM-swap + `OtpMotivo` estendido com `PIN_DEFINIR` + seed do submenu; (3) **Santi Medicina Diagnóstica cadastrada como 1ª empresa conveniada de teste da CoopereBR** — Cooperado PJ + Usuario logável Supabase + ContratoConvenio CV-SANTI-001 (`tipoBeneficioConveniado=MISTO` 20% token + `pagador=EMPRESA`) — seed idempotente executado no banco real, validado via `/auth/login` + `/auth/me` (contexto `empresa_conveniada`) + `/portal/meus-convenios`; (4) **2 Fases 1 read-only profundas** sem código (aguardando OK Luciano) — bug exibição/cálculo conveniada (VALOR_FIXO ignorado no front + ALOCACAO_FIXA sem cálculo com 0 membros) + 3 bugs onboarding (envio em lote silenciosamente "ENVIADO" sem disparar via whitelist-dev, UI não refresh após Aprovar/Recusar, UC/energia do cadastro não aparece). **341/341 specs verde**, PM2 backend+frontend rebuild+restart, portas 3000/3001/3002 LISTENING.

## Marco entregue

**M28 — F0 CooperToken Fase 2 + F1 Definir PIN (backend+portal+bot WA) + Santi conveniada + 2 mapas read-only**

## Commits do dia (5)

| Hash | Mensagem |
|---|---|
| 10a1de7 | fix(cooper-token): F0 remove duplo credito saldoParceiro + dupla taxa QR |
| 20d3f91 | feat(meu-perfil): F1 modulo + endpoints PIN inicial (status/definir) |
| 7f8cd93 | feat(web): F1 portal /portal/seguranca/definir-pin |
| abf12e2 | feat(wa-bot): F1 fluxo DEFINIR PIN no submenu CooperToken |
| b5609e4 | feat(seeds): cadastra Santi Medicina Diagnostica como 1a conveniada da CoopereBR |

## Entregas técnicas

### F0 Fase 2 — Conformidade circuito CooperToken QR (commit `10a1de7`)

Confirmado em Fase 1 read-only complementar: só 2 chamadores de `processarPagamentoQr` (controller peer + `processarQrParceiro`); 2 paths legítimos de `creditarSaldoParceiro` independentes preservados (`confirmarCompraParceiro` + resgate Clube de Vantagens).

**Mudanças:**
- `backend/src/cooper-token/cooper-token.service.ts:1062-1065` — Removido bloco `if (recebedorCooperativaId) { await this.creditarSaldoParceiroTx(tx, recebedorCooperativaId, quantidadeLiquida); }` dentro de `processarPagamentoQr`. Substituído por comentário explicativo. Cessão peer-to-peer entre cooperados não emite saldo novo pra cooperativa.
- `backend/src/cooper-token/cooper-token.service.ts:1335-1336` — Substituído cálculo duplicado por `const liquidoParceiro = resultado.quantidadeLiquida; const taxa1Pct = resultado.taxa;`. Reusa o que já saiu de `processarPagamentoQr` (taxa cobrada 1× sobre o bruto, não reaplicada sobre o líquido).

**Specs:** `cooper-token-qr-conformidade.spec.ts` novo com 4 specs (4/4 verde):
- (a) QR coop→coop NÃO chama `tx.cooperTokenSaldoParceiro.update/create` (ledger emite só 2 entradas: débito pagador + crédito recebedor).
- (b) `processarPagamentoQr` cobra taxa 1× sobre o bruto (bruto 100 → taxa 1 → líquido 99; invariante `bruto - taxa = líquido`).
- (c) `processarQrParceiro` credita parceiro = `resultado.quantidadeLiquida` (99, não 98,01) e `taxaCooperativaMae = resultado.taxa` (1, não 0,99).
- (d) Arredondamento `Math.round(x*100)/100` sem ruído float (bruto 33 → taxa 0,33 → líquido 32,67 sem `0.33000...007`).

### F1 — Cadastro inicial do PIN (3 canais)

**Backend `meu-perfil` (commit `20d3f91`):**
- `backend/src/meu-perfil/meu-perfil.module.ts` — importa `CooperadosModule` (provê `PinCooperadoService` existente).
- `backend/src/meu-perfil/meu-perfil.controller.ts`:
  - `GET /meu-perfil/pin-status` → `{temPin: boolean}` (cooperadoId+cooperativaId do JWT; `@Roles(COOPERADO)`).
  - `POST /meu-perfil/definir-pin` → DTO com `@Matches(/^\d{6}$/)` em `pin` + `pinConfirmacao`. Bloqueia 409 ConflictException se já existe (orienta `/alterar-pin`). Rejeita PIN fraco. cooperadoId+cooperativaId SEMPRE do JWT (anti-IDOR). Throttle `@Throttle({default:{ttl:60000,limit:10}})`.
- `backend/src/meu-perfil/pin-fraco.helper.ts` — `isPinFraco(pin)` rejeita 6 dígitos iguais + sequências contínuas asc/desc. Decisão Luciano: SIMPLES — datas/aniversários como hardening opcional futuro.
- `backend/src/cooperados/cooperado-tipo.helper.ts` — `isEmpresaCooperada(c) = tipoPessoa==='PJ'` + `isPessoaFisica`. Centraliza leitura semântica (tipoPessoa é `String?` default `"PF"` no schema — sem migration). Tolera null/undefined/lowercase.
- `backend/src/common/security/otp-desafio.service.ts` — `OtpMotivo` estendido com `'PIN_DEFINIR'` (campo `motivo` é `String` livre no schema — sem migration).
- `backend/src/app.module.ts` — importa `MeuPerfilModule`.
- 23 specs verde (6 pin-fraco + 5 cooperado-tipo + 12 controller).

**Portal `/portal/seguranca/definir-pin` (commit `7f8cd93`):**
- `web/app/portal/seguranca/definir-pin/page.tsx` — Client component. Carrega `GET /meu-perfil/pin-status` no mount. Estado `JA_TEM_PIN` mostra CTA "Alterar PIN" (rota futura). Estado `PRECISA_DEFINIR` form com 2 inputs senha (6 dígitos cada) + validação local antes do submit + propagação de erros do backend. Sem OTP — JWT prova identidade (decisão Luciano).
- `web/lib/pin-fraco.ts` — `isPinFraco` espelhado do backend; comentário no topo lembra manter sincronizado.
- Help inline azul OBRIGATÓRIO (regra UX inegociável): explica o que é o PIN + quando é usado + orienta evitar sequências/dígitos repetidos.

**Bot WA fluxo DEFINIR PIN (commit `abf12e2`):**
- `backend/src/whatsapp/whatsapp-fluxo-motor.service.ts`:
  - 3 estados novos (`DEFINIR_PIN_AGUARDANDO_OTP` / `AGUARDANDO_PIN` / `AGUARDANDO_CONFIRMACAO`).
  - 4 ações novas:
    - `INICIAR_DEFINIR_PIN` (automática em `AGUARDANDO_OTP`): guard status=ATIVO + guard `temPin=false` + cria `OtpDesafio` motivo `PIN_DEFINIR` + envia código pelo WA com instrução "código + últimos 4 do CPF separados por espaço".
    - `VALIDAR_OTP_PIN_DEFINIR` (wildcard): parse `"<6 OTP> <4 CPF>"`. **Decisão Luciano**: OTP sozinho no mesmo canal é fraco; valida dado pessoal (últimos 4 do CPF) ANTES de gastar tentativa OTP (fail fast). Mensagens neutras em qualquer falha (anti-enumeração). Em sucesso transita pra `AGUARDANDO_PIN`; em `BLOQUEADO/EXPIRADO/JA_VALIDADO/NAO_ENCONTRADO` cancela limpando dadosTemp.
    - `RECEBER_NOVO_PIN_DEFINICAO` (wildcard): valida regex 6 dígitos + `isPinFraco`. Guarda em `dadosTemp.definirPinPropostoTemp` + transita pra `AGUARDANDO_CONFIRMACAO`.
    - `CONFIRMAR_PIN_DEFINICAO` (wildcard): confere igualdade com `dadosTemp.definirPinPropostoTemp` + chama `pinCooperadoService.definirPin` (anti-IDOR garantido pelo `updateMany` com `cooperativaId` da F2.9) + **zera `dadosTemp.definirPin*`** (higiene PII) + volta MENU_COOPERTOKENS.
  - `cancelarDefinirPin` helper unificado com 6 motivos (cancelado/bloqueado/expirado/desafio-perdido/estado-perdido/erro-persistir).
  - Service ganha 1 dep nova no construtor: `OtpDesafioService` (já exportado pelo `CooperadosModule`).
- `backend/scripts/seed-definir-pin-wa.ts` (idempotente):
  - Atualiza modelo `menu_cooper_tokens` adicionando linha "4 Definir PIN".
  - Adiciona gatilho "4" no `MENU_COOPERTOKENS` → `DEFINIR_PIN_AGUARDANDO_OTP`.
  - Cria as 3 etapas globais (cooperativaId=null) ordens 66/67/68.
  - Mensagens dos fluxos montadas inline pelo service (dependem de dados dinâmicos: código OTP, PIN proposto).
- 13 specs novos em `whatsapp-fluxo-motor.definir-pin.spec.ts` (13/13 verde).

### Santi Medicina Diagnóstica — 1ª empresa conveniada de teste (commit `b5609e4`)

Seed idempotente `backend/scripts/seed-santi-conveniada.ts` executado em produção real do banco dev. Cria/atualiza 3 entidades:

**Cooperado PJ:**
- nomeCompleto: "Santi Medicina Diagnostica" | razaoSocial: "MAIS DIAGNOSTICO SV LTDA"
- cpf (CNPJ só dígitos): "12033286000190" | CNPJ mascarado mantido no `empresaCnpj`: "12.033.286/0001-90"
- tipoPessoa=PJ, tipoCooperado=SEM_UC, status=ATIVO
- cooperativaId=CoopereBR (`cmn0ho8bx0000uox8wu96u6fd`), ambienteTeste=true
- endereço: Av. Américo Buaiz 200 / Enseada do Suá / Vitória / ES / CEP 29050-902
- contatos teste (regra inegociável): email `lucbragatto+santi@gmail.com` + telefone `5527981341348` (whitelisted)

**Usuario logável (Supabase + Postgres):**
- email/login: `lucbragatto+santi@gmail.com`
- senha: `Santi@2026` (resetada via `supabase.auth.admin.updateUserById` em re-runs)
- perfil COOPERADO (M22 confirmou `EMPRESA_CONVENIADA @deprecated`; contexto `empresa_conveniada` brota do match cooperado pagador em `/auth/me`)
- ativo=true → aparece em `/dashboard/dev/credenciais-teste` com botão impersonate

**ContratoConvenio CV-SANTI-001:**
- tipo=EMPRESA, tipoBeneficioConveniado=MISTO + percentualBeneficioToken=20 (decisão Luciano: 20% energia + token)
- pagador=EMPRESA com pagadorCooperadoId apontando pro Cooperado PJ Santi
- tipoTarifaEmpresa=PERCENTUAL_DESCONTO (default — Luciano ajusta UI se quiser VALOR_FIXO)
- status=ATIVO, statusAprovacao=APROVADO, modalidade=STANDALONE
- sem PlanoClube vinculado | sem natureza ato cooperativo / sem lançamento contábil (teste, fora do fiscal real; `geraLancamentoContabil=false`)

**IDs gerados na 1ª execução** (re-runs preservam IDs):
- Cooperado: `cmq6qo4hi0002va2wti5k1sqw`
- Usuario: `cmq6qo5c40005va2w8gyyzzj7` (supabaseId `54e8cfb5-aa01-4cd7-b7bb-9e5c168186ca`)
- ContratoConvenio: `cmq6qo5ly0007va2w6hilvs2a`

**Evidências validadas:**
- Re-execução do seed: `ATUALIZADO` em todas as 3 entidades, zero duplicação.
- `POST /auth/login` (`lucbragatto+santi@gmail.com` / `Santi@2026`): JWT retornado com perfil=COOPERADO, cooperadoId+cooperativaId corretos.
- `GET /auth/me`: 2 contextos — `cooperado` ("Cooperado — CoopereBR") + `empresa_conveniada` ("Empresa — Santi Medicina Diagnostica").
- `GET /portal/meus-convenios` (logado como Santi): total=1, CV-SANTI-001 listado com status ATIVO + CNPJ mascarado.
- Listagem `ContratoConvenio` da CoopereBR (Prisma direto): 5 convênios totais, Santi é o 1º com `tipoBeneficioConveniado=MISTO` (4 anteriores: CV-HANGAR-1776949098321, CV-MORADAS-1776949184175, CV-2026-0001 Clínica teste, CV-SISGD-TESTE-001).

### 2 Fases 1 read-only sem código (aguardando OK Luciano)

**(A) Bug exibição/cálculo conveniada (VALOR_FIXO + ALOCACAO_FIXA):**
- Frontend `web/app/conveniada/convenio/[id]/page.tsx:557-563,630-633` IGNORA `tipoTarifaEmpresa=VALOR_FIXO` + `tarifaFixaKwhEmpresa`. Lê só `descontoKwhCusteio` (ramo PERCENTUAL_DESCONTO). Para Santi com `tipoTarifaEmpresa=VALOR_FIXO` + tarifa fixa 1,10 → cai no `else` → mostra "Tarifa cheia" (errado).
- Backend `convenios-custeio.service.ts:556-578` (ALOCACAO_FIXA + 0 membros) faz early-out com `status='SEM_MEMBROS'` + `valorAPagar=null`. Modelo correto: pacote é fixo independente dos membros (`kwhAlocadoMensal=100000` × tarifa fixa 1,10 = R$ 110.000 mesmo com 0 funcionários).
- `enriquecerComValorAPagar:164` bloqueia cálculo com `if (preview.status !== 'OK' || preview.kwhTotal <= 0) return preview`.
- `DashboardResponse.convenio` (linhas 57-76) NÃO INCLUI `tipoTarifaEmpresa` nem `tarifaFixaKwhEmpresa` — backend que monta o dashboard precisa adicionar no select.
- `calcularValorEnergia:696-712` já trata VALOR_FIXO corretamente — só não é chamado.
- Pergunta decisória aberta: ALOCACAO_FIXA + `kwhAlocadoMensal=null/0` → manter status `SEM_CONSUMO_CAPTURADO` (atual) ou criar `SEM_PACOTE_DEFINIDO` novo?
- **Não implementado** — aguardando OK Luciano.

**(B) 3 bugs onboarding conveniada/Santi:**

*Bug A — Envio em lote silenciosamente "ENVIADO" sem disparar:* Cadeia front (`EnvioLoteSection`) → controller `/portal/meus-convenios/:id/convites/lote/enviar` → service `enviarLote` → `setImmediate(processarFilaWa)` → `enviarLinkPorWhatsapp`. **Causa raiz:** `enviarLinkPorWhatsapp:1047-1059` IGNORA o retorno de `waSender.enviarMensagem` que em DEV/whitelist retorna `{enviado:false, motivo:'whitelist-dev' | 'numero-protegido'}` SEM throw. Helper marca `enviado:true` sempre que não-throws. Banco grava `loteEnvioWaStatus='ENVIADO'` falso. Individual também tem o mesmo bug, mas como Luciano testa com telefone próprio (whitelisted) o WA chega — diferença de percepção.

*Bug B — UI não atualiza após Confirmar/Aprovar/Recusar:* `page.tsx` conveniada linha 675 renderiza `<GestaoConvitesSection convenioId source="empresa" />` **SEM `onAcaoConcluida`**. `MembrosPendentesSection` (linha 698) + `EnvioLoteSection` (linha 681) passam `onAcaoConcluida={carregar}` mas o `carregar` do parent re-busca dashboard, não invade o state interno do `GestaoConvitesSection` (que tem `useState<ListagemConvites>` próprio). Empresa aprova → MembrosPendentes atualiza, mas card Convites mantém status antigo até F5.

*Bug C — UC/energia não aparece + "sem WA"/sem UC:* Listagem `/convenios/:id/membros-pendentes` + `/portal/meus-convenios/:id/membros-pendentes` faz select só de `cooperado.id/nomeCompleto/cpf/email/telefone` — NÃO INCLUI `cooperado.ucs`. Por isso "sem UC" no detalhe — não falta no banco, falta no response. `cadastroWebV2` CRIA UC corretamente (path COM_UC em `publico.controller.ts:1066-1082`) com `numeroUC`, `numeroConcessionariaOriginal`, `distribuidora`. Mas se path slim `permiteSemUc=true` cai em UC SINTÉTICA com `distribuidora='OUTRAS'` (linha 1040-1054) que não passa filtro INVARIANTE do preview consolidado. Card consumo zerado também porque membro pode estar `ativo=false` (PENDENTE_APROVACAO_*) → filtrado pelo `convenioCooperado.findMany({where:{convenioId, ativo:true}})`.

3 perguntas decisórias abertas: Q1 (whitelist mostra FALHOU+motivo vs ENVIADO simpático), Q2 (refreshKey props vs forwardRef imperative), Q3 (membros PENDENTE entram no preview ALOCACAO_FIXA?). **Não implementado** — aguardando OK Luciano.

## Bugs resolvidos / catalogados

| # | Severidade | Causa raiz | Fix | Status |
|---|---|---|---|---|
| QR cooperado→cooperado credita saldoParceiro (token nasce do nada) | P0 | `creditarSaldoParceiroTx` dentro de `processarPagamentoQr:1062-1065` | Remover bloco | RESOLVIDO F0 |
| QR parceiro aplica TAXA_QR 2× (parceiro recebe 98,01 em vez de 99) | P0 | Reaplica `TAXA_QR * resultado.quantidadeLiquida` em `processarQrParceiro:1335-1336` | Reusar `resultado.taxa` + `resultado.quantidadeLiquida` | RESOLVIDO F0 |
| Cooperado não tinha como cadastrar PIN inicial | P1 | Só existia `validarPinComLockout`; faltava `definir` exposto | Módulo `meu-perfil` + portal `/portal/seguranca/definir-pin` + 3 estados Bot WA | RESOLVIDO F1 |
| WhatsApp lote silenciosamente "ENVIADO" sem disparar (whitelist-dev) | P1 | `enviarLinkPorWhatsapp:1047-1059` ignora retorno do sender | Propagar `enviado:false + motivo` do sender | CATALOGADO — read-only mapeado |
| UI não refresh após Aprovar/Recusar em conveniada | P2 | `GestaoConvitesSection` sem `onAcaoConcluida` | refreshKey prop + bumps em ações pais | CATALOGADO — read-only mapeado |
| UC/energia do cadastro não aparece no detalhe membro | P2 | Listagem `/membros-pendentes` não inclui `cooperado.ucs` no select | Estender select backend + tipo + UI | CATALOGADO — read-only mapeado |
| Frontend conveniada ignora VALOR_FIXO + ALOCACAO_FIXA não calcula com 0 membros | P1 | Front lê só `descontoKwhCusteio`; backend early-out em SEM_MEMBROS | Branch VALOR_FIXO no front + ALOCACAO_FIXA calcula com `kwhAlocadoMensal` × tarifa mesmo sem membros | CATALOGADO — read-only mapeado |

## Decisões estratégicas catalogadas

Nenhuma memória persistente nova criada nesta sessão — todas as decisões couberam nos commits, no doc-sessão e nas 3 fases read-only.

**Decisões importantes desta sessão (registro narrativo):**
- F1 PIN: regra de PIN fraco SIMPLES (6 iguais + sequências asc/desc); aniversários/datas como hardening opcional futuro.
- F1 Bot WA "Definir PIN": OTP sozinho no mesmo canal é fraco — exige código + últimos 4 dígitos do CPF (padrão "código rotativo + dado pessoal" do convite). Dado pessoal validado ANTES do OTP (fail fast).
- Santi: `tipoBeneficioConveniado=MISTO` com `percentualBeneficioToken=20%` (Luciano ajusta UI se quiser); sem PlanoClube vinculado; sem representante legal preenchido (Luciano preenche depois pela UI).
- M22 reconfirmada: `EMPRESA_CONVENIADA @deprecated`, perfil COOPERADO único; contexto `empresa_conveniada` brota do match cooperado pagador em `/auth/me`.

## Próximo passo

**Decisão Luciano entre 2 frentes mapeadas em Fase 1 read-only desta sessão:**

**(A) Bug exibição/cálculo conveniada (VALOR_FIXO + ALOCACAO_FIXA):**
1. Backend `convenios-custeio.service.ts:556-578` — ALOCACAO_FIXA + 0 membros calcula `kwhTotal = kwhAlocadoMensal` e segue fluxo normal.
2. Backend dashboard endpoint expõe `tipoTarifaEmpresa` + `tarifaFixaKwhEmpresa` no response.
3. Frontend `page.tsx` conveniada (linhas 557-563, 630-633): branch novo VALOR_FIXO → "R$ X,XX/kWh (fixo)".
4. Specs: VALOR_FIXO no label + ALOCACAO_FIXA calcula com 0 membros + `Math.round(x*100)/100`.
5. Commit PT: `fix(conveniada): expoe VALOR_FIXO + calcula ALOCACAO_FIXA sem membros`.

**(B) 3 bugs onboarding conveniada/Santi (Bug A + B + C):**
1. Bug A: `enviarLinkPorWhatsapp` propaga `enviado:false + motivo` do sender → UI mostra FALHOU + motivo legível.
2. Bug B: `GestaoConvitesSection` + `MembrosPendentesSection` ganham prop `refreshKey: number` + parent bumpa em `onAcaoConcluida` (espelhar admin).
3. Bug C: listagem `/membros-pendentes` estende select com `cooperado.ucs[]` + `cotaKwhMensal`; frontend exibe; preview kWh segue só com `ativo=true` + UI mostra pendentes separados.
4. Specs cobrindo as 3 frentes.
5. Commits separados em PT por bloco.

**Validações operacionais paralelas:**
- Validar fluxo "Definir PIN" no Bot WA na vida real (mandar "MENU" → 8 CooperTokens → 4 Definir PIN → códigos chegam + dado pessoal valida).
- Validar tela `/portal/seguranca/definir-pin` (logar como cooperado teste, definir PIN, ver `{temPin: true}` no re-load).
- Validar fluxo conveniada Santi end-to-end (golden path: convite individual → OTP → cadastro funcionário → aprovação → membro ativo).

## Pré-requisitos leitura próxima sessão

- `docs/CONTROLE-EXECUCAO.md` (## ONDE PARAMOS topo + ## FRASE DE RETOMADA).
- `docs/sessoes/2026-06-09-f0-cooper-token-f1-pin-santi-conveniada.md` (M28 — esta sessão; especialmente seções "2 Fases 1 read-only sem código" + "Próximo passo").
- Para frente (A) bug exibição/cálculo:
  - `web/app/conveniada/convenio/[id]/page.tsx` linhas 57-76 (tipos), 215-441 (ConsumoFuncionariosCard), 540-700 (cards).
  - `backend/src/convenios/convenios-custeio.service.ts` linhas 156-300 (previewKwh), 540-700 (ALOCACAO_FIXA), 683-733 (calcularValorEnergia).
- Para frente (B) 3 bugs onboarding:
  - `backend/src/convenios/convites-convenio.service.ts` linhas 1033-1060 (`enviarLinkPorWhatsapp`), 550-593 (`processarFilaWa`).
  - `backend/src/whatsapp/whatsapp-sender.service.ts` linhas 80-108 (`enviarMensagem` retorno).
  - `backend/src/common/safety/whitelist-teste.ts` completo.
  - `web/components/convenios/GestaoConvitesSection.tsx` + `MembrosPendentesSection.tsx` + `EnvioLoteSection.tsx`.
  - `backend/src/publico/publico.controller.ts` linhas 1030-1110 (`cadastroWebV2` cria UC).

## Carry-overs (não-bloqueantes)

- **Frente (A) bug VALOR_FIXO/ALOCACAO_FIXA** — Fase 1 read-only completa; aguardando OK Luciano pra Fase 2 (próximo passo).
- **Frente (B) 3 bugs onboarding** — Fase 1 read-only completa; aguardando OK + decisões Q1/Q2/Q3.
- **Validação operacional Santi** — Luciano pode logar agora em `http://localhost:3001/login` com `lucbragatto+santi@gmail.com` / `Santi@2026` ou impersonate em `/dashboard/dev/credenciais-teste`.
- **Validação operacional DEFINIR PIN bot WA** — depende de seed rodado em produção: `cd backend ; npx ts-node scripts/seed-definir-pin-wa.ts` (idempotente).
- **`.claude/agents/wa-bot-agent.md` modificado não-commitado** — carry-over órfão M26 ainda vivo.
- **Carry-overs M26/M27 ainda vivos:** D-novo-WA-PHONE-NORMALIZE P2, 3 ações WA declaradas sem implementação (`PROCESSAR_OCR`, `MOSTRAR_MENU_PRINCIPAL`), 17 modelos BOT órfãos, `empresa_conveniada`/`proprietario_usina` iterando só `cooperados[0]`, Fase 3 Token-WA em pausa explícita.
- **`cooperebr-edge-agent` stopped** (projeto vizinho `cooperebr-monitoramento`) — crash loop não investigado, fora do escopo.
- **Untracked acumulados** — Sprint Housekeeping futuro.

## Regras aplicadas na sessão

- **Decisão 23** (validação prévia rigorosa): Fase 1 read-only ampla antes de cada Fase 2 (F0 CooperToken complementar + F1 PIN + 2 read-only finais sem código).
- **Multi-tenant** (`cooperativaId` do JWT): preservado em todos os pontos tocados — `meu-perfil.controller` extrai cooperadoId+cooperativaId do JWT (anti-IDOR), `definirPin` usa `updateMany` com `cooperativaId` (F2.9 hardening), bot WA usa `conversa.cooperativaId` em `pinCooperadoService.definirPin`.
- **Anti-enumeração**: `@Throttle({ttl:60s, limit:10})` em `POST /meu-perfil/definir-pin`; mensagens neutras no bot WA "Definir PIN" não revelam qual etapa falhou (OTP vs dado pessoal).
- **Contatos de teste impreteríveis**: Santi tem email `lucbragatto+santi@gmail.com` + telefone `5527981341348` (whitelisted) + `ambienteTeste=true`. CNPJ real mantido (regra: zero disparo real).
- **`isAmbienteReal()`** (não `NODE_ENV`) — descoberta operacional 18/05 aplicada nos guards do impersonate e whitelist dev.
- **Arredondamento monetário** `Math.round(x*100)/100` — confirmado no F0 com spec (d) bruto 33 → taxa 0,33 + líquido 32,67 sem ruído float.
- **Specs verdes obrigatórias**: 341/341 verde no fim (motor 269 + auth/matcher 28 + cooper-token 35 + meu-perfil/pin-fraco/cooperado-tipo 23 + WA DEFINIR PIN 13). Nenhum commit com vermelho.
- **Rebuild PM2 backend** (stop → build → restart) aplicado 2× nesta sessão (F0 fix + F1 backend + F1 bot WA).
- **Rebuild web** + `pm2 restart cooperebr-frontend` aplicado 1× (F1 portal definir-pin).
- **Commits pequenos em português** — 5 commits temáticos.
- **Decisão 24** — frase de retomada em local único.
- **Regra contato de teste** — aplicada na Santi (CNPJ real, mas contatos whitelisted; ambienteTeste=true; whitelist LGPD bloqueia disparo real mesmo se vazar).
- **Regra não-paralelo com Code** — claude.ai ausente nesta sessão.

## Frase comandante

PASSO 0 — Verificações operacionais OBRIGATÓRIAS antes de qualquer leitura:

1. Confirmar que esta é NOVA conversa Code (não continuação de janela anterior). Verificar que subagent `cooperebr-qa-funcional` aparece na lista de agents. Se não aparecer, parar e avisar.

2. Rodar `git status --short` (diretriz inegociável 18/05). Esperado pós-fechamento: working tree limpo (untracked carry-overs catalogados + `.claude/agents/wa-bot-agent.md` modificado é órfão M26 conhecido); último commit é o de fechamento M28.

3. Rodar `pm2 list`. Esperado: `cooperebr-backend` + `cooperebr-frontend` + `cooperebr-whatsapp` online (3000/3001/3002 LISTENING). `cooperebr-edge-agent` stopped (projeto vizinho, fora do escopo). Frontend é `next start` sob PM2 — toda mudança em web/ exige `cd web ; npm run build ; pm2 restart cooperebr-frontend`. HMR NÃO ROLA.

PASSO 1 — Frase comandante (Luciano DECIDE qual das 2 opções):

Sessão 09/06 entregou M28 em 5 commits (`10a1de7..b5609e4`): (1) F0 Fase 2 CooperToken corrige conformidade circuito QR (remove crédito indevido saldoParceiro em peer-to-peer + corrige dupla TAXA_QR em processarQrParceiro — parceiro agora recebe 99 num bruto de 100, era 98,01); (2) F1 cadastro inicial PIN em 3 canais (módulo backend `meu-perfil` com GET pin-status + POST definir-pin 409-anti-rewrite + throttle 10/min, portal `/portal/seguranca/definir-pin` com help inline + isPinFraco espelhado, Bot WA com 3 estados + 4 ações + OTP+últimos-4-CPF anti-SIM-swap + seed do submenu CooperToken); (3) Santi Medicina Diagnóstica cadastrada como 1ª empresa conveniada de teste da CoopereBR (Cooperado PJ + Usuario logável Supabase + CV-SANTI-001 MISTO 20% pagador EMPRESA — seed idempotente executado, validado via /auth/login + /auth/me + /portal/meus-convenios). 341/341 specs verde. PM2 rebuild backend (2×) + frontend (1×), portas 3000/3001/3002 LISTENING.

2 frentes read-only mapeadas SEM código (aguardando OK):

(A) Bug exibição/cálculo conveniada VALOR_FIXO + ALOCACAO_FIXA:
- Frontend `web/app/conveniada/convenio/[id]/page.tsx:557-563,630-633` ignora `tipoTarifaEmpresa=VALOR_FIXO` + `tarifaFixaKwhEmpresa`. Lê só `descontoKwhCusteio` (ramo PERCENTUAL_DESCONTO).
- Backend `convenios-custeio.service.ts:556-578` ALOCACAO_FIXA com 0 membros faz early-out `status='SEM_MEMBROS'` + `valorAPagar=null`. Modelo correto: pacote fixo = `kwhAlocadoMensal` × tarifa, independente dos membros (100000 × 1,10 = R$ 110.000).
- `DashboardResponse.convenio` não inclui `tipoTarifaEmpresa`/`tarifaFixaKwhEmpresa` no select do dashboard endpoint.
- `calcularValorEnergia:696-712` já trata VALOR_FIXO — só não é chamado.

(B) 3 bugs onboarding conveniada:
- Bug A: lote silenciosamente "ENVIADO" sem disparar — `enviarLinkPorWhatsapp:1047-1059` IGNORA retorno do sender que em DEV/whitelist retorna `{enviado:false, motivo:'whitelist-dev'}` SEM throw. Helper marca `enviado:true` sempre que não-throws.
- Bug B: UI não refresh após Aprovar/Recusar — `page.tsx` conveniada linha 675 `<GestaoConvitesSection convenioId source="empresa" />` SEM `onAcaoConcluida={carregar}`. Componente mantém state interno; refetch do parent não invade.
- Bug C: UC/energia não aparece — listagem `/membros-pendentes` faz select só de `cooperado.id/nomeCompleto/cpf/email/telefone`, NÃO INCLUI `cooperado.ucs[]`. cadastroWebV2 CRIA UC OK (linha 1066-1082) mas path slim `permiteSemUc=true` cria UC SINTÉTICA com `distribuidora='OUTRAS'` que não passa filtro INVARIANTE do preview consolidado.

DECIDA — duas opções pra arrancar Fase 2:

**(A)** Bug exibição/cálculo conveniada → branch VALOR_FIXO no front + ALOCACAO_FIXA calcula com kwhAlocadoMensal × tarifa mesmo sem membros + expor campos no dashboard endpoint + specs. Commit: `fix(conveniada): expoe VALOR_FIXO + calcula ALOCACAO_FIXA sem membros`.

**(B)** 3 bugs onboarding → propagar `enviado:false + motivo` do sender (Bug A) + adicionar `refreshKey: number` props (Bug B) + estender select listagem com `cooperado.ucs[]` + `cotaKwhMensal` (Bug C) + specs. Commits separados por bloco.

Perguntas decisórias pendentes (frente B):
- Q1: lote whitelist mostra FALHOU+motivo (verdade) ou ENVIADO simpático? Sugestão minha: FALHOU+motivo.
- Q2: `refreshKey` props (simples) vs `forwardRef+imperativeHandle` (React limpo)? Sugestão: refreshKey.
- Q3: membros PENDENTE entram no preview ALOCACAO_FIXA OU só ativo=true? Sugestão: só ativo + UI mostra "X pendentes" separado.

Validações operacionais (paralelo, fora das frentes A/B):
- Bot WA: rodar `cd backend ; npx ts-node scripts/seed-definir-pin-wa.ts` (idempotente) + testar fluxo "MENU → 8 CooperTokens → 4 Definir PIN" com telefone Luciano (whitelisted).
- Portal: logar cooperado teste em `/portal/seguranca/definir-pin`, definir PIN, confirmar `{temPin: true}` no re-load.
- Santi: logar `http://localhost:3001/login` com `lucbragatto+santi@gmail.com` / `Santi@2026` OU impersonate em `/dashboard/dev/credenciais-teste` → contexto "Empresa — Santi Medicina Diagnostica" → `/conveniada/convenio/cmq6qo5ly0007va2w6hilvs2a`.

Fase 1 read-only obrigatória qualquer que seja a escolha (Decisão 23). Os mapas já produzidos nesta sessão valem como ponto de partida — Code pode confirmar via leitura curta + propor diffs.

DIRETRIZES preservar:
- F2.9 hardening do PIN: JWT_SECRET sem fallback, `updateMany` com `cooperativaId`, `validarPin` private, lockout 30min, timezone-aware.
- F0 invariante: cessão peer-to-peer entre cooperados NÃO emite saldo novo pra cooperativa; TAXA_QR cobrada UMA VEZ sobre o bruto.
- F1 PIN: `isPinFraco` sincronizado backend↔portal; mensagens neutras anti-enumeração no Bot WA.
- Santi: `ambienteTeste=true` + contatos whitelisted; CNPJ real mantido.

PRÉ-REQUISITOS LEITURA (mapear, NÃO codar):
1. docs/CONTROLE-EXECUCAO.md (## ONDE PARAMOS topo — M28).
2. docs/sessoes/2026-06-09-f0-cooper-token-f1-pin-santi-conveniada.md (M28 — esta sessão; seções "2 Fases 1 read-only sem código" + "Próximo passo").
3. Se opção (A): web/app/conveniada/convenio/[id]/page.tsx (linhas 57-76, 215-441, 540-700) + backend/src/convenios/convenios-custeio.service.ts (linhas 156-300, 540-700, 683-733).
4. Se opção (B): backend/src/convenios/convites-convenio.service.ts (linhas 1033-1060, 550-593) + backend/src/whatsapp/whatsapp-sender.service.ts (linhas 80-108) + backend/src/common/safety/whitelist-teste.ts + web/components/convenios/GestaoConvitesSection.tsx + MembrosPendentesSection.tsx + EnvioLoteSection.tsx + backend/src/publico/publico.controller.ts (linhas 1030-1110).
5. ~/.claude/projects/C--Users-Luciano-cooperebr/memory/MEMORY.md.
6. CLAUDE.md + .claude/CLAUDE.md (regras + lição `next start`).

CARRY-OVERS M27/M26 AINDA VIVOS (não-bloqueantes):
- D-novo-WA-PHONE-NORMALIZE P2 (matcher telefone amplo).
- 3 ações WA declaradas sem implementação (`PROCESSAR_OCR`, `MOSTRAR_MENU_PRINCIPAL`).
- 17 modelos BOT órfãos.
- `empresa_conveniada` / `proprietario_usina` iterando só `cooperados[0]` em `obterContextosUsuario`.
- Fase 3 Token-WA (TokenTransacao + QR pagamento real) — pausa explícita; F0 fechou conformidade do circuito existente.
- `.claude/agents/wa-bot-agent.md` modificado órfão M26.
- `cooperebr-edge-agent` stopped projeto vizinho.
- Untracked acumulados pra Sprint Housekeeping.

DOC-SESSÃO 09/06 M28:
docs/sessoes/2026-06-09-f0-cooper-token-f1-pin-santi-conveniada.md
