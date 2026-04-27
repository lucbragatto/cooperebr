# Débitos técnicos — SISGD

> Lista consolidada de pendências técnicas conhecidas. Cada item registra
> origem, impacto e prioridade. Atualizar quando débito é resolvido OU quando
> aparece novo durante uma sessão.

**Última atualização:** 2026-04-28 (P2 vocabulário hardcoded multi-tipo registrado)

---

## P1 — Bloqueia entrada de parceiro real

Nenhum no momento.

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
