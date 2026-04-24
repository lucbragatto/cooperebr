# Auditoria ampla — numeração dupla UC EDP (Sprint 11 T1)

**Data:** 2026-04-26
**Escopo:** só leitura. Mapeamento de todos os pontos onde números de UC
circulam no sistema (schema, backend, frontend, OCR, banco, exports).

---

## 1. Schema — o campo é TRIPLO, não duplo

O model `Uc` (`backend/prisma/schema.prisma:277-303`) tem **3 campos** pra número:

| Campo | Tipo | Formato esperado | Obrigatório |
|---|---|---|---|
| `numero` | `String @unique` | ??? (veja §5) | **SIM** |
| `numeroUC` | `String?` | 9 dígitos, legado EDP | não |
| `numeroInstalacaoEDP` | `String?` | "Número curto 10 dígitos exigido pela EDP pra GD" (comentário inline) | não |

**Gap imediato:** o comentário do `numeroInstalacaoEDP` sugere que *ele* é o
canônico da EDP (10 dígitos). Mas o uso real no código (veja §2) trata
`numero` como canônico. Contradição não resolvida.

---

## 2. Backend — 236 ocorrências em 35 arquivos

### 2a. Função central de match (pipeline IMAP/OCR)

`backend/src/faturas/faturas.service.ts:38-64` — `resolverUcPorNumero()`:

```ts
const ucs = await prisma.uc.findMany({ where: { ... tenant ... }, select: { id, numero } });
const achou = ucs.find(u => normalizarNumeroUc(u.numero) === alvo);
```

- **Só compara contra `u.numero`**, ignora `u.numeroUC` e `u.numeroInstalacaoEDP`.
- Normalização = remove não-dígitos.
- **Causa raiz do gap #1:** OCR da EDP retorna número legado (ex: `0160085263`).
  Banco tem Luciano com `u.numero = 0400702214` (canônico). Não bate.

Fix: trocar `find` por comparar contra `u.numero`, `u.numeroUC` **e**
`u.numeroInstalacaoEDP`, normalizados.

### 2b. Pontos que SALVAM no banco

| Arquivo | Linha | O que faz |
|---|---|---|
| `publico.controller.ts:354` | `numero: body.instalacao.numeroUC \|\| 'UC-${Date.now()}'` | Cadastro público. Salva no campo `numero` **o que o usuário digitou** (formato variado). |
| `publico.controller.ts:583` | `numeroUC: dadosExtraidos.numeroUC \|\| ''` | Salva também o extraído do OCR em `numeroUC`. |
| `cooperados.service.ts:479` | `numeroUC: dto.uc.numeroUC` | Cadastro admin via DTO. Salva apenas `numeroUC` (legado). |
| `cooperados.controller.ts:255` | `numero: numeroUC.trim()` | Endpoint de criar UC individual: salva em `numero` o valor do argumento chamado `numeroUC`. Ambiguidade. |
| `whatsapp-bot.service.ts:2015-2016` | `numero: numeroUC, numeroUC: numeroUC` | Bot salva **mesmo valor nos dois campos**. Confirma que não há distinção consistente. |
| `whatsapp-bot.service.ts:3149, 3175, 3350` | `numeroUC: numeroUC \|\| undefined` | Bot salva só `numeroUC` em outros fluxos. |

**Padrão observado:** a prática é salvar *o que veio* em um campo (às vezes
em ambos), sem distinguir formato. Coerência por feature, não por
convenção global.

### 2c. Pontos que LEEM do banco pra uso

| Arquivo | Linha | Campo lido | Nota |
|---|---|---|---|
| `faturas.service.ts:38-64` | `resolverUcPorNumero` | `u.numero` | **Gap crítico** — só canônico |
| `faturas.service.ts:633` | `uc: { select: { numeroUC, distribuidora } }` | `u.numeroUC` | Depois injeta em JSON de cobrança |
| `faturas.service.ts:1885, 1914-1918` | query por `numeroUC` direto | `u.numeroUC` | Para vincular FaturaProcessada a cooperado |
| `relatorio-fatura.service.ts:152` | `fatura.uc?.numeroUC ?? dados?.numeroUC ?? ''` | `u.numeroUC` | Único lugar com OR (legado + OCR) |
| `usinas.service.ts:459` | `numeroUC: c.uc?.numero ?? ''` | `u.numero` | **Ambíguo** — variável `numeroUC` recebe `u.numero` |
| `migracoes-usina.service.ts:525` | `numeroUC: (c.uc as any)?.numero ?? ''` | `u.numero` | Mesmo erro |
| `email-monitor.service.ts:270` | `where: { numero: numeroUC, ... }` | `u.numero` | Comentário explica hotfix Sprint 5 T5 (match só canônico) |

### 2d. DTOs e contratos externos

| Arquivo | Campo DTO | Ligação |
|---|---|---|
| `cooperados/dto/cadastro-completo.dto.ts:12` | `numeroUC?: string` | Admin wizard envia esse campo |
| `publico.controller.ts:143, 295` | `instalacao: { numeroUC }` | Cadastro público recebe esse campo |
| `lead-expansao.service.ts:34-47` | `numeroUC?` | Salva em tabela Lead sem validação |
| `whatsapp-fatura.service.ts:138-158` | `numeroUC = dadosExtraidos.numeroUC` | Gera mensagem pro cooperado com esse campo |

---

## 3. Frontend — formulários pedem só 1 campo

### 3a. Admin — `web/app/dashboard/ucs/nova/page.tsx`
- Formulário tem **3 campos separados:** `numero`, `numeroUC`, **`numeroInstalacaoEDP`**
- Único lugar que expõe `numeroInstalacaoEDP` na UI
- Mas 0/326 UCs no banco têm esse campo preenchido → o form existe mas admins nunca usam

### 3b. Admin — `web/app/dashboard/cooperados/novo/steps/Step2Dados.tsx`
- Pula confirmação do número: `numero: faturaData.ocr.numeroUC || 'UC-' + Date.now()` (linhas 126, 198)
- O que o OCR extraiu vai direto pro campo `numero` do banco. Se OCR retornar legado, `numero = legado`.

### 3c. Cadastro público — `web/app/cadastro/page.tsx`
- 1 campo: `"Numero da instalacao (UC)"` (linhas 698, 850)
- `instalacao.numeroUC` vai pro backend como `body.instalacao.numeroUC`
- Backend salva esse valor em **dois campos diferentes** em momentos diferentes: `numero` (linha 354) e `numeroUC` (linha 583)

**Conclusão:** nenhum dos 3 fluxos de cadastro explica ao usuário **qual número digitar**. Usuário digita o que vê na fatura (varia por concessionária e geração da fatura).

---

## 4. OCR — prompt é ambíguo

`backend/src/faturas/faturas.service.ts:1213`:
```
"numeroUC": "número da unidade consumidora"
```

Instrução genérica. Claude retorna **o que encontra na fatura**:
- EDP fatura residencial atual → legado zero-padded (ex: `"0160085263"`)
- Teste real (fatura Luciano 08/2025) confirmou: OCR retorna `"0160085263"`

Normalização posterior (linha 1332-1333): `replace(/[^0-9]/g, '')` — só
limpa caracteres não numéricos. Preserva zeros à esquerda.

**Gap:** prompt não distingue os formatos nem pede ambos. Depende da
sorte da fatura ter o que queremos.

---

## 5. Banco — contagem atual

```
Total UCs: 326
numero (canônico, NOT NULL, unique): SEMPRE preenchido
  dos quais "PENDENTE-*": 1 (placeholder Guarapari do Luciano)
numeroUC (legado 9 díg): preenchido=65 (20%), vazio=261 (80%)
numeroInstalacaoEDP (GD 10 díg): preenchido=0 (0%), vazio=326 (100%)
```

### Amostra de formatos em `numero`

| Valor | Formato | Origem provável |
|---|---|---|
| `001001`, `001002`, ... | 6 dígitos sequenciais | Seed antigo / legado MVP |
| `0.000.892.226.054-40` | 16 dígitos com pontuação | Display EDP direto, não normalizado |
| `0450023484` | 10 díg canônico | OCR bem-sucedido |
| `0160005888` | 10 díg com 0 à esquerda (legado) | OCR de fatura legado |
| `401729309`, `1161793` | 9 díg sem 0 | numeroUC sendo usado como canônico |
| `PENDENTE-GUARAPARI` | Placeholder | Criado na sessão 25/04 |
| `UC-{timestamp}` | Placeholder timestamped | Fallback em cadastro público quando usuário deixou em branco |

**Conclusão:** o campo `numero` é um **saco de gato**. Não existe convenção
de formato aplicada. A unicidade (`@unique`) é a única restrição e impede
duplicatas exatas, mas nada garante que `"0160005888"` e `"160005888"`
apontem pra mesma UC real.

### Distribuidora tem 5 variantes

```
null                                              = 230 (70.5%)
"EDP ES"                                          =  91
"EDP ES DISTRIB DE ENERGIA SA"                    =   3
"EDP"                                             =   1
"EDP Espírito Santo Distribuição de Energia S.A." =   1
```

**Gap extra identificado:** 70% das UCs não têm distribuidora.
Impossível filtrar "UCs EDP" pra gerar lista de compensação.

---

## 6. Módulo de exportação pra EDP

**NÃO EXISTE.**

Grep exaustivo em `backend/src` e `web/app` por:
- `exportar.*edp`, `export.*concessionaria`
- `lista.*EDP`, `relatorio.*EDP`
- `planilha.*compensacao`, `EDP.*lista`

→ 0 resultados.

**Existem** 2 módulos parecidos mas sem uso operacional:
- `backend/src/migracoes-usina/migracoes-usina.service.ts:525-538` — gera CSV de migração entre usinas com `numeroUC: c.uc?.numero` (canônico com nome de variável legado).
- `backend/src/usinas/usinas.service.ts:459` — mesmo padrão.

Nenhum dos dois é o export **pra enviar à EDP** pedindo compensação. Confirma
tarefa 4 do Sprint 11.

---

## 7. Tabela resumo de findings por área

| Área | Estado atual | Estado-alvo | Tarefa Sprint 11 | Estimativa |
|---|---|---|---|---|
| Match OCR → UC no banco | só `u.numero`, perde legado | OR `numero` \| `numeroUC` \| `numeroInstalacaoEDP`, normalizados | **T2** | 0.5 dia |
| Filename de fatura (OCR pipeline) | não analisado | regex extrai número do filename como fallback | **T2** | 0.5 dia |
| Cadastro admin wizard (Step2Dados) | pula confirmação, usa OCR direto | exibir `numeroUC` extraído + pedir canônico explícito | **T3** | 0.5 dia |
| Cadastro admin UC individual (`ucs/nova`) | 3 campos expostos, admins não preenchem | manter 3, explicar cada um com help-text, tornar `numeroUC` obrigatório | **T3** | 0.5 dia |
| Cadastro público (`cadastro/page.tsx`) | 1 campo genérico | 2 campos: "número na fatura" + "número antigo (se a EDP enviou carta)" | **T3** | 0.5 dia |
| Backend `publico.controller.ts` salvando UC | usa `numeroUC` em 2 campos diferentes | DTO separa `numero` e `numeroUC`, valida formato | **T3** | 0.5 dia |
| OCR prompt | texto genérico "número da unidade consumidora" | prompt pede **ambos** números (canônico + legado), indica qual é qual | **T2** | 0.5 dia |
| UCs com `numero` em formato anômalo | 326 registros misturados | migração de limpeza: extrair dígitos, preencher `numeroUC` se for 9 dígitos | **T2** (migração) | 0.5 dia |
| `numeroInstalacaoEDP` campo morto | 0/326 preenchido | decidir: remover (redundante) OU popular via OCR | **T2** | 0.3 dia |
| Distribuidora inconsistente | null em 70%, 5 variantes | enum ou normalização pra `EDP_ES` | fora do Sprint 11, P2 | 0.5 dia |
| Export pra EDP | **não existe** | módulo novo `/exportacao-edp/lista-compensacao` | **T4** | 1 dia |

---

## 8. Recomendações de ordem

A ordem atual do Sprint 11 (auditoria → T2 pipeline → T3 cadastros → T4 export) é correta, mas sugiro **inverter T3 e T4**:

1. **T2 — pipeline IMAP/OCR + migração de limpeza do `numero`** (2 dias)
   - Ajusta `resolverUcPorNumero` pra OR nos 3 campos
   - Ajusta prompt OCR pra pedir ambos os formatos
   - Migração: passa por todas 326 UCs, extrai dígitos, preenche `numeroUC` se formato legado
   - **Resultado:** pipeline passa a reconhecer faturas históricas que hoje caem em "Pendentes"

2. **T4 — módulo de export pra EDP** (1 dia)
   - Enquanto ninguém cadastrou nada novo, já tem valor gerar lista com os 65 `numeroUC` existentes
   - Confirma que o dado que temos é suficiente pra enviar à EDP
   - Se não for, a mudança no cadastro (T3) já sai com o formato correto

3. **T3 — cadastros admin + público** (2 dias)
   - Faz depois porque as mudanças de UX precisam saber exatamente que números a EDP exige (validado pela T4)
   - Reduz refatoração dupla

### Módulos que PRECISAM ajuste em T2 (pipeline)

- `backend/src/faturas/faturas.service.ts` — função `resolverUcPorNumero` + prompt OCR
- `backend/src/email-monitor/email-monitor.service.ts` — comentários/identificação por OCR (delegar à função corrigida)
- `backend/scripts/` — script de migração de limpeza do `numero`

### Módulos que PRECISAM ajuste em T3 (cadastros)

- `backend/src/publico/publico.controller.ts` (linhas 354, 583)
- `backend/src/cooperados/cooperados.service.ts` (linha 479)
- `backend/src/cooperados/cooperados.controller.ts` (linhas 187-255)
- `backend/src/cooperados/dto/cadastro-completo.dto.ts`
- `web/app/cadastro/page.tsx`
- `web/app/dashboard/cooperados/novo/steps/Step2Dados.tsx`
- `web/app/dashboard/ucs/nova/page.tsx` (já tem os 3 campos, só falta help-text e validação)

### Estado do módulo de export (T4)

- **Não existe.** Criar do zero:
  - Endpoint `GET /exportacao-edp/lista-compensacao?cooperativaId=X&formato=csv|xlsx`
  - Filtro: UCs vinculadas a contratos ATIVOS
  - Campos: `numeroUC` (obrigatório, alertar se null), `titular`, `cpf`, `kwhContratado`, `dataInicio`
  - Alerta "X UCs sem `numeroUC` preenchido — não podem ser enviadas à EDP"
  - Bônus: comparação mensal (UCs novas, UCs que saíram)

---

## 9. Riscos identificados (fora do escopo Sprint 11 mas precisam registrar)

1. **`@unique` em `numero` pode quebrar ao normalizar:** se a migração T2 remove pontuação de `"0.000.892.226.054-40"` pra virar `"000089222605440"` e já existe outra UC com esse número limpo, Prisma falha. Precisa dry-run antes.

2. **Desambiguação retroativa:** as 65 UCs com `numeroUC` preenchido hoje **foram digitadas por admins/bot como "número da UC"**. Sem consultar o cooperado, não temos como saber se é canônico ou legado. Admin revisão manual pode ser necessária pra minoria de casos ambíguos.

3. **EDP pode mudar de decisão:** se a EDP unificar os números durante o Sprint 11, a complexidade vira débito técnico. Documentado no MAPA como gap #1, prazo indefinido.

4. **`numeroInstalacaoEDP` órfão:** o comentário do schema sugere propósito específico de GD, mas nenhum fluxo popula. Remover em vez de "popular via OCR" pode ser menos trabalho — decidir em T2.
