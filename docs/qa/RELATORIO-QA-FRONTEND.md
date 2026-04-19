# RELATÓRIO QA - FRONTEND (UX/UI)
**Data:** 2026-03-20
**Escopo:** Todas as telas do dashboard Next.js (cooperativa de energia solar)
**Método:** Análise estática de código — componentes, fluxos, terminologia, endpoints

---

## 1. BUGS DE UI

| # | Componente / Tela | Arquivo | Descrição | Severidade |
|---|---|---|---|---|
| B01 | Página "Nova Cobrança" | `web/app/dashboard/cobrancas/nova/page.tsx` | Rota referenciada no botão "+" da listagem de cobranças, mas a página pode estar incompleta ou ausente do fluxo principal — criação de cobrança ocorre apenas dentro do detalhe do cooperado | **Alta** |
| B02 | Cooperado detalhe (monolito) | `web/app/dashboard/cooperados/[id]/page.tsx` | Arquivo com ~29KB+, 7 abas, múltiplos sheets/dialogs em um único componente. Risco de re-renders desnecessários e bugs de estado cruzado entre abas | **Alta** |
| B03 | UC detalhe — campo cooperadoId | `web/app/dashboard/ucs/[id]/page.tsx` | Campo cooperadoId é um input de texto livre em vez de dropdown/select — admin pode digitar ID inválido | **Média** |
| B04 | UC nova — campo cooperadoId | `web/app/dashboard/ucs/nova/page.tsx` | Mesmo problema: cooperadoId como dropdown mas sem busca/filtro — com centenas de cooperados, select fica inutilizável | **Média** |
| B05 | Contrato detalhe — edição limitada | `web/app/dashboard/contratos/[id]/page.tsx` | Só permite editar percentualDesconto, dataFim e status. Não permite trocar cooperado, UC ou usina (pode ser intencional, mas não há mensagem explicando) | **Baixa** |
| B06 | Plano detalhe — sem botão excluir | `web/app/dashboard/planos/[id]/page.tsx` | Backend tem DELETE `/planos/:id`, mas o frontend não oferece botão de exclusão | **Média** |
| B07 | Ocorrência detalhe — sem botão excluir | `web/app/dashboard/ocorrencias/[id]/page.tsx` | Backend tem DELETE `/ocorrencias/:id`, mas o frontend não oferece botão de exclusão | **Média** |
| B08 | Usina detalhe — campo producaoMensalKwh | `web/app/dashboard/usinas/[id]/page.tsx` | Campo existe no formulário de edição mas não aparece no formulário de criação (`usinas/nova`) | **Média** |
| B09 | Dashboard home — sem tratamento de erro individual | `web/app/dashboard/page.tsx` | Se uma das 4 chamadas de KPI falhar, o catch genérico esconde qual dado falhou — todos os cards ficam com valor 0 | **Média** |
| B10 | Notificações — polling sem cleanup | `web/app/dashboard/layout.tsx` | setInterval de 30s para polling de notificações; verificar se clearInterval é chamado corretamente no unmount para evitar memory leak | **Baixa** |
| B11 | Formulários sem feedback de erro do backend | Vários (`contratos/novo`, `ucs/nova`, `cobrancas/nova`, `ocorrencias/nova`) | Erros do backend são capturados com catch genérico ("Erro ao criar...") sem exibir a mensagem específica do servidor (ex: validação, duplicidade) | **Alta** |
| B12 | Tabelas sem estado vazio | Vários (`ucs/page.tsx`, `ocorrencias/page.tsx`) | Quando não há registros, a tabela renderiza vazia sem mensagem "Nenhum registro encontrado" | **Média** |

---

## 2. FLUXOS CONFUSOS (visão do admin)

| # | Fluxo | Problema | Arquivos envolvidos |
|---|---|---|---|
| F01 | **Criar cobrança para cooperado** | Admin precisa: ir em Cooperados → abrir detalhe → aba "Cobranças Cooperativa" → clicar "+" → preencher sheet. Não há caminho direto pela tela de Cobranças. O botão "+" na lista de cobranças leva a `/cobrancas/nova` que é uma página separada sem o contexto do cooperado | `cooperados/[id]/page.tsx`, `cobrancas/page.tsx`, `cobrancas/nova/page.tsx` |
| F02 | **Cadastro cooperado COM UC** | Fluxo de 4+ steps (tipo → upload fatura → OCR → review → preferência → criar). Se OCR falhar parcialmente, admin precisa corrigir campos manualmente sem indicação clara de quais vieram do OCR e quais são editáveis | `cooperados/novo/page.tsx` |
| F03 | **Visualizar proposta do cooperado** | Proposta é calculada na aba "Proposta" do detalhe do cooperado, mas o dashboard do Motor de Proposta (`/motor-proposta`) mostra "últimas propostas" sem link direto para o cooperado. Informação duplicada sem conexão clara | `cooperados/[id]/page.tsx`, `motor-proposta/page.tsx` |
| F04 | **Alocar cooperado da lista de espera** | Admin vê lista de espera → clica "Alocar" → dialog pede para escolher usina. Mas não mostra quanto de capacidade o cooperado precisa vs. quanto a usina tem disponível de forma comparativa | `motor-proposta/lista-espera/page.tsx` |
| F05 | **Gerenciar documentos do cooperado** | Existem DUAS rotas para documentos: aba "Documentos" dentro de `cooperados/[id]/page.tsx` E a página dedicada `cooperados/[id]/documentos/page.tsx`. Duplicação de funcionalidade, possível confusão | `cooperados/[id]/page.tsx`, `cooperados/[id]/documentos/page.tsx` |
| F06 | **Reajuste de tarifas** | Fluxo: Motor Proposta → Reajustes → Criar → Escolher tarifa → Simular → Aplicar. São 5+ cliques para uma operação crítica. A simulação abre em sheet, o resultado em dialog de confirmação — muita troca de contexto | `motor-proposta/reajustes/page.tsx` |
| F07 | **Navegação Motor de Proposta** | Sub-páginas (tarifas, reajustes, configuração, lista-espera) são acessadas por botões no dashboard do motor, não pelo sidebar. Admin pode não descobrir essas funcionalidades | `motor-proposta/page.tsx` |
| F08 | **Buscar cooperado/contrato/UC** | Nenhuma tela de listagem tem campo de busca ou filtro. Com dezenas/centenas de registros, admin precisa rolar a página inteira para encontrar um registro | Todas as `page.tsx` de listagem |

---

## 3. INCONSISTÊNCIAS DE TERMINOLOGIA

| # | Termo A | Onde aparece | Termo B | Onde aparece | Sugestão |
|---|---|---|---|---|---|
| T01 | "Cooperado" | Sidebar, listagens, detalhe | "Membro" | Não usado | OK — consistente |
| T02 | "UC" (sigla) | Sidebar, listagens | "Unidade Consumidora" | Formulários de criação | Padronizar: usar "UC" na tabela e "Unidade Consumidora (UC)" no formulário |
| T03 | "Cobranças" | Sidebar, listagem cobranças | "Cobranças Cooperativa" | Aba no detalhe do cooperado | Padronizar para "Cobranças" em ambos |
| T04 | "Motor de Proposta" | Sidebar | "Propostas" | Aba no detalhe do cooperado | Confuso — são coisas relacionadas mas com nomes diferentes. Clarificar que "Motor" é a configuração e "Proposta" é o resultado |
| T05 | "Lista de Espera" | Sidebar (item separado) | "LISTA_ESPERA" | Status do contrato | Admin pode confundir: lista de espera é uma fila de alocação, mas o status do contrato LISTA_ESPERA indica contrato aguardando vaga. Mesma coisa, terminologia inconsistente na apresentação |
| T06 | "Fatura Concessionária" | Aba no cooperado | "Faturas" | Tipo de notificação, processamento | "Fatura" pode referir-se à fatura da concessionária (input) ou à cobrança da cooperativa (output). Ambiguidade perigosa |
| T07 | "Desconto %" | Coluna na listagem de contratos | "percentualDesconto" | Formulários | Na UI deveria ser sempre "Desconto (%)" com unidade explícita |
| T08 | "Potência" vs "Capacidade" | Usinas | "potenciaKwp" vs "capacidadeKwh" | Formulário usina | Falta explicação para o admin sobre a diferença entre os dois campos. Tooltip ou help text ausente |
| T09 | "Dar Baixa" | Botão na cobrança | "Marcar como Pago" | Esperado pelo usuário | "Dar Baixa" é jargão contábil; pode confundir operadores menos experientes |
| T10 | "dataInicio" / "dataFim" | Contrato forms | "Vigência" | Planos | Em contratos são campos separados; em planos é "Vigência". Padronizar apresentação |

---

## 4. FUNCIONALIDADES BACKEND SEM UI CORRESPONDENTE

| # | Endpoint Backend | Controller | Funcionalidade | Impacto |
|---|---|---|---|---|
| E01 | `POST /auth/facial/cadastrar` | auth-facial.controller.ts | Cadastro de reconhecimento facial | **Alto** — feature completa sem UI |
| E02 | `POST /auth/facial/verificar` | auth-facial.controller.ts | Verificação facial para login | **Alto** — feature completa sem UI |
| E03 | `GET/PUT/DELETE /config-tenant` | config-tenant.controller.ts | Configuração multi-tenant (chaves gerais do sistema) | **Alto** — admin não consegue configurar o tenant pelo frontend |
| E04 | `GET /planos/ativos` | planos.controller.ts | Listar apenas planos ativos | **Baixo** — filtro poderia ser usado na UI de seleção de plano |
| E05 | `GET /faturas/diagnostico` | faturas.controller.ts | Diagnóstico de faturas processadas | **Médio** — ferramenta de debug/suporte sem acesso na UI |
| E06 | `DELETE /planos/:id` | planos.controller.ts | Excluir plano | **Médio** — botão ausente na UI (ver B06) |
| E07 | `DELETE /ocorrencias/:id` | ocorrencias.controller.ts | Excluir ocorrência | **Médio** — botão ausente na UI (ver B07) |
| E08 | `DELETE /cooperados/:id` | cooperados.controller.ts | Excluir cooperado | **Médio** — apenas encerramento disponível na UI, sem exclusão definitiva |
| E09 | `DELETE /ucs/:id` | ucs.controller.ts | Excluir UC | **Médio** — sem botão de exclusão na listagem ou detalhe de UC |
| E10 | `DELETE /usinas/:id` | usinas.controller.ts | Excluir usina | **Médio** — sem botão de exclusão na listagem ou detalhe |
| E11 | `POST /motor-proposta/confirmar-opcao` | motor-proposta.controller.ts | Confirmar opção de proposta | **Médio** — fluxo de confirmação pode estar incompleto no frontend |
| E12 | `GET /motor-proposta/historico/:cooperadoId` | motor-proposta.controller.ts | Histórico de propostas por cooperado | **Médio** — não há tela de histórico de propostas no perfil do cooperado |
| E13 | `PUT /motor-proposta/proposta/:id` | motor-proposta.controller.ts | Editar proposta existente | **Baixo** — admin não consegue editar proposta pelo frontend |
| E14 | `DELETE /motor-proposta/proposta/:id` | motor-proposta.controller.ts | Excluir proposta | **Baixo** — admin não consegue excluir proposta pelo frontend |
| E15 | `GET /contratos/cooperado/:cooperadoId` | contratos.controller.ts | Contratos por cooperado (endpoint dedicado) | **Baixo** — frontend busca por endpoint genérico e filtra client-side |
| E16 | `GET /cobrancas/contrato/:contratoId` | cobrancas.controller.ts | Cobranças por contrato (endpoint dedicado) | **Baixo** — similar ao anterior |

---

## 5. MELHORIAS DE UX

| # | Área | Melhoria | Esforço | Impacto |
|---|---|---|---|---|
| M01 | **Todas as listagens** | Adicionar campo de busca/filtro em todas as tabelas (cooperados, contratos, UCs, usinas, cobranças, ocorrências) | Médio | **Crítico** |
| M02 | **Todas as listagens** | Adicionar paginação no frontend (backend já suporta?) — atualmente carrega todos os registros de uma vez | Médio | **Alto** |
| M03 | **Todas as listagens** | Adicionar ordenação clicável nas colunas das tabelas | Médio | **Alto** |
| M04 | **Cobranças** | Adicionar filtros por status (PENDENTE, PAGO, VENCIDO) e por período (mês/ano) na listagem principal | Baixo | **Alto** |
| M05 | **Cooperado detalhe** | Refatorar componente monolítico em sub-componentes por aba. Cada aba deveria ser um componente separado | Alto | **Alto** |
| M06 | **Dashboard home** | Adicionar gráficos de tendência (cobranças por mês, novos cooperados por mês, geração por usina) | Médio | **Médio** |
| M07 | **Config Tenant** | Criar tela de configurações do sistema (`/dashboard/configuracoes`) para o admin gerenciar parâmetros do tenant | Médio | **Alto** |
| M08 | **Formulários** | Exibir mensagens de erro específicas do backend (ex: "CPF já cadastrado") em vez de mensagem genérica | Baixo | **Alto** |
| M09 | **Ações de exclusão** | Adicionar botões de exclusão com confirmação para: planos, ocorrências, UCs, usinas, cooperados | Baixo | **Médio** |
| M10 | **Motor de Proposta** | Adicionar sub-navegação (tabs ou breadcrumbs) nas sub-páginas para o admin não se perder | Baixo | **Médio** |
| M11 | **Responsividade** | Tabelas não têm tratamento para telas pequenas — em mobile, tabelas com 7-9 colunas ficam cortadas ou com scroll horizontal sem indicação visual | Médio | **Médio** |
| M12 | **Acessibilidade** | Adicionar `aria-label` em botões de ícone (ex: botões "+" sem texto), `aria-live` em regiões de loading/toast, `role` em badges de status | Baixo | **Médio** |
| M13 | **Loading states** | Formulários de criação/edição não mostram loading no botão de submit — admin pode clicar múltiplas vezes e criar duplicatas | Baixo | **Alto** |
| M14 | **Cooperado novo (SEM_UC)** | Adicionar máscara de CPF/CNPJ, telefone e validação em tempo real no formulário | Baixo | **Médio** |
| M15 | **Navegação** | Adicionar breadcrumbs em todas as páginas de detalhe para facilitar retorno à listagem | Baixo | **Médio** |
| M16 | **Tabela estado vazio** | Todas as tabelas deveriam mostrar ilustração + mensagem quando não há dados, com CTA para criar o primeiro registro | Baixo | **Médio** |
| M17 | **Exportação** | Adicionar botão "Exportar CSV" nas listagens de cobranças, cooperados e contratos (usinas já tem para lista concessionária) | Baixo | **Médio** |
| M18 | **Atalhos** | Na listagem de cobranças, adicionar botão "Dar Baixa" inline (sem precisar entrar no detalhe) para cobranças PENDENTE | Baixo | **Alto** |

---

## 6. RESUMO EXECUTIVO — TOP 5 PRIORIDADES

### 1. Busca e filtros nas listagens (M01, M04, F08)
**Impacto:** Crítico
**Motivo:** Com o crescimento da base, admin não consegue encontrar registros sem scroll manual. É o problema de UX mais impactante no dia-a-dia.
**Arquivos:** Todas as `page.tsx` de listagem em `web/app/dashboard/*/page.tsx`

### 2. Feedback de erro específico do backend (B11, M08)
**Impacto:** Alto
**Motivo:** Admin não sabe o que corrigir quando recebe "Erro ao criar cooperado". Backend retorna mensagens detalhadas (CPF duplicado, validação falhou) que são descartadas pelo frontend.
**Arquivos:** Todos os formulários de criação/edição

### 3. Config Tenant sem UI (E03, M07)
**Impacto:** Alto
**Motivo:** Backend tem CRUD completo de configurações do tenant, mas admin precisa de acesso direto ao banco para alterar configurações. Feature crítica para operação sem desenvolvedor.
**Arquivos:** Criar `web/app/dashboard/configuracoes/page.tsx`

### 4. Funcionalidades de exclusão ausentes (B06, B07, E06-E10, M09)
**Impacto:** Médio-Alto
**Motivo:** 6+ entidades têm DELETE no backend sem botão correspondente no frontend. Admin não consegue corrigir cadastros errados sem acesso ao banco.
**Arquivos:** Páginas de detalhe de planos, ocorrências, UCs, usinas

### 5. Loading state em botões de submit (M13)
**Impacto:** Alto
**Motivo:** Sem indicação de loading, admin clica múltiplas vezes → criação de registros duplicados. Bug facilmente reproduzível e com impacto em dados.
**Arquivos:** Todos os formulários com `onSubmit` em `web/app/dashboard/`

---

*Relatório gerado por análise estática de código. Recomenda-se validação manual com usuários reais para confirmar prioridades.*
