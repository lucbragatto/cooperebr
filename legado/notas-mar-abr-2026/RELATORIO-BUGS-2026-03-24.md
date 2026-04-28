# Relatório de Bugs e Melhorias — CoopereBR
**Data:** 24/03/2026 | **Compilado por:** Assis

---

## 🔴 BUGS CRÍTICOS

### BUG-001: Funil de cadastro — Step 7 Alocação: 404 e 400
**Observado:** Console mostra `GET /cooperados/fila-espera/count → 404` e `POST /cooperados → 400 Bad Request`
**Impacto:** Não consegue concluir o cadastro de novo cooperado
**Arquivos:** `web/app/dashboard/cooperados/novo/steps/Step7Alocacao.tsx`
**Provável causa:** Endpoint `/cooperados/fila-espera/count` não existe no backend; POST /cooperados com payload inválido (campo obrigatório faltando ou formato errado)
**Ação:** Verificar controller de cooperados, criar endpoint fila-espera/count, corrigir payload do POST

### BUG-002: Bot WhatsApp — PDF não processado (documentWithCaptionMessage)
**Observado:** Usuário envia PDF pelo celular, bot responde com mensagem de boas-vindas em vez de processar o OCR
**Causa identificada:** Baileys encapsula PDFs enviados pelo celular em `documentWithCaptionMessage` — código só verificava `documentMessage`
**Status:** CORRIGIDO em 24/03 (index.mjs atualizado)
**Verificar:** Testar novamente para confirmar que o fix funcionou

### BUG-003: Motor dinâmico enviando todas as mensagens de uma vez
**Observado:** Bot enviou 11 mensagens em sequência sem esperar resposta
**Causa:** WhatsappFluxoMotorService executava fluxo inteiro em vez de apenas etapa atual
**Status:** DESATIVADO temporariamente — bot hardcoded assumiu o controle
**Pendente:** Reescrever motor para processar apenas etapa atual e aguardar resposta

### BUG-004: Variáveis de template não substituídas
**Observado:** Mensagens chegando com {{nome}}, {{economia}}, {{historico}} literais
**Causa:** Motor dinâmico não passava contexto da conversa para o renderizador
**Status:** Parcialmente resolvido (motor desativado) — pendente reativar corretamente

---

## 🟡 INCONSISTÊNCIAS NA SIMULAÇÃO (Step 3)

### INC-001: Card "kWh bruto" com valor incorreto
**Situação:** Mostra soma de TODOS os componentes ÷ consumo (incluindo impostos)
**Correto:** Deve mostrar apenas TUSD + TE + Bandeira (sem impostos)
**Label sugerido:** "Tarifa base s/ impostos" e "Tarifa c/ encargos" (dois cards separados)

### INC-002: TE e TUSD sem campo editável
**Situação:** Admin não consegue corrigir TUSD/TE se OCR errar
**Correto:** Adicionar campos editáveis para tarifaTUSD e tarifaTE igual aos outros componentes

### INC-003: Meses com consumo muito abaixo da média marcados para cálculo
**Situação:** Meses suspeitos (outliers) estão marcados por padrão e entram na média
**Correto:** Detectar automaticamente meses com consumo < 30% da média e desmarcá-los por padrão, com aviso visual
**Arquivo:** `Step1Fatura.tsx` — função `detectarSuspeitos`

### INC-004: Plano como dropdown em vez de cards visuais
**Pedido:** Substituir select dropdown por cards clicáveis mostrando nome, % desconto, promoção
**Arquivo:** `Step3Simulacao.tsx` — seção de seleção de plano

### INC-005: Campo de simulação (kWh) separado do upload
**Pedido:** Os valores de TUSD, TE, componentes devem aparecer junto com o Step de upload da fatura para o admin poder marcar/desmarcar e ver o valor mudar em tempo real
**Ação:** Mover/duplicar painel de componentes para o Step1 ou Step2, com atualização reativa

---

## 🟡 MELHORIAS DE FLUXO

### MEL-001: Preferência de data de pagamento no cadastro
**Pedido:** Perguntar ao cooperado se quer pagar no mesmo vencimento da concessionária ou escolher data fixa
**Opções a oferecer:**
- A) Mesmo vencimento da concessionária
- B) Dia fixo do mês (10, 15, 20, 25)
- C) X dias após receber a fatura
**Campo:** `preferenciaCobranca` já existe no schema — só falta preencher no funil e usar no motor de cobrança

### MEL-002: Repositório de faturas por email
**Pedido:** Email dedicado (faturas@cooperebr.com.br) para receber faturas das concessionárias
**Robô necessário:** IMAP watcher → OCR → identifica cooperado pela UC → salva FaturaProcessada → dispara cobrança na data preferida
**Pendente:** Definir provedor de email (Gmail IMAP, Mailgun Inbound, Postmark)

### MEL-003: Jornada completa do Administrador
**Pendente mapear:**
- Painel de UCs sem fatura recebida no mês
- Alertas de fatura atrasada da concessionária
- Relatório de cooperados sem contrato ativo
- Exportação de dados para contabilidade

### MEL-004: Jornada do Dono de Usina
**Pendente mapear:**
- Painel de geração mensal vs. alocado
- Relatório de repasse financeiro
- Histórico de créditos gerados e distribuídos
- Alertas de sobra/falta de créditos

### MEL-005: Jornada do Parceiro/Cooperativa
**Pendente mapear:**
- Dashboard com total de membros ativos
- Relatório de indicações e conversões
- Receita gerada pelo parceiro
- Comissões pendentes e pagas

### MEL-006: Livro Caixa
**Pendente:**
- Entradas: pagamentos de cooperados
- Saídas: repasses para usinas, comissões parceiros, custos operacionais
- Relatório mensal consolidado
- Exportação para contabilidade (CSV/PDF)

---

## 🟢 ITENS IMPLEMENTADOS HOJE (24/03)

| Item | Status |
|------|--------|
| Disparos WhatsApp granulares (todos/parceiro/lista) | ✅ |
| Histórico de mensagens WhatsApp | ✅ |
| Listas salvas de contatos | ✅ |
| Banco de mensagens + templates | ✅ |
| Motor de fluxo dinâmico (desativado por bug) | ⚠️ |
| Página pública /entrar?ref=CODIGO | ✅ |
| Convite pessoal do membro | ✅ |
| Notificação indicador + admin no cadastro | ✅ |
| Seleção cooperados no disparo + anti-bloqueio | ✅ |
| Gestão de usuários (criar/editar/senha) | ✅ |
| Fix: URLs de convite (coopere.br → localhost:3001) | ✅ |
| Fix: erros null em indicações (SUPER_ADMIN) | ✅ |
| Fix: documentWithCaptionMessage no Baileys | ✅ |

---

## 📋 PLANO DA MADRUGADA (agentes autônomos)

### Fase A — Correções críticas
1. Corrigir BUG-001: endpoint fila-espera/count + POST cooperados 400
2. Corrigir INC-001/002/003: simulação kWh, campos editáveis TE/TUSD, meses suspeitos
3. Corrigir INC-004: cards de plano no Step3
4. Corrigir INC-005: componentes junto com upload

### Fase B — Testes automatizados
- Testar cada endpoint do backend (pelo menos 3x)
- Testar fluxo completo de cadastro de cooperado
- Testar fluxo WhatsApp bot (envio de fatura, respostas)
- Gerar relatório de resultados

### Fase C — Melhorias
1. MEL-001: preferência de data de pagamento no funil de cadastro
2. MEL-003/004/005: mapear e iniciar jornadas admin/usina/parceiro

---

## 🗺️ JORNADAS A MAPEAR (visão completa do sistema)

### Jornada 1 — Administrador CoopereBR
Cadastrar cooperado → Upload fatura → Simulação → Proposta → Contrato → Alocação usina → Cobrança mensal → Relatório

### Jornada 2 — Dono de Usina
Cadastrar usina → Vincular cooperados → Visualizar geração → Relatório de distribuição de créditos → Receber repasse

### Jornada 3 — Parceiro/Cooperativa
Gerenciar membros → Ver indicações → Acompanhar conversões → Receber comissões

### Jornada 4 — Membro/Cooperado
Receber convite → Fazer upload pelo WhatsApp ou web → Ver simulação → Assinar proposta → Pagar → Ver economias → Indicar amigos

### Jornada 5 — Concessionária (automático)
Email com fatura chega → Robô processa → OCR extrai dados → Cobrança gerada → Notificação ao cooperado

### Jornada 6 — Financeiro/Contabilidade
Livro caixa → Entradas/Saídas → Relatório mensal → Exportação contábil

---

## Atualiza��o 22:42 � Resultado Testes Fase B

### Testes automatizados: 60/60 PASS ?
- Todos os 20 endpoints testados 3x sem falha
- POST /cooperados funcionando (BUG-001 corrigido ?)
- GET /cooperados/fila-espera/count retornando { count: 0 } ?
- 95 cooperados dispon�veis para disparo WhatsApp
- 7 planos ativos
- Credenciais SUPER_ADMIN confirmadas: superadmin@cooperebr.com.br / SuperAdmin@2026

### Fase A commits entregues:
- a60da3c: BUG-001 corrigido
- 571a900: INC-003 meses suspeitos desmarcados por padr�o
- 424b3a8: INC-004 cards de plano clic�veis
- 9ff9452: INC-001/002 labels corretos + TUSD/TE edit�veis
- f509dbc: INC-005 painel componentes em tempo real no Step1

### Pendente Fase C: MEL-001 prefer�ncia data pagamento
