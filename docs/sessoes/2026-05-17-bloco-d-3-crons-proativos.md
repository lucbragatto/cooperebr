# Sessão 2026-05-17 — Bloco D (3 crons proativos)

## TL;DR

Marco M7. Quadro 3 txt Luciano implementado: 3 crons proativos (CRON A lembrete docs cooperado 10:00, CRON B alerta admin agregado 08:00, CRON C lembrete email portal EDP 11:00). Novo módulo `notificacoes-proativas/` (service + job + module). 3 templates email novos + 3 métodos `EmailService`. ConfigTenant chaves seedadas em 2 tenants (9 configs por tenant). Smoke 9/9 PASS após **fix crítico de whitelist guard** (bug detectado: primeiro smoke gravou 72 markers false-positive em dev por causa do whitelist LGPD bloquear silenciosamente).

## Entregas

| Sub | Descrição | Arquivos |
|---|---|---|
| D.1 | 3 templates email novos | `backend/src/email/email-templates.ts` (+154 linhas) |
| D.2 | 3 métodos `EmailService` | `backend/src/email/email.service.ts` (`enviarLembreteDocsPendentes`, `enviarAlertaAdminDocsParados`, `enviarLembreteEmailEdp`) |
| D.3 | Service `NotificacoesProativasService` | `backend/src/notificacoes-proativas/notificacoes-proativas.service.ts` (3 métodos `processar*`) |
| D.4 | Job `NotificacoesProativasJob` | `backend/src/notificacoes-proativas/notificacoes-proativas.job.ts` (3 `@Cron`) |
| D.5 | Seed ConfigTenant | `backend/scripts/seed-config-bloco-d-crons.ts` (9 chaves × 2 tenants) |
| D.6 | Module + registro app | `notificacoes-proativas.module.ts` + `app.module.ts` |
| D.7 | Smoke E2E 9/9 PASS | `backend/scripts/smoke-bloco-d-crons.ts` |
| D.8 | Mini-fechamento (este doc) | – |

## Decisões Luciano (17/05)

| Pergunta | Resposta |
|---|---|
| Frequências | CRON A 10:00 (evita 08:00-09:00) · CRON B 08:00 · CRON C 24h + reforço 72h se EDP-PENDENTE |
| Tom templates | Informal-respeitoso (padrão CoopereBR), WhatsApp curto + Email HTML com lista 🔴/⚠️ + link upload |
| Email admin alertas | Opção (b) ConfigTenant `email_admin_alertas` · default temporário `lucbragatto+admin@gmail.com` |
| Texto EDP | Code esboça (cadastro → "Minha conta" → "Email para envio de fatura" → digitar `contato@cooperebr.com.br`) |

## Bug crítico detectado + corrigido (whitelist guard)

**Primeiro smoke (sem guard):** CRON C disparou em 75 cooperados, mas whitelist LGPD bloqueou envio real silenciosamente. Service gravou marker `lembrete_edp:1` em **72 cooperados** mesmo sem envio. Resultado: em produção, esses 72 nunca receberiam o 1º lembrete (porque marker já está lá).

**Fix aplicado:**
- `service.processarLembreteDocsCooperado` e `service.processarLembreteEmailEdp` agora pre-checam `podeEnviarEmDev(email, 'EMAIL')` E `podeEnviarEmDev(telefone, 'WA')` antes de qualquer ação. Se nenhum canal disponível, pulam sem gravar marker.
- 72 markers false-positive revertidos via `scripts/reverter-marker-edp-smoke-d.ts`.

**Segundo smoke (com guard):** 9/9 PASS. CRON C agora processa apenas 3 cooperados whitelisted (`lucbragatto+*@gmail.com`) e pula 72 não-whitelisted em dev.

## ConfigTenant chaves (9 por tenant)

| Chave | Default | Função |
|---|---|---|
| `cron_lembrete_doc_cooperado_ativo` | `true` | Liga/desliga CRON A |
| `cron_lembrete_doc_cooperado_horas` | `48` | Horas espera antes de 1º lembrete |
| `cron_lembrete_doc_cooperado_max_tentativas` | `5` | Anti-spam |
| `cron_alerta_admin_doc_ativo` | `true` | Liga/desliga CRON B |
| `cron_alerta_admin_doc_dias` | `7` | Dias parado pra agregar no alerta |
| `cron_lembrete_email_edp_ativo` | `true` | Liga/desliga CRON C |
| `cron_lembrete_email_edp_horas` | `24` | Horas pós-contrato ATIVO pro 1º lembrete |
| `email_admin_alertas` | `lucbragatto+admin@gmail.com` | Destinatário CRON B (default temporário, configurar real) |
| `email_institucional_parceiro` | `contato@cooperebr.com.br` | Email mostrado na instrução CRON C |

## Commits da sessão

- `fd902af` — feat(email): 3 templates + métodos pro Bloco D
- *(commit notificacoes-proativas + scripts)* — feat(notificacoes-proativas): módulo + 3 crons + seed configs
- *(este fechamento)* — docs(sessao): Bloco D fechado

## Débitos resolvidos

- **Quadro 3 txt Luciano (3 lembretes proativos não existem)** → ✅ RESOLVIDO. 3 crons operacionais, gating multi-tenant via ConfigTenant.
- **Anti-spam via whitelist guard** — bug detectado no smoke e corrigido antes de produção. Pattern reaplicável a outros crons futuros.

## Pendências (não-bloqueantes)

- Validação visual em produção real (Luciano testar fluxo com cooperado fora da whitelist quando autorizar disparo real)
- `email_admin_alertas` default = `lucbragatto+admin@gmail.com` é **temporário**. Configurar email real do Presidente CoopereBR (Victor → Leonardo após AGE 17/06).
- Botão admin "marcar EDP-PENDENTE" na UI cooperado (CRON C usa `emailFaturasObservacao` contendo string "EDP-PENDENTE" pra reforço — admin precisa de UI pra inserir).

## Próximo passo

**Bloco B — Sprint CT Consolidado** (21-26h Code). Unifica 5 vocabulários CooperToken antes de Sprint E (realocação multi-usina) e Sprint F (automação concessionária) herdarem ambiguidade.

Frase comandante canônica em `docs/CONTROLE-EXECUCAO.md` será atualizada.
