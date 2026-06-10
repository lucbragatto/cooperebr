# TEMPLATE — Adversarial Review Report (Checker / Verificador Independente)
**Papel:** Grok (Analista / Verificador read-only)  
**Sprint em revisão:** Hardening SUPER_ADMIN Mass Write Cross-Tenant (M1-M5)  
**Momento de execução:** Após entrega do Code (pós bugs Santi + M29)  
**Base de revisão:** main (commit a ser informado pelo Code)  
**Princípio:** Adversarial, sem ver o diff de antemão. Foco em resultado final vs spec v2 aprovado. Zero commit no main. Code é o único implementador.

---

## 1. Resumo Executivo

**O que foi entregue pelo Code:**
- [ ] Hardening aplicado nos membros da classe (M1-M5)
- [ ] Tabela dos 23 updateMany atualizada com status
- [ ] Specs + smoke (se aplicável)
- [ ] Atualização em CONTROLE-EXECUCAO / runbook (se aplicável)

**Veredito geral do checker:**
- [ ] **APROVADO** (com eventuais observações menores)
- [ ] **GAPS** (lista abaixo)

---

## 2. Revisão por Membro da Classe

**Definição recordada (spec v2):** Membro da classe = bypass de tenant + WRITE/efeito colateral em massa (updateMany/deleteMany/notificação/dinheiro/estado cross-tenant por design). Exclui reads e cascades por entidade única.

### M1 — lead-expansao / notificarLeadsPorDistribuidora
- **Evidência no código:** `lead-expansao.controller.ts:62` + `lead-expansao.service.ts:137`
- **Tratamento aplicado:**
  - [ ] Confirmação explícita (body `confirm` + preview de volume)
  - [ ] Dry-run / cap de volume
  - [ ] Log estruturado `CROSS_TENANT_MASS_WRITE`
  - [ ] Comentário justificando o bypass por design
- **Specs:** [ ] Cobrem SUPER_ADMIN bypass vs ADMIN/OPERADOR + confirmação + dry-run + cap
- **Observações / gaps:**

### M2 — motor-proposta / aplicar-reajuste
- **Evidência no código:** `motor-proposta.controller.ts:185` (`@Roles(SUPER_ADMIN)` + comentário) + `motor-proposta.service.ts:1227`
- **Tratamento aplicado:**
  - [ ] Confirmação explícita (body `confirm` + preview de volume)
  - [ ] Dry-run / cap de volume
  - [ ] Log estruturado `CROSS_TENANT_MASS_WRITE`
  - [ ] Comentário justificando o bypass por design
- **Specs:** [ ] Cobrem SUPER_ADMIN bypass + confirmação + dry-run + cap
- **Observações / gaps:**

### M3 — saas / propagarModulosDoPlano (via vincularPlano)
- **Evidência no código:** `saas.controller.ts:55` + `saas.service.ts:111` (`propagarModulosDoPlano`)
- **Tratamento aplicado:**
  - [ ] Confirmação explícita (body `confirm` + preview de volume)
  - [ ] Dry-run / cap de volume
  - [ ] Log estruturado `CROSS_TENANT_MASS_WRITE`
  - [ ] Comentário justificando o bypass por design
- **Specs:** [ ] Cobrem SUPER_ADMIN + confirmação + dry-run + cap
- **Observações / gaps:**

### M4 — cooperados / bulk status por lista de ids
- **Evidência no código:** `cooperados.service.ts:1532` (o updateMany com `...(cooperativaId ? { cooperativaId } : {})` em lista de ids)
- **Tratamento aplicado:**
  - [ ] Confirmação explícita (body `confirm` + preview de volume)
  - [ ] Dry-run / cap de volume
  - [ ] Log estruturado `CROSS_TENANT_MASS_WRITE`
  - [ ] Comentário justificando o bypass por design
- **Specs:** [ ] Cobrem SUPER_ADMIN bypass vs outros perfis + confirmação + dry-run + cap
- **Observações / gaps:**

### M5 — migracoes-usina / migrarTodosDeUsina (candidato)
- **Evidência no código:** `migracoes-usina.controller.ts:72` (`@Roles(SUPER_ADMIN)`) + service `migrarTodosDeUsina`
- **Tratamento aplicado (se incluído):**
  - [ ] Confirmação explícita (body `confirm` + preview de volume)
  - [ ] Dry-run / cap de volume
  - [ ] Log estruturado `CROSS_TENANT_MASS_WRITE`
  - [ ] Comentário justificando o bypass por design
- **Specs:** [ ] Cobrem SUPER_ADMIN + confirmação + dry-run + cap
- **Observações / gaps:**

---

## 3. Revisão Global

- **Todos os membros da classe (M1-M5) receberam o tratamento completo?**  
  [ ] Sim  
  [ ] Não (detalhar em 2)

- **Algum membro ficou de fora / sem hardening?**  
  [ ] Não  
  [ ] Sim: ____________________

- **Algum READ cross-tenant foi endurecido por engano (falso-positivo)?**  
  (Dashboards, listagens globais, analytics, rankings, getConfig, saldos de parceiros, relatórios etc. **não** devem ter sido tocados.)  
  [ ] Não  
  [ ] Sim (falso-positivo): ____________________ (descrever o que foi endurecido e por quê é problema)

- **Tabela dos 23 updateMany atualizada corretamente?**  
  (Incluindo os 4 do whatsapp-fluxo-motor como "scoped single-cooperado + tenant guard — não classe".)  
  [ ] Sim  
  [ ] Não / incompleta (detalhar)

- **Specs cobrem os cenários exigidos?**  
  - Bypass SUPER_ADMIN vs ADMIN/OPERADOR  
  - Confirmação + dry-run + cap de volume  
  - Log `CROSS_TENANT_MASS_WRITE`  
  [ ] Sim (cobertura boa)  
  [ ] Parcial / ausente (detalhar)

- **Atualização de documentação / runbook / CONTROLE-EXECUCAO?**  
  [ ] Sim  
  [ ] Não / insuficiente

---

## 4. Veredito Final do Checker

**Status:**  
- [ ] **APROVADO** (pronto para merge após ajustes menores, se houver)  
- [ ] **APROVADO COM RESSALVAS** (lista de itens menores abaixo)  
- [ ] **NÃO APROVADO — GAPS CRÍTICOS** (lista abaixo)

**Gaps / Observações (numerados, priorizados):**
1. 
2. 
3. 

**Recomendações para o Code (se aplicável):**
- 

**Próximos passos sugeridos (orquestrador decide):**
- 

---

**Data da revisão:** YYYY-MM-DD  
**Commit base revisado:** `f675f21` (ou o informado pelo Code)  
**Assinatura do checker:** Grok (analista / verificador read-only)  

> Este template é usado de forma adversarial. O checker não vê o diff antes da revisão. O foco é "o que foi entregue bate com o spec v2 aprovado?" e "houve falso-positivo em reads?".

---

**Fim do template.**

**Pronto.** Estou de prontidão como verificador read-only.  

Quando o Code entregar o hardening (após os 3 bugs da Santi + M29), é só me passar o sinal + o commit final que eu executo a revisão adversarial usando exatamente este template e entrego o veredito estruturado (APROVADO / GAPS com evidências por membro).

Mantendo o papel: zero commit no main, zero implementação. Só análise e verificação. 

Aguardando o sinal do orquestrador.