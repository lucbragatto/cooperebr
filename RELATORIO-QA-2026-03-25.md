# Relatório QA — CoopereBR
**Data:** 2026-03-25
**Período analisado:** commits de 20/03/2026 a 25/03/2026 (54 commits)
**Módulos:** WhatsApp CRM, Wizard Membro/Parceiro, MLM, Livro Caixa, Dashboard Usina/Parceiro, Financeiro, Asaas, Segurança
**Score geral de qualidade: 5.2 / 10**

---

## 1. STATUS DOS ITENS CRÍTICOS DO RELATÓRIO ANTERIOR

| ID | Descrição | Status | Observação |
|----|-----------|--------|------------|
| SEC-01 | JWT secret hardcoded | **CORRIGIDO** | `jwt-secret.ts` lê `JWT_SECRET` do env e lança erro se ausente. Sem fallback hardcoded. |
| SEC-02 | SUPER_ADMIN sem guard | **CORRIGIDO** | `RolesGuard` global via `APP_GUARD`. `criar-super-admin` exige `SUPER_ADMIN_SECRET_KEY` com `timingSafeEqual`. Rate limit 3 req/60s. |
| INC-02 | Race condition percentualUsina | **CORRIGIDO** | `contratos.service.ts:8` — constante `SERIALIZABLE_TX`. Usado em `create()` (L123-194) e `update()` (L240-254). |
| DT-02 | Transações Prisma multi-tabela | **PARCIAL** | `create/update` de contratos usa transação. **MAS `ativar()` (L285-310) NÃO usa** — atualiza contrato, cooperado e cria notificação sem transaction. Falha parcial deixa estado inconsistente. |

---

## 2. BUGS NOVOS POR MÓDULO

### 2.1 WhatsApp / CRM / Bot

| # | Severidade | Bug | Arquivo | Linha |
|---|-----------|-----|---------|-------|
| WA-01 | **CRÍTICA** | Race condition na criação de conversa: `findUnique` + `create` sem `upsert` — duas mensagens simultâneas criam conversas duplicadas ou corrompem estado | whatsapp-bot.service.ts | 73-80 |
| WA-02 | **CRÍTICA** | Busca por telefone usa `contains` + `slice(-8)` — últimos 8 dígitos podem casar com múltiplos cooperados (ex: "99999999" casa com DDD 27 e 11) | whatsapp-bot.service.ts | 376, 470 |
| WA-03 | **CRÍTICA** | `getStatus()` não verifica `res.ok` — se serviço WhatsApp está offline, `res.json()` falha e frontend fica preso em "Verificando..." | whatsapp-sender.service.ts | 11-14 |
| WA-04 | **CRÍTICA** | Webhook retorna `{ ok: true }` antes de processar mensagem (`processarMensagem` não é awaited) — falhas silenciosas sem retry | whatsapp-fatura.controller.ts | 50-52 |
| WA-05 | **CRÍTICA** | `formatarTelefone()` não valida tamanho final — input "123" vira "55123" e é enviado à API | whatsapp-cobranca.service.ts | 185-193 |
| WA-06 | **ALTA** | Motor de fluxo dinâmico desativado (TODO) — `FluxoEtapa` é persistida mas ignorada; desperdício de escrita | whatsapp-bot.service.ts | 97-104 |
| WA-07 | **ALTA** | `disparoId` nunca populado nas mensagens — impossível vincular mensagem a campanha | whatsapp-sender.service.ts | 79 |
| WA-08 | **ALTA** | Sem timeout para conversas em estado `AGUARDANDO_*` — conversas mortas acumulam indefinidamente | whatsapp-bot.service.ts | — |
| WA-09 | **ALTA** | MLM convite: se `upsert` falha após envio, `mlmConviteEnviadoEm` não é gravado → mensagem duplicada no próximo ciclo | whatsapp-mlm.service.ts | 122-126 |
| WA-10 | **ALTA** | Endpoint `entrada-indicado` é `@Public()` sem validação de payload — permite poluição do banco com dados arbitrários | whatsapp-fatura.controller.ts | 275-280 |
| WA-11 | **ALTA** | `.catch(() => {})` suprime falhas de notificação MLM — indicador nunca sabe que indicação foi concluída | whatsapp-bot.service.ts | 553, 565 |
| WA-12 | **MÉDIA** | Templates por cooperativa ignorados — `msg()` não passa `cooperativaId` ao buscar modelo | whatsapp-bot.service.ts | 35-51 |
| WA-13 | **MÉDIA** | Criação de UC sem transação — conversa atualizada mas UC pode não ser criada | whatsapp-bot.service.ts | 513-534 |
| WA-14 | **BAIXA** | WhatsApp service CORS `Access-Control-Allow-Origin: *` — vulnerável a CSRF se exposto | whatsapp-service/index.mjs | 154-160 |

### 2.2 Wizard Membro (7 passos)

| # | Severidade | Bug | Arquivo | Linha |
|---|-----------|-----|---------|-------|
| WZ-01 | **CRÍTICA** | Steps 3-6 sem validação no parent — `return null` em todos; usuário avança sem simulação, proposta, documentos ou contrato | cooperados/novo/page.tsx | 185-193 |
| WZ-02 | **CRÍTICA** | Step 7 usa `simulacao?.desconto ?? 15` — se Step 3 pulado, aplica 15% desconto fixo silenciosamente, sem consentimento | Step7Alocacao.tsx | 159 |
| WZ-03 | **CRÍTICA** | `cooperativaId` não é passado na criação do cooperado — membro criado sem vínculo com cooperativa | Step7Alocacao.tsx | 105 |
| WZ-04 | **ALTA** | Falha de lista de espera ignorada com `catch(() => {})` — cooperado sem vaga fica em limbo | Step7Alocacao.tsx | 170-174 |
| WZ-05 | **ALTA** | State do wizard perdido se usuário navega para fora (sem localStorage/sessionStorage) | cooperados/novo/page.tsx | — |
| WZ-06 | **MÉDIA** | Step 6 contrato usa `setTimeout(1000)` mock para assinatura — não há verificação real | Step6Contrato.tsx | 30 |

### 2.3 Wizard Parceiro (9 passos)

| # | Severidade | Bug | Arquivo | Linha |
|---|-----------|-----|---------|-------|
| WP-01 | **CRÍTICA** | Step 3 (Lista Espera) usa `cooperativaId` undefined — cooperativa só é criada no Step 9; API chamada com param vazio | Step3Espera.tsx | 20 |
| WP-02 | **ALTA** | Step 7 (Banco) permite seleção múltipla de bancos com checkbox — BB e Sicoob ao mesmo tempo sem lógica de prioridade | Step7Banco.tsx | 88 |
| WP-03 | **ALTA** | Step 9 (`handleAtivarParceiro`) não tem rollback — se step 3+ falha após step 2 OK, dados ficam parcialmente criados | parceiros/novo/page.tsx | 123-197 |
| WP-04 | **MÉDIA** | CNPJ validado apenas por tamanho (14 dígitos), sem validação de dígitos verificadores | Step1Dados.tsx | 96 |
| WP-05 | **MÉDIA** | Step 6 Asaas: API key fica no React state em texto plano; conexão teste opcional e não bloqueia avanço | Step6Asaas.tsx | 10, 54-77 |

### 2.4 MLM / Indicações

| # | Severidade | Bug | Arquivo | Linha |
|---|-----------|-----|---------|-------|
| MLM-01 | **CRÍTICA** | `getMeuLink()` aceita `cooperadoId` via query param — qualquer autenticado consulta código de outro membro (bypass de autorização) | indicacoes.controller.ts | 53-60 |
| MLM-02 | **CRÍTICA** | `registrar()` sem `@Roles` guard — qualquer usuário autenticado registra indicações para qualquer cooperado | indicacoes.controller.ts | 74-77 |
| MLM-03 | **CRÍTICA** | Travessia de árvore sem detecção de referência circular — se A→B→A existe, loop infinito no `while` | indicacoes.service.ts | 156-180 |
| MLM-04 | **ALTA** | Benefício percentual sem validação de teto — `percentual > 100` resulta em benefício > valor da fatura | indicacoes.service.ts | 216-234 |
| MLM-05 | **ALTA** | `aplicarBeneficios` sem transação — múltiplas chamadas paralelas para mesmo cooperadoId = race condition no saldo | indicacoes.service.ts | 262-301 |
| MLM-06 | **ALTA** | Precisão financeira: `.toFixed(2)` → `new Decimal()` perde precisão no arredondamento | indicacoes.service.ts | 290 |
| MLM-07 | **MÉDIA** | `findAll()` sem filtro de `cooperativaId` por padrão — SUPER_ADMIN vê MLM de todas as cooperativas sem aviso | indicacoes.service.ts | 306-315 |

### 2.5 Financeiro / Cobrança / Asaas

| # | Severidade | Bug | Arquivo | Linha |
|---|-----------|-----|---------|-------|
| FIN-01 | **CRÍTICA** | `calcularMultaJuros()` calcula valores mas **não persiste** — apenas `logger.debug`. Cooperado nunca vê multa/juros cobrados | cobrancas.job.ts | 84-87 |
| FIN-02 | **ALTA** | `preferenciaCobranca` aceita `DIA_FIXO_32` sem validação de range — dia inválido gera data incorreta | faturas.service.ts | 738-753 |
| FIN-03 | **ALTA** | Livro Caixa inclui pagamentos Asaas por `updatedAt` — pode mostrar "recebido" antes do webhook atualizar Cobrança para PAGO | lancamentos.service.ts | 152-162 |
| FIN-04 | **ALTA** | CSV export não escapa aspas/ponto-e-vírgula — valores com esses caracteres quebram parsing do Excel | financeiro/page.tsx | 49-52 |
| FIN-05 | **MÉDIA** | `contratos.ativar()` atualiza contrato + cooperado + notificação sem transação (ver DT-02 acima) | contratos.service.ts | 285-310 |
| FIN-06 | **MÉDIA** | Tarifa usada no cálculo não é registrada na cobrança — impossível auditar base de cálculo | faturas.service.ts | 318-325 |
| FIN-07 | **MÉDIA** | Fila de espera ordena por `updatedAt` em vez de `createdAt` — posição muda se qualquer campo for editado | cooperados.service.ts | 391 |

### 2.6 Frontend / UX

| # | Severidade | Bug | Arquivo | Linha |
|---|-----------|-----|---------|-------|
| UX-01 | **ALTA** | 15+ blocos `catch(() => {})` silenciosos no frontend — erros de API nunca mostrados ao usuário | Múltiplos | — |
| UX-02 | **ALTA** | Página de usuários usa `alert()`/`confirm()` nativo em vez de Dialog component | usuarios/page.tsx | 148, 158 |
| UX-03 | **ALTA** | Validação de telefone aceita 10 dígitos — números BR precisam de 11 (DDD + 9 + 8 dígitos) | entrar/page.tsx | — |
| UX-04 | **ALTA** | Dados não recarregam após mutação (financeiro, usinas, parceiros) — stale data visível | Múltiplos | — |
| UX-05 | **MÉDIA** | `Math.max(...[])` pode retornar `-Infinity` se histórico for array vazio no gráfico do livro caixa | financeiro/page.tsx | 76 |
| UX-06 | **MÉDIA** | Conversas WhatsApp não atualizam automaticamente — só no mount; novas conversas não aparecem | whatsapp/page.tsx | 143 |
| UX-07 | **MÉDIA** | Envio de mensagem no chat falha silenciosamente — `catch {}` vazio, usuário não sabe se enviou | ConversaDetalhe.tsx | 93-95 |
| UX-08 | **BAIXA** | Botões de ação sem `aria-label` em tela de usuários (ícones sem texto) | usuarios/page.tsx | 234-242 |
| UX-09 | **BAIXA** | Clipboard API sem fallback para navegadores antigos/HTTP | parceiros/[id]/page.tsx | 31 |

### 2.7 Segurança (novos)

| # | Severidade | Bug | Arquivo | Linha |
|---|-----------|-----|---------|-------|
| SEC-03 | **CRÍTICA** | Arquivo `.env` com credenciais de produção no repositório (DB password, Supabase keys, Anthropic API key) | backend/.env | 12, 14-18, 31 |
| SEC-04 | **ALTA** | Webhook WhatsApp `@Public()` sem autenticação por token — qualquer um pode enviar payloads | whatsapp-fatura.controller.ts | 38-54 |

---

## 3. INCONSISTÊNCIAS DE FLUXO

### 3.1 Wizard Membro → Motor de Cobrança
O wizard permite pular Steps 3-6 sem validação. Se `simulacao` é null, Step 7 usa desconto default de 15% sem que o cooperado veja ou aceite esse valor. A cobrança gerada depois terá um desconto que o cooperado nunca aprovou.

### 3.2 Wizard Parceiro → Lista de Espera
Step 3 consulta lista de espera da cooperativa, mas a cooperativa só é criada no Step 9. A API é chamada com `cooperativaId: undefined`, retorna lista vazia, dando falsa impressão de que não há membros esperando.

### 3.3 WhatsApp Bot → Cooperado
Busca por telefone com `slice(-8)` pode vincular fatura ao cooperado errado. Se dois cooperados compartilham os últimos 8 dígitos (DDDs diferentes), o OCR e a proposta vão para o primeiro encontrado no banco.

### 3.4 DarBaixa → Livro Caixa → Asaas
Quando Asaas envia webhook de pagamento, o `LancamentoCaixa` é criado via `darBaixa()`. Mas o livro caixa TAMBÉM puxa pagamentos Asaas diretamente por `updatedAt` — possível duplicação: o mesmo pagamento aparece como lançamento manual E como entrada Asaas.

### 3.5 MLM → Benefícios
`aplicarBeneficiosNoFechamento()` não usa transação. Se duas faturas são processadas simultaneamente para o mesmo cooperado indicador, o saldo pode ficar negativo por race condition.

### 3.6 Multa/Juros → Cobrança
O cron `calcularMultaJuros` roda diariamente mas apenas loga os valores calculados — não persiste em nenhum campo. O cooperado inadimplente nunca vê multa ou juros na sua cobrança, anulando completamente a funcionalidade.

---

## 4. MELHORIAS PRIORITÁRIAS

### Prioridade 1 — Críticas (bloqueia operação)

1. **Persistir multa/juros** no modelo `Cobranca` (campos `valorMulta`, `valorJuros`, `valorAtualizado`) e atualizar no cron
2. **Adicionar `cooperativaId`** na criação do cooperado via wizard membro
3. **Trocar `findUnique/create` por `upsert`** na criação de conversas WhatsApp
4. **Corrigir busca por telefone** — usar match exato normalizado em vez de `contains + slice(-8)`
5. **Adicionar validação nos Steps 3-6** do wizard membro (pelo menos avisar que simulação não foi feita)
6. **Remover `.env` do git** e rotacionar todas as credenciais expostas
7. **Adicionar `@Roles` guard** nos endpoints MLM (`registrar`, `getMeuLink`)
8. **Detectar referência circular** na travessia de árvore MLM (set de IDs visitados)

### Prioridade 2 — Altas (impacto financeiro ou UX grave)

9. Envolver `contratos.ativar()` em transação Prisma
10. Validar range de `DIA_FIXO_XX` (1-28) e tamanho final de telefone em `formatarTelefone()`
11. Adicionar token de autenticação no webhook WhatsApp
12. Substituir `catch(() => {})` frontend por toast de erro (pelo menos nos 15 blocos mais críticos)
13. Usar `Cobranca.status='PAGO'` como fonte de verdade no livro caixa (evitar duplicação com Asaas direto)
14. Implementar timeout de conversas WhatsApp (cron que reseta `AGUARDANDO_*` após 24h)
15. Adicionar transação em `aplicarBeneficiosNoFechamento()` com lock pessimista

### Prioridade 3 — Médias (qualidade e manutenibilidade)

16. Registrar tarifa utilizada no cálculo da cobrança (campo `tarifaUtilizada`)
17. Escapar CSV corretamente (biblioteca ou replace de aspas)
18. Ordenar fila de espera por `createdAt` em vez de `updatedAt`
19. Substituir `alert()`/`confirm()` por Dialog component
20. Adicionar auto-refresh nas conversas WhatsApp (polling 30s)

---

## 5. SCORE DE QUALIDADE POR MÓDULO

| Módulo | Score | Justificativa |
|--------|-------|---------------|
| Segurança / Auth | 7/10 | JWT, RBAC, rate limit e crypto estão bons. .env no git e falta de auth no webhook WhatsApp pesam. |
| Motor de Cobrança | 5/10 | Lógica hierárquica bem implementada, mas multa/juros não persiste e tarifa não é auditável. |
| WhatsApp / CRM | 3/10 | Muitos pontos de falha silenciosa, race conditions, busca por telefone insegura, motor dinâmico desativado. |
| Wizard Membro | 3/10 | Funciona no happy path, mas steps 3-6 sem validação e cooperativaId ausente são críticos. |
| Wizard Parceiro | 4/10 | Mesmos problemas de validação, agravado pelo cooperativaId inexistente no Step 3. |
| MLM / Indicações | 3/10 | Lógica de cascata interessante, mas falhas de autorização, loop infinito possível e race condition financeira. |
| Livro Caixa | 6/10 | Funcional e útil. Risco de duplicação Asaas e CSV sem escape são os problemas principais. |
| Distribuição Créditos | 7/10 | Bem implementado com alertas SOBRA/EXCESSO e promoção FIFO. Transaction SERIALIZABLE OK. |
| Frontend / UX | 4/10 | Muitos catch vazios, dados stale após mutação, validações fracas. |

**Score geral: 5.2 / 10** — Sistema funcional no happy path, mas com falhas graves de validação, autorização e consistência de dados que impedem operação em produção sem correções.

---

## 6. RESUMO EXECUTIVO

**O que melhorou desde o último relatório:**
- SEC-01 (JWT) e SEC-02 (SUPER_ADMIN) totalmente corrigidos
- Race condition de percentualUsina resolvida com SERIALIZABLE
- Rate limiting e CORS configurados corretamente
- Criptografia AES-256-GCM para chaves Asaas
- Timing-safe comparison para segredos

**O que precisa de atenção urgente:**
- 7 bugs CRÍTICOS novos (MLM auth bypass, wizard sem validação, WhatsApp race conditions)
- Multa/juros calculada mas não persistida (feature inteira não funciona)
- `.env` com credenciais de produção no repositório
- DT-02 parcialmente corrigido (ativar() ainda sem transação)

**Recomendação:** Não promover para produção antes de resolver itens de Prioridade 1. Estimar 3-5 dias de trabalho focado nas 8 correções críticas.
