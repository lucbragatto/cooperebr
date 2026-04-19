# SPRINT BACKLOG COMPLETO — CoopereBR
> Gerado e revisado em 15/04/2026.
> Inclui diagnóstico, fluxo de negócio correto e solução técnica de cada pendência.

---

## FLUXO DE NEGÓCIO CORRETO — CADASTRO (definição final)

### Princípio central
O fluxo de cadastro é **idêntico** independente do caminho de entrada:
- Com ou sem link de indicação (`?ref=CODIGO`) — indicação é benefício paralelo, não requisito
- Cadastro pelo admin ou pelo público — a diferença é só QUEM monta a proposta

### Quem monta a proposta

**Caminho Admin (`/dashboard/cooperados/novo`):**
```
Admin conversa com futuro cooperado (tel / WA / email / presencial)
  → cria cooperado no sistema
  → faz OCR da fatura
  → escolhe/sugere plano (tem visão completa das configs)
  → sistema calcula e exibe simulação
  → admin confirma aceite (verbal/presencial do cooperado)
     OU envia proposta e cooperado aceita pelo link
  → PropostaCooperado (ACEITA) gravada no banco
  → fluxo unificado ↓
```

**Caminho Público (`/cadastro`):**
```
Visitante acessa /cadastro (com ou sem ?ref=CODIGO)
  → faz upload da fatura → OCR extrai dados
  → sistema exibe planos disponíveis (publico=true, configurados pelo admin)
  → visitante escolhe plano → vê simulação de economia
  → clica "Avançar" = aceite da proposta
  → sistema cria Cooperado (PENDENTE) + PropostaCooperado (ACEITA)
  → fluxo unificado ↓
```

---

### Fluxo Unificado (após aceite da proposta)

```
[PROPOSTA ACEITA]
      │
      ▼
[AGUARDANDO_DOCUMENTOS]
  Sistema notifica cooperado: "Envie seus documentos para finalizar"
  PF: RG/CPF + comprovante de residência
  PJ: + contrato social + documentos dos sócios
  Upload via portal do cooperado ou página de cadastro
      │
      ▼
[DOCUMENTOS_EM_ANALISE]
  Admin recebe notificação
  Admin analisa:
    ├── APROVADO → segue ↓
    ├── PENDENTE → admin contata cooperado, pede o que falta
    │              cooperado reenvia → volta para análise
    └── REPROVADO → motivo registrado no banco
                    sistema notifica cooperado com motivo
      │
      ▼
[DOCUMENTOS_APROVADOS]
  Sistema gera automaticamente:
    • Contrato de Adesão (PDF)
    • Termo de Responsabilidade (PDF)
    • Procuração (PDF)
    • Proposta aceita (como anexo)
  Sistema envia link único de assinatura de todos os docs
      │
      ▼
[AGUARDANDO_ASSINATURA]
  Cooperado acessa link → assina todos os documentos
  Sistema recebe confirmação de assinatura
      │
      ▼
[CADASTRO_CONCLUIDO]
  Ciclo do cadastro fechado
  Cooperado entra na fila de alocação em usina
      │
      ▼
[ALOCAÇÃO / LISTA_ESPERA]
  Sistema verifica usinas disponíveis (mesma distribuidora)
  ├── Usina com capacidade:
  │     • Atualiza lista da usina (nome + % kWh do cooperado)
  │     • Notifica admin para aprovar lista
  │     → Admin aprova → lista assinada
  │     → Sistema envia para concessionária:
  │         - Lista atualizada da usina
  │         - Docs pessoais do cooperado
  │         - Docs assinados (contrato + termos + procuração)
  │     → Cooperado: status ATIVO
  └── Sem usina: cooperado em LISTA_ESPERA até vaga abrir
```

---

### Status do Cooperado (ciclo correto)
```
PENDENTE               ← cadastro criado (admin ou público)
  ↓
PENDENTE_DOCUMENTOS    ← proposta aceita, aguardando upload de docs
  ↓
EM_ANALISE             ← docs recebidos, admin analisando
  ↓
APROVADO               ← docs aprovados, link de assinatura enviado
  ↓
ATIVO                  ← assinou tudo + alocado em usina
```
Desvios:
```
EM_ANALISE → PENDENTE_DOCUMENTOS   (admin pede mais docs)
EM_ANALISE → REPROVADO             (motivo registrado, notificado)
```

### Status da Proposta (ciclo correto)
```
PENDENTE → ACEITA → CONCLUIDA
```
- A proposta em si NÃO precisa de assinatura — o aceite é uma ação no sistema
- O link de assinatura é dos DOCUMENTOS gerados após aprovação dos docs
- `PENDENTE_ASSINATURA` era um status incorreto no mapeamento anterior — removido

### Indicação (sempre opcional)
- Cadastro funciona normalmente SEM código de indicação
- SE veio com `?ref=CODIGO`: banner de boas-vindas + notificação ao indicador
- Token BONUS_INDICACAO: apenas após primeira fatura paga (não no cadastro)
- `registrarIndicacao()` é chamado se e somente se `codigoRef` estiver presente

---

## DIAGNÓSTICO — OS 3 MUNDOS DESCONECTADOS

### O que existe hoje vs o que deveria existir

**Wizard Admin (7 steps):**
- Step 3: exibe simulação mas não grava nada ❌
- Step 4: envia proposta por wa.me/mailto (texto manual) — não chama `aceitar()` ❌
- Step 6: `enviarParaAssinatura()` só muda estado React local ❌
- **Resultado: PropostaCooperado e Contrato NUNCA são criados pelo wizard**

**Cadastro Público:**
- `POST /publico/cadastro-web` cria `LeadWhatsapp` — não Cooperado, não Proposta ❌
- `DESCONTO_PERCENTUAL_FALLBACK = 0.20` hardcoded ❌
- Motor de Proposta nunca é chamado ❌
- Campo `plano.publico` existe no banco mas é ignorado ❌

**Módulo Planos:**
- `findAtivos()` sem filtro de `cooperativaId` nem `publico` ❌
- Retorna planos de todos os tenants (cross-tenant) ❌

---

## TAREFAS — SPRINT 1 (baixo risco, sem dependências)

### T1 — Fix recálculo ao trocar plano (Wizard Admin) ✅ CONCLUÍDA — commit `b296316`
**Arquivo:** `web/app/dashboard/cooperados/novo/steps/Step3Simulacao.tsx`
```tsx
useEffect(() => {
  if (!planoSelecionadoId) return;
  const plano = planos.find(p => p.id === planoSelecionadoId);
  if (!plano) return;
  if (kwhMesRecente || descontoCustom) gerarSimulacao();
}, [planoSelecionadoId]);
```

---

### T7 — Reativar validações no cadastro público ✅ CONCLUÍDA — commits `62cbdf8` + `bc304c8`
**Arquivo:** `backend/src/publico/publico.controller.ts`
**Fix:** descomentar validações de CPF (11 dígitos), email e telefone que estão comentadas
**Commit:** `fix: reativar validações CPF/email/telefone no cadastro público`

---

### T6 — Unificar link de indicação ✅ CONCLUÍDA — commit `930807b`
**Arquivo:** `backend/src/indicacoes/indicacoes.service.ts`
**Problema:** backend gera `/entrar?ref=CODIGO` mas cadastro está em `/cadastro?ref=CODIGO`
**Fix:** mudar `gerarLink()` para usar `/cadastro?ref=` em vez de `/entrar?ref=`
**Commit:** `fix: unificar link de indicação para /cadastro?ref=CODIGO`

---

### T2 + T8 — Planos com filtro de tenant e público ✅ CONCLUÍDA — commit `f296f34`

**Lacuna conhecida (Sprint 2+):** `/planos/ativos` continua `@Public()` sem ler JWT — wizard admin autenticado ainda pode ver planos cross-tenant. Correção exige refatorar o guard do controller para identificar tenant do token quando autenticado. **Não tratado no Sprint 1 por instrução explícita** (escopo: "não adicionar guard de auth").

**Arquivos:** `backend/src/planos/planos.service.ts`, `planos.controller.ts`, `web/app/cadastro/page.tsx`

**Fix backend:**
```typescript
// planos.service.ts
findAtivos(cooperativaId?: string, publico?: boolean) {
  return this.prisma.plano.findMany({
    where: {
      ativo: true,
      ...(publico && { publico: true }),
      ...(cooperativaId && { cooperativaId }),
      OR: [{ dataFimVigencia: null }, { dataFimVigencia: { gte: new Date() } }],
    },
    orderBy: { createdAt: 'desc' },
  });
}

// planos.controller.ts
@Get('ativos')
@Public()
findAtivos(@Query('cooperativaId') cooperativaId?: string, @Query('publico') publico?: string) {
  return this.planosService.findAtivos(cooperativaId, publico === 'true');
}
```

**Fix frontend cadastro público:**
```tsx
// Buscar planos públicos do parceiro
useEffect(() => {
  const cooperativaId = searchParams.get('tenant') ?? process.env.NEXT_PUBLIC_COOPERATIVA_ID;
  fetch(`${API_URL}/planos/ativos?publico=true&cooperativaId=${cooperativaId}`)
    .then(r => r.json())
    .then(setPlanos);
}, []);

// Recalcular ao trocar plano
useEffect(() => {
  if (planoSelecionado && kwhMedio) recalcularSimulacao();
}, [planoSelecionadoId]);

// Usar desconto real do plano
const desconto = planoSelecionado?.descontoBase ?? 0.20;

// Exibição diferenciada por tipo
// DESCONTO_DIRETO:      "Economize R$ 81,00/mês"
// FATURA_CHEIA_TOKEN:   "Receba 90 créditos de kWh/mês (~R$ 81 em energia)"
```

**Nota:** campo `cooperativaId` já existe em `Plano` como `String?` — sem migration necessária.
**Commit:** `feat: filtrar planos por tenant e público no cadastro web`

---

## TAREFAS — SPRINT 2 (motor ANTES do wizard — nessa ordem)

### T3 — Motor de Proposta: aceite + fluxo de documentos ✅ CONCLUÍDA — commits `bb646e9` + `33a8ea2` + `f2fbdfc` + `91e89bb`

**Dívida técnica registrada:** a proteção completa da rota `POST /motor-proposta/aceitar` depende de T0. Hoje a rota aplica 3 camadas de defesa (roles `SUPER_ADMIN/ADMIN` sem OPERADOR, validação de ranges no `resultado`, audit trail com `usuarioId` em `HistoricoStatusCooperado`), mas um ADMIN autenticado ainda consegue injetar `descontoPercentual` arbitrário dentro do range. O fix definitivo exige que `calcular()` persista uma proposta `PENDENTE` no banco e que `aceitar()` valide a transição `PENDENTE → ACEITA` contra os dados já persistidos — isso é parte do T0 (Wizard Admin conectar ao Motor de Proposta). Docstring de dívida técnica deixada no topo de `MotorPropostaService.aceitar()`.

**Dívida cosmética:** a rota HTTP permanece `/proposta/:id/enviar-assinatura` (handler renomeado para `enviarLinkAssinaturaDocs`). Não alterada porque `web/app/dashboard/motor-proposta/page.tsx:123` consome esse path e a task proíbe mudanças em frontend.

**Dívida cosmética:** `enviarAprovacao()` (linhas ~940 do service) tem o mesmo padrão de só fazer `console.log` sem envio real. Fora do escopo do T3, ficar para refactor futuro.

**Arquivo:** `backend/src/motor-proposta/motor-proposta.service.ts`

**O que muda:**
- `aceitar()`: após gravar PropostaCooperado (ACEITA), mudar status do cooperado para PENDENTE_DOCUMENTOS e notificar via WA/email para enviar docs
- `enviarAssinatura()`: renomear conceitualmente para `enviarLinkDocumentos()` — só é chamado APÓS admin aprovar docs, não após aceite da proposta. Implementar envio real (hoje só `console.log`)
- Rota direta `POST /motor-proposta/aceitar` no controller: proteger — só admin autenticado
- Adicionar endpoint `PUT /motor-proposta/:id/status-documentos` para admin marcar APROVADO/PENDENTE/REPROVADO com motivo
- Ao aprovar docs: sistema gera PDFs (contrato + termos + procuração + proposta) e envia link

**Fix — notificação após aceite:**
```typescript
async aceitar(dto) {
  // ... lógica existente de gravar PropostaCooperado ...

  // NOVO: mudar status cooperado para PENDENTE_DOCUMENTOS
  await this.prisma.cooperado.update({
    where: { id: dto.cooperadoId },
    data: { status: 'PENDENTE_DOCUMENTOS' }
  });

  // NOVO: notificar cooperado para enviar docs
  await this.whatsappSender.enviarMensagem(
    cooperado.telefone,
    `Proposta aceita! Envie seus documentos para finalizar o cadastro:\n${linkUploadDocs}`
  );
}
```

**Fix — enviarAssinatura() com envio real:**
```typescript
// Chamado APENAS após admin aprovar documentos
async enviarLinkAssinaturaDocs(propostaId: string) {
  // Gerar PDFs (contrato + termos + procuração + proposta como anexo)
  // Gerar token único
  // Enviar link via WA + email
  // Status cooperado → APROVADO
}
```

**Commit:** `feat: fluxo aceite proposta → PENDENTE_DOCUMENTOS + envio real link assinatura`

---

### T0 — Wizard Admin conectar ao Motor de Proposta ✅ CONCLUÍDA — commits `5cd3261` + `6c2b66e` + `457bc97` + `d8eb846` + `7ff2899` + `534b72e` + `e86c4b9`

**Dívida técnica registrada:** `POST /cooperados/cadastro-completo` ainda existe no backend mas não é mais chamado pelo wizard — candidato a deprecar após T4 (cadastro público criar Cooperado + Proposta). O endpoint pode ser mantido como API interna para migração/importação em lote, mas não deve ser usado pelo fluxo principal do wizard.

**Mudança de backend incluída (fora do escopo original):** guard `NOTIFICACOES_ATIVAS` no `cooperados.service.ts create()` + tratamento de P2002 como `ConflictException(409)` para CPF duplicado — necessários para segurança do wizard em dev (commit `5cd3261`).

**Arquivos:** `web/app/dashboard/cooperados/novo/steps/Step*.tsx` + `page.tsx`

**O que muda em cada step:**
```
Step 1: OCR fatura → OK (não muda)
Step 2: Dados cooperado → chamar POST /cooperados (criar cooperado real no banco)
Step 3: calcular() real com planoId → exibir simulação real do motor
Step 4: admin confirma aceite → chamar aceitar() → PropostaCooperado gravada
         → cooperado vai para PENDENTE_DOCUMENTOS
         → sistema notifica cooperado para enviar docs
Step 5: admin acompanha recebimento de docs (novo: listar docs recebidos)
Step 6: admin analisa docs → APROVADO/PENDENTE/REPROVADO
         → APROVADO: sistema gera PDFs e envia link assinatura
Step 7: acompanhar assinatura → quando assinado: busca usina → admin aprova lista
```

**Commit:** `feat: wizard admin conectado ao motor de proposta (fluxo completo)`

---

## TAREFAS — SPRINT 2.5 (portal do cooperado — baixo risco)

### T9 — Banner de status do cadastro no portal ✅ CONCLUÍDA — commit `8f1c985`

**Dívida técnica:** `tokenAssinatura` não exposto no portal — cooperado recebe link via WA/email (T3 P3). Para link direto no portal: adicionar propostas ao `GET /cooperados/meu-perfil` em sprint futuro.

**Arquivo:** `web/app/portal/page.tsx`
**Problema:** cooperado em PENDENTE_DOCUMENTOS / EM_ANALISE / AGUARDANDO_ASSINATURA não tem visibilidade do processo
**Fix:** adicionar bloco condicional no dashboard do portal baseado no `status` retornado por `/cooperados/meu-perfil`
```tsx
// Exibir banner apenas se status != ATIVO
{statusCadastro !== 'ATIVO' && (
  <BannerStatusCadastro
    status={statusCadastro}
    linkAssinatura={proposta?.tokenAssinatura}
  />
)}

// Etapas exibidas:
// ✅ Proposta aceita
// 📎 PENDENTE_DOCUMENTOS → botão "Enviar documentos" → /portal/documentos
// 🔍 EM_ANALISE → "Documentos em análise — aguarde"
// ✅ APROVADO + AGUARDANDO_ASSINATURA → botão "Assinar documentos" → /portal/assinar/[token]
// ✅ ATIVO → não exibe banner
```
**Depende de:** T3 (backend retornar status correto + tokenAssinatura no /meu-perfil)
**Commit:** `feat: banner de status do cadastro no portal do cooperado`

---

### T9b — Feedback da análise de documentos no portal ✅ CONCLUÍDA — commit `e75661e`
**Arquivo:** `web/app/portal/documentos/page.tsx`
**Problema:** página lista docs e permite upload, mas não mostra resultado da análise do admin
**Fix:** exibir por documento: APROVADO ✅ / PENDENTE ⏳ / REPROVADO ❌ + motivo da reprovação
**Depende de:** backend retornar status por documento na rota `/cooperados/meu-perfil/documentos`
**Commit:** `feat: exibir status de análise por documento no portal`

---

### T6 corrigido — Unificar link de indicação (backend + portal)
**Arquivos:**
- `backend/src/indicacoes/indicacoes.service.ts` — mudar `gerarLink()` para `/cadastro?ref=`
- `web/app/portal/page.tsx` linha ~72 — mudar `/entrar?ref=` para `/cadastro?ref=`
- `web/app/portal/indicacoes/page.tsx` — mesma correção
**Commit:** `fix: unificar link de indicação para /cadastro?ref=CODIGO`

---

### T10 — Aprovação automática de documentos (opt-in por parceiro) ✅ CONCLUÍDA — commits `58c3892` + `d87ce31`

**Implementação:** usou ConfigTenant chave-valor (sem migration). Chaves: `aprovacao_documentos_automatica` (`true`/`false`) e `prazo_aprovacao_auto_horas` (default `24`). Job cron horário (`documentos-aprovacao.job.ts`) verifica cooperados em PENDENTE_DOCUMENTOS com docs enviados há mais de X horas sem reprovação manual → chama `analisarDocumentos(propostaId, 'APROVADO')`. Frontend: toggle + select de prazo em `/dashboard/configuracoes/documentos`.

**Dívida técnica:** rota `/dashboard/configuracoes/documentos` não linkada no menu lateral do admin — admin navega diretamente pela URL. Adicionar link no menu em sprint futuro.

**Problema:** admin é gargalo do fluxo. Para escalar, parceiros precisam poder habilitar aprovação automática.
**Quem habilita:** SUPER_ADMIN (qualquer parceiro) ou ADMIN do parceiro (para si mesmo)

**Fix — schema (migration necessária):**
```prisma
// ConfigTenant ou Cooperativa
aprovacaoDocumentosAutomatica  Boolean  @default(false)
prazoAprovacaoAutoHoras        Int      @default(24)
```

**Fix — lógica:**
```typescript
// Após cooperado enviar documentos → status EM_ANALISE
// SE aprovacaoAutomatica = true:
//   agenda job para X horas depois
//   se nenhum doc reprovado manualmente nesse prazo → aprova automaticamente
//   admin ainda pode reprovar dentro do prazo
// SE aprovacaoAutomatica = false:
//   notifica admin para análise manual (fluxo atual)
```

**Por que prazo de espera:** dá margem para admin intervir se notar algo errado sem precisar revisar tudo antes
**Padrão:** `@default(false)` — fluxo manual é o padrão, automático é opt-in
**Depende de:** T3 (fluxo de documentos implementado)
**Commit:** `feat: aprovação automática de documentos por parceiro (opt-in)`

---

## TAREFAS — SPRINT 3 (alto risco — feature toggle obrigatório)

### T4-PRE — Auditoria de queries (pré-requisito de T4) ✅ CONCLUÍDA — commits `1f59ae0` + `68a3bc4` + `12f5a97`

**Auditoria completa — 6 queries corrigidas:**
- `cobrancas.service.ts` `calcularCobrancaMensal`: guard `contrato.status !== 'ATIVO'` + `cooperado.status !== 'ATIVO'`
- `cobrancas.job.ts` `calcularMultaJuros`: nested filter `contrato.status: 'ATIVO', cooperado.status: 'ATIVO'`
- `cobrancas.job.ts` `notificarCobrancasVencidas`: idem — sem WA para cooperados não-ativos
- `relatorios.service.ts` + `relatorios-query.service.ts` `inadimplencia`: filtro nested cooperado+contrato ATIVO
- `usinas-analitico.service.ts` `saudeFinanceira`: filtro nested cooperado+contrato ATIVO

**Padrão ouro identificado:** `relatorios-query.service.ts:118` `conferenciaKwh` — filtra `contrato.status: 'ATIVO'` E `cooperado.status: 'ATIVO'`

**Antes de criar cooperados pelo cadastro público, verificar:**
- Todas as queries que tocam `Cooperado` filtram por `status`?
- Geração de cobranças filtra `status = ATIVO`? (já deve ser — confirmar)
- Dashboard stats inclui cooperados PENDENTE nos contadores? (ajustar se sim)
- Motor de proposta assume que todo cooperado tem proposta? (mapear)

**Commit:** `fix: garantir que queries de cobrança/stats filtram por status ATIVO`

---

### T4 — Cadastro público criar Cooperado + Proposta (com feature toggle) ✅ CONCLUÍDA — commits `8af1bce` + `c5f6478`

**Implementação:** feature toggle `CADASTRO_V2_ATIVO=true` ativa fluxo v2. Método `cadastroWebV2()` em 5 passos: tx(Cooperado PENDENTE + UC) → motor.calcular() → motor.aceitar() → indicação → return. Legado (LeadWhatsapp) preservado como fallback. Frontend envia `planoId`, `cooperativaId`, `historicoConsumo[]` no payload. CPF duplicado → 409. Motor pode falhar silenciosamente (cooperado+UC já existem). Indicação fire-and-forget.

**Env vars:** `CADASTRO_V2_ATIVO` (prod=`true` para fluxo v2; dev pode omitir → legado)

**Arquivo:** `backend/src/publico/publico.controller.ts`

**Flag:** `NEXT_PUBLIC_CADASTRO_V2=true` — manter fluxo de lead enquanto não validado

**O que muda:**
```typescript
// POST /publico/cadastro-web (com CADASTRO_V2 ativo)
async cadastroWeb(body) {
  // 1. Criar Cooperado (PENDENTE) — não LeadWhatsapp
  const cooperado = await this.prisma.cooperado.create({ data: { ...body, status: 'PENDENTE' } });

  // 2. Criar UC vinculada
  await this.prisma.uc.create({ data: { cooperadoId: cooperado.id, ...body.instalacao } });

  // 3. Chamar Motor para calcular proposta
  const resultado = await this.motorProposta.calcular({ cooperadoId: cooperado.id, ... });

  // 4. Chamar aceitar() → cria PropostaCooperado (ACEITA) + muda para PENDENTE_DOCUMENTOS
  await this.motorProposta.aceitar({ cooperadoId: cooperado.id, resultado, planoId });

  // 5. SE veio com codigoRef: registrar indicação
  if (body.codigoRef) {
    await this.indicacoesService.registrarIndicacao(cooperado.id, body.codigoRef);
  }

  return { ok: true, cooperadoId: cooperado.id };
}
```

**Commit:** `feat: cadastro público v2 criar cooperado + proposta via motor`

---

### T5 — Vincular indicação no cadastro público
Incluído em T4 acima — `registrarIndicacao()` chamado após criar cooperado se `codigoRef` presente.

---

## DIAGRAMA DE DEPENDÊNCIAS (FINAL)

```
T1 ✅ concluída
T7 → independente
T6 → independente
T2+T8 → independente (schema já tem cooperativaId em Plano)
T3 → depende T2+T8 (motor usa planos reais)
T0 → depende T3 (wizard usa motor corrigido)
T4-PRE → independente (auditoria)
T4 → depende T0 + T3 + T4-PRE
T5 → incluída em T4
```

**Sequência de menor risco (revisada final):**
```
T7 → T6 → T2+T8    (Sprint 1 — baixo risco)
T3 → T0             (Sprint 2 — motor antes do wizard)
T9 → T9b → T10     (Sprint 2.5 — portal cooperado)
T4-PRE → T4        (Sprint 3 — refatoração cadastro público)
```

**Diagrama completo:**
```
T1 ✅ concluída
T7 → independente
T6 → independente (backend + portal)
T2+T8 → independente
T3 → depende T2+T8
T0 → depende T3
T9 → depende T3 (status correto no /meu-perfil)
T9b → depende T3
T10 → depende T3 (fluxo docs implementado)
T4-PRE → independente (auditoria)
T4 → depende T0 + T3 + T4-PRE
```

---

## CONVENÇÕES (SEMPRE SEGUIR)

```typescript
// Multi-tenant: SEMPRE
const entidade = await prisma.modelo.findFirst({
  where: { id, cooperado: { cooperativaId } }
});
if (!entidade) throw new ForbiddenException('Não encontrado nesta cooperativa');

// Financeiro: SEMPRE Math.round
const valorLiquido = Math.round((valorBruto - desconto) * 100) / 100;

// Tokens: valor travado na emissão
// quantidadeTokens = valorDesconto / tarifaUnitSemTrib
// valorReais no ledger = valorDesconto (nunca recalculado)

// Commits: português, descritivo
// fix: reativar validações CPF/email no cadastro público
// feat: filtrar planos por tenant e público
// feat: fluxo aceite proposta + PENDENTE_DOCUMENTOS
// feat: wizard admin conectado ao motor de proposta
```
