# CoopereBR — Histórico de QA Noturno

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
| 2026-04-12 | 7.5/10 | 2 | 🔴 P1 NOVO: ConfigTenant chave @unique quebra multi-tenant (migração urgente); modoTeste=true persiste 2° dia; +3 P2 email-monitor |
| 2026-04-11 | 7.8/10 | 1 | 🔴 P1: modoTeste=true persiste; +4 P2 NOVOS: race resgate oferta, ledger FATURA_CHEIA, cotaNull tokens, conflito crons 6h |
| 2026-04-10 | 8.4/10 | 0 | +2 P2 novos: darBaixa race condition (URGENTE) + indicadosAtivos sem decremento |
| 2026-04-09 | 8.5/10 | 0 | 4 P2 abertos: secret WA, áudio bot, HMAC Asaas, arredondamento |
| 2026-04-08 | 8.5/10 | 0 | BUG-NOVO-001 e BUG-CARRY-002 corrigidos |
| 2026-04-06 | 8.5/10 | 0 | 6 commits entregues, Clube de Vantagens |
| 2026-04-05 | 8.5/10 | 0 | EADDRINUSE às 3h (backend subiu 2x), CooperToken bugs |
| 2026-04-04 | 8.0/10 | 0 | 6 bugs: dupla fórmula multa/juros, race condition MLM, kwhContrato=0 |
| 2026-04-03 | 8.5/10 | 4 | IDOR Central de Faturas, multi-tenant config, bugs segurança sprint |
| 2026-04-02 | 9.0/10 | 0 | Melhor score histórico — 5 bugs altos resolvidos |
| 2026-04-01 | 8.7/10 | 0 | CooperToken + ConviteIndicacao entregues |
| 2026-03-31 | 8.5/10 | 0 | 10 bugs corrigidos — primeiro ciclo zero críticos |
| 2026-03-30 | 7.9/10 | 1 | LEAD-01/02/03 sem @Roles (bloqueante produção) |
| 2026-03-29 | 7.6/10 | 2 | REL-01/02 sem tenant isolation nos relatórios |
| 2026-03-28 | 7.3/10 | 3 | 6 bugs novos, WAS-01/AUTH-02/03 críticos |
| 2026-03-27 | 6.8/10 | 2 | SEC-05/SEC-07 IDOR migrações (bloqueante) |
| 2026-03-26 | 6.4/10 | 3 | PC-01/03 e PP-01/02 críticos nos novos módulos |
| 2026-03-25 | base | - | Relatório inaugural |

---

## Bugs P2 atualmente abertos (12/04/2026)

| ID | Bug | Sprint sugerido |
|----|-----|-----------------|  
| **BUG-NEW-2026-04-12-001** | **ConfigTenant chave @unique — multi-tenant isolation quebrado (migração DB)** | **URGENTE — MIGRAÇÃO** |
| **BUG-NEW-2026-04-11-001** | **modoTeste=true + botão visível bypassa termos — 2° dia sem correção** | **URGENTE HOJE** |
| BUG-NEW-2026-04-12-002 | email-monitor sem filtro cooperativaId (config + identificação cooperado) | Próximo |
| BUG-NEW-2026-04-12-003 | Notificação email-monitor criada sem cooperativaId (fica órfã) | Próximo |
| BUG-NEW-2026-04-11-005 | Race condition no resgate de ofertas do Clube (estoque) | Próximo |
| BUG-NEW-2026-04-11-006 | FATURA_CHEIA_TOKEN gravado como BONUS_INDICACAO no ledger | Próximo |
| BUG-NEW-2026-04-11-008 | cotaKwhMensal=null inflaciona tokens de excedente | Próximo |
| BUG-NEW-2026-04-11-002 | Tarifa EDP-ES hardcoded na simulação do cadastro | Próximo |
| BUG-NEW-2026-04-11-003 | Tokens BONUS_INDICACAO creditados antes da aprovação | Próximo |
| ~~BUG-NEW-2026-04-10-002~~ | ~~darBaixa race condition~~ | ✅ RESOLVIDO |
| BUG-NEW-2026-04-10-001 | indicadosAtivos nunca decrementado → tiers Clube inflados | Próximo |
| SEC-CT-002 | Secret WA na query string / hardcoded nos logs | Próximo |
| BUG-WA-AUDIO | audio/video/sticker sem tipo correto no whatsapp-service | Próximo |
| BUG-NEW-002 | Webhook Asaas sem HMAC validation | Próximo |
| BUG-CALCULO-001 | Arredondamento multa/juros: 2dp vs 4dp intermediário | Backlog |
| BUG-NEW-2026-04-11-007 | Conflito de crons às 6h (tokens + cobrança) | Backlog |
| BUG-NEW-2026-04-12-004 | Admin phone hardcoded no fallback env (5527981341348) | Backlog |

---

## Instruções para o P (agente VSCode)

Ao iniciar cada dia:
1. Ler este arquivo para contexto histórico
2. Ler `RELATORIO-QA-{data de hoje}.md` para o último ciclo
3. Ao implementar correções, marcar o bug como resolvido no relatório do dia
4. Ao detectar novo bug, registrar na seção de bugs abertos acima

---

*Última atualização: 12/04/2026 às 03:00 | Próxima: 13/04/2026 às 03h*
