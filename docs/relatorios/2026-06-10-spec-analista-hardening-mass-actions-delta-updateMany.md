# SPEC — Hardening "SUPER_ADMIN Mass Actions" + Delta UpdateMany vs Onda A/B
**Papel:** Grok (Analista puro — read-only, zero commits no main)  
**Data:** 10/06/2026  
**Base:** main `f675f21` (pós-M28)  
**Objetivo:** Produzir spec acionável para o Code implementar o sprint de hardening multi-tenant, sem colidir com opção B (Santi).

## 1. Insight central (refinamento do loop)
`lead-expansão/notificar` e `motor-proposta/aplicar-reajuste` não são casos isolados. Eles pertencem à **mesma classe**:

> **"SUPER_ADMIN Mass Action Cross-Tenant por Design"**  
> Endpoints/ações que:
> - Exigem explicitamente `SUPER_ADMIN` (ou SUPER + ADMIN com bypass para SUPER)
> - Executam operação em massa (`updateMany`, `deleteMany`, bulk find + update, etc.)
> - Removem intencionalmente o filtro de `cooperativaId` quando o caller é SUPER_ADMIN (para operar cross-tenant de forma legítima: expansão comercial, reajuste global de tarifa, consolidação, etc.)
> - Carregam alto risco de **erro humano em escala** (disparo acidental para todas as cooperativas, reajuste em todas as tarifas, etc.)

**Tratamento recomendado:** Não "fechar" um por um. Tratar como **classe** com controles consistentes:
- Confirmação explícita (UI + backend)
- Cap de volume / dry-run obrigatório
- Log estruturado `CROSS_TENANT_MASS_ACTION` (com ator, escopo, volume, ids afetados)
- Auditoria forte + possivelmente notificação para outros SUPER_ADMINs
- Documentação clara no código + runbook

## 2. Membros confirmados da classe (até o momento)

| ID | Endpoint / Ação | Arquivo:linha | Escopo permitido | Volume potencial | Comentário no código | Status vs Onda A/B |
|----|------------------|-----------------|------------------|------------------|----------------------|--------------------|
| M1 | `POST /lead-expansao/notificar/:distribuidora` | `lead-expansao.controller.ts:62-68`<br>`lead-expansao.service.ts:137-155` | SUPER_ADMIN (força `cooperativaId=undefined`) + ADMIN (escopo próprio) | Todos os leads AGUARDANDO + intencaoConfirmada de uma distribuidora em **todas** as cooperativas | — | Onda A listou "lead-expansao" como módulo com IDORs. O bypass cross para SUPER é **por design** (não foi tratado como bug). |
| M2 | `POST /motor-proposta/aplicar-reajuste` | `motor-proposta.controller.ts:185-189`<br>`motor-proposta.service.ts:1227-1249` | **Somente SUPER_ADMIN** (comentário explícito: "ADMIN não dispara reajuste em massa") | Todos os contratos ATIVO associados à tarifa (potencialmente cross-tenant) | "D-48-motor: aplicar reajuste afeta múltiplos contratos em escala... Restrito a SUPER_ADMIN" | Não aparece como achado pendente nas 3 auditorias de 30/05 (provavelmente porque o @Roles(SUPER_ADMIN) + comentário já existiam ou foi considerado legítimo). |

**Observação importante:** M2 é mais restrito que M1 (só SUPER, sem ADMIN). Isso é um bom sinal de consciência de risco.

## 3. Tabela-delta completa — Todos os updateMany em prod (23 arquivos / 44 chamadas)

Contagem obtida em `backend/src` excluindo `*.spec.ts`, `scripts/`, `prisma/`, arquivos de fix/migração one-off.

**Priorização sugerida para o sprint de hardening:**
- **P1 (Classe Mass Action)**: os 2 acima + qualquer outro que apareça com padrão similar.
- **P2 (Cascades em entidades centrais)**: cooperados + convenios-aprovacao (alto volume de membros/contratos).
- **P3 (Jobs / WhatsApp / Notificações)**: risco de PII + disparos em massa.
- **P4 (Baixo risco / internos)**: pin, aparelho-vinculado, clube, etc.

### Lista completa (ordenada por contagem)

| # | Arquivo | Chamadas updateMany | Tipo de operação (inferido) | Possível membro da classe Mass Action? | Coberto em Onda A/B (30/05)? | Notas / Risco sugerido | Recomendação para Code |
|---|---------|---------------------|-----------------------------|---------------------------------------|------------------------------|------------------------|------------------------|
| 1 | `cooperados/pin-cooperado.service.ts` | 6 | Bulk PIN / lockout / reset | Não (parece por cooperadoId específico) | Provavelmente não (PIN é F1 M28) | Interno, sensível (segurança), mas escopoado por cooperado | Revisar se há bypass SUPER sem log |
| 2 | `convenios/convenios-aprovacao.service.ts` | 5 | Transição de status de membro (PENDENTE → ATIVO, REJEITADO) com guard de status | Não (por id + status) | Onda A declarou "convenios (×3)" como LIMPOS | Padrão bom (id + status no where = defesa em profundidade). Pós-30/05 | Manter + garantir caller sempre passa tenant |
| 3 | `cooperados/cooperados.service.ts` | 5 | Ativação/suspensão em cascata (contrato.updateMany), bulk status cooperado, indicacao.cancel | Parcial (um dos updateMany de cooperado tem `...(cooperativaId ? {cooperativaId}:{})`) | Parcial (núcleo cobriu cooperados) | Cascade por cooperadoId é geralmente seguro. O bulk status cooperado com bypass SUPER é o que mais se aproxima da classe | Mapear exatamente qual dos 5 tem o bypass |
| 4 | `whatsapp/whatsapp-fluxo-motor.service.ts` | 4 | Provavelmente atualizações de estado de conversa / OCR / fatura | Desconhecido | Onda B cobriu vários whatsapp (modelos, etc.) | Alto risco (PII em ConversaWhatsapp.dadosTemp — ver INV WA 09/06) | Cruzar com investigação WA P1s |
| 5 | `cooperados/aparelho-vinculado.service.ts` | 2 | — | Não | Novo (PIN/F1) | Baixo | — |
| 6 | `asaas/asaas.service.ts` | 2 | cancelarCobranca etc. | Não | Onda B flagou asaasCobranca.updateMany sem tenant | Já tratado na Onda B? Verificar se fix foi aplicado | Confirmar cobertura |
| 7 | `repasses-proprietario/repasses-proprietario.service.ts` | 2 | — | Não | Repasses é sprint AN (pós 30/05?) | — | — |
| 8 | `convenios/convenios.service.ts` | 2 | — | Não | Onda A disse convenios limpos | — | — |
| 9 | `cobrancas/cobrancas.service.ts` | 2 | darBaixa etc. | Não | Núcleo + Onda B | — | — |
| 10 | `cobrancas/cobrancas.job.ts` | 1 | — | Não | Jobs muitas vezes out-of-scope em auditorias manuais | — | — |
| 11 | `motor-proposta/motor-proposta.service.ts` | 1 | **aplicarReajuste** | **SIM (M2)** | Não listado como pendente | Já restrito a SUPER_ADMIN | Aplicar padrão da classe |
| 12 | `notificacoes/notificacoes.service.ts` | 1 | marcarComoLida? | Não | Onda B flagou notificacoes.update sem tenant | Verificar se fixado | — |
| 13 | `whatsapp/whatsapp-conversa.job.ts` | 1 | — | Não | Onda B cobriu whatsapp | — | — |
| 14 | `clube-vantagens/clube-vantagens.service.ts` | 1 | — | Não | — | — | — |
| 15 | `saas/saas.service.ts` | 1 | — | Não | — | — | — |
| 16 | `usinas/usinas.service.ts` | 1 | — | Não | Núcleo flagou usinas | — | — |
| 17 | `cooper-token/limite-token.service.ts` | 1 | — | Não | CooperToken é M28 (pós) | — | — |
| 18 | `convite-indicacao/convite-indicacao.job.ts` | 1 | — | Não | — | — | — |
| 19 | `convenios/membro-builder.service.ts` | 1 | — | Não | — | — | — |
| 20 | `convenios/convenios-progressao.service.ts` | 1 | — | Não | — | — | — |
| 21 | `lead-expansao/lead-expansao.service.ts` | 1 | **notificarLeadsPorDistribuidora** | **SIM (M1)** | Onda A listou o módulo | Bypass intencional para SUPER | Aplicar padrão da classe |
| 22 | `gateway-pagamento/gateway-pagamento.service.ts` | 1 | — | Não | — | — | — |
| 23 | `convenios/convenios-custeio.service.ts` | 1 | — | Não | — | — | — |

**Total:** 44 chamadas em 23 arquivos.

## 4. Como o Code deve consumir esta spec (formato recomendado)

1. **Fase de descoberta curta (1-2h):** Confirmar se existem mais membros da classe (buscar outros `@Roles(SUPER_ADMIN)` que chamam updateMany/deleteMany sem cooperativaId no where, ou que fazem `if (perfil === SUPER_ADMIN) where = {}`).
2. **Hardening da classe (prioridade alta):**
   - Criar helper comum (ex: `assertMassActionConfirmation` ou decorator) ou padrão de código.
   - Para cada membro da classe:
     - Adicionar passo de confirmação (body `confirm: true` + mensagem de volume estimado).
     - Adicionar log estruturado com tag `CROSS_TENANT_MASS_ACTION`.
     - Adicionar cap (ex: se > 200 registros afetados, exigir dryRun=true ou limit).
     - Documentar no controller/service o "por que cross-tenant é intencional aqui".
3. **Revisão dos outros 21** (prioridade média): Focar em cascades (cooperados + convenios-aprovacao) e em tudo que toca WhatsApp/PII.
4. **Entregáveis do sprint:**
   - Tabela atualizada com status de cada um dos 23.
   - 2-3 membros da classe com hardening aplicado + specs.
   - Runbook curto "Como disparar uma mass action de SUPER_ADMIN com segurança".

## 5. Próximos artefatos que o analista (Grok) pode entregar se solicitado

- Lista completa com os trechos de código dos 2 membros da classe (já temos evidência forte).
- Busca expandida por outros padrões de "mass action" (não só updateMany — pode incluir createMany, deleteMany, ou loops que atualizam em batch).
- Sugestão de implementação do helper comum + exemplo de log.
- Matriz de risco x volume x frequência para priorização.

---

**Este documento é 100% read-only / spec.**  
Pronto para o Code abrir branch de hardening depois de resolver a opção B (Santi) ou em paralelo controlado.

Se precisar de refinamento (mais detalhes de algum arquivo, busca por mais membros da classe, ou versão em markdown table mais limpa para colar no prompt do Code), é só pedir. Estou no papel de analista.