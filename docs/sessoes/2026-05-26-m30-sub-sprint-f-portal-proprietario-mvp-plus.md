# M30 — Sub-Sprint F MVP+ Caminho B (Portal Proprietário E-Solares)

> Sessão: 26-27/05/2026.
> Marco: **M30 — Sub-Sprint F MVP+ Caminho B (Sessão 1 de 2)** — backend completo + frontend portal + frontend UI admin + fix classeGd cooperebr1.
> Próxima sessão: **F.3 + F.4** (onboarding magic link + smoke produção com E-Solares).

## TL;DR

Sessão 1 inteira do Sub-Sprint F MVP+ Caminho B entregue em **9 commits incrementais** (`fc2f048` → `28ab789`) cobrindo Etapas A→I em ordem natural (Etapa I fix classeGd entrou no meio). Backend 100% funcional. Frontend portal proprietário com 6 páginas (Dashboard + lista usinas + drill-down detalhe com Recharts + repasses + despesas + contratos) + 1 tela UI admin (config proprietário com 3 blocos). Total **+26 specs novos verdes** (15 helper + 11 service); suíte completa 886/897 (11 pré-existentes em cooperados/usinas).

Pausa da Sessão 1 com **2 pontos não-críticos** pra Sessão 2: (i) onboarding magic link `ConviteProprietario` (schema já criado na Etapa A, falta service + email + tela aceitar-convite) + (ii) smoke E2E real com Luciano simulando E-Solares (depende preenchimento dos placeholders cooperebr1).

## Commits do dia (9)

| Hash | Mensagem |
|---|---|
| `fc2f048` | feat(schema): F.1 Etapa A — PROPRIETARIO no enum + ConviteProprietario + seed cooperebr1 idempotente |
| `730c3c4` | feat(usinas): F MVP+ Etapas B+C — schema + helper calcularRepasse + 15 specs |
| `1dab2c8` | fix(usina): F Etapa I — corrige classeGdAnotada cooperebr1 (GD_II -> GD_I) |
| `85d1554` | feat(proprietario): F Etapa D — módulo dedicado com 5 endpoints + 11 specs |
| `9346e11` | feat(monitoramento): F Etapa E — reativa cron Sungrow + encryption sungrowSenha + placeholder cooperebr1 |
| `6668166` | feat(proprietario): F Etapa F — RelatorioMensalService cron + endpoint PDF sob demanda |
| `f3de5cd` | feat(web): F Etapa G — Portal Proprietário MVP+ frontend completo |
| `28ab789` | feat(usinas-admin): F Etapa H — tela admin config proprietário + DTO/service expandidos |
| (este) | docs(sessao): fechamento M30 Sub-Sprint F MVP+ Sessão 1 |

## Entregas por etapa

### Etapa A — Schema migration + seed cooperebr1 (`fc2f048`)
- `ALTER TYPE PerfilUsuario ADD VALUE 'PROPRIETARIO'` — papel novo
- `CREATE TABLE convites_proprietario` (id, usinaId FK, token unique, email, expiresAt, usedAt, createdBy, createdAt) — pra magic link F.3
- Script idempotente `seed-cooperebr1-usina.ts` — Usina cooperebr1 já existia (id `usina-linhares`), reportou status sem duplicar. Descoberta: `classeGdAnotada=GD_II` divergente do confirmado pelo Luciano (GD_I pré-2023, 0% Fio B) — catalogou pra Etapa I.

### Etapas B+C — Schema + helper calcularRepasse (`730c3c4`)
- 2 enums novos: `StatusOperacional` (5 valores) + `ResponsavelPagamento` (3 valores)
- `CategoriaContaAPagar` expandida (4 → 16 valores): + CUSD, MANUTENCAO_PREVENTIVA/CORRETIVA, ROCADA, VIGILANCIA, SEGURO, IPTU_ITR, CONSUMO_AUXILIAR, INTERNET, ACOMPANHAMENTO_TECNICO, EQUIPAMENTOS
- Usina: +3 colunas (`valorKwhPadrao` Decimal, `responsabilidadeDespesas` Json, `statusOperacional` enum)
- ContaAPagar: +1 coluna (`responsavelPagamento` enum opcional)
- `TarifaConcessionaria` model JÁ EXISTIA (linha 825) — reuso direto, `tarifaKwh = TUSD + TE` (mesma lógica de `RelatoriosService.projecaoReceita`)
- **Helper `calcularRepasse(usina, geracao, tarifaResolver)`** puro com 15 specs:
  - FIXO: retorna `valorAluguelFixo` arredondado 2 casas
  - PERCENTUAL: `kwh × (valorKwhPadrao OU tarifaResolver) × pct/100` com `fonteTarifa: 'usina_override' | 'tarifa_concessionaria' | 'ausente'`
  - HIBRIDO: `valorAluguelFixo + componente PERCENTUAL`
  - Defesa em profundidade: retorna `{ valor: null, motivo }` quando faltam dados (formaPagamentoDono null, geração zero, percentual ausente, tarifa ausente)
- Arredondamento financeiro 2 casas (regra CLAUDE.md)
- **SUBSTITUI o R$ 0,50/kWh hardcoded** que estava em `UsinasService.proprietarioDashboard`

### Etapa I — Fix classeGd cooperebr1 (`1dab2c8`)
- Script idempotente `fix-classegd-cooperebr1.ts`: UPDATE Usina `cooperebr1` SET `classeGdAnotada='GD_I'` (era GD_II)
- Justificativa: decisão Luciano 25/05 (descoberta legado SISGDSOLAR) confirmou pré-07/jan/2023 = direito adquirido = 0% Fio B até 2045
- Aplicado: 1 row updated

### Etapa D — Backend endpoints proprietário (`85d1554`)
- **Módulo novo `backend/src/proprietario/`** dedicado (separado de `usinas/` pra clareza)
- `ProprietarioService` com 5 métodos públicos + 2 privados (`resolverUsinasDoProprietario`, `criarTarifaResolver`, `mascararCooperado`)
- **5 endpoints REST** `@Controller('proprietario')`:
  - `GET /proprietario/dashboard` — KPIs top + lista usinas + repasse calculado
  - `GET /proprietario/usinas/:id` — drill-down completo
  - `GET /proprietario/repasses` — histórico cronológico + filtros
  - `GET /proprietario/contratos` — contratos vinculados (cooperados anonimizados)
  - `GET /proprietario/despesas` — só responsavelPagamento ∈ [PROPRIETARIO, COMPARTILHADO]
- **Multi-tenant guard**: `usina WHERE proprietarioCooperadoId=user.cooperadoId OR proprietarioEmail=user.email`
- **LGPD Opção A**: cooperados como `Cooperado #001, #002, ...` (specs validam que IDs reais NÃO aparecem no JSON serializado)
- 11 specs novos verdes
- `PerfilUsuario.PROPRIETARIO` adicionado ao enum TS (`perfil.enum.ts`)

### Etapa E — Sungrow cron ativo + encryption (`9346e11`)
- **Reativa cron** `@Cron('*/30 * * * *')` desativado em Sprint 6 Ticket 11
- Guard `configs.length === 0 -> return cedo` evita poluir logs sem credenciais
- **Encryption `sungrowSenha`** via `CredentialsEncryptor` (M27) + `GATEWAY_ENCRYPT_KEY`:
  - `createConfig`: encripta antes de persistir
  - `updateConfig`: idem; ignora placeholder `'(senha definida)'`
  - `getConfig`: NUNCA retorna senha real (substitui por `'(senha definida)'`)
  - `verificarUsina`: decifrar antes de chamar `getUsinaStatus`; fallback gracioso pra texto puro legado com warning
- `MonitoramentoUsinasModule` importa `EncryptionModule`
- Script `seed-monitoramento-cooperebr1.ts` cria UsinaMonitoramentoConfig placeholder (`habilitado=false`, credenciais null — Luciano preenche quando E-Solares fornecer)

### Etapa F — Cron PDF + endpoint sob demanda (`6668166`)
- **`RelatorioMensalService`** dedicado:
  - `gerarSobDemanda(user, usinaId, mesAno)`: valida YYYY-MM + multi-tenant via `ProprietarioService.detalheUsina` + Puppeteer PDF
  - `@Cron('0 7 5 * *')` dia 5 às 7am — gera PDF do mês anterior pra cada usina com `proprietarioEmail` (envio email pendente F.4)
  - Template HTML inline (template literal): header amber, 4 KPIs (geração mês / repasse / despesas / líquido), tabela dados usina, cálculo do repasse (fórmula + fonteTarifa + detalhes), tabela despesas
  - `escapeHtml` defesa XSS básica
- **Endpoint `GET /proprietario/relatorios/:usinaId/:mesAno`** — retorna PDF inline (stream)
- `PdfGeneratorService` (motor-proposta) reusado como provider direto (stateless, sem ciclo)

### Etapa G — Frontend Portal completo (`f3de5cd`)
- **`/proprietario` Dashboard** refator com 5 KPIs grandes + grid cards usinas clicáveis (borda colorida verde/amarelo/vermelho conforme `visualStatus`)
- **NOVA `/proprietario/usinas/[id]` drill-down** com **Recharts BarChart 12 meses** + ReferenceLine vermelha (capacidade) + tabelas (repasses históricos, cooperados anonimizados, matriz responsabilidade read-only, contratos, alertas) + botões "Baixar PDF" por mês
- **`/proprietario/usinas` lista** refator (consome `/dashboard` — economiza request)
- **`/proprietario/repasses`** refator (totalYTD destaque + tabela cronológica + status badge + fonteTarifa)
- **`/proprietario/contratos`** refator (anonimizado #001, #002, ...)
- **NOVA `/proprietario/despesas`** — só PROPRIETARIO/COMPARTILHADO + 3 KPIs (total/pago/pendente)
- Layout sidebar com item "Despesas" novo
- Help inline azul em TODAS as telas (regra 19/05) + loading + empty states + mobile-responsive

### Etapa H — UI admin (`28ab789`)
- **NOVA `/dashboard/usinas/[id]/proprietario/page.tsx`**:
  - Status operacional (select 5 valores)
  - `valorKwhPadrao` input numérico (override fórmula PERCENTUAL/HIBRIDO)
  - Matriz responsabilidade (15 categorias × 4 opções) em grid 2 colunas
  - Botão Salvar + Cancelar + Help inline
- `UpdateUsinaDto` ganhou 3 campos novos (`statusOperacional`, `valorKwhPadrao`, `responsabilidadeDespesas`)
- `UsinasService.update` aceita os 3 campos novos + `classeGdAnotada` (que faltava antes)

## Validação

- `npm run build` ✅ EXIT:0 (todos os builds intermediários)
- `npx tsc --noEmit -p tsconfig.build.json` ✅ EXIT:0
- **Suíte completa: 886/897 passing** (mesmos 11 pré-existentes em cooperados/usinas, fora do escopo)
- **+26 specs novos verdes** vs M29 (era 860/871 → 886/897)
- **PM2 backend**: pid 29400 (último restart) online

## Constraints respeitadas

- ✅ TDD: specs primeiro pros endpoints novos (helper + service)
- ✅ Multi-tenant: `cooperativaId` + `proprietarioCooperadoId|Email` em **TODAS** queries Prisma
- ✅ LGPD Opção A: cooperados anonimizados `#001, #002, ...` em todo display proprietário (spec valida que IDs reais não aparecem no JSON)
- ✅ Encryption `sungrowSenha` via `CredentialsEncryptor` (reusa `GATEWAY_ENCRYPT_KEY` — sem nova chave)
- ✅ Help inline em todas as telas (regra 19/05)
- ✅ **R$ 0,50/kWh hardcoded REMOVIDO** — substituído pelo helper `calcularRepasse`
- ✅ Sem commit de `.env`, secrets ou valores reais de senhas em docs/commits
- ✅ Backup banco antes de cada migration (puramente aditivas — sem dry-run necessário)
- ✅ Sem `force push`, commits incrementais em português

## Decisões travadas durante a sessão

| Decisão | Resolução |
|---|---|
| Fórmula PERCENTUAL | HÍBRIDO: `kwh × (valorKwhPadrao OU TarifaConcessionaria.tusdNova+teNova) × pct/100` |
| Categorias despesa | Enum expandido pra 16 valores (12 novos + 4 originais) |
| Status operacional | Enum próprio (5 valores) separado de `statusHomologacao` (ciclo de vida) |
| PDF stack | Puppeteer existente em motor-proposta reusado como provider direto (sem refator) |
| Onboarding | Schema `ConviteProprietario` criado já — service + email pra F.3 Sessão 2 |
| `classeGd` cooperebr1 | Corrigido GD_II → GD_I via script idempotente |
| iSolar Cloud | Reusado `SungrowService` existente (endpoint `gateway.isolarcloud.com.hk/openapi`) — apenas reativou cron desativado em Sprint 6 |

## Próximo passo — Sessão 2 (F.3 + F.4)

**F.3 — Onboarding (~2-3h):**
- Service + 2 endpoints `POST /admin/convites-proprietario` (admin envia) + `POST /publico/convites-proprietario/aceitar` (proprietário aceita)
- Email template "Você foi convidado pra acompanhar a usina X"
- Tela `/proprietario/aceitar-convite/[token]` — define senha + ativa Usuario
- Tela admin `/dashboard/usinas/[id]/convidar-proprietario`
- Specs

**F.4 — Smoke produção (~1-2h):**
- Pré-requisito Luciano: preencher cooperebr1 via UI admin (proprietarioEmail E-Solares + formaPagamentoDono + valor)
- Luciano cria Usuario E-Solares via painel admin (ou via magic link F.3)
- Logar como E-Solares, navegar Dashboard, drill-down cooperebr1, ver dados consistentes
- Baixar PDF sob demanda + validar visualmente
- Verificar logs PM2 sem erro
- Conectar cron PDF a EmailService (decisão final anti-spam)
- Atualizar `inventario-secrets.md` mencionando `sungrowSenha` encrypted

## Frentes operacionais Luciano (acumulado)

- ⏳ Preencher cooperebr1 via UI admin: `proprietarioEmail`, `proprietarioCpfCnpj`, `formaPagamentoDono`, `valorAluguelFixo` ou `percentualGeracaoDono`, `dataInicioProducao`, `capacidadeKwh`, `cnpjUsina`, etc.
- ⏳ Obter credenciais Sungrow/iSolar Cloud com E-Solares (sungrowUsuario, sungrowSenha, sungrowAppKey, sungrowPlantId) — preencher via `/dashboard/usinas/[id]/monitoramento` quando UI estiver disponível
- ⏳ Definir matriz `responsabilidadeDespesas` via `/dashboard/usinas/[id]/proprietario`
- ⏳ Definir `valorKwhPadrao` ou cadastrar `TarifaConcessionaria` pra EDP_ES
- ✅ `GATEWAY_ENCRYPT_KEY` + `ASAAS_ENCRYPT_KEY` (sessões M28/M29)
- ⏳ Instalar gerenciador de senhas (D-novo-AK)
- ⏳ Avisar time legado (5 `.pfx` vazados + senha Azure SQL + webhook sem validação)
- ⏳ Obter `script.sql` do hb06a (Sub-Sprint B)
- ⏳ Obter `.pfx` sandbox Banestes
- ⏳ Decisões regulatórias Sub-Sprint A

## Carry-overs (não-bloqueantes)

- F.3 onboarding magic link (~2-3h) — schema pronto, falta service+UI
- F.4 smoke produção (~1-2h) — depende pré-requisito Luciano
- D-novo-AL (catalogar): integração iSolar Cloud automática END-TO-END (`SungrowService` pronto, falta dados reais cooperebr1)
- D-novo-AM (catalogar): `Empresa` entidade separada quando 2ª usina E-Solares (YAGNI)
- D-novo-AN (catalogar): `RepasseProprietario` tabela pra registrar pagamento REAL (não só previsto)
- D-novo-AO (catalogar): cron PDF conectar ao EmailService quando Luciano confirmar política anti-spam

## Regras aplicadas

- CLAUDE.md regra 6 segurança: backups pg_dump antes de migrations (puramente aditivas, sem dry-run)
- Decisão 23: validação prévia rigorosa antes de cada Etapa
- TDD: specs primeiro
- Multi-tenant: cooperativaId + proprietarioCooperadoId|Email em 100% queries
- Política `regra-secrets-nao-memorizar.md`: nenhum valor real em commits/docs
- Encryption sungrowSenha via CredentialsEncryptor (reusa chave master existente)
- Conventional commits em português, incrementais

## Frase comandante

Próxima sessão Code abre verificando se Luciano preencheu placeholders cooperebr1 (proprietarioEmail é o GATILHO PRINCIPAL — sem ele, magic link não tem destino). Se SIM, arranca F.3 (onboarding magic link) + F.4 (smoke produção E-Solares). Se NÃO, oferece frentes paralelas (Sub-Sprint A regulatório / Sub-Sprint B aguarda script.sql / D-novo-AK gerenciador senhas) ou pausa.
