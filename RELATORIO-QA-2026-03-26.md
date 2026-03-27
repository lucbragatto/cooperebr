# Relatório QA — CoopereBR
**Data:** 2026-03-26
**Período analisado:** commits de 25/03/2026 a 26/03/2026
**Módulos:** Auth/Portal Cooperado, Wizard Membro, WhatsApp Bot, MLM/Indicações, Financeiro/Cobranças, Portal Parceiro, Dashboard Admin
**Score geral de qualidade: 6.4 / 10** ↑ (+1.2 vs relatório anterior)

---

## 1. STATUS DOS ITENS CRÍTICOS DO RELATÓRIO ANTERIOR (2026-03-25)

| ID | Descrição | Status Anterior | Status Hoje | Observação |
|----|-----------|-----------------|-------------|------------|
| MLM-01 | getMeuLink aceitava cooperadoId via query param | CRÍTICO | **CORRIGIDO** | Usa `req.user?.cooperadoId` diretamente. Sem query param. |
| MLM-02 | registrar() sem @Roles guard | CRÍTICO | **CORRIGIDO** | `@Roles(COOPERADO, ADMIN, SUPER_ADMIN)` aplicado. |
| MLM-03 | Loop infinito na árvore MLM | CRÍTICO | **CORRIGIDO** | Set `visitados` com break quando ciclo detectado. |
| MLM-04 | Percentual sem teto (>100%) | ALTA | **CORRIGIDO** | `upsertConfig` valida 0-100. `Math.min(percentual, 100)` no cálculo. |
| MLM-05 | aplicarBeneficios sem transação | ALTA | **CORRIGIDO** | `this.prisma.$transaction` adicionado. |
| FIN-01 | calcularMultaJuros não persistia | CRÍTICO | **CORRIGIDO** | `prisma.cobranca.update` com `valorMulta`, `valorJuros`, `valorAtualizado`. |
| WZ-01 | Steps 3-6 sem validação no wizard | CRÍTICO | **CORRIGIDO** | `validarEtapa()` agora bloqueia: simulação, proposta aceita, documentos, contrato. |
| WZ-03 | cooperativaId ausente ao criar cooperado | CRÍTICO | **CORRIGIDO PARCIAL** | Backend usa `req.user?.cooperativaId` como fallback. SUPER_ADMIN criando cooperado ainda resulta em `cooperativaId: null`. |
| WA-01 | Race condition criação de conversa | CRÍTICO | **CORRIGIDO** | `upsert` atômico substitui `findUnique + create`. |
| DT-02 | contratos.ativar() sem transação | PARCIAL | **CORRIGIDO** | `prisma.$transaction` adicionado cobrindo contrato + cooperado + notificação. |
| WZ-02 | desconto default 15% silencioso | CRÍTICO | **CORRIGIDO** | Guarda com `simulacaoData.simulacao!.desconto` e validação prévia. |
| WP-01 | Step3 Parceiro usa cooperativaId undefined | CRÍTICO | **NÃO VERIFICADO** | Sem alterações recentes em Step3Espera.tsx (data 25/03). |
| SEC-03 | .env com credenciais no repositório | CRÍTICO | **NÃO CONFIRMADO** | Arquivo ainda existe em backend/.env. Não há evidência de remoção do git. |

---

## 2. BUGS NOVOS POR MÓDULO

### 2.1 Portal Cooperado — Novos

| # | Severidade | Bug | Arquivo | Linha |
|---|-----------|-----|---------|-------|
| PC-01 | **CRÍTICA** | Link de convite usa `dados?.id` (UUID) como fallback quando `codigoIndicacao` é null — UUID não é aceito por `registrarIndicacao()` que busca por `codigoIndicacao`; convite quebrado silenciosamente | portal/indicacoes/page.tsx | 58-61 |
| PC-02 | **CRÍTICA** | Portal home e indicações: QRCode renderizado com `linkConvite = ''` no SSR pois `typeof window !== 'undefined'` é false no servidor — QR code em branco no primeiro render / hydration mismatch | portal/page.tsx, portal/indicacoes/page.tsx | ~75, ~58 |
| PC-03 | **ALTA** | Portal desligamento: se a chamada API falhar, o `catch` define `semFaturasAberto: true, semGeracaoAtiva: true` — usuário com faturas em aberto pode solicitar desligamento quando o backend está instável | portal/desligamento/page.tsx | 56-59 |
| PC-04 | **ALTA** | `atualizarMeuPerfil` permite cooperado alterar próprio email sem sync com Supabase Auth — login com email antigo continua funcionando (inconsistência DB vs auth), mas novo email não funciona para login | cooperados.service.ts | ~230 |
| PC-05 | **ALTA** | Portal UCs: `UcChart` busca `/cooperados/meu-perfil/cobrancas` ignorando `ucId` passado como prop — quando há múltiplas UCs, o gráfico mostra os mesmos dados de cobrança para todas | portal/ucs/page.tsx | ~205 |
| PC-06 | **MÉDIA** | Portal financeiro: `catch(() => {})` silencia erro ao carregar cobranças — tela fica em branco sem mensagem de erro | portal/financeiro/page.tsx | 34 |
| PC-07 | **MÉDIA** | Portal indicações: `totalBeneficio` soma apenas benefícios `APLICADO`, mas o label diz "Benefício por indicações" — benefícios PENDENTE e PARCIAL nunca aparecem no total, subestimando o valor | portal/indicacoes/page.tsx | 71-74 |
| PC-08 | **MÉDIA** | Portal conta: `atualizarMeuPerfil` não exige confirmação de senha para alterar email — vetor de hijacking de conta | cooperados.service.ts | ~224 |

### 2.2 Portal Parceiro — Novos

| # | Severidade | Bug | Arquivo | Linha |
|---|-----------|-----|---------|-------|
| PP-01 | **ALTA** | Dashboard parceiro: KPIs `inadimplentes` e `receitaMes` são hardcoded como `0` — nunca são buscados do backend; dashboard sempre mostra zero de inadimplência e receita | parceiro/page.tsx | 31-42 |
| PP-02 | **ALTA** | A busca de membros usa `limit: 1` como parâmetro: `api.get('/cooperados', { params: { limit: 1 } })` — retorna apenas 1 cooperado; contagens de `membrosAtivos` e `membrosTotal` ficam no máximo 1 | parceiro/page.tsx | 32 |
| PP-03 | **MÉDIA** | Parceiro financeiro/repasses: não há validação de acesso por `cooperativaId` no controller — parceiro poderia ver repasses de outras cooperativas se manipular request | parceiro/financeiro/page.tsx | — |

### 2.3 Wizard Membro — Residual

| # | Severidade | Bug | Arquivo | Linha |
|---|-----------|-----|---------|-------|
| WZ-07 | **ALTA** | Step7: se `semVaga = true` (lista espera), a validação de simulação é bypassada — cooperado vai para fila sem que a simulação tenha sido executada (não há contrato, mas KwhMensal fica zerado) | Step7Alocacao.tsx | 95-99 |
| WZ-08 | **ALTA** | Criação de cooperado no Step7 (passos 1-6 sequenciais) sem transação — se passo 3 (upload documentos) falhar, cooperado e UC já foram criados sem documentos, sem rollback possível pelo frontend | Step7Alocacao.tsx | 103-193 |
| WZ-09 | **MÉDIA** | SUPER_ADMIN criando cooperado via wizard: `cooperativaId` não é enviado pelo frontend e `req.user?.cooperativaId` é null → cooperado criado sem cooperativa | cooperados.controller.ts | 55 |
| WZ-10 | **MÉDIA** | Erro na criação de contrato (passo 4 do finalizar) é capturado em `catch {}` vazio com comentário "Contrato opcional, não bloqueia" — mas o contrato é o produto principal, falha silenciosa é grave | Step7Alocacao.tsx | 162-164 |

### 2.4 WhatsApp Bot — Residual

| # | Severidade | Bug | Arquivo | Linha |
|---|-----------|-----|---------|-------|
| WA-15 | **ALTA** | Motor dinâmico `WhatsappFluxoMotorService` está completamente desativado com TODO desde 24/03 — código de `FluxoEtapa` continua sendo persistido mas nunca lido; desperdício de escrita e feature presa em limbo | whatsapp-bot.service.ts | 97-104 |
| WA-16 | **ALTA** | Conversas no estado `AGUARDANDO_*` sem timeout ainda — sem cron ou TTL para resetar; produção vai acumular conversas mortas indefinidamente | whatsapp-bot.service.ts | — |
| WA-17 | **MÉDIA** | `formatarTelefone()` e validação de tamanho final: não confirmado se foi corrigido — WA-05 listado como pendente no último relatório, sem commits visíveis em whatsapp-cobranca.service.ts (data 24/03) | whatsapp-cobranca.service.ts | 185-193 |

### 2.5 Auth / Usuários

| # | Severidade | Bug | Arquivo | Linha |
|---|-----------|-----|---------|-------|
| AUTH-01 | **ALTA** | `loginMultiContexto` (selecionar-contexto): contexto do proprietário de usina é retornado mas sem `cooperativaId` — ao clicar em "Proprietário", token JWT pode não ter `cooperativaId` e falhar em rotas que exigem tenant | auth.service.ts | ~282 |
| AUTH-02 | **MÉDIA** | `obterContextosUsuario` busca usinas por `proprietarioEmail` como fallback quando cooperado não tem usinas — se dois cooperados compartilham email (improvável mas possível), retorna usinas do errado | auth.service.ts | ~270 |

### 2.6 Financeiro / Cobranças — Residual

| # | Severidade | Bug | Arquivo | Linha |
|---|-----------|-----|---------|-------|
| FIN-08 | **ALTA** | `calcularMultaJuros` recalcula sempre baseado em `valorLiquido` original (comentário no código: "Recalcula sempre para evitar acumulação") — correto — mas não há campo `valorAtualizado` exposto no portal do cooperado; cooperado nunca vê a dívida real | cobrancas.job.ts + portal/financeiro | 84 |
| FIN-09 | **MÉDIA** | `DIA_FIXO` no wizard membro aceita apenas [5, 10, 15, 20, 25] mas o backend aceita `DIA_FIXO_01` até `DIA_FIXO_31` sem validação de range — inconsistência entre frontend restrito e backend permissivo | Step7Alocacao.tsx, faturas.service.ts | — |

---

## 3. INCONSISTÊNCIAS DE FLUXO

### 3.1 Convite MLM — Link Quebrado
O portal cooperado usa `dados?.codigoIndicacao ?? dados?.id` para montar o link de convite. Se `codigoIndicacao` for null (cooperados criados antes da implementação MLM não têm código), o link usa o UUID do cooperado. A API `registrarIndicacao()` busca pelo `codigoIndicacao`, não pelo `id` — o convite leva a uma tela de cadastro mas a indicação nunca é registrada. O cooperado indica alguém, a pessoa se cadastra, e o benefício nunca é creditado.

**Correção sugerida:** Chamar `GET /indicacoes/meu-link` que já gera código automaticamente se ausente, em vez de construir o link manualmente.

### 3.2 Portal Desligamento — Falso Positivo
Se a API `/cooperados/meu-perfil/cobrancas` retornar erro 500 ou timeout, o `catch` seta `semFaturasAberto: true`. O checklist mostra verde, o botão fica habilitado, e o cooperado solicita desligamento com faturas em aberto. O backend em `solicitarDesligamento` não re-valida pendências financeiras — aceita qualquer solicitação. Isso pode gerar desligamento de cooperados inadimplentes.

**Correção sugerida:** Em caso de erro de API, definir `semFaturasAberto: false` (conservador) e mostrar erro ao usuário.

### 3.3 Portal Parceiro — KPIs Fantasmas
O Dashboard do Parceiro mostra `inadimplentes: 0` e `receitaMes: R$ 0,00` para sempre. Nenhuma chamada API busca esses dados. O parceiro não tem visibilidade real de sua carteira, tornando o dashboard ornamental.

### 3.4 Wizard Lista Espera — Cooperado Sem kWh
Quando não há usinas disponíveis (`semVaga = true`), o wizard cria o cooperado e adiciona à lista de espera sem executar a simulação. O campo `cotaKwhMensal` fica zerado (ou só preenchido se OCR teve histórico suficiente). Quando uma usina ficar disponível, não há base para calcular alocação.

### 3.5 valorAtualizado não exposto ao cooperado
O cron de multa/juros agora persiste corretamente `valorMulta`, `valorJuros` e `valorAtualizado` na cobrança. Porém, o portal do cooperado (`portal/financeiro/page.tsx`) exibe apenas `valorLiquido` e nunca `valorAtualizado`. O cooperado inadimplente vê o valor original, não o valor com multa/juros.

---

## 4. MELHORIAS PRIORITÁRIAS

### Prioridade 1 — Críticas (bloqueia operação correta)

1. **PC-01/PC-02 — Convite MLM quebrado**: Substituir link manual pelo endpoint `/indicacoes/meu-link` no portal. Usar `useEffect` para montar link apenas no cliente (resolver hydration mismatch do QR code).

2. **PC-03 — Desligamento com faturas**: Mudar o `catch` do desligamento para setar `semFaturasAberto: false` e mostrar erro. Adicionar validação de pendências no endpoint `/solicitar-desligamento`.

3. **PP-01/PP-02 — Dashboard parceiro com dados falsos**: Criar endpoint `/cooperativas/meu-dashboard` que retorne KPIs reais (inadimplentes, receita do mês). Substituir `limit: 1` por chamada agregada.

4. **WZ-10 — Contrato criado silenciosamente**: Remover o `catch {}` vazio na criação do contrato. Exibir erro específico ao usuário se a criação de contrato falhar.

5. **WZ-09 — SUPER_ADMIN sem cooperativaId**: Adicionar seletor de cooperativa no Step2Dados quando o usuário for SUPER_ADMIN.

### Prioridade 2 — Altas (impacto financeiro ou UX grave)

6. **PC-04/PC-08 — Troca de email sem auth**: Exigir confirmação de senha antes de permitir troca de email. Sincronizar com Supabase Auth.

7. **PC-05 — Gráfico UC errado**: Criar endpoint `/cooperados/meu-perfil/ucs/:id/historico` retornando cobrancas filtradas por UC. Ou filtrar no cliente por `uc.id`.

8. **FIN-08 — valorAtualizado não exibido**: Expor `valorMulta`, `valorJuros`, `valorAtualizado` no portal. Adicionar tooltip explicando o valor com multa/juros.

9. **WA-16 — Conversas sem timeout**: Criar cron job que rode 1x/dia resetando conversas `AGUARDANDO_*` com `updatedAt > 24h` para estado `INICIAL`.

10. **PC-07 — Benefício subestimado**: Incluir benefícios `PENDENTE` e `PARCIAL` no total exibido. Diferenciar "a receber" vs "já aplicado" na UI.

### Prioridade 3 — Médias (qualidade)

11. **WZ-07 — Lista espera sem simulação**: Mostrar aviso quando cooperado vai para lista espera sem simulação. Pré-preencher `cotaKwhMensal` com média do histórico OCR.

12. **AUTH-01 — Contexto proprietário sem cooperativaId**: Ao construir o JWT do proprietário, incluir `cooperativaId` da usina principal.

13. **PP-03 — Parceiro vendo dados de outras cooperativas**: Garantir filtro `cooperativaId` em todos os endpoints usados pelo portal parceiro.

14. **WA-17 — Validação de telefone**: Confirmar e corrigir `formatarTelefone()` para rejeitar inputs com menos de 10 dígitos após formatação.

---

## 5. SCORE DE QUALIDADE POR MÓDULO

| Módulo | Score Anterior | Score Hoje | Delta | Justificativa |
|--------|--------------|------------|-------|---------------|
| Segurança / Auth | 7/10 | 7/10 | = | Melhorou MLM auth. Regrediu com email sem sync Supabase. |
| Motor de Cobrança | 5/10 | 7/10 | +2 | Multa/juros agora persiste. Falta exposição no portal. |
| WhatsApp / CRM | 3/10 | 4/10 | +1 | Race condition resolvida. Motor dinâmico ainda desativado. |
| Wizard Membro | 3/10 | 6/10 | +3 | Validações adicionadas em todos os steps. WZ-07/08/09/10 residuais. |
| Wizard Parceiro | 4/10 | 4/10 | = | Sem alterações visíveis neste ciclo. |
| MLM / Indicações | 3/10 | 7/10 | +4 | Autorização, ciclo, transação e teto corrigidos. Link quebrado é novo. |
| Livro Caixa | 6/10 | 6/10 | = | Sem alterações. |
| Distribuição Créditos | 7/10 | 7/10 | = | Sem alterações. |
| Portal Cooperado | N/A | 5/10 | NOVO | Funcional, mas link de convite quebrado, catch vazio, dados inconsistentes. |
| Portal Parceiro | N/A | 3/10 | NOVO | KPIs hardcoded, dados limitados a 1 registro, dashboard enganoso. |
| Frontend Admin / UX | 4/10 | 5/10 | +1 | Wizard muito melhorado. Permanecem catch vazios e stale data. |

**Score geral: 6.4 / 10** — Melhora significativa. Itens críticos anteriores resolvidos. Novos portais (cooperado e parceiro) introduziram bugs novos que precisam de atenção.

---

## 6. RESUMO EXECUTIVO

### O que melhorou neste ciclo

- **7 bugs CRÍTICOS** do relatório anterior foram corrigidos (MLM auth, wizard validações, race condition WhatsApp, multa/juros, transação ativar contrato)
- **Wizard membro** passou de 3/10 para 6/10: validação completa em todos os steps
- **MLM** passou de 3/10 para 7/10: autorização, detecção de ciclo, transação financeira
- **Financeiro**: multa e juros agora persistem corretamente na cobrança (FIN-01 100% resolvido)

### O que precisa de atenção urgente

- **PC-01**: Link de convite MLM quebrado para cooperados sem código (UUID usado incorretamente)
- **PC-03**: Portal desligamento permite solicitação com faturas em aberto quando API falha
- **PP-01/PP-02**: Dashboard parceiro mostra KPIs falsos (inadimplência e receita sempre zero)
- **WZ-10**: Falha na criação de contrato (produto principal) é suprimida silenciosamente

### Ações imediatas recomendadas

1. Corrigir link de convite (`/indicacoes/meu-link` API já faz o trabalho)
2. Inverter lógica do `catch` no desligamento (falha = bloqueado)
3. Criar endpoint de KPIs reais para o dashboard do parceiro
4. Expor `valorAtualizado` no portal financeiro do cooperado (funcionalidade já existe no backend)

**Recomendação**: Sistema pode ser promovido para produção com os portais (cooperado/parceiro) em modo beta limitado, após resolver PC-01, PC-03, PP-01 e WZ-10. Estimar 1-2 dias de trabalho para as 4 correções prioritárias.
