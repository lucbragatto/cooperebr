# Investigação Profunda — WhatsApp + Histórico de Consumo + Onboarding × Dossiê
### 09/06/2026 — Orquestrador (claude.ai/Code worktree), 100% read-only

> **Origem:** Luciano perguntou "quando a pessoa manda documentos e a fatura da
> concessionária pelo WA, o sistema já está recebendo e salvando?" + pediu uma
> investigação profunda (workflow com subagentes) e, ao final, uma **análise
> comparativa** com o dossiê `docs/sessoes/2026-06-09-dossie-analise-profunda-whatsapp-bot-historico.md`
> (cujo "completo" referenciado em `docs/relatorios/...-DOSSIE-...HISTORICO.md` **nunca
> foi gravado em disco** — a versão real do dossiê está embutida em
> `backend/send-dossie-whatsapp.mjs`, a mensagem curta enviada ao WhatsApp).
>
> **Método:** 1 workflow, 7 agentes (6 frentes read-only em paralelo + crítico de
> completude), 196 leituras de arquivo, ~635k tokens. Código alinhado em `origin/main`
> = `b810e7b`. **Nada foi executado/alterado no produto.**

---

## 0. RESPOSTA DIRETA À PERGUNTA ("recebe e salva?")

| Canal | Recebe | Lê (OCR) | Salva o ARQUIVO | Cria FaturaProcessada |
|---|---|---|---|---|
| **Fatura por EMAIL** (IMAP→OCR) | ✅ | ✅ | ✅ Supabase | ✅ |
| **Fatura por WEB** (`/faturas` e `/whatsapp/processar-fatura`) | ✅ | ✅ | ✅ Supabase | ✅ |
| **Fatura pelo BOT (conversa WhatsApp)** | ✅ | ✅ | ⚠️ **NÃO** (caminho PROXY/indicação) | ⚠️ **NÃO** |
| **Documentos RG/CNH/selfie pelo WhatsApp** | ❌ | — | ❌ | — (vira `DocumentoCooperado` só pelo portal web) |

**Em linguagem humana:** a fatura que chega por **e-mail** ou pelo **site** é lida E
guardada (arquivo no Supabase + dados no banco). A fatura que chega **pelo bot do
WhatsApp** é **lida (OCR), mas o arquivo não é guardado** e, no fluxo de
indicação/PROXY, **nem vira registro de fatura** — os dados ficam só na "memória da
conversa" (`ConversaWhatsapp.dadosTemp`), que **expira em 30 min**. **Documentos
pessoais (RG/CNH/selfie) NÃO entram pelo bot** — só pelo portal web (com convite+OTP).

**Histórico de consumo:** é salvo em `FaturaProcessada.historicoConsumo` (JSON) +
`Cooperado.consumoStashOcr` (backup) e vira `Cooperado.cotaKwhMensal`. **Porém o BOT
não popula `consumoStashOcr`** → quem entra pelo bot fica sem esse backup (quebra a
reconciliação planejada na "Fatia 1.4").

---

## 1. COMO FUNCIONA HOJE (com evidência)

### 1.1 Recebimento de mídia (Baileys → backend)
- `whatsapp-service/index.mjs:224-259` baixa a mídia (`downloadMediaMessage`), converte
  pra base64 e `:277-281` faz `POST` ao backend com `{telefone, tipo, mediaBase64, mimeType}`.
- `backend/src/whatsapp/whatsapp-fatura.controller.ts:43-67` recebe em
  `/whatsapp/webhook-incoming` → `bot.processarMensagem()`.
- `whatsapp-bot.service.ts:2313-2341` (`handleAguardandoFotoFatura`) valida mime
  (whitelist `pdf/jpeg/png/jpg`), guarda em `dadosTemp`, transiciona estado.
- `whatsapp-bot.service.ts:209-215`: mídia **fora** do fluxo de fatura → "Este tipo de
  mídia não é suportado… acesse o Portal". (Por isso **RG/CNH não entram pelo bot**.)

### 1.2 Os 3 pipelines de OCR (Claude Sonnet)
- **Motor único de OCR:** `faturas.service.ts:1460-1646` (`extrairDadosFatura`) — prompt
  de 60+ linhas, ~50 campos, retry resiliente (4 tentativas), timeout 30s.
- **EMAIL** (`email-monitor.service.ts:116-365`): cron 06h/dia + manual; identifica
  cooperado pré/pós-OCR; `uploadConcessionaria` salva arquivo + cria `FaturaProcessada`;
  não-identificadas viram `statusRevisao=NAO_IDENTIFICADA`.
- **WEB/PUBLICO** (`faturas.service.ts:293-450`): OCR + `supabase.storage.upload(documentos-cooperados/{cooperadoId}/fatura-*.{ext})` + `FaturaProcessada`.
- **BOT/PROXY** (`whatsapp-fluxo-motor.service.ts:689, 2668-2794`, ação
  `PROCESSAR_OCR_PROXY`): **extrai** os mesmos dados, mas **só** grava em
  `conversaWhatsapp.dadosTemp` → `CONFIRMAR_PROXY`. **Não cria FaturaProcessada, não
  salva arquivo.**

### 1.3 Histórico de consumo (onde vive)
- `schema.prisma:998` `FaturaProcessada.historicoConsumo Json`; `:281`
  `Cooperado.consumoStashOcr Json`; `:171` `Cooperado.cotaKwhMensal Decimal`.
- `publico.controller.ts:36-52` `derivarCotaKwhMensal = consumoMedioKwh ?? média(historico)`;
  gravado se `>0` (`:1013`); stash em `:1228-1235`.
- **Usado por:** motor-proposta + PDF (`proposta-pdf.service.ts:33-94`), custeio
  (`convenios-custeio.service.ts:84-85`), saldo no WhatsApp (`whatsapp-fluxo-motor.service.ts:927-961`).

### 1.4 Esteira de onboarding (convênio) + notificações
- Máquina de estados (`convenios-aprovacao.service.ts:31-55`):
  `PENDENTE_APROVACAO_EMPRESA → PENDENTE_APROVACAO_ADMIN → MEMBRO_ATIVO`.
- `auto-inscrever` (`publico.controller.ts:535-874`) cria membro PENDENTE + magic link
  (`AprovacaoConvenioMembro`) na mesma transação — **mas NENHUMA notificação ao admin**.
- Notificações existentes (`aprovarPorAdmin`, `notificarPosAprovacaoEmpresa`) são
  **só in-app** (tabela `Notificacao`). WhatsApp/email = **TODO Fatia 6**
  (`convenios-aprovacao.service.ts:501, 573, 634`).

### 1.5 Persistência de arquivos
- Bucket único `documentos-cooperados`. WEB: `tmp/convite-uploads/{conviteId}/` →
  movido pra `{cooperadoId}/` + cria `DocumentoCooperado` (KYC). **FATURA não vira
  `DocumentoCooperado`** (`cadastro-upload.service.ts:266`). BOT: **não sobe arquivo.**

---

## 2. GAPS CONSOLIDADOS (priorizados)

**P1 — críticos**
1. **OCR pelo BOT não persiste** (`PROCESSAR_OCR_PROXY`): extrai dados sensíveis mas
   não cria `FaturaProcessada` nem salva arquivo — tudo some em 30 min. Auditoria/
   custeio ficam sem a fatura. (EMAIL e WEB persistem; BOT não → incoerência sistêmica.)
2. **PII sem criptografia em `ConversaWhatsapp.dadosTemp`** (Json texto puro): base64
   da fatura (~5MB) + CPF + endereço + 13 meses de consumo durante o fluxo. **Risco LGPD**
   em dump/backup do PostgreSQL.
3. **Admin não é avisado proativamente** de cadastro novo PENDENTE (empresa e CoopereBR).
   Magic link pode expirar (7d) sem ninguém saber; pessoa nunca recebe progresso por WA.
   *(= exatamente a dor que o Luciano descreveu.)*

**P2 — importantes**
4. Notificações de transição só in-app — **falta WhatsApp pra pessoa em cada degrau** +
   **duplo-hop** (avisar admin da empresa quando CoopereBR aprova). Fatia 6 TODO.
5. **Arquivo da fatura não é salvo no BOT** (sem `arquivoUrl`); sem comprovante guardado.
6. **`consumoStashOcr` não é populado no BOT** → quebra a reconciliação Fatia 1.4.
7. **Membro PENDENTE "some" das telas** (`ativo=false` é filtrado em
   `convenios-custeio.service.ts:274`; listagem não expõe UC) → causa-raiz do "0 kWh/sem UC".
8. **`historicoConsumo` sem validação** no `/cadastro-web-v2` (JSON malformado passa).
9. **Órfãos em `tmp/convite-uploads/`** se o cadastro é abandonado (sem cron de limpeza).
10. **OCR truncado** (`max_tokens`) em faturas com 13+ meses, sem fallback/split.
11. **`email-monitor` falha silenciosa** em `NAO_IDENTIFICADA` (sem log do porquê do não-match).

**P3 — menores:** `cotaKwhMensal` × `mediaKwhCalculada` divergem/ficam stale; UC
SINTÉTICA não distinguida na UI (risco de ir pra lista da concessionária); magic link
não auto-enviado ao nascer PENDENTE; mime whitelist rígida; copy+delete Supabase não
atômico.

---

## 3. ANÁLISE COMPARATIVA — Minha investigação × Dossiê

### 3.1 Convergências (os dois apontam a mesma dor)
| Tema | Dossiê (largura/histórico) | Esta investigação (profundidade/código) |
|---|---|---|
| OCR pelo WA não fecha o ciclo | "PROCESSAR_OCR declarado, não implementado → default/warn" | `PROCESSAR_OCR_PROXY` **implementado**, mas **não persiste** (P1) — diagnóstico refinado |
| Dados de cadastro somem em telas | citado genericamente | **causa-raiz:** membro `PENDENTE` (`ativo=false`) é filtrado + listagem não expõe UC |
| Estado de conversa inchado (`dadosTemp`) | "inchado" | **PII sem cripto + perda em timeout** = severidade **P1 LGPD** |
| Convite em lote frágil | "2s + polling, sem fila/DLQ" | confirmado como bug; dossiê **agrega** o ângulo arquitetural (BullMQ) |
| Notificações incompletas | UX: "progresso visível em flows longos" | **cadeia P1/P2/P3 explícita** (Fatia 6 TODO 501/573/634), por transição |

### 3.2 Contradição (reconciliada)
- **Dossiê:** "PROCESSAR_OCR / MOSTRAR_MENU_PRINCIPAL declarados, não implementados →
  motor cai em default/warn."
- **Verificação:** **não existe** `case 'PROCESSAR_OCR'` nem `case 'MOSTRAR_MENU_PRINCIPAL'`
  no código — só `PROCESSAR_OCR_PROXY` (com handler em `:689`).
- **Reconciliação:** os dois estão certos em planos diferentes. O **caminho vivo** de OCR
  existe (via `_PROXY`, extrai sem persistir — meu achado). A dor do dossiê (ações órfãs
  caindo em default) é **drift DB↔código** (um `FluxoEtapa`/seed apontando uma ação que o
  switch não trata) — nível de **dados/governança**, não do caminho executado. **Não se
  contradizem; se complementam.** *(Confirmar os órfãos de DB exige um SELECT em
  `FluxoEtapa` — fora do escopo read-only desta rodada; fica como item a verificar.)*

### 3.3 Só no dossiê (largura que minha investigação não cobriu)
- Revisão **histórica sessão-a-sessão** (planos/decisões × código).
- **17+ etapas/modelos órfãos** (governança do banco de mensagens).
- Resíduos de **persona/UX antiga** (render "**", "envie foto" em caminhos legados).
- **Phone normalization** pendente (D-novo-WA-PHONE-NORMALIZE).
- **CooperToken Fase 3** (QR/pagamento) pausada — conformidade (dupla taxa QR,
  crédito `saldoParceiro`).
- "empresa_conveniada" reframeada pra COOPERADO, mas legado ainda carrega o conceito.
- Sugestões **arquiteturais**: versionar `FluxoEtapa`/`ModeloMensagem`, fila persistente
  (BullMQ), event sourcing/ledger, observabilidade do bot.

### 3.4 Só nesta investigação (profundidade que o dossiê não tem)
- **Divergência de persistência entre os 3 pipelines de OCR** (EMAIL/WEB persistem ×
  BOT não) — achado sistêmico **P1**.
- **`consumoStashOcr` não populado no BOT** → quebra Fatia 1.4.
- **Arquivo da fatura não salvo no BOT** (sem `arquivoUrl`).
- **PII sem cripto em `dadosTemp`** (P1 LGPD) com evidência.
- **Causa-raiz** do "membro/UC/kWh some" (filtro `ativo=true`).
- Órfãos `tmp/convite-uploads/` sem cron; OCR truncado `max_tokens`; `NAO_IDENTIFICADA`
  silencioso; `cotaKwhMensal × mediaKwhCalculada`; magic link não auto-enviado.
- **Cadeia de notificação desenhada por transição** (quem avisa quem, em cada degrau).

### 3.5 Diferença de método
- **Dossiê** = grande-angular, histórico, multi-perspectiva (Arquiteto/Dev/UX/Usuário),
  cobre **mais fluxos** (CooperToken, MLM, ciclo-de-vida, cobrança). Leve em `arquivo:linha`.
- **Esta investigação** = zoom no que o Luciano perguntou (recebe/salva + histórico +
  onboarding + persistência), **com evidência `arquivo:linha` e severidade**.

### 3.6 Veredito
**Complementares, não concorrentes.** O dossiê dá a **largura** (panorama histórico +
todos os fluxos + sugestões arquiteturais); esta investigação dá a **profundidade**
(o ciclo de dados recebe→OCR→salva→exibe→notifica, com causa-raiz e severidade).
Nenhum invalida o outro. Esta investigação **corrige 1 ponto** ("OCR não implementado"
→ "implementado, sem persistência"), **aprofunda 2 dores** que o dossiê citou de forma
genérica (dados somem nas telas; estado inchado) e **acrescenta 3 P1** (BOT não
persiste; PII sem cripto; admin sem aviso proativo). Juntos formam o quadro completo.

---

## 4. RECOMENDAÇÃO (para virar sprint quando o Luciano decidir — nada executado)

Convergência dos dois relatórios aponta **um sprint coeso de "fechamento do ciclo WA +
onboarding"** que entrega, em ordem de risco:
1. **(P1) Persistir a fatura do BOT**: salvar arquivo no Supabase + criar
   `FaturaProcessada` + popular `consumoStashOcr` ao confirmar o OCR no fluxo do bot.
2. **(P1) LGPD**: descartar `mediaBase64` de `dadosTemp` logo após o OCR (não guardar
   base64 em coluna texto).
3. **(P1/P2) Cadeia de notificação** (o que o Luciano pediu): aviso proativo ao admin +
   WhatsApp pra pessoa em cada degrau + duplo-hop. *(Detalhe pronto na memória
   `design_onboarding_notificacoes_status_chain_06_09.md`.)*
4. **(P2) Tornar PENDENTE visível** nas telas (contadores + UC) — resolve o "some".
5. **(P2/P3) Governança** (do dossiê): validar `historicoConsumo`, cron de limpeza de
   `tmp`, auditar etapas/ações órfãs (drift DB↔código), fila persistente pro lote.

> **Itens a verificar numa próxima rodada read-only:** (a) o passo FINAL do fluxo
> cooperado normal do bot realmente não cria `FaturaProcessada`? (lacuna); (b) quais
> `FluxoEtapa` no DB apontam ações sem handler (confirma os órfãos do dossiê via SELECT);
> (c) valor exato de `OCR_MAX_TOKENS`.

---
*Relatório read-only. Não-commitado (regra "não executar"). Evidências cruzam
`origin/main b810e7b`. Workflow `wf_e6ef7adb-9e3`.*
