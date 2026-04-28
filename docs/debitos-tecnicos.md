# Débitos técnicos — SISGD

> Lista consolidada de pendências técnicas conhecidas. Cada item registra
> origem, impacto e prioridade. Atualizar quando débito é resolvido OU quando
> aparece novo durante uma sessão.

**Última atualização:** 2026-04-28 (Sprint 13a Dia 3 fechado: IDOR multi-tenant em 6 endpoints CORRIGIDO + 1 P2 derivado auditoria geral IDOR)

---

## P1 — Bloqueia entrada de parceiro real

Nenhum no momento.

### [RESOLVIDO 28/04] IDOR multi-tenant em endpoints `/cooperativas/`

**Detectado em:** 2026-04-28 (Sprint 13a Dia 3, etapa 1 — audit prévio de segurança)

**Severidade na descoberta:** P0 (bloqueador onboarding Sinergia)

**Status:** ✅ **RESOLVIDO no mesmo dia** (Sprint 13a Dia 3, etapa 1.5)

**Vulnerabilidades encontradas:** 6 endpoints sem isolamento multi-tenant para perfil ADMIN — 4 de READ, 2 de WRITE críticos. ADMIN da Cooperativa A poderia ler/editar/sabotar dados da Cooperativa B (multa, juros, plano, ativo, dados cadastrais, link de convite).

Endpoints afetados:
- `GET /cooperativas/:id`
- `GET /cooperativas/:id/painel-parceiro`
- `GET /cooperativas/:id/qrcode`
- `GET /cooperativas/financeiro/:id`
- `PATCH /cooperativas/financeiro/:id` ← **WRITE crítico**
- `PUT /cooperativas/:id` ← **WRITE crítico**

**Como passou despercebido:** ambiente com 1 parceiro (CoopereBR) + 1 trial. IDOR multi-tenant é invisível sem segundo tenant real. Bug latente, exploração só começaria quando Sinergia (Consórcio) entrasse.

**Fix aplicado:** helper `assertSameTenantOrSuperAdmin(user, cooperativaIdAlvo)` em `backend/src/auth/tenant-guard.helper.ts`, aplicado nos 6 endpoints + novo endpoint `GET /saas/parceiros/:id/saude` (Sprint 13a Dia 3 etapa 3). Specs Jest (helper isolado + controller integrado): 16/16 passing.

**Lições:**
1. **Audit de segurança como etapa padrão** quando entrega tela ou endpoint que receba `cooperativaId` via parâmetro. Adicionar regra ao `CLAUDE.md`.
2. **Investigar antes de construir** — esta vulnerabilidade só apareceu porque investigamos as telas existentes ANTES de apontar o chevron (ETAPA 5 do prompt do Dia 2). Se tivéssemos só apontado, IDOR ficaria latente até Sinergia migrar.
3. Padrão único (helper) deve ser referência pra outros módulos com endpoints `:id` apontando pra cooperativaId — ver débito P2 derivado abaixo.

---

## P2 — Tem mitigação mas precisa resolver antes de produção pública

### Vocabulário hardcoded "Cooperado" em UI/templates (multi-tenant tipo-específico)

**Detectado em:** 2026-04-28 (investigação read-only pré-onboarding Sinergia)

**Severidade:** P2 — incômodo aceitável mas precisa antes de Sinergia (Consórcio) operar em produção

**Onde:**

- **Frontend:** 50 arquivos `.tsx` com label UI hardcoded ("Cooperado"/"Cooperados" entre tags ou em placeholders) — 106 ocorrências literais. Total de arquivos com qualquer menção: 98.
- **Backend:** 73 mensagens de exception (`NotFoundException('Cooperado não encontrado')`, `BadRequestException('Cooperado sem telefone cadastrado')`, etc) que viram resposta HTTP/UI. 129 arquivos com alguma menção.
- **WhatsApp:** `whatsapp-bot.service.ts` com 131 ocorrências (textos visíveis ao usuário tipo "Já sou cooperado", "Quero ser cooperado"). Outros services WA com 26-56 ocorrências.
- **Email/CoopereAI:** templates não auditados em detalhe, mas `coopere-ai.service.ts` referencia o termo.

**Contexto:** SISGD é multi-tipo (Cooperativa/Consórcio/Associação/Condomínio). Cada tipo tem nome próprio pra membro: cooperado, consorciado, associado, condômino. Hoje o frontend usa "Cooperado" hardcoded em 50 telas. Quando Consórcio Sinergia migrar pro SISGD, o admin dele vai ver "Cooperados" em vez de "Consorciados".

**Bom achado:** infraestrutura de parametrização **já existe e está em produção parcial**:

- Hook frontend `web/hooks/useTipoParceiro.ts` já implementado, com mapa `COOPERATIVA→Cooperado / CONSORCIO→Consorciado / ASSOCIACAO→Associado / CONDOMINIO→Condômino`. Respeita SUPER_ADMIN (mostra "Membro" genérico). Tem fallback pra labels enriquecidos do backend (`tipoMembro`/`tipoMembroPlural`).
- 21 telas **já adotaram o hook**: cobrancas, contratos, cooperados/novo, cooperados/[id], dashboard layout, motor-proposta, ocorrências, ucs, usinas/listas.

**Lacuna:** as outras ~50 telas com label hardcoded ainda não migraram. Backend não tem helper equivalente.

**Fix sugerido:**

1. **Frontend (3 dias):** importar `useTipoParceiro` nas 50 telas restantes, trocar string literal por `{tipoMembro}`/`{tipoMembroPlural}`. Trabalho mecânico, um arquivo por vez. Alta prioridade nas telas que admin Sinergia vai abrir mais (cooperados/page, dashboard/page, relatórios).
2. **Backend helper (0,5 dia):** criar `src/common/nome-membro.helper.ts` com `getNomeMembro(tipoParceiro)`. Injetar `tipoParceiro` via contexto da Cooperativa quando montar mensagem de exception ou template.
3. **Mensagens de erro (1 dia):** atualizar as 73 exceptions backend pra usar o helper. Padrão: trocar `'Cooperado não encontrado'` por `\`${nomeMembro} não encontrado\``.
4. **Templates WhatsApp (1 dia):** `whatsapp-bot.service.ts` é o mais sensível. Pode ficar pro fim — começar pelos que aparecem no fluxo de cadastro/cobrança (`whatsapp-cobranca`, `whatsapp-ciclo-vida`).
5. **CoopereAI prompt (~0,5 dia, sensível):** auditar prompts e referências a "cooperado". Deixar por último.

**Estimativa total:** 3-5 dias úteis. Pode ser feito **incrementalmente** — hook já está vivo, telas convertidas convivem com não-convertidas sem quebrar nada.

**Bloqueia:** onboarding produção de parceiros não-Cooperativa (Consórcio Sinergia, qualquer Associação ou Condomínio futuro). Sinergia consegue operar mesmo com termo errado, mas vai ser desconfortável e pouco profissional.

**NÃO bloqueia:** Sprint 13 (Painel Luciano super-admin), Sprint 12 (webhook Asaas em produção), nem qualquer fluxo da CoopereBR (que é Cooperativa, vê o termo correto).

### `numero` em saco de gato (326 UCs em 9 formatos)

**Origem:** auditoria Sprint 11 Dia 1 (`docs/sessoes/2026-04-26-auditoria-numeracao-dupla.md`).

**Impacto:** campo `Uc.numero` (`@unique`, NOT NULL) tem formatos heterogêneos
no banco — `001001`, `0.000.892.226.054-40`, `0450023484`, `PENDENTE-*`,
`UC-{ts}`, etc. Pipeline OCR mitiga via `comparaNumerosUc` (tolerância de
zeros à esquerda) mas listas B2B pra concessionária podem sair inconsistentes.

**Decisão pendente:** sessão arquitetural com Luciano pra decidir entre:
- (a) Manter (status quo + tolerância)
- (b) Virar identificador interno SISGD (`UC-AAAA-NNNNN`)
- (c) **Remover** — usar `id` + `numeroUC` + `numeroConcessionariaOriginal`

Recomendação preliminar: **(c) Remover**. Reforçada por evidência empírica
do E2E Sprint 11 Fase D (OCR real EDP só popula `numeroConcessionariaOriginal`).

**Confirmar quando primeiro parceiro real entrar.**

### 96 UCs com `distribuidora = OUTRAS`

**Origem:** incidente do Sprint 11 Bloco 1 (migration `String → DistribuidoraEnum` perdeu valores textuais sem auditoria prévia).

**Impacto:** queries por distribuidora retornam dados incompletos pra essas
96 UCs (eram 91 "EDP ES" + 5 variantes). Pipeline IMAP pode falhar match em
algumas UCs por causa do filtro `AND distribuidora`.

**Decisão (Luciano):** correção manual caso a caso quando admin precisar.
Não gerar script automático.

**Recuperação rápida disponível** (se mudar de ideia): heurística por
estado/cidade (ES → EDP_ES) recupera ~91 registros em 15 min.

### Auditoria de drift entre docs e código

**Detectado em:** 2026-04-28 (meta-discussão Sprint 13a Dia 2)

**Severidade:** P2

**Onde:** `docs/MAPA-INTEGRIDADE-SISTEMA.md`, `docs/SISGD-VISAO-COMPLETA.md`, `docs/PLANO-ATE-PRODUCAO.md`, `CLAUDE.md`

**Contexto:** Documentos foram atualizados ao longo do tempo mas há suspeita de drift. Sintomas:

- MAPA com padrão de "anexar ao final" virando relatório cronológico em vez de bússola
- VISÃO-COMPLETA possivelmente sem revisão de decisões recentes (FATURA_CHEIA_TOKEN, vocabulário multi-tipo, Hangar caso real, Portal Proprietário)
- Features implementadas mas não documentadas
- Features documentadas mas incompletas

**Fix sugerido:** sessão dedicada — Code abre cada doc principal, cruza com código real, reporta drift com evidências (linhas exatas), classifica por severidade, reconciliação em fatias.

**Estimativa:** 60-90 min Code (auditoria) + 1-2 sessões pra reconciliar.

**Bloqueia:** qualidade do planejamento de Sprints futuros. Sem isso, risco de duplicar trabalho ou contradizer decisões anteriores.

### Auditoria geral de IDOR em outros módulos

**Detectado em:** 2026-04-28 (consequência do achado em `/cooperativas/` durante Sprint 13a Dia 3)

**Severidade:** P2 (bloqueia onboarding seguro de segundo parceiro — Sinergia/Consórcio)

**Onde:** todos os módulos backend que aceitam `:id` como parâmetro apontando pra recurso de cooperativa: `cooperados`, `contratos`, `cobrancas`, `usinas`, `ucs`, `faturas`, `motor-proposta`, `convenios`, `clube-vantagens`, `cooper-token`, `notificacoes`, `ocorrencias`, `whatsapp`, `email-monitor`, `relatorios`, `condominios`, `administradoras`, etc.

**Contexto:** o fix de IDOR em `/cooperativas/` revelou padrão. O Roles Guard isolado **não basta** — gating por perfil garante apenas que apenas SUPER_ADMIN/ADMIN cheguem ao método, mas não restringe ADMIN da Cooperativa A de operar sobre recursos da Cooperativa B. Outros módulos podem ter endpoints similares vulneráveis.

**Fix sugerido:** sprint dedicado de auditoria de segurança multi-tenant. Code abre cada controller, identifica endpoints com `:id` que apontam pra recurso de cooperativa, audita filtragem (no controller OU no service), aplica helper `assertSameTenantOrSuperAdmin` ou equivalente onde for necessário. Estimativa: 1-2 dias úteis.

**Bloqueia:** onboarding seguro de Sinergia (Consórcio). Hoje só CoopereBR é tenant real, então nenhuma exploração ativa — mas qualquer onboarding de segundo parceiro reabre risco em todos os módulos não-auditados.

**Prioridade:** alta. **Rodar antes de Sinergia migrar pro SISGD.**

### Auditoria de drift entre docs e código (continuação)

**Achado adicional 28/04 — investigação focada Sprint 13a Dia 2:**

Existe rota `/parceiro/` (singular, 25 subpastas) paralela a `/dashboard/`, com layout próprio, sidebar própria e dashboard próprio. Consome endpoint `/cooperativas/meu-dashboard`. **Não está documentada em CLAUDE.md, MAPA-INTEGRIDADE-SISTEMA.md ou SISGD-VISAO-COMPLETA.md.** É portal admin do parceiro (visão "externa"), paralelo ao `/dashboard/` (visão "interna"). Drift estrutural, não só conteúdo desatualizado — auditoria de drift precisa mapear esta rota inteira.

Subpastas detectadas: agregadores, clube, clube-vantagens, cobrancas, condominios, configuracoes, contratos, convenios, convites, enviar-tokens, faturas, financeiro, indicacoes, membros, modelos-cobranca, motor-proposta, planos, receber-tokens, relatorios, tokens-recebidos, ucs, usinas, usuarios, whatsapp.

---

## P3 — Cosmético / quality-of-life

### Specs quebrados desde commit `4d70b19`

**Arquivos:**
- `backend/src/cooperados/cooperados.service.spec.ts`
- `backend/src/cooperados/cooperados.controller.spec.ts`

**Erro:** `Nest can't resolve dependencies of the CooperadosService (PrismaService, NotificacoesService, ?, WhatsappCicloVidaService, WhatsappSenderService, EmailService, FaturasService). UsinasService at index [2] is available in the RootTestModule module.`

**Origem:** commit `4d70b19` (sprint anterior, antes de qualquer trabalho meu) adicionou `UsinasService` ao construtor de `CooperadosService` mas não atualizou os 2 specs gerados pelo scaffold do NestJS CLI.

**Detectado:** durante regressão da Fase D do Sprint 11. **Não é regressão deste sprint.**

**Sintoma atual:** 2 falhas em `npx jest cooperados`. Demais testes (8/8 do guard-ativacao novo + 72/72 de email/faturas) passam normalmente.

**Fix sugerido (~10 min):** atualizar `Test.createTestingModule({ providers: [...] })` em ambos os specs incluindo `UsinasService`, `FaturasService`, `EmailService` e dependências transitivas. Ou marcar como `.skip()` se vão ser reescritos no futuro.

### Bug — Relatório de Inadimplência quebra com valor `undefined`

**Arquivo:** `web/app/dashboard/relatorios/inadimplencia/page.tsx:21` (função `formatarMoeda`).

**Origem:** detectado em 2026-04-27 quando Luciano abriu `/dashboard/relatorios/inadimplencia` enquanto preparava ambiente pro teste do webhook Asaas.

**Erro de runtime:**

```
Runtime TypeError: can't access property "toLocaleString", v is undefined
  formatarMoeda  page.tsx:21
  InadimplenciaPage  page.tsx:206
```

Código que quebra:

```typescript
function formatarMoeda(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
```

**Impacto:** página inteira do relatório de inadimplência não abre. Afeta o admin do parceiro (Marcos no fluxo Hangar; admin CoopereBR no teste). Outras telas não são afetadas.

**Causa provável:** backend retorna algum campo numérico (saldo devedor, multa, juros) como `null`/`undefined`. A função declara `v: number` mas não trata ausência do valor.

**Fix sugerido (~10-15 min):**

1. Adicionar guard em `formatarMoeda`:
   ```typescript
   function formatarMoeda(v: number | null | undefined): string {
     if (v === null || v === undefined || Number.isNaN(v)) return 'R$ 0,00';
     return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
   }
   ```
2. Investigar **por que** o backend retorna campo vazio. Conferir endpoint que alimenta o relatório (`relatorios.service.ts` ou similar).
3. Decidir contrato: backend deveria sempre retornar `0` em vez de `null`? Ou frontend é responsável pelo fallback? Aplicar regra consistente.
4. Buscar `formatarMoeda` em outros pages/components do frontend e aplicar a mesma proteção (alta probabilidade de existir mais ocorrências).

**Reproduzir:** abrir `localhost:3001/dashboard/relatorios/inadimplencia` autenticado como admin da CoopereBR — página explode no carregamento.

**Não-bloqueante para:** Sprint 12, Sprint 13, retomada de qualquer outro fluxo.

### PM2 sem monitoramento de crash loop

**Detectado em:** 2026-04-27 (descoberta acidental durante setup ngrok)

**Severidade:** P3 (ok pra dev, blocker pra Sprint 26 pré-produção)

**Sintoma observado:** backend PM2 acumulou **298 restarts** em 4 horas sem alerta. Porta 3000 estava ocupada por processo node órfão (PID 4396) de sessão antiga; PM2 spawnava novo processo, falhava com `EADDRINUSE`, restartava em loop infinito. Dashboard PM2 mostrava `online` enganosamente.

**Impacto em dev:** confundiu diagnóstico — webhooks 200 OK eram respondidos pelo backend órfão, não pelo PM2 novo. Quase fechei sessão sem perceber.

**Impacto em produção:** sintomas seriam lentidão intermitente, requisições com latência alta, status `online` falso no dashboard.

**Fix sugerido (~30 min):**
1. Configurar `pm2-logrotate` (já vem com PM2)
2. Hook `pm2 install pm2-server-monit` ou alerta customizado
3. Alerta quando restart_count subir > 5 em 1h (cron + curl pra Slack/email/WA)
4. `max_restarts: 10` no ecosystem.config — para o processo após N restarts em vez de loop infinito

**Não-bloqueante para:** Sprints 12-25 em dev. Obrigatório antes de Sprint 26 (pré-produção).

### 4.9 tokens emitidos por engano antes do conserto CLUBE

**Detectado em:** 2026-04-27 (durante validação contraprova do bug 3)

**Severidade:** P3 (registro do incidente; valores não estornados)

**Contexto:** antes do commit `16302e9` (conserto modo CLUBE), 2 cobranças de cooperados em modo CLUBE foram processadas com a regra antiga de dupla bonificação:

| Cooperado | Cobrança | Valor cobrado | Tokens emitidos errados |
|-----------|----------|---------------|--------------------------|
| TESTE E2E CLUBE SPRINT9 | `cmoh8z…` (04/2026) | R$ 8 (deveria ser R$ 10 cheio) | 1.96 FATURA_CHEIA |
| AGOSTINHO | `cmoh9n…` (04/2026) | R$ 12 (deveria ser R$ 15 cheio) | 2.94 FATURA_CHEIA |

Total: 4.9 tokens emitidos a maior + R$ 5 cobrados a menor. **Ambos cooperados são `ambienteTeste=true`** — nenhum impacto financeiro real.

**Decisão:** não estornar. Ambiente de teste, valor não material, registro pra auditoria histórica.

**Origem desconhecida da Cobrança `cmobdlysq0003va18sw9twwc3`** (AGOSTINHO 05/2026 R$ 600 cheio): criada em 23/04 via script de teste com `valorLiquido = valorBruto` hardcoded, contornando o bug do `percentualDesconto` (que só apareceu via UI). Ficou correta "por sorte". Mantida como referência.

**Não-bloqueante para:** nada.

### Script `teste-ocr-fatura-luciano.ts` com erros TS

**Arquivo:** `backend/scripts/teste-ocr-fatura-luciano.ts`

**Erro:** 4 erros TS de mailparser types (`readonly` vs `readOnly`, `parsed.attachments` undefined, etc.)

**Origem:** sprint anterior, débito conhecido.

**Mitigação:** adicionei `scripts/` ao `tsconfig.build.json:exclude` (commit `d784553`) — não bloqueia mais o `npm run build`. Scripts standalone rodam via `ts-node --transpile-only` que ignora erros de tipo.

**Fix sugerido (~15 min):** corrigir os 4 erros se for necessário rodar tsc estrito em scripts. Não urgente.

### Card MRR do Painel SISGD trunca variável estimado em viewports estreitos

**Detectado em:** 2026-04-28 (validação visual Sprint 13a Dia 1)

**Arquivo:** `web/app/dashboard/super-admin/page.tsx` (card MRR plataforma, ~linha 119-122)

**Sintoma:** o subtítulo do card mostra `R$ 9.999,00 fixo · R$ 266,67 estimado`. Em larguras menores o "estimado" trunca pra `R$ 266,6...`. Já tem `truncate` aplicado mas o texto não cabe na coluna do grid 4-col em viewports intermediários.

**Impacto:** apenas Luciano (SUPER_ADMIN) vê esta tela. Cosmético, não esconde número crítico (números principais estão em `text-2xl` separado).

**Fix sugerido (~10 min):** quebrar em 2 linhas (`fixo` em uma, `variável estimado` em outra) ou trocar `truncate` por `whitespace-normal break-words`. Ou mostrar tooltip com valores completos.

**Não-bloqueante para:** nada.

### N+1 latente em MetricasSaasService (MRR + detecção de incêndios)

**Detectado em:** 2026-04-28 (revisão pré-commit Sprint 13a Dia 1)

**Arquivo:** `backend/src/saas/metricas-saas.service.ts`

**Sintoma:**
- `calcularMRR()` faz 1 `aggregate` por parceiro com plano ATIVO (loop sequencial).
- `detectarIncendios()` faz 2 `count` por cooperativa ativa (loop sequencial, `Promise.all` é só dentro do par count/total — não paraleliza entre cooperativas).

**Impacto hoje:** irrelevante. 2 parceiros = 2 idas no MRR + 4 counts em incêndios. Tempo de resposta do `/saas/dashboard` continua < 500ms.

**Quando vira problema:** ~30 parceiros em diante. Loop sequencial de 30+ aggregates pode levar 2-5s e degradar a tela.

**Fix sugerido quando escalar:**
1. **Cache 5min** (já marcado como TODO no comentário do service): Redis ou cache em memória do NestJS (`@nestjs/cache-manager`).
2. **Batch query** com `groupBy` em vez de loop: `cobranca.groupBy({ by: ['cooperativaId'], where: { dataPagamento: { gte: inicioJanela }, status: 'PAGO' }, _sum: { valorPago: true } })` resolve MRR em 1 query.
3. **Materialized view** ou tabela `metricas_saas_cache` atualizada por cron horário pra dashboards mais pesados.

**Estimativa:** 1-2h pra refazer com `groupBy`. Cache é 0,5 dia.

**Não-bloqueante para:** Sprint 13b, 14, etc. Revisar quando totalParceiros > 30.

### PM2 `cooperebr-backend` sem `max_restarts` configurado

**Detectado em:** 2026-04-28 (segundo incidente em 2 dias — primeiro foi 2026-04-27 com 298 restarts por node órfão)

**Severidade:** P3 (ok pra dev) — **vira P1 antes de Sprint 14 (pré-produção)**

**Sintoma:** PM2 `cooperebr-backend` chegou a **331 restarts acumulados** sem nenhum alerta. Causas observadas:
- 2026-04-27: porta 3000 ocupada por node órfão de sessão antiga, PM2 spawnava novo processo, falhava com `EADDRINUSE`, restartava em loop infinito
- 2026-04-28: Luciano sem querer reaproveitou histórico do PowerShell ao reabrir VS Code e executou `pm2 stop`/`start` várias vezes, cada um adicionando ao contador

**Onde:** `ecosystem.config.js` na raiz do projeto (ou config inline do PM2 se não existir arquivo dedicado)

**Risco em produção:**
- Status `online` enganoso quando processo está em crash loop
- Webhooks 200 OK respondidos por processo zumbi (não pelo PM2 atual)
- Lentidão intermitente sem alerta

**Fix sugerido (~30 min):**
1. Criar/atualizar `ecosystem.config.js`:
   ```js
   module.exports = {
     apps: [{
       name: 'cooperebr-backend',
       script: 'dist/src/main.js',
       cwd: 'backend',
       max_restarts: 10,
       min_uptime: '10s',
       restart_delay: 3000,
       max_memory_restart: '1G',
       error_file: 'logs/pm2-error.log',
       out_file: 'logs/pm2-out.log',
       merge_logs: true,
     }],
   };
   ```
2. Pré-flight check no boot do main.ts: detectar `EADDRINUSE` ANTES de iniciar Nest e logar erro descritivo (já existe parcial — robustecer)
3. `pm2 install pm2-logrotate` pra evitar log file gigante
4. Cron horário (script + curl pra Slack/email/WA) que alerta se `restart_count` subir > 5 em 1h

**Bloqueia:** Sprint 14 (pré-produção, requer estabilidade PM2 + observabilidade básica).

### Sidebar do super-admin com ordem de itens não-otimizada

**Detectado em:** 2026-04-28 (validação visual Sprint 13a Dia 1)

**Onde:** `web/app/dashboard/layout.tsx` — função `getNavSections(perfil)` (linhas ~120-180)

**Sintoma:** itens "Projeção Receita", "Expansão / Investidores", "Portal Proprietário", "Asaas Pagamentos" estão misturados sem agrupamento claro. Quando Luciano abre o dashboard como SUPER_ADMIN, o link "Painel SISGD" novo competiu com itens herdados de outras épocas que poderiam estar em "Configurações" ou "Operacional".

**Impacto:** apenas Luciano (SUPER_ADMIN) usa esta densidade de menu. Cosmético, não bloqueia nada.

**Fix sugerido (~30-45 min):** revisar agrupamento de seções. Proposta:
- **Gestão Global** (SUPER_ADMIN): Painel SISGD, Parceiros, Planos SaaS, Faturas SaaS, Audit Logs (Sprint 13b)
- **Operacional**: Cobranças, Faturas, Cooperados, Contratos, UCs, Usinas
- **Comercial**: Convênios, Indicações, Clube/Token, Lead Expansão
- **Configurações**: Email, Asaas, Modelos Cobrança, WhatsApp Config

Idealmente fazer junto com Sprint 13a Dia 2 (lista de parceiros vai exigir ajuste de menu de qualquer jeito).

**Não-bloqueante para:** nada.

### Lista antiga `/dashboard/cooperativas` sem coluna Plano SaaS

**Detectado em:** 2026-04-28 (verificação visual Sprint 13a Dia 2)

**Severidade:** P3

**Onde:** `web/app/dashboard/cooperativas/page.tsx`

**Contexto:** Existem 2 listas de parceiros — antiga (Administração → "Parceiros SISGD") e nova (Gestão Global → "Parceiros"). Antiga sem coluna Plano, nova com. Confunde super-admin.

**Fix sugerido:** decidir após auditoria de drift se (a) adiciona coluna Plano na antiga, (b) marca antiga como deprecated, ou (c) faz redirect.

**Bloqueia:** UX de organização. Nada urgente.

### Inconsistência "Faturado este mês" entre Dashboard e Lista de Parceiros

**Detectado em:** 2026-04-28 (verificação visual Sprint 13a Dia 2)

**Severidade:** P3

**Onde:** `backend/src/saas/metricas-saas.service.ts`

**Contexto:** Dashboard (`getResumoGeral.calcularFaturamentoMesAtual`) mostra R$ 1.333,35 usando `dataPagamento >= inicioMes`. Lista (`getListaParceirosEnriquecida`) mostra R$ 1.180,00 pra CoopereBR usando `dataVencimento >= inicioMes`. Diferença R$ 153,35.

**Decisão técnica adotada:** alinhar com `dataPagamento` (visão contábil padrão — o que entrou no caixa neste mês).

**Fix sugerido:** uniformizar `getListaParceirosEnriquecida()` usando mesmo filtro de `calcularFaturamentoMesAtual()`. Pequeno ajuste, ~10 min Code. Pode entrar no Dia 3 ou em fix dedicado.

**Bloqueia:** clareza de relatório. Nada urgente.

### Portal do Proprietário de Usina — feature parcial

**Detectado em:** 2026-04-28 (verificação visual Sprint 13a Dia 2)

**Severidade:** P3

**Onde:** `/dashboard/proprietario`

**Contexto:** Tela destinada ao Proprietário de Usina (PF/PJ que arrenda usina pra cooperativa). Schema tem `Usina.proprietarioCooperadoId` + campos avulsos (`proprietarioNome` etc). Tela existe e gate de perfil funciona, mas sem fluxo de cadastro de Proprietário, sem dado real, sem lógica de "valores a arrecadar".

**Fix sugerido:** sprint dedicado a Arrendamentos/Repasses ao Proprietário. Não está no PLANO-ATE-PRODUCAO atual. Sugestão de inserção: após Sprint 14 (pré-produção), antes de Sprint 18.

**Bloqueia:** futuro. Mapeamento parcial sai da etapa 5.7 do prompt da sessão Sprint 13a Dia 2.

### Regra de processo: prompt mapeador antes de prompt construtivo

**Detectado em:** 2026-04-28 (meta-discussão Sprint 13a Dia 2)

**Severidade:** P3 (processo)

**Onde:** workflow Claude.ai + Claude Code

**Contexto:** Sprint 13a Dia 2 expôs falha — Claude.ai planejou lista de Parceiros sem mapear primeiro telas existentes (já havia `/dashboard/cooperativas/[id]` e talvez `/dashboard/parceiros/[id]`), gerando redundância e inconsistência numérica. Causa: docs de contexto não consultados proativamente.

**Fix:** adicionar regra ao `CLAUDE.md`:

> Antes de qualquer prompt construtivo, Code abre e lê (1) CLAUDE.md, (2) docs/SISGD-VISAO-COMPLETA.md (área), (3) docs/MAPA-INTEGRIDADE-SISTEMA.md (área), (4) docs/PLANO-ATE-PRODUCAO.md (sprint vigente). Retorna mapa específico antes de codar.

**Aplicação:** próxima sessão. Aplicar junto com auditoria de drift.

**Bloqueia:** qualidade dos próximos sprints.

---

## Como adicionar item

Quando aparecer débito novo durante sessão:
1. Anotar aqui na seção apropriada (P1/P2/P3) com origem, impacto, decisão
2. Referenciar a sessão/commit que detectou
3. Sugerir fix com tempo estimado
4. Fazer commit isolado: `docs(debitos): registra <descrição>` quando o débito for material; senão pode ir junto com commit de fechamento de sprint

## Como remover item

Quando débito for resolvido:
1. Remover da lista
2. Mencionar na mensagem de commit que fechou o débito
