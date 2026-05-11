# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

# Instruções permanentes — Claude Code no CoopereBR

## Ritual de abertura e fechamento de sessão

**Inegociável** — toda sessão Code (Claude Code CLI) **abre** apresentando
"Onde paramos + Pendências" e **fecha** atualizando o mesmo registro vivo.

Formato fixo em `~/.claude/projects/C--Users-Luciano-cooperebr/memory/ritual_abertura_fechamento.md`.

Estado vivo fica em `docs/CONTROLE-EXECUCAO.md` (seção **"ONDE PARAMOS"**).

Aplica:
- Toda sessão Code, mesmo se for "continuação" ou "mesmo dia"
- claude.ai web por reflexo (Luciano cola `CONTROLE-EXECUCAO.md` ao abrir)

**Origem:** Luciano em 2026-05-02. Necessidade de não perder contexto entre
sessões e ter pendências sempre visíveis.

## Disciplina de validação prévia (Decisões 14, 15, 20)

**Regra inegociável** — em três granularidades cumulativas:

**Antes de cada resposta** (Decisão 20, 02/05/2026): verificar docs + código +
sessões anteriores sobre o tema. NÃO responder "de cabeça".

**Antes de propor sprint** (Decisão 20): verificar pilha existente
(`PLANO-ATE-PRODUCAO.md`) + sub-sprints (Decisão 18) + débitos
(`debitos-tecnicos.md`) + sugestões (`sugestoes_pendentes.md`). Se conflito:
**reportar + perguntar** antes de propor.

**Antes de retomar sessão** (Decisão 15, 01/05/2026): ler `CONTROLE-EXECUCAO.md` +
cruzar `git log -20` + verificar memória persistente.

**Antes de trabalho novo** (Decisão 14, 30/04/2026): cruzar `docs/` + código +
schema + git antes de propor solução.

Detalhes em `~/.claude/projects/C--Users-Luciano-cooperebr/memory/regra_validacao_previa_e_retomada.md`.

Aplica-se a Code, claude.ai e qualquer agente futuro.

**Por quê:** sessões que pulam essa etapa produzem retrabalho, conflitos de numeração,
órfãos esquecidos, divergência entre documentação/código/banco/operação. A coerência
sistêmica depende dessa disciplina.

**Violações documentadas:**
- **30/04 noite:** claude.ai propôs nova numeração de sprints sem validar com a antiga
  → 5 colisões + 6 órfãos (commit `1be9b34`).
- **02/05 (manhã+tarde):** múltiplas violações dentro da mesma sessão (specs CooperToken
  omitidos, Planos comerciais omitidos, respostas "de cabeça"). Decisão 20 nasceu daqui.

**Origem:** sessões claude.ai 30/04 (Decisão 14), 01/05 (Decisão 15), 02/05 (Decisão 20).

## Antes de qualquer tarefa, SEMPRE ler primeiro (nesta ordem)

1. `docs/COOPEREBR-ALINHAMENTO.md` — estado consolidado do projeto
2. `docs/MAPA-INTEGRIDADE-SISTEMA.md` — diagnóstico ponta a ponta dos 10 fluxos
3. `docs/sessoes/` — sessões recentes (os 3 arquivos mais novos)
4. `git log -5 --oneline` — últimos commits

## Mapa de Integridade (documento vivo)

`docs/MAPA-INTEGRIDADE-SISTEMA.md` é atualizado ao final de cada sprint.
Após fechar sprint, atualizar a matriz executiva (% pronto, gaps resolvidos).
Não criar versão nova com data — sobrescrever o mesmo arquivo.
Se precisar do histórico, git log mostra as versões anteriores.

Esses 3 em ordem garantem contexto completo em 5 minutos.

## Sobre o projeto em 5 linhas

**SISGD** é a plataforma SaaS multi-tenant de Geração Distribuída.
Dono: Luciano (não programa).
Parceiros (cooperativas/consórcios/associações/condomínios) pagam Luciano pelo uso do sistema via FaturaSaas.
Membros dos parceiros pagam seus parceiros (não pagam Luciano).
**CoopereBR é UM parceiro entre vários possíveis, NÃO o dono do sistema.**

Detalhes em `docs/COOPEREBR-ALINHAMENTO.md` e `docs/PRODUTO.md` (visão humana atual).
Histórico: `docs/historico/SISGD-VISAO-COMPLETA-2026-04-26.md`.

## Arquitetura em alto nível

Monorepo de 3 serviços + Postgres compartilhado. Cada serviço tem seu próprio
`package.json`; nenhuma ferramenta de workspaces — comandos rodam dentro do
diretório do serviço.

```
backend/           NestJS 11 — API REST → http://localhost:3000  (PM2: cooperebr-backend)
web/               Next.js 16 (App Router, React 19) → http://localhost:3001
whatsapp-service/  Bot Node ESM (index.mjs) → http://localhost:3002  (PM2: cooperebr-whatsapp)
tests/             Playwright E2E (raiz) — depende dos 3 serviços de pé
docs/              Documentação viva (PRODUTO, MAPA-INTEGRIDADE, PLANO, sessões)
scripts/           Utilitários standalone (ts-node direto, fora do build NestJS)
legado/            Sistema antigo — referência, não tocar sem pedido explícito
```

**Banco:** PostgreSQL via Prisma ORM. Schema único em
`backend/prisma/schema.prisma` (~2200 linhas, 70+ models). `DATABASE_URL` +
`DIRECT_URL` (Supabase pgbouncer).

**Multi-tenant por tenant column.** Tabela `Cooperativa` é a tenant root;
**toda** query Prisma filtra por `cooperativaId` (vindo do JWT, nunca do body).
Perfil `SUPER_ADMIN` é o único que vê cross-tenant — usar com cuidado.

**Backend (`backend/src/`)** é um único `app.module.ts` que importa ~50 módulos
de domínio. Padrão NestJS clássico (`<dominio>.module.ts` +
`.controller.ts` + `.service.ts` + `dto/`). Auth global via `JwtAuthGuard` +
`RolesGuard` + `ModuloGuard` registrados como `APP_GUARD`. Throttler global
100 req/min. `PrismaService` é singleton injetado.

**Cluster de domínios** (referência rápida pra navegar):
- **Núcleo do negócio:** `cooperados`, `contratos`, `ucs`, `usinas`,
  `cobrancas`, `faturas`, `motor-proposta`
- **Financeiro:** `financeiro`, `configuracao-cobranca`, `geracao-mensal`,
  `contas-pagar`, `asaas`, `gateway-pagamento`, `integracao-bancaria`,
  `bandeira-tarifaria`, `modelos-cobranca`
- **Comunicação:** `whatsapp`, `notificacoes`, `email`, `email-monitor`,
  `modelos-mensagem`
- **Comercial:** `convenios`, `cooper-token`, `clube-vantagens`, `indicacoes`,
  `convite-indicacao`, `lead-expansao`, `conversao-credito`
- **Plataforma/SaaS:** `cooperativas`, `auth`, `saas`, `planos`,
  `config-tenant`, `publico`, `observador`, `relatorios`, `documentos`,
  `fluxo-etapas`, `prestadores`, `administradoras`, `condominios`,
  `monitoramento-usinas`, `migracoes-usina`, `ocorrencias`

**Entidade central — Contrato:**
```
Cooperado ←→ Contrato ←→ UC          Contrato define: kwhContratoAnual,
                ↕                    percentualUsina, desconto (modelo Plano)
              Usina
                ↕
            Cobrança (mensal)
```

**Frontend (`web/`):** Next.js App Router. Rotas por persona:
`app/dashboard/` (admin parceiro), `app/portal/` (cooperado),
`app/parceiro/` + `app/proprietario/` + `app/observador/` (outros perfis),
`app/cadastro/` + `app/convite/` + `app/aprovar-proposta/` (público).
Componentes: Shadcn/UI + Tailwind 4 + Radix (`@base-ui/react`). Hooks
multi-tenant em `web/hooks/` — sempre usar `useTipoParceiro()` antes de
renderizar termo de "membro" (ver "Vocabulário multi-tipo" abaixo).

**WhatsApp service:** processo separado pra isolar a sessão Baileys. Bot
conversacional + CoopereAI; estados de conversa **persistidos no banco**,
nunca em memória. Identifica tenant pelo telefone do cooperado.

**OCR de faturas:** Anthropic Claude SDK (`@anthropic-ai/sdk` no backend)
chamado dentro de `faturas/` e `email-monitor/`. Pipeline IMAP → detecção
automática → OCR → vinculação UC.

**Pagamentos:** Asaas (PIX + boleto) atrás do adapter
`gateway-pagamento/`. **Nunca chamar `AsaasService` direto de fora do módulo
`asaas/`** — usar `GatewayPagamentoService`. Exceção documentada:
`pix-excedente.service.ts`. Webhook Asaas usa HMAC-SHA256.
Flag `ASAAS_PIX_EXCEDENTE_ATIVO` — **não ativar em prod sem instrução
explícita de Luciano.**

**Regras de domínio detalhadas:** `.claude/rules/` (multi-tenant, financeiro,
código, arquitetura). Spec dos módulos comerciais grandes:
`docs/especificacao-clube-cooper-token.md`, `-contabilidade-clube.md`,
`-modelos-cobranca.md`. Regulatório ANEEL: `docs/REGULATORIO-ANEEL.md`.

## Comandos comuns (build, lint, testes, dev)

Os 3 serviços têm scripts npm próprios. Sempre `cd` no serviço antes.
PowerShell: encadear com `;` (não `&&`). Os fluxos de PM2/rebuild estão
detalhados mais abaixo em "Infraestrutura local".

### Backend (`backend/`)

| Ação | Comando |
|---|---|
| Build (regenera `dist/`) | `npm run build` |
| Lint + autofix | `npm run lint` |
| Format Prettier | `npm run format` |
| Dev local (**evitar — usar PM2**) | `npm run start:dev` |
| Produção (PM2 roda isto) | `npm run start:prod` (= `node dist/main`) |
| Unit tests (Jest) | `npm test` |
| Test em watch | `npm run test:watch` |
| Coverage | `npm run test:cov` |
| E2E (Jest config próprio) | `npm run test:e2e` |
| Um teste específico | `npm test -- caminho/parcial-do-arquivo` |
| Seed Postgres | `npm run seed` |
| API smoke test | `npm run test:api` |

Scripts utilitários standalone ficam em `backend/scripts/`, **fora do
build** (`tsconfig.build.json` exclui), e rodam via `ts-node` direto.

### Frontend (`web/`)

| Ação | Comando |
|---|---|
| Dev (terminal vivo, porta 3001) | `npm run dev` |
| Build produção | `npm run build` |
| Start produção | `npm start` |
| Lint Next/ESLint | `npm run lint` |

Frontend **não roda sob PM2 em desenvolvimento.** Se o terminal fecha, o
frontend cai — abrir novo terminal e relançar.

### Prisma (`backend/`)

| Ação | Comando |
|---|---|
| Regerar client | `npx prisma generate` |
| Sincronizar schema → DB (**só dev**) | `npx prisma db push` |
| Criar migration (preferir em prod) | `npx prisma migrate dev --name <nome>` |
| Prisma Studio | `npx prisma studio` |

Antes de `prisma generate` ou `db push`: **parar o PM2** (`pm2 stop
cooperebr-backend`), confirmar porta 3000 livre, rodar, reiniciar PM2. Sem
isso o engine `query_engine_bg.wasm` fica lockado (EPERM). Detalhes na
seção "Infraestrutura local".

Antes de qualquer alteração destrutiva de schema (tipo de campo, NOT NULL,
deletar, renomear, unique/index, default), seguir o checklist da seção
"Regras de segurança para migrations" — incidente de 26/04 perdeu 96
valores por pular auditoria prévia.

### Testes E2E Playwright (raiz `tests/`)

Suite separada da raiz que valida o sistema rodando ponta-a-ponta. Exige
backend (3000), frontend (3001) e Postgres no ar.

| Ação | Comando (do diretório raiz) |
|---|---|
| Rodar suite completa | `npm test` (= `playwright test --config tests/playwright.config.ts`) |
| Abrir HTML report | `npm run test:report` |
| Spec único | `npx playwright test tests/03-portal-cooperado.spec.ts` |
| Grep por nome | `npx playwright test -g "login"` |
| Modo UI | `npx playwright test --ui` |

Specs ficam em `tests/NN-nome.spec.ts` (prefixo numérico ordena execução).
Helpers em `tests/helpers/`. Há um runner PowerShell `tests/run-qa.ps1`
e o slash command `/qa-run` que dispara a suite.

### PM2 (backend + whatsapp em desenvolvimento)

| Ação | Comando |
|---|---|
| Ver status | `pm2 list` |
| Logs backend | `pm2 logs cooperebr-backend --lines 30` |
| Parar backend | `pm2 stop cooperebr-backend` |
| Reiniciar backend | `pm2 restart cooperebr-backend` |
| Logs WhatsApp | `pm2 logs cooperebr-whatsapp --lines 30` |

Config em `ecosystem.config.cjs` (raiz). **NUNCA `npm run start:dev`
direto** — PM2 respawna e cria zumbis.

## Vocabulário multi-tipo (regra dura)

SISGD atende 4 tipos de parceiro, cada um com nome próprio pra "membro":

| `tipoParceiro` (enum) | Membro singular | Membro plural |
|---|---|---|
| COOPERATIVA | Cooperado | Cooperados |
| CONSORCIO | Consorciado | Consorciados |
| ASSOCIACAO | Associado | Associados |
| CONDOMINIO | Condômino | Condôminos |

**Regras:**
- Tabela legado se chama `Cooperativa` mas representa **qualquer parceiro**. Não renomear.
- UI/templates **nunca** devem hardcodar "Cooperado" — usar hook `useTipoParceiro()` (`web/hooks/useTipoParceiro.ts`) que retorna `{tipoMembro, tipoMembroPlural}` baseado no `tipoParceiro` da cooperativa logada.
- Hangar Academia, AESMP, ASSEJUFES são **membros PJ da CoopereBR (cooperados)** — não são parceiros do SISGD.
- Hook já adotado em 21 telas. Ainda há ~50 telas + 73 exceptions backend com termo hardcoded — débito P2 registrado em `docs/debitos-tecnicos.md` (commit `91652ae`). **Bloqueia onboarding produção de Consórcio/Associação/Condomínio**, não bloqueia desenvolvimento.

## Convenções de código

- Multi-tenant: toda query Prisma filtra por `cooperativaId`
- `npx prisma db push` em dev (nunca migrate)
- PowerShell: `;` em vez de `&&`
- Commits em português, pequenos, descritivos
- Valores monetários: `Math.round(x * 100) / 100`

## Como trabalhar com Luciano

- Luciano NÃO programa
- Explicar decisões em linguagem humana, sem jargão técnico
- Decisões técnicas puras (estrutura, libs, organização): decide você, comunica motivo
- Decisões de produto (regra de negócio, fluxo de usuário): pergunta antes de executar

## Quando Luciano pedir conteúdo de arquivo

- Execute `Get-Content <path>` e cole o output LITERAL
- NÃO resumir, NÃO interpretar
- Se arquivo > 500 linhas, avisar antes e perguntar se quer em partes

## Sprint atual

Última sessão Code: **maratona 11/05/2026** — 9 commits, 4 fases técnicas + 4
documentais (Fase C.2 reduzida, Fase C.3 display economia projetada, UI
etapa 11 aprovação concessionária, Sprint 0 passos iniciais). Detalhes em
`docs/sessoes/2026-05-11-execucao-maratona.md`.

**Próxima sessão Code (prioridade):** investigar **D-31** —
`Contrato.percentualUsina` zerado/irrealista no banco (descoberto na
auditoria Sprint 0). É P1 crítico provisório, **bloqueia Sprint 5 + canário**
(sem dado confiável de concentração, a flag `concentracaoMaxPorCooperadoUsina`
opera sobre input furado). 2-4h Code.

**Alternativas de fila** (se Luciano repriorizar):
1. Sprint CooperToken Consolidado Etapa 1 — specs Jest do módulo
   `cooper-token/` (zero hoje, pré-requisito P0 do refator, 6-8h)
2. Decisões batch B17-B32 (claude.ai)
3. Asaas conta produção (operacional, depende Luciano abrir)
4. Backfill 72 contratos legados (only-if-needed)
5. Canário 1 cooperado real CoopereBR (depende D-31)
6. Sprint 0 completo (cron + dashboard `/dashboard/super-admin/auditoria-regulatoria`)

Frase de retomada: "Iniciando investigação D-31 — `percentualUsina` no banco".

## Módulo Clube + CooperToken

Especificação em `docs/especificacao-clube-cooper-token.md`.
Sprint 8 implementa MVP. Sprint 9 faz rede interna. Sprint 10+ rede
aberta (requer consulta advogado antes).

Princípio: token = desconto diferido. kWh constante. Cooperado escolhe
Desconto (imediato) ou Clube (acumular tokens).

Ferramentas configuráveis (ativáveis por parceiro):
- Expiração de tokens (prazo em meses)
- Desvalorização temporal (período graça + taxa + piso)

Regra de ouro: comunicação transparente ao cooperado. Curvas
sempre visíveis no portal. WhatsApp notifica antes de eventos.

Antes de implementar Sprint 8, investigar /cadastro público —
pode já ter partes do Clube.

## Gateways de pagamento

Novos gateways sempre via adapter pattern (`src/gateway-pagamento/`).
Nunca chamar AsaasService direto de fora do módulo asaas — usar
GatewayPagamentoService. Ver `docs/arquitetura/gateways.md`.

Exceção: `pix-excedente.service.ts` usa AsaasService direto (transferência PIX específica).

## Dados de teste

Todos os dados atualmente no banco dev são de teste. Quando encontrar
dados suspeitos (CPF/CNPJ fake padrão 1-2-3-4, nomes 'REMOVIDO', emails
@removido.invalid, domínios @test ou @invalid), pode deletar sem perguntar.
Apenas mostra a lista do que vai deletar e executa. Isso vale até o primeiro
parceiro real entrar em produção.

## Regra de atualização

Se estado mudar muito (muitos tickets fechados, novo sprint, schema grande),
re-gerar RAIO-X e atualizar `docs/COOPEREBR-ALINHAMENTO.md`. Avisar Luciano antes.

## Regras de segurança para migrations e alterações de schema

Qualquer alteração de schema que envolva os casos abaixo EXIGE auditoria
**prévia** dos dados afetados:

1. Mudança de tipo de campo (String → Enum, String → Int, etc)
2. Tornar campo obrigatório (NULL → NOT NULL)
3. Deletar campo existente
4. Alterar default value
5. Renomear campo com impacto em queries
6. Alterar unique/index constraints

### Checklist ANTES de aplicar qualquer dos casos acima

**A.** Rodar SELECT que conta:
- Quantos registros têm valor não-nulo no campo
- Distribuição de valores (`SELECT valor, COUNT(*) GROUP BY`)
- Valores que não vão sobreviver à mudança

**B.** Reportar ao Luciano o que será perdido (se algo) e pedir
autorização explícita antes de executar.

**C.** Preferir migração em 2 passos quando possível:
- Passo 1: UPDATE pra normalizar valores existentes
- Passo 2: ALTER TABLE (tipo, NOT NULL, etc)

**D.** Evitar `prisma db push` cego em casos acima — preferir `migrate dev`
com review do SQL gerado. **Nunca** usar `--accept-data-loss` sem
auditoria prévia explícita.

**E.** Em scripts de normalização de dados: sempre dry-run primeiro,
mostrar ANTES/DEPOIS de cada registro, aguardar aprovação.

**F.** Se Luciano pedir "investigar relacionamentos antes de alterar",
auditar TODOS os campos afetados, não só o campo principal da solicitação.

Regra criada após incidente de 2026-04-26 (Sprint 11 Bloco 1): 96 valores
textuais de `Uc.distribuidora` foram perdidos em migration String → Enum
sem auditoria prévia. Registrado no MAPA-INTEGRIDADE-SISTEMA.md.

## Infraestrutura local — backend gerenciado por PM2

O backend roda sob **PM2** como `cooperebr-backend` (id 0). Não é processo
livre via `npm run start:dev`.

**Comandos corretos:**

| Ação | Comando |
|---|---|
| Ver status | `pm2 list` |
| Parar | `pm2 stop cooperebr-backend` |
| Subir (se stopped) | `pm2 start cooperebr-backend` |
| Reiniciar | `pm2 restart cooperebr-backend` |
| Ver logs | `pm2 logs cooperebr-backend --lines 30` |

**NUNCA usar `npm run start:dev` direto.** Mesmo que o usuário diga
"matei o backend", o PM2 pode ressuscitar o processo automaticamente,
criando processos zumbi e bloqueio do `query_engine_bg.wasm` (ou
`.dll.node` em versões antigas) do Prisma.

### Regras pra `prisma generate` / `db push`

**OBRIGATÓRIO** antes de `prisma generate` ou `prisma db push`:

1. `pm2 stop cooperebr-backend`
2. Confirmar porta 3000 livre: `netstat -ano | findstr :3000` (não deve
   ter `LISTENING`)
3. Rodar `prisma generate` / `db push`
4. `pm2 restart cooperebr-backend`

**Sem parar o PM2**, o engine Prisma fica lockado e o `EPERM` persiste
mesmo matando processo manualmente — PM2 respawna instantaneamente.

### REBUILD obrigatório quando muda código backend

PM2 roda `dist/src/main.js` (build compilado), **NÃO ts-node em modo watch**.
Mudanças em arquivos `.ts` **não chegam ao runtime** sem rebuild.

Sequência correta após qualquer mudança em `backend/src/`:
1. `pm2 stop cooperebr-backend` (libera locks)
2. `cd backend ; npm run build` (regenera `dist/`)
3. `pm2 restart cooperebr-backend`

Sintomas de "esqueci de rebuildar":
- 404 em endpoints novos
- Erros Prisma referenciando campos já deletados (`P2022 column 'X' does not exist`)
- Validação `tsc --noEmit` passa mas runtime falha

`scripts/` está excluído do build (`tsconfig.build.json`) — utilitários standalone
que rodam via `ts-node` direto, não vão pro `dist/`.

**Prisma v6** usa `query_engine_bg.wasm` (não mais `.dll.node`). Engine
binário antigo (`query_engine-windows.dll.node` de versões anteriores) é
**lixo no disco** e pode ser ignorado — verifique a data do `.wasm` pra
saber se o regenerate funcionou, não a do `.dll`.

Regra criada após sessão de 2026-04-25, onde 1h foi gasta debugando
erros 500 em `/ocorrencias` e `/contratos` que eram só engine Prisma
antigo carregado em memória pelo backend que o PM2 mantinha respawnado.

### Frontend Next.js dev — terminal vivo, NÃO gerenciado pelo PM2

O **frontend** (`web/`) roda via `npm run dev` em **terminal interativo**.
**Não está sob PM2.** Se o terminal/VS Code fecha, o frontend cai.

Sintomas de "frontend caiu":
- Browser mostra "Cannot connect" em `localhost:3001`
- Rotas que funcionavam viram 404
- HMR para de atualizar mudanças

Recuperação: abrir terminal novo, `cd web ; npm run dev`. Não tem
ressuscitação automática.

**Cuidado com VS Code reload:** ao reabrir VS Code/terminal integrado
e usar histórico do PowerShell, é fácil rodar comando velho de PM2
stop/start sem perceber que o backend já está estável. Resultado: sobe
restart count desnecessário. Antes de rodar `pm2 stop/start/restart`,
sempre `pm2 list` pra ver o estado real primeiro.

Regra criada após sessão de 2026-04-28: PM2 do `cooperebr-backend`
chegou a 331 restarts acumulados (alguns pela manhã por node órfão,
outros à noite por reaproveitamento acidental do histórico PowerShell).

## Estado atual do projeto (atualizado 2026-05-11)

Sprints 1-13a fechados. Fases A + B + B.5 + C.1 + C.1.1 + C.2 reduzida + C.3
de Planos comerciais concluídas. UI etapa 11 (aprovação concessionária)
destravada com cooperado real CoopereBR. Sprint 0 (auditoria regulatória
emergencial) com passos iniciais executados — relatório de concentração
>25% gerado, 0 casos detectados nos 62 contratos atuais.

**Sessão Code maratona 11/05 (9 commits):**
- UI etapa 11 — endpoint dedicado `POST /cooperados/:id/aprovar-concessionaria`
  + DTO `@MinLength(3)` + service multi-tenant (SUPER_ADMIN bypass) +
  Dialog admin + 6 specs. Destravou MARCIO MACIEL (CoopereBR real).
  (Commit `8853d97`)
- Fase C.2 reduzida — 5 itens UI plano avançada + `validacoes-plano.ts` (20
  specs ts-node) + snapshot/confirmação salvar via `_count.contratos`
  filtrado por tenant. (Commit `6d2510e`)
- Fase C.3 — `<EconomiaProjetada>` reusável (29 specs ts-node) em cobrança +
  contrato (recálculo via `simular-plano`) + proposta. (Commit `ecf39cd`)
- D-30Y resolvido — validação E2E manual `/aprovar-proposta` (2 propostas
  teste, 2 screenshots). (Commit `fecbe2a`)
- Adendo §11 spec CooperToken — 5 achados validados via Decisão 21 + D-30Z
  catalogado (85 cooperados em estado intermediário). (Commit `69902f6`)
- Sprint 0 passos iniciais — relatório auditoria concentração >25% (62
  contratos, 0 casos). **D-31 (P1 crítico) descoberto:**
  `Contrato.percentualUsina` zerado/irrealista no banco. (Commit `851a39e`)
- Fechamento — sessão + plano + controle + débitos. (Commit `49abb80`)

**Débitos novos da sessão:**
- **D-31 (P1 provisório crítico)** — `percentualUsina` zerado, bloqueia
  Sprint 5 + canário
- D-30W (P2) — aprovação admin automatizada pós Sprint 5+8
- D-30X (P3) — whitelist LGPD bypass `NODE_ENV`
- D-30Z (P3) — 85 cooperados em migração intermediária `opcaoToken → modoRemuneracao`
- D-30Y **RESOLVIDO**

**Conquistas históricas preservadas:**
- Sprint 10 (25/04): primeiro email SMTP, primeiro WhatsApp automático,
  LGPD compliance (112 registros mascarados), CADASTRO_V2 desbloqueado
- Sprint 11 (abr/26): arquitetura UC consolidada
  (numero/numeroUC/distribuidora/numeroConcessionariaOriginal), pipeline OCR
  multi-campo
- Sprint 12: webhook Asaas validado em sandbox + 3 bugs corrigidos
- Sprint 13a: painel SISGD `/dashboard/super-admin` operacional
- Fases A/B/B.5/C.1 de Planos (03/05 maratona, 20 commits, E2E 48/48,
  D-30R + duplo desconto + DINAMICO + snapshots resolvidos)

Documentos vivos permanentes (ler ao iniciar sessão):
- `docs/CONTROLE-EXECUCAO.md` — **estado vivo, seção "ONDE PARAMOS"
  atualizada a cada sessão**
- `docs/MAPA-INTEGRIDADE-SISTEMA.md` (atualizar a cada sprint)
- `docs/PLANO-ATE-PRODUCAO.md` (roteiro até produção)
- `docs/PRODUTO.md` (visão humana — substitui SISGD-VISAO movido pra histórico em 03/05/2026)
- `docs/COOPEREBR-ALINHAMENTO.md`
- `docs/REGULATORIO-ANEEL.md`
- `docs/debitos-tecnicos.md` (P0/P1/P2/P3 vivos)
- `docs/especificacao-clube-cooper-token.md`
- `docs/especificacao-contabilidade-clube.md`
- `docs/especificacao-modelos-cobranca.md`
- `CLAUDE.md` (este arquivo)
