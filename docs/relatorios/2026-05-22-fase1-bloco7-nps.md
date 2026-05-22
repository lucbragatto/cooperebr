# Fase 1 read-only — Sprint Bot Autoatendimento Bloco 7 (NPS no fluxo)

Data: 22/05/2026
Autor: Code (Fase 1 read-only, Decisão 23)
Status: relatório de investigação — **nenhum arquivo editado, nenhum build, nada tocado**

---

## TL;DR (linguagem humana)

A boa notícia: **mais peças prontas do que esperávamos**. Já existe model
`NpsResposta` no schema, handler hardcoded `handleNpsNota` funcional, modelo
de mensagem `nps_recebido` (Bloco 2) + modelo `nps_aguardando_nota` (pergunta
de nota, no banco). Etapa `NPS_AGUARDANDO_NOTA` existe no seed mas com
**`gatilhos: []`** — está ativa porém sem entrada nem saída no fluxo
dinâmico.

A má notícia: **nada cabea pra NPS_AGUARDANDO_NOTA hoje**. Existe um
`agendarNps()` (linha 3990) preparado pra disparar 1h após `estado=CONCLUIDO`
mas é **dead code** — definido, nunca chamado. Então o NPS é "infraestrutura
dormente": funciona se alguém colocar a conversa em NPS_AGUARDANDO_NOTA, mas
ninguém faz isso.

3 decisões de produto pra você bater o martelo: (1) quem dispara o NPS hoje
no Bloco 7 — só infra OU reativar `agendarNps()`; (2) `NpsResposta` ganha
`cooperativaId` (recomendo SIM — multi-tenant SISGD); (3) ao registrar nota,
estado volta pra MENU_COOPERADO (consistente com Blocos 4/1.b) OU vai pra
CONCLUIDO (padrão atual do hardcoded). Recomendação: gatilho wildcard `*` +
ação `REGISTRAR_NPS` que valida 0-10 (mais limpo que 11 gatilhos).

**Estimativa 2-3h confirma**, podendo subir pra **2.5-3.5h** se aceitar
incluir `cooperativaId` no model.

---

## 1. Model de dados NPS

### 1.1 `NpsResposta` JÁ EXISTE no schema (linhas 1951-1960)

```prisma
model NpsResposta {
  id          String   @id @default(cuid())
  cooperadoId String?
  telefone    String
  nota        Int
  canal       String   @default("WHATSAPP") // WHATSAPP | PORTAL | EMAIL
  createdAt   DateTime @default(now())

  @@map("nps_respostas")
}
```

**Características:**

- ✅ Tem `nota Int` (perfeito pra 0-10).
- ✅ Tem `canal` com default `'WHATSAPP'` — já prevê outros canais
  (PORTAL, EMAIL) sem reformar schema.
- ✅ `cooperadoId String?` opcional (cooperado anônimo / lead também pode
  responder NPS).
- ✅ Tem `telefone` (importante porque cooperadoId pode ser null).
- ❌ **NÃO tem `cooperativaId`** — não é multi-tenant! Em produção com
  múltiplos parceiros (Sinergia + CoopereBR + ...), o NPS de cada
  cooperativa fica misturado num único pool.
- ❌ **NÃO tem `comentario`** (só nota numérica — sem texto qualitativo).
- ❌ **NÃO tem `@relation`** com `Cooperado` (campo `cooperadoId` é string
  solta, sem FK). Quem faz a junção precisa fazer manual.

### 1.2 Recomendação — delta aditivo

Pra Bloco 7 sugiro **2 campos novos opcionais**:

```prisma
model NpsResposta {
  id            String   @id @default(cuid())
  cooperadoId   String?
  cooperativaId String?  // ← NOVO (multi-tenant)
  telefone      String
  nota          Int
  comentario    String?  // ← NOVO (texto qualitativo opcional)
  canal         String   @default("WHATSAPP")
  createdAt     DateTime @default(now())

  @@map("nps_respostas")
}
```

**Delta puramente aditivo:**
- Zero risco de perda de dados (campos opcionais).
- `npx prisma db push` aceita sem `--accept-data-loss`.
- Linhas existentes (0 hoje em DEV — tabela vazia) ficam com `cooperativaId: null` e `comentario: null`.

**Comentario:** decisão de produto pode deixar pra DEPOIS (Bloco 7 inicial
só persiste nota). Mas adicionar agora **não custa nada extra** e desbloqueia
sprint futuro de NPS qualitativo. Decisão (2.5) no §5.

---

## 2. Etapa e modelo de mensagem

### 2.1 Etapa `NPS_AGUARDANDO_NOTA` — existe órfã no seed

`backend/prisma/seeds/seed-fluxos-bot.mjs:111`:

```javascript
{ id: 'f-nps', nome: 'NPS — Aguardando Nota', ordem: 21,
  estado: 'NPS_AGUARDANDO_NOTA', gatilhos: [] },
```

⚠️ **`gatilhos: []`** — etapa sem saída no fluxo dinâmico. Se motor
processar conversa nesse estado, **`avaliarGatilhos` retorna null** e cai
no fallback hardcoded (que tem `case 'NPS_AGUARDANDO_NOTA'` no switch — ver §3.1).

**No banco DEV** (a confirmar na Fase 2 read-only check rápido): a etapa
provavelmente está populada por `seed-fluxos-bot.mjs` ao seedar. Vou
confirmar com SELECT na Fase 2 antes de Fase 2-escrita.

### 2.2 Modelo `nps_recebido` — existe (Bloco 2)

`backend/prisma/seed-mensagens.ts:141-147` + `backend/scripts/fix-bloco-2-modelos-novos.ts:70`:

```javascript
{
  nome: 'nps_recebido',
  conteudo:
    'Muito obrigado pela sua avaliação! 🙏\n' +
    'Sua opinião ajuda a {{parceiro}} a melhorar cada vez mais.\n' +
    'Qualquer coisa, é só chamar aqui. 💚',
}
```

**Variáveis usadas:** `{{parceiro}}` (já existe no `extrairVariaveis()` do
motor — confirmado em sessões anteriores).

### 2.3 Modelo `nps_aguardando_nota` — existe no banco mas sem fonte explícita

Aparece referenciado em `backend/scripts/fix-r2-coopereb-para-parceiro.ts:12`:

```typescript
const NOMES_ALVO = ['menu_principal', 'nps_aguardando_nota'] as const;
```

Esse script (R2, sessão M16) substitui `{{cooperebr}}` por `{{parceiro}}`
nesses 2 modelos. Isso prova que o modelo **existe no banco** (foi seedado
em algum ponto histórico). Mas não está em `seed-mensagens.ts` nem em
`seed-fluxo-padrao.ts` atuais. Há um modelo `nps_trimestral` em
`seed-fluxo-padrao.ts:138-144` (pergunta NPS após 3 meses) — pode ter sido
inserção paralela.

**Verificar na Fase 2** (read-only check rápido): SELECT no banco DEV pra
confirmar conteúdo do `nps_aguardando_nota`. Esperado: pergunta tipo
"De 0 a 10, quanto você indicaria a {{parceiro}} pra um amigo?".

### 2.4 Estado `NPS_RECEBIDO` — NÃO existe como FluxoEtapa

Grep não encontrou referência a `NPS_RECEBIDO` no seed nem no código de
fluxo. Bloco 7 precisa criar esta etapa (idempotente, padrão dos blocos
anteriores).

**Alternativa:** estado pós-NPS pode ser **MENU_COOPERADO** direto (sem
criar `NPS_RECEBIDO` como etapa separada). A ação `REGISTRAR_NPS` envia o
modelo `nps_recebido` (mensagem de agradecimento) e transiciona pra
MENU_COOPERADO. Mais limpo, segue padrão Bloco 4. Recomendo.

---

## 3. Gatilho / onde o NPS é disparado

### 3.1 Handler hardcoded EXISTE e FUNCIONA (`whatsapp-bot.service.ts:4013-4034`)

```typescript
private async handleNpsNota(msg: MensagemRecebida, conversa: any): Promise<void> {
  const { telefone } = msg;
  const corpo = this.respostaEfetiva(msg);
  const nota = parseInt(corpo, 10);

  if (isNaN(nota) || nota < 0 || nota > 10) {
    await this.sender.enviarMensagem(telefone, 'Por favor, digite um número de 0 a 10.');
    return;
  }

  await this.prisma.npsResposta.create({
    data: {
      cooperadoId: conversa.cooperadoId || undefined,
      telefone,
      nota,
      canal: 'WHATSAPP',
    },
  });

  await this.sender.enviarMensagem(telefone, `Obrigado pelo feedback! ${E.coracao} Isso nos ajuda a melhorar.`);
  await this.finalizarConversa(conversa.id);  // estado=CONCLUIDO
}
```

**Comportamento:**
- Valida `parseInt + 0..10`.
- Cria `NpsResposta` direto via Prisma (sem cooperativaId — porque o
  schema não tem).
- Mensagem de agradecimento **hardcoded** (não usa o modelo
  `nps_recebido` do banco).
- Transiciona pra **`CONCLUIDO`** via `finalizarConversa`.
- Switch case ativo em `whatsapp-bot.service.ts:602` — invocado quando
  conversa entra em `NPS_AGUARDANDO_NOTA` E motor cai pro fallback (porque
  etapa dinâmica não tem gatilhos).

### 3.2 `agendarNps()` é DEAD CODE (`whatsapp-bot.service.ts:3990-4011`)

```typescript
private agendarNps(telefone: string, conversaId: string): void {
  setTimeout(async () => {
    try {
      const conversa = await this.prisma.conversaWhatsapp.findUnique({ where: { id: conversaId } });
      if (!conversa || conversa.estado !== 'CONCLUIDO') return;

      await this.prisma.conversaWhatsapp.update({
        where: { id: conversaId },
        data: { estado: 'NPS_AGUARDANDO_NOTA' },
      });

      await this.sender.enviarMensagem(
        telefone,
        `${E.sorriso} Olá! Sua solicitação de adesão à CoopereBR foi recebida!\n\n` +
        'De 0 a 10, quanto você indicaria a CoopereBR para um amigo?\n' +
        '(Digite apenas o número)',
      );
    } catch (err) {
      this.logger.warn(`Erro ao enviar NPS para ${telefone}: ${err.message}`);
    }
  }, 60 * 60 * 1000); // 1 hora
}
```

**Grep do backend inteiro confirmou: ZERO chamadores.** Função definida
mas nunca invocada. Provavelmente um stub que ficou pra trás de uma
implementação anterior abortada.

**Observações sobre essa função:**
- ⚠️ Texto hardcoded com `"CoopereBR"` (não usa `{{parceiro}}`) — não é
  multi-tenant.
- ⚠️ `setTimeout` no processo Node = **frágil**. Se backend reiniciar
  dentro da hora, o NPS é perdido. PM2 restart sumi o timer.
- ⚠️ Mistura "adesão recebida" (texto da pergunta) com NPS genérico —
  acoplado a um fluxo específico.

**Recomendação:** NÃO reativar `agendarNps` no Bloco 7 — está acoplado e
frágil. Se decidirmos disparar NPS no Bloco 7, fazer caminho próprio
(cron ou trigger event-based).

### 3.3 Existe `nps_trimestral` em `seed-fluxo-padrao.ts:138-144`

Modelo PARALELO `nps_trimestral` em `seed-fluxo-padrao.ts`:

```javascript
{
  id: 'msg-nps-trimestral',
  nome: 'nps_trimestral',
  categoria: 'BOT',
  conteudo:
    '📊 Oi {{nome}}!\n\nFaz 3 meses que você é {{tipo_membro}} da {{parceiro}}. ' +
    'De *0 a 10*, qual a chance de você nos indicar pra um amigo?\n\n' +
    'Responda apenas com o número. Sua opinião nos ajuda muito! 🙏',
}
```

Sugere intenção pretérita de NPS trimestral via cron. Não tem caller.

### 3.4 Conclusão: NPS está totalmente solto

**Nenhum gatilho cabea pra `NPS_AGUARDANDO_NOTA` hoje.** O bot tem:
- Etapa dinâmica vazia (sem gatilhos)
- Handler hardcoded funcional (mas só dispara se algo colocar a conversa
  no estado certo)
- Função de agendamento dead code
- Modelo de pergunta trimestral órfão

**Decisão produto pendente pro Luciano (detalhada em §5):** quem dispara
o NPS no Bloco 7?

---

## 4. Código NPS pré-existente — resumo (Decisão 14)

| Item | Status | Local |
|---|---|---|
| Model `NpsResposta` | ✅ existe (falta cooperativaId + comentario opcional) | `schema.prisma:1951` |
| Tabela `nps_respostas` no banco | ✅ existe (presumível — model declarado) | — |
| Handler hardcoded `handleNpsNota` | ✅ funcional | `whatsapp-bot.service.ts:4013-4034` |
| Switch case `NPS_AGUARDANDO_NOTA` | ✅ ativo no hardcoded | `whatsapp-bot.service.ts:602` |
| Etapa dinâmica `NPS_AGUARDANDO_NOTA` no seed | ⚠️ existe porém órfã (`gatilhos: []`) | `seeds/seed-fluxos-bot.mjs:111` |
| Modelo `nps_recebido` (mensagem agradecimento) | ✅ existe (Bloco 2) | `seed-mensagens.ts:141`, `scripts/fix-bloco-2-modelos-novos.ts:70`, banco |
| Modelo `nps_aguardando_nota` (mensagem pergunta) | ✅ existe no banco (fonte original não localizada) | `scripts/fix-r2-coopereb-para-parceiro.ts:12` referencia |
| Modelo `nps_trimestral` (pergunta NPS 3 meses) | ⚠️ existe órfão | `seed-fluxo-padrao.ts:138-144` |
| Estado `NPS_RECEBIDO` | ❌ não existe | — |
| `agendarNps` (disparo automático pós-CONCLUIDO + 1h) | ⚠️ dead code | `whatsapp-bot.service.ts:3990-4011` |
| Módulo NestJS dedicado a NPS | ❌ não existe | `backend/src/**/nps*.ts` retornou vazio |
| Service / Controller NPS | ❌ não existe | — |
| Endpoint REST `/nps` | ❌ não existe | — |

---

## 5. Decisões de produto pro Luciano

### (1) Quando o NPS é disparado no Bloco 7?

| Opção | Como funciona | Prós | Contras | Custo |
|---|---|---|---|---|
| **(a) Só infra** | Bloco 7 ativa o fluxo dinâmico (gatilho wildcard + ação). Quem coloca a conversa em NPS_AGUARDANDO_NOTA fica pra sprint futuro (cron trimestral, trigger event). | Mais limpo. Entrega só o necessário. Disparo (decisão maior) fica pra sessão dedicada. | NPS ainda fica dormente — adiciona infra mas nenhum cooperado recebe pergunta. | 0h adicional |
| **(b) Reativar `agendarNps`** | Chamar `agendarNps(telefone, conversaId)` ao final do `handleAtendimento` ou no `finalizarConversa` quando estado é CONCLUIDO pós-cadastro novo. | Aproveita stub existente. Pergunta NPS após adesão concluída (momento natural). | `setTimeout` frágil (perdido em PM2 restart). Texto hardcoded "CoopereBR" não multi-tenant. Exige adaptação. | +1-1.5h |
| **(c) Trigger event-based** | Listener `cooperado.homologado` (já existe pra outro fluxo!) emite + cron processa NPS pendentes 24h depois. Robusto, persistente. | Robusto. Multi-tenant. Reusa padrão de listener já estabelecido. | Mais complexo. Escopo grande pra Bloco 7. | +2-3h |
| **(d) Cron trimestral** | Cron diário às 10:00 procura cooperados ATIVOS há ~3 meses sem NpsResposta, marca como NPS_AGUARDANDO_NOTA. Modelo `nps_trimestral` já existe no seed. | Captura todos os cooperados com janela natural. | Demora pra entrar em produção (precisa ter cooperado de 3 meses). Não testa fluxo no curto prazo. | +2-3h |
| **(e) Comando manual via bot** | Cooperado digita "NPS" (novo sinônimo) → entra em NPS_AGUARDANDO_NOTA. Útil pra QA. | Testável imediatamente. | Não é fluxo natural (cooperado real não vai digitar "NPS"). Pode virar comando "NPS" universal ou sub-opção de menu. | +0.5h |

**Recomendação:** **(a) só infra** pro Bloco 7. Mantém escopo enxuto (2-3h
estimados). Decisão de quando disparar fica pra sprint dedicado depois —
com 4 opções viáveis pra discutir com calma. **Opcional:** complementar com
**(e) comando manual** (adicional 0.5h) pra ter caminho de teste sem
esperar trigger natural.

Se Luciano preferir entregar fluxo end-to-end de NPS já no Bloco 7,
recomendo **(c) trigger event-based** — mais robusto que (b), reusa padrão
de listener já estabelecido em sessões anteriores.

### (2) Adicionar `cooperativaId` em `NpsResposta`?

| Opção | Como funciona | Prós | Contras |
|---|---|---|---|
| **SIM (recomendado)** | `npx prisma db push` adiciona campo opcional. Ação `REGISTRAR_NPS` popula `cooperativaId: conversa.cooperativaId ?? undefined`. | Multi-tenant correto. Permite relatórios de NPS por parceiro (essencial pós-Sinergia). Aditivo, zero risco. | +30min schema delta + 1 linha na ação. |
| **NÃO** | Mantém esquema atual sem cooperativaId. | Zero mudança schema. | Quebra regra dura do projeto (toda query Prisma filtra por cooperativaId). NPS de tenants diferentes fica num pool único. Vira débito catalogado. |

**Recomendação:** **SIM**. É um delta de 1 linha no schema + 1 linha na
ação. Custo desprezível e desbloqueia operação multi-tenant correta.

### (2.5) Adicionar `comentario` em `NpsResposta`?

| Opção | Como funciona | Prós | Contras |
|---|---|---|---|
| **SIM agora** | Schema delta inclui `comentario String?`. Bloco 7 NÃO usa (ação só persiste nota). Sprint futuro de NPS qualitativo aproveita. | Pré-paga sem custo extra. | Campo sem uso imediato (10 minutos de espera "ele vai usar?"). |
| **NÃO agora** | Schema fica como está. Futuro NPS qualitativo precisa schema delta nessa hora. | Foco no escopo do Bloco 7. | Duplica trabalho — toda vez que mexer em schema é overhead. |

**Recomendação:** **SIM agora.** Custo desprezível, desbloqueia sprint
futuro.

### (3) Estado pós-NPS: MENU_COOPERADO ou CONCLUIDO?

| Opção | Como funciona | Prós | Contras |
|---|---|---|---|
| **(X) MENU_COOPERADO** | Após registrar nota, ação transiciona pra `MENU_COOPERADO` (consistente com Blocos 4 e 1.b). | Padrão do sprint. Cooperado pode continuar conversa sem reabrir. | Quebra padrão do hardcoded atual (que vai pra CONCLUIDO). |
| **(Y) CONCLUIDO** | Mantém padrão do hardcoded `finalizarConversa`. Bot encerra sessão; cooperado precisa mandar nova mensagem pra falar de novo. | Consistente com hardcoded existente. NPS é cerimonial — fim da conversa. | Quebra padrão dos Blocos 4 e 1.b. Cooperado precisa reabrir conversa pra continuar. |

**Recomendação:** **(X) MENU_COOPERADO** se o NPS for disparado dentro de
um fluxo de autoatendimento (cooperado pode querer fazer mais coisas).
**(Y) CONCLUIDO** se for NPS pós-conclusão (após adesão / após resolução
de ticket — momento ritual de encerramento). Depende da decisão (1).

Como recomendamos (1)(a) "só infra", e o gatilho de teste virá via comando
manual (1)(e) durante autoatendimento, sugiro **(X) MENU_COOPERADO** —
consistente com sprint. Quando disparo virar trigger pós-conclusão, dá pra
reavaliar.

---

## 6. Proposta de desenho do Bloco 7

Assumindo decisões **(1)(a) só infra** + **(2) SIM cooperativaId** +
**(2.5) SIM comentario opcional** + **(3)(X) MENU_COOPERADO** (mais
simples, recomendação minha):

### 6.1 Schema (delta aditivo via `npx prisma db push`)

```prisma
model NpsResposta {
  id            String   @id @default(cuid())
  cooperadoId   String?
  cooperativaId String?  // NOVO — multi-tenant
  telefone      String
  nota          Int
  comentario    String?  // NOVO — texto qualitativo opcional (não usado no Bloco 7)
  canal         String   @default("WHATSAPP")
  createdAt     DateTime @default(now())

  @@map("nps_respostas")
}
```

### 6.2 Motor — ação `REGISTRAR_NPS` (padrão Bloco 4)

`whatsapp-fluxo-motor.service.ts:executarAcao()` ganha case
`REGISTRAR_NPS` apontando pra método privado `executarRegistrarNps`:

```typescript
private async executarRegistrarNps(
  conversa: { id, telefone, cooperadoId?, cooperativaId? },
  corpo: string,
): Promise<void> {
  // 1. Validar nota 0-10
  const nota = parseInt((corpo ?? '').trim(), 10);
  if (Number.isNaN(nota) || nota < 0 || nota > 10) {
    await this.sender.enviarMensagem(
      conversa.telefone,
      '⚠️ Por favor, digite um número de 0 a 10:',
    );
    return; // mantém em NPS_AGUARDANDO_NOTA — retry no fluxo
  }

  // 2. Persistir — sem guard de cooperadoId (NPS de lead anônimo OK)
  try {
    await this.prisma.npsResposta.create({
      data: {
        cooperadoId: conversa.cooperadoId ?? null,
        cooperativaId: conversa.cooperativaId ?? null,
        telefone: conversa.telefone,
        nota,
        canal: 'WHATSAPP',
      },
    });
  } catch (err) {
    this.logger.error(`REGISTRAR_NPS falhou: ${(err as Error).message}`);
    await this.sender.enviarMensagem(conversa.telefone, '⚠️ Não consegui registrar agora. Tente de novo em alguns minutos.');
    return;
  }

  // 3. Buscar modelo nps_recebido no banco e renderizar com vars (multi-tenant)
  const modelo = await this.prisma.modeloMensagem.findFirst({
    where: { nome: 'nps_recebido', ...this.filtroTenantSomenteLeitura(conversa.cooperativaId ?? undefined) },
  });
  if (modelo) {
    const cooperativa = await this.carregarContextoCooperativa(conversa.cooperativaId ?? undefined);
    const vars = this.extrairVariaveis(conversa, cooperativa);
    const texto = this.anexarRodape(this.renderizarTemplate(modelo.conteudo, vars));
    await this.sender.enviarMensagem(conversa.telefone, texto);
    await this.modeloMensagem.incrementarUso(modelo.id);
  } else {
    // Fallback hardcoded se modelo não está no banco do tenant
    await this.sender.enviarMensagem(conversa.telefone, 'Obrigado pelo feedback! 💚');
  }

  // 4. Transiciona pra MENU_COOPERADO (decisão 3 X)
  await this.prisma.conversaWhatsapp.update({
    where: { id: conversa.id },
    data: { estado: 'MENU_COOPERADO' },
  });
  this.logger.log(`REGISTRAR_NPS: cooperado ${conversa.cooperadoId ?? 'anonimo'} -> nota=${nota} (tenant=${conversa.cooperativaId ?? 'global'})`);
}
```

### 6.3 Banco — script idempotente novo

`backend/scripts/fix-bloco-7-nps-no-fluxo.ts` (padrão Bloco 4):

1. **Read-only check** — confirma que modelo `nps_recebido` existe + modelo
   `nps_aguardando_nota` existe (Bloco 2 / script anterior). Aborta com
   erro claro se faltar.
2. **UPDATE etapa `NPS_AGUARDANDO_NOTA`** existente (id `f-nps`):
   - `modeloMensagemId`: aponta pra `nps_aguardando_nota`
   - `gatilhos`: `[{ resposta: '*', proximoEstado: 'MENU_COOPERADO',
     acao: 'REGISTRAR_NPS' }]`
   - Mantém `ordem: 21` + `cooperativaId: null` (global)
   - Idempotente: skip se já alinhada.

**NÃO** cria etapa `NPS_RECEBIDO` — decisão 3(X): vai direto pra
MENU_COOPERADO. Estado `NPS_RECEBIDO` mencionado no prompt do Luciano é
descartado (mensagem de agradecimento é parte da própria ação, não etapa
separada).

### 6.4 Hardcoded — manter intacto

`handleNpsNota` em `whatsapp-bot.service.ts:4013-4034` fica como fallback
(o motor dinâmico chega ANTES, mas se etapa virar inativa por algum motivo,
o hardcoded ainda atende). Comportamento:

- Hoje: handleNpsNota → CONCLUIDO
- Motor dinâmico Bloco 7: action REGISTRAR_NPS → MENU_COOPERADO

São independentes. Hardcoded existente continua valendo se etapa dinâmica
desligar. **Pequeno débito latente:** comportamento ligeiramente divergente
entre hardcoded e dinâmico (CONCLUIDO vs MENU_COOPERADO). Não bloqueia
Bloco 7, fica catalogado pra Sprint Housekeeping.

### 6.5 Wildcard `*` com ação OU 11 gatilhos 0..10?

**Recomendação: gatilho wildcard `*`** (decisão estabelecida pela frase
comandante e confirmada na análise).

| Critério | Wildcard `*` + acao | 11 gatilhos |
|---|---|---|
| Gatilhos no banco | 1 | 11 |
| Retry inline pra texto inválido | ✅ ação valida + retry | ❌ "nenhum gatilho bateu" cai no fallback |
| Padrão consistente com Bloco 4 | ✅ | ❌ |
| Captura tentativas com palavra ("oito", "dez") | ⚠️ ação pode estender parseInt pra texto se quiser | ❌ só números literais |
| Complexidade do desenho | Baixa | Média |

Wildcard `*` ganha em todos os critérios. Implementação mais limpa.

### 6.6 Specs (TDD, padrão Blocos 4 + 1.b)

**`whatsapp-fluxo-motor.service.spec.ts`** — adicionar describe:

- `executarAcao(REGISTRAR_NPS)`:
  - Nota válida (0): persiste + envia modelo + transiciona MENU_COOPERADO
  - Nota válida (10): idem
  - Nota inválida ("doze"): erro + NÃO transiciona (retry)
  - Nota fora range (-1, 11): erro + NÃO transiciona
  - Texto não-numérico: erro + NÃO transiciona
  - Sem cooperadoId (lead): persiste mesmo assim (cooperadoId: null)
  - Multi-tenant: `cooperativaId` populado quando conversa tem
  - Multi-tenant ausente: `cooperativaId: null` (global / lead)
  - Modelo nps_recebido não encontrado: fallback hardcoded "Obrigado!"
  - Erro Prisma: mensagem genérica + NÃO transiciona

~10 specs novos.

---

## 7. Estimativa revisada

| Item | Custo |
|---|---|
| Schema delta (`cooperativaId` + `comentario`) + `npx prisma db push` + `prisma generate` | 0.5h |
| Ação `REGISTRAR_NPS` no motor (com modelo + multi-tenant + retry) | 1h |
| Script idempotente `fix-bloco-7-nps-no-fluxo.ts` + execução banco | 0.5h |
| Specs (~10 cenários TDD) | 1h |
| Build + suíte + smoke + PM2 restart + commit | 0.5h |
| **Total** | **3-3.5h** |

**A faixa 2-3h do plano confirma-se no piso baixo** se aceitar todas as
recomendações. **Sobe pra 3-3.5h** se incluir comentario (que recomendei
incluir — custo mínimo). Se Luciano preferir adiar cooperativaId/comentario
fica em ~2-2.5h.

Disparo via opção (b)/(c)/(d)/(e) adiciona tempo conforme tabela do §5.

---

## 8. Decisões pendentes consolidadas pro Luciano

Pra eu fechar a Fase 1 e poder começar Fase 2:

1. **Disparo do NPS no Bloco 7** — (a) só infra (recomendado) / (b)
   reativar `agendarNps` / (c) listener event-based / (d) cron trimestral /
   (e) comando manual "NPS" via bot. Pode combinar (a)+(e).

2. **`NpsResposta` ganha `cooperativaId`?** — SIM (recomendado) / NÃO.

3. **`NpsResposta` ganha `comentario` opcional?** — SIM agora (recomendado) /
   NÃO (deixar pra futuro).

4. **Estado pós-NPS** — (X) MENU_COOPERADO (recomendado se (1)=a) / (Y)
   CONCLUIDO.

5. **Wildcard `*` vs 11 gatilhos** — wildcard (recomendado por unanimidade
   dos critérios) / 11 gatilhos.

---

## 9. Diretrizes aplicadas nesta Fase 1

- ✅ **Decisão 23** — Fase 1 read-only OBRIGATÓRIA. Zero edits, zero builds.
- ✅ **Decisão 14** — grep amplo confirmou estado de NPS no projeto
  (model existente + handler + agendarNps dead code + modelo banco +
  modelo trimestral órfão). Sem catalogação cega.
- ✅ **Reuse** — desenho aproveita schema, modelos e padrões já
  estabelecidos. Novo código é apenas a ação no motor.
- ✅ **Sem suposições** — caveats sobre `agendarNps` dead code e modelo
  `nps_aguardando_nota` órfão do source vieram da investigação real.
- ✅ **NÃO trabalhar paralelo com claude.ai** — Code 100% direto.

---

## 10. Próximo passo

Aguardar OKs do Luciano nas 5 decisões do §8. Depois empacotar prompt da
Fase 2 (execução em 3 etapas TDD: schema + ação + script banco) e
implementar.
