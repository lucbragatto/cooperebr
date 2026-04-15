# SPRINT BACKLOG COMPLETO — CoopereBR
> Gerado em 15/04/2026 com base em análise profunda do código-fonte.
> Inclui diagnóstico, solução e ordem de execução para cada pendência.

---

## DIAGNÓSTICO GERAL — OS 3 MUNDOS DESCONECTADOS

### Problema Central
O sistema tem três camadas que deveriam se conectar em sequência mas estão isoladas:

```
[Módulo Planos] ← define regras comerciais
      ↓ (deveria alimentar)
[Motor de Proposta] ← calcula, grava e gerenecia propostas
      ↓ (deveria ser chamado por)
[Wizard Admin / Cadastro Público] ← interface de cadastro
```

**O que existe hoje:**
- Motor de Proposta: funciona, mas só é chamado diretamente no dashboard de propostas
- Módulo Planos: CRUD completo, mas `findAtivos()` sem filtro de tenant/público
- Wizard Admin: 7 steps que manipulam apenas estado React — NADA é persistido pelo wizard
- Cadastro Público: cria `LeadWhatsapp`, não `Cooperado`, não usa Motor, não usa Planos reais

---

## BLOCO 1 — CONEXÃO PLANOS ↔ CADASTRO

### T1 — Fix recálculo ao trocar plano (Wizard Admin)
**Arquivo:** `web/app/dashboard/cooperados/novo/steps/Step3Simulacao.tsx`
**Problema:** ao trocar de plano, `planoSelecionadoId` muda mas `gerarSimulacao()` não é chamada
**Fix:**
```tsx
useEffect(() => {
  if (!planoSelecionadoId) return;
  const plano = planos.find(p => p.id === planoSelecionadoId);
  if (!plano) return;
  if (kwhMesRecente || descontoCustom) {
    gerarSimulacao();
  }
}, [planoSelecionadoId]);
```
**Risco:** Baixo. Só frontend. `gerarSimulacao()` é idempotente.
**Commit:** `fix: recalcular simulação automaticamente ao trocar plano`

---

### T2 — Cadastro público buscar planos reais
**Arquivos:**
- `backend/src/planos/planos.service.ts` — ajustar `findAtivos()`
- `backend/src/planos/planos.controller.ts` — aceitar query params
- `web/app/cadastro/page.tsx` — buscar planos reais, remover hardcoded

**Problema:**
- `DESCONTO_PERCENTUAL_FALLBACK = 0.20` hardcoded no frontend
- `findAtivos()` retorna planos de TODOS os tenants (sem filtro cooperativaId)
- Campo `plano.publico` existe mas é ignorado
- Tenant não é identificado na página pública
- Troca de plano não recalcula simulação

**Estratégia de tenant:** usar query param `?tenant=COOPERATIVA_ID` agora.
Subdomínio é evolução futura (requer middleware Next.js + config DNS).

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

**Fix frontend:**
```tsx
// Buscar planos públicos do parceiro ao montar a página
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

// No cálculo: usar descontoBase do plano (não fallback)
const desconto = planoSelecionado?.descontoBase ?? 0.20;

// Exibição diferenciada por tipo
// DESCONTO_DIRETO: "Economize R$ 81,00/mês"
// FATURA_CHEIA_TOKEN: "Receba 90 créditos de kWh/mês (~R$ 81 em energia)"
```

**Atenção:** verificar se campo `cooperativaId` existe no modelo `Plano` no schema Prisma.
Se não existir, adicionar migration antes de implementar.

**Commit:** `feat: buscar planos públicos do parceiro no cadastro web`

---

## BLOCO 2 — CONEXÃO MOTOR ↔ WIZARDS

### T0 — Wizard Admin conectar ao Motor de Proposta (URGENTE — precede T3)
**Problema crítico:** o wizard admin nunca chama `aceitar()`. A proposta não é gravada no banco.
Todo o Step 3 → Step 7 existe apenas como estado React no navegador.

**O que deve acontecer:**
- Step 3: chamar `POST /motor-proposta/calcular` passando `cooperadoId` + histórico OCR + `planoId` real
- Step 4 (atual "Proposta"): exibir resultado real do motor, confirmar opção (MES_RECENTE ou MEDIA_12M)
- Step 5: upload docs (OK, não muda)
- Step 6 (atual "Contrato"): chamar `POST /motor-proposta/aceitar` → cria `PropostaCooperado` + `Contrato`
  - Em vez de muda estado local, chamar `enviarAssinatura(propostaId)` → `PENDENTE_ASSINATURA`

**Fluxo correto do wizard admin:**
```
Step 1: OCR fatura → dados extraídos
Step 2: Dados cooperado → criar cooperado via POST /cooperados
Step 3: calcular() real → exibir simulação + escolher plano
Step 4: confirmar opção → aceitar() → PropostaCooperado gravada no banco
         → status: PENDENTE_ASSINATURA
         → enviarAssinatura() → link /assinar?token=xxx via WA + email
Step 5: upload docs → vincular ao cooperado
Step 6: aguardar assinatura (polling ou webhook)
Step 7: assinatura confirmada → Contrato PENDENTE_ATIVACAO
```

**Commit:** `feat: conectar wizard admin ao motor de proposta (calcular + aceitar)`

---

### T3 — Status PENDENTE_ASSINATURA + envio automático
**Arquivo:** `backend/src/motor-proposta/motor-proposta.service.ts`

**Problema:**
- `confirmarOpcao()` hoje é apenas um alias de `calcular()` — não muda status, não grava nada
- `aceitar()` cria proposta com status `ACEITA` direto, pulando assinatura
- `enviarAssinatura()` só faz `console.log` — nenhum WA, nenhum email é enviado
- Há 1 chamada direta a `aceitar()` no controller que precisará ser protegida

**Fix — confirmarOpcao():**
```typescript
async confirmarOpcao(propostaId: string, opcao: 'MES_RECENTE' | 'MEDIA_12M', cooperativaId: string) {
  const proposta = await this.prisma.propostaCooperado.findFirst({
    where: { id: propostaId, cooperado: { cooperativaId } }
  });
  if (!proposta) throw new ForbiddenException('Não encontrado nesta cooperativa');

  await this.prisma.propostaCooperado.update({
    where: { id: propostaId },
    data: { status: 'PENDENTE_ASSINATURA', opcaoEscolhida: opcao }
  });

  await this.enviarAssinatura(propostaId); // novo: disparo automático
  return { status: 'PENDENTE_ASSINATURA', mensagem: 'Link de assinatura enviado' };
}
```

**Fix — enviarAssinatura() — adicionar envio real:**
```typescript
async enviarAssinatura(propostaId: string) {
  const proposta = await this.prisma.propostaCooperado.findUnique({
    where: { id: propostaId },
    include: { cooperado: { select: { nomeCompleto: true, email: true, telefone: true } } }
  });
  if (!proposta) throw new NotFoundException('Proposta não encontrada');

  const token = randomUUID();
  await this.prisma.propostaCooperado.update({
    where: { id: propostaId },
    data: { tokenAssinatura: token }
  });

  const link = `${process.env.FRONTEND_URL}/assinar?token=${token}`;

  // Enviar via WhatsApp
  if (proposta.cooperado.telefone) {
    await this.whatsappSender.enviarMensagem(
      proposta.cooperado.telefone,
      `Olá ${proposta.cooperado.nomeCompleto}! Sua proposta CoopereBR está pronta.\n\nClique para assinar: ${link}\n\nValidade: 30 dias.`
    );
  }

  // Enviar via email
  if (proposta.cooperado.email) {
    await this.emailService.enviar({
      to: proposta.cooperado.email,
      subject: 'Proposta CoopereBR — Clique para assinar',
      body: `Seu link de assinatura: ${link}`
    });
  }

  return { sucesso: true, link, token };
}
```

**Fix — aceitar() — proteger chamada direta:**
- Rota `POST /motor-proposta/aceitar` no controller deve exigir que proposta esteja `ASSINADA`
- Ou: remover a rota pública e deixar `aceitar()` ser chamado apenas internamente por `assinarDocumento()`

**Fix — Lembrete 24h:**
```typescript
// Cron ou job: verificar propostas PENDENTE_ASSINATURA há mais de 24h
// e enviar lembrete via WA + email
```

**Commit:** `feat: adicionar status PENDENTE_ASSINATURA e envio automático de link`

---

## BLOCO 3 — CADASTRO PÚBLICO → MOTOR DE PROPOSTA

### T4 — Cadastro público gerar PropostaCooperado (não só Lead)
**Problema:** `/publico/cadastro-web` cria `LeadWhatsapp` (não cooperado, não proposta).
O Motor de Proposta nunca é chamado no fluxo público.

**Fluxo correto:**
```
POST /publico/cadastro-web
  → Cria Cooperado com status PENDENTE (não Lead)
  → Cria UC vinculada
  → Chama Motor de Proposta: calcular(cooperadoId, historico, planoId)
  → Cria PropostaCooperado (PENDENTE_ASSINATURA)
  → Chama enviarAssinatura() → link WA + email
  → Retorna { cooperadoId, propostaId, link }
```

**Atenção:** hoje `cadastro-web` usa `codigoRef` para indicação. Manter essa lógica.
Após criar cooperado: chamar `registrarIndicacao(cooperadoId, codigoRef)` se veio com ref.

**Commit:** `feat: cadastro público criar cooperado + proposta via motor (não só lead)`

---

## BLOCO 4 — MLM ↔ INDICAÇÃO ↔ CADASTRO

### T5 — Corrigir vínculo Lead → Cooperado → Indicação
**Problema:** o `codigoRef` do cadastro público fica salvo no JSON do `LeadWhatsapp.dados`,
mas quando o admin converte o lead em cooperado, esse vínculo é perdido.
`registrarIndicacao()` nunca é chamado automaticamente.

**Fluxo correto (após T4):**
```
POST /publico/cadastro-web com codigoRef=CODIGO
  → Cria Cooperado (PENDENTE)
  → Chama registrarIndicacao(cooperadoId, codigoRef) imediatamente
  → Notifica indicador via WA: "Fulano iniciou cadastro com seu convite"
  → TOKENS SÓ NA PRIMEIRA FATURA PAGA (já correto — não mudar)
```

**Nota:** `registrarIndicacao()` hoje exige que ambos sejam cooperados.
Com T4, o indicado já será cooperado no momento do cadastro — sem mudança necessária.

**Commit:** `fix: vincular indicação ao cooperado no momento do cadastro público`

---

### T6 — Link de indicação: unificar /entrar e /cadastro
**Problema:** o backend gera links `/entrar?ref=CODIGO` mas o cadastro público está em `/cadastro?ref=CODIGO`.
São duas entradas diferentes com lógicas separadas.

**Solução simples:** criar redirect `/entrar?ref=CODIGO` → `/cadastro?ref=CODIGO`
Ou: mudar `gerarLink()` no `indicacoes.service.ts` para usar `/cadastro`.

**Commit:** `fix: unificar link de indicação para /cadastro?ref=CODIGO`

---

## BLOCO 5 — QUALIDADE E SEGURANÇA

### T7 — Reativar validações no cadastro público
**Arquivo:** `backend/src/publico/publico.controller.ts`
**Problema:** validações de CPF, email e telefone estão comentadas (`// if (!body.cpf...`)
**Fix:** descomentar validações, adicionar validação de formato CPF (11 dígitos numéricos)
**Commit:** `fix: reativar validações de CPF/email/telefone no cadastro público`

---

### T8 — Tenant isolation em findAtivos (já cobre T2, detalhe separado)
**Arquivo:** `backend/src/planos/planos.service.ts`
**Problema:** `findAll()` e `findAtivos()` não filtram por cooperativaId — retornam dados cross-tenant
**Fix:** todos os métodos do PlanosService devem exigir cooperativaId
**Commit:** `fix: isolamento de tenant em todos os métodos do PlanosService`

---

## ORDEM DE EXECUÇÃO RECOMENDADA (revisado — 15/04/2026)

> ⚠️ Correção: diagrama anterior tinha dependência circular T0↔T3.
> T3 é APENAS backend (motor). T0 é APENAS frontend (wizard).
> T3 não depende de T0. T0 depende de T3. Ordem: T3 → T0.

**Schema Prisma:** campo `cooperativaId` já existe em `Plano` como `String?`.
Nenhuma migration necessária para T2/T8.

**Diagrama de dependências CORRETO:**
```
T1 ✅ (concluída)
T7 → independente (risco zero)
T6 → independente (risco zero)
T8 → independente (mesmo arquivo que T2, fazer junto)
T2 → depende T8 (mesmo serviço)
T3 → depende T2 (motor passa a usar planos reais)
T0 → depende T3 (wizard consome motor corrigido)
T4 → depende T0 + T3 (refatoração do cadastro público)
T5 → depende T4 (cooperado existe no cadastro)
```

**Sprint sugerido (revisado):**
- Sprint 1: T7 → T6 → T2+T8 (baixo/médio risco, sem dependências pesadas)
- Sprint 2: T3 → T0 (nessa ordem, não paralelo — T3 primeiro por ser só backend)
- Sprint 3: T4 (com feature toggle) → T5

**⚠️ T4 — risco elevado:**
Mudar `cadastroWeb` de criar `LeadWhatsapp` para criar `Cooperado + PropostaCooperado`
é uma quebra de fluxo. Implementar com **feature toggle** (`NEXT_PUBLIC_CADASTRO_V2=true`)
até validar com usuário real. Admin pode ter processos que dependem do lead manual.

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
// fix: corrigir recalculo simulação ao trocar plano
// feat: buscar planos públicos do parceiro no cadastro
// feat: adicionar PENDENTE_ASSINATURA no motor de propostas
```
