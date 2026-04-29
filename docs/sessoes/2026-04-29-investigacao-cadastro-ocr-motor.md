# Investigação consolidada: Cadastro + OCR + Motor — 2026-04-29

> Read-only. Alimenta Camadas 3, 5, 9 do PRODUTO.md (Doc-0 Fatia 2).
> Princípio: código é a verdade. Onde docs antigos divergem, código vence.

---

## 1. Rotas públicas de cadastro

**10 páginas públicas** em `web/app/` (fora de `/dashboard`, `/portal`, `/parceiro`, `/proprietario`, `/agregador`):

| Rota | Tipo | Cria Cooperado? | Endpoint backend principal | Query params | Upload fatura? |
|---|---|---|---|---|---|
| `/cadastro` | **(A)** Cria Cooperado | **Sim** (se `CADASTRO_V2_ATIVO=true` — já está em dev) | `POST /publico/cadastro-web` | `?ref=<código>` `?tenant=<cooperativaId>` | **Sim** — `POST /publico/processar-fatura-ocr` |
| `/entrar` | **(A')** Funil — captura lead, NÃO cria Cooperado | Não cria diretamente | `POST /publico/iniciar-cadastro` | `?ref=<código>` | Não |
| `/convite/[codigo]` | **(A'')** Funil idem `/entrar`, mas com nome do indicador | Não cria diretamente | `POST /publico/iniciar-cadastro` (codigoRef do path) | path param `codigo` | Não |
| `/aprovar-proposta` | **(B)** Continuação | Não — atualiza proposta existente | `GET /motor-proposta/proposta-por-token/:token` + `POST /motor-proposta/aprovar` | `?token=<tokenAprovacao>` | Não |
| `/assinar` | **(B)** Continuação | Não — atualiza proposta existente | `GET /motor-proposta/documento-por-token/:token` + `POST /motor-proposta/assinar` | `?token=<tokenAssinatura>` | Não |
| `/login` | **(C)** Login | — | `POST /auth/login` (via `lib/auth`) | — | Não |
| `/esqueci-senha` | **(C)** Reset | — | `POST /auth/verificar-canal` + `/auth/esqueci-senha[-whatsapp]` | — | Não |
| `/redefinir-senha` | **(C)** Reset | — | `POST /auth/redefinir-senha` | `?token=<reset>` | Não |
| `/selecionar-contexto` | **(D)** Multi-papel | — (precisa estar logado) | `GET /auth/me` | — | Não |
| `/` (landing) | **(D)** Marketing | — | — | — | Não |

### Resposta à pergunta de Luciano

> **A "outra rota de cadastro além de `/cadastro`" é `/entrar`.**
> Junto com `/convite/[codigo]`, formam o **trio de captura de lead pelo WhatsApp**:
>
> - `/entrar` — formulário simples (nome + telefone) → dispara `iniciar-cadastro` → bot abre conversa no WhatsApp e mensagem de boas-vindas pede a fatura.
> - `/convite/[codigo]` — idêntico, mas pré-popula o "indicado por X" e propaga `codigoRef` para a indicação.
> - `/cadastro` — formulário completo de inclusão direta (web), com OCR opcional, cria Cooperado + UC + Proposta de uma vez.
>
> Os três coexistem hoje. `/entrar` e `/convite/[codigo]` chamam **`POST /publico/iniciar-cadastro`** (cria/atualiza `ConversaWhatsapp` + manda WA de boas-vindas). `/cadastro` chama **`POST /publico/cadastro-web`** que internamente chama `cadastroWebV2` quando `CADASTRO_V2_ATIVO=true`.

### Endpoints públicos do backend (`backend/src/publico/`)

```
GET  /publico/desconto-padrao              → maior descontoBase de plano ativo (sem auth)
POST /publico/iniciar-cadastro             → cria/atualiza ConversaWhatsapp + envia WA boas-vindas
GET  /publico/convite/:codigo              → valida código de indicação
POST /publico/cadastro-web                 → V1: cria LeadWhatsapp / V2: cria Cooperado+UC+Proposta
POST /publico/processar-fatura-ocr         → OCR via Claude (multipart ou base64) — retorna dados, não persiste
POST /publico/salvar-lead                  → upsert LeadWhatsapp (telefone + nome + email)
```

---

## 2. Comportamento preview vs persistência da Proposta

### Resposta direta às 3 perguntas

#### (1) Endpoint chamado durante simulação no `/cadastro`

**Nenhum endpoint do Motor é chamado durante a simulação de `/cadastro`.** A tela faz cálculo **local no frontend**: lê `descontoPercentual` de `GET /publico/desconto-padrao` + tarifa de `GET /motor-proposta/tarifa-concessionaria/atual`, e calcula no JavaScript do navegador (linha 187, 252 de `cadastro/page.tsx`). Nunca invoca `/motor-proposta/calcular`.

#### Endpoint chamado em `/entrar` e `/convite/[codigo]`

Não há simulação. Estas rotas só chamam `/publico/iniciar-cadastro` para abrir conversa no WhatsApp — **toda simulação ocorre depois, dentro do bot**.

#### (2) Endpoint que finaliza cadastro

**`POST /publico/cadastro-web`** com `CADASTRO_V2_ATIVO=true` (estado atual em `.env:75`). Comportamento:

1. Cria `Cooperado` + `Uc` em transação (linhas 322-385 do controller).
2. **Fora da transação**, chama `motorProposta.calcular(...)`.
3. Se outlier detectado → retorna `OUTLIER_DETECTADO` para a tela escolher; nada é persistido pelo Motor ainda.
4. Se cálculo OK → chama `motorProposta.aceitar(...)` direto, que **cria `PropostaCooperado` com status `ACEITA`** + `Contrato` (`PENDENTE_ATIVACAO` ou `LISTA_ESPERA`).

Ou seja, no `/cadastro`:
- A "proposta PENDENTE" **nunca existe** — vai direto pra `ACEITA` quando o motor consegue.
- Apenas se outlier → primeira chamada não persiste; só na segunda (com `opcaoEscolhida`) é que `aceitar()` roda.

`PropostaCooperado.create` aparece **uma única vez no código todo** — em `motor-proposta.service.ts:578`, dentro de `aceitar()`. Não há outro ponto de criação.

#### (3) Wizard admin (`/dashboard/cooperados/novo`)

Mapa real (cf. `web/app/dashboard/cooperados/novo/steps/`):

| Step | Endpoint | Persiste? |
|---|---|---|
| Step1Fatura | `POST /faturas/extrair` (OCR Claude) + `GET /motor-proposta/tarifa-concessionaria/atual` | **Não** — só OCR + tarifa |
| Step2Dados | (form local) | Não |
| **Step3Simulacao** | `POST /motor-proposta/calcular` | **Não** — preview puro, retorna JSON sem gravar |
| **Step4Proposta** | `POST /motor-proposta/aceitar` | **Sim** — cria `PropostaCooperado(ACEITA)` + `Contrato` |
| Step5Documentos | (upload pelo cooperado, via outras rotas) | — |
| Step6Contrato | `POST /motor-proposta/proposta/:id/documentos/status` | **Sim** — APROVADO dispara `enviarLinkAssinaturaDocs` |
| Step7Alocacao | `GET /motor-proposta/historico/:id`, `GET /motor-proposta/lista-espera`, `POST /motor-proposta/proposta/:id/enviar-assinatura`, `POST /motor-proposta/lista-espera/:id/alocar` | Sim — atualiza contrato/lista |

### Síntese

**Sim, simulação é "preview" (não grava) e finalização grava.** Tanto no `/cadastro` (cálculo é JS no navegador, sem persistência) quanto no Wizard admin (Step3 chama `calcular()` puro, Step4 chama `aceitar()` que persiste). Não há divergência entre o que era esperado e o que está implementado.

**Detalhe importante:** "PENDENTE" como status existe no schema (`String @default("PENDENTE")`) mas **nunca é gravado pelo código atual**. Toda proposta criada já nasce como `ACEITA`. O default só importaria se alguém criasse direto via SQL ou seed manual.

---

## 3. OCR — onde realmente roda

| # | Local | OCR dispara? | Endpoint | Status |
|---|---|---|---|---|
| 1 | **Wizard admin Step1Fatura** | ✅ Sim | `POST /faturas/extrair` (autenticado, ROLE: ADMIN) | ✅ Funcional |
| 2 | **/cadastro (público)** | ✅ Sim | `POST /publico/processar-fatura-ocr` (Public) | ✅ Funcional |
| 3 | **/entrar e /convite/[codigo]** | ❌ Não | — (só captura nome+telefone) | 🟡 Por design — OCR rola dentro do WhatsApp depois |
| 4 | **/portal/ucs modal "Nova UC"** | ✅ Sim | `POST /cooperados/meu-perfil/nova-uc-com-fatura` (autenticado COOPERADO) | ✅ Funcional + integrado com Motor |
| 5 | **WhatsApp Bot** | ✅ Sim (2 caminhos) | Chama `faturasService.extrairOcr` direto (`whatsapp-bot.service.ts:1499` e `:3297`); admin via `whatsapp-fatura.service.ts` | ✅ Funcional |

### Detalhamento ponto a ponto

**(1) Wizard admin** — `Step1Fatura.tsx:143` chama `api.post<DadosOcr>('/faturas/extrair', { arquivoBase64, tipoArquivo })`. Endpoint definido em `faturas.controller.ts:67-71`, restrito a SUPER_ADMIN/ADMIN/OPERADOR. **Não persiste `FaturaProcessada`** — só extrai e retorna JSON. Para persistir, admin teria que clicar em "Processar fatura" depois (`POST /faturas/processar` — mesmo controller, linha 73).

**(2) /cadastro (público)** — `cadastro/page.tsx:287` chama `POST /publico/processar-fatura-ocr` (multipart com FormData). Endpoint em `publico.controller.ts:534`, decorado `@Public()` e com Throttle 30/min. Internamente delega a `faturasService.extrairOcr` igual ao wizard. **Não persiste `FaturaProcessada`** — só extrai. Os dados extraídos viajam pelo body de `cadastro-web` quando o cooperado finaliza.

**(3) /entrar e /convite/[codigo]** — só capturam nome + telefone e disparam mensagem de boas-vindas via WA. O OCR só acontece quando o cooperado responde no WhatsApp anexando a fatura — aí entra no caminho (5).

**(4) /portal/ucs modal "Nova UC"** — descoberta importante. O fluxo é **mais sofisticado do que o cadastro público**:
- `portal/ucs/page.tsx:282-297` chama `POST /cooperados/meu-perfil/nova-uc-com-fatura` (multipart).
- Backend (`cooperados.controller.ts:182`):
  1. Verifica UC duplicada
  2. **Roda OCR** via `faturasService.extrairOcr`
  3. **Chama `motorProposta.calcular()`** ANTES de criar UC (evita UC órfã se motor falhar)
  4. Cria UC com dados do OCR (endereço, distribuidora, etc.)
  5. Retorna `simulacao` + `outlierDetectado` + `dadosOcr`
- Frontend mostra simulação. Se cooperado confirma → `POST /cooperados/meu-perfil/confirmar-nova-uc` (linha 331) que chama `aceitar()` e cria proposta+contrato.

Este fluxo **integra OCR + Motor + Lista de Espera** em uma única jornada — é o **único ponto onde isso já está orquestrado**.

**(5) WhatsApp Bot** — duas chamadas a `faturasService.extrairOcr` no `whatsapp-bot.service.ts` (linhas 1499 e 3297). Quando bot recebe imagem/PDF (estado `AGUARDANDO_FATURA` ou similar), `processarOcrFatura()` (linha 1486) chama OCR, valida que tem dados mínimos (titular + consumo + distribuidora), e atualiza `ConversaWhatsapp.dadosTemp` com o JSON extraído + estado `AGUARDANDO_CONFIRMACAO_OCR`. Mensagem de confirmação é enviada de volta ao usuário. Há também `whatsapp-fatura.service.ts:30` (`processarFatura`) usado internamente quando admin envia fatura via interface dedicada.

### Síntese

**OCR confirmadamente integrado em 4 de 5 pontos.** A "lacuna" do ponto 3 é por design (não deveria ter OCR ali — é só captura de lead). O ponto **portal/ucs é a referência de implementação madura**: orquestra OCR → Motor → criação de UC → simulação → aceite.

---

## 4. Pipeline OCR × Motor — lacuna detalhada

### Estado atual quando admin aprova `FaturaProcessada` na Central

`PATCH /faturas/:id/aprovar` chama `aprovarFatura()` (`faturas.service.ts:893`). Comportamento real:

1. Marca `FaturaProcessada.status = 'APROVADA'`, `statusRevisao = 'APROVADO'`.
2. Se a fatura veio do fluxo `upload-concessionaria` (tem `mesReferencia`) e ainda não tem `cobrancaGeradaId` → chama `gerarCobrancaPosFatura(faturaId)`:
   - Resolve modelo de cobrança (`resolverModeloCobranca`): override do contrato → override da usina → ConfigTenant → modelo do plano → `FIXO_MENSAL` default.
   - Se modelo ≠ `FIXO_MENSAL` e `BLOQUEIO_MODELOS_NAO_FIXO` ligado → **bloqueia geração com aviso**.
   - Calcula `valorBruto/valorDesconto/valorLiquido` conforme modelo.
   - Cria `Cobranca` ligando `faturaProcessadaId`, com snapshot `kwhCompensado` se modelo COMPENSADOS.
   - Se `modoRemuneracao = CLUBE` → emite `CooperToken` proporcional (`faturas.service.ts:1090-1098`).
3. Se a fatura **não tem `mesReferencia`** → tenta autodescobrir contratos ativos da UC e gera cobranças em loop (linhas 964+). Mesma lógica de modelo aplica.

### O que NÃO acontece (lacunas reais)

- **Motor de Proposta não é chamado.** Aprovação de `FaturaProcessada` **nunca dispara** `motorProposta.calcular()` ou `motorProposta.aceitar()`. Confirmado por `grep -rn "motor-proposta\|motorProposta\|propostaCooperado\|gerarProposta" backend/src/faturas/` → **zero matches**.
- **Cooperado não tem status atualizado pela aprovação da fatura** — só a `Cobranca` é criada e (se CLUBE) tokens são emitidos.
- **Não há "saldo de créditos" persistido por cooperado** que seja atualizado pelo OCR. `kwhCompensado` é gravado **na Cobranca** como snapshot daquele mês, não como saldo agregado. Se quiser ver "quanto crédito o cooperado tem acumulado", precisa somar os Cobrancas com `kwhCompensado > 0` — sem agregação dedicada.
- **Aprovação ANEEL de UC não é marcada automaticamente.** O status `AGUARDANDO_CONCESSIONARIA` da UC/Cooperado precisa ser mudado manualmente — não há cron nem webhook que detecte fatura nova com UC já aprovada e mova o status.

### Modelos de cobrança — definições reais encontradas

#### CREDITOS_COMPENSADOS (implementado mas bloqueado)

**Implementação real:** `faturas.service.ts:1837-1875`. Lê:
- `contrato.tarifaContratual` (ou `tarifaContratualPromocional` se em promoção — snapshot T4)
- `kwhCompensadoOCR` da fatura
- `desconto` percentual

Cálculo:
```
valorBruto    = kwhCompensado × tarifaUsada
valorDesconto = valorBruto × desconto%
valorLiquido  = valorBruto − valorDesconto
```

Onde `tarifaUsada = tarifaContratual` (preferida) ou `tarifaApurada = valorTotal/consumo` (fallback OCR). Se faltar `kwhCompensado` ou tarifa, levanta `BadRequestException`.

**Por que bloqueado:** env var `BLOQUEIO_MODELOS_NAO_FIXO` (default ON) impede em `motorProposta.aceitar()` (linha 549) E em `aprovarFatura/gerarCobrancaPosFatura` (linhas 571 e 984). Para destravar, ajustar a env (e validar).

**Definição em prosa** (`docs/especificacao-modelos-cobranca.md`):
> Valor do kWh travado (R$ 0,80 fixo, por exemplo). Cooperado paga `créditos × R$ 0,80` independente da tarifa EDP do mês. Economia cresce conforme EDP reajusta. **Proteção contra alta de tarifa.**

#### CREDITOS_DINAMICO (especificado, NÃO implementado)

**Implementação real:** `faturas.service.ts:1877-1882`. Apenas lança `NotImplementedException`:
```
"Modelo CREDITOS_DINAMICO ainda não implementado. Previsto pra Sprint 6+."
```

**Definição em prosa** (`docs/especificacao-modelos-cobranca.md`, encontrado):
> Valor unitário do kWh CALCULADO dinamicamente da fatura mensal, mantendo o desconto contratual percentual. Contrato guarda o PERCENTUAL de desconto (não valor final). Fonte dos kWh: créditos compensados da fatura EDP (via OCR). Cálculo:
> 1. Extrai tarifa cheia do mês (TUSD + TE) da fatura/tabela.
> 2. Aplica desconto: `tarifa_cooperado = tarifa_cheia × (1 − desconto%)`.
> 3. Valor: `kwhCompensado × tarifa_cooperado`.
>
> Diferença prática para COMPENSADOS:
> - COMPENSADOS = valor do kWh travado, economia cresce com reajuste EDP.
> - DINAMICO = desconto relativo constante, valor flutua com tarifa EDP.
>
> Implementação planejada para Sprint 14: 1 service compartilhado, integração com `TarifaConcessionaria`, fallback provisório com ajuste retroativo. Estimativa: 5-8 dias.

### Síntese da lacuna

A integração **OCR → Cobrança** existe e funciona via `aprovarFatura → gerarCobrancaPosFatura`. A integração **OCR → Motor de Proposta** **não existe** — Motor é alimentado só por (a) cadastro público, (b) wizard admin, (c) portal/ucs novo-uc. Aprovar fatura na Central não cria nem atualiza propostas.

Para "Sprint OCR-Integração" virar fluxo único, precisa:
1. Destravar `BLOQUEIO_MODELOS_NAO_FIXO` (com testes).
2. Implementar `CREDITOS_DINAMICO` (case faltante em `calcularValorCobranca`).
3. **Decidir o objetivo da integração** — uma `FaturaProcessada` aprovada deve disparar geração de proposta nova (para uma UC nova detectada na fatura)? Atualizar contrato existente? Recalcular tarifa contratual? A lacuna é também conceitual.
4. Saldo agregado de créditos por cooperado (hoje só dá pra reconstruir varrendo `Cobranca.kwhCompensado`).

---

## 5. Lembretes automáticos — cobertura atual

### 26 cron jobs registrados no backend

Mapeamento contra os 5 pontos de pendência do PRODUTO.md:

| # | Ponto de pendência | Cron existe? | Arquivo / Schedule | O que faz |
|---|---|---|---|---|
| 1 | Proposta gerada aguardando assinatura (link enviado, sem assinatura há 24h) | ✅ Sim | `motor-proposta/motor-proposta.job.ts` `EVERY_DAY_AT_9AM` | `lembretePropostasPendentes()` — busca proposta com `tokenAssinatura ≠ null` e `termoAdesaoAssinadoEm = null` há > 24h, envia WA + email com link. Marca `lembreteEnviadoEm` para não repetir. **Guardado por `NOTIFICACOES_ATIVAS=true`**. |
| 2 | Proposta assinada aguardando docs pessoais | 🟡 Parcial | `documentos/documentos-aprovacao.job.ts` `0 */1 * * *` (a cada hora) | Não envia lembrete ao cooperado. **Auto-aprova** documentos do cooperado em `PENDENTE_DOCUMENTOS` quando `aprovacao_documentos_automatica=true` na ConfigTenant E o último doc tem > `prazo_aprovacao_auto_horas` (default 24h) E não tem REPROVADO E pelo menos um doc já foi revisado. Foco é **acelerar admin lento**, não cutucar cooperado. |
| 3 | Docs aprovados aguardando assinatura termos finais | ❌ **Mesmo cron #1 cobre** parcialmente | (mesmo de #1) | O cron 9h cobre tanto "proposta aceita aguardando assinar" quanto "docs aprovados aguardando assinar termos" — porque o critério é `tokenAssinatura ≠ null + sem assinatura há 24h`. Isso engloba os dois cenários, mas a mensagem é genérica ("aguardando assinatura"). Não diferencia. |
| 4 | Termos assinados aguardando admin enviar lista pra EDP | ❌ Não existe | — | Nenhum cron alerta admin que existem cooperados com termo+procuração assinados aguardando o "envio da lista pra EDP". Status `AGUARDANDO_CONCESSIONARIA` é setado em outro fluxo (`usinas.service.ts:330`), mas não há lembrete. |
| 5 | UC `AGUARDANDO_CONCESSIONARIA` aguardando aprovação EDP | ❌ Não existe | — | Status mencionado em queries de várias telas, mas não há cron que lembre admin ou avise cooperado. Whatsapp-cobranca trata cooperado em `AGUARDANDO_CONCESSIONARIA` no envio de cobrança (linha 415), mas não como lembrete de pendência. |

### Outros crons relevantes (contexto)

- `cobrancas.job.ts` 8h diária — lembrete D-3 e D-1 pré-vencimento (cobrança), guardado por `NOTIFICACOES_ATIVAS`.
- `cobrancas.job.ts` 6:15 — notifica cobrança vencida (uma vez, flag `notificadoVencimento`).
- `cooperados.job.ts` 3h — limpa cooperados PENDENTE_ASSINATURA expirados + PROXY_* zumbi (24h).
- `convite-indicacao.job.ts` 10h — reenvia lembrete WA para convites PENDENTE com cooldown configurável.
- `email-recebimento.service.ts` a cada 5min — IMAP poll para faturas EDP.
- `clube-vantagens.job.ts` mensal dia 1 — recalcula faixas/benefícios.
- `whatsapp-cobranca.service.ts` 8h dia 5 — disparo mensal de cobranças, e 9h diária — fluxo de inadimplência.

### Lacunas para Sprint dedicado

- Lembrete #4 ("admin envie lista pra EDP") — **não existe**, é fluxo manual.
- Lembrete #5 ("EDP aprovou? UC ainda em AGUARDANDO_CONCESSIONARIA?") — **não existe**, depende de admin ir lá manualmente.
- Lembrete #2 hoje só auto-aprova; não notifica cooperado se docs estão atrasados (poderia disparar cooperadoNotifyDocsPendentes).
- Cron #1 não diferencia "proposta nova" vs "docs aprovados" — mensagem é genérica.

---

## 6. Bug de tradução /cadastro

### Causa raiz encontrada

**`web/app/layout.tsx:26`** declara `<html lang="en">`. Página inteira marcada como inglês para o navegador.

```tsx
return (
  <html lang="en">          ← AQUI
    <body className={...}>
      {children}
```

Texto-fonte está **correto em pt-BR**: `cadastro/page.tsx` tem "Cadastro de novo cooperado" (linha 1396), "Seu cadastro foi recebido" (1301), "concluir seu cadastro" (1415), etc. Nenhuma string contém "Canadá" ou "Canada" no source — confirmado por `grep`.

**Por que Chrome oferece tradução:** detecta inconsistência entre `lang="en"` e conteúdo claramente em português → assume que conteúdo precisa de tradução. Quando o usuário aceita (ou se o tradutor ficou ligado), a Neural Machine Translation do Chrome pode confundir tokens curtos: "Cadastro" como palavra portuguesa marcada como inglês → modelo neural busca um cognato inglês plausível e ocasionalmente cospe "Canada" (homofonia distante).

### Recomendação

Trocar a linha 26 de `web/app/layout.tsx`:

```tsx
- <html lang="en">
+ <html lang="pt-BR">
```

Mudança trivial. Recomendado também adicionar `<meta name="google" content="notranslate" />` no `<head>` se quiser **bloquear** a oferta de tradução automática em rotas públicas. Mas só ajustar `lang` já resolve 95% dos casos.

Bug **não é da página `/cadastro`** — é do layout raiz que afeta `/cadastro`, `/entrar`, `/convite/[codigo]`, `/login`, `/aprovar-proposta`, `/assinar` e qualquer outra página. Vale corrigir uma vez no layout.

---

## 7. Síntese pra Doc-0

### O que está mais maduro do que parecia

1. **Trio de captura de lead funciona em paralelo.** `/cadastro` (formulário web completo), `/entrar` (formulário curto + WA) e `/convite/[codigo]` (formulário curto + WA + indicador). Os 3 estão ativos e fazem sentido — não é redundância.
2. **OCR está em 4 pontos coerentes.** Wizard admin, /cadastro público, portal/ucs e WhatsApp bot. Cada um usa o mesmo `faturasService.extrairOcr` (Claude AI) por baixo. O ponto **portal/ucs** é o único que **orquestra OCR + Motor + criação de UC + simulação** em uma jornada — pode ser modelo para os outros.
3. **`CADASTRO_V2_ATIVO=true` em dev** — significa que o caminho público já cria Cooperado + UC + Proposta(ACEITA) + Contrato em uma única chamada. Versão legada (LeadWhatsapp) só roda como fallback. Produção provavelmente já está em V2 também (verificar `.env` de prod).
4. **Cron 9h motor-proposta envia WA + email reais** (não é mock). Cobre 2 dos 5 pontos de pendência (gerada-aguardando-assinatura E docs-aprovados-aguardando-assinatura, ambos pelo mesmo critério de `tokenAssinatura`).
5. **`gerarCobrancaPosFatura` integra OCR → Cobranca** com modelo de cobrança correto, snapshots de tarifa promocional, emissão de CooperToken para cooperados em modo CLUBE, e bloqueio defensivo via `BLOQUEIO_MODELOS_NAO_FIXO`.

### Onde estão as lacunas reais

1. **Pipeline OCR → Motor de Proposta não existe.** Aprovar `FaturaProcessada` na Central só gera Cobranca (e tokens), nunca toca em proposta. Se quiser "fatura nova detecta UC nova → cria proposta" ou "fatura nova alimenta histórico de consumo do motor para reajustar contrato", **isso ainda precisa ser construído**.
2. **Lembretes #4 e #5 não existem.** "Admin enviar lista pra EDP" e "EDP aprovou minha UC?" são totalmente manuais hoje. São pendências silenciosas — ninguém é alertado.
3. **`CREDITOS_DINAMICO` não implementado** (`NotImplementedException` em `faturas.service.ts:1882`). Especificação completa existe em `docs/especificacao-modelos-cobranca.md`, prevista pra Sprint 14.
4. **Saldo agregado de créditos por cooperado não existe.** `kwhCompensado` é snapshot por Cobranca. Se quiser dashboard "Você acumulou X kWh de crédito", precisa agregar manualmente.
5. **`PropostaCooperado` "PENDENTE" só existe no schema** — código nunca grava. Toda proposta nasce ACEITA. Status real ativo é {ACEITA, RECUSADA, CANCELADA}.

### Bloqueios para produção real

1. **`BLOQUEIO_MODELOS_NAO_FIXO=true`** — bloqueia COMPENSADOS e DINAMICO em duas portas (Motor.aceitar e Faturas.gerarCobrancaPosFatura). Apenas FIXO_MENSAL roda hoje. Sprint 14 destrava.
2. **`enviarAprovacao()` é fake** (já documentado na investigação anterior, `motor-proposta.service.ts:1192`). `console.log` apenas. Pode bloquear fluxo "admin manda link de aprovação remota → cooperado clica → aceita". Hoje só funciona se admin copiar o link manualmente do log.
3. **`<html lang="en">`** — bug visual / acessibilidade / SEO. Não bloqueia funcionalmente, mas dá péssima impressão.

### Recomendações concretas para Camadas 3, 5, 9

**Camada 3 (Cadastro de Membros):**
- Documentar **3 caminhos públicos** (não 1): `/cadastro`, `/entrar`, `/convite/[codigo]`.
- Documentar **caminho admin** (Wizard 7 steps) e **caminho cooperado autenticado** (portal/ucs Nova UC).
- Mencionar que o caminho público já cria proposta ACEITA no mesmo POST quando V2 está ligado — **não há etapa de "aprovar proposta" intermediária no /cadastro**, diferente do wizard admin.
- Se quiser flag explícita "lead virou cooperado vs lead apenas captado", marcar que `/entrar` e `/convite` produzem `ConversaWhatsapp` (lead), enquanto `/cadastro` produz `Cooperado + UC + Proposta` direto.

**Camada 5 (Cobrança):**
- 3 modelos: FIXO_MENSAL ✅, CREDITOS_COMPENSADOS 🟡 (implementado mas bloqueado), CREDITOS_DINAMICO 🔴 (NotImplementedException). Definições reais estão em `docs/especificacao-modelos-cobranca.md`.
- Pipeline `aprovarFatura → gerarCobrancaPosFatura` é o coração da geração mensal.
- Snapshots promocionais (`tarifaContratualPromocional`, `mesesPromocaoAplicados`) congelam o plano no momento do aceite — reajuste do plano não retroage.

**Camada 9 (Pipeline OCR):**
- 5 pontos: 4 ativos + 1 por design (portal/ucs é o mais maduro).
- Caminho `aprovarFatura → Cobranca` funciona; caminho `FaturaProcessada → Motor` **não existe** e precisa decisão de produto antes de implementar.
- `kwhCompensado` é o ponto de junção entre OCR e modelo COMPENSADOS — pode disparar emissão de CooperToken se cooperado em CLUBE.

---

*Investigação read-only. Conduzida por Claude Code (Sonnet) em 2026-04-29 a partir do prompt do Luciano. Tudo aqui é leitura do código atual — sem alterações.*
