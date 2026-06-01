# Sub-Sprint F — Fase 1 Read-Only EXPANDIDA — Temas Luciano (Despesas + Telemetria + Relatório PDF)

> Sessão: 27/05/2026. Decisão 23 ativa — nenhum arquivo editado. Pausa do MVP+ no commit `fc2f048` (Etapa A entregue + aditiva: PROPRIETARIO no enum + ConviteProprietario + script seed cooperebr1 idempotente).
> Fase 1 expandida esgotada em ~1h vs ~3-4h estimado.

## 0. TL;DR

**A investigação destrava radicalmente as estimativas.** Quase tudo o que parecia gap crítico **já existe parcial/totalmente implementado** mas estava **desativado, esquecido ou subutilizado**:

| Tema | Achado | Impacto na estimativa |
|---|---|---|
| **Despesas + Responsabilidade** | `ContaAPagar` com `usinaId`, `categoria`, `comprovante`, status, multi-tenant — JÁ EXISTE. Falta só enum expandido + campo `responsavelPagamento` + UI admin matriz | **15-25h → 8-12h** (redução de 40%) |
| **Telemetria iSolar Cloud** | `SungrowService` 100% implementado (endpoint `gateway.isolarcloud.com.hk/openapi`, login token cache, getUsinaStatus) + `UsinaMonitoramentoConfig` com credenciais + `UsinaLeitura` + `UsinaAlerta` + cron escrito mas **DESATIVADO ("Sprint 6 Ticket 11: 0 configs habilitadas")** | **10-20h → 4-8h** (redução de 60%+) |
| **Relatório PDF mensal** | `PdfGenerator.gerarPdf(html, fileName)` existe e funciona (reusado em motor-proposta). RelatoriosService tem 5 endpoints JSON + `geracao-por-usina` reusável | **5-10h → 4-6h** (redução de 30%) |

**Total Caminho A revisado:** 16-26h (era 30-55h cego). **Caminho C revisado:** 24-40h (era 50-70h cego).

**Recomendação:** **Caminho B atualizado** — adicionar minimum viable dos 2 temas no MVP+ portal (era 3-5h extras estimativa cega, agora **2-4h reais** confirmadas pela fato existir Sungrow + ContaAPagar.usinaId + PdfGenerator).

## 1. ContasPagar — estado atual

### 1.1 Schema (linhas 2345-2378 do `schema.prisma`)

```prisma
enum CategoriaContaAPagar {
  ARRENDAMENTO_USINA
  MANUTENCAO
  SALARIO
  OUTRO
}

enum StatusContaAPagar {
  PENDENTE
  PAGO
  ATRASADO
  CANCELADO
}

model ContaAPagar {
  id             String               @id @default(cuid())
  cooperativaId  String
  cooperativa    Cooperativa          @relation(...)
  descricao      String
  categoria      CategoriaContaAPagar
  valor          Decimal              @db.Decimal(10, 2)
  dataVencimento DateTime
  dataPagamento  DateTime?
  status         StatusContaAPagar    @default(PENDENTE)
  usinaId        String?              // ✅ JÁ VINCULA usina!
  usina          Usina?               @relation(...)
  comprovante    String?              // ✅ JÁ TEM comprovante upload
  createdAt      DateTime             @default(now())
  updatedAt      DateTime             @updatedAt
  @@index([cooperativaId])
  @@index([status])
  @@index([dataVencimento])
  @@map("contas_a_pagar")
}
```

### 1.2 Service (`backend/src/contas-pagar/contas-pagar.service.ts`)

CRUD completo com multi-tenant (`cooperativaId` obrigatório). Endpoints `findAll/findOne/create/update/remove` + `include: { usina: { select: { id, nome } } }`. **Funcional.**

### 1.3 Frontend (`web/app/dashboard/contas-pagar/page.tsx`)

Tela admin existe. Cadastra despesa com seleção de usina (opcional). Não inspecionei detalhe mas estrutura básica está pronta.

### 1.4 Gaps identificados pro tema "Responsabilidade"

| Gap | Esforço |
|---|---|
| Expandir enum `CategoriaContaAPagar` (4 → ~12 valores: CUSD, MANUTENCAO_PREVENTIVA, MANUTENCAO_CORRETIVA, ROCADA, VIGILANCIA, SEGURO, IPTU_ITR, CONSUMO_AUXILIAR, INTERNET, ACOMPANHAMENTO_TECNICO + existentes) | 15min |
| Adicionar enum `ResponsavelPagamento` (PARCEIRO/PROPRIETARIO/COMPARTILHADO) | 5min |
| Adicionar campo `ContaAPagar.responsavelPagamento ResponsavelPagamento?` (opcional pra retrocompat) | 10min + migration aditiva |
| Adicionar campo `Usina.matrizResponsabilidade Json?` (mapa categoria → ResponsavelPagamento) — armazena política default da usina | 10min + migration aditiva |
| Service helper `getResponsavelDefault(usinaId, categoria)` que retorna o pagador conforme matriz | 30min |
| UI admin: tela de edição da matriz responsabilidade na página da Usina | 1-2h |
| Bloco no Portal Proprietário: despesas pagas POR ele OU compartilhadas | 1-2h |

**Total tema Responsabilidade pra produção real: 4-6h.**

## 2. Centro de custos / DRE por usina

### 2.1 Estado atual

- **Sem entidade `CentroCusto` no schema.** O conceito é coberto via:
  - `LancamentoCaixa` (linha 1115) — DR/CR genérico com `planoContasId`, `cooperadoId`, `contratoUsoId`, `convenioId`. **Mas SEM `usinaId` direto** — só indireto via `contratoUsoId` ou `cooperadoId.contratos[].usinaId`.
  - `PlanoContas` (linha 1099) — estrutura contábil (código, tipo, grupo).
  - `ContaAPagar.usinaId` — único vínculo direto despesa↔usina.

### 2.2 Relatórios existentes

`RelatoriosService` (`backend/src/relatorios/relatorios.service.ts`) tem:
- `inadimplencia({usinaId?, cooperativaId?, tipoCooperado?})` — breakdown por usina + tipo cooperado + faixa kWh + top 10 inadimplentes
- `projecaoReceita(meses, cooperativaId?)` — projeção 6 meses com tarifa por distribuidora + breakdown por usina

`RelatoriosController` expõe 5 endpoints: `inadimplencia`, `projecao-receita`, `producao-vs-cobranca`, `conferencia-kwh`, `geracao-por-usina`. **Todos JSON, restritos a SUPER_ADMIN/ADMIN/OPERADOR.** Nenhum PDF.

### 2.3 Gap pra "Centro de Custos por Usina"

| Gap | Esforço |
|---|---|
| Endpoint `GET /usinas/:id/centro-custos?periodo=YYYY-MM` retornando: receitas (do cooperado, derivado de Cobranca), despesas (ContaAPagar por categoria), líquido (receitas - despesas), breakdown por responsável | 1-2h |
| Frontend bloco no Portal Proprietário "Centro de Custos da Usina X — Mês YYYY-MM" | 1-2h |
| LGPD: receitas mostradas em agregado (não nome do cooperado) | já no padrão proposto MVP+ |

**Total tema Centro de Custos: 2-4h.**

## 3. Responsabilidade — onde estaria

### 3.1 Estado atual

- `Usina.responsabilidade*` — **não existe** no schema atual
- `Usina.formaPagamentoDono` + `valorAluguelFixo` + `percentualGeracaoDono` (Mini-Bloco H'.9, 17/05) — sobre como cooperativa paga dono, **não cobre matriz de despesas**

### 3.2 Comparativo legado SISGDSOLAR

| Legado | Conteúdo | Mapeamento novo |
|---|---|---|
| `tbl_parametro_arrendamento` | **Global** — `valor_porcentagem_padrao_aluguel`, `valor_kWh_padrao_aluguel`, `porcentagem_seguranca_participacao_usina` | Parcialmente coberto por `Usina.formaPagamentoDono` + valores. Falta valor R$/kWh padrão (que esclarece fórmula PERCENTUAL!) |
| `tbl_empresa_usina` | E-Solares-like: nome_fantasia, razao_social, endereco, cnpj, email, data_abertura/fechamento, filiais | **Coberto parcialmente** pelos 6 campos `Usina.proprietario*` (denormalizado, sem suporte a filiais — confirmação YAGNI da Fase 1 anterior) |
| `tbl_empresa_usina_contrato` | Contrato entre empresa-proprietária × usina: ativo, data_inicio/fim/assinatura, `percentual_cobranca` (Double), observacao | **NÃO COBERTO no novo.** É equivalente a um "contrato de arrendamento" entre proprietário e cooperativa. ContratoUso existe mas é entre cooperado × usina (uso da capacidade). Pra produção real, eventualmente precisa criar `ContratoArrendamentoProprietario` — sprint próprio futuro. |
| `tbl_responsavel` | titular_da_unidade, email, CPF/CNPJ + OneToMany Tbl_usina (1 responsável → N usinas) | **Não coberto.** Confirma YAGNI da Fase 1 (multi-usina por proprietário fica como D-novo-AM débito). |

### 3.3 Fórmula PERCENTUAL desvendada parcialmente

Pelo legado: `Tbl_parametro_arrendamento.valor_kWh_padrao_aluguel` (R$/kWh) + `Tbl_usina.valor_kWh_padrao_aluguel` (override por usina) + `Tbl_usina.valor_porcentagem_padrao_aluguel` (% por usina).

**Hipótese de fórmula** (precisa confirmação Luciano — sem procedure mapeada):

```
aluguel_proprietario_mes = kwh_gerado_mes × valor_kWh_padrao_aluguel × (valor_porcentagem_padrao_aluguel / 100)
```

OU forma mais direta sem o %:

```
aluguel_proprietario_mes = kwh_gerado_mes × valor_kWh_padrao_aluguel
```

(O `valor_porcentagem_padrao_aluguel` pode ser de outra coisa — p.ex. % da margem da cooperativa ou % de segurança operacional). **Decisão Luciano ainda necessária.**

## 4. UsinaLeitura + UsinaMonitoramentoConfig + UsinaAlerta

### 4.1 Schema (linhas 1042-1097)

```prisma
model UsinaMonitoramentoConfig {
  id                String     @id @default(cuid())
  usinaId           String     @unique
  usina             Usina      @relation(...)
  habilitado        Boolean    @default(true)
  intervaloMinutos  Int        @default(30)
  reCheckMinutos    Int        @default(10)
  potenciaMinimaPct Int        @default(20)
  // ── CREDENCIAIS SUNGROW/ISOLAR CLOUD ──
  sungrowUsuario    String?
  sungrowSenha      String?    // ⚠️ sem encryption — precisa rotacionar pra ConfigGateway-style
  sungrowAppKey     String?
  sungrowPlantId    String?
  prestadorPadraoId String?
  prestadorPadrao   Prestador? @relation(...)
  prioridadeAlerta  String     @default("ALTA")
  cooperativaId     String?
  createdAt         DateTime   @default(now())
  updatedAt         DateTime   @updatedAt
  @@map("usinas_monitoramento_config")
}

model UsinaLeitura {
  id              String   @id @default(cuid())
  usinaId         String
  usina           Usina    @relation(...)
  timestamp       DateTime @default(now())
  statusOnline    Boolean
  potenciaAtualKw Decimal? @db.Decimal(10, 3)
  energiaHojeKwh  Decimal? @db.Decimal(15, 3)
  energiaMesKwh   Decimal? @db.Decimal(15, 3)
  energiaTotalKwh Decimal? @db.Decimal(15, 3)
  rawData         Json?
  erro            String?
  @@index([usinaId, timestamp])
  @@map("usinas_leituras")
}

model UsinaAlerta {
  id              String    @id @default(cuid())
  usinaId         String
  estado          String    @default("SUSPEITO")  // SUSPEITO / CONFIRMADO / RESOLVIDO
  tipo            String                          // BAIXA_GERACAO / OFFLINE
  descricao       String
  primeiraLeitura DateTime
  confirmadoEm    DateTime?
  resolvidoEm     DateTime?
  ocorrenciaId    String?
  cooperativaId   String?
  @@map("usinas_alertas")
}
```

### 4.2 Estado operacional

- **Schemas completos e prontos.**
- **Service `MonitoramentoUsinasService` implementado** com método `verificarUsina(config)` que chama `SungrowService.getUsinaStatus` e cria `UsinaLeitura` + cria `UsinaAlerta` quando potência abaixo do mínimo.
- **Cron DESATIVADO** (linha 21 do service): `// Sprint 6 Ticket 11: desativado — 0 configs habilitadas, cron rodava a cada minuto sem fazer nada. Reativar quando integração Sungrow for implementada de verdade (Sprint 9+).`
- **Frequência configurável** via `UsinaMonitoramentoConfig.intervaloMinutos` (default 30min).

### 4.3 Quem alimenta hoje

**Nada automático.** Só `MonitoramentoUsinasController` expõe `POST /:usinaId/verificar-agora` pra triggerar manualmente (restrito a SUPER_ADMIN/ADMIN/OPERADOR).

`GeracaoMensal` (modelo separado, linha 991) é **manual** — inserida via UI admin OU script seed.

## 5. Integração iSolar Cloud (=Sungrow)

### 5.1 SungrowService (`backend/src/monitoramento-usinas/sungrow.service.ts`)

**100% implementado.** Endpoint:

```
https://gateway.isolarcloud.com.hk/openapi
```

**É o iSolar Cloud!** Sungrow é a marca de inversores que usa esse cloud. Confirma o legado `Tbl_token_isolar` (mesma família).

Capacidades:
- `login(usuario, senha, appKey) → token` (cache 1h)
- `getUsinaStatus({usuario, senha, appKey, plantId}) → { online, potenciaKw, energiaHojeKwh, energiaMesKwh, energiaTotalKwh, rawData }`

**Testado em produção?** Não diretamente — cron desativado em Sprint 6. Mas a estrutura é coerente com a API real (sys_code 901, x-access-key, login token).

### 5.2 Comparativo legado

| Item | Legado SISGDSOLAR | Novo |
|---|---|---|
| Token iSolar Cloud | `Tbl_token_isolar` (appKey + accessKey GLOBAL) | `UsinaMonitoramentoConfig.sungrowAppKey/Usuario/Senha` (POR USINA) |
| Credenciais | armazenadas em texto puro (legado vazado) | armazenadas em texto puro também (⚠️ precisa migrar pra ConfigGateway-style encrypted) |
| Logic | `Gerar_Token_IsolarCloud.java` | `SungrowService.login()` — equivalente |
| Frequência | a checar (provavelmente cron diário) | configurável por usina via `intervaloMinutos` |

### 5.3 Gaps pra telemetria automática viva

| Gap | Esforço |
|---|---|
| **Reativar cron `@Cron('*/30 * * * *')`** com guard de configs habilitadas | 15min |
| UI admin pra cadastrar credenciais Sungrow (na página da Usina) | 1h |
| Encriptar `sungrowSenha` via `CredentialsEncryptor` (M27) — alinhar com política segredos | 30min |
| Endpoint `GET /monitoramento-usinas/proprietario?usinaId=X` (atual restrito a OPERADOR) — expandir guard | 30min |
| Smoke E2E com 1 plantId real da Sungrow (depende Luciano ter conta + plantId real) | 1-2h |

**Total telemetria viva pra produção: 3-4h Code + 1-2h smoke.**

## 6. Status operacional da usina

### 6.1 Estado atual

- `Usina.statusHomologacao` (enum `StatusUsina`): CADASTRADA / AGUARDANDO_HOMOLOGACAO / HOMOLOGADA / EM_PRODUCAO / SUSPENSA — **ciclo de vida, NÃO operacional.**
- **`Usina.statusOperacional` NÃO EXISTE.**

### 6.2 Comparativo legado

`Tbl_usina.status_usina Boolean` (linha 83-84 do legado) — **BOOL simples**: `true` = ligada, `false` = desligada. Modelo direto.

### 6.3 Como hoje admin reporta "manutenção"

Via `UsinaAlerta` com `tipo='OFFLINE'` ou `tipo='BAIXA_GERACAO'` — **detecção automática** quando cron rodar.

**Sem campo manual** pra admin marcar "essa usina está em manutenção planejada — não me alerte". `Usina.statusHomologacao = SUSPENSA` é o mais próximo, mas é status pesado (não pra manutenção temporária).

### 6.4 Gaps pra status liga/desliga

| Gap | Esforço |
|---|---|
| Adicionar `Usina.statusOperacional` enum `StatusOperacional` (LIGADA / DESLIGADA / MANUTENCAO_PLANEJADA / SUSPENSA) — separado do `statusHomologacao` | 15min + migration aditiva |
| Atualização automática via último `UsinaLeitura.statusOnline` (cron) | 15min |
| UI admin: botão "Marcar em manutenção" na página da Usina | 30min |
| Display passivo no Portal Proprietário: badge colorido status | 15min |

**Total status liga/desliga: 1-2h.**

## 7. Relatório mensal — geração + envio

### 7.1 Estado atual

- **`PdfGenerator.gerarPdf(html, fileName)` JÁ EXISTE** — usado em `motor-proposta` (`backend/src/motor-proposta/motor-proposta.service.ts:1486, 1628`). Provavelmente Puppeteer.
- **`RelatoriosService` tem 5 endpoints JSON** mas nenhum PDF.
- **NÃO há job `relatorio-mensal-proprietario.job.ts`** ou similar.
- **NÃO há template HTML de relatório pro proprietário**.
- `EmailService` existe (template `cooperado-homologado` etc) — pode ser reusado.

### 7.2 Comparativo legado

Não encontrei evidência de relatório PDF automático pro proprietário no legado. `LeituraPdfApi` é OCR de fatura (não geração). Provavelmente E-Solares recebia planilha por email manualmente.

### 7.3 Gaps pra relatório PDF mensal automatizado

| Gap | Esforço |
|---|---|
| Template HTML pro relatório (Handlebars ou template literal): logo, dados usina, geração mês + comparativo, repasse previsto, despesas pagas pelo proprietário, ocupação cooperados (anonimizado) | 1-2h |
| `RelatorioMensalProprietarioService.gerarRelatorio(usinaId, competencia)` que monta o HTML + chama `PdfGenerator` | 30min |
| Cron mensal `@Cron('0 7 5 * *')` dia 5 às 7am — gera e anexa em email pro `Usina.proprietarioEmail` | 1h |
| Endpoint `GET /relatorios/proprietario/:usinaId/mensal?competencia=YYYY-MM` pra baixar sob demanda no portal | 30min |
| Smoke: gerar 1 relatório pra cooperebr1 + validar visualmente | 30min |

**Total relatório PDF: 4-6h.**

## 8. Estimativa REVISADA dos 3 caminhos (com fato)

### Caminho A — MVP+ enxuto + 3 sprints próprios

| Sprint | Era cego | Revisado | Redução |
|---|---|---|---|
| **MVP+ portal** (F.1+F.2+F.3+F.4) | 12-18h | **8-14h** (Fase 1 confirma) | 30% |
| **Sub-Sprint G** — Centro de Custos + Responsabilidade despesas | 15-25h | **8-12h** | 40% (ContaAPagar.usinaId já existe) |
| **Sub-Sprint H** — Telemetria iSolar Cloud automatizada | 10-20h | **4-8h** | 60% (SungrowService 100% pronto, só reativar cron + criptografar senha + smoke) |
| **Sub-Sprint I** — Relatório PDF mensal automático | 5-10h | **4-6h** | 30% (PdfGenerator já existe e funciona) |
| **TOTAL Caminho A** | **42-73h** | **24-40h** | **45%** |

### Caminho B — MVP++ com mínimo dos 2 temas

MVP+ (8-14h) + extras:

| Extra | Esforço |
|---|---|
| Adicionar `Usina.statusOperacional` enum + display passivo portal | 1h |
| Adicionar `Usina.matrizResponsabilidade Json?` (placeholder estruturado) + display passivo portal | 1-2h |
| Expandir `CategoriaContaAPagar` enum | 15min |
| Mostrar tabela "Despesas pagas POR você" no Portal Proprietário (filtra `ContaAPagar.responsavelPagamento = PROPRIETARIO`) | 1h |
| (NÃO mexer em cron/telemetria — fica pra Sub-Sprint H) | — |
| (NÃO gerar relatório PDF — fica pra Sub-Sprint I) | — |

**Total Caminho B: 11-18h** (era 15-23h cego). MVP+ enriquecido com mínimo visível dos 2 temas, sem implementar lógica complexa.

### Caminho C — G+H+I antes do portal

Total revisado: **16-26h (G+H+I separados) + 8-14h (MVP+ portal depois)** = **24-40h**.

Era 50-70h cego. **Redução de quase 50%.**

## 9. Recomendação atualizada

**Caminho B (MVP++ mínimo dos 2 temas) — 11-18h em 2-3 sessões Code.**

Justificativa:
1. **Custo marginal baixíssimo** dos extras (1-2h cada display) porque a infraestrutura existe
2. **Entrega valor operacional imediato** pro E-Solares (status + visão de despesas que paga) sem esperar 3 sprints
3. **Não compromete os Sub-Sprints G/H/I** posteriores — eles ficam mais elegantes com a base lançada
4. **Decisão Luciano sobre fórmula PERCENTUAL ainda necessária** (cf. final desta seção), mas independente do caminho escolhido

### Sub-decisão pendente sobre fórmula PERCENTUAL (`calcularRepasse`)

Sem alteração desde o ponto de pausa anterior. Continuo aguardando você bater:
- **(a)** `kwh × tarifaRefKwh × pct/100` (config `USINA_TARIFA_REF_KWH` no `.env`, default R$ 0,80) — pragmatic
- **(b)** `kwh × tarifaConcessionariaReal × pct/100` (puxa da tabela `TarifaConcessionaria` por distribuidora)
- **(c)** Implementar só FIXO no MVP, PERCENTUAL/HIBRIDO retornam "pendente definição contratual" até decisão de produto

Achado do legado confirma a fórmula é `kwh × R$/kWh × %` — mas o valor R$/kWh é global no legado (`tbl_parametro_arrendamento.valor_kWh_padrao_aluguel`), e nosso schema **não tem esse campo** ainda.

**Sugestão técnica:** opção (b) usando `TarifaConcessionaria` (já temos por distribuidora) ou opção (a) com `USINA_TARIFA_REF_KWH` configurável. Banner UI no Portal Proprietário esclarece "valor previsto aproximado, acordo final por contrato bilateral".

## 10. Decisões de produto adicionais que emergiram

| # | Decisão | Opções |
|---|---|---|
| 11 | Cobrar nova categoria de despesa do Portal Proprietário? | (a) Sim — proprietário envia comprovante, admin valida / (b) Não no MVP — só leitura |
| 12 | Status operacional manual ou automático? | (a) Só automático (último UsinaLeitura.statusOnline) / (b) Automático + override manual admin (recomendado pra manutenção planejada) |
| 13 | Encriptar `sungrowSenha` na migração ou só nos novos cadastros? | (a) Migrar registros existentes (0 hoje conforme cron desativado, então custo zero) / (b) Só novos |
| 14 | Relatório PDF mensal — envio automático por email ou só baixar sob demanda? | (a) Cron envia automático dia 5 / (b) Só baixar no portal (ato voluntário do proprietário) / (c) Ambos |
| 15 | Matriz `responsabilidadeDespesas` por usina ou global cooperativa? | (a) Por usina (flexível, cada contrato é diferente) / (b) Global cooperativa (simples mas inflexível) — recomendo (a) |

## 11. Mapeamento legado SISGDSOLAR → novo (consolidado pros 2 temas)

| Legado | Conteúdo | Novo |
|---|---|---|
| `tbl_parametro_arrendamento` (global) | `valor_porcentagem_padrao_aluguel`, `valor_kWh_padrao_aluguel`, `porcentagem_seguranca_participacao_usina` | Parcial em `Usina.percentualGeracaoDono` + `valorAluguelFixo`. Faltam: R$/kWh padrão (cf. §9 fórmula PERCENTUAL) + segurança_participacao |
| `tbl_usina.status_usina Boolean` | true=ligada / false=desligada | **Não coberto**. Sugestão: novo `Usina.statusOperacional` enum |
| `tbl_usina.valor_porcentagem_padrao_aluguel` / `valor_kWh_padrao_aluguel` | Override por usina dos parâmetros globais | Coberto parcialmente por `Usina.percentualGeracaoDono` (sem R$/kWh override) |
| `tbl_token_isolar` (global) | appKey + accessKey global | `UsinaMonitoramentoConfig.sungrow*` POR usina (modelo melhor que o legado!) |
| `tbl_responsavel` (titular UC + responsável) | ManyToMany Tbl_usina | Não coberto — confirma YAGNI multi-usina por proprietário |
| `tbl_empresa_usina` (E-Solares completa) | razao_social, nome_fantasia, endereço, CNPJ, filiais | Denormalizado em 6 campos `Usina.proprietario*` (confirmação YAGNI da Fase 1 anterior) |
| `tbl_empresa_usina_contrato` | Contrato empresa × usina: ativo, data_inicio/fim/assinatura, percentual_cobranca | **Não coberto**. Catalogar `D-novo-AM` (Empresa entidade separada) ou criar `ContratoArrendamentoProprietario` em sprint próprio futuro |
| `tbl_despesa` / `tbl_centro_custo` | **NÃO EXISTE no legado** — despesas eram tratadas fora do sistema | `ContaAPagar` já cobre, faltando só enum expandido + responsavelPagamento |

## 12. Conclusões executivas

1. **A Fase 1 expandida revelou que o sistema novo está MAIS preparado que o legado** em vários eixos:
   - Estrutura monitoramento (UsinaMonitoramentoConfig POR usina) > tbl_token_isolar global
   - ContaAPagar com usinaId vinculado > legado sem entidade despesa
   - PdfGenerator + Puppeteer pronto > legado sem relatórios PDF
   - Multi-tenant + cooperativaId em tudo > legado single-tenant

2. **O que está faltando é "ligar os interruptores"** — funcionalidades já implementadas mas desativadas/subutilizadas. Custo de "ligar" é MUITO menor que "construir do zero" (Sprint 6 Ticket 11 desativou Sungrow cron "até implementar de verdade" — mas a estrutura JÁ ESTAVA PRONTA).

3. **Caminho B (MVP++) é o ponto ótimo de custo/benefício:** entrega valor visível pro E-Solares com pouca extra (1-2h cada display), sem comprometer Sub-Sprints futuros.

4. **Recomendação final atualizada:**
   - **Aprovar Caminho B (11-18h)** em 2-3 sessões
   - **Aprovar opção (b) ou (a) pra fórmula PERCENTUAL** + banner UI esclarece "valor previsto"
   - **Catalogar 4 débitos** futuros: G (despesas matriz completa), H (telemetria automática), I (relatório PDF), `ContratoArrendamentoProprietario` (formal pós-Assinafy)

5. **Trabalho Etapa A do MVP+ original (`fc2f048`) permanece útil** em qualquer caminho — `PROPRIETARIO` no enum + `ConviteProprietario` + script seed cooperebr1 são pré-requisitos universais.

---

**Fim Fase 1 expandida.** Aguardando OK Luciano nas 5 decisões adicionais (§10) + fórmula PERCENTUAL + escolha entre Caminhos A/B/C revisados.
