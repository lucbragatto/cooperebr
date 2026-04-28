# PLANO ATÉ PRODUÇÃO — SISGD

> **Audiência:** Luciano (não-programador, dono do SISGD)
> **Última atualização:** 2026-04-26 (madrugada)
> **Status:** roteiro de execução das próximas ~12 semanas
> **Documentos vivos relacionados:**
> - `docs/SISGD-VISAO-COMPLETA.md` (mapa em linguagem humana — quem usa, o que falta)
> - `docs/MAPA-INTEGRIDADE-SISTEMA.md` (estado técnico atual, sprint a sprint)
> - `docs/debitos-tecnicos.md` (lista consolidada de pendências)

---

## Seção 1 — Filosofia do plano

Este documento existe pra responder uma pergunta simples: **o que falta pro SISGD entrar em produção real, com parceiros pagando, sem o Luciano ter que torcer pra dar certo?**

A resposta NÃO é "implementar mais coisas". O SISGD já tem 70+ models, 44 módulos backend e 20+ páginas frontend. O código existe — o que falta é **cola operacional**: telas que o Luciano use pra acompanhar (governança), automatismos que rodem sozinhos (FaturaSaas, lembretes), engines de cálculo que cubram os 3 modelos (FIXO ✅ pronto, COMPENSADOS 🔴 falta, DINAMICO 🔴 falta), conferência com a concessionária (lista compensação, lista homologação) e — só no fim — uma camada de pré-produção real (Asaas em produção, Sungrow ligado, e2e Playwright passando ponta a ponta).

A ordem dos 15 sprints abaixo respeita uma lógica: **primeiro destravar o que já existe** (webhook Asaas em produção, cron de FaturaSaas, painel Luciano), **depois preencher os modelos de cobrança que faltam** (COMPENSADOS antes de DINAMICO, porque é mais usado), **depois construir governança** (DRE, conciliação, painéis síndico, audit trail), **e por último endurecer pra parceiro real** (templates, login facial, e2e completo, pré-produção).

A regra de ouro é: **cada sprint entrega algo testável em isolamento**. Nenhum sprint deixa o sistema pior do que estava. Sprint 17 (engine COMPENSADOS) é o mais arriscado — exige snapshot do banco antes, porque mexe em cálculo de cobrança real que afeta dinheiro de cooperado. Sprints 12-13-14 são "destrava o que já tá feito" — baixo risco. Sprints 23-26 são "endurecer pra produção" — médio risco mas alta visibilidade.

**Importante:** este plano NÃO é contratual. Cada sprint encerra com Luciano validando o que foi entregue antes de abrir o próximo. Se algo der errado no meio, parar, ajustar, voltar. **8-12 semanas é estimativa, não promessa.**

---

## Seção 2 — Sprints organizados (Sprint 12 a 26)

Formato fixo pra cada sprint:

- **Pra quê serve** — em uma frase, qual problema resolve
- **Quem ganha** — qual papel humano se beneficia (cooperado, síndico, admin parceiro, Luciano…)
- **Tempo estimado** — em dias úteis
- **Pré-requisito** — sprint anterior obrigatório
- **Bloqueia** — sprints futuros que dependem deste
- **Tarefas** — lista executável
- **Critério "passou"** — como saber que terminou
- **Risco** — baixo / médio / alto + motivo
- **Custo** — código, infra, dependência externa

---

### Sprint 12 — Webhook Asaas em produção real

> **Status atualizado 27/04/2026:** sandbox 100% validado em sessão dedicada (commit `16302e9`, ver `docs/sessoes/2026-04-27-webhook-asaas-sandbox-validado.md`). 3 bugs descobertos e corrigidos no caminho. Sprint reduzido a ~1 dia quando Luciano abrir conta Asaas em produção.

- **Pra quê serve:** garantir que pagamentos PIX/boleto recebidos pela conta Asaas atualizam automaticamente as cobranças no sistema (`PAGA`).
- **Quem ganha:** Luciano (parou de conciliar manual), cooperado (vê status atualizado em tempo real), admin parceiro (não precisa marcar pago à mão).
- **Tempo estimado:** ~1 dia (era 3 antes da validação sandbox).
- **Pré-requisito:** Luciano abrir conta Asaas em produção.
- **Bloqueia:** Sprint 14 (FaturaSaas), Sprint 22 (conciliação).
- **Tarefas restantes pra produção:**
  1. ~~Configurar webhook em sandbox~~ ✅ feito 27/04
  2. ~~Validar token timing-safe + idempotência~~ ✅ feito 27/04
  3. ~~Confirmar criação de LancamentoCaixa nos 2 modos~~ ✅ AGOSTINHO CLUBE + ADRIANA DESCONTO
  4. Criar conta Asaas em produção (Luciano)
  5. Trocar `AsaasConfig.apiKey` e `webhookToken` da CoopereBR pra credenciais produção
  6. Apontar webhook do dashboard produção pra URL pública (domínio fixo ou ngrok produção)
  7. Smoke test: 1 PIX real R$ 1 → webhook → PAGA + LancamentoCaixa
  8. Documentar em `docs/operacao/asaas-producao.md`
- **Critério "passou":** 1 PIX real de R$ 1,00 entra, webhook chega, cobrança vira `PAGA` sem intervenção manual, log `LancamentoCaixa REALIZADO` registrado.
- **Risco:** baixo. Código validado em sandbox; só falta credencial produção.
- **Custo:** R$ 0 (Asaas tem teste grátis até X transações). Dependência externa: Luciano abre conta.

---

### Sprint 13 — Painel do Luciano (governança SaaS) — DIVIDIDO em 13a/13b/13c

> **Decisão 28/04/2026:** sprint dividido em 3 fatias entregáveis (não monolítico). Critério de divisão: cada fatia entrega valor independente e fica testável em 1-3 dias.

#### Sprint 13a — Painel super-admin (visão consolidada)

- **Pra quê serve:** tela consolidada com métricas SaaS — saúde do negócio em 30 segundos.
- **Tempo estimado:** 3 dias úteis.
- **Pré-requisito:** nenhum (Sprint 12 produção pode rodar em paralelo).
- **Bloqueia:** Sprint 13b, Sprint 13c, Sprint 14.

**Dia 1 — Painel SISGD (✅ 28/04/2026, commit `7f29bd6`):**
- ✅ AuditLog model + migration + 4 índices
- ✅ 4 índices cross-tenant em `cobrancas`, `cooperados`, `faturas_saas`
- ✅ `MetricasSaasService` + endpoint `GET /saas/dashboard`
- ✅ Tela `/dashboard/super-admin` com 5 cards
- ✅ Sidebar reorganizada com link "Painel SISGD"
- ✅ Specs Jest 4/4 passing

**Dia 1 — Saneamento P0 (✅ 28/04/2026, commit `0d53773`):**
- ✅ Snapshot banco
- ✅ Limpeza CoopereVerde + Conosórcio Sul (cooperativas-fantasma)
- ✅ CoopereBR Teste vinculada plano PRATA TRIAL
- ✅ FaturaSaas teste R$ 5.900 vencida pra exercitar painel
- ✅ Refactor `gerarFaturaParaCooperativa` exposto público

**Dia 2 — Lista de parceiros enriquecida (próximo):**
1. `/dashboard/super-admin/parceiros` — lista todos os tenants
2. Card por parceiro: nome, tipo, MRR estimado, última FaturaSaas, status, taxa inadimplência cooperados
3. Filtros: ativos, inadimplentes, TRIAL, em onboarding
4. Ordenação: por MRR, por inadimplência, por data ativação
5. Smoke test do fluxo

**Dia 3 — Detalhe do parceiro:**
1. `/dashboard/super-admin/parceiros/[id]` — visão profunda 1 parceiro
2. Métricas: histórico FaturaSaas, evolução cooperados, evolução receita
3. Indicadores de saúde: churn, retenção, taxa pagamento em dia
4. Smoke test integrado (painel → lista → detalhe → ação)

- **Critério "passou":** Luciano abre `/dashboard/super-admin`, vê resumo. Clica em um parceiro, vê detalhe completo. Identifica em 30s qual está atrasado.
- **Risco:** baixo (só leitura).
- **Custo total:** ~1500 linhas (Dia 1 já consumiu ~570).

#### Sprint 13b — AuditLog ativo + Impersonate

- **Pra quê serve:** Luciano poder "entrar como" um admin parceiro pra dar suporte, com tudo registrado pra LGPD/compliance.
- **Tempo estimado:** 3-4 dias úteis.
- **Pré-requisito:** Sprint 13a Dia 3.
- **Bloqueia:** Sprint 22 (audit trail global expande este).
- **Tarefas:**
  1. `AuditLogInterceptor` NestJS — captura ações sensíveis automaticamente
  2. Helper `auditLog.gravar(acao, recurso, metadata)` pra usar em services
  3. Decorator `@Auditavel({ acao: 'cooperativa.suspender' })`
  4. Endpoint `POST /saas/impersonate/:cooperativaId` (gera JWT temporário com `impersonating=true`)
  5. Banner visível em todas as telas quando `impersonating === true`
  6. `POST /saas/impersonate/sair` (volta pro próprio JWT)
  7. Tela `/dashboard/super-admin/audit-logs` — busca/filtros + export CSV
  8. Cache 5min no dashboard agregado (Sprint 13a deixou TODO)
- **Critério "passou":** Luciano impersona admin Hangar, vê dashboard como ele veria, sai do impersonate, abre audit log e vê todas ações registradas com flag `impersonating=true`.
- **Risco:** médio (segurança crítica).
- **Custo:** ~1000 linhas + decisão sobre criptografia metadata.

#### Sprint 13c — Edição de plano SaaS + suspensão de parceiro

- **Pra quê serve:** Luciano poder mudar plano de um parceiro, suspender por inadimplência, reativar — sem mexer no banco direto.
- **Tempo estimado:** 2-3 dias úteis.
- **Pré-requisito:** Sprint 13b.
- **Bloqueia:** Sprint 14 (cron precisa saber quais estão suspensos).
- **Tarefas:**
  1. Botão "Alterar plano" no detalhe do parceiro → modal com seletor + preview
  2. Endpoint `PATCH /saas/parceiros/:id/plano` (com auditoria automática via 13b)
  3. Botão "Suspender" — flag `statusSaas=SUSPENSO`, auth bloqueia login admin parceiro
  4. Botão "Reativar" — volta `ATIVO`
  5. Email automático ao admin parceiro em cada mudança (suspenso/reativado)
  6. Smoke test: mudar plano CoopereBR Teste de PRATA pra OURO, suspender, reativar
- **Critério "passou":** Luciano testa o fluxo completo, todas as ações aparecem no audit log, parceiro suspenso é bloqueado de logar.
- **Risco:** médio (impacto em login).
- **Custo:** ~600 linhas.

---

### Sprint 14 — Cron de FaturaSaas (cobrança automática dos parceiros)

- **Pra quê serve:** todo dia 1 do mês, gerar automaticamente a FaturaSaas que cada parceiro deve pro Luciano (R$ 800/mês fixo + R$ 0,30/cooperado ativo, conforme configurado).
- **Quem ganha:** Luciano (recebe sem cobrar manual), parceiro (vê valor antes de vencer).
- **Tempo estimado:** 4 dias úteis.
- **Pré-requisito:** Sprint 12 + Sprint 13.
- **Bloqueia:** Sprint 22 (conciliação financeira global).
- **Tarefas:**
  1. Cron `@Cron('0 0 1 * *')` em `saas.job.ts`
  2. Lógica: contar cooperados ativos por parceiro, gerar `FaturaSaas` no Asaas
  3. Email automático pro admin do parceiro (via `email-config.service`)
  4. Log no painel Luciano (Sprint 13)
  5. Teste E2E: rodar cron manualmente, ver fatura criada + email enviado
- **Critério "passou":** rodada manual gera 1 FaturaSaas pro CoopereBR (parceiro de teste), email chega, painel mostra status `PENDENTE`.
- **Risco:** baixo-médio. Risco é conta do parceiro receber email errado se SMTP do tenant estiver mal configurado.
- **Custo:** ~400 linhas. Depende de Sprint 12 ter Asaas em produção.

---

### Sprint 15 — Cadastro Condomínio atomizado (público)

- **Pra quê serve:** permitir que síndico cadastre o condomínio inteiro de uma vez (admin do condomínio + N condôminos via CSV ou formulário).
- **Quem ganha:** síndico (Helena de Moradas Enseada), administradora.
- **Tempo estimado:** 5 dias úteis.
- **Pré-requisito:** Sprint 14.
- **Bloqueia:** Sprint 16 (painel agregador depende de ter agregadora cadastrada).
- **Tarefas:**
  1. Criar `Cooperativa.tipoParceiro = CONDOMINIO` (já existe no enum)
  2. Fluxo `/cadastro/condominio`: síndico cadastra, sistema cria tenant + admin + UC do condomínio
  3. Importação CSV de condôminos (nome, CPF, fração ideal, email, WA)
  4. Cada condômino vira `Cooperado` com `tipo = CONDOMINIO_MEMBRO`
  5. Email convite individual (pré-cadastrado, link mágico pra confirmar)
- **Critério "passou":** Helena cadastra Moradas Enseada, importa 23 condôminos via CSV, todos recebem email convite, 1 confirma e vira ATIVO.
- **Risco:** médio. CSV import historicamente é fonte de bug.
- **Custo:** ~800 linhas (form + parser + jobs de envio).

---

### Sprint 16 — Painel Agregador (Hangar Universidade / Condomínio Moradas)

- **Pra quê serve:** Carlos (Hangar) e Helena (síndica) precisam ver consumo + economia agregada da agregadora deles, sem ver dados individuais dos cooperados.
- **Quem ganha:** Carlos, Helena.
- **Tempo estimado:** 5 dias úteis.
- **Pré-requisito:** Sprint 15.
- **Bloqueia:** Sprint 21 (painéis síndico detalhado).
- **Tarefas:**
  1. Role `AGREGADORA_ADMIN` em `roles.enum.ts`
  2. `/dashboard/agregadora` com 4 cards: total cooperados, kWh consumido mês, kWh compensado, economia total
  3. Gráfico evolução mensal (12 meses)
  4. Lista cooperados (nome + status apenas, sem CPF/valor)
  5. Acesso bloqueado a dados individuais (LGPD)
- **Critério "passou":** Carlos abre painel da Hangar, vê 18 professores+alunos, kWh agregado, economia total. Não consegue clicar em cooperado individual.
- **Risco:** baixo. Já tem dados, só falta agregação visual.
- **Custo:** ~600 linhas + 1 endpoint agregador no backend.

---

### Sprint 17 — Engine COMPENSADOS (cálculo cobrança modelo 2)

- **Pra quê serve:** sistema atualmente só cobra pelo modelo FIXO. COMPENSADOS é o modelo mais usado em cooperativas reais — cobrança proporcional ao kWh efetivamente compensado pela concessionária.
- **Quem ganha:** parceiros que usam modelo COMPENSADOS (~70% do mercado).
- **Tempo estimado:** 7 dias úteis (mais arriscado do plano).
- **Pré-requisito:** Sprint 16. **Snapshot do banco antes de começar (mandatório).**
- **Bloqueia:** Sprint 18 (DINAMICO), Sprint 22 (conciliação).
- **Tarefas:**
  1. Snapshot completo do banco dev e prod (`pg_dump`)
  2. Criar `engines/compensados.engine.ts` em `cobrancas/`
  3. Lógica: usar `FaturaProcessada.kwhCompensado` como base, aplicar `Contrato.descontoPercentual`
  4. Validação cruzada: comparar resultado COMPENSADOS vs FIXO em 10 cobranças históricas
  5. Tests unit + integração + E2E
  6. Toggle `MODELO_COMPENSADOS_ATIVO` (default false até validar)
  7. Auditoria com Luciano: rodar 3 cobranças reais simuladas antes de ligar toggle
- **Critério "passou":** 3 cobranças reais (CoopereBR) calculadas com COMPENSADOS dão valor dentro de tolerância 1% comparado ao cálculo manual em planilha.
- **Risco:** **alto**. Mexe em dinheiro real. Bug aqui = parceiro cobra cooperado errado.
- **Custo:** ~1200 linhas + suite de testes pesada. Snapshot prod (~30 min). Validação manual com Luciano (1 dia).

---

### Sprint 18 — Engine DINAMICO (cálculo cobrança modelo 3)

- **Pra quê serve:** modelo DINAMICO usa tarifa flutuante mês-a-mês conforme bandeira tarifária + Fio B + tributos. Mais complexo, menos usado, mas crítico pra alguns nichos (grandes consumidores).
- **Quem ganha:** parceiros com cooperados B3/B4 (~10% do mercado).
- **Tempo estimado:** 6 dias úteis.
- **Pré-requisito:** Sprint 17 (engine COMPENSADOS validada).
- **Bloqueia:** Sprint 22 (conciliação).
- **Tarefas:**
  1. `engines/dinamico.engine.ts`
  2. Integração com tabela `BandeiraTarifaria` (já existe)
  3. Cálculo Fio B 2026 = 60% (`rules/financeiro.md`)
  4. Validação cruzada com fatura real EDP (3 meses diferentes, 3 bandeiras)
  5. Toggle `MODELO_DINAMICO_ATIVO`
- **Critério "passou":** 3 cobranças DINAMICO (3 bandeiras: verde/amarela/vermelha) batem com fatura real ±2%.
- **Risco:** alto. Bandeiras tarifárias mudam, ANEEL publica resoluções, sistema tem que acompanhar.
- **Custo:** ~1000 linhas + tabela de bandeiras atualizada via cron mensal.

---

### Sprint 19 — DRE por parceiro (demonstrativo de resultados)

- **Pra quê serve:** admin do parceiro precisa ver receita/custo/lucro do mês — dado contábil que hoje não existe em lugar nenhum.
- **Quem ganha:** admin parceiro (decide se aumenta tarifa, se corta despesa).
- **Tempo estimado:** 5 dias úteis.
- **Pré-requisito:** Sprint 18.
- **Bloqueia:** Sprint 22 (conciliação).
- **Tarefas:**
  1. Page `/dashboard/financeiro/dre`
  2. Receita: soma `Cobranca.valor` (status PAGA) do mês
  3. Custo: soma `ContaPagar.valor` (status PAGA) — arrendamento, manutenção, FaturaSaas
  4. Lucro = Receita - Custo
  5. Comparativo 3 meses, exportar PDF
- **Critério "passou":** admin CoopereBR abre DRE de mar/2026, vê receita real, despesa real, lucro real, exporta PDF.
- **Risco:** médio. Depende de `ContaPagar` estar populado corretamente.
- **Custo:** ~500 linhas + endpoint agregador.

---

### Sprint 20 — Conciliação automática (banco vs sistema)

- **Pra quê serve:** comparar extrato bancário (Banco do Brasil / Sicoob) com cobranças `PAGA` no sistema, detectar divergências, alertar Luciano.
- **Quem ganha:** Luciano, admin parceiro.
- **Tempo estimado:** 5 dias úteis.
- **Pré-requisito:** Sprint 19. **Conta bancária produção configurada (dependência externa).**
- **Bloqueia:** —
- **Tarefas:**
  1. Integração CNAB 240 (BB e Sicoob)
  2. Cron diário `@Cron('0 8 * * *')` baixa extrato
  3. Match: `Cobranca.valor + data` vs linha CNAB
  4. Painel `/dashboard/financeiro/conciliacao` mostra divergências
  5. Alerta WA pro Luciano se ≥3 divergências
- **Critério "passou":** 1 dia de conciliação CoopereBR roda, 100% das cobranças PAGAS batem com extrato. 1 divergência fictícia gera alerta WA.
- **Risco:** médio. CNAB é formato chato, banco às vezes muda layout.
- **Custo:** ~1500 linhas (parser CNAB + lógica match + tela). Conta produção banco (Luciano).

---

### Sprint 21 — Painel síndico detalhado (Helena de Moradas)

- **Pra quê serve:** síndico precisa enxergar consumo POR APARTAMENTO (com permissão), gerar rateio mensal automático, exportar pra prestação de contas do condomínio.
- **Quem ganha:** Helena, condôminos (transparência).
- **Tempo estimado:** 5 dias úteis.
- **Pré-requisito:** Sprint 16 (painel agregador) + Sprint 19 (DRE).
- **Bloqueia:** —
- **Tarefas:**
  1. `/dashboard/sindico/rateio`
  2. Tabela: apto + nome + fração ideal + kWh + valor + status pagamento
  3. Botão "gerar rateio mês X" (PDF + ZIP de boletos)
  4. Histórico de rateios anteriores
  5. Auditoria: log de quem acessou (LGPD)
- **Critério "passou":** Helena gera rateio mar/2026 do Moradas Enseada, PDF abre com 23 linhas corretas, ZIP tem 23 boletos.
- **Risco:** médio. PDF + boleto em massa.
- **Custo:** ~700 linhas + integração PDF gen.

---

### Sprint 22 — Audit trail (rastreabilidade global)

- **Pra quê serve:** registrar quem fez o quê e quando — exigência LGPD + boa prática operacional. Hoje algumas ações são logadas, outras não.
- **Quem ganha:** Luciano (auditoria), parceiro (defesa em caso de questionamento).
- **Tempo estimado:** 4 dias úteis.
- **Pré-requisito:** Sprint 21.
- **Bloqueia:** Sprint 26 (pré-produção).
- **Tarefas:**
  1. Model `AuditLog` (já existe parcialmente, expandir)
  2. Interceptor NestJS captura toda mutação (POST/PUT/PATCH/DELETE)
  3. Campos: usuário, IP, ação, antes, depois, timestamp, tenant
  4. Página `/dashboard/admin/auditoria` (busca por usuário, data, recurso)
  5. Retenção: 5 anos (LGPD financeiro)
- **Critério "passou":** 1 alteração de cobrança gera registro em `AuditLog`, busca pela tela retorna o registro.
- **Risco:** baixo-médio. Performance do interceptor (não pode lentificar).
- **Custo:** ~600 linhas + index novos no banco.

---

### Sprint 23 — Templates personalizáveis por parceiro

- **Pra quê serve:** cada parceiro tem identidade visual diferente (logo, cor, texto de email). Hoje tudo tá hardcoded com cara CoopereBR.
- **Quem ganha:** parceiros novos (entram com sua marca).
- **Tempo estimado:** 5 dias úteis.
- **Pré-requisito:** Sprint 22.
- **Bloqueia:** Sprint 25 (E2E completo).
- **Tarefas:**
  1. Model `TemplateParceiro` (logo, cor primária, footer, assinatura email)
  2. Tela `/dashboard/admin/identidade-visual`
  3. Engine de template aplica em: PDF cobrança, PDF proposta, email transacional, WA
  4. Preview ao salvar
  5. Default: identidade CoopereBR
- **Critério "passou":** parceiro fictício "Solar do Vale" cria identidade própria, email transacional sai com logo deles.
- **Risco:** baixo. Cosmético.
- **Custo:** ~700 linhas + storage de logos (S3 ou local).

---

### Sprint 24 — Login facial (KYC + autenticação)

- **Pra quê serve:** alta segurança em ações financeiras (saque PIX excedente, transferência, alteração de dados bancários).
- **Quem ganha:** todos (segurança), Luciano (compliance).
- **Tempo estimado:** 4 dias úteis.
- **Pré-requisito:** Sprint 23.
- **Bloqueia:** Sprint 26.
- **Tarefas:**
  1. Já existe módulo `auth/facial` parcial — finalizar
  2. Captura foto KYC no cadastro (já existe parte)
  3. Verificação facial em ações sensíveis (toggle por ação)
  4. Fallback: senha + email + WA OTP
  5. Tela de gerenciamento de biometria
- **Critério "passou":** 1 cooperado real cadastra biometria, faz transação sensível, verificação aprova.
- **Risco:** médio. Lib de visão computacional pode falhar em cooperado idoso (acessibilidade).
- **Custo:** ~500 linhas (a maioria já existe) + tuning de threshold.

---

### Sprint 25 — Suite E2E Playwright completa

- **Pra quê serve:** testar ponta-a-ponta os 10 fluxos críticos do `MAPA-INTEGRIDADE-SISTEMA.md` automaticamente, antes de qualquer deploy de produção.
- **Quem ganha:** Luciano (confiança), Claude/dev (regressão automática).
- **Tempo estimado:** 6 dias úteis.
- **Pré-requisito:** Sprint 24.
- **Bloqueia:** Sprint 26.
- **Tarefas:**
  1. Atualizar `web-test/` com 10 specs (atualmente 7 funcionais + 5 falhas conhecidas)
  2. Cobrir: cadastro completo, proposta, assinatura, pagamento, conciliação, rateio, FaturaSaas, painel Luciano, painel síndico, audit
  3. Rodar em CI antes de qualquer push
  4. Cobertura mínima: 80% dos fluxos críticos
- **Critério "passou":** 10/10 specs verde em sequência, tempo total <15min.
- **Risco:** médio. Testes E2E são chatos de manter (flaky).
- **Custo:** ~2000 linhas de teste. CI configurado.

---

### Sprint 26 — Pré-produção (hardening + smoke)

- **Pra quê serve:** última camada antes de abrir pra parceiro real. Validar performance, segurança, rollback, monitoramento.
- **Quem ganha:** Luciano (entra em produção sabendo o que faz).
- **Tempo estimado:** 5 dias úteis.
- **Pré-requisito:** Sprint 25.
- **Bloqueia:** **PRODUÇÃO**.
- **Tarefas:**
  1. Load test: 500 cooperados simultâneos, 100 webhooks Asaas/min
  2. Pen test básico (OWASP top 10)
  3. Backup + rollback testado (`pg_restore` em ambiente de stage)
  4. Sentry / Plausible / monitoramento real ligado
  5. Runbook operacional `docs/operacao/runbook.md`
  6. Documentação Luciano: "como reagir quando der ruim"
  7. Smoke test final: cadastro → proposta → assinatura → pagamento → conciliação rodando ponta a ponta
- **Critério "passou":** smoke test passa em <30min, rollback testado dá certo, runbook revisado pelo Luciano.
- **Risco:** alto se algo aparecer aqui (load test pode revelar gargalo).
- **Custo:** ~R$ 200/mês (Sentry + monitoramento). 1 dia de Luciano lendo runbook.

---

## Seção 3 — Linha do tempo visual

```
Semana 1  ████ Sprint 12 (Webhook Asaas prod)
Semana 2  ████ Sprint 13 (Painel Luciano)
Semana 3  ████ Sprint 14 (Cron FaturaSaas)
Semana 4  █████ Sprint 15 (Cadastro Condomínio)
Semana 5  █████ Sprint 16 (Painel Agregador)
Semana 6  ███████ Sprint 17 (Engine COMPENSADOS) ← mais arriscado
Semana 7  ██████ Sprint 18 (Engine DINAMICO)
Semana 8  █████ Sprint 19 (DRE)
Semana 9  █████ Sprint 20 (Conciliação CNAB)
Semana 10 █████ Sprint 21 (Painel Síndico)
Semana 11 ████ Sprint 22 (Audit Trail)
          █████ Sprint 23 (Templates Parceiro)
Semana 12 ████ Sprint 24 (Login Facial)
          ██████ Sprint 25 (E2E Playwright)
Semana 13 █████ Sprint 26 (Pré-produção)
Semana 14 🟢 PRODUÇÃO ABERTA pra parceiro real
```

**Total:** ~73 dias úteis ≈ 14-15 semanas se 1 sprint = 1 semana cheia, ou 10-12 semanas com paralelização parcial (Sprint 23 e 24 podem rodar em paralelo, por exemplo).

---

## Seção 4 — Tabela executiva de progresso

| Sprint | Tema | Status | % | Dias estimados | Risco |
|--------|------|--------|---|----------------|-------|
| 12 | Webhook Asaas prod | 🔴 Não iniciado | 0% | 3 | baixo |
| 13 | Painel Luciano | 🔴 | 0% | 4 | baixo |
| 14 | Cron FaturaSaas | 🔴 | 0% | 4 | baixo-médio |
| 15 | Cadastro Condomínio | 🔴 | 0% | 5 | médio |
| 16 | Painel Agregador | 🔴 | 0% | 5 | baixo |
| 17 | **Engine COMPENSADOS** | 🔴 | 0% | 7 | **alto** |
| 18 | Engine DINAMICO | 🔴 | 0% | 6 | alto |
| 19 | DRE por parceiro | 🔴 | 0% | 5 | médio |
| 20 | Conciliação CNAB | 🔴 | 0% | 5 | médio |
| 21 | Painel Síndico | 🔴 | 0% | 5 | médio |
| 22 | Audit Trail | 🔴 | 0% | 4 | baixo-médio |
| 23 | Templates Parceiro | 🔴 | 0% | 5 | baixo |
| 24 | Login Facial | 🔴 | 0% | 4 | médio |
| 25 | E2E Playwright | 🔴 | 0% | 6 | médio |
| 26 | Pré-produção | 🔴 | 0% | 5 | alto |
| **Total** | | | **0%** | **73 dias úteis** | |

> Atualizar esta tabela ao final de cada sprint (% pronto + status 🟢).

---

## Seção 5 — Dependências externas (não-código)

| Dependência | Bloqueia | Quem resolve | Prazo |
|-------------|----------|--------------|-------|
| Conta Asaas em produção | Sprint 12 | Luciano | 2 dias |
| Decisão arquitetural sobre `Uc.numero` (manter / interno / remover) | Sprint 17 | Luciano + Claude (sessão dedicada) | 1 dia |
| Snapshot pré-Sprint 17 (mandatório) | Sprint 17 | Claude (executa, Luciano valida) | 30min |
| Credenciais Sungrow (monitoramento usina) | Sprint 26 (smoke test) | Luciano | 1 semana |
| D4Sign ou ClickSign (assinatura digital prod) | Sprint 25 (E2E completo) | Luciano | 3 dias (cadastro + integração) |
| Conta produção Banco do Brasil ou Sicoob (CNAB) | Sprint 20 | Luciano | 1-2 semanas (banco demora) |
| Domínio fixo (sair do ngrok) | Sprint 12 | Luciano | 1 dia (já tem coopere.com.br) |
| Certificado SSL prod | Sprint 26 | Claude (Cloudflare) | 1 dia |

**Total de dependências externas:** 8. **Crítica:** conta banco (Sprint 20 fica esperando se demorar).

---

## Seção 6 — Custo estimado total + comparação com receita FaturaSaas

### Custo de execução (estimativa)

| Item | Valor |
|------|-------|
| Tempo de Claude (~73 dias úteis) | já contratado/uso pessoal |
| Asaas (taxa por transação) | R$ 1,99 PIX + 1.99% boleto (varia uso) |
| Sentry (monitoramento) | ~R$ 130/mês (plano team) |
| Plausible Analytics | ~R$ 50/mês |
| Cloudflare Pro (SSL + DDoS) | ~R$ 100/mês |
| Backup automático Supabase | já incluso no plano atual |
| D4Sign (assinatura digital) | ~R$ 0,80/assinatura (volume) |
| Banco (CNAB conciliação) | R$ 0 (geralmente grátis pra cobrança simples) |
| **Custo mensal recorrente estimado** | **~R$ 280-350/mês** |

### Receita FaturaSaas projetada

Cenário conservador (3 parceiros nos primeiros 3 meses):
- 3 parceiros × R$ 800 fixo = R$ 2.400/mês
- ~150 cooperados ativos somados × R$ 0,30 = R$ 45/mês
- **Total receita inicial:** ~R$ 2.445/mês

Cenário otimista (10 parceiros em 6 meses):
- 10 × R$ 800 = R$ 8.000
- ~600 cooperados × R$ 0,30 = R$ 180
- **Total:** ~R$ 8.180/mês

**Margem operacional:** receita conservadora cobre custo ~7x. Receita otimista cobre ~25x. **Sustentável desde o primeiro parceiro.**

> Custo de implementação dos sprints é zero pra Luciano (Claude executa). Custos diretos só aparecem em produção (Asaas, Sentry, etc.).

---

## Seção 7 — Como retomar o plano

### No início de cada sprint

1. Abrir este documento
2. Ler a seção do sprint atual
3. Confirmar pré-requisitos atendidos
4. Frase de retomada: **"Iniciando Sprint X — [tema]"**
5. Claude vai ler:
   - `CLAUDE.md` (regras permanentes)
   - `docs/MAPA-INTEGRIDADE-SISTEMA.md` (estado atual)
   - Esta seção do sprint
   - `docs/debitos-tecnicos.md` (verificar se algum P1/P2 surgiu)

### Ao final de cada sprint

1. Atualizar tabela executiva (Seção 4) — mudar status pra 🟢
2. Atualizar `docs/MAPA-INTEGRIDADE-SISTEMA.md` (matriz dos 10 fluxos)
3. Commit `docs(sprint-X): fechamento + entregas`
4. Email resumo pra `lucbragatto@gmail.com` (se relevante)
5. Frase de fechamento: **"Sprint X fechado. Próximo: Sprint X+1"**

### Quando algo der errado no meio

1. **Parar o sprint atual.** Não tentar consertar correndo.
2. Anotar em `docs/debitos-tecnicos.md` o que apareceu.
3. Decidir: (a) resolver agora antes de continuar, (b) seguir e tratar depois, (c) replanejar sprint.
4. Documentar a decisão em `docs/sessoes/YYYY-MM-DD-incidente-sprint-X.md`.

### Quando re-priorizar

Se o cenário mudar (parceiro real entra antes do esperado, problema legal, ANEEL muda regra), este plano **não é sagrado**. Reabrir, reorganizar, manter o que ainda faz sentido. Sprints 12-13-14 são sempre prioridade — sem eles nada roda.

---

## Frase final

**"O SISGD não vai entrar em produção porque está pronto. Vai entrar em produção quando estes 15 sprints estiverem fechados, validados pelo Luciano e o smoke test do Sprint 26 passar de ponta a ponta."**

— Plano consolidado em 26/04/2026 madrugada, após sessão de fechamento Sprint 11 + criação SISGD-VISAO-COMPLETA.
