# Sessão 03/05/2026 — Resumo completo (4 fases concluídas)

## 1. Sumário executivo

Sessão maratona de Code (~10-12h, 4 fases: A + B + B.5 + C.1) que **destravou completamente o subsistema de Cobrança** do SISGD. **D-30R resolvido**, **duplo desconto eliminado**, **DINAMICO implementado** e **multi-tenant em Planos fechado**. Validação matemática **48/48** (6 cenários × 8 valores de centavo). 19 commits + 1 commit de investigação inicial = 20 commits totais. Backend produção continua isolado (`BLOQUEIO_MODELOS_NAO_FIXO=true` aguardando canário).

## 2. Linha do tempo

```
07h00  Investigação read-only engine COMPENSADOS (gate crítico D-30R)
       Commit 4caebe9 — relatório técnico 617 linhas
       Decisão B33 RESOLVIDA por Luciano (semântica pós-desconto)

08h00  Fase A — Multi-tenant em Planos
       4 commits (69e2d6c, 5f70ce2, 7722ce3, 78d2d7b)
       4 bugs cross-tenant + lacuna B13 + UI escopo

11h00  Fase B — Engine + snapshots + DINAMICO + validações DTO
       6 commits (eb7f0ce, 070c1ab, f5453b7, 00f64df, 4c8e946, 1319140)
       Helper canônico + 5 caminhos populando snapshot
       Engine COMPENSADOS limpa + DINAMICO implementado
       Decisão B33.5 (não resetar 72 contratos legados)

15h00  Fase B.5 — Validação E2E + economia projetada
       4 commits (a4ebf90, b0e0345, 718ca46, 840b10f)
       Schema delta (valorCheioKwhAceite + 4 campos economia)
       Seed cooperativa teste isolada (CNPJ fake) → 6 cenários verde
       Decisões B34 + B35 cristalizadas

18h00  Fase C.1 — UI plano + simulação tempo real
       5 commits (8ffeb69, cdb1eda, eb82c0a, e0c1e7a, c550ff3)
       Helper frontend simular-plano (paridade backend)
       Componentes <PlanoSimulacao> + <CombinacaoAtual>
       Campos condicionais por modelo
```

## 3. Decisões processuais novas

### B33 — Semântica de `tarifaContratual` (Luciano, manhã 03/05)

`tarifaContratual` é **pós-desconto** (valor R$/kWh que o cooperado paga). Engine consumidora **NÃO aplica desconto novamente**. Toda fatura grava 2 snapshots: `valorCheioKwh` + `tarifaSemImpostos`. Plano respeita `baseCalculo` (KWH_CHEIO vs SEM_TRIBUTO).

### B33.5 — Não resetar 72 contratos legados (Luciano, tarde 03/05)

Forward-only confirmado:
- 31 cobranças PAGAS Sandbox Sprint 12 são histórico de validação E2E real
- `BLOQUEIO_MODELOS_NAO_FIXO=true` impede dano teórico
- Validação dos 3 modelos virá em Fase B.5 com cooperados teste novos (não com legados)

### B34 — FIXO lê fatura no aceite (Luciano, noite 03/05)

FIXO_MENSAL grava `valorCheioKwhAceite` no Contrato no momento do aceite. Cobrança mensal **não usa fatura mensal** — cobra `valorContrato` travado. Mas `valorBruto` retroativo é calculado via `kwhContratoMensal × valorCheioKwhAceite` (resolve Sprint 7 #4 — economia FIXO zerada).

### B35 — Economia projetada uniforme nos 3 modelos (Luciano, noite 03/05)

Toda Cobrança gerada (FIXO/COMPENSADOS/DINAMICO) grava 4 valores de economia:
- `valorEconomiaMes` = `valorBruto - valorLiquido`
- `valorEconomiaAno` = mês × 12
- `valorEconomia5anos` = mês × 60
- `valorEconomia15anos` = mês × 180

Cálculo simples (sem IPCA). Frontend exibe pra cooperado em proposta + contrato + cobrança.

## 4. Bugs resolvidos

| Bug | Origem | Resolvido em | Commits |
|---|---|---|---|
| **D-30R** — `Motor.aceitar` não popula `tarifaContratual` | Sessão 30/04 | Fase B | `eb7f0ce`, `070c1ab` |
| **Duplo desconto na engine COMPENSADOS** (linha :1862) | Investigação 03/05 | Fase B | `f5453b7` |
| **DINAMICO `NotImplementedException`** | Spec original Sprint 5 | Fase B | `f5453b7` |
| **Snapshots T3/T4 nunca gravados** (5 caminhos de criação) | Investigação 03/05 | Fase B | `070c1ab` |
| **Bugs cross-tenant em `/planos/`** (4 buracos: findAll, findOne, create, remove) | Relatório Code 02/05 item 1.6 | Fase A | `69e2d6c` |
| **B13 — Seed `CREDITOS_COMPENSADOS` em ambiente bloqueado** | Sessão 02/05 lacunas Área 1 | Fase A | `69e2d6c` |
| **FIXO retornava `valorBruto = valorContrato + valorDesconto = 0`** (Sprint 7 #4) | Spec original Sprint 5 | Fase B.5 | `b0e0345` |
| **Spec T8 com `// isola o efeito da tarifa`** (blindando bug duplo desconto) | Investigação 03/05 | Fase B | `4c8e946` |

## 5. Lacunas identificadas durante a sessão

| Lacuna | Severidade | Descrição |
|---|---|---|
| **3 specs DI pré-existentes falhando** | P3 | `cooperados.controller.spec.ts`, `cooperados.service.spec.ts`, `usinas.controller.spec.ts` falham com erro DI. Confirmado pré-existente via `git stash`. Não relacionado às mudanças da sessão. |
| **Snapshots na atribuição tardia de plano** (caso usinas.service.ts:306) | P3 | Promoção da lista de espera cria contrato sem plano. Snapshot deve ser populado quando admin atribui plano via UI. Função `atribuirPlanoAoContrato()` ainda não existe. |
| **Whitelist `/cadastro` no interceptor `web/lib/api.ts`** | P3 | Observação latente da Fase A. Se algum dia alguém usar `api.get('/planos')` em rota pública, visitante anônimo seria redirecionado pra `/login`. Hoje não acontece (cadastro usa `fetch` direto). |
| **Backfill 72 contratos legados** | P2 | `tarifaContratual=null` em todos. Necessário se Luciano quiser ativar COMPENSADOS num cooperado existente sem recriar contrato. |

## 6. Estado real do sistema

### Antes da sessão (manhã 03/05)

- 72 contratos com `tarifaContratual=null` (100%)
- Engine COMPENSADOS com **duplo desconto** matemático
- DINAMICO inexistente (`NotImplementedException`)
- Multi-tenant Planos com 4 buracos (`findAll`/`findOne`/`create`/`remove` sem filtro)
- Seed `Plano Básico` com modelo bloqueado
- FIXO grava `valorDesconto=0` em toda cobrança (dashboards de economia zerados)
- 0 cobranças no banco com `modeloCobrancaUsado` preenchido

### Depois da sessão (noite 03/05)

- Helper canônico `calcularTarifaContratual` único em 5 caminhos de criação de contrato + engine DINAMICO
- Engine COMPENSADOS **sem** duplo desconto (`valorLiquido = kwhCompensado × tarifaContratual` direto)
- Engine DINAMICO **implementada** (recalcula tarifa do mês via fatura aprovada + helper)
- Multi-tenant Planos completo (SUPER_ADMIN/ADMIN/OPERADOR + DTO + UI condicional)
- Seed cria `Plano Básico FIXO_MENSAL` (modelo único ativo)
- FIXO grava `valorBruto` retroativo via `valorCheioKwhAceite` + 4 valores de economia
- 6 cobranças teste (Fase B.5) com `modeloCobrancaUsado` preenchido + 8 valores cada batem com tabela canônica
- UI `/dashboard/planos/novo` com painel de simulação em tempo real + paridade matemática backend (6 cenários ✓)

## 7. O que FUNCIONA agora que não funcionava antes

1. **3 modelos de cobrança matematicamente validados** (48/48 valores). Cooperado vê tarifa correta + economia honesta.
2. **Engine COMPENSADOS sem duplo desconto** — cooperado paga exatamente o snapshot pós-desconto, não 20% a mais.
3. **Engine DINAMICO implementada** — recalcula tarifa do mês usando fatura aprovada (paridade total com FIXO/COMPENSADOS no helper).
4. **Helper canônico** `calcularTarifaContratual` é a única fonte de verdade. Backend e frontend usam o mesmo cálculo (verificado por spec ts-node 6 cenários ✓).
5. **Multi-tenant em Planos fechado** — ADMIN não vê/edita/deleta plano de outro parceiro. SUPER_ADMIN tem governança total via UI.
6. **4 valores de economia projetada** uniformes nos 3 modelos. Schema delta pronto pra exibir em proposta + contrato + cobrança.
7. **UI de criação de plano** com simulação em tempo real, campos condicionais por modelo (FIXO mostra kWh, DINAMICO esconde Referência), avisos V4 inline pra combinações estranhas.
8. **Validações DTO V1-V4** (promo coerente, promo > base, CUSTOM exige componentes, warnings não-bloqueantes).
9. **20 specs Jest Fase A + 15 helper Fase B + 72 affected Fase B** = **107 specs verde** relacionados ao subsistema de Planos/Cobrança.

## 8. O que AINDA NÃO funciona (atenção pra retomada)

1. **`BLOQUEIO_MODELOS_NAO_FIXO=true` ainda ativo** nos 7 enforcement points. **Correto** — não desativar antes de canário.
2. **Tela de plano sem campos avançados** — promoção/vigência/CooperToken expandido/lista enriquecida/confirmação. **Fase C.2.**
3. **Cooperado não vê economia projetada** — proposta, contrato e cobrança ainda sem o display dos 4 valores. **Fase C.3.**
4. **72 contratos legados sem snapshot** — `tarifaContratual=null`. Funcional mantido via flag (forward-only). Backfill é opcional, vira necessário se canário escolher cooperado legado.
5. **3 specs pré-existentes** (`cooperados.controller.spec.ts`, `cooperados.service.spec.ts`, `usinas.controller.spec.ts`) — falham com erro DI desde antes da sessão. Não impactam runtime.
6. **Atribuição tardia de plano** — `usinas.service.ts:306` cria contrato sem plano (caso especial #5). Quando admin atribuir plano depois, snapshot precisa ser populado. Função ainda não existe.

## 9. Aprendizados meta

- **Decisão 20 funcionou cirurgicamente** — gates impediram bugs reais em pelo menos 3 momentos:
  1. Gate D-30R parou tentativa de fix isolado (que teria ativado duplo desconto sem avisar)
  2. Gate 5 da Fase B.5 (reset 72 contratos) parou destrutivo desnecessário e preservou histórico Sprint 12
  3. Gates Fase C pegaram que telas portal/proposta/contrato não existem (escopo da tarefa redirecionado pra adaptar telas existentes)
- **Validação prévia exaustiva é barata** comparada ao custo de rolling back fix grande.
- **Forward-only é estratégia segura** quando há mecanismo de bloqueio em produção. 72 contratos legados intocados, sem perda de histórico, sem risco operacional.
- **Spec ts-node standalone funciona** quando frontend não tem Jest. Override `module=commonjs,moduleResolution=node` resolve conflito com tsconfig esnext do Next.

---

*Sessão fechada com aplicação do ritual Decisão 19 (3ª iteração do dia). Aguarda retomada 04/05 com Fase C.2 ou Fase C.3 conforme decisão Luciano.*
