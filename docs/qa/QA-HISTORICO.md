# CoopereBR - Histórico de QA Noturno

**Atualizado automaticamente a cada ciclo (03h diário)**
**Gerado por:** Assis (agente principal) + leitura pelo P (agente VSCode)

---

## Como usar

- Relatório completo do dia: `RELATORIO-QA-YYYY-MM-DD.md`
- Resumo executivo atual: `C:\Users\Luciano\.openclaw\workspace\memory\cooperebr-qa-latest.md`
- Este arquivo: índice de scores e destaques por ciclo

---

## Histórico de Scores

| Data | Score | Críticos | Destaques |
|------|-------|----------|-----------|
| 2026-04-20 | 8.7/10 | 0 | 🔴 NOVO P2: percentualDesconto=20% mas valorDesconto=R$0 em FIXO_MENSAL (DRE incorreto); Sprint 5 ✅ concluído (engine unificada, testes UC matching, 6 campos auditoria); BUG-18-001 cross-tenant ainda aberto |
| 2026-04-19 | 8.8/10 | 0 | ⚙️ Sprint 5 freeze COMPENSADOS/DINAMICO (3 camadas de defesa, feature flag); P2 cross-tenant cobrança ainda aberto; 4 P3 novos (onModuleInit plano inválido, getConfiguracao sem cooperativaId, Step5 código morto, enum wizard errado) ||
| 2026-04-18 | 9.0/10 | 0 | 🚀 10 bugs fechados (8 P2 + 2 P3); BandeiraTarifaria + consumo mínimo + ANEEL auto-sync entregues; 1 P2 novo (ConfiguracaoMotor cross-tenant) |
| 2026-04-17 | 8.5/10 | 0 | ⚠️ SPRINT MASSIVO (52 commits): T0→T10 entregues (wizard admin completo, portal UCs, cadastro v2); 4 P2 novos (confirmar-UC 300kWh, job aprovação auto, v2 outlier, UC sem rollback) |
| 2026-04-15 | 8.8/10 | 0 | 🏆 SPRINT HISTÓRICO: 9 P2 fechados (6 IDOR + WA-audio + secret WA + webhook Asaas); +ContaAPagar módulo; 2 P2 novos (DTOs, SUPER_ADMIN info leak) |
| 2026-04-14 | 8.3/10 | 0 | ⚠️ Sem commits; 3 novos bugs: IDOR deletar/rejeitar fatura (P2), kwhInjetado errado no relatório (P2), economia histórico * 0.15 hardcoded (P3) |
| 2026-04-13 | 8.5/10 | 0 | ✅ MAIOR SALTO HISTÓRICO: 8 bugs fechados (2 P1 + 6 P2); +2 P2 IDOR novos (relatorio-fatura, motor-proposta); saldoAnterior incorreto no relatório mensal |
| 2026-04-12 | 7.5/10 | 2 | 🔴 P1 NOVO: ConfigTenant chave @unique quebra multi-tenant (migração urgente); modoTeste=true persiste 2° dia; +3 P2 email-monitor |
| 2026-04-11 | 7.8/10 | 1 | 🔴 P1: modoTeste=true persiste; +4 P2 NOVOS: race resgate oferta, ledger FATURA_CHEIA, cotaNull tokens, conflito crons 6h |
| 2026-04-10 | 8.4/10 | 0 | +2 P2 novos: darBaixa race condition (URGENTE) + indicadosAtivos sem decremento |
| 2026-04-09 | 8.5/10 | 0 | 4 P2 abertos: secret WA, áudio bot, HMAC Asaas, arredondamento |
| 2026-04-08 | 8.5/10 | 0 | BUG-NOVO-001 e BUG-CARRY-002 corrigidos |
| 2026-04-06 | 8.5/10 | 0 | 6 commits entregues, Clube de Vantagens |
| 2026-04-05 | 8.5/10 | 0 | EADDRINUSE às 3h (backend subiu 2x), CooperToken bugs |
| 2026-04-04 | 8.0/10 | 0 | 6 bugs: dupla fórmula multa/juros, race condition MLM, kwhContrato=0 |
| 2026-04-03 | 8.5/10 | 4 | IDOR Central de Faturas, multi-tenant config, bugs segurança sprint |
| 2026-04-02 | 9.0/10 | 0 | Melhor score histórico - 5 bugs altos resolvidos |
| 2026-04-01 | 8.7/10 | 0 | CooperToken + ConviteIndicacao entregues |
| 2026-03-31 | 8.5/10 | 0 | 10 bugs corrigidos - primeiro ciclo zero críticos |
| 2026-03-30 | 7.9/10 | 1 | LEAD-01/02/03 sem @Roles (bloqueante produção) |
| 2026-03-29 | 7.6/10 | 2 | REL-01/02 sem tenant isolation nos relatórios |
| 2026-03-28 | 7.3/10 | 3 | 6 bugs novos, WAS-01/AUTH-02/03 críticos |
| 2026-03-27 | 6.8/10 | 2 | SEC-05/SEC-07 IDOR migrações (bloqueante) |
| 2026-03-26 | 6.4/10 | 3 | PC-01/03 e PP-01/02 críticos nos novos módulos |
| 2026-03-25 | base | - | Relatório inaugural |

---

## Bugs P2 atualmente abertos (20/04/2026)

| ID | Bug | Sprint sugerido |
|----|-----|-----------------|
| ~~BUG-NEW-2026-04-12-001~~ | ~~ConfigTenant chave @unique - multi-tenant isolation quebrado~~ | ✅ RESOLVIDO 13/04 |
| ~~BUG-NEW-2026-04-11-001~~ | ~~modoTeste=true + botão visível bypassa termos~~ | ✅ RESOLVIDO 13/04 |
| ~~BUG-NEW-2026-04-12-002~~ | ~~email-monitor sem filtro cooperativaId~~ | ✅ RESOLVIDO 13/04 |
| ~~BUG-NEW-2026-04-12-003~~ | ~~Notificação email-monitor sem cooperativaId~~ | ✅ RESOLVIDO 13/04 |
| ~~BUG-NEW-2026-04-11-005~~ | ~~Race condition no resgate de ofertas do Clube (estoque)~~ | ✅ RESOLVIDO 13/04 |
| ~~BUG-NEW-2026-04-11-006~~ | ~~FATURA_CHEIA_TOKEN gravado como BONUS_INDICACAO no ledger~~ | ✅ RESOLVIDO 13/04 |
| ~~BUG-NEW-2026-04-11-008~~ | ~~cotaKwhMensal=null inflaciona tokens de excedente~~ | ✅ RESOLVIDO 13/04 |
| ~~BUG-NEW-2026-04-11-002~~ | ~~Tarifa EDP-ES hardcoded na simulação do cadastro~~ | ✅ RESOLVIDO 13/04 |
| ~~BUG-NEW-2026-04-14-001~~ | ~~kwhInjetado usa kwhCompensado – dado errado no relatório cooperado~~ | ✅ RESOLVIDO 15/04 |
| ~~BUG-NEW-2026-04-17-001~~ | ~~confirmar-nova-uc: proposta com 300kWh fictícios~~ | ✅ RESOLVIDO 18/04 |
| ~~BUG-NEW-2026-04-17-002~~ | ~~novaUcComFatura: UC criada sem rollback~~ | ✅ RESOLVIDO 18/04 |
| ~~BUG-NEW-2026-04-17-003~~ | ~~DocumentosAprovacaoJob: aprova sem revisão humana~~ | ✅ RESOLVIDO 18/04 |
| ~~BUG-NEW-2026-04-17-004~~ | ~~cadastroWebV2: outlier silencioso (propostaId=null)~~ | ✅ RESOLVIDO 18/04 |
| ~~BUG-NEW-2026-04-15-001~~ | ~~contas-pagar: sem class-validator DTOs~~ | ✅ RESOLVIDO 18/04 |
| ~~BUG-NEW-2026-04-15-002~~ | ~~contas-pagar: SUPER_ADMIN info leak~~ | ✅ RESOLVIDO 18/04 |
| **BUG-NEW-2026-04-18-001** | **ConfiguracaoMotor sem cooperativaId no findFirst — cross-tenant billing** | **Urgente** |
| **BUG-19-001** | **onModuleInit cria Plano Básico com CREDITOS_COMPENSADOS (bloqueado Sprint 5)** | Próximo |
| **BUG-19-002** | **getConfiguracao() motor-proposta sem cooperativaId → threshold outlier cross-tenant** | Próximo |
| BUG-19-003 | Step5Cobranca.tsx código morto/orphaned | Backlog |
| BUG-19-004 | Step3Configuracoes usa 'FIXO'/'DINAMICO' vs 'FIXO_MENSAL'/'CREDITOS_DINAMICO' | Próximo |
| **BUG-20-001** | **FIXO_MENSAL: percentualDesconto=contrato% mas valorDesconto=0 na Cobrança — DRE incorreto** | **Urgente** |
| BUG-20-002 | kwhExcedente incorreto quando kwhContrato=0 (todos créditos = excedente) | Próximo |
| ~~BUG-NEW-2026-04-14-002~~ | ~~IDOR: DELETE /faturas/:id e PATCH /:id/rejeitar sem tenant check~~ | ✅ RESOLVIDO 15/04 |
| ~~BUG-NEW-2026-04-13-001~~ | ~~IDOR: GET /faturas/:id/relatorio sem tenant check~~ | ✅ RESOLVIDO 15/04 |
| ~~BUG-NEW-2026-04-13-002~~ | ~~IDOR: DELETE/PUT /motor-proposta/proposta/:id sem tenant~~ | ✅ RESOLVIDO 15/04 |
| ~~BUG-NEW-2026-04-13-003~~ | ~~saldoAnterior = saldoAtual + kwhCompensado (ignora injetado)~~ | ✅ RESOLVIDO 15/04 |
| ~~BUG-NEW-2026-04-11-003~~ | ~~BONUS_INDICACAO idempotência sem cooperativaId~~ | ✅ RESOLVIDO 18/04 |
| ~~BUG-NEW-2026-04-10-002~~ | ~~darBaixa race condition~~ | ✅ RESOLVIDO |
| ~~BUG-NEW-2026-04-10-001~~ | ~~indicadosAtivos sem decremento no churn~~ | ✅ RESOLVIDO 15/04 |
| ~~SEC-CT-002~~ | ~~Secret WA na query string / hardcoded nos logs~~ | ✅ RESOLVIDO 15/04 |
| ~~BUG-WA-AUDIO~~ | ~~audio/video/sticker tipo='texto' corpo=null no whatsapp-service~~ | ✅ RESOLVIDO 15/04 |
| ~~BUG-NEW-002~~ | ~~Webhook Asaas sem HMAC validation~~ | ✅ RESOLVIDO 15/04 |
| BUG-NEW-2026-04-15-003 | TOCTOU em contas-pagar update/delete (sem cooperativaId no where final) | Backlog |
| BUG-NEW-2026-04-15-004 | Status ATRASADO sem cron automático em ContaAPagar (filtro inoperante) | Próximo |
| BUG-NEW-2026-04-15-005 | 5 crons simultâneos às 3h AM (calcularMultaJuros + convenios + convite + 2x cooperados) | Backlog |
| ~~BUG-CALCULO-001~~ | ~~Multa/juros 3 implementações divergentes~~ | ✅ RESOLVIDO 18/04 |
| BUG-NEW-2026-04-13-004 | N+1 queries no histórico do relatório mensal | Backlog |
| BUG-NEW-2026-04-13-005 | valorSemGD usa tarifa circular (da fatura com GD) | Backlog |
| BUG-NEW-2026-04-11-007 | Conflito de 3 crons às 6h (CooperToken + EmailMonitor + Cobrancas) | Backlog |
| BUG-NEW-2026-04-12-004 | Admin phone hardcoded no fallback env | Backlog |
| BUG-NEW-2026-04-11-004 | Multa inconsistente em reenviarNotificacao | Backlog |

---

## Instruções para o P (agente VSCode)

Ao iniciar cada dia:
1. Ler este arquivo para contexto histórico
2. Ler `RELATORIO-QA-{data de hoje}.md` para o último ciclo
3. Ao implementar correções, marcar o bug como resolvido no relatório do dia
4. Ao detectar novo bug, registrar na seção de bugs abertos acima

---

*Última atualização: 19/04/2026 às 03:00 | Próxima: 20/04/2026 às 03h*
