# M33 — Sprint Clube P1 F3 Empresa distribui tokens em LOTE/INDIVIDUAL (12/06/2026)

## TL;DR

Entregou o **F3 empresa→funcionários** end-to-end (backend + frontend),
com helper mass-write reusável (cap + preview/confirm + idempotência +
AuditLog) + service `distribuirTokens` consumindo o helper + UI nested
na página do convênio. Reviewers pesados aprovaram em 2 rodadas (1ª
levantou 2 P1 + 4 P2 + 3 caronas + 1 débito; 2ª pós-fixes aprovou pro
push). Smoke E2E AMAGES 14/14 PASS contra ambiente real. Decisões
catalogadas: tipo de ledger próprio `DISTRIBUICAO_CONVENIO` (não DOACAO);
3 naturezas CLT (REGULAMENTO/VOLUNTARIA/PREMIACAO) com gates de DTO;
helper mass-write disponível pra Sprint Hardening reusar.

## Marco entregue

M33 — Sprint Clube P1 F3 cooperado-only (Blocos A + B + C + C.1)

## Commits do dia (4 trabalho + 1 fechamento)

| Hash | Tipo | Marco |
|---|---|---|
| `4bb36aa` | feat | **F3 Bloco A** — schema delta `CooperTokenTipo += DISTRIBUICAO_CONVENIO` + 2 cols TokenTransacao (naturezaDistribuicao + empresaDeclaraTetoClt) + helper `executarMassWrite` reusável (cap + PREVIEW/CONFIRM + idempotência + AuditLog) |
| `3e40270` | feat | **F3 Bloco B** — service `distribuirTokens` (6 guards + Serializable + helper) + DTO + endpoint `POST /cooper-token/empresa/distribuir` |
| `bbcc9c1` | feat | **F3 Bloco C** — UI `/conveniada/convenio/[id]/distribuir-tokens` (selecao + confirmação 2 etapas + tratamento humano dos 7 erros) + endpoint helper `GET /cooper-token/empresa/convenio/:id/membros-disponiveis` + card de entrada na página do convênio |
| `8425169` | fix | **F3 Bloco C.1 pós-reviewers** — 2 P1 (round somaQuantidade IEEE + valorTokenEsperado preview===cobrança) + 4 P2 (guard taxa>0 + MT-A cooperado.is.cooperativaId + MT-B remover PII + spec GAP-F3-8) + 3 caronas P3 (GAP-F3-6 single saldo update + pagadorCooperativaId + GAP-F3-7 conservação linear) |

## Entregas técnicas

### Backend

**Schema delta** (Bloco A — puro RELAX, sem `--accept-data-loss`):
- `enum CooperTokenTipo += DISTRIBUICAO_CONVENIO` (segregação Art. 87 — NÃO usar DOACAO_ENVIADA/RECEBIDA)
- `TokenTransacao.naturezaDistribuicao String?` (`ORIGEM_REGULAMENTO | VOLUNTARIA | PREMIACAO`)
- `TokenTransacao.empresaDeclaraTetoClt Boolean?` (defesa CLT 458 §2º auditável)

**Helper genérico** `src/common/mass-write/mass-write.helper.ts`:
- API: `executarMassWrite<TItem, TCommitOut>(prisma, options)`
- 5 controles: CAP (default 200) + PREVIEW/CONFIRM + idempotência por callback + AuditLog + alertas
- Cross-ref Sprint Hardening Mass-Write SUPER_ADMIN P2 — primeiro consumer

**Service `distribuirTokens`** (Bloco B):
- 6 guards ANTES da tx: (1) naturezas semânticas, (2) empresa-PJ + status, (3) convênio + ownership conveniadoId, (4) PIN FORA da tx via PinCooperadoService, (5) `assertLimite` sobre TOTAL do lote (ajuste 2 Luciano), (6) destinatários MEMBRO_ATIVO + cooperado.is.cooperativaId
- Dentro tx Serializable: re-snapshot saldo (tudo-ou-nada) → loop linha-a-linha (debita ledger + credita ledger + criarTokenTransacao com jti) → 1 update final do saldo empresa (GAP-F3-6) → updateMany TokenTransacao com pagadorCooperativaId
- 1ª linha do DEBITO grava `referenciaId=clientRequestId + referenciaTabela='MASS_WRITE_DISTRIBUICAO'` (idempotência por lote)

**Endpoints novos**:
- `POST /cooper-token/empresa/distribuir` — @Roles(COOPERADO), empresa via JWT
- `GET /cooper-token/empresa/convenio/:convenioId/membros-disponiveis` — helper UI agrega saldo + ativos + pendentes breakdown

**DTO `DistribuirTokensDto`** com class-validator:
- `convenioId + clientRequestId + pin (regex 6 dígitos) + modo (IsIn PREVIEW/CONFIRM)`
- `distribuicoes: DistribuicaoItemDto[]` (ArrayMinSize 1 / ArrayMaxSize 200 + ValidateNested)
- `naturezaDistribuicao` (IsIn 3 valores)
- `empresaDeclaraTetoClt?: boolean` + `descricao?: string` + `valorTokenEsperado?: number` (C.1)

### Frontend

**Tela nova** `/conveniada/convenio/[id]/distribuir-tokens/page.tsx`:
- 2 etapas: `selecao` → `confirmacao`
- Header com saldo em card amber + link voltar
- HelpBox "Como distribuir" + contador pendentes com breakdown empresa/admin
- Ações em lote: input "Quantidade igual" + 4 botões (aplicar/selecionar todos/deselecionar/limpar)
- Lista membros: checkbox + Input quantidade por linha, visual amber quando selecionado
- Card preview 4 stats grid + alerta SALDO_INSUFICIENTE local
- Modal confirmação: radio 3 naturezas (com explicação jurídica curta CLT 458 §2º + CLT 457 §2º) + condicionais (CLT checkbox / PREMIACAO textarea) + `<PinInput>` (F4 Bloco D)
- Tratamento humano dos 7 motivos: PIN_NAO_DEFINIDO link configurar, PIN_BLOQUEADO data ISO formatada, PIN_INCORRETO retry, EXCEDE_LIMITE/SALDO_INSUFICIENTE links, MEMBROS_INVALIDOS, GENERICO
- `clientRequestId useRef` padrão F4 C.2 — preservado em retry, regenerado APENAS em sucesso ou cancelar-tudo
- Mensagem diferenciada quando `idempotente: true` ("este lote já havia sido processado")

**Card de entrada na página do convênio** `/conveniada/convenio/[id]/page.tsx` (3.5):
- Card amber "Distribuir tokens aos funcionários" + HelpBox curta + CTA

### Testes

- **244/244 specs** verde (cooper-token + mass-write):
  - 232 prévias preservados (zero regressão)
  - 12 novos C.1: round IEEE / valorTokenEsperado 4× / taxa guard 2× / conservação linear / membros inválidos sem writes / MT-A / single saldo update
- **Smoke E2E F3** (`scripts/smoke-f3-bloco-c1.ts`):
  - Setup idempotente: AMAGES (PIN 123456 do F4) + convênio criado/reusado + João + Ana como MEMBRO_ATIVO + saldo 150 tokens
  - JWT manual via `JWT_SECRET` do `.env`
  - 5 cenários × 14 asserts: (a) listar membros + MT-B sem PII; (b) golden path PREVIEW + CONFIRM + saldo debitado + créditos individuais + ledger DISTRIBUICAO_CONVENIO 2N + 1ª linha com referência idempotência + TokenTransacao natureza gravada; (c) retry idempotente sem dupla distribuição; (d) VOLUNTARIA sem checkbox → 400; (e) extrato funcionário tipo DISTRIBUICAO_CONVENIO (não DOACAO_RECEBIDA — segregação Art. 87)
  - **14/14 PASS** ✅

## Bugs resolvidos / catalogados

| ID | Severidade | Status | Notas |
|---|---|---|---|
| **GAP-F3-2/5** | P1 | ✅ RESOLVIDO C.1 | Math.round 10000 na somaQuantidade mata ruído IEEE 754 |
| **GAP-F3-3** | P1 | ✅ RESOLVIDO C.1 | valorTokenEsperado opcional no DTO; CONFIRM compara com config atual |
| **GAP-F3-4** | P2 | ✅ RESOLVIDO C.1 | Guard `taxaTransfer > 0 → BadRequest` até D-novo-TAXA-TRANSFER-DESTINO definir destino |
| **MT-A** | P2 | ✅ RESOLVIDO C.1 | `cooperado: { is: { cooperativaId } }` no Guard 6 + listarMembrosDisponiveis |
| **MT-B** | P2 | ✅ RESOLVIDO C.1 | cpf+telefone removidos do select (over-fetch PII) |
| **GAP-F3-6** | P3 | ✅ RESOLVIDO C.1 | N updates do saldo da empresa → 1 update final |
| **GAP-F3-8** | P2 | ✅ RESOLVIDO C.1 | Spec "CONFIRM membros inválidos → BadRequest + ZERO writes" |
| **D-novo-F3-RACE-CONFIRMS-CONCORRENTES** | P3 | catalogado/validado | Reviewers aprovaram raciocínio Serializable+retry-idempotente; ledger-unique fica P3 separado |
| **D-novo-F3-INCONSISTENCIA-BANCO** | P3 | catalogado | Janela preview→commit; proteção em runtime já existe (re-snapshot dentro da tx); falta spec + UX refinement |

## Decisões estratégicas catalogadas

- **Tipo ledger próprio** (decisão Luciano ajuste 1): `DISTRIBUICAO_CONVENIO` no enum — NUNCA reusar DOACAO_ENVIADA/RECEBIDA. Extrato do funcionário precisa distinguir distribuição da empresa de doação peer-to-peer; segregação Art. 87 (rio token do convênio) exige
- **`assertLimite` sobre TOTAL** (decisão Luciano ajuste 2): a empresa é quem gasta — limite por transação dela vs soma total do lote, NÃO por linha
- **Helper mass-write genérico**: F3 é PRIMEIRO consumer; Sprint Hardening Mass-Write SUPER_ADMIN P2 reusa sem alterar a API — callback-based, multi-consumer
- **CLT 458 §2º + 457 §2º — defesa declaratória auditável**: SISGD NÃO valida teto 50% (não tem dado de remuneração); empresa declara. 3 naturezas: REGULAMENTO ignora checkbox; VOLUNTARIA exige `empresaDeclaraTetoClt=true`; PREMIACAO exige `descricao` com motivo/meta
- **Tudo-ou-nada** (decisão Luciano Q1): saldo pré-validado DENTRO da tx Serializable; soma insuficiente → BadRequest. Parcial quebraria idempotência do retry
- **clientRequestId pelo cliente** (padrão F4 C.2 reaproveitado): UI gera UUID v4 via `useRef`; preservado em retry de erro; regenerado APENAS em sucesso ou cancelar
- **F0 INTOCÁVEL preservado**: helper `criarTokenTransacao` continua não recalculando taxa; `calcularTaxa('transferencia')` aplicado UMA vez sobre soma do lote
- **Endpoint helper de UI**: agregação de saldo + membros + config num único request reduz roundtrip e simplifica state management no frontend

## Reviewers pesados — 2 rodadas

**1ª rodada** (após Blocos A+B+C):
- `cooperebr-financeiro-token-reviewer` + `cooperebr-multitenant-reviewer` aprovaram com:
  - 2 P1 (GAP-F3-2/5 round IEEE + GAP-F3-3 preview-cobrança)
  - 4 P2 (GAP-F3-4 guard taxa, MT-A, MT-B, GAP-F3-8 spec)
  - 3 P3 caronas (GAP-F3-6 single saldo update, pagadorCooperativaId, GAP-F3-7 conservação)
  - 1 débito (GAP-F3-1 inconsistência banco)
- Pergunta do Luciano marcada: race CONFIRMs concorrentes — reviewers validaram raciocínio (Serializable 40001 + retry idempotência). D-novo-LEDGER-UNIQUE-CONSTRAINT mantém P3

**2ª rodada** (pós-C.1):
- APROVADO pro smoke/push
- P1s fechados, refactor GAP-F3-6 validado (proteção anti-corrida intacta via SSI Serializable)
- 3 observações não-bloqueantes registradas

## Smoke E2E F3 — 14/14 PASS

```
Cenário (a) — listar membros-disponiveis
  ✓ 200 OK — 2 ativos + saldo R$150 + valorTokenReais=0.45
  ✓ MT-B: response NÃO inclui cpf/telefone (PII)

Cenário (b) — golden path quantidades diferentes
  ✓ PREVIEW OK — soma=15, saldoAntes=150, saldoDepois=135
  ✓ CONFIRM 200 — distribuidos=2 soma=15 saldoDepois=135
  ✓ saldo AMAGES debitado: 150 → 135 (= -15)
  ✓ saldo João: 10 (creditado)
  ✓ saldo Ana: 5 (creditado)
  ✓ ledger DISTRIBUICAO_CONVENIO: 2 DEBITO (AMAGES) + 2 CREDITO (funcionários)
  ✓ 1ª linha DEBITO grava referenciaId+referenciaTabela='MASS_WRITE_DISTRIBUICAO'
  ✓ TokenTransacao: 2 entries com naturezaDistribuicao='ORIGEM_REGULAMENTO' (CLT=null)

Cenário (c) — retry com mesmo clientRequestId
  ✓ idempotente:true — retry não duplicou
  ✓ saldo AMAGES inalterado após retry (135 == 135) — sem dupla distribuição

Cenário (d) — VOLUNTARIA sem checkbox CLT
  ✓ VOLUNTARIA s/ checkbox CLT → 400

Cenário (e) — extrato funcionário mostra DISTRIBUICAO_CONVENIO
  ✓ extrato João: tipo='DISTRIBUICAO_CONVENIO' (segregação Art. 87 ✓)
```

## Próximo passo

**Sprint Clube P1 — F6 (Estabelecimento resgata tokens em R$/PIX)** —
cooperado-estabelecimento converte tokens recebidos via QR (peer ou
parceiro) em R$ via PIX. **Modelo: RECIBO de resgate, NÃO recompra**
(decisão circuito 04/06 — `decisao_modelo_token_voucher_sobra_resgate`).
Cooperativa tributa apenas o spread/queima, valor cheio é trânsito.

**Pré-requisitos schema (Fase 1 read-only mapeará):**
- `Cooperado.ehEstabelecimento Boolean @default(false)` (aditivo) + backfill `false` (todos os cooperados atuais começam como NÃO estabelecimento; admin opt-in via UI)
- Decisão pendente: novo enum/tipo `RESGATE_PIX` em `CooperTokenTipo`? OU reusa um existente?
- Decisão pendente: novo modelo `ResgateRecibo` ou usar `TokenTransacao` com `tipoOperacao='RESGATE'`?

## Pré-requisitos leitura próxima sessão

- `docs/CONTROLE-EXECUCAO.md` (estado atual + frase de retomada)
- `docs/sessoes/2026-06-12-f3-empresa-distribui-lote.md` (este doc)
- `docs/especificacao-circuito-cooper-token-convenio.md` (modelo voucher/sobra/resgate)
- `~/.claude/projects/C--Users-Luciano-cooperebr/memory/decisao_modelo_token_voucher_sobra_resgate_2026_06_04.md` (decisão central — cooperativa tributa só spread)
- `docs/debitos-tecnicos.md` seção F3
- `MEMORY.md` + `CLAUDE.md` + `.claude/CLAUDE.md`

## Carry-overs (não-bloqueantes)

- **D-novo-F3-RACE-CONFIRMS-CONCORRENTES P3** validado raciocínio; ledger-unique constraint fica P3 separado
- **D-novo-F3-INCONSISTENCIA-BANCO P3** — spec dedicado + UX refinement
- **D-novo-TAXA-TRANSFER-DESTINO P2** — bloqueia ligar `taxaTransferenciaPerc > 0` em distribuição (gate explícito no service)
- Helper mass-write disponível pra Sprint Hardening Mass-Write SUPER_ADMIN P2 — primeiro consumer fora do cooper-token
- Smoke F3 deixou rastros em AMAGES (saldo 135 + 2 funcionários com saldo 10 + 5 + convênio SMOKE-F3-AMAGES-* + ledger DISTRIBUICAO_CONVENIO + TokenTransacao) — todos em ambienteTeste=true, próximo smoke limpa
- Scripts `scripts/smoke-f4-find-coop.ts` + `scripts/smoke-f3-find-amages.ts` são exploratórios — podem ser removidos em Sprint Housekeeping
- Sessão paralela Cowork adicionou model `LeadConcierge` ao schema sem commitar; Cowork deve commitar separadamente (não toquei)
- 3 observações não-bloqueantes dos reviewers da 2ª rodada — não registradas em código mas validadas

## Regras aplicadas na sessão

- Decisão 23 (validação prévia rigorosa) — Fase 1 read-only ANTES de codar; MAPA DE IMPACTO 5 dimensões + 6 pontos extras do Luciano antes do OK
- Regra de Coerência Sistêmica (MAPA DE IMPACTO em CADA Fase 1)
- Decisão 24 (frase canônica única no CONTROLE-EXECUCAO)
- Regra contatos de teste 14/05 — AMAGES (`lucbragatto+amages@gmail.com`) com `ambienteTeste=true`
- Regra fechamento bilateral inegociável (este doc-sessão + CONTROLE-EXECUCAO + frase no terminal)
- Cadência reviewers UMA vez no fim de A+B+C (não por bloco) — disciplina mantida
- Rebuild PM2 backend (stop → build → restart) em schema delta
- Rebuild web (npm run build → pm2 restart cooperebr-frontend) em mudança em web/
- F0 INTOCÁVEL: helper criarTokenTransacao não recalcula taxa
