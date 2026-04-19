# Relatório QA — CoopereBR
**Data:** 2026-04-17 | **Horário:** 03:00 (America/Sao_Paulo) — ciclo noturno automático
**Score:** 8.5/10 ↓ (−0.3 vs 8.8 em 15/04) — Sprint massivo de features; 4 novos P2 em fluxos críticos
**Críticos P1:** 0 ✅ | **P2 ativos:** 8 (+4) | **P3:** 9 (+2)
**Gerado por:** Assis — análise profunda dos 52 commits desde 15/04 03:00

---

## 1. Status dos Itens do Ciclo Anterior (15/04/2026)

**52 commits entregues desde 15/04 03:00** — maior sprint de entregas históricas.

### ✅ Features entregues (T0 → T10 completos)

| Commit | Feature |
|--------|---------|
| `6c2b66e` | T0-Step2: criar cooperado + UC no wizard admin |
| `d8eb846` | T0-Step4: aceitar proposta via motor real com propostaId persistido |
| `534b72e` | T0-Step6: análise de documentos + envio de link de assinatura |
| `e86c4b9` | T0-Step7: painel de acompanhamento (status assinatura + alocação) |
| `58c3892` | T10: job aprovação automática de documentos por tenant via ConfigTenant |
| `8af1bce` | Cadastro público v2: Cooperado + UC + Proposta via motor (CADASTRO_V2_ATIVO) |
| `a5f7a38` | Portal cooperado: endpoint nova-uc-com-fatura + confirmar-nova-uc |
| `cb100ae` | Portal UCs: modal 3 etapas (OCR + simulação + contrato) |
| `1f59ae0` | Fix: cobrancas e crons filtram cooperado.status e contrato.status = ATIVO |
| `54de97e` | Fix: tarifa OCR usa tarifaTUSDSemICMS como base ANEEL |
| `8f9c0ef` | Step3: recalcula ao trocar plano com desconto real |

### 🟡 Bugs P2 do ciclo anterior — AINDA ABERTOS

| ID | Bug | Status |
|----|-----|--------|
| BUG-NEW-2026-04-15-001 | contas-pagar: sem class-validator DTOs | 🟡 Persiste |
| BUG-NEW-2026-04-15-002 | contas-pagar: SUPER_ADMIN info leak inter-tenant | 🟡 Persiste |
| BUG-NEW-2026-04-11-003 | BONUS_INDICACAO idempotência sem cooperativaId | 🟡 Persiste |
| BUG-CALCULO-001 | Multa/juros: 3 implementações divergentes | 🟡 Persiste |

---

## 2. Bugs Novos — Ciclo 17/04/2026

---

### 🟡 BUG-NEW-2026-04-17-001 — `confirmar-nova-uc`: Fallback hardcoded 300 kWh / R$250 para proposta
**Prioridade: P2 | Área: Cálculo / Integridade de Dados**
**Arquivo:** `backend/src/cooperados/cooperados.controller.ts`

```typescript
// confirmar-nova-uc: busca FaturaProcessada mais recente do cooperado
const historico = await this.prisma.faturaProcessada.findMany({
  where: { cooperadoId: cooperado.id },
  orderBy: { createdAt: 'desc' },
  take: 12,
});

const lastFatura = historico[0];
const dados = (lastFatura?.dadosExtraidos as Record<string, unknown>) ?? {};
const consumo = Number(dados.consumoAtualKwh ?? 0) || 300;  // ← 300 hardcoded
const valor = Number(dados.totalAPagar ?? 0) || 250;         // ← R$250 hardcoded
```

**Problema:** O fluxo portal `nova-uc-com-fatura` cria a UC com OCR e simulação, mas **não salva uma FaturaProcessada** — isso é feito apenas pelo endpoint `faturas/processar`. Portanto, quando `confirmar-nova-uc` é chamado imediatamente após, `historico[0]` é `undefined`, `dados` é `{}`, e o motor calcula a proposta com **consumo fictício de 300 kWh a R$250**.

**Cenário de impacto:**
- Cooperado envia fatura com consumo real de 800 kWh (R$600/mês)
- `nova-uc-com-fatura` extrai o OCR e retorna simulação correta de 800 kWh
- Cooperado confirma; `confirmar-nova-uc` recalcula com 300 kWh
- Contrato criado com kWh 2,67x menor que o real → cobranças mensais sub-estimadas

**Fix sugerido:**
1. Opção A (preferida): `nova-uc-com-fatura` salvar os dados OCR na UC ou em FaturaProcessada para que `confirmar-nova-uc` os encontre.
2. Opção B: `confirmar-nova-uc` aceitar `ucId` e buscar dados do OCR retornados na etapa anterior (passados no body ou cache server-side via Redis/session).

**Status: ABERTO 🟡 P2**

---

### 🟡 BUG-NEW-2026-04-17-002 — `novaUcComFatura`: UC criada sem rollback se motor falhar; proposta com dados fictícios garantida
**Prioridade: P2 | Área: Integridade de Dados / Transação**
**Arquivo:** `backend/src/cooperados/cooperados.controller.ts`

```typescript
// 3. Criar UC (persiste no banco)
const uc = await this.ucsService.create({ ... });

// 4. Simulação via motor (pode falhar)
let simulacao = null;
try {
  const resultado = await this.motorProposta.calcular({ ... });
  if (resultado.resultado) { simulacao = { ... }; }
} catch (err) {
  this.logger.warn(`[nova-uc] Motor falhou para cooperado ${cooperado.id}: ${msg}`);
  // ← UC persiste, simulacao = null
}

return { ok: true, ucId: uc.id, simulacao, ... };
```

**Problema:** A UC é criada fora de uma transação antes do motor. Se o motor falhar (tarifa não cadastrada, timeout, etc.):
- UC fica orphaned no banco (sem proposta, sem contrato)
- `simulacao` retorna `null`
- Frontend recebe `ok: true` com `simulacao: null` — sem clareza sobre o problema
- `confirmar-nova-uc` ainda funciona, mas usa fallback 300 kWh/R$250 (BUG-001) → contrato incorreto

**Fix sugerido:** Não criar a UC até confirmar que o motor consegue calcular. Ou criar tudo em transação incluindo uma etapa de validação do motor antes de persistir a UC.

**Status: ABERTO 🟡 P2**

---

### 🟡 BUG-NEW-2026-04-17-003 — `DocumentosAprovacaoJob`: Aprova automaticamente sem verificar se documentos foram analisados
**Prioridade: P2 | Área: Segurança / Fluxo de Aprovação**
**Arquivo:** `backend/src/documentos/documentos-aprovacao.job.ts`

```typescript
// Verificar se algum doc foi reprovado — admin já interveio manualmente
if (docs.some(d => d.status === 'REPROVADO')) return;

// Prazo: contar a partir do ÚLTIMO documento enviado
const ultimoDoc = docs[0];
const diffHoras = (agora.getTime() - new Date(ultimoDoc.createdAt).getTime()) / (1000 * 60 * 60);
if (diffHoras < prazoHoras) return;

// ← APROVA AUTOMATICAMENTE (todos com status PENDENTE = nenhum analisado)
await this.motorProposta.analisarDocumentos(proposta.id, 'APROVADO', undefined, cooperativaId);
```

**Problema:** A condição de segurança verifica apenas `REPROVADO`, mas não verifica se os documentos estão `PENDENTE` (nenhum admin abriu). Após `prazoHoras` (padrão 24h), **todos os documentos PENDENTE são aprovados automaticamente** sem que nenhum humano tenha verificado a identidade do cooperado.

**Cenário de impacto:**
- Cooperado envia RG adulterado às 10h
- Admin está ausente por 24h+
- Às 10h do dia seguinte, o job aprova automaticamente
- Cooperado fraudulento avança para `APROVADO` sem revisão humana

**Fix sugerido:**
```typescript
// Verificar se TODOS os docs têm status analisado (APROVADO ou REPROVADO)
const todosAnalisados = docs.every(d => d.status === 'APROVADO' || d.status === 'REPROVADO');
if (!todosAnalisados) return; // Ainda há docs pendentes de análise humana

// OU: verificar se há pelo menos 1 APROVADO e nenhum REPROVADO
const temAprovado = docs.some(d => d.status === 'APROVADO');
const temReprovado = docs.some(d => d.status === 'REPROVADO');
if (!temAprovado || temReprovado) return;
```

Alternativamente, renomear o recurso para "auto-aprovação sem análise" e exigir confirmação explícita no painel admin.

**Status: ABERTO 🟡 P2**

---

### 🟡 BUG-NEW-2026-04-17-004 — `cadastroWebV2`: Outlier silencioso — proposta não criada sem feedback
**Prioridade: P2 | Área: UX / Fluxo de Negócio**
**Arquivo:** `backend/src/publico/publico.controller.ts`

```typescript
const resultado = await this.motorProposta.calcular({ ... });

if (resultado.resultado) {
  const aceite = await this.motorProposta.aceitar({ ... });
  propostaId = aceite.proposta?.id ?? null;
} 
// ← Se outlier → resultado.resultado = undefined → propostaId = null silenciosamente
```

**Problema:** Quando o motor detecta outlier com `acaoOutlier = 'OFERECER_OPCAO'`, retorna `{ outlierDetectado: true, aguardandoEscolha: true, opcoes: [...] }` — sem `resultado`. A v2 silenciosamente não cria proposta e retorna `{ ok: true, data: { cooperadoId, ucId, propostaId: null } }`.

O cooperado é criado com sucesso no banco, mas **sem proposta**. O frontend exibe "cadastro realizado com sucesso" sem indicar que há escolha pendente.

**Cenários de impacto:**
- Clientes sazonais (verão com 2x consumo) entram no cadastro público → outlier sempre
- Cooperado criado sem proposta → sem contrato → sem cobrança → usuário "perdido"
- Admin vê cooperado com status PENDENTE mas sem pista do que fazer

**Fix sugerido:**
```typescript
if (resultado.outlierDetectado && resultado.aguardandoEscolha) {
  return { 
    ok: false, 
    erro: 'OUTLIER_DETECTADO', 
    opcoes: resultado.opcoes, 
    cooperadoId, 
    ucId 
  };
}
```
Frontend então exibe modal de escolha (MEDIA_12M vs MES_RECENTE) e resubmete com `opcaoEscolhida`.

**Status: ABERTO 🟡 P2**

---

### 🟠 BUG-NEW-2026-04-17-005 — `ModalNovaUc` portal: Outlier sem UI de resolução (trava na etapa 1)
**Prioridade: P3 | Área: UX / Portal Cooperado**
**Arquivo:** `web/app/portal/ucs/page.tsx`

```typescript
// analisarFatura()
if (resp.outlierDetectado) {
  setOutlier(true);
  // ← não avança de etapa, não mostra opções
} else {
  setEtapa(2);
}

// No render: não há bloco `{outlier && <escolherOpcao />}`
// Etapa 1 com outlier=true → o formulário de upload ainda aparece, sem feedback de "escolha a base"
```

O estado `outlier=true` não tem UI correspondente. O cooperado vê o formulário de upload novamente sem entender o que aconteceu.

**Fix sugerido:** Adicionar bloco `{outlier && <OpcoesOutlier .../>}` entre etapa 1 e 2, similar ao Step3 do wizard admin.

**Status: ABERTO 🟠 P3**

---

### 🟠 BUG-NEW-2026-04-17-006 — `UcChart`: Gráfico de consumo sempre vazio
**Prioridade: P3 | Área: Frontend / Portal**
**Arquivo:** `web/app/portal/ucs/page.tsx`

```typescript
const cobrancas = res.data
  .filter((c: any) => c.kwhConsumido != null || c.kwhEntregue != null)
  // ← Modelo Cobranca não tem campos kwhConsumido ou kwhEntregue
  .slice(0, 6)
  .reverse();
```

O modelo `Cobranca` no Prisma usa campos `kwhEntregue` e `kwhConsumido`? Verificação: na API `/cooperados/meu-perfil/cobrancas`, o retorno são cobranças com `valorLiquido`, `valorMulta`, `valorJuros`, `valorAtualizado`, `dataVencimento`, `status` — não há `kwhEntregue` ou `kwhConsumido` no modelo `Cobranca`.

Resultado: o filtro sempre retorna array vazio → "Sem dados de consumo ainda" para todos os cooperados.

**Fix sugerido:** Usar dados de `kwhContrato` do `contrato` da cobrança, ou buscar `FaturaProcessada` para o histórico de kWh.

**Status: ABERTO 🟠 P3**

---

### 🟠 BUG-NEW-2026-04-17-007 — `DocumentosAprovacaoJob`: Cron horário sem escalonamento multi-tenant
**Prioridade: P3 | Área: Infraestrutura / Crons**
**Arquivo:** `backend/src/documentos/documentos-aprovacao.job.ts`

```typescript
@Cron('0 */1 * * *')  // ← a cada hora exata, em minuto 0
async processarAprovacaoAutomatica() {
  const cooperativas = await this.prisma.cooperativa.findMany({ where: { ativo: true } });
  for (const coop of cooperativas) {
    await this.processarCooperativa(coop.id, coop.nome);  // sequencial, sem paralelismo
  }
}
```

Novo cron não documentado no inventário de crons. Roda no minuto exato `0` de cada hora — coincide com outros crons que rodam `0 X * * *`. Para multi-tenant com muitas cooperativas ativas, o loop sequencial pode ser lento.

**Inventário atualizado (crons às horas exatas):**

| Cron | Horário | Observação |
|------|---------|------------|
| `documentos-aprovacao.job` | `0 */1 * * *` (toda hora) | **NOVO** — não documentado |
| `whatsapp-conversa.job:limpar` | a cada hora | OK (já documentado) |
| `calcularMultaJuros` | `0 3 * * *` | Cluster de 5 (persiste) |
| `convenios.job` | `0 3 * * *` | Cluster |
| `convite-indicacao.job lembretes` | `0 3 * * *` | Cluster |

**Status: ABERTO 🟠 P3**

---

### 🟠 BUG-NEW-2026-04-17-008 — `Step1Fatura`: Possível double-counting de ICMS no `encargosKwh`
**Prioridade: P3 | Área: Cálculo / Frontend**
**Arquivo:** `web/app/dashboard/cooperados/novo/steps/Step1Fatura.tsx`

```typescript
// Novo cálculo após commit 54de97e:
const tarifaSemICMS = tusdSemIcms + teSemIcms;
const tarifaBaseCalculo = tarifaSemICMS > 0 ? tarifaSemICMS : tarifaAneel;

const encargosKwh = tarifaBaseCalculo > 0
  ? tarifaBaseCalculo                                          // ← tarifa s/ ICMS
    + (getComponenteValor('icmsValor', ocr.icmsValor ?? 0) / consumo)        // ← + ICMS
    + (getComponenteValor('pisCofinsValor', ocr.pisCofinsValor ?? 0) / consumo) // ← + PIS/COFINS
    + (getComponenteValor('contribIluminacaoPublica', ...) / consumo)           // ← + CIP
    + (getComponenteValor('outrosEncargos', ...) / consumo)                      // ← + outros
  : valorKwh;
```

Quando `tarifaSemICMS = 0` (OCR não extraiu campos sem ICMS) e `tarifaAneel > 0` (busca do endpoint), a fórmula usa tarifa ANEEL (sem ICMS) como base e adiciona `icmsValor / consumo`. Isso é correto: tarifa ANEEL é a homologada pela ANEEL, sem tributos.

**Mas:** Se `tarifaSemICMS > 0` (OCR extraiu), `icmsValor` da fatura está em R$ totais para o consumo do mês, não por kWh. Dividir por `consumo` (kWh atual) não é equivalente a `tarifaTUSD × icmsPercentual`. Em meses com consumo atípico, o resultado pode divergir significativamente.

**Fix sugerido:** Usar `icmsPercentual × tarifaBaseCalculo` ao invés de `icmsValor / consumo`.

**Status: ABERTO 🟠 P3**

---

## 3. Análise de Fluxos — Wizards e Bot WhatsApp

### 3.1 Wizard Admin (T0 completo — 7 etapas) ✅ Entregue

| Etapa | Status |
|-------|--------|
| Step1 — Upload fatura + OCR | ✅ OK (fix tarifa ICMS no ciclo) |
| Step2 — Criar cooperado + UC | ✅ OK (trata email duplicado 409) |
| Step3 — Simulação via motor | ✅ OK (recalcula ao trocar plano) |
| Step4 — Aceitar proposta (motor real) | ✅ OK (propostaId persistido) |
| Step5 — Upload documentos | ✅ OK |
| Step6 — Análise docs + link assinatura | ✅ OK (NOTIFICACOES_ATIVAS guardado) |
| Step7 — Acompanhamento | ✅ OK |

⚠️ **Dívida técnica documentada no código:** `aceitar()` aceita `resultado` direto no body sem proposta PENDENTE prévia — insider-threat possível. T0 não fecha completamente essa lacuna.

### 3.2 Portal Cooperado — Nova UC (modal 3 etapas)

| Etapa | Status |
|-------|--------|
| Etapa 1 — Upload fatura + OCR | ✅ OK |
| Etapa 1 (outlier) | 🔴 Sem UI — trava sem feedback (BUG-005) |
| Etapa 2 — Simulação | ✅ OK quando sem outlier |
| Etapa 3 — Confirmar proposta | 🟡 Usa fallback 300kWh fictício (BUG-001) |
| Gráfico de consumo UcChart | 🟠 Sempre vazio (BUG-006) |

### 3.3 Cadastro Público v2 (`CADASTRO_V2_ATIVO=true`)

| Fluxo | Status |
|-------|--------|
| Validações CPF/telefone | ✅ OK (reativadas, guarda CADASTRO_VALIDACOES_ATIVAS) |
| Criação Cooperado + UC | ✅ OK (transação atômica) |
| Motor de proposta | ✅ OK quando sem outlier |
| Outlier detectado | 🟡 Silencioso — propostaId=null sem aviso (BUG-004) |
| Indicação (codigoRef) | ✅ OK (fire-and-forget) |
| Planos filtrados por tenant/público | ✅ OK (fix f296f34) |

### 3.4 Bot WhatsApp — Status (sem mudanças desde 15/04)

| Item | Status |
|------|--------|
| Áudio/vídeo/sticker | ✅ OK (fix 15/04 persiste) |
| stickerMessage no Baileys | 🟠 P3 (sem handler explícito — ainda persiste) |
| Secret WA env var | ✅ OK |

### 3.5 Aprovação Automática de Documentos (novo)

| Item | Status |
|------|--------|
| Feature toggle por tenant (ConfigTenant) | ✅ OK |
| Prazo configurável (`prazo_aprovacao_auto_horas`) | ✅ OK |
| Verificação de docs REPROVADO | ✅ OK |
| Verificação de docs ainda PENDENTE (não analisados) | 🟡 **AUSENTE (BUG-003)** |
| Cron `0 */1 * * *` | 🟠 P3 (não documentado no inventário) |

---

## 4. Inconsistências de Cálculo

### 4.1 Tarifa OCR — MELHORADO ✅ (fix 54de97e, a63d569)
- `tarifaTUSD / tarifaTE` agora claramente documentados como "c/ ICMS"
- `tarifaTUSDSemICMS / tarifaTESemICMS` adicionados (ANEEL, homologados)
- Prompt OCR instrui Claude a calcular sem-ICMS se fatura não separar: `tarifaTUSD / (1 + icmsPercentual/100)`
- Card na UI mostra ambas as tarifas para o admin
- ⚠️ `encargosKwh` pode ter double-counting quando `icmsValor` dividido por consumo (BUG-008 P3)

### 4.2 Multa/Juros — BUG-CALCULO-001 PERSISTE (P2)
Sem mudanças nas 3 implementações divergentes.

### 4.3 Proposta via portal — NOVO RISCO (P2)
`confirmar-nova-uc` pode criar proposta com 300 kWh ao invés do consumo real (BUG-001).

### 4.4 BONUS_INDICACAO — PERSISTE (P2)
Sem mudanças.

### 4.5 Filtro status ATIVO em cobranças/relatórios — CORRIGIDO ✅ (1f59ae0)
```typescript
// Agora filtram:
where: {
  contrato: { status: 'ATIVO', cooperado: { status: 'ATIVO' } }
}
```
Cobranças de cooperados desligados e contratos encerrados não aparecem mais.

### 4.6 Relatórios de inadimplência — CORRIGIDO ✅ (68a3bc4)
Filtro de cooperado ATIVO e contrato ATIVO aplicado em todos os relatórios.

### 4.7 Saúde financeira da usina — CORRIGIDO ✅ (12f5a97)
Filtra apenas contratos e cooperados ATIVOS.

---

## 5. Segurança

| Item | Status |
|------|--------|
| **DocumentosAprovacaoJob aprova sem revisão humana** | 🟡 **P2 NOVO** |
| **Proposta com consumo fictício 300kWh (portal)** | 🟡 **P2 NOVO** |
| contas-pagar: SUPER_ADMIN info leak | 🟡 P2 PERSISTE |
| contas-pagar: sem class-validator DTOs | 🟡 P2 PERSISTE |
| BONUS_INDICACAO idempotência sem cooperativaId | 🟡 P2 PERSISTE |
| aceitar() aceita resultado direto sem proposta PENDENTE prévia | 🟡 P2 DÍVIDA (documentada) |
| Validações CPF/nome cadastro público | ✅ RESOLVIDO (62cbdf8) |
| CORS `*` em whatsapp-service (porta 3002) | 🟠 P3 PERSISTE |
| stickerMessage sem handler no Baileys | 🟠 P3 PERSISTE |
| TOCTOU em contas-pagar update/delete | 🟠 P3 PERSISTE |
| Admin phone hardcoded no fallback env | 🟠 P3 PERSISTE |

---

## 6. Infraestrutura e Crons

| Cron | Horário | Status |
|------|---------|--------|
| `marcarVencidas` | 2h AM | ✅ OK |
| `CooperTokenJob.expirarTokensVencidos` | Dia 1 às 2h | ✅ OK |
| `calcularMultaJuros` | 3h AM | 🟠 Cluster de 5 (persiste) |
| `convenios.job:verificarConvenios` | 3h AM | 🟠 Cluster |
| `convite-indicacao.job:enviarLembretes` | 3h AM | 🟠 Cluster |
| `cooperados.job:limparProxyExpirados` | 3h AM | 🟠 Cluster |
| `cooperados.job:limparProxyZumbi` | 3h AM | 🟠 Cluster |
| **`documentos-aprovacao.job`** | **toda hora (minuto 0)** | **🟠 NOVO — não documentado** |
| `CooperTokenJob.apurarExcedentes` | 6h AM | 🟠 Conflito email-monitor |
| `email-monitor.verificarEmails` | 6h AM | 🟠 Conflito CooperToken |
| `cobrancas:notificarVencidas` | 6h15m AM | ✅ OK |
| `posicaoCooperado.job` | 7h AM | ✅ OK |
| `ClubeVantagensJob.enviarResumos` | Dia 1 às 9h | ✅ OK |
| `convite-indicacao.job:vencidos` | 10h AM | ✅ OK |
| `whatsapp-conversa.job:limpar` | A cada hora | ✅ OK |

---

## 7. Usabilidade

| Área | Observação |
|------|-----------|
| **Wizard Admin T0 (7 etapas)** | ✅ Fluxo completo entregue; Step2 trata CPF duplicado graciosamente |
| **Portal UCs — modal nova UC** | ⚠️ Outlier sem UI + gráfico sempre vazio + proposta com 300kWh fictícios |
| Cadastro público v2 | ✅ Funcional para casos normais; outlier silencioso quebra UX |
| Aprovação automática de docs | ⚠️ Feature configurável mas aprova sem revisão humana |
| Bot WhatsApp | ✅ Estável (sem mudanças) |
| ContaAPagar | ⚠️ P2s anteriores ainda abertos |
| Filtros de status cooperado/contrato ATIVO | ✅ Agora correto em relatórios e cobranças |

---

## 8. Resumo Executivo

### Score: 8.5/10 ↓ (−0.3 vs 8.8)

**Sprint monumental** — 52 commits, T0 a T10 completamente entregues em 2 dias. Wizard admin de 7 etapas funcionando end-to-end é o maior marco funcional do projeto. Cadastro público v2 e portal de UCs para o cooperado são diferenciais competitivos relevantes.

**Positivos ✅:**
- Wizard Admin T0→T10: fluxo completo cooperado/UC/proposta/docs/assinatura/alocação
- Cadastro público v2: cria Cooperado + UC + Proposta real em uma única jornada
- Portal UCs: cooperado pode adicionar UC com fatura via OCR
- Filtros de status ATIVO: relatórios e cobranças agora corretos
- Tarifa OCR melhorada: separação com/sem ICMS, card informativo para admin

**Preocupações ⚠️:**
- 🟡 `confirmar-nova-uc` cria proposta com 300 kWh fictícios (cooperado prejudicado)
- 🟡 `DocumentosAprovacaoJob` aprova automaticamente sem revisão humana
- 🟡 Cadastro v2 com outlier: propostaId=null silencioso (cooperado "perdido")
- 🟡 UC criada sem rollback se motor falhar
- 🟠 Portal UCs: gráfico sempre vazio + outlier sem UI
- 🟡 4 P2s anteriores (contas-pagar) ainda abertos

**Prioridade sugerida para próximo sprint:**
1. BUG-NEW-2026-04-17-003 — DocumentosAprovacaoJob: checar se docs foram analisados (2h)
2. BUG-NEW-2026-04-17-001 — confirmar-nova-uc: usar dados OCR da etapa anterior (3h)
3. BUG-NEW-2026-04-17-004 — cadastroWebV2 outlier: retornar erro explícito (1h)
4. BUG-NEW-2026-04-15-002 — contas-pagar SUPER_ADMIN info leak (1h)
5. BUG-NEW-2026-04-17-006 — UcChart: campos corretos para gráfico (1h)

---

## 9. Bugs Ativos Pós-Ciclo 17/04/2026

| ID | Bug | Prioridade | Sprint |
|----|-----|------------|--------|
| **BUG-NEW-2026-04-17-001** | **confirmar-nova-uc: proposta com 300kWh fictícios (sem fatura prévia)** | **P2** | **Urgente** |
| **BUG-NEW-2026-04-17-002** | **novaUcComFatura: UC criada sem rollback se motor falhar** | **P2** | **Próximo** |
| **BUG-NEW-2026-04-17-003** | **DocumentosAprovacaoJob: aprova sem verificar se docs foram analisados** | **P2** | **Urgente** |
| **BUG-NEW-2026-04-17-004** | **cadastroWebV2: outlier silencioso — propostaId=null sem feedback** | **P2** | **Próximo** |
| BUG-NEW-2026-04-15-001 | contas-pagar: sem class-validator DTOs | P2 | Próximo |
| BUG-NEW-2026-04-15-002 | contas-pagar: SUPER_ADMIN info leak inter-tenant | P2 | Próximo |
| BUG-NEW-2026-04-11-003 | BONUS_INDICACAO idempotência sem cooperativaId | P2 | Próximo |
| BUG-CALCULO-001 | Arredondamento multa/juros: 3 implementações divergentes | P2 | Backlog |
| BUG-NEW-2026-04-17-005 | ModalNovaUc: outlier sem UI de resolução (trava etapa 1) | P3 | Próximo |
| BUG-NEW-2026-04-17-006 | UcChart: gráfico de consumo sempre vazio (campos inexistentes) | P3 | Próximo |
| BUG-NEW-2026-04-17-007 | DocumentosAprovacaoJob: cron horário não documentado no inventário | P3 | Backlog |
| BUG-NEW-2026-04-17-008 | Step1Fatura: encargosKwh pode ter double-counting de ICMS | P3 | Backlog |
| BUG-NEW-2026-04-15-003 | TOCTOU em contas-pagar update/delete | P3 | Backlog |
| BUG-NEW-2026-04-15-004 | Status ATRASADO sem cron automático em ContaAPagar | P3 | Próximo |
| BUG-NEW-2026-04-15-005 | 5 crons simultâneos às 3h AM | P3 | Backlog |
| BUG-NEW-2026-04-13-004 | N+1 queries no histórico do relatório mensal | P3 | Backlog |
| BUG-NEW-2026-04-13-005 | valorSemGD usa tarifa circular (inflada) | P3 | Backlog |
| BUG-NEW-2026-04-11-004 | Multa inconsistente em reenviarNotificacao | P3 | Backlog |
| BUG-NEW-2026-04-12-004 | Admin phone hardcoded no fallback env | P3 | Backlog |

---

*Próxima análise automática: 18/04/2026 às 03h*
