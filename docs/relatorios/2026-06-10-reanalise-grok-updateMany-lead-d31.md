# 📋 REANÁLISE DO GROK (após relatório circunstanciado) — Base: main f675f21 (fechamento M28)

**De:** Grok 4.3 (xAI)  
**Para:** Claude Code (orquestrador local) / Luciano  
**Data:** 10/06/2026  
**Base verificada:** `origin/main f675f21` (pós-M28: F0 CooperToken QR conformidade + F1 PIN 3 canais + Santi 1ª conveniada)  
**Método:** git fetch + inspeção estática em `backend/src` (44 chamadas updateMany em 23 arquivos .ts prod, excluindo specs/scripts); leitura cruzada com debitos-tecnicos.md:1718+, 3 relatórios IDOR 30/05, CONTROLE-EXECUCAO + sessão M28; leitura direta dos arquivos críticos (lead-expansao.*, motor-proposta.*, contratos.service.ts).

Agradeço o relatório preciso e as verificações manuais (lead-expansão controller 62-68, motor-proposta 505, contagem real de updateMany, D-31 reframing). Você tinha razão na causa-raiz (branch defasado `claude/add-claude-documentation-yo39F` vs main). Meu método de varredura estática continua válido; os números e alguns diagnósticos foram invalidados pela defasagem. Abaixo, reanálise ponto a ponto sobre a base correta + delta + propostas concretas.

## 1. Correções de base (confirmadas)

| Item reportado por mim (análise antiga) | Realidade em f675f21 (main pós-M28) | Evidência |
|---|---|---|
| ~10 updateMany | **44 chamadas** em **23 arquivos .ts** (excluindo specs/fix scripts) | rg updateMany backend/src (excl .spec.ts scripts prisma) |
| cooper-token 0 specs | 3+ specs + conformidade QR F0 (M28) + PIN F1 | cooper-token/*.spec.ts + sessão M28 |
| D-31 P1 "investigar por que zerou" + SQL backfill | **REFRAMED 12/05** (debitos-tecnicos.md:1718): 61 contratos zerados = import legado fictício (não reais). Ação = guard preventivo (não backfill). Guard **ainda ausente**. | debitos-tecnicos.md:1718-1730; contratos.service.ts:83-84 (return 0) + 208 (if kwh only) |
| motor-proposta sem @Roles + cooperativaId do body sem guarda | Controller `@Roles` classe (line 21) + override SUPER_ADMIN em aceitar/aplicar-reajuste. Service em aceitar carrega `dono` do cooperado + valida mismatch (505). | motor-proposta.controller.ts:21,185-186; .service.ts:493-507 |
| "aplicar-reajuste endpoint não localizado" | **Localizado**: POST /motor-proposta/aplicar-reajuste @Roles(SUPER_ADMIN only) | motor-proposta.controller.ts:186 |

**Commit base atual (não b810e7b):** f675f21 — M28 fechamento. b810e7b era M27 (docs(sessao) revisao multi-tenant). Sincronizei em main atual. Não usei o branch stale yo39F.

## 2. Veredito ponto a ponto (mantido / superado / refinado)

### ✅ CONFIRMADO (válido, pode manter na lista de achados)
- **`return 0` silencioso em validarCapacidadeUsina (percentualUsina)**: `contratos.service.ts:83-84`:
  ```ts
  if (!usina || !usina.capacidadeKwh || Number(usina.capacidadeKwh) <= 0) {
    return 0; // sem capacidade definida — não bloqueia
  }
  ```
  Chamado em create (~228) e update (~412). Achado correto e de valor (risco de 0% silencioso poluindo dados de concentração).
- **lead-expansao com cooperativaId opcional para SUPER_ADMIN**: confirmado exato no controller (veja §3). O achado mais valioso da análise anterior.
- **Método de varredura + mapeamento callers + consistência docs/código**: sólido. Aproveitei integralmente (cruzado com Onda A/B).

### ❌ SUPERADO (não reabrir; causa conhecida / já corrigido / incorreto no main)
- D-31 H1/H2/H3 + SQL + backfill dos 61: encerrado 12/05. Legado fictício. Guard (não SQL) é o item pendente. **Não propor backfill**.
- motor-proposta "sem guarda tenant-write": mitigado no service (aceitar 505+). Risco body-injection reduzido por load + check contra JWT. (Ressalva sua mantida: paths de reajuste em massa merecem olhar — mas endpoint agora tem @Roles explícito só SUPER_ADMIN.)
- cooper-token "sem testes": falso (specs + M28 entregas F0/F1).

### 🔧 REFINADO (válido + reclassificação + delta)
- **lead-expansao não é IDOR clássico**: autenticação + @Roles exigidos. É **ação-em-massa cross-tenant intencional de SUPER_ADMIN** (controller força undefined → service where sem filtro → updateMany em leads de todas cooperativas para a distribuidora). Onda A já listou "lead-expansao" entre módulos com IDORs (30/05). Valor novo: hardening de design para o caso de uso "expansão comercial".
- **updateMany count**: 44 chamadas / 23 arquivos prod (vs meu 10 anterior e seu "54"). Diferença por escopo (excluí specs + scripts de migração/fix). Cooperados + convenios ainda lideram, mas PIN (6), whatsapp-fluxo (4), etc. são mais novos (pós-Onda A/B).

## 3. Auditoria delta dos updateMany (foco no que Onda A/B não cobriu ou mudou desde 30/05)

**Contagem atual (prod .ts, sem specs/scripts):**
- Total: **44 chamadas** em **23 arquivos**.
- Top por arquivo (chamadas):
  - cooperados/pin-cooperado.service.ts: 6
  - convenios/convenios-aprovacao.service.ts: 5
  - cooperados/cooperados.service.ts: 5
  - whatsapp/whatsapp-fluxo-motor.service.ts: 4
  - (vários com 2 ou 1: asaas, repasses, cobrancas, motor-proposta, lead-expansao, cooper-token/limite-token, convenios/* (custeio, progressao, membro-builder), etc.)

**Cruzamento com auditorias IDOR 30/05 (Onda A + B + núcleo):**
- **Onda A** declarou "convenios (×3)" como **LIMPOS** (todos seguros). Os 5 calls em convenios-aprovacao + 1 em custeio/progressao/membro-builder são majoritariamente novos ou refinados pós-30/05 (Fatia convite-convênio, M28). Padrão observado: updateMany com `id + status` (defesa em profundidade contra race) + tx. Risco baixo, mas vale spot-check tenant no caller.
- **Onda B** cobriu notificacoes, asaas, whatsapp (modelos), integracao-bancaria — várias updateMany sem tenant foram flagged (ex: asaasCobranca.updateMany por asaasId). Os 2 em asaas.service + 1 notificacoes + 1 whatsapp-conversa.job + 4 em whatsapp-fluxo-motor merecem delta (especialmente se tocarem PII ou disparos).
- **Núcleo (workflow)**: cobriu contratos (updateMany em ativação cascata?), cooperados, motor-proposta, usinas etc. Os 5 em cooperados.service (incl. contrato.updateMany por cooperadoId + cooperado.updateMany com bypass SUPER_ADMIN explícito) e 1 em motor-proposta (aplicar-reajuste) são conhecidos no padrão "SUPER_ADMIN cross ou cascade por cooperadoId".
- **O que provavelmente não foi coberto profundamente (delta para priorizar):**
  - pin-cooperado.service.ts (6 calls) — novo F1 PIN M28.
  - lead-expansao.service.ts:1 (o notificarLeadsPorDistribuidora updateMany).
  - cooper-token/limite-token.service.ts:1 + jobs.
  - repasses-proprietario (2) — pode ter surgido com BH/AN.
  - clube-vantagens, saas, gateway-pagamento, convite-indicacao.job.

**Recomendação:** Entregue lista priorizada dos 23 (ou top 10 fora dos "limpos" declarados + código novo M28) com 1-liner de risco + caller role + se where inclui cooperativaId ou bypass explícito. O valor está no delta pós-Onda A/B + ações em massa de SUPER_ADMIN.

## 4. lead-expansao — análise refinada + proposta de hardening

**Código exato (controller + service):**
- `lead-expansao.controller.ts:62-68` (notificar):
  ```ts
  @Roles(SUPER_ADMIN, ADMIN)
  @Post('notificar/:distribuidora')
  notificar(...) {
    const cooperativaId = req.user?.perfil === PerfilUsuario.SUPER_ADMIN ? undefined : req.user?.cooperativaId;
    return this.service.notificarLeadsPorDistribuidora(distribuidora, cooperativaId);
  }
  ```
- `lead-expansao.service.ts:137-155`:
  ```ts
  async notificarLeadsPorDistribuidora(distribuidora, cooperativaId?) {
    const where = { distribuidora: {...}, intencaoConfirmada: true, status: 'AGUARDANDO', ...(cooperativaId ? {cooperativaId} : {}) };
    const leads = await findMany({where});
    await this.prisma.leadExpansao.updateMany({
      where: { id: { in: leads.map(l => l.id) } },  // <--- sem cooperativaId no updateMany!
      data: { status: 'NOTIFICADO', notificadoEm: agora }
    });
    ...
  }
  ```
- GET findAll e getResumo também fazem o mesmo pattern (undefined = todos).

**Classificação:** Ação-em-massa cross-tenant **por design** para SUPER_ADMIN (expansão comercial / investidores). Não é "acesso não autorizado" (auth + role exigidos), mas é **superfície de erro humano alto**: um SUPER_ADMIN sem querer pode disparar WhatsApp/notificação para leads de **todas** as cooperativas de uma distribuidora.

**O que Onda A já pegou:** lead-expansao listado como módulo com IDORs (provavelmente o findAll/resumo ou o notificar sem escopo).

**Propostas de hardening (escolher 1-2, priorizar baixo atrito):**
1. **Exigir cooperativaId explícito mesmo para SUPER_ADMIN** (quebra o "cross por design" — pode ser desejado para expansão controlada).
2. **Adicionar flag de confirmação / volume cap no DTO + log + alerta** (ex: `confirmar: boolean`, se !confirmar && leads.length > 50 → 409 ou require 2ª chamada).
3. **SUPER_ADMIN bypass só via query param explícito `?allTenants=true`** + sempre logar "CROSS_TENANT_MASS_ACTION by SUPER_ADMIN".
4. **Mover o updateMany para dentro de um "job de notificação" com tenant explícito + fila + undo curto**.
5. Manter atual + documentar no runbook + adicionar métrica/monitor de volume por chamada.

Minha recomendação: opção 2 ou 3 (mantém utilidade cross para expansão real enquanto protege de acidente). Implementar + spec de "SUPER_ADMIN notifica 2 tenants, verifica updateMany só nos ids do tenant A quando escopoado".

## 5. D-31 — guard ainda ausente; proposta de implementação (sem SQL)

**Confirmação:** 
- `contratos.service.ts:83-84` tem o return 0 (achado bom).
- `contratos.service.ts:208`: `if (kwhContratoAnual) { percentual = await validar... }` — só calcula quando há valor; caso contrário não seta (pode defaultar 0 no Prisma ou ficar undefined).
- **Zero evidência** do guard reframed (debitos-tecnicos.md:1726):
  - Se kwhContratoAnual=null → percentualUsina=null (não 0).
  - Tentativa de gravar 0 quando kwhAnual null → vira null silenciosamente.
  - Spec 3 cenários.

**Proposta de patch (mínimo, TDD):**
No ContratosService (create + update paths, antes de chamar validar ou ao persistir):
```ts
let percentualUsina: number | null = null;
if (kwhContratoAnual != null && kwhContratoAnual > 0) {
  const calc = await this.validarCapacidadeUsina(...);
  percentualUsina = calc; // pode ser 0 só se usina sem cap (já existente)
} else if (data.percentualUsina === 0 && !kwhContratoAnual) {
  percentualUsina = null; // guard silencioso
}
(data as any).percentualUsina = percentualUsina;
```
- Adicionar no DTO/Prisma level se possível (mas service é o lugar do cálculo).
- 3 specs no contratos.service.guard-*.spec.ts ou novo (copiar padrão dos existentes em cooperados/cooperados.service.guard-ativacao.spec.ts).
- Atualizar debitos-tecnicos.md com "Implementado em <commit>" + data.
- **Nenhum backfill / SQL**. Somente preventivo para próximos cadastros reais (Caminho A canário).

## 6. Outros itens do pedido / síntese

- **Não reabrir:** motor-proposta tenant (mitigado), cooper-token specs (entregues M28), D-31 causa (conhecida).
- **Contexto M28 incorporado:** F0/F1 CooperToken + PIN + Santi priorizam estabilidade de token/WA sobre expansões novas. lead-expansao hardening pode ir para Fatia posterior (pós-Santi real usage).
- **WhatsApp P1s (09/06):** 3 vivos (não persiste OCR, PII sem cripto em dadosTemp, notif convênio só in-app). Se for auditar updateMany em whatsapp-fluxo-motor, cruzar com a investigação WA.
- **Aplicar-reajuste:** agora localizado + @Roles(SUPER_ADMIN). O updateMany no service (motor-proposta.service.ts:1236) usa cooperadoIds vindos da simulação (verificar se simularReajuste já escopa por tenant ou tarifa global). Como restrito a SUPER, ok por design, mas adicionar log "MASS_REAJUSTE" + where com status + ids é boa prática.

## 7. Plano de ação sugerido (próximos passos)

1. (Imediato) Implementar D-31 guard + 3 specs (baixo risco, bloqueia futuro bug de dados).
2. (Curto) Hardening lead-expansao notificar (opção 2/3 acima) + spec cross-tenant + log estruturado.
3. (Delta) Spot-check os 23 arquivos de updateMany priorizando: pin-cooperado (novo), whatsapp-fluxo (WA P1s), lead, motor-reajuste, cooperados cascades, convenios novos (mesmo "limpos" em Onda A). Entregar tabela "delta vs Onda A/B" com 1-liner risco + caller.
4. (Docs) Atualizar debitos-tecnicos.md + CONTROLE-EXECUCAO com os itens acima.
5. (Opcional) Adicionar tenant-leak-detector ou teste e2e cross-tenant smoke para endpoints de massa SUPER_ADMIN.

**Síntese:** Seu relatório estava correto nos fatos verificados manualmente. Meu trabalho anterior rodou em base errada — obrigado pela correção. O método (varredura estática + cruze com auditorias existentes) é o certo; agora com base main f675f21 + números reais (44/23) + contexto M28, foquemos no **delta** e nos **dois guardas de design** (D-31 null + lead-expansao mass action).

Pronto para implementar o guard D-31 ou o hardening do notificar (com TDD) quando der o sinal. Posso também gerar o PR plan ou rodar os 23 arquivos com subagentes para o delta completo.

— Grok (reanalisado sobre f675f21)
