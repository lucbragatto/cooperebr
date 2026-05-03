# SISGD-VISAO-COMPLETA.md (HISTÓRICO)

> **Movido pra histórico em 03/05/2026.**
>
> Última edição: 26/04/2026 (commit `087e3bd`)
>
> **Substituído por Doc-0:**
> - `docs/PRODUTO.md` (Camadas + Apêndices) — visão humana atual
> - `docs/REGULATORIO-ANEEL.md` — manual técnico-regulatório
> - `docs/SISTEMA.md` — em construção (Doc-0 Fatia 3)
> - `CLAUDE.md` (raiz) — operacional Claude Code
>
> **2 seções únicas valiosas catalogadas pra extração futura:**
> - Seção 2 "Três histórias completas" → débito formal D-30S em `docs/debitos-tecnicos.md` (extrair pra `docs/JORNADAS-USUARIO.md`)
> - Seção 5 "Painéis necessários por papel" → débito formal D-30T em `docs/debitos-tecnicos.md` (extrair pra `docs/PAINEIS-POR-PAPEL.md`)
>
> Investigação de propósito: sessão 02/05/2026 tarde (relatório acima).
> Movimentação executada em 03/05/2026 (Fase 2.6 — fechamento consolidado).

---

# SISGD — Visão completa (linguagem humana)

> **Pra quem é este documento:** Luciano (dono do projeto, juiz TJES, não-programador).
> **Pra que serve:** mapa único do sistema. Quem usa, o que existe, o que falta, em que ordem construir o resto.
> **Última atualização:** 2026-04-26 (revisão pós-leitura externa + correção de 3 lacunas)
> **Atenção:** o sistema se chama **SISGD**. **CoopereBR** é o primeiro parceiro que usa o sistema. O Luciano é dono do SISGD; a CoopereBR é cliente do SISGD.

---

## Índice

1. [Quem usa o sistema (12 papéis)](#1-quem-usa-o-sistema)
2. [Três histórias completas](#2-três-histórias-completas)
3. [O que cada papel precisa ver (telas)](#3-o-que-cada-papel-precisa-ver-telas)
4. [Inventário: o que existe vs o que falta](#4-inventário-do-que-existe-vs-o-que-falta)
5. [Painéis necessários](#5-painéis-necessários-por-papel)
6. [Ordem sugerida de construção](#6-ordem-sugerida-de-construção)
7. [Glossário](#7-glossário)

---

## 1. Quem usa o sistema

Esta é a lista completa de papéis humanos que tocam o SISGD hoje ou que vão tocar. Cada um com nome inventado pra ficar fácil de pensar como pessoa real.

### 1.1. Luciano (Dono da Plataforma — `SUPER_ADMIN`)
Você. Dono do SISGD. Vende a plataforma pros parceiros (cooperativas, condomínios, associações). Cobra cada parceiro pelo uso. **Vê tudo de todo mundo.** Cuida da saúde do sistema (servidor, integrações, pagamentos do gateway). Hoje precisa abrir várias telas pra fazer essa governança — não tem painel único.

### 1.2. Marcos (Admin do parceiro — `ADMIN`)
Administrador da CoopereBR (cooperativa parceira). Cadastra cooperados, gera cobranças, aprova faturas que chegam por email da EDP, cobra inadimplentes. **Não enxerga nenhum outro parceiro** (multi-tenant: cada admin vê só seu parceiro). Quando o sistema tiver 2º parceiro, terá um Marcos pra cada.

### 1.3. Pedro (Operador — `OPERADOR`)
Funcionário operacional do parceiro (hipotético — perfil existe no código mas não há nenhum cadastrado hoje). Faz tarefas do dia a dia: aprova fatura, registra pagamento, atende cooperado. Mesmo escopo do Marcos mas com algumas restrições (não mexe em configurações nem em planos).

### 1.4. Ana (Cooperada solta — `COOPERADO`)
Pessoa física que descobriu a CoopereBR pelo Instagram, se cadastrou pelo site (`/cadastro`), conta de luz própria (CPF), 1 UC residencial. Hoje paga 18-20% menos na conta. Acessa o portal do cooperado (`/portal`) pra ver suas faturas, pagamentos, indicar amigos, baixar boleto.

### 1.5. Júlia (Cooperada via indicação — `COOPERADO` com `indicadorCooperadoId`)
Mesma natureza da Ana, mas chegou pelo link de indicação dela (`/cadastro?ref=ANA`). O sistema registra Indicação. Quando Júlia paga primeira fatura, Ana recebe bônus.

### 1.6. Carlos (Agregador / dono de rede — `AGREGADOR`)
Empresário, dono da Hangar Academia. A Hangar tem 2 unidades (2 UCs grandes, B3 comercial). Carlos cadastra a Hangar como cooperado AGREGADOR, recebe link de convite, distribui pros 15 professores da rede. Cada professor pode trazer alunos. Ganha bônus em cascata pelas indicações da rede dele.

### 1.7. Pedro Prof (Cooperado dentro de rede — `COOPERADO` indicado por agregador)
Professor da Hangar que se cadastrou via link do Carlos. Ele é cooperado normal (CPF, UC residencial), mas tem indicador (Carlos) e ele mesmo vira indicador pros 10 alunos que vai trazer.

### 1.8. Helena (Síndica de condomínio — papel ainda não tem perfil próprio)
Síndica do condomínio Moradas da Enseada (50 apartamentos + áreas comuns em Guarapari/ES). Quer trazer o condomínio inteiro pra economizar na conta de luz. **Hoje não há tela específica de "síndico" no sistema** — Helena seria criada como cooperada com vínculo a `Condominio`, mas o fluxo de "convidar 50 condôminos" não está pronto.

### 1.9. Roberto (Condômino — `COOPERADO` com `unidadeCondominioId`)
Morador do apartamento 502 do Moradas. Cooperado normal, mas vinculado ao condomínio dela via `UnidadeCondominio`. Vê a economia da própria UC mais a parte rateada das áreas comuns.

### 1.10. Patrícia (Administradora de condomínios — `ADMIN` da entidade `Administradora`)
Empresa que administra vários condomínios. No SISGD vira uma `Administradora` com vários `Condominio` vinculados. Hoje tem 1 administradora cadastrada, fluxo ainda não fechado.

### 1.11. Solange (Conveniado / parceiro institucional — `cooperadoId` em `ContratoConvenio`)
Pessoa física ou jurídica representante de uma associação, sindicato, empresa. Faz convênio com a CoopereBR pra trazer membros (Hangar é caso real disso). Recebe descontos progressivos conforme quantidade de membros ativos. Hoje a estrutura `ContratoConvenio` existe (53 KB de código no módulo `convenios`) mas não há registros (0 convênios no banco em produção).

### 1.12. Walter (Contador — papel ainda não tem perfil próprio)
Contador externo da CoopereBR. Vai precisar acesso a DRE (Demonstração de Resultado do Exercício), conciliação bancária, fechamento de mês, livro caixa. **Nenhum desses existe ainda como tela** — só o `LancamentoCaixa` no banco com 35 registros.

---

## 2. Três histórias completas

### História A — Ana, cooperada solta

Ana viu um post da CoopereBR no Instagram falando que "você economiza 20% na conta de luz sem instalar nada". Curiosa, clicou no link.

Caiu em `/cadastro` [OK]. A página pediu que ela enviasse uma foto/PDF da conta de luz mais recente (EDP-ES, no caso dela). Ela tirou foto pelo celular. O sistema rodou o programa que lê texto dentro da imagem (OCR via Claude AI) [OK] e em ~20 segundos preencheu sozinho: nome, CPF, endereço, número da UC, distribuidora, consumo médio dos últimos 12 meses [OK].

Ela conferiu os dados, ajustou o que precisava, escolheu entre os planos disponíveis (Plano Individual Residencial, 18% de desconto) [OK]. Aceitou o termo de adesão. O sistema gerou uma proposta com cálculo do quanto ela vai pagar por mês [OK]. Ela assinou eletronicamente o termo + procuração [OK].

Marcos (admin da CoopereBR) recebeu uma notificação no painel dele. Aprovou os documentos da Ana [OK]. O sistema mudou o status dela pra `APROVADO` e gerou um contrato vinculando-a a uma usina solar com capacidade disponível [OK]. Marcos cadastrou a UC dela em uma lista que vai ser enviada pra EDP (compensação de créditos GD) [PARCIAL — a tela existe mas não exporta lista pronta pra mandar; é manual hoje].

Passados ~30 dias, a EDP homologou a UC da Ana, começou a injetar créditos. Ana começou a economizar na conta. Marcos mudou o status dela pra `ATIVO_RECEBENDO_CREDITOS` [OK].

No mês seguinte, o sistema gerou a primeira cobrança da Ana automaticamente [OK — hoje só funciona pra modelo FIXO_MENSAL; outros modelos estão bloqueados]. A cobrança foi registrada no Asaas (gateway de pagamento), gerou QR Code PIX e boleto [PARCIAL — Asaas em sandbox, nunca testado em produção real com cooperado pagante de verdade]. Ana recebeu por email e WhatsApp [OK — Sprint 10 entregou os dois canais].

3 dias antes do vencimento, Ana recebeu lembrete D-3 [OK — Sprint 10]. 1 dia antes, lembrete D-1 [OK]. No dia, ela pagou via PIX pelo app do banco. O Asaas avisou o SISGD via webhook que o pagamento entrou [PARCIAL — webhook existe, sandbox funcionou em teste, produção real nunca rodou]. O sistema mudou o status da cobrança pra `PAGO`, gerou o lançamento financeiro [OK em sandbox], notificou Ana com confirmação por email [OK].

Como Ana escolheu o plano sem CooperToken (modo DESCONTO direto), ela não recebeu tokens. Se tivesse escolhido o modo CLUBE (FATURA_CHEIA_TOKEN), receberia 50 tokens equivalentes ao desconto que abriu mão [OK — emissão funciona; mas painel pra ver saldo e usar tokens em ofertas é esqueleto].

Mês 2, mês 3, mês 4 — ciclo se repete automaticamente [OK].

Mês 5, Ana se animou e mandou o link de indicação dela (`/cadastro?ref=ANA`) pra prima Júlia. Júlia se cadastrou. O sistema registrou a Indicação como `PENDENTE` [OK]. Quando Júlia pagou a primeira fatura, o sistema marcou a Indicação como `PRIMEIRA_FATURA_PAGA` e creditou bônus na Ana — 50 tokens ou desconto direto na próxima fatura, dependendo do plano [OK em código; nunca rodou ponta a ponta com cooperada real porque ninguém pagou nada de verdade ainda].

Mês 12 — Ana indicou 3 amigas, todas pagantes. Nível 2 da indicação dela aumentou. Status dela continua `ATIVO_RECEBENDO_CREDITOS`. Marcos vê a Ana na lista de cooperados ativos, com histórico de 12 cobranças pagas sem atraso [OK].

**Contagem honesta:** dos 23 passos, **17 funcionam totalmente** (74%), **5 funcionam pela metade** (22%) — principalmente por causa do Asaas em sandbox e da exportação manual pra EDP — e **1 não existe ainda** (4%) — gestão da lista de compensação enviada à concessionária.

### História B — Carlos, dono da Hangar Academia

Carlos é dono da Academia Hangar, 2 unidades em Vila Velha/ES. Conta de luz das duas combinada passa de R$ 1.200/mês. Amigo dele falou da CoopereBR. Carlos quer 2 coisas: reduzir essa conta e virar fonte de receita extra trazendo professores e alunos da rede dele pra cooperativa.

Marcos (admin da CoopereBR) cadastra Carlos como cooperado tipo `AGREGADOR` [PARCIAL — o enum `AGREGADOR` existe em `PerfilUsuario`, mas o fluxo de cadastro completo de agregador (incluindo configuração da rede MLM dele) não tem tela própria; é feito por queries diretas no banco hoje].

Carlos vincula 2 UCs ao cooperado dele (uma loja 1, outra loja 2) [OK — `/dashboard/ucs/nova` cadastra qualquer UC]. Marcos gera os primeiros contratos pra Hangar, plano FIXO_MENSAL com desconto custom (negociado por ser cliente grande) [OK].

Primeira fatura da Hangar é gerada [OK]. Carlos paga via PIX. Asaas avisa SISGD [PARCIAL — sandbox]. Pagamento confirmado.

Agora a parte de rede. Carlos quer trazer 15 professores. Sistema gera link de convite pra ele: `/cadastro?ref=HANGAR-CARLOS-001` [OK — sistema de convite existe]. Carlos manda o link no grupo do WhatsApp dos professores.

Pedro Prof clica, cai no `/cadastro`, OCR lê fatura dele, ele se cadastra normal. Sistema cria Indicação vinculando Pedro a Carlos (nível 1) [OK]. Pedro vira cooperado ativo nas próximas 4 semanas (passos da história A).

Pedro também recebe link próprio: `/cadastro?ref=PEDRO`. Manda pros 10 alunos da turma dele. Aluno X se cadastra. Sistema cria Indicação Aluno X → Pedro (nível 1) e Aluno X → Carlos (nível 2, via cascata MLM) [OK em código MLM; precisa validação E2E].

Carlos quer ver "quanto a rede dele já gerou". Hoje [PARCIAL]: ele acessa `/agregador` (tela existe), vê membros, mas não tem ainda relatório consolidado de "tokens recebidos cumulativos × valor em reais × quantos cooperados estão ativos × quanto entrou de comissão este mês". Os dados existem, a tela ainda não cruza eles.

A cobrança do parceiro institucional (do Carlos como agregador) acontece via convênio: Carlos pode ter direito a desconto progressivo conforme tamanho da rede dele (faixas de 1-10, 11-50, 51-100 alunos com descontos crescentes) [OK schema, FALTA UI integrada].

**Contagem honesta:** dos 18 passos da história do Carlos, **9 funcionam** (50%), **6 funcionam pela metade** (33%) — sobretudo painel agregador e exportação de relatório de rede — e **3 não existem** (17%) — fluxo de cadastro guiado de novo agregador, configuração visual da estrutura MLM dele, painel consolidado da rede.

### História C — Helena, síndica do Moradas da Enseada

Helena é síndica do Moradas da Enseada, condomínio com 50 apartamentos + áreas comuns (jardim, piscina, hall, elevadores) em Guarapari/ES. Conta de luz das áreas comuns: ~R$ 3.500/mês. Cada apartamento tem conta própria (média R$ 250).

Ela descobre o SISGD por indicação. Marcos cadastra o **condomínio** no sistema [PARCIAL — entidade `Condominio` existe (10 unidades cadastradas como teste), mas não há fluxo guiado "Cadastrar condomínio + 50 condôminos atomicamente"; é feito quase tudo manualmente].

A UC das áreas comuns é vinculada ao Condominio. Helena recebe link de convite pra distribuir entre os condôminos. Primeira parte (condomínio + área comum) flui parecido com a Hangar.

Cada condômino que aderir vira cooperado individual (CPF, UC residencial própria), mas com `unidadeCondominioId` apontando pra unidade dele dentro do condomínio. Isso permite ao SISGD calcular rateio das áreas comuns proporcional à fração ideal de cada apartamento [OK schema, FALTA cálculo automático].

50 condôminos não vão se cadastrar todos no mesmo dia. Sprint 1: 12 aderem. Sprint 2: mais 18. Etc. O sistema vai gerando contratos individuais [OK pra cooperado solto, mas cada condômino tem que repetir o cadastro inteiro (OCR, dados, termo) — sem importação em massa].

Helena precisa de painel consolidado: 50 condôminos divididos em "ativos / pendentes / sem cadastro ainda", soma das contas de luz, soma da economia, status da fatura das áreas comuns [FALTA — tela `/portal/condominio` ou `/sindico` não existe].

Patrícia (administradora) entra na história num cenário maior: ela administra 5 condomínios. Cada condomínio precisa do mesmo painel da Helena, e Patrícia precisa de uma visão "todos os meus condomínios" [FALTA — `Administradora` cadastrada, mas painel da administradora também não existe].

**Contagem honesta:** dos 20 passos da história da Helena, **5 funcionam** (25%), **8 funcionam pela metade** (40%) — sobretudo cadastros manuais e cálculos não automatizados — e **7 não existem** (35%) — painel síndico, painel administradora, importação em massa de condôminos, rateio automático de áreas comuns, calendário consolidado, comparativo "antes vs depois CoopereBR" do condomínio inteiro.

---

## 3. O que cada papel precisa ver (telas)

### 3.1. Luciano (Dono da plataforma)

- Lista de parceiros e plano SaaS de cada [OK — `/dashboard/cooperativas`]
- Faturas SaaS emitidas pra cada parceiro [PARCIAL — `/dashboard/saas/faturas` existe, mas zero faturas geradas (cron de geração não existe); a CoopereBR usa há meses sem ser cobrada]
- Receita do mês (somando todas FaturaSaas pagas) [FALTA]
- Saúde técnica do servidor (cron rodando? OCR funcionando? WhatsApp conectado?) [FALTA]
- Lista de admins de cada parceiro [OK — `/dashboard/usuarios`]
- Modo Observador (entrar como admin de qualquer parceiro pra ver o que ele vê) [OK — `/dashboard/observador`]
- Configurações globais (PlanoSaas, integrações Asaas, etc.) [OK — `/dashboard/saas/planos`]
- Audit trail (quem fez o quê, quando) [PARCIAL — schema `HistoricoStatusCooperado` existe mas tem 0 registros; não está sendo populado de verdade]
- Relatório de inadimplência cross-tenant [FALTA — relatório existe pra cooperados, não pra parceiros]
- Custos de infra (Supabase, Anthropic API, gateway) versus receita SaaS [FALTA]

### 3.2. Marcos (Admin do parceiro CoopereBR)

- Lista de cooperados [OK — `/dashboard/cooperados`]
- Detalhe de cada cooperado [OK — `/dashboard/cooperados/[id]`]
- Cadastrar cooperado novo manualmente [OK — `/dashboard/cooperados/novo` (wizard 7 passos)]
- Faturas EDP que chegaram por email aguardando aprovação [OK — `/dashboard/faturas/central`]
- Cobranças geradas e seus status [OK — `/dashboard/cobrancas`]
- Inadimplentes [OK — `/dashboard/relatorios/inadimplencia`]
- Lista de UCs e quais estão sem `numeroUC` (precisam ir pro portal EDP cadastrar) [PARCIAL — lista existe, falta filtro/badge "pendente numeroUC"]
- Email do parceiro (SMTP+IMAP) [OK — `/dashboard/configuracoes/email`, novo de hoje]
- Configuração Asaas [OK — `/dashboard/configuracoes/asaas`]
- Tarifas da concessionária e bandeiras [OK — `/dashboard/bandeiras` se acessível pelo menu (verificar)]
- Planos cadastrados (modelos de cobrança que oferece aos cooperados) [OK — `/dashboard/planos`, hoje 2 planos ativos]
- Motor de Proposta + Lista de Espera [OK — `/dashboard/motor-proposta`]
- Usinas cadastradas e capacidade alocada/livre [OK — `/dashboard/usinas`]
- Convites enviados (links de indicação que ele criou) [OK — `/dashboard/convites`]
- Relatórios: projeção de receita, inadimplência [OK — `/dashboard/relatorios/*`]
- DRE da CoopereBR [FALTA]
- Conciliação bancária (extrato BB/Sicoob versus lançamentos do sistema) [FALTA]
- Fechamento de mês (bloquear lançamentos retroativos) [FALTA]
- Painel cron jobs (saber se WA/cobrança/IMAP estão rodando hoje) [FALTA]

### 3.3. Ana (Cooperada solta)

- Início (saudação, status do contrato) [OK — `/portal`]
- Minha conta (dados cadastrais, foto facial) [OK — `/portal/conta`]
- Minhas UCs [OK — `/portal/ucs`]
- Faturas da concessionária (que o sistema processou) [OK — `/portal/faturas-concessionaria`]
- Faturas CoopereBR (cobranças do cooperado) [OK — `/portal/financeiro`]
- Histórico de pagamentos [OK]
- Documentos enviados e status [OK — `/portal/documentos`]
- Indicações (quantas amigas trouxe, status de cada, bônus recebido) [OK — `/portal/indicacoes`]
- Saldo CooperToken e ofertas do clube [PARCIAL — `/portal/clube` e `/portal/tokens` existem, mas só esqueleto sem ofertas reais]
- Crédito de energia recebido (kWh injetado pela usina pra ela) [OK — `/portal/creditos`]
- Solicitar desligamento [OK — `/portal/desligamento`]
- Assinar termo / procuração [OK — `/portal/assinar/[token]`]

### 3.4. Carlos (Agregador)

- Dashboard agregador [PARCIAL — `/agregador` existe com placeholder, falta dados reais cruzados]
- Lista dos membros da rede dele [PARCIAL — `/agregador/membros` existe, conteúdo simples]
- Detalhe de cada membro [PARCIAL — `/agregador/membros/[id]`]
- Indicações (árvore MLM) [FALTA — não há visualização em árvore]
- Ganhos do mês (comissões, tokens recebidos, desconto progressivo aplicado) [FALTA]
- Convites que enviou e taxa de conversão [FALTA — convite existe; relatório de funil não]
- Configurar links de indicação personalizados [FALTA]

### 3.5. Helena (Síndica) — todas as telas faltam

- Painel do condomínio (50 apartamentos + áreas comuns numa visão única) [FALTA]
- Lista de condôminos com status (ativo, pendente, não cadastrado) [FALTA]
- Convite em massa pra condôminos [FALTA]
- Faturas do condomínio (área comum + rateio) [FALTA]
- Comparativo "antes vs depois CoopereBR" do condomínio [FALTA]

### 3.6. Patrícia (Administradora) — todas as telas faltam

- Lista dos N condomínios que ela administra [PARCIAL — `/dashboard/administradoras` é esqueleto]
- Painel consolidado de cada condomínio [FALTA]
- Comparativo entre condomínios [FALTA]

### 3.7. Walter (Contador) — todas as telas faltam

- DRE consolidado [FALTA]
- Razão de cada conta do Plano de Contas [PARCIAL — `/dashboard/configuracoes/financeiro` cadastra o plano de contas (24 contas), mas não tem extrato por conta]
- Conciliação bancária [FALTA]
- Fechamento de mês [FALTA]
- Exportação contábil (formato SPED, integração com sistema de contabilidade externo) [FALTA]

---

## 4. Inventário do que existe vs o que falta

Tabela executiva, ordenada por importância pra produção. Status:
- ✅ Funciona — testado, está em uso ou pronto pra entrar
- 🟡 Parcial — existe parcialmente, tem buraco operacional conhecido
- 🔴 Falta — não construído

| Funcionalidade | Quem usa | Status | Observação |
|---|---|---|---|
| Cadastro público de cooperado | Ana | ✅ | V2 ativo desde Sprint 10 |
| Cadastro com link de indicação (`?ref=`) | Ana, Pedro, Carlos | ✅ | Funcional, gera Indicação automática |
| OCR de fatura PDF da concessionária | Ana, Marcos | ✅ | Validado E2E em Sprint 11 Fase D, 5/5 passou |
| Identificação de UC por OCR (4 campos) | Marcos | ✅ | Sprint 11 Bloco 2 — `numero` + `numeroUC` + `numeroConcessionariaOriginal` + `distribuidora` |
| Cadastro admin de cooperado (wizard 7 passos) | Marcos | ✅ | `/dashboard/cooperados/novo` |
| Aprovação de documentos (KYC) | Marcos | ✅ | Status `PENDENTE_DOCUMENTOS` → `APROVADO` |
| Geração de proposta com cálculo financeiro | Marcos | ✅ | Motor de Proposta, modelo FIXO_MENSAL |
| Geração de proposta — modelos COMPENSADOS / DINAMICO | Marcos | 🟡 | Engine incompleta. Variável `BLOQUEIO_MODELOS_NAO_FIXO` impede uso em prod |
| Assinatura digital de termo + procuração | Ana | ✅ | Token único por proposta, link `/portal/assinar/[token]` |
| Criação de Contrato vinculando UC + Usina + Plano | Marcos | ✅ | Validação ANEEL: mesma distribuidora UC × Usina |
| Lista de espera quando usina sem capacidade | Ana | ✅ | 32 cooperados na fila no banco |
| Hook bloqueando ativação se UC sem `numeroUC` | Marcos | ✅ | Sprint 11 Fase D — exceção clara, bypass `ambienteTeste` |
| Cobrança modelo FIXO_MENSAL | Ana, Marcos | ✅ | Cron mensal gera, Asaas registra, email/WA notifica |
| Cobrança modelos COMPENSADOS / DINAMICO | Marcos | 🔴 | Engines não implementadas (bloqueio em vigor) |
| Email lembrete D-3/D-1 antes do vencimento | Ana | ✅ | Sprint 10 |
| Lembrete 24h pra proposta pendente de assinatura | Ana | ✅ | Sprint 10 |
| Cópia da proposta assinada por email | Ana | ✅ | Sprint 10 |
| Webhook Asaas baixa pagamento | Ana, Marcos | 🟡 | Existe e funciona em sandbox; produção real nunca rodou (nenhum cooperado pagou de verdade ainda) |
| Geração de QR Code PIX + boleto | Ana | ✅ | Em sandbox |
| Lembrete WhatsApp de cobrança vencida | Ana | ✅ | Cron diário 6h15 |
| Email + WhatsApp por parceiro (multi-tenant) | Marcos | ✅ | Hoje (26/04). Cada parceiro com SMTP+IMAP próprios |
| Pipeline IMAP buscando faturas EDP | Marcos | ✅ | Diagnóstico de hoje: 13/13 OCR sucesso. Detectou 13 leads potenciais (faturas de pessoas não cadastradas) |
| OCR identifica e popula 3 campos da UC automaticamente | Marcos | ✅ | Sprint 11 Bloco 2 |
| Match automático fatura → cooperado existente | Marcos | 🟡 | Funciona quando UC está cadastrada com formato compatível. Pra leads (UC não cadastrada): identificado como "lead potencial", sem fluxo automático ainda |
| Painel "leads potenciais" (faturas sem cooperado) | Marcos | 🔴 | Diagnóstico capturou; tela ainda não existe |
| Indicações com bônus em cascata (MLM) | Carlos, Pedro | ✅ | Em código; nunca rodou ponta a ponta com pagamento real |
| CooperToken (emissão, saldo, ledger) | Ana, Marcos | 🟡 | Emissão funciona. Painel completo + ofertas resgatáveis: esqueleto |
| Clube de Vantagens (tiers BRONZE/PRATA/OURO/DIAMANTE) | Ana | 🟡 | 1 ProgressaoClube no banco, 0 ofertas, 0 resgates. Esqueleto |
| Convênios (parceiros institucionais) | Solange, Carlos | 🟡 | 53 KB de código no módulo. 0 registros em produção. Lógica completa, sem teste real |
| Cadastro atomizado de Condomínio + condôminos | Helena | 🔴 | Schema existe (Condominio, UnidadeCondominio). Fluxo guiado não |
| Painel síndico de condomínio | Helena | 🔴 | Não existe |
| Painel administradora de condomínios | Patrícia | 🔴 | Esqueleto em `/dashboard/administradoras` |
| Painel agregador (rede MLM) | Carlos | 🟡 | `/agregador` existe; cruzamento de dados real falta |
| FaturaSaas (Luciano cobra parceiros) | Luciano, Marcos | 🔴 | Cron de geração não existe. PlanoSaas cadastrado mas nunca emitiu fatura. CoopereBR usa há meses sem ser cobrada |
| DRE consolidado | Marcos, Walter | 🔴 | LancamentoCaixa registra, mas DRE não calcula |
| Conciliação bancária | Marcos, Walter | 🔴 | Integração BB/Sicoob começada, módulo `integracao-bancaria` existe; conciliação real não roda |
| Fechamento de mês (bloquear lançamentos retroativos) | Marcos, Walter | 🔴 | Não existe |
| Visão cross-tenant pro Luciano | Luciano | 🟡 | Vê parceiros via `/dashboard/cooperativas`, mas sem dashboard consolidado |
| Painel saúde técnica (cron, OCR, WA, fila) | Luciano | 🔴 | Não existe |
| Audit trail completo (quem fez o quê) | Luciano | 🟡 | `HistoricoStatusCooperado` tem 0 registros — schema existe, populamento não roda |
| Notificações in-app (sino com novidades) | Marcos, Ana | ✅ | 37 notificações no banco |
| Backup do banco | Luciano | 🟡 | Supabase faz snapshot diário automático; restore manual nunca testado |
| Modo Observador (Luciano vê painel de outro admin) | Luciano | ✅ | `/dashboard/observador` |
| Whitelist de envios em dev (não dispara WA/email pra teste) | Luciano | ✅ | Sprint 10 |
| Mascaramento LGPD em desenvolvimento | Luciano | ✅ | Sprint 10 — 112 registros mascarados |
| Reset de senha por email | Ana, Marcos | ✅ | `/esqueci-senha` |
| Login facial (foto FaceMatch) | Ana | 🟡 | Schema existe (`fotoFacialUrl`), upload funciona, validação contra documento não está rodando |
| Tradução pra outras concessionárias (CEMIG, Enel, Light, Celesc) | Marcos | 🟡 | Enum `DistribuidoraEnum` aceita. OCR adaptado por distribuidora ainda só validado em EDP |
| Sungrow (monitoramento de usina em tempo real) | Marcos | 🟡 | Módulo existe, intencionalmente desligado desde Sprint 6 (sem credenciais reais) |
| PIX Excedente (transferência automática do que sobra ao parceiro) | Marcos | 🟡 | Código pronto, variável `ASAAS_PIX_EXCEDENTE_ATIVO` desligada em produção |
| Bandeiras tarifárias atualizadas via ANEEL | Marcos | ✅ | Sincronização ativa |
| Contas a Pagar (despesas do parceiro) | Marcos, Walter | 🟡 | Módulo `contas-pagar` existe com CRUD funcional, 0 registros no banco. Ninguém usou ainda. Tela `/dashboard/financeiro/contas-pagar` mostra lista vazia |
| Contas a Receber (separado de cobrança de cooperado) | Marcos, Walter | 🔴 | Não existe módulo dedicado. Lançamentos do tipo RECEITA estão misturados em `LancamentoCaixa`. Falta visão "o que vai entrar nos próximos 30 dias" separada do ciclo Cobrança→Asaas |
| Lista de compensação EDP (envio mensal B2B) | Marcos | 🔴 | EDP exige lista mensal com `numeroUC` legado das UCs ativas pra processar compensação de créditos. Hoje exportação manual via SQL. Sem cron, sem botão na UI, sem formato fixo |
| Lista de homologação EDP (UCs aguardando aprovação) | Marcos | 🔴 | UCs novas com status `AGUARDANDO_CONCESSIONARIA` precisam ser acompanhadas. Hoje rastreio é manual: Marcos lembra ou esquece. Sem painel, sem alerta de "UC parada há > 45 dias sem feedback EDP" |

---

## 4.1. Mapa do sistema de fidelidade

O SISGD tem **4 conceitos diferentes** vinculados a fidelidade/recompensa que costumam se confundir. Aqui a separação prática.

### CooperToken — moeda interna do cooperado

**Quem usa:** Ana (cooperada).

**Como funciona:** Ana acumula tokens por ações específicas. Hoje tem 2 fontes:

1. **Bônus de indicação:** Ana indica Júlia. Júlia paga primeira fatura. Ana ganha 50 tokens (valor configurável). Sistema usa em produção: 6 ledger entries no banco, 3 saldos.
2. **Modo CLUBE no plano (FATURA_CHEIA_TOKEN):** Ana pode escolher pagar a fatura cheia (sem desconto) e receber a diferença em tokens. Ex: fatura R$ 250, plano dá 18% desconto. Em modo DESCONTO, Ana paga R$ 205. Em modo CLUBE, paga R$ 250 e recebe ~R$ 45 em tokens. Esses tokens valem em ofertas resgatáveis no clube.

**Status:** ✅ emissão funcionando. 🟡 painel pra Ana ver o saldo e usar em coisa real está esqueleto (sem ofertas resgatáveis cadastradas).

### CooperToken Parceiro — moeda do parceiro pra distribuir

**Quem usa:** Marcos (admin do parceiro), Carlos (agregador).

**Como funciona:** parceiro **compra** lotes de tokens do dono da plataforma (Luciano) e **distribui** estrategicamente: campanhas, brindes, fidelização. Diferente do CooperToken normal (que é emitido automaticamente pelo sistema), aqui o parceiro decide quando dar.

**Status:** 🟡 schema existe (`CooperTokenSaldoParceiro`, `CooperTokenCompra`), 0 registros, fluxo nunca rodou.

### Clube de Vantagens — catálogo de ofertas resgatáveis

**Quem usa:** Ana (resgata), Marcos (cadastra ofertas).

**Como funciona:** Ana usa CooperTokens pra resgatar ofertas reais (descontos em parceiros do clube, vouchers, brindes). Tem tiers: BRONZE → PRATA → OURO → DIAMANTE conforme tempo de cooperado e adimplência. Tier maior dá acesso a ofertas melhores.

**Status:** 🟡 1 ProgressaoClube no banco (registro de teste), 0 ofertas cadastradas, 0 resgates feitos. Tela `/portal/clube` é esqueleto. Painel admin `/dashboard/clube-vantagens` também.

### Convênio — desconto progressivo institucional

**Quem usa:** Solange (representante de associação), Carlos (Hangar como agregador-conveniada), Helena (Moradas como condomínio-conveniado).

**Como funciona:** **não tem nada a ver com tokens.** É outro mecanismo. Uma instituição (associação, sindicato, empresa, condomínio) faz convênio com a CoopereBR. Conforme aumenta o número de membros ativos vindos dessa instituição, o desconto aplicado a cada membro vai subindo (faixas progressivas: 1-10 membros = 3%, 11-50 = 5%, 51+ = 8%).

**Exemplo:** Hangar Academia tem convênio. Trouxe 8 professores → todos pagam com 3% extra de desconto. Quando trouxer o 11º (algum aluno), todos passam pra 5%. É incentivo coletivo: convém à Hangar trazer mais gente porque o desconto sobe pra todos.

**Status:** 🟡 53 KB de código no módulo `convenios`. 0 contratos de convênio em produção. Lógica completa, sem teste real.

### Como os 4 se conectam

- **CooperToken (Ana)** ↔ **Clube de Vantagens (catálogo)**: Ana resgata oferta usando token. Conexão direta.
- **CooperToken Parceiro (Marcos compra)** → **CooperToken (Ana recebe)**: parceiro usa lote comprado pra dar de presente.
- **Convênio (Hangar)** ↔ **Cooperado (cada professor/aluno)**: convênio aplica desconto extra na cobrança do cooperado. Não envolve tokens.
- **CooperToken** e **Convênio** são **canais paralelos** de fidelização — não dependem um do outro.

### Sumário pra ler de uma vez

| Conceito | Quem | Pra que serve | Status |
|---|---|---|---|
| CooperToken | Ana | Moeda da Ana, ganha por indicação ou modo CLUBE | ✅ emite, 🟡 não tem onde gastar (Clube esqueleto) |
| CooperToken Parceiro | Marcos / Carlos | Lote comprado pra distribuir como brinde/campanha | 🟡 nunca usado |
| Clube de Vantagens | Ana resgata | Catálogo de ofertas pra usar tokens | 🟡 0 ofertas cadastradas |
| Convênio | Solange / Carlos / Helena | Desconto progressivo conforme tamanho da rede institucional | 🟡 código pronto, 0 convênios reais |

---

## 4.2. Operação com a concessionária (EDP)

Dois processos críticos com a EDP que hoje são feitos **manualmente** ou **não existem**. Sem isso, o sistema não pode operar com volume.

### Cadastro do email da cooperativa no portal EDP (passo do cooperado)

**O que é:** quando uma pessoa quer ser cooperada, ela precisa entrar no portal da EDP (`agenciavirtual.edp.com.br`) e cadastrar `contato@cooperebr.com.br` (ou o email do parceiro) como destinatário de **2ª via** das faturas dela. Sem esse passo, a EDP não envia fatura nenhuma pra cooperativa, e o pipeline IMAP/OCR não tem o que processar.

**Hoje:** o sistema não orienta o cooperado a fazer isso. Marcos esquece de avisar. Resultado: cooperado cadastrado, ativo no SISGD, mas EDP não envia fatura porque ele nunca cadastrou o email. Cooperado fica em limbo: "ativo" no sistema, sem dado real circulando.

**Status:** 🔴 não existe.

**Solução prevista:** após cadastro, mostrar tutorial obrigatório com print do portal EDP e checkbox "já fiz". Cron alerta admin se UC ativada há mais de N dias sem fatura recebida.

### Lista de compensação (envio mensal B2B pra EDP)

**O que é:** todo mês a CoopereBR precisa mandar pra EDP uma lista das UCs ativas que devem receber créditos de compensação, no formato exigido pela concessionária (CSV ou planilha com `numeroUC` legado de 9 dígitos, kWh contratado, dataInício do contrato, etc.). EDP processa essa lista e aplica os créditos.

**Hoje:** Marcos exporta manualmente via SQL ou copia-cola. Não há cron, não há botão "exportar lista do mês" na UI, formato não está fixado em código.

**Status:** 🔴 não existe módulo dedicado.

**Solução prevista:** módulo `/dashboard/exportacao-edp` com botão "Gerar lista do mês N", validação ("X UCs sem `numeroUC` preenchido — não podem ser enviadas"), histórico das listas geradas, comparativo "novas neste mês × removidas".

### Lista de homologação (UCs aguardando aprovação EDP)

**O que é:** quando cooperado novo entra, a UC dele precisa ser homologada pela EDP (~30-45 dias). Durante esse período, status = `AGUARDANDO_CONCESSIONARIA`. Marcos precisa acompanhar pra detectar UCs paradas (EDP esqueceu, perdeu protocolo, recusou sem avisar).

**Hoje:** rastreio mental de Marcos, sem painel.

**Status:** 🔴 não existe.

**Solução prevista:** `/dashboard/relatorios/homologacao` com lista de UCs em `AGUARDANDO_CONCESSIONARIA`, ordenada por dias parados. Alerta visual em vermelho se > 45 dias.

### Sumário

| Subprocesso | Quem opera | Status |
|---|---|---|
| Tutorial cadastro email EDP pelo cooperado | Ana, Marcos | 🔴 não existe |
| Alerta "UC ativa há > 15 dias sem fatura recebida" | Marcos | 🔴 não existe |
| Lista de compensação (export mensal) | Marcos | 🔴 não existe |
| Lista de homologação (UCs em espera) | Marcos | 🔴 não existe |

---

## 5. Painéis necessários (por papel)

Listagem do que cada papel **deveria ter de painel consolidado** pra fazer o trabalho dele.

### 5.1. Painel do Luciano (Dono) — **NÃO EXISTE**

Uma página única com:
- **Saúde técnica:** cron jobs rodando hoje (ok/falhou)? OCR Claude API funcionando? WhatsApp conectado? Asaas respondendo?
- **Volumes do dia:** parceiros ativos, cooperados ativos, faturas processadas, pagamentos recebidos
- **Saúde financeira:** receita SaaS do mês (FaturaSaas pagas), receita esperada (FaturaSaas a vencer), inadimplência SaaS
- **Custo infra:** Supabase, Anthropic API, gateways — meta, gasto atual, projeção
- **Alertas:** cron falhou, OCR com taxa de erro alta, parceiro inadimplente há > 30 dias

Hoje Luciano precisa abrir 5+ telas separadas pra montar isso na cabeça. Não tem dashboard único. **Status: 🔴 Falta inteiro.**

### 5.2. Painel do Marcos (Admin parceiro) — **PARCIAL**

`/dashboard` (página inicial) já existe, mas não consolida o que o Marcos precisa pra agir no dia a dia:

- **Aguardando ação dele HOJE:**
  - Faturas EDP no email aguardando aprovação
  - Cooperados aguardando ativação (status `PENDENTE_DOCUMENTOS` ou `AGUARDANDO_CONCESSIONARIA`)
  - Inadimplentes vencidos há > N dias (limiar configurável)
  - Propostas com lembrete 24h disparado mas não assinadas
  - UCs com `numeroUC` faltando
- **Volumes do parceiro:**
  - Total cooperados ativos / total esperado pelo PlanoSaas
  - Cobranças do mês geradas / pagas / pendentes
  - Faturas EDP processadas no mês
- **Comunicação:**
  - WhatsApps enviados / lidos hoje
  - Conversas em aberto

Hoje a página tem widgets básicos mas falta esses 5 alertas-de-ação. Status: 🟡 Existe estrutura, falta conteúdo acionável.

### 5.3. Painel da Ana (Cooperada) — **OK**

`/portal` está bem servido. 12 itens de menu (`início`, `conta`, `UCs`, `faturas-concessionaria`, `financeiro`, `documentos`, `indicações`, `clube`, `tokens`, `créditos`, `desligamento`, `assinar`). Limitações conhecidas: clube e tokens são esqueleto sem ofertas resgatáveis.

### 5.4. Painel do Carlos (Agregador) — **PARCIAL**

`/agregador` existe com `membros` e página inicial, mas falta:
- Árvore MLM da rede dele (visualização gráfica)
- Funil de conversão dos convites enviados
- Comissões cumulativas e do mês corrente
- Comparativo com outros agregadores (ranking opcional)
- Botão "convidar em massa" (enviar links pra N contatos de uma vez)

Status: 🟡 Esqueleto presente, conteúdo cruzado faltando.

### 5.5. Painel da Helena (Síndica) e Patrícia (Administradora) — **NÃO EXISTEM**

Ambos no mesmo grupo: visualização agregada de N UCs (condomínio inteiro). Helena: 1 condomínio. Patrícia: vários condomínios.

- **Helena:**
  - Mapa do condomínio (50 aptos com status de cada)
  - Faturas do mês (área comum + cada apto)
  - Economia total do condomínio
  - Convidar condôminos em massa
  - Status do contrato com a CoopereBR

- **Patrícia:**
  - Lista dos condomínios administrados
  - Cada condomínio com mini-painel resumo
  - Comparativo entre condomínios (qual tem mais adesão, qual está atrasado)

Status: 🔴 Falta inteiro.

### 5.6. Painel do Walter (Contador) — **NÃO EXISTE**

- DRE consolidado (receita - despesa = resultado)
- Extrato por conta do plano de contas
- Conciliação bancária visual (extrato BB × lançamentos)
- Fechamento de mês com botão "bloquear lançamentos retroativos"
- Exportação contábil (SPED ou planilha)

Status: 🔴 Falta inteiro.

---

## 6. Ordem sugerida de construção

Priorização por **dependência** (o que destrava o quê) e **impacto** (quem ganha o quê), não por preferência técnica.

### 1. Webhook Asaas em produção real (1-2 dias)
**Por quê primeiro:** sem isso, o ciclo "cobrar → pagar → confirmar" não fecha. Ana paga e o sistema não sabe. Marcos aprova fatura mas a cobrança fica eternamente pendente. Tudo o que vem depois depende disso funcionar.
**Quem desbloqueia:** Ana, Marcos, Luciano.

### 2. Painel do Luciano (governança) (3-4 dias)
**Por quê:** quem cuida do sistema precisa enxergar o sistema. Hoje Luciano não sabe se algum cron falhou. Sem essa visibilidade, qualquer outra construção fica cega.
**Quem desbloqueia:** Luciano (e indiretamente todos, porque problemas vão ser detectados antes).

### 3. Cron de geração de FaturaSaas (1-2 dias)
**Por quê:** a empresa do Luciano tem R$ 0 de receita formal. CoopereBR usa há meses, nunca foi cobrada. Sem isso, a plataforma não tem modelo de negócio fechado.
**Quem desbloqueia:** Luciano principalmente; Marcos (recebe a fatura e paga).

### 4. Cadastro atomizado de Condomínio + condôminos (2-3 dias)
**Por quê:** destrava história Helena. Hoje cada condômino se cadastra individualmente; pra ter Moradas (50 aptos) é inviável. Estrutura no banco existe; o fluxo guiado e a importação em massa, não.
**Quem desbloqueia:** Helena, Patrícia, Roberto.

### 5. Painel agregador (rede MLM) (3-4 dias)
**Por quê:** destrava história Carlos. A Hangar é cliente real, está no banco, mas Carlos hoje não consegue ver de onde vem o ganho dele.
**Quem desbloqueia:** Carlos, Pedro Prof.

### 6. Engine de cobrança COMPENSADOS (4-6 dias)
**Por quê:** desbloqueia modelos de cobrança não-FIXO. Hoje todos os cooperados estão no plano FIXO_MENSAL porque os outros estão bloqueados. Limita a oferta comercial.
**Quem desbloqueia:** Marcos (oferta), Ana (mais opções de plano).

### 7. Engine de cobrança DINAMICO (3-5 dias)
**Por quê:** complementa COMPENSADOS, oferece terceiro modelo (kWh sobe/desce conforme geração da usina).
**Quem desbloqueia:** Marcos, Ana.

### 8. DRE consolidado (3-4 dias)
**Por quê:** sem DRE, Marcos e Walter não fecham mês. Lançamentos já entram (35 no banco), mas não há cálculo de "quanto ganhei × gastei × resultou".
**Quem desbloqueia:** Marcos, Walter.

### 9. Conciliação bancária (4-6 dias)
**Por quê:** depende de DRE pra ser útil. Casa lançamento manual com extrato bancário do BB/Sicoob.
**Quem desbloqueia:** Walter principalmente.

### 10. Painel síndico + administradora (3-4 dias)
**Por quê:** depende de cadastro atomizado de condomínio (item 4). Visualização agregada do condomínio.
**Quem desbloqueia:** Helena, Patrícia.

### 11. Audit trail completo (2-3 dias)
**Por quê:** preencher de verdade `HistoricoStatusCooperado` (hoje 0 registros). Necessário pra resolver disputas e pra LGPD.
**Quem desbloqueia:** Luciano, Marcos.

### 12. Templates de email/WA por parceiro (2-3 dias)
**Por quê:** hoje todo email diz "CoopereBR" hardcoded. Quando entrar 2º parceiro, vai ser estranho. Já está documentado como TODO da arquitetura multi-parceiro.
**Quem desbloqueia:** próximos parceiros.

### 13. Quotas de envio + fallback de gateway (2-3 dias)
**Por quê:** Gmail SMTP tem 500 emails/dia. Asaas pode cair. Resilência.
**Quem desbloqueia:** todos (operação saudável).

### 14. Login facial real (FaceMatch contra documento) (2-3 dias)
**Por quê:** schema existe, validação não roda. KYC mais seguro.
**Quem desbloqueia:** Marcos (segurança no cadastro), Luciano (compliance).

### 15. Painel "leads potenciais" (faturas sem cooperado cadastrado) (1-2 dias)
**Por quê:** o diagnóstico de hoje detectou 13 leads em 1 semana. São pessoas que cadastraram o email da CoopereBR no portal EDP mas nunca se cadastraram no SISGD. Oportunidade comercial.
**Quem desbloqueia:** Marcos.

**Ordem é sugestão, não ordem fixa.** Prioridade real depende do que mais dói operacionalmente. O **item 1 (webhook Asaas em produção)** e o **item 3 (cron FaturaSaas)** estão primeiros porque sem eles a plataforma não tem modelo de negócio fechado — são pré-requisitos pra cobrar dinheiro de verdade.

---

## 7. Glossário

Tradução de termos técnicos pra termos humanos.

**API** — Interface de Programação. Forma de um sistema falar com outro. Quando dizemos "API da EDP" ou "API do Asaas", é o canal técnico de comunicação.

**Asaas** — Empresa brasileira que processa pagamentos (PIX, boleto). É o gateway de pagamento que o SISGD usa.

**Audit trail** — Registro histórico de quem fez o quê, quando. Importante pra resolver disputas e pra LGPD.

**Backend** — Parte do sistema que roda no servidor (não vê na tela). Cuida de banco de dados, regras de negócio, integrações.

**Cron job** — Programa que roda sozinho em horário marcado (exemplo: todo dia às 6h da manhã, varre o email buscando faturas novas).

**Cuid** — Identificador único de cada registro do banco (sequência de letras/números). Substitui o tradicional "id 1, 2, 3" porque não dá pra adivinhar.

**DRE (Demonstração de Resultado do Exercício)** — Relatório contábil que mostra "ganhei X, gastei Y, sobrou Z" num período (mês, ano).

**E2E (end-to-end)** — Teste do começo ao fim, simulando uso real. Diferente de teste unitário (testa só uma peça pequena).

**ECONNRESET** — Erro de rede quando o servidor do outro lado fecha a conexão sem avisar. Comum quando se baixa muita coisa de uma vez do Gmail.

**Endpoint** — Endereço técnico que recebe pedido (exemplo: `/cobrancas` recebe pedido de listar cobranças).

**Engine** — Motor (a tradução literal). No sistema, "engine de cobrança" = lógica que calcula quanto o cooperado paga.

**Enum** — Lista fechada de valores possíveis. Exemplo: `StatusContrato` só aceita `ATIVO`, `SUSPENSO`, `ENCERRADO`. Não dá pra inventar um valor novo sem mudar o código.

**Fallback** — Plano B quando o A falha. Exemplo: "se a config do parceiro estiver vazia, usa a config global".

**FK (Foreign Key — Chave Estrangeira)** — Apontador de uma tabela pra outra. Exemplo: a tabela `Contrato` tem uma coluna `cooperadoId` que aponta pra `Cooperado`.

**Frontend** — Parte do sistema que aparece no navegador. As telas que Marcos e Ana veem.

**GD (Geração Distribuída)** — Modelo de energia solar regulamentado pela ANEEL. Em vez de cada um ter painel solar no telhado, a cooperativa tem uma usina e os cooperados recebem créditos de kWh injetados na rede.

**Hash** — Maneira de transformar uma senha em algo embaralhado e irreversível. Mesmo se alguém vê o banco, não consegue ler a senha.

**HMAC** — Forma de garantir que uma mensagem (exemplo: webhook do Asaas) realmente veio de quem diz. Usa uma chave secreta compartilhada.

**HTTP 200 / 401 / 404 / 500** — Códigos de resposta do servidor. 200 = ok. 401 = não autorizado (login). 404 = não achou. 500 = bug no servidor.

**httpOnly cookie** — Pedacinho de informação guardado pelo navegador, mas que JavaScript não consegue ler. Protege contra roubo de senha.

**IMAP** — Protocolo de leitura de email. O SISGD usa IMAP pra entrar na caixa do `contato@cooperebr.com.br` e baixar as faturas EDP.

**JWT (JSON Web Token)** — Cartão digital de identidade. Quando Marcos faz login, recebe um JWT. A cada requisição ele apresenta o JWT pra provar quem é.

**KYC (Know Your Customer)** — Conheça seu cliente. Processo de validar identidade (RG, CPF, comprovante de residência) antes de ativar.

**LGPD** — Lei Geral de Proteção de Dados. Regra que diz como podemos coletar, guardar e usar dados pessoais de gente.

**MLM (Multi-Level Marketing)** — Marketing multinível. Cada cooperado pode indicar amigos, e os amigos podem indicar outros, formando uma rede em árvore. Quem está acima ganha bônus quando alguém abaixo paga.

**Multi-tenant** — Vários parceiros (tenants) usando o mesmo sistema, cada um vendo só os próprios dados. Marcos da CoopereBR não vê dados da CoopereVerde.

**OCR (Optical Character Recognition)** — Programa que lê texto dentro de imagem ou PDF. O SISGD usa OCR pra ler dados da fatura PDF da EDP automaticamente.

**ORM** — Camada de software que traduz "banco de dados" pra "código". O SISGD usa Prisma como ORM.

**PIX** — Pagamento instantâneo brasileiro do Banco Central.

**PM2** — Programa que mantém o servidor rodando 24/7. Se o backend cair, PM2 levanta automaticamente.

**Postgres / PostgreSQL** — Tipo de banco de dados que o SISGD usa. Hospedado no Supabase.

**Prisma** — Software que liga o backend ao banco PostgreSQL.

**Read-only** — Só leitura. Script `read-only` não muda nada, só observa.

**SaaS (Software as a Service)** — Software como serviço. Você paga mensalidade pra usar o software online, em vez de comprar e instalar. CoopereBR é cliente SaaS do SISGD.

**Schema** — Estrutura do banco de dados. Quais tabelas existem, quais campos cada tabela tem, como elas se conectam.

**SDK** — Kit de ferramentas pra um programa falar com outro (exemplo: Anthropic SDK pra falar com Claude AI).

**SMTP** — Protocolo de envio de email. O SISGD usa SMTP pra mandar email.

**Spec / Test** — Arquivo que verifica automaticamente se o código está funcionando. Roda toda vez antes de subir mudança nova.

**Sprint** — Ciclo de trabalho. SISGD usa sprints com nome próprio (Sprint 10, 11, etc.) cobrindo entregas relacionadas.

**Stack** — Pilha de tecnologias que compõem o sistema. SISGD: NestJS (backend), Next.js (frontend), PostgreSQL (banco).

**Supabase** — Empresa que oferece banco PostgreSQL hospedado + autenticação. SISGD usa pra hospedar o banco e gerir login.

**TS (TypeScript)** — Linguagem de programação que o SISGD usa. Versão melhorada do JavaScript com tipos.

**UC (Unidade Consumidora)** — Endereço com medidor de luz. Cada residência ou comércio tem uma UC com a EDP. Identificada por número.

**Webhook** — Sistema externo (exemplo: Asaas) avisa o nosso sistema que aconteceu algo (exemplo: "fulano pagou"). Em vez do nosso sistema ficar perguntando toda hora.

**Whitelist** — Lista de permitidos. Em desenvolvimento, só envia email/WhatsApp pra quem está na whitelist (Luciano), pra não disparar mensagens reais por engano.

---

**Fim do documento.** Este é mapa, não fotografia: vai mudar conforme o sistema evolui. Atualizar a cada sprint.
