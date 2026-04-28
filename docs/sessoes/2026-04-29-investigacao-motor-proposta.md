# Investigação Motor de Proposta — 2026-04-29

> Investigação read-only para alimentar Doc-0 Fatia 2 (PRODUTO.md). Sem alteração de código além deste relatório.
> Fonte: leitura integral do módulo `backend/src/motor-proposta/` + cruzamento com `publico/`, `cooperados/`, `usinas/`, `documentos/`, schema Prisma e telas web.

---

## 1. Estrutura do módulo

**Diretório:** `backend/src/motor-proposta/` (pasta única, sem subdomínios além de `dto/`).

| Arquivo | Linhas | Função |
|---|---:|---|
| `motor-proposta.service.ts` | **1.694** | Núcleo: cálculo, aceite, lista de espera, tarifas, reajuste, aprovação remota, assinatura, modelos |
| `motor-proposta.service.aceitar.spec.ts` | 503 | Specs Jest do fluxo `aceitar()` (T3/T4/T8) — 16 testes |
| `motor-proposta.service.spec.ts` | 349 | Specs do `calcular()` (cálculo puro) — 14 testes |
| `motor-proposta.controller.ts` | 280 | 32 endpoints |
| `proposta-pdf.service.ts` | 216 | Render HTML da proposta (consome `FaturaProcessada` só para histórico) |
| `motor-proposta.job.ts` | 97 | Cron 9h — lembrete de propostas pendentes 24h |
| `motor-proposta.module.ts` | 26 | Imports/providers |
| `pdf-generator.service.ts` | 31 | Wrapper HTML→PDF (Puppeteer/lib externa) |
| `dto/calcular-proposta.dto.ts` | 48 | Input do `calcular()` |
| `dto/configuracao-motor.dto.ts` | 51 | Update da `ConfiguracaoMotor` |
| `dto/tarifa-concessionaria.dto.ts` | 33 | Tarifa nova |
| `dto/upload-modelo.dto.ts` | 13 | Upload modelo de contrato/procuração |
| `dto/simular-reajuste.dto.ts` | 12 | Reajuste anual |

**Specs:** 30 testes Jest (16 + 14). 1 cron registrado.

### 32 endpoints

```
GET    /motor-proposta                                     dashboard (stats + últimas 10 propostas)
POST   /motor-proposta/calcular                            calcular proposta (entrada principal)
POST   /motor-proposta/confirmar-opcao                     mesmo de calcular() — usado quando outlier exige escolha
POST   /motor-proposta/calcular-com-plano                  calcular usando baseCalculo do Plano (OCR multi-componente)
POST   /motor-proposta/aceitar                             aceitar proposta + cria Contrato + Lista Espera (SUPER_ADMIN/ADMIN)
GET    /motor-proposta/configuracao                        get ConfiguracaoMotor (singleton)
PUT    /motor-proposta/configuracao                        update ConfiguracaoMotor
DELETE /motor-proposta/proposta/:id                        excluir + cancelar contrato derivado
PUT    /motor-proposta/proposta/:id                        editar proposta (status/desconto/kwh/plano)
GET    /motor-proposta/proposta/:id/html                   render HTML
POST   /motor-proposta/proposta/:id/enviar-pdf             gera PDF e envia via WhatsApp
GET    /motor-proposta/historico/:cooperadoId              propostas de um cooperado
POST   /motor-proposta/tarifa-concessionaria               criar tarifa
GET    /motor-proposta/tarifa-concessionaria/atual         (Public) — tarifa vigente por concessionária
GET    /motor-proposta/tarifa-concessionaria               listar tarifas
PUT    /motor-proposta/tarifa-concessionaria/:id           atualizar tarifa
DELETE /motor-proposta/tarifa-concessionaria/:id           excluir tarifa
GET    /motor-proposta/historico-reajustes                 listar reajustes aplicados
POST   /motor-proposta/simular-reajuste                    preview reajuste (não persiste)
POST   /motor-proposta/aplicar-reajuste                    aplicar reajuste em contratos ATIVOS
GET    /motor-proposta/lista-espera                        (SUPER_ADMIN/ADMIN) — fila AGUARDANDO
POST   /motor-proposta/lista-espera/:id/alocar             alocar entrada em usina (valida ANEEL)
POST   /motor-proposta/proposta/:id/enviar-aprovacao       gera tokenAprovacao (NÃO envia — só console.log)
GET    /motor-proposta/proposta-por-token/:token           (Public) — busca por tokenAprovacao
POST   /motor-proposta/aprovar                             (Public) — recebe aceite remoto, muda status
POST   /motor-proposta/proposta/:id/aprovar-presencial     (SUPER_ADMIN/ADMIN) — set status=ACEITA local
POST   /motor-proposta/proposta/:propostaId/documentos/status   (SUPER_ADMIN/ADMIN) APROVADO|PENDENTE|REPROVADO
POST   /motor-proposta/proposta/:id/enviar-assinatura      gera tokenAssinatura + WA + email (NOTIFICACOES_ATIVAS)
GET    /motor-proposta/documento-por-token/:token          (Public) — busca por tokenAssinatura
POST   /motor-proposta/assinar                             (Public) — assinar TERMO ou PROCURACAO
POST   /motor-proposta/upload-modelo                       (SUPER_ADMIN/ADMIN) upload modelo CONTRATO/PROCURACAO
GET    /motor-proposta/modelos-padrao                      (ADMIN/OPERADOR) — listar (fallback hardcoded)
```

### Cron

| Schedule | Função | Comportamento |
|---|---|---|
| `EVERY_DAY_AT_9AM` | `lembretePropostasPendentes()` | Busca propostas com `tokenAssinatura` e sem `termoAdesaoAssinadoEm` há > 24h sem `lembreteEnviadoEm`. Envia WA + email **REAIS** (`whatsappSender.enviarMensagem` + `email.enviarEmail`). Filtra `cooperado.ambienteTeste=false` em dev. **Guardado por `process.env.NOTIFICACOES_ATIVAS === 'true'`** (em dev fica no-op). |

---

## 2. Função principal (prosa)

O Motor de Proposta é **a engrenagem que converte um lead em contrato**. Recebe consumo (kWh + R$) de uma fatura — vinda do cadastro público, do wizard admin ou de OCR — e produz uma proposta calculada com o desconto do plano escolhido. Quando aceita (pelo cooperado remotamente, presencialmente ou direto pelo admin), o motor persiste a proposta, **cria o contrato**, **calcula o `percentualUsina`**, escolhe a usina compatível com a distribuidora da UC (regra ANEEL), e — se não houver usina disponível — coloca o cooperado em **lista de espera** com posição automática.

### Entradas principais (`calcular()`)

- `cooperadoId` — para resolver UC, distribuidora, cooperativaId
- `planoId` — desconto vem **exclusivamente do plano** (Plano.descontoBase)
- `historico` (12 meses) + `kwhMesRecente` + `valorMesRecente`
- `mesReferencia`
- Opcional: `tipoFornecimento` (mono/bi/trifásico → mínimo faturável ANEEL)
- Opcional: `opcaoEscolhida` (quando outlier detectado pediu escolha)
- Opcional: `baseDesconto` (`KWH_CHEIO` ou `VALOR_FATURA`)

### Cálculos centrais

```
tarifaUnitSemTrib = tusdNova + teNova
kwhApuradoBase   = valorMesRecente / kwhMesRecente
descontoAbsoluto = tarifaUnitSemTrib × (descontoBase% / 100)
valorCooperado   = kwhApuradoBase − descontoAbsoluto

economiaMensal   = descontoAbsoluto × kwhContrato       (KWH_CHEIO)
economiaMensal   = valorBase × descontoBase%            (VALOR_FATURA)
economiaAnual    = economiaMensal × 12

# Ajuste se acima da média da cooperativa (config.acaoResultadoAcima = AUMENTAR_DESCONTO)
descontoNecessario = ((kwhApurado − mediaCoop) / tarifaUnitSemTrib) × 100
descontoFinal      = MIN(descontoNecessario, descontoBase)

# Outlier
outlier = kwhMesRecente > kwhMedio12m × thresholdOutlier (default 1.5)
```

`calcularComPlano()` é uma **versão paralela** usada após OCR — recebe TUSD/TE/PIS/COFINS/CIP/ICMS discriminados e respeita **`baseCalculo`** do plano (KWH_CHEIO | SEM_TRIBUTO | COM_ICMS | CUSTOM) e **`tipoDesconto`** (APLICAR_SOBRE_BASE | ABATER_DA_CHEIA — fórmulas Tipo I/II do REGRAS-PLANOS-E-COBRANCA.md).

### Saídas

- `PropostaCooperado` (status PENDENTE inicialmente; ACEITA depois do `aceitar()`)
- `Contrato` (numerado, vinculado a UC + Usina ou em LISTA_ESPERA)
- `ListaEspera` (se sem usina compatível)
- Snapshots no Contrato: `baseCalculoAplicado`, `tipoDescontoAplicado`, `valorContrato`, `descontoPromocionalAplicado`, `mesesPromocaoAplicados`, `valorContratoPromocional`, `tarifaContratualPromocional` — congelam o plano no aceite.
- `HistoricoStatusCooperado` com `usuarioId` (audit trail T3 PARTE 4)
- `notificacoes` in-app: CONTRATO_CRIADO ou LISTA_ESPERA, e PLANO_FALLBACK_APLICADO se admin não escolheu plano

### Ciclo de vida da proposta

Status é `String @default("PENDENTE")` — **não é enum, é texto livre**. Valores **realmente usados no código**:

- `PENDENTE` (default — proposta criada mas não aceita)
- `ACEITA` (após `aceitar()`, `aprovarRemoto(aceite=true)` ou `aprovarPresencial()`)
- `RECUSADA` (após `aprovarRemoto(aceite=false)`)
- `CANCELADA` (proposta antiga substituída por outra ACEITA do mesmo cooperado/mês, ou contrato encerrado por exclusão)

**Ausentes no código** (mencionados em docs antigas mas não implementados): `PENDENTE_ASSINATURA`, `EXPIRADA`, `REJEITADA`, `ASSINADA`. Estes status **não existem**. A "assinatura" é tracking pelos campos `termoAdesaoAssinadoEm`/`procuracaoAssinadaEm` — não muda `status`.

---

## 3. Ciclo de vida real

```
                                   ┌────────────────────────────┐
   /cadastro público ─────────►  calcular() ─►  aceitar()  ──┐  │
   (publico.controller.ts)                                    │  │
                                                              ▼  ▼
   /dashboard/cooperados/novo ─►  calcular() ─►  aceitar()  status=ACEITA
   (Step3 + Step4)                                              │
                                                                ▼
   /aprovar-proposta?token=xxx ─► aprovarRemoto()  ──► status=ACEITA / RECUSADA
   (Public, via tokenAprovacao)
                                                                │
   admin local presencial ───────► aprovarPresencial() ─► status=ACEITA
                                                                │
                  ┌─────────────────────────────────────────────┘
                  ▼
   /aceitar() cria PropostaCooperado(ACEITA) + Contrato(PENDENTE_ATIVACAO ou LISTA_ESPERA)
                  │
                  ▼
   admin: análise de documentos do cooperado
   POST /proposta/:id/documentos/status
        APROVADO  ─► enviarLinkAssinaturaDocs()
                       └── gera tokenAssinatura
                       └── marca cooperado APROVADO
                       └── gera PDF (best-effort)
                       └── envia WA + email com link  ← guardado por NOTIFICACOES_ATIVAS
        PENDENTE  ─► registra motivo + WA + email
        REPROVADO ─► registra motivo + WA + email
                  │
                  ▼
   cooperado abre /portal/assinar/:token
        POST /assinar { tipoDocumento: TERMO }     ─► termoAdesaoAssinadoEm = now()
        POST /assinar { tipoDocumento: PROCURACAO } ─► procuracaoAssinadaEm = now()
        ambos assinados ─► tokenAssinatura = null
                          └── enviarCopiaAssinada() (email com PDF)
                  │
                  ▼
   cron 9h diário ─► se tokenAssinatura ≠ null e termoAdesao = null e createdAt > 24h:
                     envia lembrete WA + email + grava lembreteEnviadoEm

   (CANCELADA: ao excluir proposta ou ao aceitar nova proposta no mesmo mês para o mesmo cooperado)
```

**Estado de proposta NÃO depende de assinatura.** Uma proposta com status=ACEITA pode estar (a) sem documentos enviados, (b) com documentos enviados não-analisados, (c) com docs reprovados, (d) com link de assinatura enviado, (e) com termo assinado mas procuração não, (f) com ambos assinados. O `status` permanece ACEITA o tempo todo.

### Confirmações sobre o cron e enviarAprovacao

- ✅ **Cron 9h funciona e envia WA + email REAIS** quando `NOTIFICACOES_ATIVAS=true` — usa `whatsappSender.enviarMensagem` e `email.enviarEmail`. Em dev fica no-op silenciosamente. **Memória anterior estava desatualizada** ao dizer "só console.log".
- ⚠️ **`enviarAprovacao()` (POST `/enviar-aprovacao`) — só faz `console.log`.** Persiste o `tokenAprovacao` no banco, retorna o link, mas **não envia WA nem email** (só `console.log('[APROVAÇÃO] Link para ${destino}: ${link}')` no `motor-proposta.service.ts:1192`). Memória anterior estava certa.
- ✅ **`enviarLinkAssinaturaDocs()` (POST `/enviar-assinatura`) — envia WA + email reais** se `NOTIFICACOES_ATIVAS=true` (e PDF anexo via WA quando gerado).

Conclusão: o **fluxo de assinatura** (link + lembrete) está plenamente operacional; o **fluxo de aprovação remota da proposta** (`enviarAprovacao`) está parcialmente quebrado — gera token e link mas não notifica o cooperado.

---

## 4. Caminho A — Cadastro Público (`/cadastro`)

`backend/src/publico/publico.controller.ts:387-433` — depois que cria o `Cooperado` + `Uc` em transação:

1. Chama `motorProposta.calcular(...)` com `historico`, `kwhMesRecente`, `valorMesRecente`, `planoId` (do body ou primeiro plano ativo do tenant).
2. Se **outlier**: retorna `{ ok: false, erro: 'OUTLIER_DETECTADO', opcoes }` para a tela escolher.
3. Se cálculo OK: chama `motorProposta.aceitar(...)` **direto** — cria proposta ACEITA + contrato (PENDENTE_ATIVACAO ou LISTA_ESPERA).
4. Falha do motor é **silenciosa**: `try/catch` com `logger.warn` — cadastro não aborta. Cooperado e UC ficam criados; proposta fica sem ser gerada.

Em outras palavras, no caminho público **a "proposta" existe sem que o cooperado a tenha aprovado explicitamente** — o cadastro é interpretado como aprovação. Isso difere do caminho admin, onde o admin aciona `aceitar()` num passo separado.

## 5. Caminho B — Wizard Admin (`/dashboard/cooperados/novo`, 7 steps)

| Step | Endpoint Motor chamado | O que faz |
|---|---|---|
| Step1Fatura | `GET /motor-proposta/tarifa-concessionaria/atual?distribuidora=...` | Carrega tarifa vigente para autopreencher |
| Step2Dados | — | (sem motor) |
| **Step3Simulacao** | **POST `/motor-proposta/calcular`** | Cálculo principal com retorno de outlier/opções |
| **Step4Proposta** | **POST `/motor-proposta/aceitar`** | Aceite explícito do admin → gera proposta + contrato |
| Step5Documentos | — | Upload pelo cooperado |
| Step6Contrato | `POST /motor-proposta/proposta/:id/documentos/status` | APROVADO/PENDENTE/REPROVADO (com motivo) |
| Step7Alocacao | `GET /motor-proposta/historico/:cooperadoId`, `GET /motor-proposta/lista-espera`, `POST /motor-proposta/proposta/:id/enviar-assinatura`, `POST /motor-proposta/lista-espera/:id/alocar` | Envia link de assinatura + aloca em usina |

**Diferença crítica:** o admin escolhe planoId no Step4; o cadastro público pega o **primeiro plano ativo qualquer** quando body.planoId vem vazio — sem garantia de que é o plano certo (cf. `planoId = body.planoId || primPlano?.id || ''`).

---

## 6. Aceitação → Contrato → Alocação

`aceitar()` (linhas 467-833) opera **transação SERIALIZABLE** com:

1. Cancela propostas anteriores ACEITAS do mesmo `cooperadoId` + `mesReferencia`.
2. Cria a `PropostaCooperado` ACEITA com todos os campos calculados + `validaAte = +30 dias`.
3. Procura **UC do cooperado sem contrato vigente** (`status NOT IN (PENDENTE_ATIVACAO, ATIVO, LISTA_ESPERA)`). Se nenhuma → retorna aviso, **não cria contrato**.
4. Procura usina:
   - Filtra **`distribuidora = ucDisponivel.distribuidora`** (regra ANEEL)
   - Para cada usina elegível: `kwhDisponivel = capacidade − Σ kwhContrato(ATIVO)`. Pega a primeira em que cabe.
5. Gera número do contrato (`contratosService.gerarNumeroContrato(tx)` — centralizado dentro da tx).
6. Calcula `percentualUsina = (kwhContrato / capacidade) × 100`.
7. Cria `Contrato`:
   - `status = PENDENTE_ATIVACAO` se achou usina, senão `LISTA_ESPERA`
   - `valorContrato` só para `modeloCobranca = FIXO_MENSAL`. Para COMPENSADOS/DINAMICO fica null.
   - Snapshots: `baseCalculoAplicado`, `tipoDescontoAplicado`, e — se promoção válida — `descontoPromocionalAplicado`, `mesesPromocaoAplicados`, `valorContratoPromocional`, `tarifaContratualPromocional`.
8. Se LISTA_ESPERA: cria `ListaEspera` com `posicao = COUNT(AGUARDANDO) + 1`.

**Pós-transação (best-effort):**
- Notificação in-app `CONTRATO_CRIADO` ou `LISTA_ESPERA`.
- Se `usouFallbackPlano`: notificação `PLANO_FALLBACK_APLICADO`.
- `HistoricoStatusCooperado` com `usuarioId` (audit T3 PARTE 4) — motivo registra desconto%, kwh, propostaId.
- `cooperadosService.marcarPendenteDocumentos(...)` + `notificarCooperadoEnvioDocumentos(...)` (WA + email guardados por `NOTIFICACOES_ATIVAS`).
- `cooperadosService.checkProntoParaAtivar(...)`.

### `alocarListaEspera()` (linhas 1098-1171)

- Valida regra ANEEL via `usinasService.validarCompatibilidadeAneel(ucId, usinaId)`.
- Soma `percentualUsina` de contratos ATIVO/PENDENTE_ATIVACAO da usina e bloqueia se ultrapassar 100%.
- Atualiza Contrato (`usinaId`, `status`, `percentualUsina`) e ListaEspera (`status=ALOCADO`) em transação SERIALIZABLE.

---

## 7. Pipeline OCR alimentando Motor

**Conclusão: NÃO há ligação automática entre `FaturaProcessada` e Motor de Proposta.**

- `proposta-pdf.service.ts:28` lê `FaturaProcessada` apenas para enriquecer o **histórico no PDF da proposta** (preview de consumo).
- `backend/src/faturas/*.service.ts` não tem nenhuma chamada a `MotorPropostaService` (`grep` não encontrou referências).
- Quando admin aprova uma `FaturaProcessada` na **Central de Faturas**, isso apenas marca a fatura como aprovada — não dispara `calcular()` nem `aceitar()` para nenhuma proposta. Os dois fluxos são **paralelos e desconectados**.
- O caminho que **usa OCR no Motor** é o cadastro público quando o usuário sobe a fatura no formulário inicial: o `historicoConsumo` já vem extraído e passa por `calcular()`. Mas isso é frontend → API → Motor; não passa por `FaturaProcessada`.

Esta é uma das **lacunas arquiteturais** já registradas: pipeline OCR e Motor não se cruzam.

---

## 8. Frontend correlato

### 22 telas/arquivos tocam Motor de Proposta

**Dashboard admin (`web/app/dashboard/`)** — 13 arquivos:
- `motor-proposta/page.tsx` — dashboard com últimas propostas + KPIs
- `motor-proposta/configuracao/page.tsx` — edita `ConfiguracaoMotor` (threshold, ações outlier, mínimo faturável)
- `motor-proposta/lista-espera/page.tsx` — lista AGUARDANDO + alocação
- `motor-proposta/reajustes/page.tsx` — `simular-reajuste` + `aplicar-reajuste`
- `motor-proposta/tarifas/page.tsx` — CRUD `TarifaConcessionaria`
- `cooperados/[id]/page.tsx` — aceitar legado (sem planoId, dispara fallback)
- `cooperados/[id]/fatura-mensal/page.tsx` — auxiliar
- `cooperados/novo/steps/Step1Fatura.tsx, Step3Simulacao.tsx, Step4Proposta.tsx, Step6Contrato.tsx, Step7Alocacao.tsx` — wizard 7 steps
- `cooperativas/nova/page.tsx`, `parceiros/novo/steps/Step8Documentos.tsx`, `configuracoes/bandeiras/page.tsx`, `dashboard/page.tsx`, `dashboard/layout.tsx` — referências indiretas (config tenant + sidebar)

**Portal cooperado (`web/app/portal/`)** — 1 tela:
- `portal/assinar/[token]/page.tsx` — assina TERMO + PROCURACAO via `/motor-proposta/assinar`

**Telas públicas** — 3 arquivos:
- `cadastro/page.tsx` — fluxo público (Caminho A)
- `aprovar-proposta/page.tsx` — recebe `tokenAprovacao`, chama `/motor-proposta/aprovar` (Public)
- `assinar/page.tsx` — versão antiga (precede `/portal/assinar/[token]`) — **possível drift**, vale verificar se ainda roda ou se é dead code

**Parceiro multi-papel** — 1:
- `parceiro/motor-proposta/page.tsx` — visão do parceiro institucional (recém-introduzida; cf. memória multi-papel)

**TODOs/hardcodes no frontend correlato:** `grep` não encontrou nada relevante (TODO/FIXME/HACK/console.log) nas pastas `dashboard/motor-proposta/`, `portal/assinar/`, `aprovar-proposta/`, `assinar/`. Limpo.

---

## 9. Modelo de dados

### `PropostaCooperado` (`schema.prisma:775`)

| Campo | Tipo | Pra que serve | Quem preenche |
|---|---|---|---|
| `id` | String cuid | PK | default |
| `cooperadoId` | String FK | dono da proposta | input |
| `mesReferencia` | String | "AAAA-MM" da fatura analisada | input |
| `kwhMesRecente`, `valorMesRecente` | Decimal(10,5) | Snapshot da última fatura | calcular() |
| `kwhMedio12m`, `valorMedio12m` | Decimal(10,5) | Média histórica | calcular() |
| `outlierDetectado` | Boolean | Se mês recente > threshold × média | calcular() |
| `tusdUtilizada`, `teUtilizada`, `tarifaUnitSemTrib` | Decimal(10,5) | Tarifa snapshot | calcular() |
| `kwhApuradoBase` | Decimal(10,5) | valor/kwh apurado | calcular() |
| `baseUtilizada` | String | "MES_RECENTE" ou "MEDIA_12M" | calcular() |
| `descontoPercentual`, `descontoAbsoluto` | Decimal(10,5) | Desconto aplicado | calcular() (vem do Plano) |
| `kwhContrato` | Decimal(10,5) | kWh efetivo do contrato (pode descontar mínimo faturável) | calcular() |
| `valorCooperado` | Decimal(10,5) | R$/kWh líquido pro cooperado | calcular() |
| `economiaAbsoluta`, `economiaPercentual`, `economiaMensal`, `economiaAnual`, `mesesEquivalentes` | Decimal(10,5) | Métricas de economia | calcular() |
| `mediaCooperativaKwh`, `resultadoVsMedia` | Decimal(10,5) | Comparativo com média do tenant | calcular() |
| `opcaoEscolhida` | String? | "MES_RECENTE" ou "MEDIA_12M" quando outlier | calcular()/aceitar() |
| `status` | String default "PENDENTE" | PENDENTE/ACEITA/RECUSADA/CANCELADA | aceitar()/aprovarRemoto()/aprovarPresencial() |
| `planoId` | String? FK Plano | Plano aplicado | input |
| `validaAte` | DateTime | +30 dias após criação | aceitar() |
| `cooperativaId` | String? | Multi-tenant | herança ou seed |
| `tokenAprovacao` | String? @unique | Token p/ aprovação remota | enviarAprovacao() |
| `aprovadoEm`, `aprovadoPor`, `modoAprovacao` | DateTime?/String?/String? | Quando/quem/como aprovou | aprovarRemoto()/aprovarPresencial() |
| `termoAdesaoAssinadoEm`, `termoAdesaoAssinadoPor` | DateTime?/String? | Termo assinado | assinarDocumento('TERMO') |
| `procuracaoAssinadaEm`, `procuracaoAssinadaPor` | DateTime?/String? | Procuração assinada | assinarDocumento('PROCURACAO') |
| `tokenAssinatura` | String? @unique | Link de assinatura | enviarLinkAssinaturaDocs() |
| `lembreteEnviadoEm` | DateTime? | Marcador anti-spam do cron 9h | job |
| `copiaAssinadaEnviadaEm` | DateTime? | Cópia PDF enviada após ambas assinaturas | enviarCopiaAssinada() |
| `createdAt`, `updatedAt` | DateTime | Auditoria | default |
| `contratos` | Contrato[] | Contratos derivados desta proposta | aceitar() |

### Models adjacentes

**`ConfiguracaoMotor` (linha 689)** — singleton (sem unique de cooperativaId, mas tem campo). Define:
- `fonteKwh` (MES_RECENTE | MEDIA_12M)
- `thresholdOutlier` (default 1.5)
- `acaoOutlier` (OFERECER_OPCAO | MAIOR_RETORNO)
- `acaoResultadoAcima` (AUMENTAR_DESCONTO | USAR_FATURA — código só implementa AUMENTAR_DESCONTO de fato)
- `acaoResultadoAbaixo` (USAR_FATURA — não implementado)
- Configuração de reajuste (`indicesCorrecao`, `combinacaoIndices`, `limiteReajusteConces`, `diaAplicacaoAnual`, `mesAplicacaoAnual`, `aplicacaoCorrecao`)
- `aprovarManualmente` (default true — não checado em nenhum lugar do code; **dead config**)
- Mínimo faturável (default 30/50/100 kWh para mono/bi/trifásico — **mas o `calcular()` lê esses valores via `configTenant.get('minimo_monofasico', cooperativaId)`, não direto do `ConfiguracaoMotor`**, ou seja: campos `consumoMinimo*Kwh` da `ConfiguracaoMotor` estão **inertes**).

**`TarifaConcessionaria` (linha 714)** — uma linha por concessionária por data de vigência. Lookup é por substring case-insensitive sem acentos (linha 97-104 do service): "edp" matcha "EDP-ES" e vice-versa. Default: `tusd=0.3, te=0.2` se nada encontrado (perigoso — silencia bug de dados).

**`HistoricoReajuste` (linha 736)** — registro de cada reajuste aplicado (snapshot dos contratos afetados, valores antes/depois).

**`HistoricoReajusteTarifa` (linha 757)** — linha por contrato afetado pelo reajuste. **Não é gravado pelo Motor atual** (`grep` não encontra referências); é tabela órfã ou usada por outro pipeline.

**`ListaEspera` (linha 896)** — fila com `posicao` integer + `status` string ("AGUARDANDO" | "ALOCADO" | "PROMOVIDO" | "ATENDIDO" — esses dois últimos não aparecem em código do motor, possivelmente legado de migrações).

**`ModeloDocumento` (linha 1417)** — modelos de contrato/procuração com placeholders `{{VARIAVEL}}`. Listagem cai em fallback hardcoded quando não há nada no banco (`motor-proposta.service.ts:1632`).

**`HistoricoStatusCooperado`** — usado pelo Motor para audit trail T3 PARTE 4 (linha 808). Persiste cada `aceitar()` com `usuarioId`, `motivo` descritivo.

---

## 10. Hardcodes / TODOs / BLOQUEIOS

| Onde | O que | Ação prevista |
|---|---|---|
| `motor-proposta.service.ts:549` | **`BLOQUEIO_MODELOS_NAO_FIXO`** — env var; default ON. Bloqueia aceite de Plano com `modeloCobranca IN (CREDITOS_COMPENSADOS, CREDITOS_DINAMICO)`. | Remover na T9 quando mod COMPENSADOS/DINAMICO estiver pronto |
| `motor-proposta.service.ts:454-466` | **DÍVIDA T3 PARTE 4** — `aceitar()` aceita `resultado` cru no body, sem proposta PENDENTE prévia. Defesas atuais: roles+ranges+audit | T0 (refactor wizard) — persistir PENDENTE em `calcular()` |
| `motor-proposta.service.ts:1192` | `enviarAprovacao()` só faz `console.log` do link — não envia WA/email | Wire-up real (paralelizar c/ enviarLinkAssinaturaDocs) |
| `motor-proposta.service.ts:111-112` | `tusd=0.3, te=0.2` hardcoded como fallback quando tarifa não encontrada | Trocar por exception ou warning visível |
| `motor-proposta.service.ts:1633-1652` | Modelos de documento hardcoded em fallback se banco vazio | Garantir seed |
| `schema.prisma:702` | `aprovarManualmente Boolean default true` na ConfiguracaoMotor | Não consumido em lugar nenhum — **dead config** |
| `schema.prisma:704-706` | `consumoMinimo*Kwh` na ConfiguracaoMotor | Não consumidos — Motor lê via `configTenant.get(...)`. Inertes. |
| `schema.prisma:757-773` | `HistoricoReajusteTarifa` | Tabela aparentemente órfã |
| `web/app/assinar/page.tsx` | Tela pública antiga, antes do `/portal/assinar/[token]` | Confirmar se é dead route |

**Comentários no código sinalizando débito explícito (T-tickets):** T0 (refactor wizard), T3 (audit + análise docs + assinatura), T4 (snapshots promocionais), T7 (refatorar UI plano), T8 (testes integração), T9 (desbloquear COMPENSADOS).

---

## 11. Estado em produção (banco dev — 2026-04-29)

```
PropostaCooperado total: 3
  ACEITA:    1
  CANCELADA: 2

Tokens:
  com tokenAssinatura:        1
  com aprovadoEm:             0
  com termoAdesaoAssinadoEm:  0
  com procuracaoAssinadaEm:   0

ListaEspera total: 7
  AGUARDANDO: 4
  ALOCADO:    1
  PROMOVIDO:  1   ← status não tratado pelo motor atual
  ATENDIDO:   1   ← idem

TarifaConcessionaria: 2
HistoricoReajuste:    1
ConfiguracaoMotor:    1
```

**Discrepância vs memória:** memória `project_sprint11_kickoff.md` registrava "4 PropostaCooperado, 32 ListaEspera". Hoje são **3 propostas e 7 entradas em lista de espera** — possivelmente dados foram limpos ou foram incidentais de teste.

**Observações:**
- 1 proposta com `tokenAssinatura` ativo mas sem nenhuma assinatura concluída — candidata ao próximo lembrete do cron 9h se `NOTIFICACOES_ATIVAS=true`.
- Nenhuma proposta tem `aprovadoEm` preenchido — todas que viraram ACEITA foram via `aceitar()` direto (não via aprovação remota com tokenAprovacao).
- Status `PROMOVIDO` e `ATENDIDO` na ListaEspera são **legados não tratados** pelo motor — seu código só conhece AGUARDANDO/ALOCADO. Vale confirmar de onde vieram.

---

## 12. Síntese

**Quão maduro está o Motor?**
Mais maduro do que a memória sugeria. Tem:
- 30 specs Jest cobrindo cálculo, aceitar, snapshots, BLOQUEIO_MODELOS_NAO_FIXO, lista de espera, fallback de plano.
- Cron real funcional com lembrete WA + email (não é mock).
- Audit trail T3 PARTE 4 com usuário+motivo+ranges.
- Validação ANEEL real (mesma distribuidora UC × Usina) em duas portas (`aceitar()` + `alocarListaEspera()`).
- Snapshots no Contrato no aceite (baseCalculoAplicado, tipoDescontoAplicado, promocionais) — congelam o plano.
- Transação SERIALIZABLE para evitar race condition em `percentualUsina` e `posicao` na fila.

**Onde está o atrito principal?**
Três pontos:
1. **`enviarAprovacao()` é fake.** Gera `tokenAprovacao` e link mas só `console.log`. A tela `/aprovar-proposta?token=` existe e funciona, mas o cooperado nunca recebe o link a não ser que alguém copie do log e mande manualmente.
2. **Pipeline OCR (Central de Faturas) não conversa com Motor.** Se admin aprova uma `FaturaProcessada` na Central, nada dispara no Motor. As propostas só nascem por (a) cadastro público ou (b) wizard admin manual.
3. **Tela `/dashboard/cooperados/[id]/page.tsx` chama `aceitar()` sem `planoId`** — cai em fallback "primeiro plano ativo" + notificação de revisão (já com gate, mas é tela legada que vale aposentar — comentário do code reconhece isso, ticket Sprint 7).

**O que está bloqueado e por quê?**
- Planos com `modeloCobranca IN (CREDITOS_COMPENSADOS, CREDITOS_DINAMICO)` rejeitam aceite (env `BLOQUEIO_MODELOS_NAO_FIXO`). Apenas `FIXO_MENSAL` aceita hoje. Sprint 9 (T9) destrava.
- Proposta-padrão sem proposta-PENDENTE-prévia (`aceitar()` recebe `resultado` cru) — só protegido por roles + ranges + audit. T0 (refactor wizard) fecha esse buraco.

**Recomendação para Camadas 3-10 do PRODUTO.md**

1. **Camada 4 (Estrutura física)** — descrever o **encadeamento real** "UC do cooperado tem distribuidora → usina compatível → contrato → percentualUsina". Mencionar que se não tiver vaga vira lista de espera com posição automática.
2. **Camada 5 (Fluxos de negócio)** — Motor de Proposta merece **2 fluxos críticos**:
   - **F1: Cadastro Público com cálculo automático** (Caminho A — cooperado vira contrato no mesmo POST)
   - **F2: Wizard Admin 7-Step com aceite explícito** (Caminho B — admin acompanha e aceita)
   E **um fluxo paralelo** (F3): Análise de docs → Assinatura digital (TERMO + PROCURACAO) → cópia assinada por email.
3. **Camada 6 (Mecanismos de fidelidade)** — explicar snapshot promocional no Contrato (descontoPromocional × mesesPromocao). É como o Plano "congela" no momento do aceite e não retroage.
4. **Camada 7 (Histórias humanas)** — Carlos (consumidor) ilustra o **outlier**: mês passado pulou 80%, motor pergunta "média ou último?". Vale mostrar isso como diferencial.
5. **Camada 9 (Apêndice — semáforo)** — registrar:
   - 🟢 cálculo, snapshots, lista de espera, ANEEL, audit, cron lembrete.
   - 🟡 análise de docs (funciona mas só 1 admin pode aprovar; não tem fluxo de "REPROVADO → reupload"; assinatura é via campos no model, não estado próprio).
   - 🔴 `enviarAprovacao()` (fake), pipeline OCR↔Motor desconectados, tela legada `/cooperados/[id]` precisa aposentar.

---

*Investigação read-only. Conduzida por Claude Code (Sonnet) em 2026-04-29 a partir do prompt do Luciano. Tudo aqui é leitura do código atual — sem alterações.*
