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

## Disciplina de validação prévia E retomada

**Regra inegociável** — antes de propor ou executar qualquer trabalho novo OU
retomar trabalho anterior, sempre verificar o estado real do projeto cruzando:
- Documentação atual (`CONTROLE-EXECUCAO.md` + `PLANO-ATE-PRODUCAO.md`)
- Código real (schema, services, banco)
- Git history (commits recentes + branches)

Detalhes em `~/.claude/projects/C--Users-Luciano-cooperebr/memory/regra_validacao_previa_e_retomada.md`.

Aplica-se a:
- Code (sessões autônomas com Claude Code CLI)
- claude.ai web (sessões de planejamento e decisão)
- Qualquer agente futuro

**Por quê:** sessões que pulam essa etapa produzem retrabalho, conflitos de numeração,
órfãos esquecidos e divergência entre documentação, código, banco e operação real.
A coerência sistêmica depende dessa disciplina.

**Exemplos reais de violação documentados:**
- **30/04 noite:** claude.ai propôs nova numeração de sprints (Sprint 0-9) sem validar
  com a antiga (Sprint 1-26) → 5 colisões + 6 órfãos. Detectado em 01/05 manhã
  (commit `1be9b34`).
- (adicionar futuras violações pra aprendizado contínuo)

**Origem:** sessão claude.ai 30/04/2026 noite + extensão 01/05/2026 manhã.

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

Detalhes em `docs/COOPEREBR-ALINHAMENTO.md` e `docs/SISGD-VISAO-COMPLETA.md`.

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

Sprint 13a P0 e Dia 1 fechados (28/04/2026). Painel SISGD `/dashboard/super-admin` operacional.

**Próximo: Sprint 13a Dia 2** — lista de parceiros enriquecida + filtros + smoke test.

Sprint 13 foi dividido em 3 fatias entregáveis (não monolítico):
- **13a** (em andamento) — Painel super-admin (Dia 1 ✅, Dia 2 e 3 pendentes)
- **13b** — AuditLog ativo (interceptor) + Impersonate completo
- **13c** — Edição de plano SaaS pelo painel + suspensão de parceiro

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

## Estado atual do projeto (atualizado 2026-04-28)

Sprint 13a P0 + Dia 1 concluídos. Painel SISGD operacional em `/dashboard/super-admin`.

**Banco final:**
- 2 cooperativas: **CoopereBR** (produção, plano OURO, 307 cooperados / 299 ATIVOS) + **CoopereBR Teste** (TRIAL, plano PRATA, 4 cooperados ATIVOS)
- 1 FaturaSaas PENDENTE (CoopereBR Teste, R$ 5.900, vencida 10/04 — para validar painel de inadimplência)
- AuditLog table criada (vazia — ativação no Sprint 13b com interceptor)
- 4 índices cross-tenant criados em `cobrancas`, `cooperados`, `faturas_saas`

**Sprint 13a Dia 1 entregou:**
- `MetricasSaasService` + endpoint `GET /saas/dashboard` (gated SUPER_ADMIN)
- Tela `/dashboard/super-admin` com 5 cards (parceiros, membros, faturado, MRR, alerta inadimplência + hero incêndios)
- Sidebar reorganizada com link "Painel SISGD" em "Gestão Global"
- Refactor `gerarFaturaParaCooperativa` exposto como público (commit `0d53773`)

**Conquistas históricas do Sprint 10 (preservar):**
- Primeiro email SMTP funcional (email_logs.status=ENVIADO passou de 0 pra 1+)
- Primeiro WhatsApp automático pós-reativação
- LGPD compliance (whitelist dev + flag ambienteTeste + 112 registros mascarados)
- CADASTRO_V2 desbloqueado

**Conquistas Sprint 11 e 12:**
- Sprint 11: Arquitetura UC consolidada (numero/numeroUC/distribuidora/numeroConcessionariaOriginal), pipeline OCR multi-campo, E2E fatura Luciano
- Sprint 12: Webhook Asaas validado em sandbox + 3 bugs corrigidos (CLUBE dupla bonificação, percentualDesconto, dataVencimento)

Documentos vivos permanentes (ler ao iniciar sessão):
- docs/MAPA-INTEGRIDADE-SISTEMA.md (atualizar a cada sprint)
- docs/PLANO-ATE-PRODUCAO.md (roteiro de sprints até produção)
- docs/COOPEREBR-ALINHAMENTO.md
- docs/SISGD-VISAO-COMPLETA.md (visão humana do produto)
- docs/debitos-tecnicos.md (P1/P2/P3 vivos)
- docs/especificacao-clube-cooper-token.md
- docs/especificacao-contabilidade-clube.md
- docs/especificacao-modelos-cobranca.md
- CLAUDE.md (este arquivo)

Próximo passo: **Sprint 13a Dia 2** — lista de parceiros enriquecida com filtros e smoke test. Frase de retomada: "Iniciando Sprint 13a Dia 2 — lista parceiros + filtros".
