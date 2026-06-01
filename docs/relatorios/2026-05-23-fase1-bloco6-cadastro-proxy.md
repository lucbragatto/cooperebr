# Fase 1 read-only — Sprint Bot Autoatendimento Bloco 6 (Cadastro Proxy)

Data: 23/05/2026
Autor: Code (Fase 1 read-only, Decisão 23)
Status: relatório de investigação — **zero edits, zero builds, zero schema/banco**

---

## TL;DR (linguagem humana)

Mais peças prontas que Bloco 7 — quase tudo já existe e funciona no
**hardcoded**. O fluxo está completo ponta a ponta: entrada via "4 convidar"
no `MENU_PRINCIPAL`, sub-menu "1 enviar link / 2 cadastrar meu amigo",
3 perguntas (nome → telefone → fatura), OCR Claude AI síncrono, calculo
de proposta, confirmação, criação de Cooperado `PENDENTE_ASSINATURA` +
JWT 7 dias + link `/portal/assinar/{token}` enviado pro amigo.

**Achado-bomba:** o seed já antecipou nomenclatura das ações de motor —
`AGUARDANDO_FATURA_PROXY` tem `acaoAutomatica: 'PROCESSAR_OCR_PROXY'` e
`CONFIRMAR_PROXY` gatilho '1' tem `acao: 'CRIAR_COOPERADO_PROXY'`. Quem
escreveu o seed já planejou Bloco 6 dinâmico.

**CAVEAT ARQUITETURAL CRÍTICO** descoberto: o motor dinâmico hoje é
**text-only** — `executarAcao` recebe `(acao, conversa, _dados, corpo)`,
**NÃO recebe `mediaBase64`/`mimeType`**. Pra portar `AGUARDANDO_FATURA_PROXY`
(que precisa receber foto/PDF) pro motor, vai precisar adaptar o motor.
**Recomendação principal:** NÃO portar essa etapa específica — deixar no
hardcoded. Caminho dinâmico cobre NOME → TELEFONE → CONFIRMAR; o motor cai
no fallback hardcoded quando chega em `AGUARDANDO_FATURA_PROXY` (mídia).

3 decisões de produto pra você bater + 1 caveat técnico crítico.
Estimativa: **4-6h se NÃO portar OCR**; **7-10h se portar (motor
estendido)**.

---

## 1. Handler hardcoded — COMPLETO E FUNCIONAL

### 1.1 Entrada (`whatsapp-bot.service.ts:707-739`)

`handleMenuPrincipalInicio` opção "4 convidar" → se cooperado existe (busca
por telefone normalizado):
- Popula `dadosTemp` com `{ indicadorId, indicadorNome, cooperativaId, codigoIndicacao }`
- Gera `codigoIndicacao` 8 chars se ainda não existe
- Transiciona pra `MENU_CONVIDAR_AMIGO`
- Envia sub-menu: "1️⃣ Enviar meu link de indicação / 2️⃣ Cadastrar meu amigo (tenho a fatura dele)"

Se NÃO é cooperado: link genérico CoopereBR + reset conversa.

### 1.2 Sub-menu `handleMenuConvidarAmigo` (linhas 3204-3235)

- Corpo `'1'` → envia link `/entrar?ref={codigoIndicacao}` + reset conversa
- Corpo `'2'` → transiciona pra `CADASTRO_PROXY_NOME` + envia "Qual o *nome completo* do seu amigo?"
- Fallback genérico

### 1.3 `handleCadastroProxyNome` (3237-3255)

- Valida `corpo.length >= 3` (sem trim explícito — atenção)
- `dadosTemp.proxyNome = corpo` + transiciona pra `CADASTRO_PROXY_TELEFONE`
- Envia "Qual o celular de *{nome}*? (com DDD, ex: 27999991234)"

### 1.4 `handleCadastroProxyTelefone` (3257-3277)

- Valida dígitos 10-13 após `.replace(/\D/g, '')`
- **Prefixa "55" se não começar com "55"** (normaliza pra E.164 BR)
- `dadosTemp.proxyTelefone = ${55XXXXXX}` + transiciona pra `AGUARDANDO_FATURA_PROXY`
- Envia "Agora envie a foto ou PDF da conta de luz de *{nome}* 📎"

### 1.5 `handleAguardandoFaturaProxy` (3279-3368) — **CONTÉM OCR SÍNCRONO**

- Valida `tipo === 'imagem' || 'documento'` + `mediaBase64` + `mimeType in [pdf, jpeg, png, jpg]`
- Envia mensagem intermediária "Recebi! Analisando os dados... ⏳"
- **Chama síncrono:** `await this.faturasService.extrairOcr(mediaBase64, tipoArquivo)`
- Valida `consumoAtualKwh > 0` (rejeita se arquivo não é fatura)
- Calcula proposta via `motorProposta.calcular(...)` — pega primeiro plano ativo, monta historico, etc
- `dadosTemp.{...dadosExtraidos, resultado, economiaMensal, distribuidora, numeroUC}` + transiciona pra `CONFIRMAR_PROXY`
- Envia "*{nome}* economizaria *R$ X/mês* 🌞\n\nConfirma o cadastro?\n1️⃣ Sim, cadastrar\n2️⃣ Não por enquanto"

### 1.6 `handleConfirmarProxy` (3370-3453)

Corpo `'1'`/'sim':
- `prisma.cooperado.create` com:
  - `nomeCompleto: proxyNome`
  - `cpf: 'PROXY_${Date.now()}'` (placeholder único)
  - `email: 'proxy_${Date.now()}@pendente.cooperebr'` (placeholder único)
  - `telefone: proxyTelefone`
  - `status: 'PENDENTE_ASSINATURA'`
  - `cooperadoIndicadorId: indicadorId`
  - `cooperativaId: <do indicador>`
- Gera JWT `tokenAssinatura` 7 dias + persiste em `cooperado.tokenAssinatura`
- Envia mensagem pro AMIGO no telefone do proxy: "*{indicadorNome}* te cadastrou na *CoopereBR*! 🌞\n\nSua economia estimada é de *R$ X/mês*.\n\nPara confirmar, acesse:\n{baseUrl}/portal/assinar/{token}\n\nO link é válido por 7 dias."
- Notifica cooperado-indicador: "Pronto! Enviei o link para *{proxyNome}* confirmar."
- Reset conversa

Corpo `'2'`/'não': cancela + reset conversa.

⚠️ **NÃO cria `Indicacao` formal aqui** — apenas usa `cooperadoIndicadorId` no Cooperado. A `Indicacao` provavelmente é criada em outro lugar (futuro listener quando amigo paga primeira fatura → trigger comissão MLM).

⚠️ **NÃO cria `ConviteIndicacao`** — caminho diferente desse model.

⚠️ **DISPARA WHATSAPP REAL** pro telefone do proxy (linha 3426). Atenção:
contatos teste se for smoke real.

---

## 2. Etapas FluxoEtapa no banco — TODAS NO SEED, GATILHOS PARCIALMENTE PLANEJADOS

`seed-fluxos-bot.mjs:83-90`:

```javascript
// Proxy
{ id: 'f-proxy-nome', nome: 'Cadastro por Proxy — Nome do Amigo', ordem: 13, estado: 'CADASTRO_PROXY_NOME', gatilhos: [] },
{ id: 'f-proxy-tel', nome: 'Cadastro por Proxy — Telefone do Amigo', ordem: 14, estado: 'CADASTRO_PROXY_TELEFONE', gatilhos: [] },
{ id: 'f-proxy-fatura', nome: 'Cadastro por Proxy — Fatura do Amigo', ordem: 15, estado: 'AGUARDANDO_FATURA_PROXY', gatilhos: [], acaoAutomatica: 'PROCESSAR_OCR_PROXY' },
{ id: 'f-proxy-confirmar', nome: 'Cadastro por Proxy — Confirmar', ordem: 16, estado: 'CONFIRMAR_PROXY', gatilhos: [
  { resposta: '1', proximoEstado: 'CONCLUIDO', acao: 'CRIAR_COOPERADO_PROXY' },
  { resposta: '2', proximoEstado: 'CONCLUIDO' },
]},
```

**Mapeamento:**

| Etapa | Gatilhos | Acao no gatilho/etapa | Status |
|---|---|---|---|
| CADASTRO_PROXY_NOME | ⚠️ vazio | — | Órfã |
| CADASTRO_PROXY_TELEFONE | ⚠️ vazio | — | Órfã |
| AGUARDANDO_FATURA_PROXY | ⚠️ vazio | `acaoAutomatica: PROCESSAR_OCR_PROXY` | Órfã (gatilhos) mas acao automática planejada |
| CONFIRMAR_PROXY | ✅ 2 gatilhos | gatilho '1' tem `acao: CRIAR_COOPERADO_PROXY`; gatilho '2' sem acao | Parcialmente cabeada |

**Achado-bomba:** o seed já antecipou 2 nomes de ações:
- `PROCESSAR_OCR_PROXY` — pra disparar OCR ao entrar na etapa AGUARDANDO_FATURA_PROXY
- `CRIAR_COOPERADO_PROXY` — pra criar o Cooperado ao confirmar

⚠️ MAS o motor IGNORA `acaoAutomatica` quando `gatilhos: []` retornam vazio na avaliação. Ou seja: cooperado entra em AGUARDANDO_FATURA_PROXY, motor tenta processar mensagem, `avaliarGatilhos('', [])` retorna null → motor retorna `false` → cai no hardcoded.

Ou seja: **mesmo com `acaoAutomatica: PROCESSAR_OCR_PROXY` no seed, sem gatilho cabeado a ação não dispara hoje**. Caminho dinâmico atual não funciona ponta a ponta.

### 2.1 Modelos no banco (`seed-mensagens.ts:76-101`)

| Nome | Vars | Conteúdo |
|---|---|---|
| `proxy_pedindo_nome` | nenhuma | "Que bom que você quer trazer um amigo pra perto! 🤝\nQual o *nome completo* dele(a)?" |
| `proxy_pedindo_telefone` | nenhuma | "Anotado! E qual o *WhatsApp* do seu amigo? (com DDD — ex: 27 99999-9999)" |
| `proxy_pedindo_fatura` | nenhuma | "Perfeito! 📸 Agora me envie uma *foto* ou *PDF* da conta de luz dele(a) — assim já calculo quanto vai economizar." |
| `proxy_confirmar` | `{{titular}}`, `{{telefone}}` | "Confere os dados do seu indicado:\n👤 {{titular}}\n📱 {{telefone}}\n\n1️⃣ Tudo certo, pode cadastrar\n2️⃣ Corrigir" |

⚠️ **`proxy_confirmar` usa `{{titular}}` e `{{telefone}}`** — não `{{proxyNome}}` ou `{{proxyTelefone}}`. Nomes divergem do dadosTemp. Vou ter que mapear na ação:
- `titular` = `dadosTemp.proxyNome`
- `telefone` = `dadosTemp.proxyTelefone`

OU renomear o modelo (decisão de produto pequena).

### 2.2 Estado `MENU_CONVIDAR_AMIGO` no seed?

Buscando o estado MENU_CONVIDAR_AMIGO no seed — NÃO está listado nos snippets que vi. Verificar Fase 2 antes de implementar.

---

## 3. Schema de persistência

### 3.1 Cooperado novo (status: `PENDENTE_ASSINATURA`)

```typescript
prisma.cooperado.create({
  data: {
    nomeCompleto: proxyNome,
    cpf: `PROXY_${Date.now()}`,           // placeholder único
    email: `proxy_${Date.now()}@pendente.cooperebr`,  // placeholder único
    telefone: proxyTelefone,              // E.164 com prefixo 55
    status: 'PENDENTE_ASSINATURA',
    cooperadoIndicadorId: indicadorId,
    cooperativaId: <herda do indicador>,
  },
})
```

`StatusCooperado` enum tem `PENDENTE_ASSINATURA` (linha 235) — match perfeito.

**Multi-tenant:** `cooperativaId` herda do indicador via `dadosTemp.cooperativaId` (que foi populado no MENU_PRINCIPAL '4'). ✅

**Token JWT:** gerado depois via `prisma.cooperado.update` com `tokenAssinatura` + `tokenAssinaturaExp` (7 dias).

⚠️ **CPF/email são placeholders únicos** (`PROXY_${ts}` / `proxy_${ts}@pendente.cooperebr`). Funciona porque `cpf` e `email` são `@unique` — placeholder único evita colisão. Mas é gambiarra:
- O cooperado novo nunca terá CPF/email reais até **assinar via link**. Em `/portal/assinar/{token}` deve haver lógica que pede os dados reais e atualiza.
- Há débito potencial: se cooperado real NUNCA assinar, fica registro com placeholder pra sempre. Pode encher tabela com dados de teste. Cleanup futuro?

### 3.2 `Indicacao` model (schema.prisma:1526-1543)

```prisma
model Indicacao {
  id, cooperativaId, cooperadoIndicadorId, cooperadoIndicadoId,
  nivel Int @default(1),
  status String @default("PENDENTE") // PENDENTE | PRIMEIRA_FATURA_PAGA | CANCELADO,
  primeiraFaturaPagaEm DateTime?, beneficios BeneficioIndicacao[],
  conviteOrigem ConviteIndicacao?, membroConvenio ConvenioCooperado?
}
```

**Hardcoded NÃO cria Indicacao no momento do proxy.** Provavelmente Indicacao é criada em listener separado quando:
- amigo confirma assinatura via portal (Cooperado vira ATIVO)
- amigo paga primeira fatura (status → PRIMEIRA_FATURA_PAGA + dispara benefício/comissão)

Pra Bloco 6 dinâmico, recomendação: **replicar comportamento hardcoded** — NÃO criar Indicacao aqui. Manter o fluxo MLM no listener próprio (que já deve existir e é responsabilidade de outro sprint).

### 3.3 `LeadWhatsapp` model (schema.prisma:1934-1948)

Existe mas NÃO é usado pelo proxy. Cria-se direto como Cooperado. **Sem mudança no fluxo.**

### 3.4 `ConviteIndicacao` model (schema.prisma:2046+)

Existe pra fluxo separado (envio de link de convite). NÃO é usado pelo proxy hardcoded.

---

## 4. Fluxo OCR

### 4.1 API atual

`FaturasService.extrairOcr(arquivoBase64: string, tipoArquivo: 'pdf' | 'imagem'): Promise<DadosExtraidos>` em `faturas.service.ts:406-408` (wrapper de `extrairDadosFatura`).

**Síncrono** (Promise resolvida quando OCR completa). Chamado direto no handler hardcoded sem fila/queue.

### 4.2 Tempo

Claude AI multimodal — provável 5-30s dependendo da qualidade da imagem e tamanho do PDF. Hardcoded já manda mensagem intermediária "Aguarde um momento. ⏳" pra cobrir a UX.

Pra UX do bot: 10-30s é aceitável se mensagem intermediária explica que está processando. WhatsApp não tem timeout no app — cooperado fica vendo "..." pode causar ansiedade mas funciona.

### 4.3 ⚠️ CAVEAT ARQUITETURAL CRÍTICO — Motor dinâmico é text-only

`processarComFluxoDinamico` (motor) recebe `MensagemRecebida { telefone, tipo, corpo, mediaBase64, mimeType }`. MAS:

- **`avaliarGatilhos(corpo, gatilhos)` só casa `corpo` (texto).** Quando cooperado envia mídia, `corpo` é vazio/legenda. Gatilho wildcard `*` casaria corpo vazio? Olhando o código de `avaliarGatilhoMatch`: `corpoUpper.length > 0` é a condição. **Não casa mídia sem legenda.**

- **`executarAcao(acao, conversa, _dados, corpo)` NÃO recebe `mediaBase64`/`mimeType`.** Ação não tem acesso à mídia que cooperado enviou.

**Implicação:** pra portar `AGUARDANDO_FATURA_PROXY` pro motor, preciso de:

**Opção 4.A:** estender o motor.
- `processarComFluxoDinamico` detecta `msg.tipo in ['imagem','documento']` ANTES de avaliarGatilhos → trata como caso especial.
- `executarAcao` ganha 5º parâmetro `media?: { base64, mimeType }` ou recebe `msg` inteira.
- Etapas pode ter campo "aceitaMidia: boolean" pra discriminar.
- Custo: ~2-3h de motor + specs novos cobertos pela mudança.

**Opção 4.B:** NÃO portar `AGUARDANDO_FATURA_PROXY` pro motor.
- Motor cobre só NOME → TELEFONE → CONFIRMAR (etapas text-only).
- Cooperado em `AGUARDANDO_FATURA_PROXY` envia mídia → motor `avaliarGatilhos` retorna null (sem gatilho) → motor retorna `false` (não tratou) → bot.service cai no fallback hardcoded → `handleAguardandoFaturaProxy` faz OCR.
- Custo: 0h adicional no motor.
- **Tradeoff:** 1 etapa fica fora do motor dinâmico (não admin-editável). 3 das 4 etapas no motor + 1 hardcoded. Pode catalogar como débito ("OCR no fluxo dinâmico" → resolver quando outro fluxo precisar de mídia, ex: cadastro inicial fatura).

**Recomendação:** **Opção 4.B** pro Bloco 6. Pragmático. Mantém escopo enxuto. Quando outro caso de uso pedir mídia no dinâmico, paga-se a mudança arquitetural.

---

## 5. Vínculo indicador → indicado

### 5.1 Hoje (hardcoded)

- `Cooperado.cooperadoIndicadorId` populado no momento do cadastro proxy.
- Cooperado-indicador notificado via mensagem WhatsApp ("Enviei o link para *{proxyNome}*").
- **`Indicacao` formal NÃO criada** aqui — provavelmente vem depois (assinatura/primeira fatura).

### 5.2 Lógica MLM/comissão

Não foi investigada nesta Fase 1 (escopo Bloco 6 não exige). Provável fluxo:
- Listener `cooperado.ativado` (quando vira ATIVO) → cria Indicacao com status PENDENTE.
- Listener `cobranca.paga.primeira` → atualiza Indicacao.status = PRIMEIRA_FATURA_PAGA → dispara `BeneficioIndicacao` (registra comissão).

**Recomendação Bloco 6:** NÃO mexer aqui. Replicar comportamento hardcoded (só popular `cooperadoIndicadorId`). Sprint dedicado MLM trata o resto.

### 5.3 Decisão de produto

Pergunta pra Luciano: você quer manter esse padrão (criar Indicacao só no listener de "amigo virou ATIVO" / "primeira fatura paga") ou criar Indicacao com status PENDENTE no momento do cadastro proxy?

**Recomendação:** manter padrão atual (não criar). Reduz acoplamento entre fluxo do bot e MLM.

---

## 6. Mapa do que JÁ EXISTE vs falta cabear

| Item | Hardcoded | Motor dinâmico | Falta |
|---|---|---|---|
| Entrada via MENU_PRINCIPAL "4 convidar" | ✅ | ❓ (verificar se MENU_CONVIDAR_AMIGO está no seed dinâmico) | Confirmar Fase 2 |
| Sub-menu "1 link / 2 cadastrar" | ✅ `handleMenuConvidarAmigo` | — | Decidir se porta também (não está no escopo) |
| Etapa CADASTRO_PROXY_NOME | ✅ handler | ⚠️ etapa órfã | Gatilho wildcard + ação `SALVAR_PROXY_NOME` |
| Etapa CADASTRO_PROXY_TELEFONE | ✅ handler | ⚠️ etapa órfã | Gatilho wildcard + ação `SALVAR_PROXY_TELEFONE` |
| Etapa AGUARDANDO_FATURA_PROXY (OCR) | ✅ handler síncrono | ⚠️ etapa órfã (acao `PROCESSAR_OCR_PROXY` no seed mas inativa) | Decisão produto: opção 4.A (portar) ou 4.B (não portar) |
| Etapa CONFIRMAR_PROXY | ✅ handler | ✅ 2 gatilhos no seed; gatilho '1' tem acao `CRIAR_COOPERADO_PROXY` | Implementar ação `CRIAR_COOPERADO_PROXY` no motor |
| Modelo proxy_pedindo_nome | — | ✅ no banco | Cabear modeloMensagemId em CADASTRO_PROXY_NOME |
| Modelo proxy_pedindo_telefone | — | ✅ no banco | Cabear modeloMensagemId em CADASTRO_PROXY_TELEFONE |
| Modelo proxy_pedindo_fatura | — | ✅ no banco | Cabear modeloMensagemId em AGUARDANDO_FATURA_PROXY |
| Modelo proxy_confirmar (com vars `{{titular}}`/`{{telefone}}`) | — | ✅ no banco | Cabear em CONFIRMAR_PROXY + ação renderiza vars |
| Cooperado.create PENDENTE_ASSINATURA + cooperadoIndicadorId | ✅ | — | Reusar lógica do hardcoded na ação `CRIAR_COOPERADO_PROXY` |
| JWT tokenAssinatura + link `/portal/assinar/{token}` | ✅ | — | Reusar lógica |
| Mensagem pro AMIGO (proxy) | ✅ disparo real WA | — | Reusar lógica (atenção contatos teste em smoke) |
| Indicacao model (formal MLM) | ❌ não criada | ❌ não criar | Padrão preservado: vem em listener de assinatura/pagamento (sprint dedicado MLM) |

---

## 7. Decisões de produto pro Luciano

### (1) Portar `AGUARDANDO_FATURA_PROXY` pro motor dinâmico?

| Opção | Como funciona | Prós | Contras | Custo |
|---|---|---|---|---|
| **(A) Portar (motor estendido)** | `processarComFluxoDinamico` detecta mídia, `executarAcao` recebe `media` no 5º param, etapa AGUARDANDO_FATURA_PROXY ganha gatilho aceita-mídia + ação `PROCESSAR_OCR_PROXY` | Fluxo 100% dinâmico (admin pode editar modelo da pergunta). Pré-paga outros casos de mídia (cadastro de fatura, comprovante de pagamento). Padrão arquitetural mais correto. | Mudança no motor é estrutural (afeta avaliarGatilhos + executarAcao). Specs novos precisam cobrir mídia. Risco regressão. | +2-3h |
| **(B) NÃO portar — fica no hardcoded** | Motor cobre 3 etapas (NOME, TELEFONE, CONFIRMAR). AGUARDANDO_FATURA_PROXY cai no fallback hardcoded automaticamente (motor retorna false quando avaliarGatilhos retorna null). | Escopo mínimo. Zero risco de regressão arquitetural. Padrão Bloco 4/7. Hardcoded já funciona. | 1 etapa fora do motor dinâmico (admin não edita pelo painel). Catalogar débito "OCR no motor dinâmico". | 0h adicional |

**Recomendação:** **(B) NÃO portar.** Pragmático. Resolve o Bloco 6 sem
mexer em arquitetura do motor. Catalogar débito **D-novo-Z** "OCR/mídia no
motor dinâmico" pra Sprint Housekeeping ou sprint futuro de Iniciativa
Fluxos Customizáveis (D-novo-T).

### (2) `Indicacao` model criar agora ou só no listener futuro?

| Opção | Como funciona | Prós | Contras |
|---|---|---|---|
| **(a) NÃO criar Indicacao** (recomendado) | Ação `CRIAR_COOPERADO_PROXY` só cria Cooperado com `cooperadoIndicadorId`. Indicacao formal vem depois (listener de ATIVO ou PRIMEIRA_FATURA_PAGA). | Replica hardcoded — não inventa padrão novo. Mantém responsabilidade do MLM no listener próprio. | Bloco 6 não fecha o vínculo MLM ainda. Mas isso já é assim hoje. |
| **(b) Criar Indicacao com status PENDENTE** | Ação cria Cooperado E Indicacao (status PENDENTE). Listener depois atualiza status. | Vínculo registrado desde o cadastro. Auditoria mais clara. | Quebra padrão hardcoded. Pode duplicar lógica se listener também criar. Risco de inconsistência. |

**Recomendação:** **(a)** — não mexer no MLM agora.

### (3) Modelo `proxy_confirmar` usa `{{titular}}` e `{{telefone}}`. Adapta nome dos campos no dadosTemp?

| Opção | Como funciona |
|---|---|
| **(i) Mapear na ação** (recomendado) | Ação lê `dadosTemp.proxyNome` e renderiza como `{{titular}}`; lê `dadosTemp.proxyTelefone` e renderiza como `{{telefone}}`. Modelo no banco fica intacto. |
| **(ii) Renomear modelo** | Atualizar conteúdo do modelo no banco pra usar `{{proxyNome}}` e `{{proxyTelefone}}`. Conserva semântica interna. |

**Recomendação:** **(i)** — modelo no banco é texto pra cooperado ler
("titular" é mais natural que "proxyNome"). Mapeamento fica na ação.

---

## 8. Proposta de desenho do Bloco 6 (assumindo recomendações)

**Decisões aceitas:**
- (1B) NÃO portar `AGUARDANDO_FATURA_PROXY` (fallback hardcoded)
- (2a) NÃO criar Indicacao
- (3i) Mapear `{{titular}}`/`{{telefone}}` na ação

### 8.1 Schema — sem mudança

`StatusCooperado.PENDENTE_ASSINATURA` já existe. Sem delta de schema.

### 8.2 Motor (`whatsapp-fluxo-motor.service.ts`)

**3 ações novas no switch `executarAcao`:**

- `SALVAR_PROXY_NOME` (Etapa CADASTRO_PROXY_NOME): valida `corpo.trim().length >= 3` (espelha hardcoded), persiste `dadosTemp.proxyNome = corpo.trim()`, motor transiciona pra próximo estado conforme gatilho. Retry inline se inválido.
- `SALVAR_PROXY_TELEFONE` (Etapa CADASTRO_PROXY_TELEFONE): valida dígitos 10-13, prefixa "55" se faltar, persiste `dadosTemp.proxyTelefone`, transiciona.
- `CRIAR_COOPERADO_PROXY` (Etapa CONFIRMAR_PROXY, gatilho '1'): cria Cooperado PENDENTE_ASSINATURA + cooperadoIndicadorId + tokenAssinatura JWT 7 dias + envia mensagem pro AMIGO + notifica indicador. Reusa lógica do hardcoded.

Padrão Bloco 4 — guard cooperadoId (mas aqui o cooperado **é o indicador**, sempre presente porque já no menu cooperado; dadosTemp.indicadorId obrigatório), try/catch defensivo, mensagens hardcoded curtas, transição.

### 8.3 Banco — script idempotente

`backend/scripts/fix-bloco-6-cadastro-proxy.ts` (padrão Blocos 4/7):

1. **Read-only check** — confirma os 4 modelos `proxy_*` no banco.
2. **UPDATE 3 etapas FluxoEtapa** (CADASTRO_PROXY_NOME, _TELEFONE, _FATURA, _CONFIRMAR):
   - `CADASTRO_PROXY_NOME` (f-proxy-nome): `modeloMensagemId: proxy_pedindo_nome` + gatilho `{ resposta: '*', proximoEstado: 'CADASTRO_PROXY_TELEFONE', acao: 'SALVAR_PROXY_NOME' }`.
   - `CADASTRO_PROXY_TELEFONE` (f-proxy-tel): `modeloMensagemId: proxy_pedindo_telefone` + gatilho `{ resposta: '*', proximoEstado: 'AGUARDANDO_FATURA_PROXY', acao: 'SALVAR_PROXY_TELEFONE' }`.
   - `AGUARDANDO_FATURA_PROXY` (f-proxy-fatura): `modeloMensagemId: proxy_pedindo_fatura` + **NÃO cabear gatilhos** (decisão 1B — cooperado envia mídia que cai no fallback hardcoded automaticamente). Remover `acaoAutomatica: 'PROCESSAR_OCR_PROXY'` do seed (sai do dynamic flow).
   - `CONFIRMAR_PROXY` (f-proxy-confirmar): `modeloMensagemId: proxy_confirmar` + gatilhos já no seed (gatilho '1' com acao `CRIAR_COOPERADO_PROXY`).
3. **Idempotente** (skip se já alinhada).

### 8.4 Hardcoded — manter intacto

`handleCadastroProxy*` em `whatsapp-bot.service.ts` ficam como fallback.
Motor cobre o caminho dinâmico; hardcoded cobre fallback (incluindo
AGUARDANDO_FATURA_PROXY).

⚠️ **Cuidado debt latente:** quando cooperado entra dinâmico em CADASTRO_PROXY_NOME mas o dadosTemp NÃO TEM `indicadorId/Nome/cooperativaId/codigoIndicacao` populado (porque MENU_CONVIDAR_AMIGO não está cabeado no dinâmico), a ação `CRIAR_COOPERADO_PROXY` vai falhar. **Solução pragmática:** o cooperado entra via MENU_PRINCIPAL "4 convidar" no hardcoded (linha 707), que JÁ popula dadosTemp. Quando transiciona pra MENU_CONVIDAR_AMIGO e depois CADASTRO_PROXY_NOME, dadosTemp persiste. Caminho dinâmico assume herança. Validar Fase 2: testar com mock que dadosTemp tem os 4 campos.

### 8.5 Hardcoded handleAguardandoFaturaProxy — ajuste necessário?

Quando cooperado entra dinâmico, transiciona pra AGUARDANDO_FATURA_PROXY,
envia foto → cai no fallback hardcoded `handleAguardandoFaturaProxy` (já
existe, OK). Ele faz OCR + cálculo + transiciona pra CONFIRMAR_PROXY.

Em CONFIRMAR_PROXY o motor dinâmico AGORA cobre (etapa ativa com gatilhos
'1' e '2'). Cooperado digita '1' → motor dispara `CRIAR_COOPERADO_PROXY`.

**Funciona end-to-end:** hardcoded NOME → dinâmico NOME → hardcoded
TELEFONE → dinâmico TELEFONE → hardcoded FATURA (OCR) → dinâmico
CONFIRMAR. Vai e volta entre os 2 caminhos. **Não ideal pra elegância,
mas funcional.**

⚠️ **Risco:** se motor dinâmico não casa transição (ex: cooperado digita
nome com 2 chars), motor avaliarGatilhos retorna null (wildcard exige
length > 0 mas avaliação ocorre depois da ação valida length 3). Confirma
no smoke se UX é boa.

### 8.6 Specs TDD (~15-20 cenários novos)

`whatsapp-fluxo-motor.service.spec.ts` ganha describe pra cada ação:

**`executarAcao(SALVAR_PROXY_NOME)`** — 4-5 cenários:
- Nome válido: persiste dadosTemp + retorna sem erro
- Nome < 3 chars: erro inline + NÃO transiciona (retry)
- Nome com espaços: trim aplica
- Sem dadosTemp anterior: dadosTemp criado com proxyNome

**`executarAcao(SALVAR_PROXY_TELEFONE)`** — 5-6 cenários:
- 11 dígitos brasileiros: persiste com prefixo 55
- 13 dígitos com 55: persiste como está
- Texto não-numérico (só letras): erro + retry
- Length < 10 ou > 13: erro + retry
- Espaços e símbolos: replace /\D/g

**`executarAcao(CRIAR_COOPERADO_PROXY)`** — 6-8 cenários:
- Caminho feliz: cria Cooperado PENDENTE_ASSINATURA + token + envia mensagem amigo + notifica indicador
- Sem dadosTemp.indicadorId: erro + mensagem amigável
- Sem dadosTemp.proxyNome ou proxyTelefone: erro
- Erro Prisma (P2002 cpf placeholder duplicado? improvável): mensagem genérica
- Erro envio WA pro amigo: log warn mas notifica indicador mesmo assim
- Multi-tenant: cooperativaId herdada do indicador (dadosTemp)

### 8.7 Comando manual de teste — opcional

Pra testar sem precisar entrar via "4 convidar" no MENU_PRINCIPAL, pode-se
adicionar gatilho `'PROXY'` no MENU_COOPERADO que transiciona pra
MENU_CONVIDAR_AMIGO. **Mas isso só funciona se MENU_CONVIDAR_AMIGO tiver
gatilhos cabeados no dinâmico (verificar Fase 2)**.

Alternativa: smoke real via WhatsApp normal — Luciano digita "4 convidar"
no menu principal e flui normal (com contato teste 27981341348).

---

## 9. Estimativa revisada

| Item | Custo |
|---|---|
| 3 ações novas no motor (SALVAR_PROXY_NOME, SALVAR_PROXY_TELEFONE, CRIAR_COOPERADO_PROXY) | 2.5-3h |
| Mapeamento `{{titular}}`/`{{telefone}}` em CRIAR_COOPERADO_PROXY (renderizar modelo) | 0.5h |
| Lógica de JWT + envio WA amigo + notificação indicador (reusar hardcoded) | 1h |
| Script idempotente cabea 4 etapas + ajusta seed | 0.5h |
| Specs TDD (~15-20 cenários) | 1.5-2h |
| Build + ritual PM2 + smoke | 0.5h |
| Catalogação débito D-novo-Z (OCR/mídia no motor — se 1B aceito) | 0.2h |
| **Total** | **6-7.7h** |

**Confirma faixa 6-8h** assumindo decisão (1B). **Sobe pra 8-10.7h se (1A)** — portar OCR pro motor.

---

## 10. Decisões pendentes consolidadas pro Luciano

Pra eu fechar a Fase 1 e empacotar a Fase 2:

1. **Portar `AGUARDANDO_FATURA_PROXY` pro motor dinâmico?** — (A) sim
   (estender motor +2-3h) / **(B) não, fallback hardcoded** (recomendado).
2. **`Indicacao` formal criada no Bloco 6?** — **(a) não, só Cooperado.cooperadoIndicadorId** (recomendado) / (b) sim, com status PENDENTE.
3. **Modelo `proxy_confirmar` vars** — **(i) mapear na ação** (recomendado) / (ii) renomear modelo.

**Opcional (não bloqueia):**
- Smoke real com contato teste 27981341348? (Se SIM: ação envia WA real
  pro amigo — precisa garantir contato teste mesmo no fluxo proxy.)
- Adicionar gatilho `'PROXY'` no MENU_COOPERADO pra teste fácil? (Análogo
  ao `AVALIAR` do Bloco 7 — caminho mais leve.)

---

## 11. Diretrizes aplicadas nesta Fase 1

- ✅ **Decisão 23** — Fase 1 read-only OBRIGATÓRIA. Zero edits, zero builds.
- ✅ **Decisão 14** — grep amplo confirmou: 4 handlers hardcoded + 4 etapas
  no seed + 4 modelos no banco + acoes `PROCESSAR_OCR_PROXY` e
  `CRIAR_COOPERADO_PROXY` já no seed mas inativas.
- ✅ **Reuse** — desenho aproveita schema (sem delta), modelos do banco,
  handler hardcoded como fallback, padrão Bloco 4/7 (ação privada + guard
  + validação + persistência multi-tenant + retry inline).
- ✅ **Sem suposições** — caveat arquitetural do motor text-only
  descoberto na investigação, não assumido.
- ✅ **NÃO trabalhar paralelo com claude.ai** — Code 100% direto.

---

## 12. Próximo passo

Aguardar OKs do Luciano nas 3 decisões do §10. Depois empacotar prompt da
Fase 2 (execução em 4 etapas TDD: 3 ações no motor + script idempotente +
specs + smoke) e implementar.
