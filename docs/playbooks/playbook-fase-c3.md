# Playbook Fase C.3 — Display economia em proposta + contrato + cobrança

**Versão:** 1.0 · **Data origem:** 11/05/2026 (sessão claude.ai)
**Estimativa:** 1.5-2h Code
**Pré-requisito:** Fase C.2 reduzida concluída (ou em sessão imediatamente anterior).

## 0. O que C.3 entrega

Os 4 valores de economia projetada (`valorEconomiaMes`,
`valorEconomiaAno`, `valorEconomia5anos`, `valorEconomia15anos`) hoje
só aparecem em componentes internos (PlanoSimulacao.tsx,
CombinacaoAtual.tsx, helper simular-plano.ts e spec). C.3 leva esses
4 valores pras 3 telas onde o operador vê o resultado real:
proposta, contrato e cobrança.

## 1. Estado atual confirmado

| Tela alvo | Caminho | Tem economia hoje? | Fonte dos dados |
|---|---|---|---|
| Proposta cooperado-facing | web/app/aprovar-proposta/page.tsx | Parcial — só economiaMensal + economiaAnual (2 de 4) | Endpoint motor-proposta/proposta-por-token/:token |
| Contrato admin | web/app/dashboard/contratos/[id]/page.tsx | Zero | Endpoint /contratos/:id |
| Cobrança admin | web/app/dashboard/cobrancas/[id]/page.tsx | Zero | Endpoint /cobrancas/:id |
| Modelo no schema | backend/prisma/schema.prisma:565-568 | Os 4 campos vivem em Cobranca | Snapshot na geração |

## 2. Decisões do playbook (já fechadas)

- D-P-1: Audiência = 3 telas admin/cooperado existentes (sem criar nova)
- D-P-2: Fonte = recalcular via simular-plano.ts (não snapshot novo)
- D-P-3: Posicionamento = card dedicado ao final
- D-P-4: Toggle = sempre visível
- D-P-5: Formatação = copiar de PlanoSimulacao.tsx
- D-P-6: aprovar-proposta = estender backend com 2 valores extras +
         trocar bloco frontend pelo card de 4 linhas

## 3. Formatação canônica

```
+- Card verde (border-green-100, header bg-green-50/50) -+
|  Economia projetada                                     |
+---------------------------------------------------------+
|  Economia mensal:        R$ XXX,XX  (verde, bold)       |
|  --                                                      |
|  Projeção de economia (sem inflação):                   |
|  1 ano:                  R$ X.XXX,XX                    |
|  5 anos:                 R$ XX.XXX,XX                   |
|  15 anos:                R$ XXX.XXX,XX  (bold, verde)   |
|  --                                                      |
|  Cálculo sem inflação ou reajuste de tarifa             |
+---------------------------------------------------------+
```

## 4. Sequência de implementação

### Passo 1 - Componente reusável <EconomiaProjetada> (30 min)
- Arquivo: web/components/EconomiaProjetada.tsx
- Props: valorEconomiaMes/Ano/5anos/15anos (number | null cada)
- Reusa formatBRL (extrair pra web/lib/format.ts se não existir)

### Passo 2 - Cobrança admin (15 min)
- web/app/dashboard/cobrancas/[id]/page.tsx
- Adicionar 4 campos no type Cobranca (já existem no schema)
- Renderizar <EconomiaProjetada> ao final da seção
- Cobrança legada com null: mostra "—"

### Passo 3 - Contrato admin (20 min)
- web/app/dashboard/contratos/[id]/page.tsx
- Recalcular via simular-plano.ts lendo
  contrato.kwhContratoAnual + plano + contrato.valorCheioKwhAceite
- Contrato pré-Fase B.5 sem valorCheioKwhAceite: mostra "—" + aviso

### Passo 4 - Proposta cooperado-facing (40 min)
- Backend: estender motor-proposta/proposta-por-token/:token com
  economia5Anos + economia15Anos (recalcular via Motor)
- Frontend: web/app/aprovar-proposta/page.tsx — atualizar interface
  PropostaData + trocar bloco atual pelo <EconomiaProjetada>

### Passo 5 - Specs + commit (15 min)
- Spec do <EconomiaProjetada> (renderização + formatação + null)
- 1 commit: feat(c3): display economia projetada em cobranca + contrato + proposta

## 5. Critério de aceite

- Componente <EconomiaProjetada> existe e tem spec
- Cobrança Fase B.5 mostra 4 valores corretos
- Contrato ATIVO COMPENSADOS mostra 4 valores via recálculo
- Proposta cooperado-facing mostra 4 valores
- Fallback "—" funciona pra legados
- 1 commit + push

## 6. NÃO entra nesta C.3 (catalogar como sugestão futura)

- Portal cooperado (/portal/financeiro, /portal/conta)
- Snapshot dos 4 valores em Proposta/Contrato no schema
- Histórico/gráfico de economia ao longo do tempo

## 7. Frase de retomada

> Voltei. Lê docs/playbooks/playbook-fase-c3.md +
> docs/CONTROLE-EXECUCAO.md. Vou executar Fase C.3 conforme
> 6 decisões já fechadas no playbook (D-P-1..D-P-6).
