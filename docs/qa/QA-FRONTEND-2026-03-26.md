# QA Frontend Report — CoopereBR
**Data:** 2026-03-26  
**Auditor:** Agente QA (análise estática de código)  
**Escopo:** Fases 1, 2 e 3 — telas e componentes prioritários  

---

## Resumo Executivo

| Categoria       | CRITICO | ALTO | MEDIO | BAIXO | Total |
|----------------|---------|------|-------|-------|-------|
| Integração API  | 2       | 5    | 4     | 1     | 12    |
| UX / Fluxo      | 1       | 4    | 6     | 3     | 14    |
| Acessibilidade  | 0       | 2    | 3     | 2     | 7     |
| Código / Manutenção | 0  | 2    | 3     | 2     | 7     |
| **TOTAL**       | **3**   | **13** | **16** | **8** | **40** |

### Score Geral de UX: 5.8/10 ⚠️

As telas novas (Fase 2/3) entregam a funcionalidade core, mas apresentam padrões de erro silencioso que podem deixar operadores sem feedback quando algo falha. O problema mais grave é a **dupla implementação** do componente `AcoesLoteBar` — a versão isolada em `components/` nunca é usada. Os fluxos de PIX e condomínio carecem de confirmação antes de ações destrutivas ou financeiras irreversíveis.

---

## Seção 1 — /dashboard/clube-vantagens (Analytics)
**Arquivo:** `app/dashboard/clube-vantagens/page.tsx`

---

### BUG-001
**Severidade:** CRITICO  
**Descrição:** `Promise.all` não captura erros. Se qualquer uma das 3 chamadas à API falhar (analytics, mensal, funil), o bloco `.finally` é executado normalmente, `carregando` vira `false` e a tela renderiza com dados zerados/vazios sem nenhuma mensagem de erro. O operador vê KPIs todos zerados sem saber se há falha de rede/API.  
**Arquivo:** `app/dashboard/clube-vantagens/page.tsx` — bloco `useEffect` com `Promise.all`  
**Impacto:** Operador não percebe falha e pode tomar decisões baseadas em dados incorretos (todos como 0).

---

### BUG-002
**Severidade:** ALTO  
**Descrição:** Bug de override no processamento de `evolucaoData`. O código faz:
```ts
evolucao.map(e => ({ mes: e.mes.slice(5), ...e }))
```
O spread `...e` sobrescreve `mes` com o valor original (ex: `"2025-11"`), anulando o `slice(5)`. O eixo X do gráfico exibirá `"2025-11"` em vez de `"11"`, quebrando o layout e possivelmente truncando rótulos.  
**Arquivo:** `app/dashboard/clube-vantagens/page.tsx` — linha com `evolucaoData`  
**Impacto:** Gráfico "Promoções por Mês" com labels incorretos no eixo X.

---

### BUG-003
**Severidade:** MEDIO  
**Descrição:** Gráfico de pizza usa labels inline (`label={({ name, value }) => ...}`). Em telas menores ou com muitas categorias, os labels se sobrepõem, tornando o gráfico ilegível. Não há truncamento ou tooltip-only para mobile.  
**Arquivo:** `app/dashboard/clube-vantagens/page.tsx` — componente `<Pie>`  
**Impacto:** UX degradada em telas menores que 768px.

---

### BUG-004
**Severidade:** BAIXO  
**Descrição:** KPI "kWh Indicado Total" usa `.toFixed(0)` sem separador de milhar (`toLocaleString`). Valores como 1234567 aparecem como `"1234567"` em vez de `"1.234.567"`, prejudicando a leitura.  
**Arquivo:** `app/dashboard/clube-vantagens/page.tsx` — card kWh  
**Impacto:** Dificuldade de leitura para valores grandes.

---

## Seção 2 — /dashboard/clube-vantagens/ranking
**Arquivo:** `app/dashboard/clube-vantagens/ranking/page.tsx`

---

### BUG-005
**Severidade:** ALTO  
**Descrição:** Chamada à API sem tratamento de erro. `api.get(...)` pode rejeitar a promise; o `.finally` é executado normalmente e `data` permanece `null`. A tela exibe "Nenhum dado no período" (empty state) em vez de mensagem de erro. Operador não sabe se é dado vazio real ou falha de API.  
**Arquivo:** `app/dashboard/clube-vantagens/ranking/page.tsx` — `useEffect`  
**Impacto:** Diagnóstico de falha de integração impossível para o operador.

---

### BUG-006
**Severidade:** MEDIO  
**Descrição:** A barra de progresso `progressoRelativo` não é limitada a 100%:
```tsx
style={{ width: `${item.progressoRelativo}%` }}
```
Se a API retornar valores > 100, a barra transborda o container.  
**Arquivo:** `app/dashboard/clube-vantagens/ranking/page.tsx` — dentro do `.map` de top10  
**Impacto:** Layout quebrado quando `progressoRelativo > 100`.

---

### BUG-007
**Severidade:** BAIXO  
**Descrição:** O card "Sua posição no ranking" só é exibido se `data.cooperadoLogado.posicao` for truthy. Se a posição for `0` (possível em alguns sistemas), o card não aparece. Maior risco: se a API retornar `posicao: null` para usuário não rankeado, a condição corretamente oculta — mas não exibe nenhum aviso ao cooperado de que ele não está no ranking.  
**Arquivo:** `app/dashboard/clube-vantagens/ranking/page.tsx` — bloco final  
**Impacto:** Cooperado sem posição não recebe nenhum incentivo ou explicação.

---

## Seção 3 — /dashboard/condominios/[id]
**Arquivo:** `app/dashboard/condominios/[id]/page.tsx`

---

### BUG-008
**Severidade:** ALTO  
**Descrição:** Estado de erro compartilhado entre todas as operações (`setErro`). Após um erro ao simular rateio, a mensagem de erro permanece visível enquanto o usuário tenta adicionar uma unidade. O estado nunca é limpo antes de iniciar uma nova operação.  
**Arquivo:** `app/dashboard/condominios/[id]/page.tsx` — funções `adicionarUnidade`, `removerUnidade`, `simularRateio`, `desativar`  
**Impacto:** Mensagens de erro obsoletas confundem o operador.

---

### BUG-009
**Severidade:** ALTO  
**Descrição:** Botão de voltar (`<ArrowLeft>`) sem texto e sem `aria-label`. Apenas ícone, sem label acessível.  
**Arquivo:** `app/dashboard/condominios/[id]/page.tsx` — botão de navegação no topo  
**Impacto:** Inacessível para usuários com leitores de tela; sem tooltip, operadores podem não entender a função do botão.

---

### BUG-010
**Severidade:** MEDIO  
**Descrição:** Ação destrutiva "Desativar Condomínio" e remoção de unidade usam `confirm()` nativo do browser em vez de `AlertDialog` do Shadcn já presente no projeto. Inconsistência de UX com outras partes da aplicação.  
**Arquivo:** `app/dashboard/condominios/[id]/page.tsx` — funções `desativar` e `removerUnidade`  
**Impacto:** Experiência inconsistente; `confirm()` bloqueia a thread e não pode ser estilizado.

---

### BUG-011
**Severidade:** MEDIO  
**Descrição:** Remoção de unidade não tem indicador de loading. A função `removerUnidade` executa a chamada API sem feedback visual — o botão com `<Trash2>` fica ativo e clicável durante a operação, permitindo duplo-clique e dupla deleção.  
**Arquivo:** `app/dashboard/condominios/[id]/page.tsx` — função `removerUnidade`  
**Impacto:** Possível deleção duplicada se o usuário clicar duas vezes por falta de feedback.

---

### BUG-012
**Severidade:** MEDIO  
**Descrição:** Placeholder do campo "Fração Ideal" (`"0.05"`) sugere que o operador deve inserir o decimal (0,05 = 5%), mas o valor já é multiplicado por 100 na exibição (`(u.fracaoIdeal * 100).toFixed(2)%`). Sem label/instrução, operadores podem inserir `5` (pensando em porcentagem) quando o sistema espera `0.05`.  
**Arquivo:** `app/dashboard/condominios/[id]/page.tsx` — inputs da tabela de unidades  
**Impacto:** Dados de fração ideal inseridos incorretamente (100x maior).

---

### BUG-013
**Severidade:** BAIXO  
**Descrição:** A página não oferece edição dos dados do condomínio (nome, endereço, modelo de rateio, taxas). Apenas visualização e gerenciamento de unidades. Operador sem rota de edição clara — link para edição não existe na página de detalhes.  
**Arquivo:** `app/dashboard/condominios/[id]/page.tsx`  
**Impacto:** Operador precisa descobrir outro caminho para editar informações do condomínio.

---

## Seção 4 — /dashboard/financeiro/pix-excedente
**Arquivo:** `app/dashboard/financeiro/pix-excedente/page.tsx`

---

### BUG-014
**Severidade:** CRITICO  
**Descrição:** Campo "Cooperado ID" e "Condomínio ID" no formulário de nova transferência exigem que o operador insira UUIDs manualmente (texto livre). Não há autocomplete, busca ou select. Na prática, o operador precisaria copiar UUIDs de outra aba, o que é operacionalmente inviável e propenso a erros.  
**Arquivo:** `app/dashboard/financeiro/pix-excedente/page.tsx` — formulário "Processar PIX"  
**Impacto:** Recurso inutilizável na prática. Transferências PIX não poderão ser criadas manualmente pela UI.

---

### BUG-015
**Severidade:** ALTO  
**Descrição:** Campo "Chave PIX" (`pixTipo`) é texto livre sem validação de tipo. Tipos válidos de chave PIX (CPF, CNPJ, EMAIL, TELEFONE, ALEATORIA) não têm `<select>` dedicado. O campo `pixTipo` no formulário sequer existe — há input para `pixChave` mas não para `pixTipo`, embora o body da requisição inclua `pixTipo: form.pixTipo`.  
**Arquivo:** `app/dashboard/financeiro/pix-excedente/page.tsx` — grid do formulário  
**Impacto:** `pixTipo` sempre enviado como string vazia para a API, podendo causar erro de processamento no backend.

---

### BUG-016
**Severidade:** ALTO  
**Descrição:** O resumo financeiro (`/financeiro/pix-excedente/resumo`) é chamado sem o filtro `condominioId`, mesmo quando a página é acessada via `?condominioId=...`. Os cards de KPI exibem sempre totais globais, não filtrados pelo condomínio selecionado.  
**Arquivo:** `app/dashboard/financeiro/pix-excedente/page.tsx` — função `carregarDados`  
**Impacto:** KPIs misleading ao acessar o histórico de um condomínio específico (ex: "Histórico de PIX" do condomínio X).

---

### BUG-017
**Severidade:** ALTO  
**Descrição:** Nenhuma confirmação antes de registrar a transferência PIX. Um clique acidental em "Calcular e Registrar" registra uma transferência financeira real sem segunda verificação. Para operações financeiras irreversíveis, isso é crítico do ponto de vista de UX.  
**Arquivo:** `app/dashboard/financeiro/pix-excedente/page.tsx` — botão "Calcular e Registrar"  
**Impacto:** Transferências duplicadas ou acidentais registradas sem possibilidade de cancelamento via UI.

---

### BUG-018
**Severidade:** MEDIO  
**Descrição:** Quando `carregarDados()` é chamado após processar um PIX, o estado `carregando=true` faz o skeleton da tabela piscar, mesmo que apenas 1 registro foi adicionado. Feedback visual excessivo e irritante para o operador.  
**Arquivo:** `app/dashboard/financeiro/pix-excedente/page.tsx` — função `processarPix` → `carregarDados()`  
**Impacto:** UX degradada na operação mais comum da tela.

---

### BUG-019
**Severidade:** MEDIO  
**Descrição:** Tabela de histórico sem paginação. Busca todos os registros de uma vez (`/financeiro/pix-excedente?...`). Em produção com centenas de transferências, isso pode causar lentidão ou timeout.  
**Arquivo:** `app/dashboard/financeiro/pix-excedente/page.tsx` — função `carregarDados`  
**Impacto:** Performance degradada em produção; possível timeout de API.

---

## Seção 5 — /dashboard/cooperados (checkbox lote)
**Arquivo:** `app/dashboard/cooperados/page.tsx`

---

### BUG-020
**Severidade:** CRITICO  
**Descrição:** Componente `AcoesLoteBar` (em `components/AcoesLoteBar.tsx`) **nunca é importado ou usado** na `cooperados/page.tsx`. A página implementa sua própria versão inline `AcoesLote` com lógica duplicada. O componente isolado é código morto. Qualquer correção feita em `AcoesLoteBar.tsx` não terá efeito na tela de cooperados.  
**Arquivo:** `components/AcoesLoteBar.tsx` (não referenciado), `app/dashboard/cooperados/page.tsx` (usa versão inline)  
**Impacto:** Bugs corrigidos em `AcoesLoteBar.tsx` não afetam a tela em produção; manutenção confusa e duplicada.

---

### BUG-021
**Severidade:** ALTO  
**Descrição:** Seleção de itens persiste ao mudar filtro de busca. Se o operador seleciona 10 cooperados, digita uma nova busca e seleciona mais 5 do resultado filtrado, a ação em lote atuará em **todos os 15** — incluindo os 10 que não estão mais visíveis na tela. "Selecionar todos" também opera sobre itens ocultos pelo filtro.  
**Arquivo:** `app/dashboard/cooperados/page.tsx` — função `handleBuscaChange` e `toggleTodos`  
**Impacto:** Ações em lote (alterar status, enviar WhatsApp, reajuste) aplicadas a cooperados não intencionados.

---

### BUG-022
**Severidade:** ALTO  
**Descrição:** Ações destrutivas em lote ("Alterar Status" → ENCERRADO / SUSPENSO) não possuem diálogo de confirmação. Um clique acidental em "Alterar" pode encerrar contratos de múltiplos cooperados de uma vez.  
**Arquivo:** `app/dashboard/cooperados/page.tsx` — `AcoesLote.executar()` para `acao === 'status'`  
**Impacto:** Encerramento acidental em massa de contratos. Altíssimo risco operacional.

---

### BUG-023
**Severidade:** MEDIO  
**Descrição:** Erros das ações em lote são exibidos via `alert()` nativo, enquanto o sucesso usa toast estilizado. Inconsistência de UX e a `alert()` bloqueia a thread do navegador.  
**Arquivo:** `app/dashboard/cooperados/page.tsx` — `AcoesLote.executar()` bloco catch  
**Impacto:** Experiência de erro degradada e bloqueante.

---

### BUG-024
**Severidade:** MEDIO  
**Descrição:** Busca dupla (client-side + server-side). O `handleBuscaChange` dispara chamada à API com debounce E também filtra o array `cooperados` client-side simultaneamente. Quando a API retorna, o resultado já filtrado é armazenado em `cooperados`, depois filtrado novamente pela busca local. Isso pode gerar resultados incorretos se o debounce e o filtro client-side estiverem em estados diferentes.  
**Arquivo:** `app/dashboard/cooperados/page.tsx` — `handleBuscaChange` + `cooperadosFiltrados`  
**Impacto:** Resultados de busca potencialmente inconsistentes durante a digitação.

---

### BUG-025
**Severidade:** BAIXO  
**Descrição:** Mensagem WhatsApp no `AcoesDropdown` tem typo: `"Ola ${cooperado.nomeCompleto}"` (sem acento em "Olá") e o texto é hardcoded, não personalizável.  
**Arquivo:** `app/dashboard/cooperados/page.tsx` — `AcoesDropdown`  
**Impacto:** Mensagem enviada com erro gramatical para clientes.

---

## Seção 6 — /portal/indicacoes
**Arquivo:** `app/portal/indicacoes/page.tsx`

---

### BUG-026
**Severidade:** ALTO  
**Descrição:** Todos os erros de API são silenciados com `.catch(() => {})`. Se as chamadas a `/cooperados/meu-perfil`, `/indicacoes/meu-link` ou `/clube-vantagens/minha-progressao` falharem, o cooperado vê uma tela completamente vazia sem nenhuma mensagem de erro. A seção de indicados aparece como "Nenhuma indicação ainda" quando na verdade pode haver um erro de rede.  
**Arquivo:** `app/portal/indicacoes/page.tsx` — bloco `Promise.all`  
**Impacto:** Cooperado pensa que não tem indicações quando pode ser falha de API.

---

### BUG-027
**Severidade:** ALTO  
**Descrição:** Barra de progresso de nível completamente incorreta. O cálculo atual:
```ts
width: `${Math.min((progressao.kwhIndicadoAcumulado / Math.max(progressao.kwhIndicadoAcumulado + 100, 500)) * 100, 100)}%`
```
Resulta sempre em ~90-99% independente do nível real do usuário (numerador ≈ denominador). Um cooperado Bronze com 10 kWh verá a barra quase cheia, sugerindo que está quase sendo promovido quando na verdade precisa de 500 kWh. **Misleading direto ao usuário.**  
**Arquivo:** `app/portal/indicacoes/page.tsx` — barra de progresso para próximo nível  
**Impacto:** Cooperado recebe informação falsa sobre seu progresso no clube de vantagens.

---

### BUG-028
**Severidade:** MEDIO  
**Descrição:** Total de "Benefício por indicações" inclui benefícios com status PENDENTE (apenas exclui CANCELADO). O cooperado vê um valor maior do que o efetivamente creditado, podendo gerar insatisfação quando perceber que parte do valor ainda não foi pago.  
**Arquivo:** `app/portal/indicacoes/page.tsx` — cálculo de `totalBeneficio`  
**Impacto:** Valor de benefício exibido maior que o real; possível reclamação do cooperado.

---

### BUG-029
**Severidade:** MEDIO  
**Descrição:** Ausência de mecanismo de atualização (pull-to-refresh ou botão Atualizar). O portal é mobile-first mas não oferece forma de recarregar os dados sem sair e voltar para a página.  
**Arquivo:** `app/portal/indicacoes/page.tsx`  
**Impacto:** Cooperado que acabou de fazer uma indicação pode não ver o novo indicado sem reload manual.

---

## Seção 7 — /portal/financeiro
**Arquivo:** `app/portal/financeiro/page.tsx`

---

### BUG-030
**Severidade:** ALTO  
**Descrição:** Erro da API completamente silenciado (`.catch(() => {})`). Se `/cooperados/meu-perfil/cobrancas` falhar, o cooperado vê o empty state "Nenhuma cobrança encontrada." — idêntico a um cooperado sem cobranças. Não há como distinguir erro de ausência real de dados.  
**Arquivo:** `app/portal/financeiro/page.tsx` — `useEffect`  
**Impacto:** Cooperado com cobranças pendentes pode achar que não deve nada, ignorando vencimentos.

---

### BUG-031
**Severidade:** MEDIO  
**Descrição:** Bug de timezone nas datas de vencimento. `new Date(c.dataVencimento).toLocaleDateString('pt-BR')` sem especificar timezone. Strings no formato ISO date (`"2024-03-01"`) são parseadas como UTC meia-noite. Em UTC-3 (Brasil), isso exibe o dia anterior: `"29/02/2024"` em vez de `"01/03/2024"`.  
**Arquivo:** `app/portal/financeiro/page.tsx` — renderização da data de vencimento  
**Impacto:** Cooperado vê data de vencimento errada (1 dia a menos), podendo atrasar pagamento.

---

### BUG-032
**Severidade:** MEDIO  
**Descrição:** `proximoVencimento` e `ultimoPagamento` usam `.find()` no array sem garantia de ordenação. Se a API não retornar cobranças ordenadas por data, o "Próximo vencimento" pode não ser o mais iminente e o "Último pagamento" pode não ser o mais recente.  
**Arquivo:** `app/portal/financeiro/page.tsx` — cálculo dos KPIs  
**Impacto:** KPIs exibindo valores incorretos para o cooperado.

---

### BUG-033
**Severidade:** BAIXO  
**Descrição:** `STATUS_CONFIG` não mapeia todos os possíveis status do backend (ex: `AGUARDANDO_RETORNO`, `PROCESSANDO`). Status desconhecidos usam `STATUS_CONFIG.PENDENTE` como fallback silencioso, podendo exibir label incorreto.  
**Arquivo:** `app/portal/financeiro/page.tsx` — `STATUS_CONFIG` e uso no render  
**Impacto:** Status desconhecidos aparecem como "Pendente" ao cooperado.

---

## Seção 8 — Componente BadgeNivelClube
**Arquivo:** `components/BadgeNivelClube.tsx`

---

### BUG-034
**Severidade:** MEDIO  
**Descrição:** Ponto verde de `beneficioAtivo` no modo compacto (`compact`) não tem `title` nem `aria-label`, ao contrário do modo full que tem `title="Benefício ativo"`. Usuários de leitores de tela em modo compacto não recebem informação sobre o benefício ativo.  
**Arquivo:** `components/BadgeNivelClube.tsx` — modo `compact`  
**Impacto:** Inacessível para leitores de tela no modo compacto (usado amplamente em listas e rankings).

---

### BUG-035
**Severidade:** BAIXO  
**Descrição:** Fallback para nível desconhecido usa `NIVEL_CONFIG.BRONZE`. Se a API retornar um nível não mapeado (ex: `"PLATINA"`, `"VIP"`), o badge exibirá "🥉 Bronze" de forma silenciosa, sem log de warning ou tratamento explícito.  
**Arquivo:** `components/BadgeNivelClube.tsx` — linha `const config = NIVEL_CONFIG[nivel] || NIVEL_CONFIG.BRONZE`  
**Impacto:** Nível exibido incorretamente para o usuário se o backend evoluir com novos níveis.

---

## Seção 9 — Componente AcoesLoteBar
**Arquivo:** `components/AcoesLoteBar.tsx`

---

### BUG-036
**Severidade:** ALTO  
**Descrição:** Componente **não é usado em nenhum lugar do projeto**. `cooperados/page.tsx` usa sua própria implementação inline (`AcoesLote`). `AcoesLoteBar.tsx` é código morto — qualquer bugfix aplicado aqui não afeta o comportamento em produção.  
**Arquivo:** `components/AcoesLoteBar.tsx`  
**Impacto:** Manutenção duplicada e confusão de qual implementação é a "fonte da verdade".

---

### BUG-037
**Severidade:** ALTO  
**Descrição:** Erros de API nas ações em lote exibidos via `alert()` nativo:
```ts
alert(msg || 'Erro ao executar ação em lote');
```
Bloqueia a thread do browser, não pode ser estilizado, e é bloqueante para o usuário.  
**Arquivo:** `components/AcoesLoteBar.tsx` — bloco `catch` em `executar()`  
**Impacto:** UX degradada no fluxo de erro mais importante do componente.

---

### BUG-038
**Severidade:** MEDIO  
**Descrição:** Campo de percentual de reajuste sem validação de range. O operador pode inserir `-100` (zeraria todos os contratos) ou `999` (valores absurdos). Nenhuma validação client-side além de verificar se o campo não está vazio.  
**Arquivo:** `components/AcoesLoteBar.tsx` — `canExecute()` para `reajuste`  
**Impacto:** Reajuste absurdo pode ser enviado acidentalmente para a API.

---

### BUG-039
**Severidade:** MEDIO  
**Descrição:** `mesReferencia` do benefício manual é sempre hardcoded para o mês atual:
```ts
const mesRef = new Date().toISOString().slice(0, 7);
```
Não há campo para selecionar o mês de referência. Se o operador precisa lançar um benefício retroativo, a funcionalidade é inoperante.  
**Arquivo:** `components/AcoesLoteBar.tsx` — `executar()` bloco `beneficio`  
**Impacto:** Impossibilidade de lançar benefícios para meses anteriores via interface.

---

### BUG-040
**Severidade:** BAIXO  
**Descrição:** Campo de mensagem WhatsApp sem `maxLength`. Mensagens muito longas podem ser truncadas pelo WhatsApp sem aviso ao operador.  
**Arquivo:** `components/AcoesLoteBar.tsx` — `<Input>` da ação `whatsapp`  
**Impacto:** Mensagens enviadas truncadas sem o operador perceber.

---

## Recomendações Prioritárias

### 🔴 Prioridade Imediata (bloqueia uso em produção)

1. **[BUG-020 + BUG-036]** Resolver o componente duplicado `AcoesLoteBar`. Escolher uma das implementações como canônica, eliminar a outra e importar corretamente em `cooperados/page.tsx`.

2. **[BUG-014]** Substituir os inputs de UUID no formulário PIX por campos de busca/autocomplete para cooperado e condomínio. Sem isso, o formulário é inutilizável na prática.

3. **[BUG-021 + BUG-022]** Corrigir a seleção em lote para limpar ao trocar filtro, e adicionar `AlertDialog` de confirmação antes de ações destrutivas (status ENCERRADO/SUSPENSO).

4. **[BUG-001 + BUG-026 + BUG-030]** Adicionar tratamento de erro explícito em todos os `useEffect` com chamadas de API. Padrão mínimo: `const [erro, setErro] = useState('')` e renderização condicional de mensagem de erro.

### 🟠 Alta Prioridade (impacta operação diária)

5. **[BUG-027]** Corrigir o cálculo da barra de progresso em `/portal/indicacoes` para usar os limiares reais de nível (kwhMinimo/kwhMaximo) em vez da fórmula incorreta atual.

6. **[BUG-015 + BUG-016]** No formulário PIX: adicionar `<select>` para `pixTipo` com os valores válidos; corrigir o resumo para filtrar por `condominioId`.

7. **[BUG-017]** Adicionar step de confirmação (ou `AlertDialog`) antes de registrar transferência PIX.

8. **[BUG-002]** Corrigir o bug de override no `evolucaoData`:
   ```ts
   // De:
   evolucao.map(e => ({ mes: e.mes.slice(5), ...e }))
   // Para:
   evolucao.map(e => ({ ...e, mes: e.mes.slice(5) }))
   ```

9. **[BUG-031]** Corrigir parsing de datas de vencimento adicionando `T00:00:00` ou usando `parseISO` do date-fns com timezone explícita.

### 🟡 Média Prioridade (melhoria de UX)

10. **[BUG-008 + BUG-011]** Na página de condomínio: limpar `erro` antes de nova operação; adicionar loading state na remoção de unidade.

11. **[BUG-005 + BUG-006]** No ranking: adicionar error handling e `Math.min(progressoRelativo, 100)` para a barra.

12. **[BUG-023 + BUG-037]** Substituir `alert()` por toast/notification consistente com o restante da UI.

13. **[BUG-034]** Adicionar `title="Benefício ativo"` e `aria-label` no ponto verde compacto de `BadgeNivelClube`.

---

*Relatório gerado por análise estática de código. Recomenda-se complementar com testes de integração E2E (Cypress/Playwright) para validar fluxos completos com API real.*
