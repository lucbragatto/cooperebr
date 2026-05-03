# PONTO DE RETOMADA — CoopereBR
> Atualizado em 18/04/2026 após auditoria crítica do Sprint 4.
> Substitui o RETOMADA-SESSAO.md anterior (17/04/2026).
>
> ⚠️ **OBSOLETO PARCIAL (03/05/2026)** — referências a `FORMULAS-COBRANCA.md`
> estão **desatualizadas**. Este documento foi superado pelas seguintes fontes:
> - `docs/CONTROLE-EXECUCAO.md` — estado vivo do projeto (atualizado a cada sessão)
> - `docs/especificacao-modelos-cobranca.md` — spec atual dos 3 modelos
> - `docs/referencia/REGRAS-PLANOS-E-COBRANCA.md` — fórmulas detalhadas (substitui FORMULAS-COBRANCA)
> - `docs/sessoes/2026-05-03-investigacao-engine-compensados.md` — investigação técnica D-30R
>
> Mantido neste local pra histórico. NÃO usar pra decisões atuais.

---

## CONTEXTO RÁPIDO PARA NOVA SESSÃO

Você é um engenheiro sênior trabalhando no **CoopereBR** — SaaS para gestão de cooperativas/consórcios/condomínios de energia solar distribuída. Multi-tenant. Stack: NestJS + Prisma + PostgreSQL (Supabase) + Next.js 16.

**Leia estes arquivos em ordem antes de qualquer ação:**
1. `CONTEXTO-CLAUDEAI.md` — visão geral, regras de negócio, convenções
2. `FORMULAS-COBRANCA.md` — fonte única de verdade sobre cálculo por modelo
3. Este arquivo — estado atual e plano dos próximos sprints

**Regra de ouro:** uma tarefa por vez. Propõe → aprova → executa → testa → aprova resultado → próxima.

---

## ESTADO ATUAL (18/04/2026)

### O que foi concluído
| Marco | Status |
|---|---|
| Sprint 1 a 4 | ✅ Implementados (algumas partes com problemas, ver abaixo) |
| 4 bugs P2 corrigidos (BUG-002, 015-001, 011-003, CALCULO-001) | ✅ |
| Plano de testes executado (7/8 PASS + 1 parcial) | ✅ |
| Bug descoberto em testes: `@IsOptional` ausente em Planos DTOs | ✅ Corrigido |
| Auditoria crítica do Sprint 4 | ✅ Executada (18/04) |

### O que a auditoria revelou (18/04)

**Achado P0 estrutural:** existem DUAS engines de cobrança:

1. `cobrancas.service.calcularCobrancaMensal()` — **ÓRFÃ, nunca chamada**. Contém toda a lógica do Sprint 4 (consumo mínimo, bandeira automática, cascata de desconto). Basicamente, Sprint 4 não entrou em produção.

2. `faturas.service.gerarCobrancaPosFatura()` — **viva, roda ao aprovar FaturaProcessada**. Lógica mais antiga, simplificada, mas com bug de aplicar desconto em todos os modelos (deveria aplicar só em DINAMICO).

**Exposição financeira real: ZERO.** 
- 42 cobranças no banco, todas de dados de teste migrados do sistema antigo
- CPFs `111.111.111-11`, `222.222.222-22`, etc.
- Nomes "Maria Silva", "João Santos", etc.
- Nenhum cooperado real foi afetado
- Zero cobranças em CREDITOS_COMPENSADOS ou CREDITOS_DINAMICO no sistema inteiro

**Conclusão:** temos espaço para refatoração calma antes do primeiro cooperado real ser cobrado.

---

## DECISÕES FECHADAS NESTA SESSÃO (17-18/04)

### Vocabulário EDP
- `energiaCompensada` = `energiaInjetada` (mesmo valor, quadros diferentes da fatura)
- Código padroniza em `energiaCompensada`, com comentário inline esclarecendo

### Fórmulas corretas por modelo
Ver `FORMULAS-COBRANCA.md`. Decisões principais:
- **FIXO_MENSAL:** `valorContrato` fixo, sem desconto (embutido), sem consumo mínimo. Bandeira só se admin aplicar.
- **CREDITOS_COMPENSADOS:** `energiaCompensada × tarifaContratual`. Desconto e bandeira histórica JÁ EMBUTIDOS na tarifa. Bandeira do mês só se admin aplicar.
- **CREDITOS_DINAMICO:** `energiaCompensada × (valorFatura/consumoBruto) × (1 − descontoBase)`. Bandeira NUNCA aplicada (dupla contagem garantida).

### Consumo mínimo
- **Só no motor de proposta**, no dimensionamento inicial (`kwhContratoMensal = media − minimo`)
- **Nunca** na cobrança mensal
- Sprint 4 errou ao deduzir mínimo na cobrança — código a remover (mas estava só na engine órfã, sem impacto)

### Bandeira — cascata híbrida
- `Cooperativa.politicaBandeira: APLICAR | NAO_APLICAR | DECIDIR_MENSAL`
- `Usina.politicaBandeira: HERDAR | APLICAR | NAO_APLICAR | DECIDIR_MENSAL` (override)
- `Cobranca.bandeiraAplicada: Boolean?` (override pontual pré-envio)
- Exceção absoluta: modelo DINAMICO ignora a cascata, nunca aplica

### Fio B (Lei 14.300/2022)
- Cronograma progressivo para usinas homologadas a partir de 07/01/2023
- 2026: 60% | 2027: 75% | 2028: 90% | 2029+: 100%
- **Não é cálculo mensal** — entra embutido na tarifa contratual (COMPENSADOS) ou no valor (FIXO)
- Pré-requisito: `Usina.dataHomologacao` obrigatório no schema (ainda não existe)
- Tratamento detalhado fica para sprint futuro

### Fatura unificada — variante LEVE
- Sistema recebe fatura EDP, extrai dados de pagamento (código barras, QR PIX)
- Emite cobrança da cooperativa + **reexibe** dados EDP na mesma tela
- Cooperado faz dois pagamentos mas interface unificada
- Zero risco regulatório, sem split real, sem custódia de dinheiro de terceiros
- Variante PESADA (split real via Asaas) fica para depois, condicionada a aceite da EDP ES

### Lista de rateio (para EDP)
- **Output do sistema**, não input
- Gerada/atualizada sempre que há alteração de cooperados ou percentuais na usina
- Formato: UC / cooperado / CPF / % (mínimo 2 casas decimais, formato 0,00%)
- Tela de visualização + exportador de planilha (formato específico EDP — modelo pendente)

### Rebalanceamento multi-usina
- Regra: 1 cooperado/UC = 1 usina (créditos não fracionam)
- Se cooperado novo não cabe em usina sozinha, sistema propõe cadeia de movimentações
- Admin aprova atomicamente → transação executa N movimentações + regera N listas de rateio
- Nunca automático

### GeracaoMensal — separação conceitual
- Entidade atual mistura "projetada" (cadastro da usina) e "efetiva" (leitura EDP) em campo livre
- Precisa virar enum: `fonte: PROJETADA | EFETIVA_EDP | MEDIDOR_USINA`
- **Nova entidade** `ProducaoMensalConcessionaria` (ou similar) — armazena leitura da EDP do relatório mensal (hoje PDF baixado manualmente do portal)
- Cruzamento automático entre leitura EDP e soma das FaturaProcessada do mês → alerta se divergir

---

## PLANO DOS PRÓXIMOS SPRINTS

### Sprint 5 — Refatoração da Engine de Cobrança (PRIORIDADE)

**Objetivo:** engine única ramificada por modelo, calculando correto conforme `FORMULAS-COBRANCA.md`.

**Pré-condição:** congelar criação de contratos em CREDITOS_COMPENSADOS e CREDITOS_DINAMICO até Sprint 5 terminar. Adicionar validação no backend que bloqueia esses modelos temporariamente. FIXO_MENSAL continua funcionando.

**Sub-tarefas:**

1. **Schema — migration de campos faltantes:**
   - `Contrato.valorContrato: Decimal?` (FIXO_MENSAL)
   - `Contrato.tarifaContratual: Decimal?` (COMPENSADOS)
   - `Contrato.dataUltimoReajusteTarifa: DateTime?`
   - Histórico de reajustes de tarifa (entidade nova `HistoricoReajusteTarifa` ou campo JSON)
   - `Cobranca.valorTotalFatura: Decimal?` (DINAMICO auditoria)
   - `Cobranca.consumoBruto: Float?` (DINAMICO auditoria)
   - `Cobranca.tarifaApurada: Decimal?` (DINAMICO auditoria)
   - `Cobranca.tarifaContratualAplicada: Decimal?` (COMPENSADOS snapshot)
   - `Cobranca.modeloCobrancaUsado: enum` (snapshot do modelo)
   - `Cobranca.bandeiraAplicada: Boolean?`
   - `Cooperativa.politicaBandeira: enum` (substitui `bandeiraAtiva` boolean)
   - `Usina.politicaBandeira: enum`
   - Validação: FIXO exige `valorContrato`, COMPENSADOS exige `tarifaContratual`

2. **Engine unificada:**
   - Matar `cobrancas.service.calcularCobrancaMensal` (a órfã)
   - Refatorar `faturas.service.gerarCobrancaPosFatura` para ramificar por `modeloEfetivo`
   - Aplicar fórmula correta por modelo (ver FORMULAS-COBRANCA.md)
   - Persistir `faturaProcessadaId` sempre (já funciona)
   - Persistir campos de auditoria conforme modelo

3. **Bandeira — cascata híbrida:**
   - Implementar resolução `Cobranca.bandeiraAplicada ?? Usina.politicaBandeira ?? Cooperativa.politicaBandeira`
   - Bloquear aplicação em DINAMICO mesmo se cascata disser "aplicar"
   - Migrar `Cooperativa.bandeiraAtiva` boolean para enum

4. **Matching FaturaProcessada → Cobranca:**
   - Adicionar `ucId` no filtro do `findFirst`
   - Unique constraint `(contratoId, mesReferencia, anoReferencia)` na Cobranca
   - Erro claro se tentar gerar cobrança duplicada

5. **Interface admin de bandeiras (Sprint 5A que faltou):**
   - `/dashboard/configuracoes/bandeiras`
   - Configurar política por cooperativa (enum)
   - Grid de bandeiras configuradas (período/valor)
   - Modal criar/editar bandeira
   - Override por usina (cascata)

6. **Saneamento dos 12 contratos órfãos (sem planoId):**
   - Script one-shot: vincular a plano correspondente ou marcar como LEGADO
   - Dados de teste podem ser apagados se preferir

7. **Testes:**
   - Unitários por modelo (FIXO, COMPENSADOS, DINAMICO)
   - Integração: aprovar FaturaProcessada → gerar Cobrança correta
   - Edge cases: cooperado multi-UC, override pontual de bandeira, DINAMICO ignorando cascata

### Sprint 6 — Pipeline Email + Produção EDP

**Pré-requisitos ambientais:**
- TLS IMAP escopado (correção segura do Kaspersky: env var `IMAP_ALLOW_SELF_SIGNED=true` só em dev)
- `ADMIN_WHATSAPP_NUMBER` configurado no .env
- Configurar `email.monitor.config` no ConfigTenant (senha criptografada, não plaintext)

**Sub-tarefas:**
1. Fallback de notificação: toda FaturaProcessada cria Notificação no banco (independente do WA)
2. Backfill dos 4 `statusRevisao=PENDENTE_REVISAO` inconsistentes
3. Promover campos OCR (consumoKwh, energiaInjetada, energiaCompensada) do histórico para o root do dadosExtraidos
4. **Nova entidade `ProducaoMensalConcessionaria`:**
   - Upload manual do PDF do relatório EDP mensal por usina
   - OCR via Claude
   - Unique `(usinaId, competencia)`
   - Tela dedicada: `/dashboard/usinas/:id/producao-edp`
5. **Cruzamento automático:**
   - Job ou trigger: soma `FaturaProcessada.energiaCompensada` do mês por usina vs `ProducaoMensalConcessionaria.kwhLido`
   - Alerta se divergência > 5%
6. **`GeracaoMensal.fonte` como enum** (PROJETADA | EFETIVA_EDP | MEDIDOR_USINA)
7. **Fatura unificada LEVE:**
   - Extrair do OCR EDP: código de barras, linha digitável, QR Code PIX
   - Persistir em `FaturaProcessada.dadosPagamentoEDP` (JSON)
   - Transportar para a Cobrança emitida
   - UI: cobrança cooperativa em destaque + box "Sua conta de luz EDP" com dados de pagamento
   - Envio: ao notificar cobrança, anexar também a fatura EDP original
   - Vencimento: data da cobrança cooperativa deve ser sincronizada com vencimento EDP (configurável)

### Sprint 7 — Lista de Rateio + Rebalanceamento Multi-Usina

**Sub-tarefas:**
1. **Entidade `ListaRateio` versionada:**
   - Snapshot por `(usinaId, competencia, versao)` 
   - Payload: array de `{cooperadoId, ucId, cpf, nome, percentual, kwhEsperado}`
   - Regeneração a cada alteração de cooperados ou percentuais
2. **Tela `/dashboard/usinas/:id/rateio`:**
   - Exibe lista atual com percentuais em 2 casas decimais (0,00%)
   - Histórico de versões
3. **Exportador de planilha no formato EDP:**
   - Aguardando modelo específico da EDP ES (pendência do Luciano)
4. **Algoritmo de rebalanceamento:**
   - Entrada: novo cooperado + kWh necessário + distribuidora
   - Busca 1: usina da mesma distribuidora com sobra suficiente → aloca direto
   - Busca 2: combinação de movimentações que libera espaço em alguma usina → propõe
   - Gera `PropostaRebalanceamento` (cadeia de movimentações, resultado esperado)
5. **Aprovação e execução atômica:**
   - Admin vê proposta completa
   - Aprova → transação executa N movimentações + regera N listas de rateio
   - Nenhuma movimentação sem aprovação
6. **Portal cooperado multi-contrato (bug do doc 14/Abr):**
   - `/portal/financeiro` deve mostrar cobranças de TODOS os contratos do cooperado

---

## BACKLOG — FORA DO ESCOPO IMEDIATO

Ordenado por ordem natural de abordar:

### Correções pontuais (podem entrar em qualquer sprint)
- Fluxo de assinatura digital acionado automaticamente após proposta (hoje infra existe mas não roda)
- Lembrete automático se não assinar em 24h
- Validações CPF/nome em `/cooperados/cadastroWeb` (comentadas no código)
- CORS `*` no whatsapp-service porta 3002 → restringir
- 3 crons conflitando às 6h AM → escalonar 6h00/6h15/6h30
- `/planos/ativos` ainda `@Public()` sem ler JWT quando autenticado
- Rota `/dashboard/configuracoes/documentos` não linkada no menu

### Features maiores
- **Fio B** (Lei 14.300/2022) — cálculo e reajuste de tarifa contratual
- **Integração D4Sign/ClickSign** — assinatura digital legal
- **Fatura unificada PESADA** (split real) — depende de aceite formal da EDP ES
- **TipoCooperado.AGREGADOR** — caso Hangar (MLM por papel, Academia + professores + alunos)
- **Integração Sungrow** — GeracaoMensal automática via inversor
- **Automação ANEEL bandeira** — job mensal busca valor oficial
- **Desconto maior por indicação** (`/cadastro?ref=`)

### Qualidade
- DTOs com `class-validator` em todos os endpoints
- Paginação nas listagens
- Audit trail para Contrato e Usina (Cooperado já tem)
- Testes unitários nos fluxos críticos
- Soft delete + verificação dependências ao deletar

---

## DÍVIDAS TÉCNICAS DE SCHEMA (consolidadas)

Todas precisam entrar via migration no Sprint 5 ou Sprint 6:

**Sprint 5:**
- `Contrato.valorContrato`, `Contrato.tarifaContratual`, `Contrato.dataUltimoReajusteTarifa`
- `Cobranca.valorTotalFatura`, `consumoBruto`, `tarifaApurada`, `tarifaContratualAplicada`, `modeloCobrancaUsado`, `bandeiraAplicada`
- `Cooperativa.politicaBandeira` (substitui `bandeiraAtiva`)
- `Usina.politicaBandeira`
- `FaturaProcessada.dadosPagamentoEDP` (JSON com código barras, QR PIX, linha digitável)

**Sprint 6:**
- `GeracaoMensal.fonte` (enum)
- Nova tabela `ProducaoMensalConcessionaria`
- `FaturaProcessada` promover campos OCR root

**Sprint 7:**
- Nova tabela `ListaRateio` (versionada)
- Nova tabela `PropostaRebalanceamento`

**Futuro (Fio B):**
- `Usina.dataHomologacao` (obrigatório)

---

## ENV VARS OBRIGATÓRIAS

```
DATABASE_URL, DIRECT_URL, SUPABASE_SERVICE_ROLE_KEY,
WHATSAPP_WEBHOOK_SECRET, ASAAS_API_KEY, ANTHROPIC_API_KEY,
NEXT_PUBLIC_MODO_TESTE, NOTIFICACOES_ATIVAS=true,
CADASTRO_V2_ATIVO=true, ADMIN_WHATSAPP_NUMBER=5527...
```

Sprint 6 adicionará: `IMAP_ALLOW_SELF_SIGNED` (só dev, nunca produção)

---

## OPÇÕES PARA NOVA SESSÃO

1. **Iniciar Sprint 5** — refatoração da engine de cobrança
2. **Congelamento prévio** — adicionar validação que bloqueia criação de contrato em COMPENSADOS/DINAMICO até Sprint 5 terminar (proteção enquanto refatora)
3. **Investigar dúvidas específicas** antes de começar Sprint 5
4. **Detalhar tarefa granular do Sprint 5** (ex: "faça só a migration de campos, sem tocar em service")

Recomendação: começar pelo **passo 2** (congelamento) porque é pequeno, seguro, e libera para refatorar com tranquilidade.

---

_Próxima atualização deste arquivo: ao final do Sprint 5._
