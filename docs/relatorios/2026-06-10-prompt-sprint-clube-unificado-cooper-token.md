# Prompt — Sprint Clube Unificado (hub com cards) + Conclusão do circuito CooperToken
### Montado pelo orquestrador (claude.ai) em 10/06/2026 · ATUALIZADO 10/06 — Hub ✅ entregue (e4d0976); próximo: Fase 1.1 (polimento) + F1.5
> Decisão Luciano 10/06: aglutinar tudo dentro do "Clube" (hub com **cards** → clica no card vai pra função),
> hub PRIMEIRO, depois concluir o que falta do Clube + Token. Fila: M29 → este sprint (P1) → Hardening Mass-Write (P2).
> Regra de coerência sistêmica catalogada em memória `regra_coerencia_sistemica_mapa_impacto_10_06.md`.

---

```
SPRINT: Clube Unificado (hub com cards) + Conclusão do circuito CooperToken
[Rodar DEPOIS do M29. O sprint de hardening (Grok) é P2, espera este.]

═══ PASSO 0 ═══
1. Nova conversa Code + subagent cooperebr-qa-funcional indexado. Se não, parar e avisar.
2. git status --short limpo (pós-M29). Se houver arquivo não-seu, PAUSAR (Decisão 23).
3. pm2 list. Backend(3000)+frontend(3001) podem estar no ar. WhatsApp(3002) só sobe pra testar disparo. web/ exige rebuild (next start, sem HMR).

═══ REGRAS INEGOCIÁVEIS (área de DINHEIRO/TOKEN) ═══
- Token = VOUCHER de circuito fechado; cooperativa = emissora única.
- Saída de valor: estabelecimento = RESGATE/liquidação (recibo, SEM NF) — NUNCA "recompra". Cooperado = SOBRA. PROIBIDO token→sobra.
- Multi-tenant: cooperativaId SEMPRE do JWT; toda query filtra cooperativaId.
- Transferência/uso de token: PIN/OTP + $transaction Serializable + idempotência (jti).
- Monetário: Math.round(x*100)/100.
- Disparo real (WA/email): SÓ whitelisted (5527981341348 / lucbragatto+sufixo@gmail.com) + ambienteTeste.
- Decisão 23: cada FASE começa com Fase 1 read-only → MAPA DE IMPACTO (abaixo) → PAUSAR pro OK → implementar → specs verdes.
- Commits pequenos PT, 1 por fase. Rebuild PM2 ao fim de fase que mexe no runtime.
- Reportar ao orquestrador ao fim de CADA fase que toca dinheiro/token → ele roda cooperebr-financeiro-token-reviewer + cooperebr-multitenant-reviewer antes do push.

═══ REGRA DE COERÊNCIA SISTÊMICA (vale em TODAS as fases) ═══
A Fase 1 read-only entrega MAPA DE IMPACTO antes de implementar:
1. CONSUMIDORES: grep de TUDO que lê/usa o que vai mudar (campo, constante, rota, função).
2. DADOS EXISTENTES: contar linhas afetadas (SELECT) + migração 2 passos (UPDATE→ALTER); reportar o que muda/perde; NUNCA db push cego/--accept-data-loss.
3. PROPAGAÇÃO: atualizar TODOS DTOs, types (back+front), queries, telas, RELATÓRIOS, jobs/cron, extrato.
4. NAVEGAÇÃO: nenhum deep-link/botão/breadcrumb órfão.
5. RE-TESTE: listar fluxos a re-testar.
Apresentar MAPA → PAUSAR pro OK → implementar.

───────────────────────────────────────────────
FASE 1 — HUB DO CLUBE ✅ ENTREGUE 10/06 (commit e4d0976)
Hub com 6 cards (CooperToken, Vantagens, Planos do Clube, Ranking, Tokens Recebidos, Financeiro Tokens) + menu único "Clube" → /dashboard/clube + rotas antigas vivas + help inline. NÃO tocou backend.

FASE 1.1 — POLIMENTO DO HUB (frontend, baixo risco) [achados na validação visual 10/06]
(a) MLM ENTRA NO CLUBE: adicionar 3 cards ao hub — Indicações (/dashboard/indicacoes), Convites de Indicação (/dashboard/convites), Meu Convite (/dashboard/meu-convite). Justificativa: MLM É parte do Clube (o card Ranking já é "progressão MLM"; a indicação PREMIA com tokens). Remover esses 3 do menu flat (como os 6 anteriores). CONFIRMADO: /dashboard/convites é SÓ indicação MLM (chama /convite-indicacao/*), NÃO os convites de convênio/proprietário (esses ficam nas telas de convênio/usina e NÃO entram no Clube).
(b) BOTÃO VOLTAR (consistência): telas cooper-token, cooper-token-parceiro e cooper-token-financeiro estão SEM "voltar" (clube-vantagens e clube/planos JÁ têm). Adicionar "← Voltar ao Clube" → /dashboard/clube em TODAS as telas alcançadas pelos cards do hub, de forma consistente (incl. as 3 MLM novas). Rebuild frontend. Commit: feat(clube): MLM no hub + voltar consistente. NÃO toca backend.

FASE 2 — F1.5 CONFIG DA ECONOMIA (Taxa de Operação + Oxidação) — card "Configuração" do hub
MAPA DE IMPACTO (já levantado pelo orquestrador 10/06 — Code confirma na Fase 1):
- Consumidores: TAXA_EMISSAO=0.02 (cooper-token.service.ts:46 → uso :103) + TAXA_QR=0.01 (:48 → usos :978 e :1334). Config lida via getConfig() (:867).
- Dados: ConfigCooperToken = 1 linha/coop. Backfill com defaults que PRESERVAM o atual (emissão 2%, QR 1%, oxidação OFF). ⚠️ NÃO zerar taxa sem querer.
- Propagação: getConfig + PUT admin/config (controller:323) + DTO + getConfigDefaults (:347) + página web/app/dashboard/cooper-token/page.tsx + os 3 usos no service.
- Navegação: config já é card do hub.
- Re-teste: emissão com config default (ainda 2%) e custom; taxa do QR; cron de oxidação em DRY-RUN sobre dado de teste; card hub → config.

IMPLEMENTAR (após Mapa confirmado + OK):
1) SCHEMA aditivo em ConfigCooperToken (auditar antes; parar PM2 antes do db push) — "Taxa de Operação" PER-OPERAÇÃO, defaults preservam o atual:
   taxaEmissaoPerc Decimal @default(2) + taxaEmissaoFixa @default(0); taxaQrPerc @default(1) + taxaQrFixa @default(0);
   taxaTransferenciaPerc @default(0) + taxaTransferenciaFixa @default(0); taxaResgatePerc @default(0) + taxaResgateFixa @default(0).
   Oxidação: oxidacaoPercMes @default(0) (0=DESLIGADA) + oxidacaoPeriodoGracaDias Int @default(0) + oxidacaoPiso @default(0).
   (Alternativa: 1 JSON taxasOperacao — mas defaults TÊM de manter 2%/1%. Propor no Mapa.)
2) SERVICE: trocar constantes TAXA_EMISSAO/TAXA_QR por leitura da config (helper calcularTaxa(op, bruto, config) = bruto*perc/100 + fixa, Math.round). FALLBACK: config null → 2%/1% atuais (comportamento intacto). Atualizar os 3 usos (:103, :978, :1334). NÃO mexer na regra F0 (taxa QR 1× sobre o bruto).
3) OXIDAÇÃO: método aplicarOxidacao(cooperativaId) + cron mensal (espelha expirarVencidos:477 + job:123). DURAS: SÓ PROSPECTIVO (nunca oxida token emitido antes da política); respeita graça+piso; default 0 = cron não faz nada. ⚠️ GATE JURÍDICO: ligar (>0) em dado real exige política de quebra escrita/aprovada + auditoria — UI avisa; NÃO rodar cron em produção sem o gate; PARAR e sinalizar Luciano.
4) CONTROLLER/DTO: PUT admin/config + getConfig + getConfigDefaults incluem os campos novos (class-validator).
5) UI: estender web/app/dashboard/cooper-token/page.tsx (card config do hub) com os campos + help inline (o que é Taxa de Operação/em quais incide; oxidação + aviso do gate). Select nativo dentro de dialog se houver dropdown.
6) SPECS: taxa por operação aplica certo (emissão 2% default + custom); fallback preserva comportamento; oxidação respeita graça+piso+prospectivo; Math.round sem ruído float.
Commits PT por bloco (schema → service → oxidação → UI). Rebuild PM2 backend+frontend. Reportar → reviewer dinheiro+tenant.

FASE 3 — F2 EMPRESA (PJ-cooperado) COMPRA tokens no nível COOPERADO
Hoje só parceiro/comprar (credita saldoParceiro=tenant). Criar compra creditando cooperadoId (reusa creditar/CooperTokenCompra/Asaas) + Taxa de Operação na emissão + multi-tenant + idempotência. Refletir em relatórios financeiros (admin/financeiro, fluxo-caixa, rendimento, consolidado) + ledger. Specs. Reportar → reviewer.

FASE 4 — F4 FUNCIONÁRIO USA fatura + TRANSFERE
Base existe (usar-na-fatura/transferir/enviar nível cooperado). Amarrar ao fluxo conveniado→funcionário com PIN/OTP + Serializable + jti + Taxa de Operação. Refletir em limite-token + extrato + notificações. Specs. Reportar → reviewer.

FASE 5 — F3 EMPRESA DISTRIBUI (o "transitar") — É MASS-WRITE
Criar distribuição via cooperativa (emissora), LOTE ou INDIVIDUAL, valores IGUAIS ou DIFERENTES (reusa enviarTokens). Salvaguarda CLT 458 (origem/regulamento/voluntária) — NÃO espera advogado. Tela = card "Distribuir tokens".
⚠️ É "SUPER_ADMIN MASS WRITE" → aplicar os controles da classe do Sprint Hardening: confirmação + preview de volume + cap/dry-run + log CROSS_TENANT_MASS_WRITE + AuditLog. Notificação em lote = SÓ whitelisted + ambienteTeste. (Helper assertMassWriteConfirmation: criar aqui se Hardening ainda não rodou; senão reusar.) Specs. Reportar → reviewer.

FASE 6 — F6 RESGATE do ESTABELECIMENTO (token→R$) + F-D flag
(1) F-D: Cooperado.ehEstabelecimento (schema aditivo, default false em TODOS existentes + atualizar consumidores). (2) F6: resgate token→R$/PIX com RECIBO de liquidação (SEM NF; nunca "recompra") + Taxa de Operação + reusa pix-excedente/gateway + idempotência + atomicidade. Resgate SAI do circuito → ledger/contábil registram liquidação. Tela = card "Resgate". Specs. Reportar → reviewer.

FASE 7 — Fatia A NOMENCLATURA (cosmético)
"CTK"→"CooperToken" (38 arquivos web/); separar "Crédito de energia (kWh)" de "CooperToken" (dois rios); verbo = usar/aplicar/resgatar (nunca "pagar"). Commit único.

FECHAMENTO: skill fechamento-sessao + versionar órfãos. F8 (contábil/fiscal) → Sprint #8 Contabilidade (separado).
```
