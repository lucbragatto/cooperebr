# Fase 1 read-only — Sprint Bot Autoatendimento Bloco 1.b (ME CHAME DEPOIS)

Data: 22/05/2026
Autor: Code (Fase 1 read-only, Decisão 23)
Status: relatório de investigação — **nenhum arquivo editado, nenhum build, nada tocado**

---

## TL;DR (linguagem humana)

A contradição da frase do M19 ("exige job" vs "reusa job") tem resposta
limpa: **ME CHAME DEPOIS precisa de lógica de retorno agendado, mas não
precisa de tabela nova nem cron novo**. O `WhatsappConversaJob` que hoje
roda a cada hora pra limpar conversas inativas pode ganhar um método novo
que escaneia conversas em estado `AGENDADO_RETORNO` e dispara a mensagem
de volta. `ConversaWhatsapp.dadosTemp` (campo Json já existente) guarda
`retornarEm` + `estadoAnterior`. **Reusa infra + adiciona lógica nova.**

3 decisões de produto pra você bater o martelo (recomendação minha entre
parênteses): (1) quando é "depois" — **+24h fixo** vs perguntar vs próximo
dia útil — (recomendo +24h fixo pro MVP); (2) ao retornar, **volta pro
menu** vs retoma na etapa exata (recomendo menu — contexto de 24h+ já
esfriou); (3) **respeitar horário comercial 08:00-18:00** vs não (recomendo
respeitar — cooperado não quer mensagem às 3h da manhã).

**Estimativa confirmada na faixa 3-5h**, pendendo pra **4-5h** se as 3
recomendações forem aceitas (horário comercial adiciona ~0.5h).

---

## 1. Comandos universais do Bloco 1.a — como funcionam hoje

3 helpers principais em `whatsapp-fluxo-motor.service.ts`:

### 1.1 `detectarComandoUniversal(corpo)` (linha 168)

```typescript
detectarComandoUniversal(corpo: string): 'INICIO' | 'SAIR' | 'MENU' | null {
  if (!corpo) return null;
  const normalizado = corpo.trim().toUpperCase();

  const SINONIMOS_INICIO = ['INICIO', 'INÍCIO', 'COMECAR', 'COMEÇAR', 'MENU INICIAL'];
  const SINONIMOS_SAIR = ['SAIR', 'PARAR', 'ENCERRAR'];
  const SINONIMOS_MENU = ['MENU', 'VOLTAR'];

  if (SINONIMOS_INICIO.includes(normalizado)) return 'INICIO';
  if (SINONIMOS_SAIR.includes(normalizado)) return 'SAIR';
  if (SINONIMOS_MENU.includes(normalizado)) return 'MENU';
  return null;
}
```

Comparação por palavra exata isolada (uppercase). Lista de sinônimos por
comando.

### 1.2 `resolverEstadoComandoUniversal(comando, conversa)` (linha 188)

- `INICIO` → `'INICIAL'`
- `SAIR` → `null` (sinal especial — caminho diferente)
- `MENU` → `'MENU_COOPERADO'` se `cooperadoId` definido; senão `'INICIAL'`

### 1.3 `executarComandoUniversalReal(comando, msg, conversa)` (linha 204)

Padrão dos 3 comandos:

- **SAIR (linhas 218-229):** atualiza `estado: 'ENCERRADO'` + envia
  "Tchau! Quando quiser, é só me chamar de novo. 👋" + log. Estado terminal,
  sem transição posterior.
- **INICIO/MENU:** resolve estado-destino → atualiza `ConversaWhatsapp.estado`
  → renderiza modelo da etapa-destino (com rodapé) → dispara `acaoAutomatica`
  da etapa-destino se houver.

### 1.4 Onde ME CHAME DEPOIS entraria

- `detectarComandoUniversal` ganha 4º retorno `'CHAMAR_DEPOIS'` com sinônimos.
- `resolverEstadoComandoUniversal` ganha case `'CHAMAR_DEPOIS'` → retorna
  estado novo `'AGENDADO_RETORNO'` (a criar).
- `executarComandoUniversalReal` ganha case `'CHAMAR_DEPOIS'` parecido com
  SAIR (estado quase-terminal — só sai dele pelo cron de retorno), mas
  persiste `dadosTemp` com `retornarEm` + `estadoAnterior`.
- `executarComandoUniversalSimulado` (linha 1326) ganha case análogo pra UI
  do simulador.

### 1.5 Sinônimos propostos pro novo comando

```typescript
const SINONIMOS_CHAMAR_DEPOIS = [
  'ME CHAME DEPOIS',
  'CHAME DEPOIS',
  'DEPOIS',
  'ME LIGA DEPOIS',
  'VOLTAR DEPOIS',
  'OUTRA HORA',
  'MAIS TARDE',
];
```

(Lista pra você ajustar — cobre as variações naturais que cooperado tende
a digitar.)

---

## 2. Infra de reagendamento — a pergunta-chave

### 2.1 Já existe mecanismo de mensagem agendada futura?

**NÃO** — não existe mecanismo genérico de "envia mensagem X pra cooperado
Y na data Z". O que existe:

| Lugar | O que faz | Serve pro ME CHAME DEPOIS? |
|---|---|---|
| `whatsapp-conversa.job.ts` (`@Cron EVERY_HOUR`) | Reseta conversas em `AGUARDANDO_*` há 24h+ pra `INICIAL` | **Sim, como base** — mesma cadência horária; aproveitar adicionando método novo |
| `notificacoes-proativas.job.ts` (Bloco D, 17/05) | 3 crons fixos diários 08:00/10:00/11:00 pra lembretes contextuais (docs, EDP) | **Não** — são contextos específicos, não "agenda livre" |
| `cobrancas.job.ts` (2AM/3AM) | Geração de cobranças e envio agendado de notificações de vencimento | **Não** — escopo financeiro fixo |
| Schema `FluxoEtapa.timeoutHoras` + `modeloFollowupId` | Campos pra follow-up por timeout (cooperado parou de responder por X horas) | **Não** — os campos existem mas **NÃO HÁ JOB QUE OS LÊ E DISPARA**. Infra latente |
| `Notificacao` model (linha 737 schema) | Notificação interna genérica (tipo, título, mensagem, lida, link) | **Não** — não tem `scheduledAt`/`enviarEm`; é estrutura de UI |

### 2.2 Como o bot manda mensagens proativas hoje?

3 padrões:

1. **Crons contextuais com hora fixa diária** (notificações proativas Bloco
   D, lembretes de cobrança) — só servem pra casos que a hora é sempre a
   mesma.
2. **Eventos imediatos** disparados por mutação no banco
   (`cooperado-homologado.listener.ts` — quando cooperado vira HOMOLOGADO,
   envia WA + email na hora). Não é "agendado", é "no momento do evento".
3. **Sender direto** via `WhatsappSenderService.enviarMensagem(telefone,
   texto)` — método assíncrono independente de sessão. **Esta é a primitiva
   que o cron de retorno vai chamar.**

### 2.3 Existe entidade "contato pendente / a fazer"?

**NÃO existe tabela dedicada**, mas há `ConversaWhatsapp.dadosTemp` (Json)
que já é amplamente usado pra preservar contexto entre turnos (15 hits em
`whatsapp-bot.service.ts` mostram `{ ...dadosTempAntigo, novoCampo }`).
Esse campo pode armazenar `retornarEm: ISO date` + `estadoAnterior: string`
sem schema delta.

### 2.4 Conclusão objetiva da pergunta-chave

**ME CHAME DEPOIS precisa de mecanismo de retorno agendado, mas não precisa
de tabela nova nem cron novo.** Caminho mais leve:

- **Reusa** `WhatsappConversaJob` (já roda `EVERY_HOUR`) — adicionar método
  novo `processarRetornosAgendados()`.
- **Reusa** `ConversaWhatsapp.dadosTemp` Json — armazenar `retornarEm` +
  `estadoAnterior`.
- **Reusa** `WhatsappSenderService.enviarMensagem` — envio imediato.
- **Adiciona** estado novo `'AGENDADO_RETORNO'` (string — não há enum de
  estados; usa-se livremente). Etapa correspondente no banco **NÃO precisa**
  ser criada (estado terminal sem etapa dinâmica, o motor cai no fallback
  hardcoded que não tem case pra esse estado — comportamento neutro,
  cooperado fica "parado" até o cron).
- **Adiciona** lógica nova: 4º sinônimo de comando universal + branch no
  `executarComandoUniversalReal` + método novo no job.

**Resolução da contradição da frase do M19:** ambas as visões estavam
parcialmente certas. "Exige job de reagendamento" = sim, exige LÓGICA nova
de cron processar retornos. "Reusa job" = sim, reusa o
`WhatsappConversaJob` existente (não cria arquivo novo). A frase ficou
ambígua porque mistura "exige código novo" com "exige arquivo novo" — só
o primeiro é verdade.

---

## 3. Estado da conversa ao reagendar

### 3.1 `ConversaWhatsapp.dadosTemp` é a casa certa

Schema (linhas 1566-1579):

```prisma
model ConversaWhatsapp {
  id                  String    @id @default(cuid())
  telefone            String    @unique
  estado              String    @default("INICIAL")
  dadosTemp           Json?
  cooperativaId       String?
  cooperadoId         String?
  mlmConviteEnviadoEm DateTime?
  contadorFallback    Int       @default(0)
  updatedAt           DateTime  @updatedAt
  createdAt           DateTime  @default(now())
}
```

`dadosTemp` é Json opcional, sem schema fixo. Hoje carrega
`{indicadorId, indicadorNome, codigoIndicacao}` em uma etapa,
`{mediaBase64, mimeType}` em outra, `{faturaParaTerceiro, nomeTerceiro,
telefoneTerceiro}` em outra. Pode receber `{retornarEm: isoDate,
estadoAnterior: 'AGUARDANDO_FOTO_FATURA'}` sem incomodar os outros usos
(spread pattern).

### 3.2 Estado novo `AGENDADO_RETORNO`

Não exige nada no schema (campo `estado` é String livre). Não exige
`FluxoEtapa` ativa correspondente. Conversas nesse estado ficam paradas
até o cron processar.

**⚠️ Cuidado:** o `WhatsappConversaJob.resetarConversasInativas()` atual
reseta `estado: { startsWith: 'AGUARDANDO_' }` há 24h+. `AGENDADO_RETORNO`
NÃO começa com `AGUARDANDO_` — então não é afetado pelo reset hoje. Mas é
melhor adicionar guard explícito `WHERE estado NOT IN ('AGENDADO_RETORNO',
'ENCERRADO')` pra robustez (debt latente caso alguém futuro renomeie).

---

## 4. Decisões de produto pro Luciano

### (1) Quando é "depois"?

| Opção | Como funciona | Prós | Contras | Custo |
|---|---|---|---|---|
| **(A) +24h fixo** | Cooperado diz "ME CHAME DEPOIS" → bot agenda `retornarEm = agora + 24h` direto | Simples. Previsível. Zero sub-fluxo. Cron horário já existe. | Sem flexibilidade — cooperado pode querer "em 2h" ou "semana que vem". | 0h adicional |
| **(B) Perguntar ao cooperado** | Bot mostra sub-menu: "1 Em algumas horas (4h) / 2 Amanhã (24h) / 3 Próxima semana (7 dias) / 4 Outra hora — me diga quando" | UX customizada. Cooperado tem controle. | Sub-fluxo de 2 turnos a mais (criar 1 estado novo + 4 gatilhos). Pode complicar pra cooperado idoso. | +1-1.5h |
| **(C) Próximo dia útil 09:00** | Calcula próximo dia útil + força 09:00 | Educado, respeita rotina | Requer calendário de feriados (não temos) — só funciona pra "pular sábado/domingo" via `getDay()`. Cooperado de sexta à noite só recebe segunda. | +0.5h |

**Recomendação:** **(A) +24h fixo pro MVP.** Adicionar (B) como melhoria
depois se algum cooperado pedir. Cron horário já existente garante envio
em até 1h após o `retornarEm` (granularidade aceitável pro caso de uso).

### (2) Ao retornar, retoma de onde parou ou começa no menu?

| Opção | Como funciona | Prós | Contras |
|---|---|---|---|
| **(X) Retoma estado exato** | Lê `dadosTemp.estadoAnterior` → coloca a conversa nesse estado → renderiza modelo da etapa | Continuidade real. Cooperado não perde contexto. | Contexto de 24h+ provavelmente já esfriou na cabeça do cooperado ("o que era aquela pergunta mesmo?"). Mensagem do bot na volta seria genérica ("Voltei como combinado!") e a etapa-anterior pode confundir. |
| **(Y) Volta pro menu** | `cooperadoId? MENU_COOPERADO : INICIAL` — mesma resolução do comando `MENU` do Bloco 1.a | Simples. Cooperado vê o menu e escolhe de novo o que quer. | Perde continuidade narrativa em casos de fluxo longo (proxy, cadastro). |

**Recomendação:** **(Y) volta pro menu.** Após 24h+ a conversa "esfriou".
Cooperado provavelmente esqueceu o contexto exato — começar pelo menu é
mais limpo. Mensagem de retorno menciona o que estava sendo discutido
(opcional, lendo `estadoAnterior` apenas pra montar texto, mas estado
final fica no menu).

### (3) Respeitar horário comercial?

| Opção | Como funciona | Prós | Contras |
|---|---|---|---|
| **(M) Sim, 08:00-18:00** | Cron só processa retornos quando `Date.now()` cair no intervalo. Se `retornarEm` vence às 03:00, o retorno é entregue às 08:00 (próxima rodada do cron dentro do horário). | Educado. Cooperado não acorda com WhatsApp. Reduz risco de bot virar "spam noturno". | Latência média de retorno cresce de até 1h pra até 14h em casos extremos (cooperado pediu às 19h30). |
| **(N) Não, manda quando vencer** | Cron processa todo retorno vencido sem filtro de hora. | Latência mínima (até 1h pelo cron horário). | Mensagem pode chegar 03:30 quando cooperado dorme. |

**Recomendação:** **(M) respeitar 08:00-18:00.** Trade-off de latência é
aceitável e a UX é nitidamente melhor. Implementação simples — filtro no
método do cron:

```typescript
const hora = new Date().getHours();
if (hora < 8 || hora >= 18) return; // fora de horário comercial
```

---

## 5. Proposta de desenho do Bloco 1.b

Assumindo decisões **(A) +24h fixo + (Y) volta pro menu + (M) horário
comercial 08-18h** (mais simples, recomendação minha):

### 5.1 Motor (`whatsapp-fluxo-motor.service.ts`)

**5.1.1 `detectarComandoUniversal` ganha 4º retorno:**

```typescript
detectarComandoUniversal(corpo: string): 'INICIO' | 'SAIR' | 'MENU' | 'CHAMAR_DEPOIS' | null {
  if (!corpo) return null;
  const normalizado = corpo.trim().toUpperCase();

  const SINONIMOS_INICIO = ['INICIO', 'INÍCIO', 'COMECAR', 'COMEÇAR', 'MENU INICIAL'];
  const SINONIMOS_SAIR = ['SAIR', 'PARAR', 'ENCERRAR'];
  const SINONIMOS_MENU = ['MENU', 'VOLTAR'];
  const SINONIMOS_CHAMAR_DEPOIS = [
    'ME CHAME DEPOIS', 'CHAME DEPOIS', 'DEPOIS',
    'ME LIGA DEPOIS', 'VOLTAR DEPOIS', 'OUTRA HORA', 'MAIS TARDE',
  ];

  if (SINONIMOS_INICIO.includes(normalizado)) return 'INICIO';
  if (SINONIMOS_SAIR.includes(normalizado)) return 'SAIR';
  if (SINONIMOS_MENU.includes(normalizado)) return 'MENU';
  if (SINONIMOS_CHAMAR_DEPOIS.includes(normalizado)) return 'CHAMAR_DEPOIS';
  return null;
}
```

**5.1.2 `executarComandoUniversalReal` ganha case `CHAMAR_DEPOIS`** (padrão
similar ao SAIR — estado quase-terminal):

```typescript
if (comando === 'CHAMAR_DEPOIS') {
  const retornarEm = this.calcularRetornarEm(); // +24h ajustado pra horário comercial
  const dadosNovo = {
    ...(conversa.dadosTemp ?? {}),
    retornarEm: retornarEm.toISOString(),
    estadoAnterior: conversa.estado,
  };
  await this.prisma.conversaWhatsapp.update({
    where: { id: conversa.id },
    data: { estado: 'AGENDADO_RETORNO', dadosTemp: dadosNovo as Prisma.InputJsonValue },
  });
  await this.sender.enviarMensagem(
    msg.telefone,
    'Beleza! Volto a te chamar amanhã neste horário. 👋',
  );
  this.logger.log(
    `Comando universal CHAMAR_DEPOIS: conversa ${conversa.id} agendada pra ${retornarEm.toISOString()} ` +
    `(estado anterior: ${conversa.estado}, tenant: ${cooperativaId ?? 'global'})`,
  );
  return true;
}
```

**5.1.3 `executarComandoUniversalSimulado` ganha case análogo** (zero
side-effect — retorna `SimulacaoOutput` com `comandoUniversalAplicado:
'CHAMAR_DEPOIS'` + `estadoFinal: 'AGENDADO_RETORNO'` + `avisoTransicao`
explicativo).

**5.1.4 Helper privado novo `calcularRetornarEm()`:**

```typescript
private calcularRetornarEm(): Date {
  const agora = new Date();
  const retornarEm = new Date(agora.getTime() + 24 * 60 * 60 * 1000); // +24h
  // Decisão M: respeita horário comercial 08-18h.
  // Se cair fora, posterga pro proximo 08:00.
  const hora = retornarEm.getHours();
  if (hora < 8) retornarEm.setHours(8, 0, 0, 0);
  else if (hora >= 18) {
    retornarEm.setDate(retornarEm.getDate() + 1);
    retornarEm.setHours(8, 0, 0, 0);
  }
  return retornarEm;
}
```

### 5.2 Job (`whatsapp-conversa.job.ts`)

Adicionar método novo no mesmo arquivo (reusa cron horário):

```typescript
@Cron(CronExpression.EVERY_HOUR)
async processarRetornosAgendados() {
  // Decisão M: filtra horário comercial 08-18h.
  const hora = new Date().getHours();
  if (hora < 8 || hora >= 18) return;

  const agora = new Date();
  const conversas = await this.prisma.conversaWhatsapp.findMany({
    where: { estado: 'AGENDADO_RETORNO' },
  });

  let processadas = 0;
  for (const conversa of conversas) {
    const dados = (conversa.dadosTemp ?? {}) as Record<string, unknown>;
    const retornarEm = dados.retornarEm
      ? new Date(String(dados.retornarEm))
      : null;
    if (!retornarEm || retornarEm > agora) continue;

    // Decisao Y: volta pro menu (MENU_COOPERADO se cooperadoId; senao INICIAL).
    const proximoEstado = conversa.cooperadoId ? 'MENU_COOPERADO' : 'INICIAL';

    // Limpa retornarEm + estadoAnterior do dadosTemp mas preserva outros campos.
    const { retornarEm: _, estadoAnterior: __, ...dadosLimpo } = dados;

    await this.prisma.conversaWhatsapp.update({
      where: { id: conversa.id },
      data: {
        estado: proximoEstado,
        dadosTemp: dadosLimpo as Prisma.InputJsonValue,
      },
    });
    await this.sender.enviarMensagem(
      conversa.telefone,
      'Voltei como combinado. 👋 Em que posso ajudar agora?',
    );
    // Nota: o motor dinamico vai responder a proxima mensagem do cooperado.
    // Aqui so notifica + posiciona no menu. NAO renderiza modelo do menu
    // aqui pra evitar dependencia circular com o motor.
    processadas++;
    this.logger.log(
      `Retorno agendado processado: conversa ${conversa.id} -> ${proximoEstado} (estado anterior: ${dados.estadoAnterior ?? 'desconhecido'})`,
    );
  }
  if (processadas > 0) {
    this.logger.log(`${processadas} retorno(s) agendado(s) processado(s)`);
  }
}
```

⚠️ **Adicionar `WhatsappSenderService` ao constructor do `WhatsappConversaJob`**
(hoje só recebe `PrismaService`). Trivial.

### 5.3 Conversa Inativa job atual — guard de proteção

Ajustar `resetarConversasInativas()` pra excluir os estados `AGENDADO_RETORNO`
e `ENCERRADO`:

```typescript
const { count } = await this.prisma.conversaWhatsapp.updateMany({
  where: {
    estado: { startsWith: 'AGUARDANDO_' },
    estado: { notIn: ['AGENDADO_RETORNO', 'ENCERRADO'] }, // novo guard
    updatedAt: { lt: limite },
  },
  data: { estado: 'INICIAL', dadosTemp: undefined, contadorFallback: 0 },
});
```

(Na prática `startsWith: 'AGUARDANDO_'` já não captura `AGENDADO_RETORNO`,
mas o guard explícito documenta a intenção.)

### 5.4 Specs (TDD, padrão Bloco 1.a já consolidado)

**`whatsapp-fluxo-motor.service.spec.ts`** — adicionar describes:

- `detectarComandoUniversal` retorna `'CHAMAR_DEPOIS'` pra cada sinônimo
  (1 it por sinônimo + 1 negativo "não é comando").
- `executarComandoUniversalReal('CHAMAR_DEPOIS', ...)`:
  - Atualiza estado pra `AGENDADO_RETORNO`
  - dadosTemp ganha `retornarEm` (ISO) + `estadoAnterior`
  - Envia mensagem de confirmação
  - Multi-tenant: tenant preservado no log
- `executarComandoUniversalSimulado('CHAMAR_DEPOIS', ...)`:
  - `estadoFinal === 'AGENDADO_RETORNO'`
  - `comandoUniversalAplicado === 'CHAMAR_DEPOIS'`
  - zero side-effect (não chama `conversaUpdate` nem `enviarMensagem`)
- `calcularRetornarEm`:
  - Caso base: 14:00 hoje → 14:00 amanhã (dentro do horário)
  - Caso 1: 02:00 hoje → +24h cai em 02:00 amanhã → posterga pra 08:00 amanhã
  - Caso 2: 19:00 hoje → +24h cai em 19:00 amanhã → posterga pra 08:00 depois

**Novo spec `whatsapp-conversa.job.spec.ts`** — adicionar describes:

- `processarRetornosAgendados`:
  - Fora do horário comercial (hora < 8) → não consulta banco
  - Fora do horário comercial (hora >= 18) → idem
  - Dentro do horário, sem conversas em AGENDADO_RETORNO → no-op
  - Conversa com `retornarEm` no futuro → não processa
  - Conversa com `retornarEm` no passado, com cooperadoId → atualiza pra
    MENU_COOPERADO + envia mensagem
  - Conversa com `retornarEm` no passado, SEM cooperadoId → atualiza pra
    INICIAL + envia mensagem
  - dadosTemp pós-processamento NÃO contém mais `retornarEm` nem
    `estadoAnterior` mas preserva outros campos
- `resetarConversasInativas` (regressão):
  - Conversa AGENDADO_RETORNO há 48h NÃO é resetada
  - Conversa AGUARDANDO_* há 24h+ ainda é resetada (comportamento atual)

### 5.5 Seed / banco — nada a fazer

`AGENDADO_RETORNO` é um estado livre, **não precisa** de `FluxoEtapa`
correspondente no seed. Quando cooperado cair nesse estado, o motor
dinâmico não acha etapa ativa, cai no fallback hardcoded — mas o cooperado
**não vai mandar mensagem** nesse intervalo (acabou de despedir o bot).
O único "atendimento" desse estado é o cron mudando pra outro estado.

Se cooperado RESPONDER algo enquanto está em `AGENDADO_RETORNO` (caso
inesperado), cai no fallback → vai pro `handleMenuPrincipalInicio` do
hardcoded, que reseta pra INICIAL e responde algo. Comportamento aceitável
— cooperado essencialmente "cancelou" o agendamento ao reabrir conversa.

(Se você quiser tratamento mais fino, dá pra adicionar guard
`if (conversa.estado === 'AGENDADO_RETORNO') cancelarAgendamento(...)` no
hardcoded — mas é nuance. Sugiro deixar pra Sprint Housekeeping.)

---

## 6. Estimativa revisada

| Item | Custo |
|---|---|
| 4º comando universal no motor (`detectarComandoUniversal` + `resolverEstadoComandoUniversal` + 2 branches em `executarComandoUniversalReal`/`Simulado` + helper `calcularRetornarEm`) | 1-1.5h |
| Novo método `processarRetornosAgendados()` no `WhatsappConversaJob` + injeção do `WhatsappSenderService` | 1h |
| Guard de proteção em `resetarConversasInativas` | 0.2h |
| Specs do motor (~6-8 cenários novos) | 1h |
| Specs novo arquivo `whatsapp-conversa.job.spec.ts` (~6 cenários) | 1h |
| Build + validação manual (simular comando no `/dashboard/whatsapp-config`) | 0.5h |
| **Total** | **4-5h** |

**Confirma a faixa 3-5h da frase de retomada do M19**, pendendo pra
4-5h se as 3 recomendações forem aceitas. Se decidir **(N) sem horário
comercial**, cai pra ~3.5h.

---

## 7. Decisões pendentes consolidadas pro Luciano

Pra eu fechar a Fase 1 e poder começar Fase 2, preciso de OK em:

1. **Quando é "depois"?** — (A) +24h fixo / (B) sub-menu perguntando /
   (C) próximo dia útil. **Recomendação: (A)**.
2. **Ao retornar, retoma estado ou volta pro menu?** — (X) retoma /
   (Y) menu. **Recomendação: (Y)**.
3. **Respeitar horário comercial 08-18h?** — (M) sim / (N) não.
   **Recomendação: (M)**.

**Opcional (não bloqueia):** revisar a lista de sinônimos do comando
("MAIS TARDE" pode ser ambíguo — algumas pessoas usam isso em contexto
positivo "vou ver mais tarde" e não negativo "me chame depois"; talvez
remover).

---

## 8. Diretrizes aplicadas nesta Fase 1

- ✅ **Decisão 23** — Fase 1 read-only OBRIGATÓRIA. Zero edits, zero builds.
- ✅ **Decisão 14** — grep amplo confirmou que estado `AGENDADO_RETORNO`
  não existe hoje (livre).
- ✅ **Reuse** — desenho aproveita infra existente
  (`WhatsappConversaJob` + `dadosTemp` + `WhatsappSenderService`) ao invés
  de criar tabela/cron novos.
- ✅ **Sem suposições** — contradição da frase do M19 ("exige job" vs
  "reusa job") investigada e respondida com evidência (grep dos jobs +
  schema + cron).
- ✅ **NÃO trabalhar paralelo com claude.ai** — Code 100% direto.

---

## 9. Próximo passo

Aguardar OKs do Luciano nas 3 decisões do §7. Depois empacotar prompt da
Fase 2 (execução em 4 etapas TDD: motor + job + guard + specs) e
implementar.
