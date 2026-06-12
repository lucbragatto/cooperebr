# M32 — Sprint Clube P1 F4 cooperado-only completo (12/06/2026)

## TL;DR

Entregou o **F4 cooperado-only** de ponta a ponta (backend + frontend),
com PIN obrigatório, `$transaction Serializable`, status-guard
idempotente, jti anti-replay via `TokenTransacao`, limite por
transação/diário, taxa transferência configurável e modal PIN no
portal cooperado para `usarNaFatura`. Dois rounds de reviewers
pesados (`financeiro-token` + `multitenant`) — primeira rodada fechou
3 P1 + 4 P2 + 4 caronas; segunda rodada aprovou. Smoke E2E 8/8 PASS
contra ambiente real (AMAGES, DB Supabase, backend HTTP). Decisão
de produto: telas cooperado→cooperado para `processarPagamentoQr` e
`enviarTokens` ficam catalogadas como P2 — superfícies WA-first
serão reabertas quando Token-WA Fase 3 voltar.

## Marco entregue

M32 — Sprint Clube P1 F4 cooperado-only (Blocos A→D + C.1 + C.2)

## Commits do dia (8 + 1 fechamento)

| Hash | Tipo | Marco |
|---|---|---|
| `e73b64a` | feat | **F4 Bloco A** — `usarNaFatura` com PIN + Serializable + status-guard idempotente |
| `ccc84e9` | feat | **F4 Bloco B** — schema `TokenTransacao.qrExpiresAt` nullable + helper `criarTokenTransacao` centralizado (jti + tier + motivoStepUp + guards multi-tenant) |
| `2e0f649` | feat | **F4 Bloco C** — helper consumido nos 3 endpoints cooperado-only + step-up admin OTP via `OtpDesafioService` + endpoint stub `POST /otp-step-up` |
| `b62535b` | fix | **carona auth** — cookie Secure pelo protocolo real da janela (não `NODE_ENV`) |
| `2937a2a` | fix | **F4 Bloco C.1 pós-reviewers** — 3 P1 (FIN-1 LimiteTokenService antes da tx, FIN-2 status dentro da tx, MT-1 cobrança via findFirst+JOIN) + 4 P2 (FIN-4 idempotência admin via clientRequestId, MT-2 cooperativaId guard) + 4 caronas (FIN-7 0.20→valorToken, MT-3 log G1, MT-4 OtpDesafio null cooperativaId, MT-5 saldo QR multi-tenant) |
| `d61ff5d` | fix | **C.2** — `clientRequestId` estável por sessão de confirmação no frontend `/parceiro/enviar-tokens` (useRef + regenera só em sucesso/cancelar) |
| `d136cf9` | feat | **F4 Bloco D** — `<PinInput>` (wrapper de OtpInput, zero duplicação) + modal PIN 2 etapas em `/portal/tokens` para `usarNaFatura` + tratamento humano dos 4 erros (PIN_NAO_DEFINIDO/PIN_BLOQUEADO/PIN_INCORRETO/EXCEDE_LIMITE) + help inline |
| `4a0ee87` | fix | **D carona** — unifica `formatarTelefone` em helper único + strip 55 prefix (fix bug: copy-paste WhatsApp `+5527981341348` virava `(55) 27981-3413`) |

## Entregas técnicas

### Backend

- **Schema delta** (`prisma db push` puro relax, sem `--accept-data-loss`):
  - `TokenTransacao.qrExpiresAt: DateTime → DateTime?` (null = operação NÃO-QR)

- **Helper centralizado** `backend/src/cooper-token/token-transacao.helper.ts`:
  - `calcularTier(valorReais)` — limiar R$ 50 (≤BAIXO, >ALTO)
  - `determinarMotivoStepUp({tier, temHistorico, temHistoricoComRecebedor})` — precedência PRIMEIRO_USO > DESTINATARIO_NOVO > VALOR_ALTO > null
  - `criarTokenTransacao(tx, params)` — guards multi-tenant em 3 camadas (pagador/recebedor/cross-tenant) + jti via `gerarTokenHex(16)` (32 chars hex) + log G1 via `process.stderr.write`
  - Cross-tenant bloqueado por default, libera só com flag `permitirCrossTenant: true` explícita

- **`assertLimite` helper privado** no `CooperTokenService` (FIN-1) — chamado ANTES da tx Serializable nos 3 endpoints

- **3 endpoints F4 blindados**:
  - `usarNaFatura` — PIN + Serializable + status-guard idempotente (`updateMany` com `status: { in: ['A_VENCER', 'VENCIDO'] }`) + cobrança via `findFirst({ contrato:{cooperadoId, cooperativaId} })` + cooperado status dentro da tx + clamp triplo (quantidade × tetoPlano × saldo) + TokenTransacao USO_FATURA paralela
  - `processarPagamentoQr` — PIN opcional (cooperado-cooperado exige; parceiro reusa sem) + Serializable explícito + multi-tenant no saldo do pagador (MT-5) + TokenTransacao PAGAMENTO. **F0 INTOCÁVEL**: taxa F1.5 `qr` continua 1× sobre o bruto, helper não recalcula
  - `enviarTokens` cooperado→cooperado — PIN + Serializable + `calcularTaxa('transferencia')` (default 0% = behavior legado) + destinatário recebe LÍQUIDO + TokenTransacao TRANSFERENCIA
  - `enviarTokensAdmin` (novo método) — caminho admin sem cooperado remetente: tier BAIXO segue só com auth; tier ALTO exige `otpDesafioId + otpCodigo` validado via `OtpDesafioService.validarOuLancar` (motivo TOKEN_TRANSACAO_STEP_UP, cooperativaId-bound) + `clientRequestId` obrigatório (idempotência via `creditar()` referenciaId + referenciaTabela='ENVIO_ADMIN')

- **DTOs com class-validator**:
  - `UsarNaFaturaDto` (cobrancaId + quantidadeTokens + pin 6 dígitos)
  - `ProcessarPagamentoQrDto` (qrToken + pin obrigatório)
  - `EnviarTokensDto` (cooperadoId + quantidade + descricao? + pin? + otpDesafioId? + otpCodigo? + clientRequestId?)

- **Endpoint stub** `POST /cooper-token/otp-step-up`:
  - Cria desafio via `OtpDesafioService.criarDesafio` (motivo TOKEN_TRANSACAO_STEP_UP, sujeito TOKEN_TRANSACAO)
  - Ambiente NÃO-real (`isAmbienteReal() === false`): retorna `codigo` no body (regra contatos de teste 14/05)
  - Ambiente real: só `desafioId + expiresAt`; entrega por canal é carry-over `D-novo-F4-OTP-CANAL-ENTREGA`

- **Mudanças cirúrgicas em código existente**:
  - `OtpDesafioService.validar` rejeita quando caller passou cooperativaId E `desafio.cooperativaId IS NULL` (legado pre-F2.9 não escapa mais da defesa — MT-4)
  - `creditar()` `:333` e `usarNaFatura` inline `:2313` — `0.20` chumbado → `valorTokenReais` da config / plano (FIN-7)
  - `debitar()` ganhou comentário cruzado anti-drift com a versão inline em `usarNaFatura`
  - `CooperTokenModule` agora importa `forwardRef(() => CooperadosModule)` (cadeia profunda AppModule→Cooperados→Whatsapp→Faturas)

### Frontend

- **`<PinInput>`** (`web/components/ui/pin-input.tsx`) — wrapper minimal de `OtpInput` existente (M28/F2 convite-convênio); zero duplicação de lógica (auto-advance, paste, backspace navigation, mobile-friendly), apenas semântica de PIN persistente

- **Modal PIN 2 etapas no `/portal/tokens`**:
  - Etapa `form`: quantidade + saldo guard
  - Etapa `pin`: PinInput + tratamento humano dos 4 motivos:
    - `PIN_NAO_DEFINIDO` → CTA "Configurar PIN agora →" pra `/portal/seguranca/definir-pin` + boxes desabilitados
    - `PIN_BLOQUEADO` → parsea ISO date do backend e mostra "Tente novamente após DD/MM HH:MM" formatado
    - `PIN_INCORRETO` → boxes vermelhos, PIN limpo, retry permitido
    - `EXCEDE_LIMITE_*` → mensagem do backend (já detalhada) + link `/portal/seguranca` pra ajustar limite
  - Help inline (regra UX 19/05): caixa azul com `ShieldCheck` explicando "PIN ≠ senha"
  - Reset: sucesso fecha modal; voltar mantém form; cancelar limpa tudo

- **`/parceiro/enviar-tokens` (C.2)** — `clientRequestId` estável por sessão de confirmação:
  - `useRef<string | null>(null)` gerado em `prepararEnvio` (não em cada clique)
  - Regenerado APENAS em sucesso ou cancelar
  - Erro transitório mantém UUID — retry idempotente protegido

- **Helper `formatarTelefone`** unificado em `web/lib/formatar-telefone.ts`:
  - `formatarTelefone(valor)` — mascara visual `(DD) XXXXX-XXXX`
  - `normalizarTelefone(valor)` — 11 dígitos limpos pra POST ao backend
  - Fix bug: strip do prefixo `55` quando 12-13 dígitos (copy-paste WhatsApp `+5527981341348` agora vira `(27) 98134-1348` em vez de `(55) 27981-3413`)
  - 4 callers atualizados: `cadastro`, `dashboard/indicacoes`, `entrar`, `GestaoConvitesSection`

### Testes

- **184/184 specs cooper-token verdes** (de 106 iniciais):
  - F4 Bloco A: 18 cenários (PIN 6× + Serializable + status-guard 3× + ownership 2× + clamp triplo 3× + happy 2× + FIN-2 SUSPENSO 1×)
  - F4 Bloco B helper: 24 cenários (calcularTier 4 + determinarMotivoStepUp 6 + criarTokenTransacao 14 — guards, tier, motivo, jti, qrExpiresAt)
  - F4 Bloco C: 21 cenários (PIN/Serializable/F0 nos 3 endpoints + admin tier BAIXO/ALTO/OTP)
  - F4 Bloco C.1: 10 cenários (FIN-1 nos 3 endpoints × 5 + FIN-5 race 2 scans + FIN-6 jti P2002 + MT-4 OtpDesafio 3×)
  - Specs antigos atualizados com mocks de `tx.cobranca.findFirst` + `tx.cooperado.findUnique status` + `tx.tokenTransacao.{count,create}` + `tx.cooperTokenSaldo.findFirst`

- **Smoke E2E F4** (`backend/scripts/smoke-f4-bloco-d.ts`):
  - Cooperado AMAGES (ambienteTeste=true) — PIN setado/resetado pelo script, saldo creditado via Prisma
  - JWT manual assinado com `JWT_SECRET` do .env (evita dependência de senha Supabase)
  - 3 cenários reais via HTTP contra backend :3000:
    - **(i)** golden (R$ 4,50 desconto, TokenTransacao USO_FATURA tier=BAIXO motivo=PRIMEIRO_USO criada) + PIN incorreto 403 + pinTentativas++ + EXCEDE_LIMITE 400 com mensagem detalhada
    - **(ii)** 2 POSTs paralelos `Promise.allSettled` → exatamente 1 sucesso + 1 falha (Serializable abortou a 2ª) + ledger DESCONTO_FATURA com 1 entry só
    - **(iii)** Idempotência app-level via referenciaId + referenciaTabela='ENVIO_ADMIN' → 1 ledger entry
  - **8/8 PASS** ✅

## Bugs resolvidos / catalogados

| ID | Severidade | Status | Onde |
|---|---|---|---|
| D-novo-F4-RACE | P1 | ✅ RESOLVIDO Bloco A | `usarNaFatura` sem tx atômica permitia overwrite silencioso de cobrança paga |
| D-novo-F4-PARCEIRO-TENANT-STEPUP | P2 | catalogado | 3 endpoints tenant-level (transferir/usar-energia/processar-qr-parceiro) sem PIN/Serializable — junto com Sprint Hardening Multi-Tenant |
| D-novo-F4-OTP-CANAL-ENTREGA | P2 | catalogado | Endpoint `/otp-step-up` admin tier ALTO não entrega código por WA/email em prod (carry-over do TokenNotificacaoService) |
| D-novo-F4-UI-COOPERADO-PEER | P2 | catalogado | Telas cooperado→cooperado faltantes pra `processarPagamentoQr` e `enviarTokens` (decisão: P2P são superfícies WA-first — reabrir quando Token-WA Fase 3 voltar) |
| D-novo-F4-LIMITE-UPPERBOUND-VALORTOKEN | P3 | catalogado | `assertLimite` do `usarNaFatura` usa `0.45` chumbado como upper-bound antes da tx; direção do erro é conservadora |
| D-novo-TAXA-TRANSFER-DESTINO | P2 | catalogado | gate de destino contábil antes de ligar `taxaTransferenciaPerc > 0` em prod (queima / crédito emissora / fundo reserva) |
| D-novo-QR-PARCEIRO-PAPEL-DUAL | P3 | catalogado | JSDoc + guard `req.user.cooperadoId` no `processarQrParceiro` (papel dual admin-cooperado não documentado) |

## Decisões estratégicas catalogadas

- **F4 cooperado-only** (decisão pré-Bloco A): escopo foca em `usarNaFatura` + `processarPagamentoQr` + `enviarTokens` cooperado→cooperado. Os 3 endpoints tenant-level (`transferirTokensParceiro`, `usarTokensEnergia`, `processarQrParceiro`) ficam fora — Sprint Hardening Multi-Tenant absorve
- **Step-up admin tier-based**: ADMIN/OPERADOR não tem PIN próprio; tier BAIXO ≤R$50 segue só com auth; tier ALTO >R$50 exige OTP via `OtpDesafioService` (motivo `TOKEN_TRANSACAO_STEP_UP`)
- **jti gerado backend** (decisão Luciano Q6): cliente não envia idempotency-key pro caminho cooperado; helper gera via `gerarTokenHex(16)`. No caminho admin, `clientRequestId` vem do cliente (UUID v4) e vira `referenciaId` no `creditar()`
- **`qrExpiresAt` nullable** (decisão Luciano): relax puro do schema, sem workaround com data fake. `null` = operação NÃO-QR
- **F0 INTOCÁVEL**: taxa F1.5 `qr` continua aplicada UMA vez antes da tx; helper `criarTokenTransacao` NÃO recalcula taxa, apenas registra quantidade bruta + valor R$
- **Cross-tenant bloqueado por default** no helper: libera só com `permitirCrossTenant: true` explícito. Verifiquei zero callers em produção
- **UI cooperado→cooperado decisão (a) Bloco D parcial aceito**: telas web não criadas porque QR/P2P são superfícies WA-first (Token-WA Fase 3 pausada). Reavaliar na retomada do Token-WA
- **`clientRequestId` no frontend** (Bloco C.2): `useRef` em vez de `useState`; gerado uma vez por sessão de confirmação; regenerado APENAS em sucesso/cancelar; erro transitório mantém UUID

## Reviewers pesados — 2 rodadas

**1ª rodada** (após Blocos A+B+C):
- `cooperebr-financeiro-token-reviewer` + `cooperebr-multitenant-reviewer` acharam 3 P1 (FIN-1 sem limite check, FIN-2 sem status dentro da tx, MT-1 sem multi-tenant na cobrança) + 4 P2 (FIN-4 sem idempotência admin, MT-2 sem guard cooperativaId, MT-3 log diagnóstico, MT-4 OtpDesafio null) + caronas (FIN-7 0.20 chumbado, MT-5 saldo QR)
- Bloco C.1 entregou todos os fixes

**2ª rodada** (após C.1):
- Aprovado: FIN-1/FIN-2/MT-1/FIN-4/MT-2 FECHADOS + caronas corretas
- 1 P1 NOVO detectado: breaking caller — frontend `/parceiro/enviar-tokens` não mandava `clientRequestId`
- C.2 fechou o P1 novo

## Próximo passo

**Sprint Clube P1 — F3 (Empresa distribui tokens em LOTE/INDIVIDUAL)** —
empresa cooperada PJ (Santi, etc) distribui tokens comprados para
funcionários. **MASS-WRITE** → reusa controles do Sprint Hardening
Mass-Write SUPER_ADMIN: confirm + preview + cap/dry-run + log
auditável. **Salvaguarda CLT 458** (benefício não-salarial até 50%
da remuneração) — gate de produto antes do envio em massa.

## Pré-requisitos leitura próxima sessão

- `docs/CONTROLE-EXECUCAO.md` (estado atual + frase comandante atualizada)
- `~/.claude/projects/C--Users-Luciano-cooperebr/memory/MEMORY.md` (índice memórias)
- `docs/sessoes/2026-06-12-f4-cooperado-only-completo.md` (este doc)
- `docs/especificacao-circuito-cooper-token-convenio.md` (espinha do circuito CooperToken — F3 toca distribuição da empresa pros funcionários)
- `docs/debitos-tecnicos.md` seção F4 + D-novo-F4-* + D-novo-TAXA-TRANSFER-DESTINO

## Carry-overs (não-bloqueantes)

- 5 débitos novos catalogados (ver tabela acima)
- Telas cooperado→cooperado para `processarPagamentoQr` e `enviarTokens` em pausa (decisão: Token-WA Fase 3 reabre)
- Smoke F4 deixou rastros de teste em AMAGES (PIN '123456' setado, saldo 150 tokens, contrato/cobrança limpas) — ambienteTeste=true protege
- Decisão de produto: F3 ↔ Fatia A nomenclatura ↔ F6 estabelecimento resgata — ordem pode ser ajustada conforme prioridade comercial
- 1 cobrança da AMAGES (`cmp704sa00001va903qwikwvp`) ficou no estado original após cleanup do smoke (valor R$ 979,20 A_VENCER)

## Regras aplicadas na sessão

- Decisão 23 (validação prévia rigorosa) + Regra de Coerência Sistêmica em CADA Fase 1 read-only antes de codar
- Decisão 24 (frase canônica única no CONTROLE-EXECUCAO)
- Regra contatos de teste 14/05 (AMAGES já tem alias `lucbragatto+amages@gmail.com`)
- Regra não-paralelo com Code (sessão Cowork Concierge respeitou: só commitou docs paralelo, não tocou cooper-token)
- Regra inegociável fechamento bilateral (este doc-sessão + CONTROLE-EXECUCAO atualizado + frase no terminal)
