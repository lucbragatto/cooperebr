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

### T1 — Fix recálculo ao trocar plano (Wizard Admin) ✅ CONCLUÍDA
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

### T7 — Reativar validações no cadastro público
**Arquivo:** `backend/src/publico/publico.controller.ts`
**Fix:** descomentar validações de CPF (11 dígitos), email e telefone que estão comentadas
**Commit:** `fix: reativar validações CPF/email/telefone no cadastro público`

---

### T6 — Unificar link de indicação
**Arquivo:** `backend/src/indicacoes/indicacoes.service.ts`
**Problema:** backend gera `/entrar?ref=CODIGO` mas cadastro está em `/cadastro?ref=CODIGO`
**Fix:** mudar `gerarLink()` para usar `/cadastro?ref=` em vez de `/entrar?ref=`
**Commit:** `fix: unificar link de indicação para /cadastro?ref=CODIGO`

---

### T2 + T8 — Planos com filtro de tenant e público
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

### T3 — Motor de Proposta: aceite + fluxo de documentos
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

### T0 — Wizard Admin conectar ao Motor de Proposta
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

## TAREFAS — SPRINT 3 (alto risco — feature toggle obrigatório)

### T4-PRE — Auditoria de queries (pré-requisito de T4)
**Antes de criar cooperados pelo cadastro público, verificar:**
- Todas as queries que tocam `Cooperado` filtram por `status`?
- Geração de cobranças filtra `status = ATIVO`? (já deve ser — confirmar)
- Dashboard stats inclui cooperados PENDENTE nos contadores? (ajustar se sim)
- Motor de proposta assume que todo cooperado tem proposta? (mapear)

**Commit:** `fix: garantir que queries de cobrança/stats filtram por status ATIVO`

---

### T4 — Cadastro público criar Cooperado + Proposta (com feature toggle)
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

**Sequência de menor risco:**
```
T7 → T6 → T2+T8 → T3 → T0 → T4-PRE → T4
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
