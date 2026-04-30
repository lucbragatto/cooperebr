# Validação de specs históricos vs Doc-0 Fatia 2 — 2026-04-30 (noite)

> **Modo:** read-only puro. Nenhum arquivo de produção alterado.
> **Insumo pra:** Prompt 2 aplicar correções consolidadas em PRODUTO.md / REGULATORIO-ANEEL.md / debitos / sessões anteriores.
> **Conclusão antecipada:** 13 lacunas identificadas (algumas estruturantes), 4 contradições leves, 4 specs parcialmente superados, 7 ajustes factuais confirmados.

---

## 1. Inventário (PARTE 1)

| Arquivo | Linhas | Tamanho | Data modificação | Status spec |
|---|---:|---:|---|---|
| `COOPERTOKEN-FUNDAMENTOS.md` | 440 | 16 KB | 02/04/2026 | "Aprovado — aguardando implementação" |
| `ESTRATEGIA-COOPERTOKEN-COMPLETA.md` | 212 | 7 KB | 31/03/2026 | (sem status declarado) |
| `ESTRATEGIA-INOVACAO-2026.md` | 226 | 9 KB | 31/03/2026 | (sem status declarado) |
| `MODELO-COBRANCA-GD-2026-04-01.md` | 115 | 5 KB | 01/04/2026 | "Em discussão" |
| `PLANO-CONVENIOS-2026-04-01.md` | 1.456 | 51 KB | 01/04/2026 | "Plano de implementação" |
| `PROPOSTA-GD1-GD2-FIOB-2026-03-26.md` | 188 | 7 KB | 26/03/2026 | (já validada — D-30L) |
| `PROPOSTA-MODO-OBSERVADOR-2026-03-26.md` | 183 | 7 KB | 26/03/2026 | "Aguardando aprovação" |
| `SPEC-COOPERTOKEN-v1.md` | 734 | 25 KB | 31/03/2026 | "Rascunho com ATUALIZAÇÃO Fase 1 CONCLUÍDA" |

**Total avaliado nesta sessão:** 7 specs (3.366 linhas, 120 KB), excluindo `PROPOSTA-GD1-GD2-FIOB-2026-03-26.md` que já foi validada na sessão anterior (D-30L).

---

## 2. Síntese de cada spec (PARTE 2)

### 2.1 COOPERTOKEN-FUNDAMENTOS.md (440 linhas, 02/04/2026)

**Tópicos cobertos:**
- Natureza jurídica do CooperToken (ato cooperativo Lei 5.764/71)
- Modelo econômico (2 fontes de origem do token)
- Validade e desvalorização (29 dias + decay)
- Potencial do saldo CoopereBR (600k kWh)
- Escalabilidade
- Diferencial competitivo
- **Fundo Cooperativo de Fomento Solar (FCFS)** — Seção 9 inteira
- Contabilidade e lançamentos automáticos — Seção 10
- Impacto nos modelos de cobrança — Seção 11
- Configuração nos Planos SaaS — Seção 12

**Conteúdo principal (5-10 linhas):**
Estabelece o token como **ato cooperativo** (não compra/venda, não moeda, não título). Define que o parceiro do clube **precisa ser cooperado** (caso contrário vira ato mercantil tributado). Token tem 2 origens: (a) conversão da mensalidade Opção B, (b) saldo escritural acumulado da cooperativa. Modelo econômico mostra ganho de R$ 200/mês por cooperado para a cooperativa quando opta por B vs A. Detalha o **FCFS** como fundo interno cooperativo (Lei 5.764/71, NÃO regulado pela CVM) destinado a financiar usinas, carregadores EV, infraestrutura GD. Lançamentos contábeis explicitados débito/crédito. **Quatro cenários de cobrança:** Opção A, Opção B, Opção B + FCFS, abate de tokens.

**Modelagens propostas:**
- Novas contas no Plano de Contas (passivo "Tokens a Liquidar", patrimônio líquido FCFS, receitas operacionais novas).
- Ledger duplo: tokens × FCFS.
- Configuração: `desvalorizacao` JSON (dia → percentual), splits configuráveis (FCFS, SISGD, dono usina, cooperativa).

**Funcionalidades planejadas:**
- 2 modalidades de modelo de cobrança (Opção A / Opção B).
- FCFS contribuição voluntária com tokens proporcionais.
- Tela de configuração CooperToken & FCFS.
- Aba CooperToken nos Modelos de Cobrança (ESSENCIAL, JUSTO, DINÂMICO, PREMIUM).

**Decisões de arquitetura:**
- 1 token = 1 kWh (configurável por plano).
- Validade 29 dias com desvalorização configurável.
- Premissa: parceiro do clube **precisa ser cooperado** (compliance jurídica).
- Burn on use, não transferível entre cooperados.

**Estado de implementação no código atual:**
- ✅ `CooperTokenLedger`, `CooperTokenSaldo` existem (9 ledger entries em prod).
- 🟡 Apenas Opção B implementada parcialmente (emissão); FCFS **0% implementado**.
- 🔴 4 cenários de cobrança não distinguidos no código.
- 🔴 Premissa "parceiro do clube cooperado" não validada.

---

### 2.2 ESTRATEGIA-COOPERTOKEN-COMPLETA.md (212 linhas, 31/03/2026)

**Tópicos cobertos:**
- Plano Token (Plano Desconto vs Plano Token)
- Taxa de repasse ao parceiro (configurável)
- Conversão do token no parceiro (Modalidade A vs B)
- Eletroposto CoopereBR (assinatura 10 anos)
- Ecossistema completo
- Tokenomics (regras fixas + parâmetros configuráveis)
- Pendências para implementação

**Conteúdo principal:**
Define **dois planos para o cooperado**: "Plano Desconto" (paga R$ 800 com 20% desc) ou "Plano Token" (paga R$ 1.000 cheio + recebe 200 CT). A diferença econômica é o ganho de fluxo de caixa. **Taxa de repasse é configurável por parceiro** (exemplos: Uaine 80%, Restaurante 70%, Eletroposto 90%). **Eletroposto CoopereBR** é apresentado como modelo de assinatura 10 anos pra drenar 600k kWh acumulados em ~24 meses (12 postos = ~117k kWh/mês). Tokenomics define regras **fixas** (burn on use, não transferível, expiração) e **parâmetros configuráveis** (29 dias pleno, decay -10%/7d, expiração 90 dias).

**Modelagens propostas:**
- "Plano Token" como **alternativa** ao "Plano Desconto" no mesmo cooperado.
- Eletroposto como UC parceira (sem entidade nova).
- Token Flex (Fase 2 — demand response) e Token Social (Fase 3 — pool).

**Funcionalidades planejadas:**
- Módulo PlanoToken: cooperado escolhe.
- Cadastro de Parceiros: taxa repasse configurável + modalidade conversão.
- Eletroposto integrado.

**Decisões de arquitetura:**
- 1 CT = R$ 1,00 fixo OU fator variável (configurável por parceiro).
- 29 dias pleno / 7 dias decay / 90 dias expiração.
- Aceito no decay: apenas mensalidade CoopereBR.

**Estado de implementação no código atual:**
- 🔴 "Plano Token" como alternativa: não detectado no schema (`Plano` tem `cooperTokenAtivo` boolean, não distingue plano-token vs plano-desconto).
- 🔴 Eletroposto: 0 implementado.
- 🔴 Decay progressivo: não implementado (modelo atual usa `tokenExpiracaoMeses` flat).

**⚠️ Conflito interno entre specs:** ESTRATEGIA-COMPLETA diz expiração 90 dias com decay; SPEC-COOPERTOKEN-v1 diz `tokenExpiracaoMeses` default 12 meses (flat); FUNDAMENTOS diz 29 dias com decay (sem 90 dias). **Os 3 specs do CooperToken não bate exatamente entre si**.

---

### 2.3 ESTRATEGIA-INOVACAO-2026.md (226 linhas, 31/03/2026)

**Tópicos cobertos:**
- Visão estratégica: CoopereBR como VPP (Virtual Power Plant)
- CooperToken como espinha dorsal da VPP (3 camadas)
- O problema dos 600.000 kWh represados (3 caminhos de solução)
- Mobilidade Elétrica — consumo estratégico
- Roadmap de Inovação 2026-2027
- Posicionamento competitivo

**Conteúdo principal:**
Apresenta CoopereBR em transição de "cooperativa de GD" para **VPP** (Virtual Power Plant) — agregação de recursos energéticos distribuídos operados como usina única. Identifica o **problema central:** 600.000 kWh acumulados no CNPJ CoopereBR (~R$ 473k em valor econômico, lote mais antigo expira em **maio/2028**) que a EDP-ES proíbe transferir. Propõe **3 caminhos paralelos:**
1. **🟢 Tokenização imediata** (sem mudança regulatória)
2. **🟡 Contestação ANEEL** (Lei 14.300 art. 4° §1° prevê exceção cooperativista)
3. **🔵 Reestruturação prospectiva** (renegociar com EDP-ES — "geração compartilhada cooperativista")

**Modelagens propostas:**
- 3 camadas de token: Geração (Fase 1) / Flex (Fase 2 — demand response) / Social (Fase 3 — pool).
- Mobilidade EV como UC parceiro (carregador) com revenue share.

**Funcionalidades planejadas:**
- Demand response via WhatsApp Bot (Fase 2 — após Tarifa Branca).
- 20 pontos de carregamento EV ativos (meta dez/2026).

**Decisões de arquitetura:**
- VPP como horizonte estratégico (3 anos).
- Carregador EV registrado como "UC parceiro".

**Estado de implementação no código atual:**
- 🔴 VPP: 0 implementado.
- 🔴 Token Flex/Social: 0 implementado.
- 🔴 Mobilidade EV: 0 implementado.
- 🔴 Solução pros 600k kWh: 0 implementado (nem tokenização emergencial nem contestação ANEEL).

---

### 2.4 MODELO-COBRANCA-GD-2026-04-01.md (115 linhas, 01/04/2026)

**Tópicos cobertos:**
- Padrões confirmados em 5 faturas EDP-ES (Cláudio, Balthazar, Patricia, Rodrigo, RCA)
- 3 modelos existentes no código
- 2 modelos propostos a partir da fatura real (Modelo A e Modelo B)
- Comparativo numérico
- 4 decisões pendentes

**Conteúdo principal:**
Análise de 5 faturas reais EDP-ES pra entender como cobrar. Propõe **2 modelos novos**: **Modelo A** ("tarifa unitária da fatura": `creditosRecebidosKwh × (tusd+te) compensação × (1-desc)`) e **Modelo B** ("valor cheio reconstruído": `creditosRecebidosKwh × kWhMedioReal × (1-desc)`, onde kWhMedioReal inclui CIP/ICMS/PIS-COFINS proporcionais). Comparativo Cláudio (628,7 kWh, 15% desc): FIXO_MENSAL R$ 335 / DINAMICO atual R$ 422 / Modelo A R$ 514 / Modelo B R$ 467. **4 decisões pendentes:** qual modelo usar pra COMPENSADOS, fallback sem fatura, Fio B incorporar agora ou depois, alerta superdimensionamento.

**Modelagens propostas:**
- Refactor de COMPENSADOS pra usar tarifa real da fatura (não tarifa cadastrada).
- Possível incorporação de Fio B já no cálculo.

**Funcionalidades planejadas:**
- Modelos A/B como alternativas ao COMPENSADOS atual.
- Alerta de superdimensionamento de cota.

**Estado de implementação no código atual:**
- 🟡 COMPENSADOS atual usa tarifa cadastrada, não tarifa fatura — Modelo A não implementado.
- 🔴 Modelo B: 0 implementado.
- 🔴 Alerta superdimensionamento: 0 implementado.

**⚠️ Insumo crítico pra Sprint 2:** este spec lista os 5 cooperados de teste com casos reais de saldo (Patricia acumulando, Rodrigo FIFO múltiplo, RCA saldo zero, etc.).

---

### 2.5 PLANO-CONVENIOS-2026-04-01.md (1.456 linhas, 51 KB, 01/04/2026)

> **O maior dos 7 specs. 31× maior que cobertura atual em PRODUTO.md.**

**Tópicos cobertos:**
- 8 decisões consolidadas pelo dono
- Schema Prisma completo (enums, ContratoConvenio expandido, ConvenioCooperado expandido, HistoricoFaixaConvenio novo)
- 5 migrations incrementais
- 10 fases de implementação (30-40h total)
- Endpoints e contratos de API (~30 endpoints documentados)
- Lógica de negócio crítica (pseudo-código de `resolverDesconto`, `recalcularFaixa`, `adicionarMembro`, `aplicarEfeitoFaixa`)
- Telas frontend (admin + portal conveniado)
- 8 riscos técnicos identificados
- 4 decisões menores pendentes

**Conteúdo principal:**
Plano completo de **expansão in-place** do módulo Convênios (não rebuild). **8 decisões consolidadas** pelo dono:
1. Desconto convênio é **independente** (soma com usina/cooperativa).
2. Conveniado pertence a **um único** convênio.
3. Conveniado sem UC → cria **Cooperado SEM_UC** automaticamente.
4. Mudança de faixa: configurável (só próximas OU também pendentes).
5. Migração: **expandir** tabela existente.
6. Faixas: JSON com `descontoMembros` + `descontoConveniado` na mesma config.
7. **Sem administradora**: condomínio/associação/clube pode ter convênio direto.
8. Portal conveniado: **extensão do portal cooperado** (role adicional, não módulo novo).

Hierarquia de desconto fica: `total = base (usina/cooperativa) + convênio (faixa) + conveniado`. Suporta **cap** via `maxAcumuloConveniado`.

**Modelagens propostas:**
- 4 enums novos (`TipoConvenio`, `StatusConvenio`, `StatusMembroConvenio`, `EfeitoMudancaFaixa`).
- ContratoConvenio expandido com 14 campos novos.
- ConvenioCooperado expandido com 6 campos novos.
- HistoricoFaixaConvenio (model novo, append-only).
- JSON `configBeneficio` com schema explícito (criterio, faixas, efeitoMudancaFaixa, maxAcumuloConveniado).

**Funcionalidades planejadas:**
- CRUD convênio + listagem com filtros.
- Adicionar/remover membros (individual + massa via CSV).
- Recálculo automático de faixa ao mudar membros.
- Override de desconto individual por membro.
- Cron diário de reconciliação.
- Portal conveniado (extensão do `/portal/`).
- 6 endpoints de relatório.
- Notificações WhatsApp ao mudar de faixa.

**Decisões de arquitetura:**
- **In-place migration** (preserva dados existentes via `@map`).
- 5 migrations não-destrutivas.
- Cache de faixa atual (`faixaAtualIndex`, `membrosAtivosCache`, etc.) pra evitar recálculo em cada cobrança.
- Indicação automática quando membro entra (configurável via `registrarComoIndicacao`).
- Append-only ledger de mudanças de faixa (`HistoricoFaixaConvenio`).

**Estado de implementação no código atual:**
- 🟢 Modelos GLOBAL/STANDALONE: confirmado em INV-6 (29/04).
- 🟢 Faixas progressivas: `validarFaixas()`, `convenios-progressao.service.ts` (234 linhas), `HistoricoFaixaConvenio` model: implementados.
- 🟢 Service `convenios.service.ts` (451 linhas): existe.
- 🟢 1956 linhas total no módulo convenios + 18 endpoints + 1 cron.
- 🟡 Schema completo conforme spec: validar (não auditado em profundidade nesta sessão).
- 🔴 Portal conveniado `/portal/convenio/`: não confirmado existir (a verificar).
- 🔴 0 registros em produção (`ContratoConvenio` = 0, `ConvenioCooperado` = 215 — número confirmado em INV-6, mas quase tudo é teste).

---

### 2.6 PROPOSTA-MODO-OBSERVADOR-2026-03-26.md (183 linhas, 26/03/2026)

**Tópicos cobertos:**
- Visão geral (Modo Shadow — espelhamento WhatsApp + ações em tempo real)
- 5 cenários de uso
- Arquitetura proposta (`ObservacaoAtiva` + `EscopoObservacao` enum)
- Fluxo de ativação
- Funcionalidades por perfil (limites por perfil)
- Recursos avançados (intervenção, alertas, modo auditoria)
- 3 telas
- Segurança e privacidade (LGPD)
- Cronograma 6-9 dias

**Conteúdo principal:**
Modo Observador permite SUPER_ADMIN/ADMIN/Parceiro **espelharem em tempo real** conversas WhatsApp e ações de outros usuários do sistema (cooperados, leads, operadores, parceiros). Útil pra intervir em lead travado, treinar operador, monitorar inadimplente sendo abordado pelo bot. Limites por perfil: Super Admin (ilimitado), Admin (10 simultâneas), Parceiro (3), Operador (sem acesso). Inclui **modo auditoria** (replay sem espelho em tempo real) pra LGPD compliance.

**Modelagens propostas:**
- `ObservacaoAtiva` model com `EscopoObservacao` enum (WHATSAPP_ENVIADO/RECEBIDO/TOTAL/ACOES_PLATAFORMA/TUDO).
- `LogObservacao` (implícito — append-only).
- Expiração automática (default 4h).

**Funcionalidades planejadas:**
- Painel `/dashboard/observador`.
- Ativação rápida via ícone de câmera ao lado do nome do usuário.
- Intervenção no chat (assumir conversa).
- Alertas inteligentes ("Avise-me quando lead X abrir o link").
- Replay para auditoria.

**Estado de implementação no código atual:**
- 🟢 Schema: `ObservacaoAtiva` + `LogObservacao` existem (INV de 28/04 confirmou).
- 🟢 Cron `EVERY_5_MINUTES` em `observador/observador` ativo (Leitura Total Parte 1).
- 🟡 Tela `/dashboard/observador` existe (Leitura Total Parte 2 inventariou em "Outros").
- 🔴 Funcionalidades avançadas (intervenção, alertas, replay): não confirmadas.

> **Spec marcado como "aguardando aprovação" mas IMPLEMENTADO** entre 26/03 e 28/04. PRODUTO.md atual **OMITE** esta funcionalidade — lacuna.

---

### 2.7 SPEC-COOPERTOKEN-v1.md (734 linhas, 31/03/2026)

> **Spec mais técnica do trio CooperToken. Contém ATUALIZAÇÃO 2026-03-31 marcando Fase 1 como CONCLUÍDA.**

**Tópicos cobertos:**
- Visão geral (CooperToken como camada econômica intracooperativa)
- 3 tipos de token (GERACAO_EXCEDENTE / FLEX / SOCIAL)
- Arquitetura de dados (schema Prisma completo)
- Serviços e jobs (CooperTokenService + CooperTokenJob)
- Integração com Clube de Vantagens
- Vinculação com PlanoSaas
- Fase 2 — Tarifa Branca (design antecipado)
- Fase 3 — Pool Social (design antecipado)
- Segurança e compliance
- **ATUALIZAÇÃO Fase 1 CONCLUÍDA**
- Roadmap detalhado por task
- Exemplo de jornada completa
- 5 perguntas em aberto

**Conteúdo principal:**
Define CooperToken como **programa de fidelidade interno** (não moeda, não título mobiliário, não criptoativo) — natureza jurídica robusta. Schema Prisma completo: 6 campos novos no `Plano` (`cooperTokenAtivo`, `tokenPorKwhExcedente`, `valorTokenReais`, `tokenExpiracaoMeses`, `tokenDescontoMaxPerc`, `tokenSocialAtivo`, `tokenFlexAtivo`), 2 models novos (`CooperTokenLedger`, `CooperTokenSaldo`), 3 campos novos em `Cobranca` (`tokenDescontoQt`, `tokenDescontoReais`, `ledgerDebitoId`), 3 campos novos em `PlanoSaas` (`taxaTokenPerc`, `limiteTokenMensal`, `cooperTokenHabilitado`), 2 campos novos em `FaturaSaas` (`volumeTokensMes`, `receitaTokens`).

**Default de valores:** 1 CT = 1 kWh excedente, **R$ 0,45 / CT**, expiração 12 meses, desconto máximo 30% via token.

**Modelagens propostas:**
- 3 tipos de token (GERACAO_EXCEDENTE primário, FLEX e SOCIAL pra fases futuras).
- Ledger append-only com referenciaId/referenciaTabela pra rastreabilidade.
- Pool Social com regras (cooperados DEFICITARIO < 80% contrato, prioridade por déficit relativo, máx 30% desconto via pool).

**Estado de implementação no código atual:**
- 🟢 **Fase 1 marcada como CONCLUÍDA** em 31/03 (atualização própria do spec):
  - Schema atualizado (todos os campos e models).
  - `CooperTokenService` com `creditar/debitar/getSaldo/calcularDesconto/expirarVencidos/getExtrato/getConsolidado`.
  - `CooperTokenJob` com 2 crons (apurar excedentes 6h diário + expirar tokens 1º do mês).
  - `CooperTokenController` com 4 endpoints.
  - `CooperTokenModule` registrado.
- 🟢 Confirmado por INV-6 (29/04): `cooper-token.service.ts:258` tem hardcode `0.20` (não bate com R$ 0,45 da spec — D-29A).
- 🟡 Pendências pós-implementação: integração CobrancasService + FaturasService, frontend (a verificar).
- 🔴 Fase 2 (Tarifa Branca) e Fase 3 (Pool Social): 0 implementado.

**Default `R$ 0,45/CT` é a referência canônica.** Hardcode `0.20` em `cooper-token.service.ts:258` (D-29A) é **inconsistente** com a spec — confirma que é bug, não decisão.

---

## 3. Divergências encontradas (PARTE 3)

### Tipo 1 — Contradições diretas (4 achados)

#### C1. Hardcode `valorTokenReais = 0.20` não tem origem nos specs
- **Spec:** SPEC-COOPERTOKEN-v1 Seção 2.1 (default R$ 0,45) + outras 3 ocorrências em fallback `?? 0.45` no service.
- **Código:** `cooper-token.service.ts:258` usa `0.20` com TODO.
- **Conclusão:** D-29A é **bug**, não decisão. O 0.20 não está documentado em nenhum spec. Pode ser de protótipo abandonado.
- **Aplicar:** atualizar D-29A em débitos com nota "0.20 não tem origem documentada — bug confirmado".

#### C2. Expiração do token — 3 specs incompatíveis entre si
- **SPEC-COOPERTOKEN-v1:** `tokenExpiracaoMeses` default 12 meses (flat).
- **COOPERTOKEN-FUNDAMENTOS:** 29 dias com desvalorização progressiva por 30 dias.
- **ESTRATEGIA-COOPERTOKEN-COMPLETA:** 29 dias pleno + decay 7 dias × N + expiração total dia 90.
- **PRODUTO.md atual:** menciona "1 token = R$ 0,45 (fallback)" sem detalhar expiração.
- **Conclusão:** specs **não fecham entre si**. PRODUTO.md está omitindo controvérsia.
- **Aplicar:** decisão pendente — quem manda? Sugestão: SPEC-COOPERTOKEN-v1 (mais técnica) tem prioridade pra Fase 1; FUNDAMENTOS (mais recente) tem prioridade pra Fase 2 conceitual.

#### C3. Terminologia "Plano Token" vs "Plano Desconto"
- **ESTRATEGIA-COOPERTOKEN-COMPLETA:** "Plano Desconto" e "Plano Token" como dois planos distintos.
- **Código:** `Plano.cooperTokenAtivo` (boolean). Não há distinção "plano-token" vs "plano-desconto".
- **PRODUTO.md atual:** menciona modos DESCONTO vs CLUBE no `modoRemuneracao`, alinhado com schema atual `Plano.cooperTokenAtivo`.
- **Conclusão:** terminologia evoluiu. Spec antiga é insumo histórico.
- **Aplicar:** nada. Já está consistente em PRODUTO.md.

#### C4. Modelos de cobrança — terminologia
- **COOPERTOKEN-FUNDAMENTOS Seção 11.4:** modelos "ESSENCIAL, JUSTO, DINÂMICO, PREMIUM".
- **Código:** `ModeloCobranca` enum: `FIXO_MENSAL`, `CREDITOS_COMPENSADOS`, `CREDITOS_DINAMICO`.
- **PRODUTO.md atual:** usa nomes do enum.
- **Conclusão:** spec usa nomes comerciais; código usa nomes técnicos. **Não é contradição** — mapeamento informal possível.
- **Aplicar:** nada (ou opcionalmente referenciar nomes comerciais em PRODUTO.md como "exemplos de planos").

---

### Tipo 2 — Lacunas no doc atual (13 achados, 5 estruturantes)

#### L1. ⭐ Modo Observador completo (estruturante)
- **Spec:** `PROPOSTA-MODO-OBSERVADOR-2026-03-26.md` — 183 linhas.
- **Estado:** **IMPLEMENTADO** entre 26/03 e 28/04 (modelos `ObservacaoAtiva`+`LogObservacao` no schema, cron `EVERY_5_MINUTES`, tela `/dashboard/observador`).
- **PRODUTO.md atual:** **omite** completamente.
- **Severidade:** ALTA — é uma funcionalidade implementada e não documentada.
- **Sugestão:** adicionar **Camada 12 — Modo Observador** ou subsection em Camada 10 (WhatsApp).

#### L2. ⭐ FCFS (Fundo Cooperativo de Fomento Solar) (estruturante)
- **Spec:** COOPERTOKEN-FUNDAMENTOS Seção 9 (94 linhas dedicadas).
- **PRODUTO.md atual:** **omite** completamente.
- **Severidade:** MÉDIA — não implementado, mas é conceito tributário/contábil distinto que precisa estar mapeado.
- **Sugestão:** adicionar mini-seção em Camada 7 (Financeiro) ou Camada 8 (Fidelidade) marcando 🔴 (planejado).

#### L3. ⭐ VPP (Virtual Power Plant) — visão estratégica (estruturante)
- **Spec:** ESTRATEGIA-INOVACAO-2026 226 linhas.
- **PRODUTO.md atual:** **omite** visão VPP.
- **Severidade:** MÉDIA-ALTA — é o framing de longo prazo do produto.
- **Sugestão:** adicionar parágrafo no Sumário Executivo ou seção dedicada em PRODUTO.md.

#### L4. ⭐ 600.000 kWh represados (caso real CoopereBR) (estruturante)
- **Spec:** ESTRATEGIA-INOVACAO Seção 2 (problema + 3 caminhos de solução).
- **REGULATORIO-ANEEL.md atual:** menciona "saldo 60 meses" mas NÃO o problema concreto da CoopereBR.
- **Severidade:** ALTA — é problema regulatório real do parceiro principal.
- **Sugestão:** adicionar Caso D em REGULATORIO-ANEEL.md Seção 16 (Casos Reais).

#### L5. ⭐ Convênios — 1.456 linhas vs 5 no PRODUTO.md (estruturante)
- **Spec:** PLANO-CONVENIOS 1.456 linhas (8 decisões consolidadas, schema completo, hierarquia desconto somativa).
- **PRODUTO.md atual:** Camada 8 linha 444 — 1 entrada de tabela.
- **Severidade:** ALTA — é módulo subdocumentado.
- **Sugestão:** expandir Camada 8 com sub-seção dedicada. Princípios essenciais:
  - Desconto convênio é **independente** (soma com usina/cooperativa).
  - Conveniado pertence a **um único** convênio.
  - Conveniado sem UC → cria Cooperado SEM_UC.
  - Faixas progressivas configuráveis em JSON.
  - Modalidades GLOBAL vs STANDALONE.
  - Importação CSV em massa.
  - Portal conveniado é extensão do portal cooperado.

#### L6. Eletroposto CoopereBR (assinatura 10 anos)
- **Spec:** ESTRATEGIA-COOPERTOKEN-COMPLETA Seção 4.
- **PRODUTO.md / REGULATORIO-ANEEL.md:** **omitem**.
- **Severidade:** MÉDIA — não implementado, mas é estratégia de produto real.
- **Sugestão:** mencionar no Sumário Executivo de PRODUTO.md como "estratégia futura".

#### L7. Eletromobilidade e carregadores EV
- **Spec:** ESTRATEGIA-INOVACAO Seção 3.
- **PRODUTO.md:** omite.
- **Severidade:** BAIXA — visão Fase 2.
- **Sugestão:** referenciar no roadmap.

#### L8. Tokenomics: 29 dias + decay + expiração total
- **Spec:** ESTRATEGIA-COOPERTOKEN-COMPLETA Seção 5b + COOPERTOKEN-FUNDAMENTOS Seção 4.
- **PRODUTO.md atual:** omite mecânica de expiração.
- **Severidade:** MÉDIA — é decisão técnica importante (e os 3 specs do CooperToken não batem entre si — C2).
- **Sugestão:** adicionar nota em Camada 8 com link pra spec de referência.

#### L9. Lei 14.300/2022 Art. 4°, §1° — exceção cooperativista
- **Spec:** ESTRATEGIA-INOVACAO Seção 2.2 cita literal: *"Geração compartilhada por cooperativas permite que os créditos gerados em uma ou mais UCs sejam compensados nas UCs dos cooperados associados."*
- **REGULATORIO-ANEEL.md atual:** cita Lei 14.300 mas NÃO esse art. específico.
- **Severidade:** MÉDIA — fortalece argumentação jurídica.
- **Sugestão:** adicionar em REGULATORIO-ANEEL.md Seção 1 ou Seção 2.

#### L10. Token Flex (Fase 2 — demand response)
- **Spec:** SPEC-COOPERTOKEN-v1 Seção 7 + ESTRATEGIA-INOVACAO Seção 1.1.
- **Conexão:** com Tarifa Branca + smart meters + WhatsApp Bot pra notificar pico.
- **PRODUTO.md:** omite.
- **Severidade:** BAIXA — Fase 2 (futura).
- **Sugestão:** mencionar no roadmap.

#### L11. Token Social (Fase 3 — pool)
- **Spec:** SPEC-COOPERTOKEN-v1 Seção 8.
- **PRODUTO.md:** omite.
- **Severidade:** BAIXA — Fase 3 (futura).
- **Sugestão:** mencionar no roadmap.

#### L12. Curtailment (CP 045 ANEEL)
- **Spec:** SPEC-COOPERTOKEN-v1 Seção 12 pergunta 4.
- **REGULATORIO-ANEEL.md:** omite.
- **Severidade:** BAIXA — caso de borda regulatório.
- **Sugestão:** opcional adicionar como nota.

#### L13. 5 cooperados de teste com casos reais (Cláudio, Balthazar, Patricia, Rodrigo, RCA)
- **Spec:** MODELO-COBRANCA-GD lista os 5 com perfis distintos (saldo zero, acumulando, FIFO múltiplo).
- **PLANO-ATE-PRODUCAO atual:** Sprint 0 menciona auditoria mas não cita estes casos.
- **Severidade:** MÉDIA — insumo direto pra Sprint 0 e Sprint 2.
- **Sugestão:** referenciar na Seção 14 (Sprints) de REGULATORIO-ANEEL.md ou no Sprint 0 de PLANO-ATE-PRODUCAO.

---

### Tipo 3 — Detalhamento extra a aproveitar (6 achados)

#### D1. Hierarquia de desconto convênio (PLANO-CONVENIOS)
- Fórmula: `total = base + convênio_faixa + convênio_conveniado`.
- Cap em 100% + cap configurável `maxAcumuloConveniado`.
- Pode enriquecer Camada 5 ou Camada 8 do PRODUTO.md.

#### D2. JSON `configBeneficio` schema (PLANO-CONVENIOS)
- Estrutura completa com `criterio`, `efeitoMudancaFaixa`, `maxAcumuloConveniado`, `faixas[]`.
- Pode ser citado em REGULATORIO-ANEEL.md Seção 6.1 como exemplo de configurabilidade.

#### D3. 4 cenários de cobrança (COOPERTOKEN-FUNDAMENTOS Seção 11.1)
- Opção A / Opção B / Opção B + FCFS / Abate de tokens.
- PRODUTO.md atual menciona "snapshot promocional" mas não os 4 cenários.
- Adicionar como detalhamento em Camada 5.

#### D4. Lançamentos contábeis automáticos (COOPERTOKEN-FUNDAMENTOS Seção 10)
- Débito/crédito por evento (Opção B, liquidação, expiração, contribuição FCFS).
- Insumo pra Sprint 7 (DRE).
- Adicionar referência em PRODUTO.md Camada 7 ou em Sprint 7 do PLANO-ATE-PRODUCAO.

#### D5. 8 riscos técnicos do PLANO-CONVENIOS Seção 6.1
- Race condition no recálculo, recálculo retroativo de cobranças com boleto Asaas emitido, performance batch, etc.
- Insumos pra Engine de Otimização (Sprint 8) — riscos similares.

#### D6. Roadmap detalhado por task (SPEC-COOPERTOKEN-v1 Seção 10)
- Fase 1 → 2 semanas com tasks por arquivo.
- Pode enriquecer estimativas dos sprints.

---

### Tipo 4 — Specs obsoletos (parcialmente superados — 4 achados)

#### O1. ESTRATEGIA-COOPERTOKEN-COMPLETA — taxas configuráveis 80%/70%/90%
- Tema muito CoopereBR-cêntrico (Uaine, restaurante específico).
- **Doc-0 atual** é multi-tenant.
- **Princípio sobrevive** (taxa configurável por parceiro), exemplos não.
- Tratar como insumo histórico de design.

#### O2. SPEC-COOPERTOKEN-v1 — Fase 1 marcada CONCLUÍDA em 31/03
- Spec própria diz "ATUALIZAÇÃO 2026-03-31: Implementação Fase 1 Concluída".
- Confirmado por INV-6 (29/04): emissão funciona, 9 ledger entries.
- **Spec parcialmente superada por estado real** — implementação foi mais completa que pendências listadas no fim da Fase 1.
- Tratar como **referência canônica de schema** mas estado de implementação atual é mais avançado.

#### O3. PROPOSTA-MODO-OBSERVADOR — Fase A "1 dia"
- Spec é de 26/03 com 6-9 dias de cronograma.
- Modo Observador EXISTE em produção (cron, schema, tela) — implementado entre 26/03 e 28/04.
- **Spec virou histórico** mas funcionalidade ATIVA.
- Tratar como insumo de quais features avançadas faltam (intervenção, alertas, replay).

#### O4. PROPOSTA-GD1-GD2-FIOB (já tratada como D-30L)
- Já marcada como insumo histórico no Doc-0 atual.
- Nada a aplicar.

---

## 4. Atenção especial às 4 áreas críticas (PARTE 4)

### 4.1 — CooperToken (3 specs)

**Análise consolidada:**

**Modelos de uso do token estão completos?**
- 🟡 PRODUTO.md menciona DESCONTO vs CLUBE mas **não detalha**. Specs trazem 4 cenários (Opção A, Opção B, Opção B + FCFS, Abate de tokens) — só 2 estão na superfície do PRODUTO.md. **Lacuna L2 + D3.**

**Valor R$ 0,45/CT bate com fallback no código?**
- 🟢 SIM — `cooper-token.service.ts` linhas 451, 561, 670 usam `?? 0.45`. SPEC-COOPERTOKEN-v1 confirma como default.

**Hardcode 0,20 (D-29A) tem origem nos specs ou foi bug recente?**
- 🔴 **NÃO TEM ORIGEM NOS SPECS.** Confirmado bug (C1).

**Mecânica de expiração descrita?**
- 🟡 SIM mas **3 specs não batem entre si** (C2): SPEC-COOPERTOKEN-v1 (12 meses flat) vs FUNDAMENTOS (29 dias com decay 30) vs ESTRATEGIA-COMPLETA (29 dias + 7d decay + 90d expiração). PRODUTO.md omite essa controvérsia.

**Integração com Asaas pra compra prevista?**
- 🟡 PARCIAL — FCFS prevê captação de investidores (FUNDAMENTOS Seção 9.6); ESTRATEGIA-COMPLETA prevê Eletroposto pago em CT mas não Asaas direto.

**Nuances que PRODUTO.md está omitindo:**
1. FCFS (L2) — fundo separado tributariamente.
2. Burn on use (token não transferível).
3. Premissa "parceiro do clube precisa ser cooperado" — Lei 5.764/71.
4. 4 cenários de cobrança (D3).
5. 3 fases (Geração / Flex / Social) — apenas Fase 1 implementada (L10, L11).
6. Lançamentos contábeis automáticos (D4).

---

### 4.2 — Convênios (PLANO-CONVENIOS gigante)

**Análise consolidada:**

**51 KB de spec sugere muito mais nuance que doc captura?**
- 🔴 SIM — 1.456 linhas vs 5 linhas em PRODUTO.md = **300× menos detalhamento**. **Lacuna L5 (estruturante).**

**Faixas progressivas funcionam exatamente como o spec descreve?**
- 🟢 SIM — `validarFaixas()`, `convenios-progressao.service.ts` (234 linhas), `HistoricoFaixaConvenio` model: implementados (INV-6 29/04 confirmou).

**Modalidades GLOBAL vs STANDALONE estão documentadas no PRODUTO.md?**
- 🔴 **NÃO** — PRODUTO.md não menciona. INV-6 confirmou existência: STANDALONE aprova automático, GLOBAL precisa SUPER_ADMIN aprovar.

**Hangar Academia é caso de uso central?**
- 🟢 SIM — PRODUTO.md menciona Carlos (papel 6) como agregador da Hangar e Solange (papel 11) como conveniado. Mas não detalha o vínculo de ContratoConvenio com Hangar.

**Algo crítico foi omitido no PRODUTO.md?**
- ✅ Sim — várias coisas (L5 lista 7 princípios essenciais não documentados):
  1. Desconto convênio é independente (soma com usina/cooperativa).
  2. Conveniado pertence a um único convênio.
  3. Conveniado sem UC cria Cooperado SEM_UC automaticamente.
  4. JSON `configBeneficio` schema.
  5. Importação CSV em massa.
  6. Portal conveniado é extensão do portal cooperado.
  7. Cron diário de reconciliação.

---

### 4.3 — Modelo Cobrança GD

**Análise consolidada:**

**Spec tem fórmulas que diferem do que está em PRODUTO.md/REGULATORIO?**
- 🟡 Parcialmente — Modelo A ("tarifa unitária da fatura") **bate com COMPENSADOS atual**; Modelo B ("valor cheio reconstruído") é alternativa.

**Spec considera Fio B no cálculo?**
- 🔴 NÃO — Decisão pendente: pergunta 3 explícita: *"incorporar no cálculo agora ou deixar para depois?"*
- **Compatível** com Doc-0 atual: Sprint 5 trata Fio B; Sprint 2 valida COMPENSADOS sem Fio B antes.

**Algo que muda DINAMICO ou COMPENSADOS?**
- 🟡 Insumo importante: spec usa **tarifa real EXTRAÍDA da fatura** (Modelo A), não tarifa cadastrada — diferente do COMPENSADOS atual em produção. **Sprint 2 deve adotar Modelo A** se diagnóstico de fatura real (commit `5ae9dfd`) confirmar viabilidade.

**Insumo bonus:** 5 cooperados de teste documentados (Cláudio 628 kWh, Balthazar 13.217 kWh, Patricia acumulando, Rodrigo FIFO múltiplo, RCA saldo zero). Lacuna L13.

---

### 4.4 — Modo Observador

**Análise consolidada:**

**Cenário (a) Funcionalidade prevista mas nunca documentada no PRODUTO?**
- 🟢 **SIM, este é o caso.** PROPOSTA-MODO-OBSERVADOR-2026-03-26 foi **implementada** entre 26/03 e 28/04 mas PRODUTO.md atual **omite**.

**Cenário (b) Conceito que evoluiu pra outra coisa?**
- 🔴 NÃO. Mantém nome.

**Cenário (c) Spec abandonado?**
- 🔴 NÃO — funcionalidade ATIVA.

**Estado:**
- 🟢 Schema: `ObservacaoAtiva`, `LogObservacao`.
- 🟢 Cron `EVERY_5_MINUTES` em `observador/observador`.
- 🟢 Tela `/dashboard/observador`.
- 🟡 Funcionalidades avançadas (intervenção, alertas, replay) não confirmadas.

**Conclusão:** lacuna L1 estruturante. **PRODUTO.md precisa ganhar Camada 12 — Modo Observador** (ou subsection em Camada 10).

---

## 5. Ajustes factuais consolidados (PARTE 5) — checklist

### 5.1 — "Assis" não é pessoa ✅ CONFIRMADO

Evidências catalogadas:
- `ESTRATEGIA-INOVACAO-2026.md:226` — *"Documento gerado por Assis — assistente IA da CoopereBR"*
- `ESTRATEGIA-COOPERTOKEN-COMPLETA.md:211` — *"Documento gerado por Assis 🤝 — CoopereBR"*
- `SPEC-COOPERTOKEN-v1.md:4` — *"Autor: Assis (IA assistente CoopereBR)"*
- `SPEC-COOPERTOKEN-v1.md:733` — *"Documento gerado por Assis — assistente IA da CoopereBR"*
- `PROPOSTA-GD1-GD2-FIOB-2026-03-26.md:188` — *"Documento gerado por Assis"*
- `PROPOSTA-MODO-OBSERVADOR-2026-03-26.md:184` — *"Documento gerado por Assis"*
- `MODELO-COBRANCA-GD-2026-04-01.md` — não menciona autor
- `COOPERTOKEN-FUNDAMENTOS.md:1` — *"Autor: Assis + Luciano"*

**Conclusão:** "Assis" é **assistente IA da CoopereBR** (programa OpenClaw, conforme contexto Luciano). Não é colaborador humano. Aplicar correção em todos os 7 lugares listados no prompt.

### 5.2 — SISGD ainda não tem cliente em produção ⚠️ A APLICAR

PRODUTO.md atual (linhas 20-26 do Sumário Executivo) sugere 2 parceiros em produção. **Realidade:** SISGD não tem cliente em produção. CoopereBR + Sinergia operam em sistema legado, aguardando migração.

### 5.3 — "juiz TJES" remover ⚠️ A APLICAR

PRODUTO.md linha 20 atual. Remover, generalizar pra "empresa dona do SISGD".

### 5.4 — Limite 25% NÃO se aplica a GD I ⚠️ A APLICAR

PRODUTO.md (linha 147 + Apêndice C) e REGULATORIO-ANEEL.md (Seção 5 + Caso A) tratam limite 25% como aplicável a TODAS as classes GD. **Errado.** GD I tem direitos adquiridos pré-Lei 14.300, sem limite até **2045** (Lei 14.300 art. 26).

### 5.5 — Caso A (Exfishes) reescrever ⚠️ A APLICAR

Narrativa atual omite que (a) ocorreu no sistema legado, (b) GD I não tem limite 25%, (c) realocação foi consciente, (d) falta foi de simulação prévia.

### 5.6 — `CONTEXTO-JURIDICO.md` verificar ✅ CONFIRMADO EXISTE

- Caminho: `docs/historico/recebidos-2026-04-28-claude-ai/CONTEXTO-JURIDICO.md`
- Tamanho: 10.514 bytes
- Data: 28/04/2026 08:04
- **EXISTE** — referência em REGULATORIO-ANEEL.md linha 938 está correta.

### 5.7 — Conversão Express → Cooperado ⚠️ A APLICAR

REGULATORIO-ANEEL.md linha 642 afirma "Conversão esperada: Express → Completo > 5%, Completo → Cooperado > 30%". **Marcar como hipótese a validar com mercado**, não meta estabelecida.

---

## 6. Recomendações pra Prompt 2

### Prioridade ALTA (factuais críticos — aplicar primeiro)

1. **Ajuste 5.1** — "Assis" não é pessoa (8 lugares: PRODUTO Apêndice C, REGULATORIO Seção 3+16, débitos D-30L, sessão 30/04, mapeamento, CONTROLE-EXECUCAO, memória).
2. **Ajuste 5.2** — SISGD não tem cliente em produção (PRODUTO Sumário Executivo).
3. **Ajuste 5.3** — Remover "juiz TJES" (PRODUTO linha 20).
4. **Ajuste 5.4** — Limite 25% NÃO se aplica a GD I + nota "isento até 2045 por direitos adquiridos" (PRODUTO + REGULATORIO).
5. **Ajuste 5.5** — Reescrever narrativa Caso A (Exfishes) com nuances corretas (sistema legado, GD I sem limite, realocação consciente, falta simulação prévia).
6. **Ajuste 5.7** — Marcar conversão Express → Cooperado como hipótese (REGULATORIO Seção 11.6).

### Prioridade MÉDIA (lacunas estruturantes — adicionar conteúdo)

7. **L1 — Modo Observador** — adicionar Camada 12 ou subsection em Camada 10 do PRODUTO.md. Funcionalidade ATIVA não documentada.
8. **L5 — Convênios** — expandir Camada 8 com sub-seção dedicada cobrindo 7 princípios essenciais (independência, único convênio, SEM_UC, faixas JSON, GLOBAL/STANDALONE, importação CSV, portal extensão).
9. **L4 — 600.000 kWh represados** — adicionar Caso D em REGULATORIO-ANEEL.md Seção 16 (Casos Reais).
10. **L2 — FCFS** — adicionar mini-seção em Camada 7 ou Camada 8 do PRODUTO.md marcando 🔴 (planejado).
11. **L3 — VPP** — adicionar parágrafo no Sumário Executivo de PRODUTO.md como visão estratégica de longo prazo.
12. **L9 — Lei 14.300 Art. 4° §1° (exceção cooperativista)** — adicionar em REGULATORIO-ANEEL.md Seção 1 ou Seção 2.
13. **L13 — 5 cooperados de teste documentados** — referenciar em Sprint 0 de PLANO-ATE-PRODUCAO.md.
14. **C1 — Hardcode 0.20 sem origem** — atualizar D-29A em débitos com nota "0.20 não tem origem documentada — bug confirmado".
15. **C2 — Conflito interno specs CooperToken** — registrar em CONTROLE-EXECUCAO.md como decisão pendente: qual mecânica de expiração adotar (12m flat / 29d+decay / 29d+90d).

### Prioridade BAIXA (refinamentos opcionais)

16. **L6 — Eletroposto CoopereBR** — mencionar no roadmap.
17. **L7 — Eletromobilidade EV** — mencionar no roadmap.
18. **L8 — Tokenomics detalhado** — adicionar nota em Camada 8.
19. **L10/L11 — Token Flex/Social** — mencionar no roadmap como Fases 2/3.
20. **L12 — Curtailment** — opcional adicionar como nota.
21. **D1, D2, D3, D4, D5, D6** — detalhamentos extras a aproveitar conforme contexto.

### Não aplicar (deixar como insumo histórico)

22. **C3** — terminologia "Plano Token" vs "Plano Desconto" (já evoluiu pra modoRemuneracao DESCONTO/CLUBE).
23. **C4** — modelos comerciais ESSENCIAL/JUSTO/DINÂMICO/PREMIUM (terminologia paralela; não conflita).
24. **O1, O2, O3, O4** — specs parcialmente superados, manter como insumos históricos referenciados.

---

## 7. Síntese executiva

| Métrica | Valor |
|---|---|
| Specs avaliados | 7 (de 8 totais; 1 já validada anteriormente) |
| Linhas lidas | 3.366 |
| Tamanho lido | 120 KB |
| Contradições diretas | 4 (1 estruturante: hardcode 0.20 sem origem) |
| Lacunas no doc atual | 13 (5 estruturantes) |
| Detalhamentos extras a aproveitar | 6 |
| Specs parcialmente superados | 4 |
| Ajustes factuais confirmados | 7 (1 verificação já confirmada) |
| Recomendações pra Prompt 2 | 24 (6 prio ALTA, 9 prio MÉDIA, 6 prio BAIXA, 3 não aplicar) |

**Achados mais surpreendentes:**

1. **Modo Observador foi implementado mas PRODUTO.md omite** — funcionalidade ATIVA não documentada (lacuna L1 estruturante).
2. **Hardcode `valorTokenReais = 0.20` não tem ORIGEM em nenhum spec** — confirma D-29A como bug puro, não decisão.
3. **3 specs do CooperToken não batem entre si na expiração** (12m flat / 29d com decay / 29d + 90d) — controvérsia interna nunca resolvida.
4. **PLANO-CONVENIOS é 300× maior que cobertura no PRODUTO.md** — módulo subdocumentado.
5. **600.000 kWh represados na CoopereBR** é problema regulatório central documentado mas não no Doc-0.
6. **FCFS (Fundo Cooperativo de Fomento Solar)** é conceito tributário/contábil novo aprovado em 02/04 e nunca implementado.
7. **VPP (Virtual Power Plant)** é o framing estratégico de longo prazo do produto — totalmente ausente do Doc-0 atual.

---

*Validação read-only. Conduzida por Claude Code (Opus 4.7) em 2026-04-30 noite. Nenhum arquivo de produção alterado. Insumo direto pra Prompt 2.*
