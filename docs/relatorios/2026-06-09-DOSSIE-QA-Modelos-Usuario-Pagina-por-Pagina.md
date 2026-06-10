# Dossiê QA Funcional — SISGD/CoopereBR
## Investigação Página por Página por Modelo de Usuário (TipoContexto)

**Data:** 09/06/2026  
**Papel:** QA Funcional (somente investigação, teste e reporte — sem alterações de código)  
**Escopo:** Mapear todos os "modelos de usuário" (TipoContexto + perfis), páginas associadas, funções, funcionalidades e regras de negócio/sistema.  
**Metodologia usada:** Leitura de código frontend (Next.js app router), layouts, types, middleware; inspeção backend (guards, controllers, services); simulações via scripts existentes + node/Prisma (leitura); testes de Cenário 1 anteriores; análise de navegação e condicionais de role/contexto.

**Restrições respeitadas:** Apenas dados de teste (QA-TESTE-*, ambienteTeste=true), contatos whitelist, sem ações destrutivas ou em produção real.

---

## 1. Modelos de Usuário (TipoContexto)

Do `web/types/index.ts`:

```ts
export type TipoContexto =
  | 'super_admin'
  | 'admin_parceiro'
  | 'cooperado'
  | 'proprietario_usina'
  | 'admin_agregador'
  | 'empresa_conveniada';
```

Mapeamento aproximado com perfis backend (PerfilUsuario):

- **super_admin** → SUPER_ADMIN (global, sem cooperativaId fixa, acesso a tudo)
- **admin_parceiro** → ADMIN (de uma cooperativa/parceiro específico)
- **cooperado** → COOPERADO (membro individual ou empresa cooperada)
- **proprietario_usina** → PROPRIETARIO (dono da usina, recebe repasses)
- **admin_agregador** → ADMIN de agregador (visão agregada de várias cooperativas)
- **empresa_conveniada** → EMPRESA_CONVENIADA (empresa que tem convênio com a cooperativa, tem portal próprio para gerenciar seus "funcionários/membros")

Além disso existe fluxo público/anônimo (cadastro sem login inicial).

**Multi-contexto:** Um mesmo Usuario (mesmo login/telefone) pode ter vários ContextoUsuario e usa `/selecionar-contexto` + ContextoSwitcher para trocar.

---

## 2. Estrutura Geral de Portais / Áreas

Do `web/app/` + middleware:

- **/dashboard/** → Principal para admins (SUPER_ADMIN, ADMIN, OPERADOR, alguns cooperados limitados). Sidebar rica com dezenas de módulos.
- **/conveniada/** → Portal dedicado da Empresa Conveniada (topbar minimalista, foca em um ou mais convênios).
- **/portal/** → Portal do Cooperado/Membro (mobile-first, navegação por bottom nav implícita).
- **/proprietario/** → Portal do Proprietário de Usina.
- **/parceiro/** e **/agregador/** → Visões adicionais para parceiros/agregadores.
- **Áreas públicas / fluxo de cadastro:**
  - /login, /entrar
  - /cadastro, /cadastro/sem-uc
  - /convite/[codigo], /convite-convenio/[token]
  - /aprovacao-membro/[token], /aprovar-proposta, /assinar
  - /selecionar-contexto
- **Outros:** /meu-perfil (provavelmente), flows de PIN, redefinição de senha, etc.

O middleware protege /dashboard, /portal, /conveniada etc. baseado em cookie/token + contexto.

---

## 3. Dossiê por Modelo de Usuário (Página por Página + Funções + Regras)

### 3.1 SUPER_ADMIN (super_admin)

**Portal principal:** /dashboard + sub-rotas (muito amplo). Acesso global (bypass multi-tenant em muitos lugares).

**Páginas principais identificadas (do app/dashboard/):**
- /dashboard (visão geral + métricas)
- /dashboard/super-admin (parceiros, solicitacoes, confirmacoes-pagamento)
- /dashboard/cooperativas (novo, lista, [id]/editar)
- /dashboard/parceiros (novo com wizard de muitos steps, [id])
- /dashboard/cooperados (novo com wizard completo Step1-7, [id] com tabs fatura, documentos, asaas, etc.)
- /dashboard/convenios (novo, [id], editar, cobrancas-consolidadas)
- /dashboard/usinas, /dashboard/ucs, /dashboard/contratos, /dashboard/cobrancas
- /dashboard/financeiro, /dashboard/contabilidade (apuracao, dre, plano-contas, convenios-ct)
- /dashboard/saas (planos, faturas, convenios-globais)
- /dashboard/configuracoes (muitos: asaas, email, bandeiras, documentos, seguranca, portal-proprietario, etc.)
- /dashboard/usuarios, /dashboard/observador, /dashboard/ocorrencias
- /dashboard/whatsapp, /dashboard/whatsapp-config
- /dashboard/relatorios (vários: inadimplencia, expansao, conferencia-kwh, projecao-receita)
- /dashboard/dev/credenciais-teste (útil para QA)
- Muitos outros (clube, motor-proposta, listas-concessionaria, etc.)

**Funções chave (exemplos):**
- Gestão completa de parceiros, cooperados, usinas, convênios, cobrancas, contratos.
- Wizards longos de onboarding de parceiro e cooperado.
- Configuração de tudo (modelos de cobrança, tarifas, saas, email, Asaas, etc.).
- Relatórios globais e dashboards SaaS.
- Observador (visão de tudo?).
- Aprovações manuais (confirmacoes-pagamento, solicitacoes).

**Regras identificadas:**
- Acesso irrestrito (pode ver qualquer cooperativaId).
- Muitos endpoints com @Roles(SUPER_ADMIN).
- Pode criar outros SUPER_ADMIN / ADMIN via register-admin ou scripts.

**Achados de teste (do Cenário 1 + inspeção):**
- Tem acesso a telas de admin que o ADMIN normal também vê, mas com visão cross-tenant.
- (A investigar mais: se há telas exclusivas de SUPER_ADMIN que ADMIN não deve ver.)

**O que passou OK (inicial):** Acesso amplo funciona, ContextoSwitcher aparece quando múltiplos contextos.

**Bugs / Gaps reportados anteriormente:** Ver relatórios de IDOR e auditorias em docs/relatorios (muitos P0/P1 de tenant leak em sprints anteriores).

---

### 3.2 ADMIN / admin_parceiro

**Portal principal:** /dashboard (com navegação filtrada pelo seu cooperativaId).

**Páginas principais (exemplos do código):**
- /dashboard (resumo da sua cooperativa/parceiro)
- /dashboard/cooperados (novo, lista, [id] detalhado)
- /dashboard/convenios (novo, [id], editar)
- /dashboard/usinas, ucs, contratos, cobrancas, financeiro, contabilidade (limitado ao tenant)
- /dashboard/parceiro/* (visão do seu parceiro)
- /dashboard/convites, /dashboard/indicacoes, /dashboard/ocorrencias
- Configurações limitadas (modelos-cobranca, etc.)
- /dashboard/meu-convite (se aplicável)

**Funções chave:**
- Cadastrar cooperados (com wizard de proposta, documentos, alocacao)
- Gerenciar convênios e membros do convênio
- Cobranças, repasses, financeiro do tenant
- Aprovar/rejeitar cadastros pendentes
- Enviar convites (individual e em lote — bug conhecido: lote não envia)
- Ver relatórios do seu parceiro

**Regras:**
- Forte tenant isolation (cooperativaId do usuário é usado em queries + guards).
- ADMIN não vê dados de outras cooperativas (403 em muitos lugares).
- Pode ter acesso a "parceiro/" sub-área.

**Achados (Cenário 1):**
- Vê lista de PENDENTES corretamente.
- Após "Confirmar" (empresa) e "Aprovar" (admin), a UI frequentemente não atualiza sem F5 (bug conhecido #2).
- Dados de UC/EDP/kWh do cadastro muitas vezes não aparecem nas telas de admin e conveniada (bug conhecido #3).

**O que passou OK:** Criação de cooperado via wizard, visualização básica de lista.

---

### 3.3 EMPRESA_CONVENIADA (empresa_conveniada)

**Portal principal:** /conveniada (layout minimalista, foca em convênio(s)).

**Páginas principais:**
- /conveniada (visão geral do(s) convênio(s))
- /conveniada/convenio/[id] (detalhes do convênio específico)

**Funções chave (do layout + contexto anterior):**
- Ver seus convênios
- Convidar membros (individual e em lote)
- Confirmar cadastros de "funcionários" (membros do convênio)
- Ver listagem de membros + status
- Possivelmente ver dados de alocação/kWh por membro (se implementado)

**Regras:**
- Contexto específico `empresa_conveniada`.
- Só vê dados dos seus convênios/membros.
- Ação "Confirmar" pelo lado da empresa antes da aprovação do admin da cooperativa.

**Achados (Cenário 1):**
- Convite individual funciona (envia WhatsApp + OTP).
- Convite em lote **não envia** (bug conhecido #1 — confirmar reprodução).
- Após confirmação da empresa + aprovação do admin, os dados de membro + UC + kWh **nem sempre aparecem** corretamente no portal /conveniada (bug #3).
- UI de confirmação/aprovação não reflete mudanças sem refresh (bug #2).

**O que passou OK:** Layout limpo, ContextoSwitcher presente, header com nome da empresa.

---

### 3.4 COOPERADO

**Portal principal:** /portal (mobile-first) + algumas coisas em /dashboard (limitado).

**Páginas principais (do portal/):**
- /portal (início)
- /portal/ucs
- /portal/financeiro
- /portal/tokens
- /portal/clube
- /portal/documentos
- /portal/indicacoes
- /portal/conta, /portal/seguranca (definir-pin)
- /portal/faturas-concessionaria, /portal/creditos, /portal/desligamento, etc.
- Também /dashboard/meu-convite, /dashboard/indicacoes (para alguns).

**Funções chave:**
- Ver suas UCs, consumo, créditos/tokens
- Financeiro (faturas, pagamentos)
- Clube de Vantagens
- Documentos
- Indicar outros
- Assinar contratos, gerenciar PIN
- Ver ranking, etc.

**Regras:**
- Acesso via contexto `cooperado`.
- Pode ter múltiplos cooperados (mesmo login) → precisa escolher via selecionar-contexto.
- Muitos dados vêm de alocacao, geracao-mensal, cobrancas, cooper-token, etc.
- Regras de ativação (guard-ativacao), status (PENDENTE vs ATIVO).

**Achados (de testes anteriores + inspeção):**
- Multi-cadastro existe e há fluxo de troca (Cenário 3 a investigar).
- Após aprovação/alocação, o cooperado deve ver seus dados no portal (a verificar no Cenário 2).
- Dependência forte do WhatsApp bot para onboarding inicial.

---

### 3.5 PROPRIETARIO_USINA (proprietario_usina)

**Portal principal:** /proprietario

**Páginas principais:**
- /proprietario (visão geral)
- /proprietario/usinas/[id]
- /proprietario/contratos
- /proprietario/despesas (nova, lista)
- /proprietario/repasses
- /proprietario/aceitar-convite/[token]

**Funções chave:**
- Ver usinas que possui
- Acompanhar repasses (recebimento)
- Lançar despesas
- Gerenciar contratos
- Aceitar convite para se tornar proprietário

**Regras:**
- Isolamento por proprietarioId + cooperativa.
- Fluxo de repasse mensal (contas-pagar para proprietário).
- Pode ter visão agregada se for admin_agregador também?

**Achados de investigação (leitura de sessão AN completa + código + frontend + histórico em leitura-total de 28/04 e PLANO-ATE-PRODUCAO):**
- **O que funciona bem (pós-AN):** Fluxo ponta-a-ponta de obrigação (BH.5) → pagamento real (AN) com atomicidade de despesas. Portal agora consome tabela real + fallback gracioso (mantém UX anterior). Admin tem visão hierárquica útil para Super Admin. Backfill + notificação + PDF fecham o ciclo operacional. Testes: 36/36 specs + 3 smokes programáticos 24/24. Smoke visual Luciano validou trigger e UI.
- **Gaps / bugs reproduzíveis ou potenciais (ainda relevantes ou herdados):**
  - Fallback `PREVISTO_FALLBACK` depende de `GeracaoMensal` existir; meses sem geração caem em "sem dado" (verificado em AN.4).
  - LGPD em admin: Email mascarado na lista, mas proprietárioCooperadoId exposto em drill-down (risco baixo, mas auditar).
  - Race / idempotência: Bom, mas cron BH.5 + manual trigger podem criar duplicatas se unique constraint falhar em edge (P2002 tratado, mas logar melhor).
  - Visibilidade de "despesas abatidas": No portal repasses, mostra `totalDespesasAbatidas`, mas não detalha quais despesas (sugestão: link para lista de despesas do período).
  - Config `proprietarioVeDespesas`: Ainda opt-in por cooperativa (BH.4); se false, proprietário não vê despesas no portal (comportamento intencional, mas pode confundir).
  - Integração com IAG/Sentinela: Repasses baixos ou atrasados poderiam disparar alertas proativos (não implementado; ver seções de agents).
  - Teste de "Caminho B" (proprietário puro por email, sem ser cooperado): Funciona no resolver, mas pouco testado em E2E real (sugestão: smoke com demo-esolares).
- **O que evoluiu desde leitura-total (28/04):** Naquela data, repasses eram "depende de cron mensal que não existe", dashboard mockado com R$0,50 hardcoded, algumas telas "invisíveis" na documentação. AN fechou o gap de tracking real de pagamento + atomicidade com despesas. Ainda há carry-over de "visão agregada se for admin_agregador também?" (não priorizado).

**Dúvidas sugeridas (para Code ou testes):**
- O cron BH.5 sempre cria o Repasse PENDENTE + Arrendamento no mesmo tx? (testar com `isAmbienteReal=false` + trigger manual).
- Como fica o "valor líquido" quando há múltiplas despesas de períodos diferentes abatidas no mesmo repasse?
- Proprietário que é também cooperado (Caminho A) — o repasse aparece duplicado em portal cooperado vs proprietario?

**Melhorias sugeridas (uso + técnicas):**
- **Uso (UX/Operacional):** Adicionar banner "Repasse pendente" no dashboard proprietário quando há PENDENTE >30d. Link direto do card de usina para repasses. No admin, filtro "só com repasse atrasado". Notificação via WA/email mais rica (incluir link para upload comprovante?).
- **Técnicas (Arquiteto/Dev):** Mover cálculo de líquido para view materializada ou helper compartilhado (evitar duplicação entre service e relatórios). Adicionar índice composto para queries de "repasse por usina + período". Integrar com IAG (ex: Sentinela monitora repasses baixos e sugere ação pro admin). Para agregadores que também são proprietários: visão unificada (já parcialmente possível via contextos).
- **Testes recomendados (como QA):** 
  - Cenário real: Criar usina + proprietário (via convite ou admin), rodar cron BH.5 (ou manual), verificar Repasse PENDENTE + Arrendamento criado atomicamente.
  - PAGO: Admin marca pago com upload (JPG/PDF), verifica vinculação de despesas DESCONTO_NO_REPASSE do período + status RESOLVIDA + notificação.
  - Fallback: Mês sem RepasseProprietario → portal mostra PREVISTO_FALLBACK com dados de GeracaoMensal.
  - Cross-tenant: Admin de coop A tenta ver repasse de coop B → 403.
  - LGPD: Em lista admin de usinas com proprietário, email deve estar mascarado.
  - Smoke com "Caminho B" (proprietário puro por email).
  - Edge: Cancelar repasse após vincular despesas (deve reabrir as despesas?).

**O que passou OK (pós-AN):** Atomicidade comprovada em smoke, fallback gracioso, KPIs YTD reais, upload + notificação funcionando, backfill idempotente. Portal proprietário agora útil operacionalmente (não mais só mock).

---

### 3.6 ADMIN_AGREGADOR (admin_agregador)

**Contexto histórico (das anotações/sessões — principalmente leitura-total 28/04 + cadeia-hangar 24/04 + VISAO-COMPLETA):**
- **A ideia original:** Um dos 12 papéis humanos no SISGD-VISAO-COMPLETA (junto com Ana cooperada, Helena síndica, etc.). "Carlos agregador Hangar" — **pessoa/empresa que capta clientes em volume** via estrutura MLM/rede (exemplo real: Hangar com 165+ membros, cascata de indicações, 8.250 tokens pendentes, "Conveniado Hangar LTDA" como topo). Objetivo: visão operacional para quem traz volume (agregadores, administradoras de condomínios grandes, empresas que indicam em massa). Em VISAO: "PARCIAL" — esqueleto existe, mas "cruzamento de dados real falta". MLM explícito (bonus_indicacao, whatsapp-mlm cron mensal, indicacoes module com 11 arquivos). "Pessoa que capta clientes" aparece em contexto de crescimento (não só "admin de parceiro", mas papel de rede/expansão).
- **Estado atual (2026-06):** Ainda muito esquelético / não evoluiu como portal operacional de captação.
  - **Frontend:** `/agregador` (dashboard mínimo: só card "Total de membros vinculados" via GET /cooperados?administradoraId=...), `/agregador/membros`, `/parceiro/agregadores/*`.
  - **Backend:** módulo `administradoras/` (CRUD básico de "agregador" — razaoSocial, cnpj, email, telefone, responsavel*, linked a condominios). Service com multi-tenant + IDOR fixes (D-novo-BR F0.1). Usado em queries (ex: cooperados com administradoraId). Em types: `admin_agregador` como TipoContexto separado. Integração com MLM/indicacoes (agregador pode ser o "indicador institucional").
  - **Contexto no JWT / useContexto:** `admin_agregador` com `agregadorId` + `agregadorNome`. Rota home via `rotaPorContexto()`.
  - **Ligações com Hangar/Moradas:** Seed histórico (24/04) mostra Hangar como EMPRESA com 165 membros + cadeia MLM (bonus 50 tokens por indicação). Administradora como entidade para "grupos que captam" (condomínios grandes ou empresas como Hangar).
- **Por que não evoluiu?** Prioridade foi em outros portais (empresa 9.x, Token-WA, contabilidade, IAG). Agregador ficou como "visão de rede" secundária. Em leitura-total: "cruzamento de dados real falta" — ainda verdade (só conta membros, sem performance por nível, sem leads de captação, sem payout MLM visível além do básico).

**Regras / Comportamento atual:**
- Isolamento: Agregador vê só cooperados vinculados à sua administradoraId (via query param ou contexto).
- MLM: Indicacoes module + cron whatsapp-mlm (mensal) + bonus_indicacao. Agregador pode ser o "topo" da cadeia (registrarComoIndicacao).
- Multi-contexto: Usuário pode ser admin_agregador + outras coisas (troca via selecionar-contexto).
- Visão: Básica (total membros). Não há "meus leads", "performance por nível", "payout MLM".

**Achados de investigação (leitura de sessões de abril-junho + código + VISAO + debitos-tecnicos):**
- **O que existe e funciona (mínimo viável):** CRUD de administradora (SUPER_ADMIN/ADMIN), filtro em cooperados por administradoraId, contagem básica no dashboard agregador. MLM básico funciona (indicações geram tokens pendentes, como no seed Hangar com 8.250 tokens).
- **Gaps grandes (não atendidos da visão original):**
  - Sem painel operacional de "capta clientes": Não há lista de leads/prospects por agregador, ferramenta para enviar convites em nome da rede, dashboard de "membros trazidos este mês / kWh agregados / receita gerada".
  - MLM incompleto para o agregador: O agregador vê só total membros, não a árvore/cascata (quem indicou quem), nem payout visível (bonus pendentes/pagos por nível). Em cadeia-hangar: Hangar (nível 0) não recebe indicação direta — mas o agregador deveria ter visão agregada.
  - Cruzamento fraco: Em leitura-total, "cruzamento de dados real falta". Hoje o agregador é mais "filtro de lista" do que "papel com poder de captação".
  - Invisibilidade em docs: Mencionado em VISAO e leitura-total como um dos 12 papéis, mas em inventário de telas aparece como "PARCIAL". Muitos débitos sobre MLM (ex: em sessões antigas sobre indicações).
  - Relação com "administradora": Parece que "agregador" e "administradora" são a mesma entidade conceitual (para grupos como Hangar/Moradas que captam volume). Mas no código/frontend há separação (agregador como contexto, administradoras como CRUD). Confusão possível.
- **Bugs / problemas potenciais (de sessões e código):**
  - Em agregador dashboard: Só conta via query simples; se o filtro administradoraId não for respeitado em todos os endpoints de cooperados, há vazamento (anti-IDOR parcial via D-novo-BR).
  - MLM: Tokens pendentes por indicação (8.250 no exemplo Hangar), mas sem visão clara pro agregador de "meu bônus este mês".
  - Evolução parada: Desde abril (VISAO e leitura) até junho, o agregador basicamente ficou como skeleton enquanto outros portais (empresa, proprietario, portal membro) evoluíram muito (9.x, AN, Token-WA).

**Dúvidas sugeridas (para Code / planejamento):**
- O "agregador" é o mesmo que "administradora" (entidade para Hangar-like) ou um papel separado sobre ela? (No código parece sinônimo em alguns lugares, separado em outros).
- Por que parou a evolução? Prioridade em IAG / contabilidade / Token-WA? Ou falta de "dono" do papel (ninguém pediu feature de captação)?
- O agregador deveria ter visão de "minha performance de captação" cruzando com usinas/convênios que ele trouxe? (ex: kWh agregados por sua rede).
- Como integrar com o IAG (agentes de expansão)? Ex: agente que sugere "este agregador tem 80% dos membros sem UC — priorizar onboarding".

**Melhorias sugeridas (uso + técnicas):**
- **Uso (como ferramenta de capta clientes — visão do usuário final "Carlos"):** 
  - Evoluir `/agregador` para dashboard de rede: Árvore MLM (quem indicou quem), KPIs (membros trazidos/mês, kWh agregados, taxa conversão, payout pendente/pago), lista de "meus membros" com status (ativo, pendente, sem UC).
  - Ferramentas de captação: Botão "Enviar convite da minha rede" (reusa convites-convenio mas com origem=agregador), templates de mensagem WA/email personalizados, performance por "nível" da cascata.
  - Visão de "minha contribuição": Quanto a rede dele gera de receita para a coop (incentivo para continuar captando).
- **Técnicas (Arquiteto/Dev):**
  - Unificar modelo: Se "agregador" == "administradora", limpar duplicidade (usar só um). Adicionar campos de performance (total_membros, kwh_agregado, ultima_captacao) ou view materializada.
  - Integração forte com MLM: Reusar `convite-indicacao` + `indicacoes` module para o agregador ter "minha árvore" e "meus bônus". Adicionar `agregadorId` em mais entidades (usina, convênio) para cruzamento.
  - Multi-tenant + contexto: Garantir que admin_agregador só vê dados da sua administradora (já parcial via query param; endurecer com guard como em outros portais).
  - Observabilidade: Métricas de "efetividade de captação por agregador" (para Super Admin e para o próprio agregador).
  - Evolução gradual: Fase 1 = dashboard + KPIs de rede (como o que já existe em agregador/membros). Fase 2 = ferramentas de convite + payout view. Fase 3 = integração com IAG (agente "expansao" que sugere agregadores com alto potencial).
- **Testes recomendados (como QA Funcional):** 
  - Criar "agregador" (via admin/administradoras), vincular membros (cooperados com administradoraId), logar como admin_agregador e verificar que vê só os seus (anti-IDOR).
  - Testar MLM: Membro indicado por agregador gera bônus pendente; agregador vê no dashboard (se evoluir) ou via indicacoes.
  - Fluxo de captação: Do ponto de vista do agregador, conseguir "trazer" um novo membro via link e ver ele aparecer na contagem.
  - Visão cruzada: Super Admin vê todos agregadores + performance; agregador vê só o dele.
  - Edge: Agregador que também é cooperado/proprietário (multi-contexto) — troca de chapéu funciona sem vazamento?

**O que passou OK (mínimo):** Esqueleto existe, contexto `admin_agregador` resolvido, filtro por administradoraId funciona em queries básicas, MLM básico (indicações) está no código desde cedo.

**Recomendação geral:** Este é um dos papéis mais "estratégicos de crescimento" da VISAO original (captação em volume via rede/MLM), mas ficou para trás enquanto focamos em operação (convênios, Token-WA, contabilidade). Vale priorizar evolução como "portal de capta" se o objetivo é escalar para mais parceiros (Hangar-like). Sugiro ler a sessão "2026-04-24-cadeia-hangar-distribuicao.md" + "2026-04-28-leitura-total-parte1.md" (seção sobre agregador) + código de `indicacoes` + `administradoras` para contexto completo.

**Análise da proposta (usuário + QA + multi-perspectiva): usar o Convênio (empresa_conveniada) como proxy temporário para Agregador + Condomínio/Administradora**

**O que eu acho:**
Sim, é uma decisão pragmática e inteligente no curto prazo (próximos 4-8 semanas). O Hangar (e Moradas) já prova na prática que "empresa conveniada" funciona como veículo de captação em volume + estrutura de grupo:
- 165 membros Hangar + 50 Moradas = 215 no mesmo convênio.
- Cadeia MLM explícita (indicações, tokens BONUS_INDICACAO pendentes, "Conveniado Hangar LTDA" como nível 0).
- O portal /conveniada 9.0/9.1 já entrega o núcleo de "agregação":
  - Gestão de convites (individual + lote — com os bugs conhecidos que já reportamos).
  - Membros pendentes + aprovação in-portal (empresa confirma antes do admin).
  - Consumo kWh por "funcionário/membro" (Bloco 2 — fonte única, preview, rateio).
  - Cobranças consolidadas (F1).
  - Header com empresaNome, naturezaAtoCooperativo, baseCobrancaCusteio, kwhAlocadoMensal.
Isso cobre 70-80% do que um "agregador que capta clientes" (Carlos) ou "síndico/administradora de condomínio" precisa: trazer volume, ver quem entrou, alocar kWh, cobrar de forma agregada.

**Prós:**
- Velocidade: Desbloqueia captação de volume (Hangar-like) sem esperar evolução do agregador/condomínio.
- Reuso: A tela do convênio já faz "agregação" de verdade (convites, membros, kWh por funcionário, cobrança consolidada). Melhor que o dashboard agregador atual (só contagem).
- Menos telas quebradas: Evita mostrar skeletons que geram frustração (como o agregador atual que "cruzamento de dados real falta" desde abril).
- Alinhado com realidade: Hangar/Moradas já operam como "empresa conveniada que capta via MLM + grupo".

**Contras / Riscos (sérios, mas gerenciáveis):**
- Confusão de identidade: "Empresa conveniada" (pagadora corporativa, HR-like) ≠ "Agregador MLM" (Carlos que vive de indicação, quer árvore de rede + payout por nível) ≠ "Administradora/Condomínio" (síndico ou gestora de prédio com rateio interno). Usar o mesmo portal pode borrar as diferenças de UX e regras (ex: agregador quer árvore MLM + payout por nível; condomínio quer rateio proporcional + assembleia-like approvals; empresa quer "benefício aos colaboradores" + kWh por funcionário).
- Dívida futura: Quando decidirmos evoluir os portais dedicados, teremos que migrar dados/fluxos de gente que já se acostumou com o proxy.
- Bugs existentes amplificados: Convite em lote (ainda não envia), UI não atualiza após aprovar (precisa F5), dados de UC/kWh/EDP não aparecem direito nas telas — tudo isso vai afetar "agregadores" e "condomínios" que usarem o proxy.
- Visibilidade de captação: O agregador "Carlos" quer ver "quanto eu trouxe de kWh/receita este mês" de forma clara. O convênio atual mostra por convênio, não por "quem capta".

**Minha posição final (como QA Funcional + arquiteto + usuário final):**
Sim, vamos com o proxy. É a melhor relação custo x benefício agora. O convênio já é o "agregador de membros" na prática (Hangar/Moradas são a prova viva). Suprima as duas telas dedicadas (esconda do sidebar/nav para contextos de agregador/condomínio, ou use feature-flag `mostrarPortalAgregador` / `mostrarPortalCondominio` default false) para reduzir ruído e foco. Foque energia em melhorar a tela do convênio para servir como "ferramenta de captação + gestão de grupo" temporária.

**Melhorias concretas sugeridas na tela do Convênio (para suportar agregador + condomínio temporariamente — priorizadas por impacto x esforço):**

1. **Nomenclatura e contexto flexível (alto impacto, baixo esforço — faça primeiro):**
   - No header do convênio (já tem empresaNome, natureza, baseCobrancaCusteio, kwhAlocado): Adicione badge dinâmico "Modo: Empresa / Agregador / Condomínio" (baseado em flag no Convênio ou no contexto do usuário). Mude rótulos: "Funcionários / Membros da Rede / Moradores".
   - Ajude o usuário na primeira vez: HelpBox grande "Você está usando este convênio como ferramenta de captação (agregador) ou gestão de grupo (condomínio). Os membros que você convidar aparecem aqui com tag de origem."

2. **Seção "Minha Captação / Rede" (essencial para agregador):**
   - Reaproveite + melhore o `GestaoConvitesSection` e `MembrosPendentesSection` (já existem e são o coração da captação).
   - Adicione aba ou sub-seção "Minha Rede de Indicação" (se tiver `cooperadoIndicadorId` ou dados de MLM no convite/membro): Árvore simples ou lista "Nível 1 / Nível 2", contagem por nível, tokens/bônus gerados pela minha captação.
   - KPI novo no topo do convênio: "Membros trazidos por mim (agregador): X (Y% do total do convênio)", "kWh agregados pela minha rede este mês".
   - Convite em lote: Já existe (EnvioLoteSection). Melhore o status (o bug de "não envia" é crítico aqui — priorize fix antes de liberar para agregadores). Adicione tag "Origem: Captação via Agregador" nos membros.

3. **Suporte a "Condomínio / Grupo" (rateio + visão coletiva):**
   - Se o convênio tiver `condominioId` ou `administradoraId` vinculado (já existe no schema): Mostrar seção "Visão do Grupo/Condomínio" com rateio (já tem lógica em outros lugares).
   - Adicionar "Aderir como grupo" ou lista de "sub-membros" com consumo agregado.
   - Filtro na lista de membros: "Por origem (agregador / condomínio / direto)".

4. **KPIs e visibilidade de captação (beneficia todos os papéis que usarem o proxy):**
   - No dashboard do convênio (além dos contadores de membros e cobranças atuais): Adicionar cards "Captação via minha rede (agregador)", "Membros do grupo (condomínio)", "% de kWh/consumo vindo da minha captação".
   - Histórico simples: "Membros que entrei via minha indicação este mês" + evolução.
   - No topo ou sidebar: "Sua contribuição como Agregador/Condomínio: X membros • Y kWh • Z de receita gerada".

5. **Melhorias gerais de UX/Operação (que beneficiam todos os papéis que usarem o proxy):**
   - ContextoSwitcher bem visível + banner na primeira entrada: "Você está logado como Agregador/Captação neste convênio. Troque de contexto se precisar ver como cooperado."
   - Aprovação in-portal (MembrosPendentesSection): Já excelente para empresa. Estenda para agregador/condomínio com "Aprovar como membro da minha rede".
   - LGPD: Mantenha mascaramento (já tem em vários lugares). Para agregador, permitir ver só "meus" indicados sem expor toda a base do convênio.
   - HelpBoxes (regra 19/05): Atualize todos os existentes com linguagem que cubra os três papéis ("sua empresa / sua rede de captação / seu grupo ou condomínio").

6. **Técnicas / Arquitetura (para não virar bagunça quando evoluirmos):**
   - Adicione flag leve no `Convenio` ou no `ConviteConvenioMembro` (ex: `origemCapta: 'AGREGADOR' | 'CONDOMINIO' | 'EMPRESA_DIRETA'`). Isso permite filtrar e customizar a UI sem quebrar o modelo.
   - Reaproveite o que já existe: `convites-convenio-lote`, `MembroBuilderService`, `kwh-consumo` endpoint (Bloco 2), `decidir-aprovacao-empresa-logada`. Não duplique lógica.
   - Multi-tenant: O proxy herda o tenant do convênio — bom, mas documente que "agregador" e "condomínio" ainda são contextos separados no JWT (para não quebrar quando evoluirmos).
   - Feature flag global: `usarConvenioComoAgregador` (default true por enquanto). Quando false, volta a mostrar as telas antigas.
   - Evite hardcode: No header e HelpBoxes, use o `tipoParceiro` ou dados do contexto para decidir o texto ("Sua rede de captação" vs "Seu condomínio" vs "Sua empresa").

7. **Testes como QA Funcional (essenciais antes de liberar o proxy):**
   - Cenário Hangar-like: Criar convênio EMPRESA com 3-5 membros via convite lote (agregador). Ver se "Minha Rede" mostra os membros corretamente, kWh por funcionário, aprovação in-portal, cobrança consolidada.
   - Condomínio: Vincular administradora/condominio ao convênio. Testar visão de grupo + rateio.
   - Supressão: Confirmar que /agregador e telas de condomínio/administradoras não aparecem no nav para usuários com esses contextos (ou mostram "Em evolução — use o convênio por enquanto").
   - Multi-contexto: Usuário com contexto agregador + cooperado troca sem perder dados de captação.
   - Bugs conhecidos amplificados: Teste explicitamente convite em lote, refresh após aprovação, visibilidade de kWh/UC no contexto de "agregador".
   - LGPD + segurança: Agregador não vê membros de outros agregadores no mesmo convênio (se o filtro por "minha captação" estiver correto).
   - Smoke E2E com telefone whitelist (5527981341348) simulando "Carlos" trazendo membros.

**Resumo da minha opinião:** Sim, vamos com o proxy via convênio. É a forma mais rápida de dar ferramenta útil para quem capta (agregador) e quem gerencia grupos (condomínio) sem ficar mostrando telas vazias. O convênio já é o "agregador de membros" na prática (Hangar/Moradas são a prova viva). Melhore a tela do convênio com as sugestões acima (priorize nomenclatura flexível + seção "Minha Rede" + KPIs de captação; suporte a condomínio/rateio; melhorias técnicas de flag + reaproveitamento). Depois documente claramente no HelpBox e no dossiê de papéis que isso é temporário ("Estamos usando o portal do convênio como base para captação e grupos enquanto evoluímos as visões dedicadas de Agregador e Condomínio").

Isso reduz dívida de UX (telas incompletas) e foca energia no que já funciona. Quando o Code evoluir o agregador/condomínio dedicado, a migração será mais fácil porque o backend de convites/membros/kWh já está maduro.

Se quiser, posso atualizar este dossiê com uma sub-seção "Proposta: Proxy via Convênio para Agregador/Condomínio (análise + melhorias sugeridas)" ou preparar o resumo curto para WhatsApp + arquivo para Claude Code desktop. Me avisa como quer prosseguir (ou se quer que eu leia mais alguma sessão específica sobre Hangar/MLM para refinar). 

(Continuando a leitura de outros artefatos em paralelo: a cadeia de Hangar mostra exatamente o caso de uso de "agregador via empresa" que estamos discutindo — 165 membros, MLM, sem indicação direta pro topo. Perfeito para validar o proxy.)

**Análise da proposta (usuário + QA + multi-perspectiva): usar o Convênio (empresa_conveniada) como proxy temporário para Agregador + Condomínio/Administradora**

**O que eu acho:**
Sim, é uma decisão pragmática e inteligente no curto prazo (próximos 4-8 semanas). O Hangar (e Moradas) já prova na prática que "empresa conveniada" funciona como veículo de captação em volume + estrutura de grupo:
- 165 membros Hangar + 50 Moradas = 215 no mesmo convênio.
- Cadeia MLM explícita (indicações, tokens BONUS_INDICACAO pendentes, "Conveniado Hangar LTDA" como nível 0).
- O portal /conveniada 9.0/9.1 já entrega o núcleo de "agregação":
  - Convites (individual + lote via EnvioLoteSection).
  - Aprovação in-portal pela empresa (MembrosPendentesSection + decidir-aprovacao-empresa-logada).
  - Visão de consumo por "funcionário/membro" (Bloco 2 — kWh-consumo com fonte única, preview, rateio).
  - Cobranças consolidadas (F1).
  - Header rico (empresaNome, naturezaAtoCooperativo, baseCobrancaCusteio, kwhAlocadoMensal).
Isso cobre 70-80% do que um "agregador que capta clientes" (Carlos) ou "administradora/síndico de condomínio" precisa: trazer gente, ver quem entrou, alocar kWh, cobrar de forma agregada.

**Prós:**
- Velocidade de valor: Desbloqueia ferramenta útil para captação agora, sem esperar o agregador/condomínio evoluir (eles estão entre os mais atrasados — "ainda não evoluiu", "cruzamento de dados real falta", "esqueleto").
- Reuso de código maduro: Em vez de duplicar lógica de convites/membros/kWh em três portais, concentramos no convênio (que já tem GestaoConvitesSection + MembrosPendentesSection + EnvioLoteSection + kWh consumption).
- Menos frustração: Suprimir as duas telas (via nav hide, feature-flag `mostrarAgregador` / `mostrarCondominio` = false, ou redirect) evita mostrar dashboards vazios ou com só um card de contagem.
- Alinhamento com realidade: Hangar/Moradas já operam exatamente como "empresa que capta via MLM + grupo". O proxy reflete como as coisas já são usadas.

**Contras / Riscos (sérios, mas gerenciáveis):**
- Confusão de papéis e UX: "Empresa conveniada" (pagadora corporativa, RH-like, "benefício aos colaboradores") não é a mesma coisa que "Agregador MLM" (vive de indicação, quer árvore de rede + payout por nível) nem "Condomínio/Administradora" (síndico, rateio interno, visão de grupo/assembleia). Usar o mesmo portal pode gerar frustração se o rótulo e os fluxos não se adaptarem (ex: agregador quer ver "minha cascata de indicação"; condomínio quer rateio explícito + "quem já aderiu do meu prédio").
- Dívida de modelagem futura: O ConvênioCooperado / Membro vira "saco de estado" para três personas. Quando evoluirmos portais dedicados, a migração de dados/fluxos pode doer (ex: adicionar tag `origemCapta: AGREGADOR | CONDOMINIO | EMPRESA` agora ajuda, mas não resolve tudo).
- Bugs existentes se amplificam: Convite em lote (ainda não envia), UI não atualiza após aprovar (precisa F5), dados de UC/kWh/EDP não aparecem direito nas telas — tudo isso vai impactar "agregadores" e "condomínios" que passarem a usar o proxy.
- Visibilidade de "captação": O agregador clássico (Carlos) quer métricas claras de "quanto eu trouxe" (membros por nível, kWh agregados, receita gerada pela minha rede). O convênio atual mostra por convênio, não por "quem capta".
- Multi-contexto: Usuário com contexto `admin_agregador` + `empresa_conveniada` pode ficar confuso na troca se a tela do convênio não deixar explícito "você está operando como Agregador neste convênio".

**Minha posição final (como QA Funcional + arquiteto + usuário final):**
Sim, vamos com o proxy. É a melhor relação custo x benefício agora. O convênio já é o "agregador de membros" na prática (Hangar prova). Suprima as duas telas dedicadas (esconda do sidebar/nav para contextos de agregador/condomínio, ou use feature-flag default false) para reduzir ruído e evitar mostrar trabalho incompleto. Foque energia em melhorar a tela do convênio para servir como "ferramenta de captação + gestão de grupo" temporária.

**Melhorias concretas sugeridas na tela do Convênio (priorizadas por impacto x esforço):**

1. **Nomenclatura + contexto flexível (alto impacto, baixo esforço — faça primeiro):**
   - No header atual (empresaNome, natureza, baseCobrancaCusteio, kwhAlocado): Adicione badge dinâmico ou seletor "Modo de operação: Empresa Pagadora | Agregador (captação) | Condomínio/Grupo".
   - Mude rótulos dinamicamente: "Funcionários / Membros da minha rede / Moradores do grupo".
   - HelpBox grande na home e no dashboard do convênio: "Você está usando este convênio como ferramenta de captação de clientes (agregador) ou gestão de grupo (condomínio). Os membros que você convidar via sua rede aparecem aqui com tag de origem."

2. **Seção "Minha Captação / Rede" (essencial para o papel de agregador — impacto alto):**
   - Reaproveite e estenda `GestaoConvitesSection` + `MembrosPendentesSection` + `EnvioLoteSection` (já são o coração da captação).
   - Adicione sub-aba ou card "Minha Rede de Indicação / Captação" (aproveitando `cooperadoIndicadorId` e dados de MLM já existentes no schema):
     - Lista ou árvore simples dos membros que entraram via minha indicação (nível 1, 2...).
     - KPIs: "Membros trazidos por mim: X (Y% do total do convênio)", "kWh agregados pela minha rede este mês", "Bônus/ tokens gerados pela minha captação".
   - Tag em cada membro: "Origem: Captação via Agregador" ou "Via Condomínio X".
   - Convite em lote: Já existe. Melhore o feedback de status (o bug "não envia" é crítico para agregadores — priorize). Adicione modo "Abrir no WhatsApp" (já tem em LOTE.5) com mensagem personalizada "Convidado por [meu nome como agregador]".

3. **Suporte explícito a "Condomínio / Grupo" (rateio + visão coletiva):**
   - Se o convênio tiver `condominioId` ou `administradoraId` vinculado (já existe no schema): Mostrar seção "Visão do Grupo/Condomínio" com:
     - Rateio interno (reaproveitar lógica de outros módulos).
     - Lista de "sub-membros" ou "unidades" com consumo agregado.
     - Possibilidade de "Aderir como grupo" ou aprovação em bloco.
   - Filtro na tabela de membros: "Por origem (minha captação / condomínio / direto)".

4. **KPIs e visibilidade de captação (beneficia agregador + condomínio + empresa):**
   - No dashboard do convênio (além dos contadores de membros e cobranças atuais): Adicionar cards "Captação via minha rede (agregador)", "Membros do grupo (condomínio)", "% de kWh/consumo vindo da minha captação".
   - Histórico simples: "Membros que entrei via minha indicação este mês" + evolução.
   - No topo ou sidebar: "Sua contribuição como Agregador/Condomínio: X membros • Y kWh • Z de receita gerada".

5. **Melhorias de UX/Operação (baixa esforço, alto ganho):**
   - ContextoSwitcher bem visível + banner na primeira entrada: "Logado como Agregador/Captação neste convênio. Troque de contexto se precisar ver como cooperado."
   - Aprovação in-portal (MembrosPendentesSection): Já excelente. Estenda com "Aprovar como membro da minha rede de captação" (para agregador/condomínio).
   - LGPD: Mantenha mascaramento forte. Para agregador, permitir filtro "só meus indicados" sem expor toda a base do convênio.
   - HelpBoxes (regra 19/05): Atualize todos os existentes com linguagem que cubra os três papéis ("sua empresa / sua rede de captação / seu grupo ou condomínio").

6. **Técnicas / Arquitetura (para não virar bagunça quando evoluirmos):**
   - Adicione campo leve (pode ser no `Convenio` ou no `ConviteConvenioMembro`): `origemCapta: 'AGREGADOR' | 'CONDOMINIO' | 'EMPRESA_DIRETA'` ou flag booleana `ehCaptaViaAgregador`.
     - Isso permite filtrar, customizar UI e relatórios sem quebrar o modelo atual.
   - Reaproveite tudo que já existe (não duplique): convites-convenio (lote + OTP), MembroBuilderService, kwh-consumo endpoint (Bloco 2), decidir-aprovacao-empresa-logada, atomicidade de aprovação.
   - Multi-tenant: O proxy herda o tenant do convênio (bom). Documente que "agregador" e "condomínio" continuam sendo contextos separados no JWT (para não quebrar quando criarmos os portais dedicados).
   - Feature-flag de transição: `usarConvenioComoAgregador` (default true agora). Quando false, volta a mostrar as telas antigas (ou redireciona).
   - Evite hardcode de rótulos: Use o `tipoParceiro`, dados do contexto ou a flag acima para decidir textos e seções.

7. **Testes como QA Funcional (obrigatórios antes de liberar o proxy):**
   - Cenário Hangar-like (agregador via empresa): Criar convênio EMPRESA, trazer 3-5 membros via convite lote "como agregador", verificar se "Minha Rede" mostra os membros corretamente, kWh por membro, aprovação in-portal, cobrança consolidada, KPIs de "trazidos por mim".
   - Cenário Condomínio: Vincular administradora/condominio ao convênio. Testar visão de grupo + rateio + "moradores".
   - Supressão das telas antigas: Confirmar que /agregador e telas de condomínio/administradoras não aparecem no nav (ou mostram mensagem "Em evolução — use o convênio por enquanto").
   - Multi-contexto: Usuário com contexto agregador + cooperado consegue trocar sem perder visão de captação.
   - Bugs conhecidos amplificados: Teste explicitamente (e reporte regressão de) convite em lote, refresh após aprovação, visibilidade de kWh/UC no contexto de "agregador".
   - Segurança/LGPD: Agregador não vê membros de outros agregadores no mesmo convênio (filtro por "minha captação" deve funcionar). Email/telefone mascarado onde aplicável.
   - Smoke E2E com telefone whitelist (ex: 5527981341348 simulando "Carlos"): Captação completa + visão no convênio + troca de contexto.
   - Edge: Convênio com membros de múltiplas origens (agregador + direto + condomínio) — filtros e KPIs se comportam bem.

**Resumo da minha opinião final:** Sim, vamos com o proxy via convênio. É a forma mais rápida e menos dolorosa de dar ferramenta útil para quem capta (agregador) e quem gerencia grupos (condomínio) sem ficar exibindo trabalho incompleto. O convênio já é o "agregador de membros" na prática — Hangar/Moradas são a prova viva. Suprima as duas telas dedicadas (esconda do nav ou via flag) e foque em melhorar a tela do convênio com as sugestões acima (prioridade 1: nomenclatura flexível + seção "Minha Rede de Captação" + KPIs de contribuição; prioridade 2: suporte explícito a condomínio/rateio; prioridade 3: melhorias técnicas de flag + reaproveitamento).

Isso reduz frustração de usuários e telas quebradas, concentra esforço no que já está mais maduro, e deixa o caminho aberto para evoluir os portais dedicados depois (a migração será mais fácil porque o backend de convites/membros/kWh/consumo já está bem trabalhado).

Se quiser, posso:
- Adicionar esta análise completa como sub-seção nova no dossiê (ex: "Proposta de Proxy via Convênio para Agregador + Condomínio — Análise + Melhorias Sugeridas").
- Gerar versão curta para WhatsApp (número whitelist) com o resumo da proposta + principais melhorias.
- Deixar o arquivo atualizado pronto para carregar no Claude Code desktop.
- Ler mais sessões específicas (ex: as de MLM ou as de administradoras) para refinar ainda mais.

Me avisa como quer que eu proceda (ou se quer que eu leia mais alguma coisa enquanto isso). 

(Continuando a leitura paralela: a cadeia de Hangar reforça exatamente o caso de uso que estamos discutindo — 165 membros via empresa + MLM sem indicação direta pro topo. Perfeito para validar o proxy.)

**Análise da proposta: usar o Convênio (empresa_conveniada) como proxy temporário para Agregador + Condomínio/Administradora, suprimindo as telas dedicadas /agregador e /condominios/administradoras (ou escondendo via nav/feature-flag), e melhorando a tela do convênio conforme necessário.**

**O que eu acho (visão multi-perspectiva + QA):**
- **Pragmatismo alto no curto prazo (6-8 semanas):** Sim, faz muito sentido como "ponte". O Hangar (e Moradas) já é modelado como EMPRESA com convênio + 165+ membros + cadeia MLM explícita (indicações, tokens pendentes, "Conveniado Hangar LTDA" como topo da captação). O portal /conveniada já tem o núcleo de "agregação":
  - Gestão de convites (individual + lote — com os bugs conhecidos que já reportamos).
  - Membros pendentes + aprovação in-portal (empresa confirma antes do admin).
  - Consumo kWh por "funcionário" (Bloco 2 — fonte única, rateio, preview).
  - Cobranças consolidadas (F1).
  - Header com empresaNome, naturezaAtoCooperativo, baseCobrancaCusteio, kwhAlocadoMensal.
  Isso já cobre 70-80% do que um "agregador que capta clientes" ou "síndico/administradora de condomínio" precisa: trazer volume, ver quem entrou, alocar kWh, cobrar de forma agregada.
- **Riscos de confusão de papéis:** Alto se não documentarmos bem. "Empresa conveniada" (pagadora corporativa, HR-like) ≠ "Agregador MLM" (Carlos que vive de indicação em rede) ≠ "Administradora/Condomínio" (síndico ou gestora de prédio com rateio interno). Usar o mesmo portal pode borrar as diferenças de UX e regras (ex: agregador quer árvore MLM + payout por nível; condomínio quer rateio proporcional + assembleia-like approvals; empresa quer "benefício aos colaboradores" + kWh por funcionário). No dossiê anterior vimos que TipoContexto já separa `empresa_conveniada` de `admin_agregador`. Suprimir as telas não apaga o contexto no JWT — o usuário ainda pode ter múltiplos contextos e ficar confuso na troca.
- **Impacto no roadmap:** Bom para desbloquear captação agora (prioridade de crescimento), ruim se virar "solução permanente" e atrasar a evolução dedicada (o agregador está "ainda não evoluiu" desde a VISAO de abril). Hangar já prova que o modelo de "empresa + MLM" funciona no backend (seed + cadeia de indicações). Suprimir as telas reduz carga de manutenção de skeletons incompletos (dashboard agregador é só um card de contagem; administradoras é CRUD básico sem visão operacional).
- **Do ponto de vista do usuário final (Carlos agregador ou síndico):** Pode ser bom ou ruim dependendo da persona. Para um agregador "puro" (MLM), a tela de convênio já é mais madura que o skeleton atual do /agregador (gestão de convites em lote + aprovação + kWh por membro). Para um condomínio, o "convênio" já suporta múltiplos membros com rateio/consumo real. Mas pode faltar "sabor" específico (ex: agregador quer ver "minha rede de indicação" com árvore; condomínio quer rateio interno + votação de adesão).
- **Técnico (arquiteto/DB/dev):** Baixo risco de regressão se usarmos feature-flag ou hide simples no nav (middleware/context já controla). Reaproveitamos o backend de convites/membros/cobrancas (que já tem administradoraId e condominioId em schema). Mas cria "dívida de modelagem": o ConvênioCooperado/Membro pode virar "saco de estado" para três papéis diferentes. Futuro refactoring (separar agregadorId vs convenioId vs condominioId) vai ser mais doloroso se muita gente usar o proxy. Multi-tenant continua valendo (cada um vê só o seu).

**Prós da proposta:**
- Velocidade: Desbloqueia captação de volume (Hangar-like) sem esperar evolução do agregador/condomínio.
- Reuso: A tela do convênio já faz "agregação" de verdade (convites, membros, kWh por "funcionário", cobrança consolidada). Melhor que o dashboard agregador atual (só contagem).
- Menos telas quebradas: Evita mostrar skeletons que geram frustração (como o agregador atual que "cruzamento de dados real falta" desde abril).
- Alinhado com realidade: Hangar/Moradas já operam como "empresa conveniada que capta via MLM + estrutura de grupo".

**Contras / Riscos:**
- Confusão de identidade: Usuário com contexto `admin_agregador` ou "condomínio" logando no /conveniada pode achar que está no lugar errado (nomenclatura "Empresa", "funcionários", etc.).
- Limitações de UX: Convênio atual foca em "pagador corporativo" (kWh por funcionário, benefício). Agregador puro pode precisar de "árvore de indicação", "payout por nível", "meus leads". Condomínio pode precisar de rateio mais explícito + visão de "assembleia".
- Dívida futura: Quando decidirmos evoluir os portais dedicados, teremos que migrar dados/fluxos de gente que já se acostumou com o proxy.
- Bugs existentes amplificados: Convite em lote (ainda não envia), UI não atualiza após aprovar, dados de kWh/UC não aparecem direito — tudo isso vai afetar "agregadores" e "condomínios" que usarem o proxy.
- Visibilidade de captação: O agregador "Carlos" quer ver "quanto eu trouxe de kWh/receita este mês" de forma clara. O convênio atual mostra por convênio, não por "quem capta".

**Minha recomendação (como QA + arquiteto + usuário):**
Sim, vamos com o proxy por enquanto — é a decisão mais pragmática dado o estado atual (agregador/condomínio são os mais atrasados nos portais, enquanto o convênio 9.0/9.1 está bem mais maduro e já prova o caso de uso real com Hangar). Suprima as duas telas (esconda do nav, ou via feature-flag `mostrarPortalAgregador` / `mostrarPortalCondominio` default false) para reduzir ruído e foco.

**Melhorias concretas sugeridas na tela do Convênio (para suportar agregador + condomínio temporariamente):**

1. **Nomenclatura e contexto flexível (alto impacto, baixo esforço):**
   - No header do convênio (já tem empresaNome, natureza, baseCobrancaCusteio, kwhAlocado): Adicione badge dinâmico "Modo: Empresa / Agregador / Condomínio" (baseado em flag no Convênio ou no contexto do usuário). Mude rótulos: "Funcionários / Membros da Rede / Moradores".
   - Ajude o usuário na primeira vez: HelpBox grande "Você está usando este convênio como ferramenta de captação (agregador) ou gestão de grupo (condomínio). Os membros que você convidar aparecem aqui."

2. **Seção "Minha Captação / Rede" (essencial para agregador):**
   - Reaproveite + melhore o `GestaoConvitesSection` e `MembrosPendentesSection` (já existem e são o coração da captação).
   - Adicione aba ou sub-seção "Minha Rede de Indicação" (se tiver `cooperadoIndicadorId` ou dados de MLM no convite/membro): Árvore simples ou lista "Nível 1 / Nível 2", contagem por nível, tokens/bônus gerados pela minha captação.
   - KPI novo no topo do convênio: "Membros trazidos por mim (agregador): X (Y% do total do convênio)", "kWh agregados pela minha rede este mês".
   - Convite em lote: Já existe (EnvioLoteSection). Melhore o status (o bug de "não envia" é crítico aqui — priorize fix antes de liberar para agregadores). Adicione tag "Origem: Captação via Agregador" nos membros.

3. **Suporte a "Condomínio / Grupo" (rateio + visão coletiva):**
   - Se o convênio tiver `condominioId` ou `administradoraId` vinculado: Mostrar seção "Visão do Grupo/Condomínio" com rateio (já tem lógica em outros lugares).
   - Adicionar "Aderir como grupo" ou lista de "sub-membros" com consumo agregado.
   - Filtro na lista de membros: "Por origem (agregador / condomínio / direto)".

4. **Melhorias gerais de UX/Visibilidade (que beneficiam todos os papéis que usarem o proxy):**
   - KPIs expandidos no header ou cards: Total membros, kWh alocado/consumido este mês, % de captação via "minha rede", pendentes de aprovação, inadimplência da minha captação.
   - Lista de membros mais rica: Colunas "Origem da Captação" (se vier de convite do agregador), "Nível MLM", "kWh individual", "Status no grupo".
   - Aprovação in-portal (MembrosPendentesSection): Já excelente para empresa. Estenda para agregador/condomínio com "Aprovar como membro da minha rede".
   - Histórico de captação: Timeline ou relatório simples "Membros que entrei via minha indicação este mês".
   - LGPD: Mantenha mascaramento (já tem em vários lugares). Para agregador, permitir ver só "meus" indicados sem expor toda a base do convênio.
   - ContextoSwitcher: Garanta que fique bem visível no topo (usuário pode ter contexto de "agregador" + "cooperado" ao mesmo tempo). Ajude na primeira entrada com banner "Você está logado como Agregador/Captação neste convênio".

5. **Técnicas / Arquitetura (para não virar bagunça):**
   - Adicione flag leve no `Convenio` ou no `ConviteConvenioMembro` (ex: `origemCapta: 'AGREGADOR' | 'CONDOMINIO' | 'EMPRESA_DIRETA'`). Isso permite filtrar e customizar a UI sem quebrar o modelo.
   - Reaproveite o que já existe: `convites-convenio-lote`, `MembroBuilderService`, `kwh-consumo` endpoint (Bloco 2), `decidir-aprovacao-empresa-logada`. Não duplique lógica.
   - Multi-tenant: O proxy herda o tenant do convênio — bom, mas documente que "agregador" e "condomínio" ainda são contextos separados no JWT (para não quebrar quando evoluirmos).
   - Feature flag global: `usarConvenioComoAgregador` (default true por enquanto). Quando false, volta a mostrar as telas antigas.
   - Evite hardcode: No header e HelpBoxes, use o `tipoParceiro` ou dados do contexto para decidir o texto ("Sua rede de captação" vs "Seu condomínio" vs "Sua empresa").

6. **Testes como QA Funcional (essenciais antes de liberar o proxy):**
   - Cenário Hangar-like: Criar convênio EMPRESA com 3-5 membros via convite lote (agregador). Ver se "Minha Rede" mostra os membros corretamente, kWh por funcionário, aprovação in-portal, cobrança consolidada.
   - Condomínio: Vincular administradora/condominio ao convênio. Testar visão de grupo + rateio.
   - Supressão: Confirmar que /agregador e telas de condomínio/administradoras não aparecem no nav para usuários com esses contextos (ou mostram "Em evolução — use o convênio por enquanto").
   - Multi-contexto: Usuário com contexto agregador + cooperado troca sem perder dados de captação.
   - Bugs conhecidos amplificados: Teste explicitamente convite em lote, refresh após aprovação, visibilidade de kWh/UC no contexto de "agregador".
   - LGPD + segurança: Agregador não vê membros de outros agregadores no mesmo convênio (se o filtro por "minha captação" estiver correto).
   - Smoke E2E com telefone whitelist (5527981341348) simulando "Carlos" trazendo membros.

**Resumo da minha opinião:** Sim, vamos com o proxy. É a forma mais rápida de dar ferramenta útil para quem capta (agregador) e quem gerencia grupos (condomínio) sem ficar mostrando telas vazias. O convênio já é o "agregador de membros" na prática (Hangar prova). Melhore a tela do convênio com as sugestões acima (priorize nomenclatura flexível + seção "Minha Rede" + KPIs de captação). Depois documente claramente no HelpBox e no dossiê de papéis que isso é temporário ("Estamos usando o portal do convênio como base para captação e grupos enquanto evoluímos as visões dedicadas de Agregador e Condomínio").

Isso reduz dívida de UX (telas incompletas) e foca energia no que já funciona. Quando o Code evoluir o agregador/condomínio dedicado, a migração será mais fácil porque o backend de convites/membros/kWh já está maduro.

Se quiser, posso atualizar este dossiê com uma sub-seção "Proposta: Proxy via Convênio para Agregador/Condomínio (análise + melhorias sugeridas)" ou preparar o resumo curto para WhatsApp + arquivo para Claude Code desktop. Me avisa como quer prosseguir (ou se quer que eu leia mais alguma sessão específica sobre Hangar/MLM para refinar). 

(Continuando a leitura de outros artefatos em paralelo: a cadeia de Hangar mostra exatamente o caso de uso de "agregador via empresa" que estamos discutindo — 165 membros, MLM, sem indicação direta pro topo. Perfeito para validar o proxy.)

## 4. Regras Transversais Importantes (identificadas)

- **Multi-tenant forte:** Quase todo recurso tem cooperativaId. Guards (tenant-guard, tenant-ownership, pagador-cooperado, etc.) + helpers no service.
- **Contexto / Troca de contexto:** /selecionar-contexto + ContextoSwitcher no header de quase todos os portais. `useContexto()` hook.
- **Perfil vs TipoContexto:** Perfil (COOPERADO/ADMIN/...) define navegação base; TipoContexto define o "chapéu" atual (empresa_conveniada vs cooperado vs proprietario).
- **Public vs Autenticado:** Muitos fluxos de cadastro/convite/assinar são públicos ou semi-públicos (com token).
- **UI não reativa em alguns lugares:** Vários relatos de necessidade de F5 após ações de confirmação/aprovação (tanto no lado conveniada quanto admin).
- **Dados de cadastro (UC, kWh, EDP):** Persistidos em Cooperado/UC mas nem sempre aparecem nas telas de empresa conveniada ou admin (gap de UI + possivelmente de service).

---

## 5. Resumo de Bugs Conhecidos (confirmados ou aprofundados até agora)

(Usar formato solicitado)

1. **[P1] · Convites em lote (empresa conveniada)**  
   Passo: Empresa conveniada → tenta enviar lote de convites.  
   Esperado: Envia WhatsApp + OTP para todos.  
   Obtido: Não envia (individual funciona).  
   Causa provável: endpoint ou service de lote não implementado ou quebrado.  
   Sugestão: Investigar controller/service de convites-convenio-lote.

2. **[P2] · UI não atualiza após Confirmar/Aprovar**  
   Afeta: Portal conveniada e admin dashboard.  
   Esperado: Lista/status atualiza em tempo real ou após ação.  
   Obtido: Precisa de F5 manual.  
   (Conhecido, reproduzido no Cenário 1.)

3. **[P2/P3] · Dados de UC/EDP/kWh do cadastro não aparecem**  
   Afeta: Telas da Santi (conveniada) e admin.  
   Esperado: Após cadastro + aprovação, membro mostra UC, nº instalação, kWh alocado.  
   Obtido: Muitas vezes em branco ou "tarifa não configurada".  
   (Reproduzido no Cenário 1.)

4. **[P3] · Card do convênio ignora tarifa fixa**  
   Mostra "Tarifa cheia" / "tarifa não configurada" mesmo quando há configuração de tarifa fixa no convênio.  
   (Conhecido, precisa confirmar em tela específica.)

**O que passou OK (amostra):**
- Cadastro público básico (/auth/register e fluxos /cadastro) cria usuário + token.
- Login + seleção de contexto funciona para usuários com múltiplos perfis.
- Portal conveniada carrega e mostra contexto.
- Convite individual envia WhatsApp/OTP.
- Admin vê lista de pendentes da sua cooperativa.
- Layouts se adaptam ao TipoContexto (nav diferente por perfil).

---

## 6. Próximos Passos Recomendados para QA

- Aprofundar Cenário 2 (cadastro público PF → aprovação → fila → alocação → ativação) com foco em visibilidade de dados no /portal.
- Teste sistemático do Cenário 3 (multi-cadastro + troca de contexto em todos os portais).
- Para cada modelo acima, testar **todas as subpáginas** com um usuário real do tipo (usando credenciais de teste + tokens).
- Testar regras de tenant isolation (ADMIN de uma coop tentando acessar dados de outra → 403?).
- Testar permissões granulares dentro de /dashboard (ex: um ADMIN consegue ver /saas ?).
- Validar todos os fluxos de "assinatura", "documentos", "PIN", "desligamento".
- Testar com `AMBIENTE_REAL=true` usando apenas os 2 telefones whitelist (enviar WhatsApp real de teste).

---

**Este dossiê é uma primeira versão abrangente baseada em exploração de estrutura + testes parciais do Cenário 1.**  
Posso aprofundar página por página de qualquer modelo específico (ex: ler todos os page.tsx de /conveniada e testar cada botão/form) ou expandir com mais achados de API/UI.

Relatório gerado em modo QA estrito (apenas reportar).

---

*Arquivo salvo em docs/relatorios/ para fácil carregamento no Claude Code desktop.*
