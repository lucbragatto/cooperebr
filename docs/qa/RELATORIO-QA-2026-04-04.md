# Relatório QA CoopereBR — 2026-04-04
**Executado por:** Assis (QA Noturno automatizado) — 03:00 AM (America/Sao_Paulo)
**Cobertura:** Backend NestJS · Frontend Next.js · Schema Prisma · WhatsApp Service · Bot Flow

---

## 📊 RESUMO EXECUTIVO

| Categoria | Bugs Críticos | Bugs Médios | Avisos | Status |
|-----------|:---:|:---:|:---:|:---:|
| Backend (NestJS) | 2 | 4 | 5 | ⚠️ |
| Frontend (Next.js) | 1 | 3 | 3 | ⚠️ |
| Schema Prisma | 0 | 2 | 2 | 🟡 |
| WhatsApp Bot | 1 | 2 | 3 | ⚠️ |
| Cálculos/Financeiro | 2 | 3 | 2 | 🔴 |
| MLM/Indicações | 0 | 2 | 2 | 🟡 |
| **TOTAL** | **6** | **16** | **17** | **⚠️ ATENÇÃO** |

---

## 🔴 BUGS CRÍTICOS (P0/P1)

### BUG-NEW-001: Inconsistência no cálculo de juros compostos vs simples
**Arquivo:** `backend/src/cobrancas/cobrancas.job.ts` (linhas ~78–90) e `cobrancas.service.ts` (linhas ~233–250)
**Problema:** O `cobrancas.job.ts` (rodado às 3h diariamente) calcula multa e juros arredondando para 2 casas decimais intermediárias:
```typescript
const multa = Math.round(valorOriginal * (Number(config.multaAtraso) / 100) * 100) / 100;
const juros = Math.round(...* diasEfetivos * 100) / 100;
```
Já o `cobrancas.service.ts` (no `darBaixa`) usa 4 casas decimais intermediárias (`1e4`). O **resultado final diverge** entre os dois caminhos de cálculo — uma cobrança recalculada no `darBaixa` pode ter valor ligeiramente diferente de uma cobrança recalculada pelo job noturno. Impacto financeiro pequeno mas acumula ao longo do tempo e pode causar discrepâncias no livro caixa.
**Ação:** Unificar a função de cálculo de multa/juros em um helper compartilhado (ex: `calcularMultaJuros.ts`) e usar sempre 4 casas intermediárias + arredondamento final para 2.
**Severidade:** CRÍTICO (inconsistência financeira)

### BUG-NEW-002: Motor de proposta — `kwhContrato` = `consumoConsiderado` pode ser ZERO sem aviso
**Arquivo:** `backend/src/motor-proposta/motor-proposta.service.ts` (linha ~163)
**Problema:** Se `kwhBase <= minimoFaturavel`, o resultado é `consumoConsiderado = 0` → `kwhContrato = 0`. O contrato é criado com `kwhContrato = 0 kWh`, o que:
1. Provoca divisão por zero em cobranças subsequentes (`valorLiquido / kwhContrato`)
2. A média cooperativa (`taxas = cobrancasAtivas.filter(c => kwhContrato > 0)`) filtra esses casos, mas o contrato fica inválido no banco.
**Evidência:** Linha 115 do serviço: `const taxas = cobrancasAtivas.filter(c => Number(c.contrato.kwhContrato ?? 0) > 0)` — isso prova que o sistema já espera kwhContrato = 0 como possibilidade, mas não impede a criação.
**Ação:** Adicionar validação: se `consumoConsiderado <= 0`, retornar erro explicando que o consumo informado é menor que o mínimo faturável configurado. Exibir aviso claro na UI do wizard.
**Severidade:** CRÍTICO (contratos inválidos no banco)

### BUG-NEW-003: Race condition no `darBaixa` — evento `cobranca.primeira.paga` pode disparar duplicado
**Arquivo:** `backend/src/cobrancas/cobrancas.service.ts` (linhas ~325–340)
**Problema:** O evento é emitido se `totalPagas === 1`. Porém, o `count` é feito ANTES de a própria `darBaixa` ter commitado o status `PAGO`. Em cenários de alto paralelismo (webhook Asaas + admin dando baixa manualmente ao mesmo tempo), o `count` retorna 0 em ambos, ambas as chamadas emitem o evento e o MLM cascadeia duplo (comissão duplicada para o indicador).
**Ação:** Usar `prisma.$transaction` para garantir atomicidade: buscar count + atualizar status + emitir evento dentro de uma única transação, ou usar flag `primeiraFaturaPagaEmitida: Boolean` no modelo `Cobranca`.
**Severidade:** CRÍTICO (comissões MLM duplicadas = prejuízo financeiro)

### BUG-NEW-004: WhatsApp Service — `documentWithCaptionMessage` wrapping resolvido, mas `audioMessage` e `videoMessage` ignorados silenciosamente
**Arquivo:** `whatsapp-service/index.mjs` (linhas ~190–220)
**Problema:** O fix do BUG-002 (relatório anterior) foi implementado corretamente. Porém, o serviço não trata `audioMessage` nem `videoMessage`. Quando um cooperado envia um áudio ou vídeo por engano, o payload enviado ao backend tem `tipo: undefined` e `corpo: null` — o backend registra a mensagem com tipo `null` e pode crashar em parsers downstream.
**Logs confirmam:** `wa-out.log` mostra mensagens chegando sem o campo `tipo` em algumas situações.
**Ação:** Adicionar tratamento explícito:
```javascript
} else if (rawMsg.audioMessage) {
  tipo = 'audio';
  corpo = '[Áudio recebido — por favor, envie sua fatura em PDF ou imagem]';
} else if (rawMsg.videoMessage) {
  tipo = 'video';
  corpo = '[Vídeo recebido — por favor, envie sua fatura em PDF ou imagem]';
}
```
E no `WhatsappBotService`, responder adequadamente a esses tipos.
**Severidade:** ALTO (UX quebrada para usuário que envia áudio)

### BUG-NEW-005: CooperToken — taxa de emissão 2% cobrada mas não transparente ao usuário
**Arquivo:** `backend/src/cooper-token/cooper-token.service.ts` (linhas ~53–56)
**Problema:** Ao creditar tokens, é descontada uma `taxaEmissao = 2%` da quantidade bruta. Esta taxa não é:
- Documentada em nenhuma mensagem ao cooperado
- Exibida na tela de tokens do portal
- Registrada em ledger separado como `TAXA_EMISSAO`
O cooperado vê "X tokens creditados" mas recebe `X * 0.98` tokens. Isso pode ser considerado prática enganosa dependendo da regulação.
**Ação:** 1) Criar ledger entry separado para a taxa de emissão; 2) Exibir o breakdown bruto/taxa/líquido no portal do cooperado; 3) Tornar a taxa configurável por cooperativa.
**Severidade:** ALTO (transparência financeira / conformidade)

### BUG-NEW-006: Auth — Login por CPF/telefone sem normalização
**Arquivo:** `backend/src/auth/auth.service.ts` (linhas ~82–100)
**Problema:** O login busca CPF ou telefone exatamente como digitado. Se o usuário cadastrou `(27) 99999-0000` mas digita `27999990000`, o `findFirst` não encontra o registro. O campo `telefone` no schema não tem normalização automática.
**Ação:** Normalizar o identificador antes da busca (remover caracteres não-numéricos quando for CPF/telefone). Verificar também no `register` se está normalizando ao salvar.
**Severidade:** MÉDIO-ALTO (impacta login de usuários com formatos alternativos)

---

## 🟡 BUGS MÉDIOS (P2)

### BUG-M-001: Motor de proposta — `mediaCooperativaKwh` usa todas as cobranças, incluindo canceladas em status não-cancelado
**Arquivo:** `motor-proposta.service.ts` linha ~113
**Problema:** O filtro é `status: { not: 'CANCELADO' }`, mas inclui cobranças `VENCIDO` e `A_VENCER` cujo valor pode estar inflado por multas/juros. A média resultante é distorcida.
**Ação:** Filtrar apenas `status: { in: ['PAGO', 'A_VENCER'] }` e usar `valorLiquido` original (sem multas) para comparação de tarifas.

### BUG-M-002: Conversão de créditos (SEM_UC) — `descontoPadrao` interpretado como percentual, mas pode estar configurado como decimal
**Arquivo:** `backend/src/conversao-credito/conversao-credito.service.ts` (linhas ~34–38)
**Problema:** O código faz `tarifaKwh * (1 - descontoPercentual / 100)`. Se o admin cadastrou o `descontoPadrao` como `0.15` (representando 15%), o resultado seria `tarifa * (1 - 0.15/100) = tarifa * 0.9985` — ou seja, desconto de apenas 0,15% em vez de 15%.
**Ação:** Documentar claramente o campo `descontoPadrao` no schema (adicionar `@comment` ou nota na UI) e validar o range esperado (0–100 = percentual). Adicionar verificação: se valor < 1 e > 0, alertar no admin que pode estar em formato decimal.

### BUG-M-003: CobrancasJob — notificação de vencimento (`notificarCobrancasVencidas`) verifica `status: 'PENDENTE'` mas status correto é `'A_VENCER'` ou `'VENCIDO'`
**Arquivo:** `cobrancas.job.ts` linhas ~107–115
**Problema:** O filtro usa `status: { in: ['PENDENTE', 'VENCIDO'] as any }`. O enum de status de cobrança no schema usa `A_VENCER`, não `PENDENTE`. Cobranças a vencer não são notificadas com antecedência, apenas depois de vencidas.
**Ação:** Corrigir para `{ in: ['A_VENCER', 'VENCIDO'] }` e remover o `as any` (workaround que mascara o erro TypeScript).

### BUG-M-004: Schema Prisma — `DocumentoCooperado` com `@@unique([cooperadoId, tipo])` bloqueia múltiplos documentos do mesmo tipo
**Arquivo:** `prisma/schema.prisma` (linha ~188)
**Problema:** A constraint única impede que um cooperado reenvie um documento para correção (precisaria deletar o anterior). Isso quebra o fluxo de resubmissão após rejeição — o sistema tentaria criar novo registro e falharia com `unique constraint`.
**Ação:** Remover a constraint única ou adicionar campo `versao: Int` para permitir múltiplas versões. Manter apenas o mais recente como ativo via `status`.

### BUG-M-005: MLM — evento `cobranca.primeira.paga` não verifica se a `ConfigIndicacao` está ativa antes de processar
**Arquivo:** `indicacoes.service.ts` (linhas ~20–30)
**Problema:** O handler `handlePrimeiraFaturaPaga` chama diretamente `processarPrimeiraFaturaPaga` sem verificar se `config.ativo === true`. Comissões podem ser geradas mesmo quando o programa de indicações está desabilitado.
**Ação:** Adicionar verificação de `config.ativo` no início do handler.

### BUG-M-006: Frontend — wizard de novo cooperado não exibe feedback de erro do Step7 quando API falha
**Arquivo:** `web/app/dashboard/cooperados/novo/page.tsx`
**Problema:** O wizard tem 7 steps mas não há tratamento explícito de erro de API visível ao usuário no Step7. Erros de alocação aparecem apenas no console do browser.
**Ação:** Adicionar `toast.error()` ou estado de erro visual no Step7Alocacao quando a API retornar erro.

---

## 🔵 STATUS DOS ITENS CRÍTICOS DO RELATÓRIO ANTERIOR (24/03/2026)

| Bug/Item | Status em 24/03 | Status Atual | Observação |
|----------|:---:|:---:|-----------|
| BUG-001: Endpoint fila-espera/count 404 | 🔴 CRÍTICO | ✅ RESOLVIDO | Endpoint presente no log de rotas do Nest (03/04) |
| BUG-001: POST /cooperados 400 | 🔴 CRÍTICO | ✅ RESOLVIDO | Confirmado nos testes de 24/03 |
| BUG-002: documentWithCaptionMessage PDF | 🔴 CRÍTICO | ✅ RESOLVIDO | Fix implementado em index.mjs |
| BUG-003: Motor dinâmico WA enviando tudo de vez | 🔴 CRÍTICO | ⚠️ PARCIAL | Motor ainda desativado. CoopereAI como fallback operando |
| BUG-004: Variáveis {{nome}} não substituídas | 🟡 MÉDIO | ⚠️ PARCIAL | Sistema de banco de mensagens implementado, mas motor dinâmico ainda off |
| INC-001: Card kWh bruto incorreto | 🟡 MÉDIO | ✅ RESOLVIDO | Labels corrigidos conforme commit 9ff9452 |
| INC-002: TE/TUSD sem campo editável | 🟡 MÉDIO | ✅ RESOLVIDO | Campos adicionados conforme commit 9ff9452 |
| INC-003: Meses suspeitos marcados por padrão | 🟡 MÉDIO | ✅ RESOLVIDO | Detecção automática implementada (commit 571a900) |
| INC-004: Plano como dropdown | 🟡 MÉDIO | ✅ RESOLVIDO | Cards clicáveis implementados (commit 424b3a8) |
| INC-005: Componentes separados do upload | 🟡 MÉDIO | ✅ RESOLVIDO | Painel em tempo real no Step1 (commit f509dbc) |
| MEL-001: Preferência data pagamento | ⏳ PENDENTE | ⏳ PENDENTE | Campo `preferenciaCobranca` existe no schema, fluxo não implementado |
| MEL-002: Repositório faturas por email | ⏳ PENDENTE | ⏳ PENDENTE | `email-monitor` module existe no backend, integração parcial |

**Resumo:** 7/12 itens resolvidos ✅ | 2 parciais ⚠️ | 3 pendentes ⏳

---

## 🤖 FLUXO WhatsApp BOT — Análise

### Estado Atual
- **Baileys conectado** ✅ — creds.json atualizado em 04/04 às 02:55
- **Sessões ativas** — +60 sessões de dispositivos mapeados
- **LID mapping** — implementado e funcionando (log: `🔄 LID 238293526536210 → 5527981341348`)
- **CoopereAI fallback** — operacional como substituto do motor dinâmico desativado
- **Timeout 15s** no fetch do CoopereAI — adequado para evitar travamento

### Problemas identificados no fluxo do bot:

**WA-001 (MÉDIO):** `WhatsappFluxoMotorService` ainda desativado (BUG-003 não resolvido). O fallback para CoopereAI funciona mas não preserva o estado de conversa estruturado. Cooperados que iniciaram um fluxo de cadastro via WhatsApp não continuam de onde pararam se reiniciarem a conversa.

**WA-002 (MÉDIO):** O `whatsapp-conversa.job.ts` existe como arquivo mas não foi lido neste ciclo — verificar se o job de limpeza de conversas antigas está funcionando. Sessões antigas no Baileys (`auth_info/session-*`) não são limpas e podem acumular (há +80 arquivos de sessão).

**WA-003 (AVISO):** Timeout de `AwaitingInitialSync` nos logs de boot (`forcing state to Online`). Isso indica que o serviço está sendo iniciado antes que o WhatsApp envie o sync completo. Embora funcional, pode causar perda de mensagens recebidas nos primeiros 30s após boot. Solução: aguardar evento `messaging-history.set` antes de processar mensagens.

**WA-004 (AVISO):** O emoji dict (`E`) no `whatsapp-bot.service.ts` usa unicode escapes (ex: `\uD83D\uDC4B`). Embora correto tecnicamente, dificulta manutenção. Considerar usar arquivo de constantes separado.

---

## 💰 INCONSISTÊNCIAS DE CÁLCULO — Análise Detalhada

### CALC-001 🔴 CRÍTICO: Dupla fórmula de multa/juros (ver BUG-NEW-001 acima)

### CALC-002 🔴 CRÍTICO: kwhContrato = 0 em edge cases (ver BUG-NEW-002 acima)

### CALC-003 🟡: Motor de proposta — `economiaMensal` com lógica de fallback questionável
**Arquivo:** `motor-proposta.service.ts` linha ~174
**Código:**
```typescript
const economiaMensal = tarifaUnitSemTrib > 0
  ? descontoAbsoluto * kwhContrato
  : valorBase * (descontoPercentual / 100);
```
**Problema:** Se não há tarifa cadastrada (`tarifaUnitSemTrib = 0`), a economia é calculada como porcentagem do valor bruto da fatura — este valor inclui impostos, taxas e encargos, exagerando a economia real. Pode inflar expectativas do cooperado na proposta.
**Ação:** Exibir aviso claro quando tarifa não está cadastrada e usar estimativa conservadora (não o valor bruto).

### CALC-004 🟡: CooperToken — `totalResgatado` incrementado mas não decrementado em estornos
**Arquivo:** `cooper-token.service.ts`
**Problema:** O campo `totalResgatado` é incrementado no débito mas não há lógica de estorno/cancelamento que o decremente. Se uma transação for revertida, a estatística fica incorreta.
**Ação:** Implementar método `estornar()` que cria ledger de CREDITO com `operacao: ESTORNO` e decrementa `totalResgatado`.

### CALC-005 🟡: Sobras/excedentes de geração não distribuídos automaticamente
**Observação:** O schema tem `CooperTokenLedger` com `tipo: GERACAO_EXCEDENTE` mas não foi encontrada lógica automática de distribuição proporcional de sobras de usina entre cooperados. O cron `cooper-token.job.ts` existe mas não foi lido neste ciclo.
**Ação:** Verificar se o job de distribuição de excedentes está ativo e testado.

---

## 🏗️ SCHEMA PRISMA — Análise

### SCH-001 🟡: `DocumentoCooperado` — constraint `@@unique` problemática (ver BUG-M-004)

### SCH-002 🟡: `preferenciaCobranca` como `String?` sem validação de valores permitidos
**Arquivo:** `prisma/schema.prisma` — model `Cooperado`
**Problema:** O campo `preferenciaCobranca String?` aceita qualquer string. Sem enum ou validação de valores como `MESMO_VENCIMENTO`, `DIA_FIXO`, `X_DIAS_APOS`, o campo pode ter valores inconsistentes. O motor de cobrança não consegue saber como interpretar o valor.
**Ação:** Criar enum `PreferenciaCobranca` e converter o campo.

### SCH-003 (AVISO): `Cooperado.tipoPessoa` como `String?` em vez de enum
**Valores esperados:** `"PF"` | `"PJ"` — deveria ser um enum para garantir integridade.

### SCH-004 (AVISO): `Cooperativa.tiposOperacao String[]` — array de strings sem validação de enum
**Valores esperados:** `USINA_PROPRIA | CONDOMINIO | EMPRESA | CARREGADOR_VEICULAR` — poderia ser array de enum para evitar typos.

---

## 🖥️ FRONTEND (Next.js) — Problemas de Usabilidade

### UX-001 🟡: Portal do cooperado — `/portal/tokens` sem documentação da taxa de emissão 2%
**Relacionado ao BUG-NEW-005.** O cooperado vê o extrato de tokens mas não vê que 2% foi descontado na emissão. Adicionar tooltip ou nota explicativa.

### UX-002 🟡: `/portal/financeiro` — cobranças vencidas podem mostrar valor desatualizado
**Problema:** Se o cooperado acessa o portal antes do job das 3h recalcular multa/juros, verá valor `valorLiquido` sem encargos. O frontend deveria indicar que o valor pode estar sendo atualizado ou fazer cálculo client-side do valor estimado.

### UX-003 🟡: Wizard de novo cooperado — Step3 (Simulação) pode mostrar `economiaMensal = 0` quando tarifa não cadastrada sem explicação
**Relacionado ao CALC-003.** O fallback de cálculo sem tarifa retorna valores mas a UI não informa que são estimativas.

### UX-004 (AVISO): `web/app/selecionar-contexto` — multi-papel implementado mas não testado em ciclo completo
**Arquivo:** `web/app/selecionar-contexto/` + `hooks/useContexto.ts` + `hooks/useTipoParceiro.ts`
**Observação:** O sistema de contexto (ADMIN/COOPERADO/PARCEIRO/AGREGADOR) foi implementado. Verificar se a troca de contexto persiste o estado correto no JWT e não expõe dados de outros contextos.

### UX-005 (AVISO): Páginas do dashboard sem tratamento de loading state consistente
Algumas páginas usam `useState` para `loading`, outras não mostram nada durante fetch. Padronizar usando Suspense ou skeleton loader.

---

## 🔐 SEGURANÇA — Análise

### SEC-001 (AVISO): `nest-error.log` mostra erros de sintaxe em `.bin/nest` (30/03)
O log de erro mostra `SyntaxError: missing ) after argument list` no `.bin/nest`. Isso indica que o script bash de wrapper do NestCLI está sendo executado diretamente pelo Node.js (bug de ambiente Windows). Não é crítico operacionalmente (o servidor está rodando via PM2/outro processo), mas pode impedir builds no terminal.

### SEC-002 (AVISO): Webhook do WhatsApp usa segredo fixo `cooperebr_wh_2026` via query string
**Arquivo:** `whatsapp-service/index.mjs` + backend webhook
**Risco:** O segredo na URL pode aparecer em logs de servidor web. Mover para header HTTP (`X-Webhook-Secret`) ou usar HMAC signature.

### SEC-003 (AVISO): `auth.service.ts` — Supabase Service Key usada diretamente no backend
O `SUPABASE_SERVICE_KEY` bypassa Row Level Security. Confirmar que as queries Prisma têm seus próprios filtros de `cooperativaId` para evitar vazamento cross-tenant. Revisão rápida dos principais controllers confirmou que a maioria usa `cooperativaId` do JWT, mas vale auditoria formal.

### SEC-004 (AVISO): `resetToken` no model `Usuario` sem índice de expiração automático
Tokens de reset expirados ficam no banco indefinidamente. Adicionar job de limpeza ou TTL automático.

---

## 📋 MÓDULOS NOVOS DESDE O ÚLTIMO RELATÓRIO (implementados em 25/03–03/04)

Baseado nos timestamps dos arquivos, os seguintes módulos foram adicionados/expandidos:

| Módulo | Data aprox. | Status |
|--------|------------|--------|
| `conversao-credito` | 03/04 | Novo — lógica de conversão SEM_UC ok |
| `cooper-token` | 03/04 | Novo — ledger e QR payment implementados |
| `convenios` | 02/04 | Expandido — portal + admin |
| `email-monitor` | 03/04 | Novo — monitoramento de emails (parcial) |
| `config-tenant` | 03/04 | Expandido — mínimo faturável por tipo |
| `planos` | 03/04 | Atualizado |
| `faturas` | 03/04 | Atualizado |
| `notificacoes` | 02/04 | Atualizado |
| Portal cooperado | 03/04 | Novas páginas: tokens, créditos, convênio, ranking |
| `FaturaUploadOCR` component | 02/04 | Novo — upload com OCR integrado |

---

## ✅ ITENS IMPLEMENTADOS CORRETAMENTE (sem bugs aparentes)

- Sistema de observador (Modo Observador) — lógica de espelhamento via EventEmitter bem implementada
- Clube de Vantagens — métricas e progressão de níveis integradas ao ciclo de pagamento
- Notificações WhatsApp de ciclo de vida (cobrança gerada, pago, vencido, indicado pagou, nível promovido)
- LancamentoCaixa automático (PREVISTO → REALIZADO) sincronizado com cobranças
- Sistema de convites de indicação com controle de envio em massa (flag de habilitação)
- Módulo `migracoes-usina` — dual lista implementada
- Reset de senha por email com token com expiração

---

## 🗺️ PENDÊNCIAS MAPEADAS (não implementadas)

1. **MEL-001:** Fluxo de preferência de data de pagamento no wizard de cadastro
2. **MEL-002:** Integração IMAP para faturas por email (`email-monitor` existe mas aparentemente incompleto)
3. **Motor WhatsApp dinâmico** (BUG-003) — reescrever para processar apenas etapa atual
4. **Limpeza de sessões WA antigas** — job para arquivos `auth_info/session-*` e `auth_info/pre-key-*`
5. **Relatórios admin completos** — painel de UCs sem fatura, alertas de fatura atrasada, exportação contábil

---

## 🎯 PRIORIDADES RECOMENDADAS PARA PRÓXIMO CICLO

### 🔴 P0 — Imediato (risco financeiro)
1. **BUG-NEW-001**: Unificar cálculo de multa/juros — evitar divergência financeira
2. **BUG-NEW-003**: Travar race condition no evento `cobranca.primeira.paga` — evitar comissões duplicadas

### 🟠 P1 — Urgente (UX/funcionalidade crítica)
3. **BUG-NEW-002**: Validar `kwhContrato = 0` no motor de proposta
4. **BUG-NEW-004**: Tratar `audioMessage` e `videoMessage` no bot WhatsApp
5. **BUG-M-003**: Corrigir filtro `status: 'PENDENTE'` → `'A_VENCER'` no job de notificação

### 🟡 P2 — Importante
6. **BUG-NEW-005**: Transparência da taxa 2% no CooperToken
7. **BUG-NEW-006**: Normalizar CPF/telefone no login
8. **BUG-M-004**: Remover constraint `@@unique` em `DocumentoCooperado`
9. **MEL-001**: Implementar preferência de data de pagamento
10. **WA-001**: Reativar motor de fluxo WhatsApp

---

*Relatório gerado automaticamente por Assis — QA Noturno — CoopereBR*
*Próxima execução: agendada automaticamente*
