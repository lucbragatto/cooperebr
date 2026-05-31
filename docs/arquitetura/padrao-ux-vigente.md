# Padrão UX Vigente — SISGD/CoopereBR

> **Decisão Luciano 31/05/2026 noite.** Documento vivo — fonte única de verdade pra padrão UX.
> Substitui parcialmente `padrao_ux_edicao_inline_vs_pagina_propria_17_05.md` (Dialog Tipo C agora está **banido**).

## Princípio

**Luciano não programa.** Precisa fluir naturalmente pela aplicação sem janelinhas obstruindo o contexto. Comparar dados lado-a-lado é vital. Cada vez que uma modal ou drawer aparece, Luciano perde a referência visual do que vinha analisando.

A partir de 31/05/2026, telinhas (Dialog modal + Sheet/drawer) estão **proibidas** em código novo. Telas existentes que usam serão refatoradas progressivamente via Sprint Polimento UX.

## Padrão por cenário

| Cenário | Padrão CORRETO | Padrão BANIDO | Razão |
|---|---|---|---|
| **Criar/editar entidade** (Convênio, Plano, Membro, Usina, Contrato...) | **Página própria** `/dashboard/X/[id]/editar` (ou `/novo`) | Dialog modal, Sheet, Drawer | URL distinta evita confusão (caso Cooperebr2 duplicada). Histórico do browser navega. Refresh preserva. |
| **Ação contextual** (Fechar Apuração, Estornar, Aprovar, Marcar Pago, Cancelar) | **`<AcaoInlineExpansivel>`** — linha expande revelando confirmação/form inline | Dialog Tipo C | Mantém o contexto visual; usuário vê os dados que está agindo sobre |
| **Visualização auxiliar** (Ciclo contábil de um repasse, Histórico de um membro, Detalhes de um lançamento) | **`<AcaoInlineExpansivel>`** OU seção da página própria | Dialog | Compara várias linhas sem fechar/abrir |
| **Edição célula relação** (Membro×Usina kWh, Contrato×Plano %) | **Inline célula** (hover lápis → Enter/blur salva, otimistic UI) | (sem padrão banido aqui) | Excel/Notion-like, atômico, recálculo em tempo real |
| **Wizard multi-step** (cadastro inicial) | **Página própria com steps internos** (ex: `/dashboard/cooperados/novo` já funciona assim) | Dialog wizardizado | URL persiste step (?step=3) |

## Componentes-base (a criar — Sprint Polimento UX PUX.1)

Localização: `web/components/ui/`

### `<HelpBox>`

Banner help padronizado (azul claro + ícone + título + lista de bullets + dica opcional). Substitui as N implementações ad-hoc espalhadas pelas telas.

**Aplica:** regra `regra_help_automatico_paginas_19_05.md` — toda página/funcionalidade nova DEVE ter help inline contextual.

```tsx
<HelpBox
  titulo="Como funciona a apuração segregada"
  passos={[
    "Ato próprio (Art. 79): isento de IRPJ/CSLL e PIS/COFINS",
    "Ato auxiliar (Art. 88): convênios — fluxo entrada=saída neutro",
    "Ato não-coop (Art. 86): terceiros, tributado Lucro Presumido",
    "Fundos (Art. 28): FR 10% + FATES 5% sobre sobras",
  ]}
  dicaOpcional="Gate Walter: números calculados pelo motor não viram fiscal real até o contador validar."
  variante="info" // 'info' | 'warning'
/>
```

### `<AcaoInlineExpansivel>`

Botão que, ao clicar, expande a linha (ou cell) revelando o conteúdo do form/confirmação **inline**. Sem overlay. Click fora colapsa. Loading state interno. Substitui `Dialog Tipo C`.

```tsx
<AcaoInlineExpansivel
  textoBotao="Estornar"
  cor="amber" // amber | red | green | cyan
  icone={<RotateCcw className="h-3 w-3" />}
  titulo="Estornar repasse PAGO"
  onConfirm={async () => { await api.put(...); recarregar(); }}
  onCancel={() => {}}
>
  <p className="text-xs text-amber-800">O que acontece...</p>
  <Textarea name="motivo" required minLength={10} />
</AcaoInlineExpansivel>
```

## Lint UX (a criar — Sprint Polimento UX PUX.6)

Modelo igual ao `lint:tenant` (baseline+ratchet):

- `scripts/lint-ux.ts` percorre `web/app/**/*.tsx` + `web/components/**/*.tsx`
- Detecta: telas que importam `Dialog`/`Sheet`/`Drawer`
- Baseline: telas legadas vão pra `allowlist-ux.json`
- Ratchet: código novo é proibido de usar Dialog (falha CI)
- Helper `npm run lint:ux`
- Relatório `docs/relatorios/ux-coverage-DATA.md` com % de telas com `<HelpBox>` + % sem Dialog

## Telas atualmente fora do padrão (refator PUX)

Catalogadas em `docs/debitos-tecnicos.md` seção `D-novo-PUX`:

| Tela | O que tem | Refator | Fatia PUX |
|---|---|---|---|
| `dashboard/contabilidade/convenios` | Dialog Novo + Dialog Remover | Página própria `/novo` + `/[id]/editar` + AcaoInlineExpansivel | PUX.2 |
| `dashboard/contabilidade/apuracao` | Dialog Tipo C "Fechar" | AcaoInlineExpansivel | PUX.2 |
| `components/repasses/DialogEstornar` | Dialog Tipo C | AcaoInlineExpansivel (vira `EstornoInline.tsx`) | PUX.4 |
| `components/repasses/DialogCiclo` | Dialog visualização | Expansão da linha do repasse PAGO | PUX.4 |
| `components/repasses/DialogMarcarPago` | Dialog Tipo C | AcaoInlineExpansivel | PUX.5 |
| `components/repasses/DialogCancelar` | Dialog Tipo C | AcaoInlineExpansivel | PUX.5 |
| Telas de despesas (aprovar/rejeitar/resolver) | Dialog Tipo C | AcaoInlineExpansivel | PUX.5 |
| `dashboard/contabilidade/plano-contas` | Sem help inline | HelpBox | PUX.3 |
| `dashboard/contabilidade/convenios` | Help não-padronizado | HelpBox padronizado | PUX.3 |
| `dashboard/repasses` + `dashboard/usinas/[id]/repasses` | Sem help | HelpBox | PUX.3 |
| Demais (inventário PUX.6) | ? | ? | PUX.6 |

## Histórico de decisões UX

| Data | Decisão | Status |
|---|---|---|
| 2026-05-17 | Padrão Dual: Tipo A (inline célula) + Tipo B (página própria) + Tipo C (Dialog focado) | **Revisada 31/05** — Tipo C banido |
| 2026-05-19 | Help inline obrigatório em toda página/funcionalidade nova (regra UX) | ✅ Mantida — PUX.3 audita |
| 2026-05-19 | Select nativo dentro de Dialog (z-index Shadcn quebra) | ✅ Mantida — vai ser usada nas telas legadas até PUX.2 refatorar |
| 2026-05-31 | **Dialog modal + Sheet/drawer banidos em código novo. Criar/editar = página própria. Ação = AcaoInlineExpansivel** | ✅ **VIGENTE** |

## Por que mudou em 31/05

Sprint CT.6 entregou 4 telas usando Dialog Tipo C (Convênio criar/remover, Apuração Fechar, Estorno repasse, Ciclo repasse). No smoke do Luciano:

> "Cada vez que abre o dialog perco o contexto da linha que eu vinha olhando. Pra Estorno eu PRECISO ver o ciclo do repasse aberto AO LADO dos outros repasses pra comparar antes de confirmar. Modal interrompe tudo. Não programo — pra mim isso é confuso."

Luciano definiu que a partir de 31/05 nenhum código novo usa Dialog modal ou drawer. Telas legadas vão sendo refatoradas progressivamente (Sprint Polimento UX, ~25-37h).

## Quando esta doc muda

Sempre que uma nova decisão UX for tomada — registrar aqui ANTES de aplicar no código. Decisões UX importantes também viram memória persistente em `~/.claude/projects/C--Users-Luciano-cooperebr/memory/`.

## Como esta doc é usada

- **Code:** referência obrigatória antes de criar UI nova
- **claude.ai:** referência ao propor sprint que toque UX
- **PUX.6 lint:ux:** força no CI (não merge se código novo usa Dialog)
- **QA Luciano:** auditoria visual confere se telas seguem este padrão
