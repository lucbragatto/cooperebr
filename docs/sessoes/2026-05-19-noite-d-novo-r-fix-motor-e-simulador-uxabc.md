# Sessão 2026-05-19 noite — D-novo-R fix motor dinâmico + Simulador UX Fases A/B/C

## Resumo executivo

Sessão Code de ~3h focada em (1) caçar bug de produção P1 descoberto via investigação do simulador celular não responder, e (2) entregar 3 fases de melhoria UX no simulador pra eliminar o problema de "digitei e não sei o que aconteceu".

**Entregas:**
- 4 commits no main: `a0e0f06` (fix motor D-novo-R) + `b0a92c8` (Fase A+B simulador) + `483fb2b` (Fase C preview modelo) + commit de fechamento (este)
- 1 bug P1 produção resolvido + 5 specs novos cobrindo regressão
- 2 endpoints novos backend (`/whatsapp/preview-modelo`) + 1 componente novo frontend (`PreviewModelo.tsx`)
- 5 specs novos cobrindo `previewModelo()` + 4 specs novos cobrindo `etapaAtual`/`etapaProxima` no `simular()`
- 1 falha catalogada (conflito numeração D-novo-Q — Decisão 14 violada) + correção retroativa
- 1 débito antigo finalmente catalogado formalmente (D-novo-Q Contatos Teste persistentes — antes só em memória)

## Contexto de entrada

Sessão começou continuando a investigação da sessão anterior (`f0a5673` SimuladorCelular cooperativaId fix). Luciano havia reportado print mostrando:
- `cooperativaId: cmn0ho8bx0000uox8wu96u6fd` enviado corretamente
- `estadoInicial: INICIAL`
- Resposta backend: `transicionou=false`, `motivoFallback="Nenhum gatilho da etapa atual bateu"`
- 3 etapas INICIAL no banco: "Entrada Dinâmica" (tenant, ativa, 3 gatilhos), "Receber fatura" (global, ativa, 0 gatilhos), "Boas-vindas" (inativa)

Code iniciou investigação read-only do `buscarEtapa()` com hipótese: motor não estaria priorizando tenant sobre global.

## Achado: bug P1 em produção (D-novo-R)

`buscarEtapa()` em `backend/src/whatsapp/whatsapp-fluxo-motor.service.ts` usava:

```ts
const where = { estado, ativo: true };
if (cooperativaId) {
  where.OR = [{ cooperativaId }, { cooperativaId: null }];
}
const etapa = await prisma.fluxoEtapa.findFirst({
  where, orderBy: { ordem: 'asc' },
});
```

**Problema:** Quando havia etapa do tenant E etapa global ativas pro mesmo `estado`, o motor escolhia a global se ela tivesse `ordem` menor (1 < 28). Assumia que ordem numérica resolveria prioridade — não resolve, ordem é controlada por usuário na UI.

**Impacto em produção:** "Receber fatura" (global, ordem 1, **0 gatilhos**) sempre vencia "Entrada Dinâmica" (tenant CoopereBR, ordem 28, **3 gatilhos**). Cooperado real escrevendo qualquer coisa caía em fallback hardcoded sempre — **nunca usou a personalização criada via UI do parceiro desde a implementação do motor dinâmico.**

**Bug silencioso** (sem erro), só visível observando que personalizações não funcionavam.

## Fix aplicado (commit a0e0f06)

Refator pra 2 queries explícitas:

```ts
// 1. Tenant primeiro (filtro exato)
if (cooperativaId) {
  const etapaTenant = await prisma.fluxoEtapa.findFirst({
    where: { estado, ativo: true, cooperativaId },
    orderBy: { ordem: 'asc' },
  });
  if (etapaTenant) return etapaTenant;
}
// 2. Fallback global
const etapaGlobal = await prisma.fluxoEtapa.findFirst({
  where: { estado, ativo: true, cooperativaId: null },
  orderBy: { ordem: 'asc' },
});
return etapaGlobal;
```

Tenant SEMPRE vence se existir, independente de ordem. Semântica explícita no código.

**Validação programática** (smoke `backend/scripts/smoke-d-novo-r-buscar-etapa.ts`):
- Lógica antiga escolhia "Receber fatura" ❌
- Lógica nova escolhe "Entrada Dinâmica" ✅
- Confirma divergência entre lógicas com dados reais do CoopereBR

**Cobertura:** 30/30 specs verdes em `whatsapp-fluxo-motor.service.spec.ts` (era 27 antes):
- 1 spec novo `REGRESSION D-novo-Q [posterior R]: tenant com ordem alta vence global com ordem baixa`
- 1 spec novo `Quando tenant NAO tem etapa para o estado, fallback global ativa`
- 2 specs antigos refeitos pra refletir 2 queries em vez de OR

## Falha minha: conflito de numeração D-novo-Q (Decisão 14)

Catalogei o fix inicialmente como **D-novo-Q** no commit `a0e0f06` e nos débitos. Luciano apontou: o código **D-novo-Q estava reservado desde 19/05 tarde** pra "Contatos Teste persistentes" (memória `debito_d_novo_q_contatos_teste_persistentes_19_05.md`).

**Causa:** violei a Decisão 14 (validação prévia antes de propor numeração). Não fiz grep amplo (`grep -rn "D-novo-Q\|D-novo-R" docs/ memory/`) antes de catalogar.

**Correção (commit deste fechamento):**
- Renomeado a entrada nos `docs/debitos-tecnicos.md` de D-novo-Q → D-novo-R com **nota explicativa do conflito no topo**
- Catalogado formalmente o D-novo-Q ORIGINAL (Contatos Teste) na sequência — antes só estava em memória
- Renomeado script `backend/scripts/smoke-d-novo-q-buscar-etapa.ts` → `smoke-d-novo-r-buscar-etapa.ts`
- Commit `a0e0f06` permanece com referência antiga D-novo-Q na mensagem; pra rastreabilidade futura, trate-o como D-novo-R

**Lição reforçada:** próxima vez catalogar débito novo, rodar `grep -rn "D-novo-X" docs/ memory/` com X = letra alvo ANTES de escrever na entrada. Decisão 14 vale também pra numeração de débitos, não só de sprints.

## Fases UX do simulador (commits b0a92c8 + 483fb2b)

Após o fix do motor, Luciano levantou pergunta UX importante: "como eu, usuário admin, saberei qual o fluxo que está sendo testado?" Mais a sugestão de ter um botão de teste em cada etapa/mensagem.

Mapeei 3 melhorias incrementais. Luciano escolheu fazer todas (A + B + C).

### Fase A — Painel mostra etapa em uso (commit b0a92c8)

**Backend (whatsapp-fluxo-motor.service):**
- `SimulacaoOutput` ganhou campos `etapaAtual` e `etapaProxima` (`SimulacaoEtapaResumo`)
- Resumo expõe `id`, `nome`, `estado`, `escopo: 'TENANT' | 'GLOBAL'`, `modeloMensagemId`, `acaoAutomatica` — sem vazar `cooperativaId` pro cliente
- Função privada `resumoEtapa()` reúsa lógica em ambos casos (sucesso e fallback)

**Frontend (SimuladorCelular):**
- Tipo `RespostaSimular` alinhado com backend
- Painel "Estado atual" agora mostra: nome da etapa em uso + badge **"do parceiro"** ou **"global"**
- Quando transiciona, mostra também "Transicionou para: <próxima etapa>"
- Subtítulo do PhoneFrame agora inclui nome da etapa em vez de só estado

**Bugs latentes corrigidos durante Fase A:**
1. **Mismatch tipo bolha:** frontend esperava `mensagensEnviadas[].conteudo`, backend retornava `texto`. Resultado: bolhas do bot apareciam `undefined` após transição. Corrigido alinhando o tipo.
2. **useEffect inicial chamava `simular('início')` como gambiarra:** motor avaliava gatilho "INICIO", nunca casava, sempre caía em "Nenhum gatilho bateu" → bolha amarela confusa logo na abertura. Substituído por bolha sistema explicativa + ping ao backend só pra popular `etapaAtual` no painel sem somar resposta confusa ao histórico.

### Fase B — Botão ▶ Testar em cada etapa (commit b0a92c8)

**Frontend (web/app/dashboard/whatsapp-config/page.tsx):**
- Novo state `estadoInicialSim: string | null`
- Botão geral "Testar fluxo" passa `null` (abre simulador no INICIAL)
- **Botão novo Play (verde)** em cada linha de etapa ativa: clica e abre simulador com `estadoInicial = etapa.estado`. Permite testar etapas no meio do fluxo (MENU_COOPERADO, AGUARDANDO_OCR, etc.) sem percorrer todo o caminho do INICIAL.
- `disabled` em etapas inativas (não adianta testar etapa desligada)
- Adicionado `title="..."` nos demais botões de ação (chevron up/down, edit, delete) que estavam sem tooltip

### Fase C — Botão ▶ Pré-visualizar em modelos de mensagem (commit 483fb2b)

**Backend (`WhatsappFluxoMotorService.previewModelo()`):**
- Novo método: recebe `modeloId + cooperativaId`, retorna template renderizado com variáveis do tenant (parceiro, cidade, tipo_membro da Fase 2/6) sem disparar fluxo
- Respeita escopo tenant: query usa `OR [{cooperativaId: tenant}, {cooperativaId: null}]` — usuário nunca vê modelo de outro tenant
- Zero side effects: não incrementa `usosCount`, não persiste, não envia WA
- Reaproveita `renderizarTemplate()` + `extrairVariaveis()` + `carregarContextoCooperativa()` já existentes

**Novos tipos públicos:**
- `PreviewModeloInput { modeloId, cooperativaId?, dadosTemp? }`
- `PreviewModeloOutput { encontrado, modeloId, modeloNome, categoria, texto, variaveisUsadas, escopo: 'TENANT' | 'GLOBAL' | null }`

**Endpoint `POST /whatsapp/preview-modelo`:**
- Mesmo gate de auth do `/whatsapp/simular` (ADMIN/SUPER_ADMIN)
- Mesma `resolverEscopo()` — ADMIN forçado ao próprio tenant, SUPER_ADMIN pode passar `cooperativaId` arbitrário

**Frontend componente novo `web/components/whatsapp-config/PreviewModelo.tsx` (~180 linhas):**
- Dialog focado: PhoneFrame com a mensagem renderizada como o cooperado veria + painel lateral com nome, categoria, escopo
- Card secundário lista as variáveis efetivamente substituídas (só as com valor não-vazio)
- Loading/erro tratados explicitamente
- Não recebe input do usuário — diferente do SimuladorCelular (interativo)

**AbaMensagens (page.tsx):**
- Novo state `previewId: string | null`
- **Botão Play (verde)** entre Eye (toggle ativo) e Send (teste real WA) com title "Pré-visualizar mensagem (in-memory, zero side effect)"
- Title do botão Send esclarecido: "Enviar teste real para WhatsApp" (diferencia do Play que é in-memory)

## Validação de saída

**Backend specs:** 39/39 verdes em `whatsapp-fluxo-motor.service.spec.ts` (era 27 no início da sessão):
- +4 specs Fase A cobrindo `etapaAtual`/`etapaProxima`/escopo TENANT vs GLOBAL/null
- +5 specs Fase C cobrindo `previewModelo()`: não encontrado, TENANT, GLOBAL, isolamento OR, zero side effects
- +2 specs D-novo-R cobrindo regressão tenant vs global

**Build:**
- Backend (`nest build`): limpo em todas as 3 rebuildas
- Frontend (`tsc --noEmit`): limpo em todas as 2 verificações
- PM2 restartado 3x sem erros (pids 36116 → 36284 → 32632)
- Endpoint `POST /whatsapp/preview-modelo` confirmado nos logs do RouterExplorer

**Console.log debug:** removidos do `SimuladorCelular.tsx` antes do commit final (regra `coding-style.md` typescript — sem console.log em produção).

## Decisões / Regras / Memórias

**Não alteradas nesta sessão.** Apenas reforçada Decisão 14 (validação prévia inclui numeração de débitos).

## Pendências carry-over pra próxima sessão

**Imediatas (Luciano valida no navegador amanhã):**
1. Confirmar visualmente no `/dashboard/whatsapp-config` que:
   - Painel mostra "Etapa em uso: Entrada Dinâmica [do parceiro]" ✅ (já confirmado pelo print Luciano enviou)
   - Botão ▶ em cada etapa abre simulador no estado certo
   - Botão ▶ em cada modelo abre preview com mensagem renderizada
2. Confirmar que **"ola" no simulador NÃO casa com gatilho** é comportamento esperado (motor só aceita gatilhos literais ou wildcard `*`). UX pra melhorar isso ficou catalogada como nota implícita pra próxima sessão.

**Catalogadas:**
- **D-novo-Q (Contatos Teste persistentes):** 6-8h Code aprovado, escopo completo no memória + débitos. Slot sugerido: Sprint Housekeeping ou pré-Sinergia.
- **Melhorias UX simulador (sub-débito):**
  - Bolha inicial mostrar mensagem renderizada da etapa atual (hoje só tem instrução genérica)
  - Painel listar gatilhos esperados da etapa atual ("Esperando: `1`, `2`, `3`")
  - Botões de atalho clicáveis embaixo do input — clica e dispara o gatilho
  - Estimativa: ~30-45 min Code

**Próximo marco prioritário (carry-over de 18/05):**
- **M15 — Sprint 5a Neutro Fio B** (3-5 dias Code dedicado). Spec base `docs/specs/PROPOSTA-GD1-GD2-FIOB-2026-03-26.md`.

## Commits da sessão (cronológico)

| Commit | Escopo |
|---|---|
| `a0e0f06` | fix(wa): buscarEtapa() prioriza tenant sobre global (D-novo-Q → renomeado pra D-novo-R em 19/05 noite) |
| `b0a92c8` | feat(wa): simulador mostra etapa em uso + botão Testar em cada etapa (Fase A+B) |
| `483fb2b` | feat(wa): botão Pré-visualizar em modelo de mensagem (Fase C) |
| (este commit) | docs(sessao+debitos+controle): fechamento 19/05 noite + correção numeração D-novo-Q → D-novo-R + cataloga D-novo-Q original |

## Arquivos tocados (cumulativo)

**Backend:**
- `backend/src/whatsapp/whatsapp-fluxo-motor.service.ts` — fix buscarEtapa + simular() expõe etapaAtual/etapaProxima + previewModelo() novo
- `backend/src/whatsapp/whatsapp-fluxo-motor.service.spec.ts` — 39 specs (era 27)
- `backend/src/whatsapp/whatsapp-simulacao.controller.ts` — endpoint POST /whatsapp/preview-modelo
- `backend/scripts/smoke-d-novo-r-buscar-etapa.ts` — novo (renomeado de smoke-d-novo-q)

**Frontend:**
- `web/components/whatsapp-config/SimuladorCelular.tsx` — Fase A (painel etapaAtual) + correção mismatch bolhas
- `web/components/whatsapp-config/PreviewModelo.tsx` — novo (Fase C)
- `web/app/dashboard/whatsapp-config/page.tsx` — botões ▶ em etapas (Fase B) + em modelos (Fase C)

**Docs:**
- `docs/debitos-tecnicos.md` — D-novo-R catalogado RESOLVIDO + D-novo-Q (contatos teste) catalogado pendente
- `docs/CONTROLE-EXECUCAO.md` — atualização ONDE PARAMOS + frase comandante nova
- `docs/sessoes/2026-05-19-noite-d-novo-r-fix-motor-e-simulador-uxabc.md` — este arquivo
