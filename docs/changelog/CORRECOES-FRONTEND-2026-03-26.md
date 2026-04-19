# Correções Frontend QA — 2026-03-26

## BUG-001 (CRITICO) — Promise.all sem .catch no analytics do Clube de Vantagens
**Arquivo:** `web/app/dashboard/clube-vantagens/page.tsx`
**Correção:** Adicionado `.catch()` ao `Promise.all` com `setErro(...)` e renderização condicional de mensagem de erro ao usuário quando a API falha, em vez de exibir KPIs zerados silenciosamente.

## BUG-014 (CRITICO) — Formulário PIX com campo de UUID manual
**Arquivo:** `web/app/dashboard/financeiro/pix-excedente/page.tsx`
**Correção (sessão 1):** Adicionado `<select>` para tipo de chave PIX (CPF, CNPJ, E-mail, Telefone, Chave aleatória) com `placeholder` dinâmico e máscara básica para CPF/Telefone/CNPJ. Campo de chave desabilitado até selecionar o tipo.
**Correção (sessão 2):** Campos Cooperado ID e Condomínio ID (UUID manual) substituídos por componente `BuscaAutoComplete` com:
- Busca debounced (350ms) via API `/cooperados?search=...` e `/condominios?search=...`
- Dropdown com até 10 resultados, exibindo nome + CPF/endereço
- Seleção armazena o UUID internamente, mostra o nome para o operador
- Fecha ao clicar fora (click outside handler)

## BUG-020 (CRITICO) — AcoesLoteBar.tsx é código morto
**Arquivo:** `web/app/dashboard/cooperados/page.tsx`
**Correção:** Removida implementação inline `AcoesLote` (>130 linhas de código duplicado). Importado e utilizado o componente standalone `AcoesLoteBar` de `@/components/AcoesLoteBar`. Agora há uma única fonte da verdade.

## BUG-027 (ALTO) — Barra de progresso de nível sempre mostra ~99%
**Arquivo:** `web/app/portal/indicacoes/page.tsx`
**Correção:** Substituída fórmula incorreta `kwhAcumulado / (kwhAcumulado + 100)` por cálculo correto baseado nos limiares de cada nível: `(kwhAtual - kwhMinNivel) / (kwhMaxNivel - kwhMinNivel)`. Adicionadas constantes `NIVEL_KWH_MIN` e `NIVEL_KWH_MAX`.

## BUG-021 (ALTO) — Seleção em lote persiste ao trocar filtro
**Arquivo:** `web/app/dashboard/cooperados/page.tsx`
**Correção:** Adicionado `setSelecionados([])` em `handleBuscaChange()` e nos handlers de clique dos filtros por parceiro. Seleção é limpa ao mudar busca ou filtro.

## BUG-031 (MEDIO) — Bug de timezone na data de vencimento
**Arquivo:** `web/app/portal/financeiro/page.tsx`
**Correção:** Strings ISO date (`"2024-03-01"`) eram parseadas como UTC meia-noite, exibindo dia anterior em UTC-3. Adicionado `+ 'T12:00:00'` ao parse para garantir que a data exibida seja sempre correta independente do timezone do Brasil.

---

**Bônus aplicados durante as correções:**
- Adicionado tratamento de erro com mensagem ao usuário em `/portal/indicacoes` (relacionado BUG-026 — erros silenciados com `.catch(() => {})`)
