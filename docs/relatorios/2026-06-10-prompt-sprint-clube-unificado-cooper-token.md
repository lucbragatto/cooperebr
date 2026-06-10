# Prompt — Sprint Clube Unificado (hub com cards) + Conclusão do circuito CooperToken
### Montado pelo orquestrador (claude.ai) em 10/06/2026 · Pronto pra colar no Code APÓS o M29
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
FASE 1 — HUB DO CLUBE (aglutinação, só frontend, baixo risco)
Reunir 6 entradas espalhadas num item "Clube" → página-hub com CARDS (clica → função existente).
Hoje (web/app/dashboard/layout.tsx ~111-150): CooperToken (/dashboard/cooper-token), Clube de Vantagens (/dashboard/clube-vantagens), Ranking (/dashboard/clube-vantagens/ranking), Planos do Clube (/dashboard/clube/planos), Tokens Recebidos (/dashboard/cooper-token-parceiro), Financeiro Tokens (/dashboard/cooper-token-financeiro).
Fazer: (1) web/app/dashboard/clube/page.tsx = hub com grid de cards (ícone+título+1 linha+→rota existente); as páginas FICAM onde estão (card só navega). (2) Menu: 1 item "Clube" → /dashboard/clube; rotas antigas seguem vivas. (3) Resolver 3 "Planos" (renomear rótulos: comercial / do Clube / SaaS). (4) Help inline no hub. (5) Commit feat(clube): hub unificado com cards. Rebuild frontend. NÃO toca backend.

FASE 2 — F1.5 CONFIG DA ECONOMIA (base) — card "Configuração" do hub
Hoje TAXA_EMISSAO(2%)+TAXA_QR chumbadas (cooper-token.service.ts~103); modeloVida=DECAY_CONTINUO só rótulo, sem lógica.
Fazer (após Mapa de Impacto+OK): (1) Schema aditivo em ConfigCooperToken — taxaOperacaoPerc + taxaOperacaoFixa + taxaOperacaoEmQuais(JSON emissao/transf/qr/resgate) + oxidacaoPercMes + oxidacaoPeriodoGracaDias + oxidacaoPiso. Backfill defaults nas linhas existentes. (2) Service: constantes chumbadas → leitura da config (fallback = valor atual); achar TODOS os usos (emissão/QR/usar-fatura/resgate/compra). Lógica + job de oxidação: SÓ PROSPECTIVO, respeita graça+piso. ⚠️ GATE JURÍDICO: não rodar a rotina em dados reais sem política de quebra escrita/aprovada + auditoria. (3) Tela card config + help. (4) Specs. Reportar → reviewer dinheiro+tenant.

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
