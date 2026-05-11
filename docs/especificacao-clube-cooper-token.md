> ⚠️ ATENÇÃO — Esta spec foi escrita antes de 30/04/2026. Antes de
> implementar qualquer item, LEIA a Seção 11 (adendos pós-04/05/2026)
> ao final do arquivo. Divergências validadas: identidade do produto,
> numeração de sprints, arquitetura ConfigCooperToken, estado real
> do MVP, pré-requisitos do refator.

# Especificação — Módulo Clube + CooperToken

## 1. Visão geral

CoopereBR é plataforma SaaS multi-tenant de GD solar. Cada parceiro
(cooperativa/consórcio/associação/condomínio) pode contratar o módulo
Clube de Vantagens na assinatura SaaS dele. Se contratar, seus
cooperados ganham acesso a uma escolha binária no cadastro.

## 2. Conceito fundamental: dois caminhos de remuneração

Cooperado escolhe entre:

**CAMINHO DESCONTO (tradicional, padrão hoje):**
- Fatura mensal com desconto aplicado
- Paga valor reduzido direto
- Sem tokens, sem Clube

**CAMINHO CLUBE (novo):**
- Fatura mensal com valor cheio
- Cooperado paga cheio
- Sistema emite tokens equivalentes ao desconto não aplicado
- Saldo do cooperado acumula
- Usa tokens pra abater fatura futura (com teto) ou rede de parceiros

## 3. Regras fundamentais

### 3.1. kWh é constante independente do caminho

Cota ANEEL não muda. O que muda é como o desconto é entregue ao cooperado.

### 3.2. Emissão de tokens (Caminho Clube)

```
Fatura cheia = consumo × tarifa cheia
Fatura com desconto seria = consumo × tarifa com desconto
Desconto não aplicado = fatura cheia − fatura com desconto
Tokens emitidos = desconto não aplicado
Valor de 1 token em reais = desconto por kWh do cooperado
```

**Exemplo:**
- Cota 500 kWh, tarifa cheia R$ 1,00, tarifa com desconto R$ 0,80
- Desconto: R$ 0,20 × 500 = R$ 100
- Tokens emitidos: 500, cada um valendo R$ 0,20
- Fatura paga pelo cooperado: R$ 500

### 3.3. Uso de tokens pra abater fatura

Teto configurável por parceiro (default 40%).
Cooperado usa até o teto, excesso acumula pra próxima fatura.

**Exemplo:**
- Fatura cheia R$ 500, teto 40% → máx R$ 200 abatido
- Saldo 2000 tokens × R$ 0,20 = R$ 400
- Usa R$ 200 (teto). Sobra R$ 200 em tokens pra próximo mês.

### 3.4. Escolha do caminho

- Novo cooperado: escolhe no cadastro
- Cooperado existente: migra via admin do parceiro ou portal próprio
- Voltar atrás: pendente de decisão

### 3.5. Configuração por parceiro

- Parceiro só tem Clube se contratou plano SaaS com Clube
- Parceiro configura teto de abatimento (default 40%)

### 3.6. Expiração de tokens (ferramenta configurável)

Sistema tem campo `tokenExpiracaoMeses` no Plano (já existe no schema).

**Regras:**
- Default sistêmico: tokens não expiram
- Parceiro pode configurar expiração ao ativar Clube no plano dele
- Prazo é em meses, configurável
- Quando expira: token é baixado do saldo do cooperado via CooperTokenLedger com operação EXPIRACAO
- Cooperado recebe notificação WhatsApp antes de expirar (30 dias, 7 dias, 1 dia)
- Dashboard do admin mostra tokens próximos de expirar

**Justificativa:** força uso e circulação. Sem expiração, saldos crescem indefinidamente e o parceiro acumula passivo contábil técnico.

### 3.7. Desvalorização temporal (ferramenta configurável)

Sistema precisa ter ferramenta de desvalorização progressiva de tokens parados.

**Regras:**
- Default sistêmico: token vale o mesmo ao longo do tempo
- Parceiro pode ativar desvalorização temporal ao configurar o Clube
- Curva configurável por parceiro:
  - Período de graça (ex: 30 dias sem desvalorização)
  - Taxa de desvalorização por período (ex: -5% a cada 30 dias depois da graça)
  - Piso mínimo (ex: não desvaloriza abaixo de 50% do valor original)
- Portal do cooperado mostra explicitamente:
  ```
  Seu saldo hoje: 147 CTK valendo R$ 29,40.
  Em 30 dias sem uso: R$ 27,93.
  Em 60 dias: R$ 26,53.
  Em 90 dias: R$ 25,20.
  ```
- Admin do parceiro vê histórico das desvalorizações aplicadas

**Justificativa:** força circulação e uso antes de acumular "moeda parada". Comunicação transparente é OBRIGATÓRIA — sem isso o cooperado se sente enganado.

**Transparência mínima:**
- Cooperado aceitou a curva de desvalorização ao entrar no Clube
- Portal sempre mostra curva projetada pros próximos 3/6/12 meses
- WhatsApp mensal lembra: "Seus 147 CTK vão desvalorizar X% se não usados até DD/MM"

### 3.8. Rede inicial de parceiros (showcase)

MVP não lança sem rede. Mínimo 1-2 parceiros de resgate dentro do tenant CoopereBR.

**Perfil alvo inicial:**
- Restaurantes próximos aos cooperados (uso frequente, ticket médio acessível)
- Outros negócios locais de quem já é próximo do Luciano

**Função:** mostrar pro cooperado que token serve pra algo além de abater fatura. Sem esse showcase, adoção morre.

Sprint 9 (ou dentro do MVP se der tempo):
- Cadastro de OfertaClube apontando pra esses 1-2 parceiros
- UX de resgate (cooperado resgata → recebe código → parceiro valida)

### 3.9. Cadastro público pode já ter parte do Clube

**INVESTIGAR ANTES DE IMPLEMENTAR:**

Luciano lembra que o cadastro público (`/cadastro`) pode já ter UI de escolha Desconto/Clube ou lógica relacionada.

Antes de qualquer implementação no Sprint 8:
- Revisar `web/app/cadastro/` página por página
- Documentar o que já existe de Clube/token no cadastro público
- Evitar refazer funcionalidade existente
- Ajustar e complementar, não recriar

## 4. Análise crítica (decisões levantadas)

### 4.1. Fragilidades conhecidas
- Adoção ameaçada se não houver rede de ofertas desde MVP
- Feedback abstrato (token) vs feedback concreto (desconto mensal)
- Teto de 40% pode causar acúmulo indefinido de saldo
- Cooperado esquece de usar, vira passivo técnico do parceiro

### 4.2. Funcionalidades obrigatórias no MVP
- Notificação WhatsApp quando tokens são emitidos
- Notificação WhatsApp de oportunidade de uso
- Simulador/calculadora no cadastro mostrando 12 meses de projeção

### 4.3. Funcionalidades futuras
- Ofertas de rede interna (Sprint 9)
- Rede aberta entre parceiros (Sprint 10+, requer consulta advogado)
- Transferência cooperado-cooperado via QR (já implementado parcialmente)
- Expiração e/ou desvalorização de tokens
- Dashboard do admin com passivo contábil

## 5. Posicionamento mercadológico

**Categoria:** programa de fidelidade com moeda própria e rede de aceitação. Análogo mais próximo: cashback + rede Méliuz, mas em forma de crédito e aplicado a GD.

**Público-alvo forte:**
- Cooperado PJ (restaurante, mercado, comércio)
- PF classe B+ com literacia financeira
- Cooperados em região com rede ativa

**Público-alvo fraco:**
- PF classe C- (precisa da economia imediata)
- Cooperados em região sem rede
- Idosos ou baixa literacia digital

## 6. Precificação SaaS recomendada

**Modelo Híbrido:**
- Plano sem Clube (STARTER/GROWTH): só taxa base + % receita
- Plano com Clube (PRATA/OURO): taxa base + R$ 300 fixo + R$ 5/cooperado ativo no Clube
- NÃO cobra taxa sobre emissão de tokens no MVP

| Plano | Preço/mês | % receita | Clube |
|-------|-----------|-----------|-------|
| STARTER | R$ 1.900 | 25% | Não |
| GROWTH | R$ 4.900 | 20% | Não |
| PRATA | R$ 5.900 | 25% | Sim, até 50 cooperados |
| OURO | R$ 9.900 | 20% | Sim, ilimitado |
| ENTERPRISE | sob consulta | 15% | Sim + rede aberta |

**Estratégia de lançamento:**
- 3 primeiros parceiros: Clube grátis por 6 meses em troca de case
- Usar métricas deles pra vender pra próximos

## 7. Riscos regulatórios

Enquanto token não for:
- Resgatável em dinheiro
- Transferível pra terceiros fora da rede

...está fora da Lei 12.865/2013 (Meios de Pagamento).

Antes de Sprint 10 (rede aberta) → consulta OBRIGATÓRIA a advogado especializado em fintech/pagamentos. Não é opcional.

### 7.1. Expiração e desvalorização NÃO são risco regulatório

Por serem cupons/créditos de fidelidade de uso restrito e comunicação transparente ao cooperado, expiração e desvalorização seguem dentro da categoria "programa de fidelidade" e não entram em "meio de pagamento" do BACEN.

Analogia legal: vale-presente com prazo, milhagem aérea que expira. Prática consolidada no mercado BR, protegida por CDC.

**IMPORTANTE:** comunicação na adesão deve ser clara. Cooperado assina aceite com curva de desvalorização explícita.

## 8. Escopo MVP (Sprint 8)

### Backend

1. Campo `modoRemuneracao` em Cooperado (DESCONTO | CLUBE)
2. Log `HistoricoModoRemuneracao`
3. Campo `tetoAbatimentoFatura` em Cooperativa (default 0.40)
4. Cobrança respeita `modoRemuneracao`
5. Endpoint "usar tokens na fatura" com teto
6. Endpoint "migrar modoRemuneracao"
7. Notificação WhatsApp na emissão
8. Ferramenta de expiração:
   - Campo `tokenExpiracaoMeses` em ConfigCooperToken ou Plano (já existe)
   - Cron diário varre tokens que expiram no dia e aplica débito EXPIRACAO
   - Notifica cooperado 30d, 7d e 1d antes
9. Ferramenta de desvalorização:
   - Schema novo: `ConfigDesvalorizacao` (cooperativaId, periodoGraca, taxaPercentualPorPeriodo, piso, ativo)
   - Cálculo de valor efetivo em reais do token considera data de emissão + curva
   - Cron mensal aplica desvalorização em CooperTokenLedger

### Frontend

10. Portal cooperado: mostrar `modoRemuneracao` + trocar
11. Portal cooperado: saldo + botão abater
12. Admin parceiro: migrar cooperado
13. Admin parceiro: configurar teto
14. Novo cooperado: escolher caminho no cadastro com simulador
15. Portal cooperado mostra projeção de desvalorização:
    - Saldo hoje + simulação 30/60/90/180 dias
    - Lembrete de tokens próximos de expirar
16. Admin parceiro: configurar expiração + desvalorização
17. Cadastro novo cooperado: aceite explícito da curva de desvalorização (se parceiro tiver configurado)

### Dashboard

18. Admin parceiro vê: X no Clube / Y no Desconto, tokens emitidos, usados, em circulação

## 9. Perguntas em aberto (decidir depois)

- Voltar atrás da migração: livre? fidelidade? proibido?
- Default sistêmico da expiração: nunca expira ou expira em X meses?
- Default sistêmico da desvalorização: desativada ou ativada com curva padrão?
- Curva padrão sugerida para desvalorização (se default for ativado)?
- Taxa da plataforma sobre tokens emitidos?
- "Converter Créditos" no portal é do CooperToken ou SEM_UC?
- QR Code cooperado-cooperado fica visível no MVP ou esconde?

## 10. Próxima etapa

Antes de implementar:
1. Luciano decide as perguntas em aberto
2. Code entrega plano de Sprint 8 em etapas pequenas
3. Cada etapa = 1 commit, revisão antes de próxima

---

## 11. Adendos pós-04/05/2026 — não retroatualizar §1-§10

> Esta spec foi escrita antes da reorganização Doc-0 (30/04) e da
> investigação CooperToken (04/05). As seções §1-§10 são preservadas
> como pensamento original do produto. Esta seção 11 documenta
> divergências validadas (Decisão 20) — leia antes de implementar
> qualquer item da spec.

### 11.1. Identidade do produto

O produto chama-se **SISGD** (Sistema de Geração Distribuída),
plataforma SaaS multi-tenant. **CoopereBR é UM dos parceiros possíveis**,
não o produto. Outros parceiros confirmados aguardando migração:
Sinergia. Sistema atende 4 tipos de parceiro (COOPERATIVA / CONSORCIO
/ ASSOCIACAO / CONDOMINIO) — ver `docs/PRODUTO.md` e `CLAUDE.md` raiz.

§1-§10 desta spec usam "CoopereBR" como sinônimo de plataforma — ler
como SISGD.

### 11.2. Numeração de sprints

A numeração de sprints citada em §3.8, §7, §8 está desatualizada desde
a reorganização da pilha pré-produção em 30/04/2026:

- Sprint 8 atual = Política de Alocação + Engine de Otimização
  (`docs/PLANO-ATE-PRODUCAO.md:312`) — não MVP Clube
- Sprint 9 atual = Motor de Diagnóstico Pré-Venda (`PLANO:339`) — não rede interna
- Sprint 10+ atual = não existe na pilha

Trabalho do Clube CooperToken hoje vive em **"Sprint CooperToken
Consolidado"** (catalogado 04/05 noite em `PLANO:42`, 14-18h Code, 2 etapas).
Ver `docs/sessoes/2026-05-04-noite-investigacao-coopertoken.md`.

### 11.3. Arquitetura — estender ConfigCooperToken (não criar ConfigDesvalorizacao)

§8.9 propõe criar schema novo `ConfigDesvalorizacao`. Decisão
04/05/2026: **estender o modelo `ConfigCooperToken` existente**
(`backend/prisma/schema.prisma:2037`), não criar modelo novo.

`ConfigCooperToken` já tem na linha 2042:
`valorTokenReais Decimal @default(0.45) @db.Decimal(10, 2)`

Isso conecta com §11.5: parte do refator do hardcode 0.20 (D-29A) é
simplesmente trocar o literal em `cooper-token.service.ts:258` por
leitura deste campo do `ConfigCooperToken` da cooperativa.

### 11.4. Estado real do MVP — o que já existe vs o que falta

§8 lista 18 itens como "a fazer". Aproximadamente **60-70% já existem**
no schema/código, com bases vazias ou pouco uso.

Modelos confirmados no schema (números frescos do banco rodados em 11/05/2026):

| Item §8 | Schema | Banco (registros) | Status |
|---|---|---|---|
| Cooperado.modoRemuneracao | linha 178 | 232 em `DESCONTO` | ✅ |
| Cooperado.opcaoToken (deprecated) | linha 180 | 317 em `'A'` | 🟡 |
| Plano.tokenExpiracaoMeses | linha 463 | — | ✅ |
| ProgressaoClube | linha 1695 | 2 entries | ✅/🟡 |
| CooperTokenLedger | linha 1935 | 9 entries | ✅ |
| CooperTokenSaldo | linha 1960 | 5 saldos | ✅ |
| CooperTokenSaldoParceiro | linha 2054 | 1 entry | ✅ |
| CooperTokenCompra | linha 2069 | 0 entries | ✅ |
| OfertaClube | linha 2087 | 0 ofertas | 🟡 |
| ResgateClubeVantagens | linha 2112 | 0 resgates | 🟡 |

**Nuance descoberta nesta validação (11/05):** 317 cooperados em
`opcaoToken='A'` (legado, deprecated) vs 232 em `modoRemuneracao='DESCONTO'`
(modelo atual). Diferença de **85 cooperados** em estado intermediário
pendente de migração entre os 2 campos. Catalogado como **D-30Z**
(P3 documental) — não bloqueia, mas afeta queries que filtram só
pelo campo novo.

Cruzar com `docs/PRODUTO.md` linhas 458-475 antes de implementar
qualquer item da §8.

### 11.5. Pré-requisitos P0 do refator (Sprint CooperToken Consolidado)

Antes de mexer no código financeiro do módulo cooper-token:

1. **Criar specs Jest do módulo** — hoje zero arquivos `.spec.ts` em
   `backend/src/cooper-token/**` (confirmado 11/05: 6 arquivos no
   diretório — controller, service, events, job, module,
   contabilidade-clube — todos sem spec). Pré-requisito P0 catalogado
   na sessão 04/05 noite (sem código D-29 dedicado).

2. **Remover hardcode 0.20** — `cooper-token.service.ts:258` tem
   `Math.round(quantidade * 0.20 * 100) / 100` com TODO. Catalogado
   como **D-29A** (P2) em `docs/sessoes/2026-04-29-validacao-invs-4-8.md:264`.
   Refator: ler de `ConfigCooperToken.valorTokenReais` (default 0.45
   na linha 2042 do schema).

3. **Ler decisão completa** em
   `docs/sessoes/2026-05-04-noite-investigacao-coopertoken.md` antes
   de propor refator.
