# Fase 1 read-only — Onboarding cooperebr1 — Mapa de Prontidão

> 25/05/2026 — Próximo capítulo pós-Sprint Bot Autoatendimento (M24 fechado).
> Decisão 23 ativa. Investigação read-only ampla. Nada foi tocado no código/banco.

## Sumário executivo (5 linhas)

A usina cooperebr1 (`usina-linhares`) JÁ EXISTE no banco como entidade — capacidade 150 mil kWh/mês, EDP-ES, EM_PRODUCAO, classeGdAnotada GD_II, arrendada da ESOLARES — e tem **66 contratos ATIVOS** ocupando apenas **8,2% da capacidade**. Mas o tenant CoopereBR como um todo tem furos operacionais profundos pra entrar em produção real: **303 de 304 cooperados ATIVOS estão com `ambienteTeste=true`** (banco quase 100% sintético), **242 sem `AsaasCustomer`** (~80%), **233 sem nenhum contrato** (76% dos "ATIVOS" são fantasmas), **295 UCs com distribuidora=OUTRAS** (perda de migration 26/04 nunca recuperada), `BLOQUEIO_MODELOS_NAO_FIXO=true` ainda ativo (só FIXO funciona, COMPENSADOS/DINAMICO bloqueados), Asaas ainda em **SANDBOX** com `apiKey` PF Luciano (D-novo-A), Sprint 5 ANEEL nunca rodou (Fio B, classes GD, concentração não auditada), Assinafy zero integrado (Sprint 3 pendente). **Estimativa pra produção real plena: 4-6 semanas de Code dedicado + ações operacionais Luciano em paralelo.**

A boa notícia: nenhum desses gaps é estrutural — todos têm caminho conhecido. O risco maior é **regulatório/jurídico** (Fio B GD_II não calculado correto pode autuar cooperativa), não técnico.

---

## Frente 1 — Estado da CoopereBR como tenant operacional

### Configuração no banco (real, 25/05/2026)

| Campo | Valor |
|---|---|
| id | `cmn0ho8bx0000uox8wu96u6fd` |
| nome | "CoopereBR" |
| tipoParceiro | COOPERATIVA |
| statusSaas | ATIVO |
| cnpj | `00.000.000/0001-00` ⚠️ **placeholder/lixo** — não é CNPJ real |
| planoSaas | OURO |
| _count.cooperados | 313 (do total) |
| _count.usinas | 7 |
| _count.contratos | 80 |

**Outros tenants no banco:** "CoopereBR Teste" (TRIAL PRATA, 4 cooperados de teste) + "TESTE-FASE-B5 — Validação Engines" (Sprint 5a Engines, 6 cooperados sintéticos).

### Distribuição dos cooperados da CoopereBR por status

| Status | Quantidade |
|---|---|
| ATIVO | **304** |
| PENDENTE | 6 |
| ATIVO_RECEBENDO_CREDITOS | 1 |
| AGUARDANDO_CONCESSIONARIA | 1 |
| APROVADO | 1 |
| **Total** | **313** |

### Detalhamento dos 304 cooperados ATIVOS — PROBLEMA CENTRAL

| Aspecto | Quantidade | % do total | Status |
|---|---|---|---|
| **ambienteTeste=true** | **303 de 304** | **99,7%** | 🔴 **CRÍTICO: praticamente 100% do banco é dados sintéticos** |
| semTelefone | 3 | 1,0% | 🟢 OK |
| semEmail (string vazia) | 0 | 0,0% | 🟢 OK |
| sem `AsaasCustomer` | **242** | **79,6%** | 🔴 sem cobrança Asaas automatizada |
| **com UCs vinculadas** | 294 | 96,7% | 🟢 OK |
| sem UCs | 10 | 3,3% | 🟡 candidatos a SEM_UC ou cadastros incompletos |
| **com contrato ATIVO** | **71** | **23,4%** | 🔴 **76,6% dos "ATIVOS" não tem contrato** |
| sem contrato (qualquer) | 233 | 76,6% | 🔴 fantasmas — cadastros sem ativação real |

**Diagnóstico:** o banco real da CoopereBR é **quase 100% sintético**. O label `ATIVO=304` esconde a realidade: só **71 cooperados** têm contrato vinculado (~23% dos ATIVOS), e o flag `ambienteTeste=true` em 303 deles confirma que o banco foi construído pra testes do sistema, não pra operação.

**Pergunta crítica pra Luciano:**

> *"Quantos cooperados reais (não-teste) você espera ter no dia 1 da produção da cooperebr1? Os 71 com contrato ATIVO são reais ou também são teste? Tem uma lista externa do ‘universo real CoopereBR’ pra importar?"*

Sem essa resposta, qualquer estimativa de onboarding fica imprecisa.

### Status: **🔴 GAP CRÍTICO** — tenant ATIVO no banco, mas operação real ainda **não começou**. Banco é sintético.

---

## Frente 2 — Cadastro da usina cooperebr1

### Estado real

| Campo | Valor |
|---|---|
| id | `usina-linhares` |
| nome | "COOPERE BR - Usina Linhares" |
| **apelidoInterno** | **`cooperebr1`** 🟢 — confirma é a usina alvo |
| capacidadeKwh | **150.000 kWh/MÊS** 🟢 (convenção 17/05 já aplicada) |
| potenciaKwp | 1.250 kWp |
| producaoMensalKwh | 150.000 |
| distribuidora | EDP_ES 🟢 |
| statusHomologacao | EM_PRODUCAO 🟢 |
| **dataHomologacao** | **2024-06-01** ⚠️ **ATENÇÃO: classe GD II nominal mas regulatoriamente é GD III** |
| classeGdAnotada | **GD_II** ⚠️ INCONSISTENTE com dataHomologacao |
| formaPagamentoDono | **null** 🔴 (Mini-Bloco H'.9 17/05 — não preenchido) |
| formaAquisicao | ALUGUEL 🟢 |
| proprietarioNome | "ESOLARES" 🟢 (string solta) |
| proprietarioCooperadoId | null 🔴 — ESOLARES não está no banco como Cooperado |
| _count.contratos | 66 |
| Soma kwhContratoMensal | 12.259 kWh/mês 🟢 ocupação ~8,2% |

### Achados críticos

#### 1. INCONSISTÊNCIA DE CLASSE GD (CRÍTICO)

O briefing do prompt diz: *"cooperebr1 é pré-2023, NÃO paga Fio B — esse aspecto limpo"*. **MAS o banco diz `dataHomologacao=2024-06-01`** — isso é **2024**, depois do marco temporal Lei 14.300 (07/01/2023). Pelas regras catalogadas:
- **GD I** = usinas homologadas ANTES de 07/01/2023 → isento de Fio B
- **GD II** = entre 07/01/2023 e 06/01/2024 → Fio B progressivo (15% 2023 → 30% 2024 → 45% 2025 → **60% 2026** → 100% 2029)
- **GD III** = após 07/01/2024 → Fio B integral desde dia 1

`2024-06-01` cai em **GD III** (após 06/01/2024). Mas `classeGdAnotada=GD_II` no banco.

**Implicações alternativas:**
- Se a usina é REALMENTE GD III (homologada jun/2024): **Fio B integral hoje (~60-100%)** — risco de autuação financeira grave se cobrança ignorar.
- Se a usina é REALMENTE GD I (pré-2023): `dataHomologacao=2024-06-01` é dado errado, precisa ser corrigida + classeGd ajustada.
- Se a usina é GD II: data deveria estar entre 07/01/2023 e 06/01/2024.

**Pergunta CRÍTICA pra Luciano (regulatória):**
> *"A usina Linhares (cooperebr1) foi homologada pela EDP-ES em qual data exata? Tem documento original do protocolo ANEEL? A data 2024-06-01 no banco é real ou foi preenchimento de seed? E a `classeGdAnotada=GD_II` foi aprovada pelo dossiê judicial ou foi heurística?"*

#### 2. proprietarioCooperadoId = null (E-Solares fora do banco)

`proprietarioNome="ESOLARES"` é só uma string. Não há registro `Cooperado` com `usinaPropriaId` apontando pra essa usina. Isso significa:
- **Sprint 4 Portal Proprietário não opera** pra E-Solares.
- `ContratoUso` (3 modalidades) **não existe** — 0 registros no banco.
- `formaPagamentoDono=null` confirma.

#### 3. formaPagamentoDono null + valorAluguelFixo/percentualGeracaoDono não inspecionados

Mini-Bloco H'.9 (17/05) ampliou o schema com FIXO/PERCENTUAL/HIBRIDO mas `formaPagamentoDono` segue null. **Bloqueia repasse automático ao proprietário** quando a operação real começar (D-novo-D catalogado).

### Tela admin `/dashboard/usinas/nova` funcional?

Segundo `MAPA-INTEGRIDADE-SISTEMA.md` (linha 13) o Bloco H' 16/05 entregou schema expandido + UI condicional FIXO/PERCENTUAL/HIBRIDO. Cadastro funciona — mas pra cooperebr1 a usina **já existe**, então o relevante é editar.

### Status: **🔴 GAP CRÍTICO** (classe GD inconsistente — pode virar autuação real) + **🟡 GAP MENOR** (formaPagamentoDono null, E-Solares fora do banco)

---

## Frente 3 — Cooperados ligados à cooperebr1

### Estado real (apenas usina cooperebr1)

- **66 contratos ATIVOS** vinculados à usina-linhares
- Soma `kwhContratoMensal` = 12.259 kWh/mês
- Ocupação: **8,2% da capacidade** (12.259 / 150.000)
- Folga: ~137.741 kWh/mês livres

### Distribuição de contratos ATIVOS por usina (total tenant CoopereBR — 76 ATIVOS)

| Usina | Apelido | Contratos ATIVOS | Soma kWh/mês |
|---|---|---|---|
| `usina-linhares` | **cooperebr1** | **66** | **12.259** |
| `cmp8fkxvt0001valkj8utb8vr` | cooperebr2 | 2 | 11.275 |
| `cmn7qymjr001muoawblh5voyj` | (sem apelido) Palmeiras | 1 | null |
| `cmn7ru8uh0001uokcsk1kkukp` | Solar Guarapari | 4 | null |
| `cmn7ru93o0003uokc2z2pn5cp` | Solar Serra | 2 | null |
| (null) | — | 1 | null |

**🔴 Achado crítico:** **5 dos 76 contratos ATIVOS têm `kwhContratoMensal=null`** — Palmeiras + 4 Guarapari + 2 Serra + 1 sem usina. Soma dessas usinas zerada = **dados quebrados**. Cobrança não consegue calcular.

### Validações automáticas

| Validação | Estado |
|---|---|
| Capacidade da usina vs soma contratos | 🟢 implementado (`validarCapacidadeUsina` em `motor-proposta.service.ts` + `contratos.service.ts`) |
| Mesma distribuidora UC × Usina (`validarCompatibilidadeAneel`) | 🟢 implementado |
| Concentração ≤ 25% por cooperado-usina | 🔴 **D-30A não implementado** — Sprint 5 |
| Mesma classe GD na mesma usina | 🔴 **D-30B não implementado** — caso Exfishes provou |
| `percentualUsina` populado nos contratos ATIVOS | 8 sem / 68 com (10,5% sem) — D-31 reframed |
| `tarifaContratual` populado nos contratos ATIVOS | **71 sem / 5 com** — 93% dos contratos ATIVOS sem snapshot pós-desconto |

**🔴 Achado crítico:** D-30R foi marcado como "RESOLVIDO 03/05/2026" no Plano (Fase B), mas o banco mostra **71 dos 76 contratos ATIVOS sem `tarifaContratual` populado**. Resolução foi forward-only (novos contratos populam), o backfill dos legados **nunca rodou**. Isso significa: contrato COMPENSADOS gerado pra esses cooperados vai falhar/calcular errado (engine consome `tarifaContratual`).

### Multi-numeração de UC (Sprint 11)

| Aspecto | Valor |
|---|---|
| UCs totais (tenant CoopereBR) | 303 |
| Com `numeroUC` (legado EDP) | **65** (21,5%) |
| Sem `numeroUC` | **238** (78,5%) |
| Distribuidora EDP_ES | 8 (2,6%) |
| Distribuidora OUTRAS | **295** (97,4%) |

**🔴 Achado crítico:** 78,5% das UCs **sem `numeroUC` (legado)**. Sprint 11 Bloco 2 Fase D adicionou um guard de ativação que bloqueia mudança pra status ATIVO se UC não tem `numeroUC` — mas o guard é bypassado por `ambienteTeste=true` (303/304 cooperados). Em produção real, esse guard vai travar todo cooperado importado sem `numeroUC`.

**🔴 Achado ainda mais crítico:** **295 das 303 UCs com `distribuidora=OUTRAS`**. Em abril/26 a migration String → DistribuidoraEnum virou 96 UCs pra `OUTRAS` (incidente documentado no MAPA linha 146-167). Mas agora são 295 — a perda foi maior ou novas UCs foram criadas sem distribuidora preenchida. Pipeline OCR não vincula corretamente fatura → UC se distribuidora não bate, e queries por EDP_ES retornam dado incompleto.

### Status: **🔴 GAP CRÍTICO** (78,5% UCs sem `numeroUC` + 97,4% sem distribuidora + 93% contratos sem `tarifaContratual`)

---

## Frente 4 — Pipeline OCR + Faturamento (caminho crítico)

### Pipeline OCR em produção real

- **5 `FaturaProcessada`** no banco da CoopereBR (em mais de 1 ano de existência do sistema).
- 5 / 5 com `cobrancaGeradaId` preenchido (cobranças geradas após aprovação).
- E2E fatura Luciano (Sprint 11 Bloco 2 Fase D, 26/04): ✅ confirmado 5/5 PASS — mas só com **1 fatura real**.

**Conclusão:** o pipeline OCR funciona em isolamento (testado com fatura do Luciano), mas **nunca rodou em escala**. 5 faturas em ~1 ano é volume sintético/teste. Em produção real CoopereBR (centenas de UCs / mês), o pipeline será exercitado pela primeira vez.

### Geração automática de cobrança mensal

| Componente | Estado |
|---|---|
| `cronEnviarCobrancas` `@Cron('0 8 5 * *')` (dia 5 8h) | 🟡 EXISTE mas gated por `WA_COBRANCA_HABILITADO=true` (atualmente **false**) |
| `cronAbordarInadimplentes` `@Cron('0 9 * * *')` | 🟡 EXISTE mas gated `WA_INADIMPLENTES_HABILITADO=true` (atualmente **false**) |
| `gerarCobrancaPosFatura` (após aprovar FaturaProcessada) | 🟢 funciona — 5 FaturaProcessada do banco geraram cobrança |
| `BLOQUEIO_MODELOS_NAO_FIXO=true` | 🔴 **ainda ativo** — só FIXO_MENSAL funciona em prod |
| Specs E2E ("fatura Luciano") | 🟢 5/5 PASS (commit `4619bf9`, Sprint 11) |
| `cobrancasComModelo` (modeloCobrancaUsado preenchido) | **5 de 39** cobranças no banco (~13%) — confirma que `gerarCobrancaPosFatura` quase nunca rodou |
| `cobrancasSemModelo` | 34 (manuais/seed) |

### Cobranças no banco CoopereBR

| Status | Quantidade |
|---|---|
| A_VENCER | 1 |
| VENCIDO | 3 |
| PAGO | 35 |
| **Total** | **39** |

Banco majoritariamente PAGO — todas geradas via Caminho B (manual `/cobrancas/nova` validado em Sprint 12) ou seed antigo. **O sistema nunca emitiu cobrança em escala** automatizada.

### Asaas

| Componente | Estado |
|---|---|
| `AsaasConfig` CoopereBR | ambiente **SANDBOX**, `apiKey=836891eb6663...` (D-novo-A: nome PF Luciano, não PJ CoopereBR) |
| `AsaasCobranca` totais | 6 (com `linkPagamento`) |
| Webhook sandbox (Sprint 12) | ✅ validado |
| Webhook produção | 🔴 nunca rodou |
| `pix-excedente.service.ts` | 294 linhas implementadas, flag `ASAAS_PIX_EXCEDENTE_ATIVO` não confirmada no .env atual |

**🔴 Achado bloqueador:** Asaas ainda em SANDBOX. Para produção:
1. Luciano abre conta Asaas PJ CoopereBR (CNPJ — D-novo-A)
2. Reconfigurar `AsaasConfig` com novo `apiKey` PRODUCAO + `webhookToken`
3. Atualizar webhook URL no painel Asaas → cooperebr.com.br (não localhost)
4. Validação E2E com **1 cobrança PAGA real** (Fatia A canário, Plano Mestre 12/05)

### Pré-requisito: D-31 (percentualUsina)

Memory `project_sessao_11_05_maratona.md` cita D-31 como P1 crítico — `percentualUsina` zerado/irrealista no banco. Diagnóstico atual: **8 contratos ATIVOS sem percentualUsina** (10,5%). Reframed pra P2 em 12/05 (guard preventivo, não backfill).

### Status: **🔴 BLOQUEADOR** (Asaas em SANDBOX + `BLOQUEIO_MODELOS_NAO_FIXO` ativo + pipeline OCR nunca rodou em escala)

---

## Frente 5 — Lista concessionária / EDP-ES

### Módulo `migracoes-usina` (50 dias produção)

- **7 `MigracaoUsina`** no banco (manual)
- Cobrança histórica caso-a-caso, sem fluxo estruturado

### Spec Módulo Listas Concessionária (17/05) — fluxo 9 etapas

🟢 **IMPLEMENTADO COMPLETO** — Sub-Fase 1 fechada (M10+M12+M13 17-18/05):
- `EnvioListaConcessionaria` model com 9 estados RASCUNHO→HOMOLOGADO_TOTAL
- `EnvioListaCooperado` model com 3 estados (snapshot imutável)
- 11 endpoints `/envios-lista` multi-tenant + 5 DTOs
- Trigger ativação automática `PENDENTE_ATIVACAO → ATIVO + dataAtivacao=now()` dentro de `registrarHomologacao`
- Listener `cooperado-homologado.listener.ts` com 3 camadas defense in depth + template email
- 133 specs Jest cobertura 95-100%

### Estado dos envios no banco (CoopereBR)

| Status | Quantidade |
|---|---|
| HOMOLOGADO_TOTAL | 4 |
| CANCELADA | 1 |
| **EnvioListaCooperado total** | **5** |

**Cooperados em estado de homologação parcial/pendente:** zero pelo `EnvioListaCooperado` (não tem AGUARDANDO/ENVIADO/PROTOCOLO em curso hoje). Os 4 envios HOMOLOGADO_TOTAL completaram o ciclo.

### Pergunta operacional

> *"Em produção real cooperebr1, quantos cooperados ainda estão pendentes de homologação pela EDP-ES (status `AGUARDANDO_CONCESSIONARIA`)? O banco mostra apenas 1 cooperado em AGUARDANDO_CONCESSIONARIA — é refletivo da operação real?"*

### Status: **🟢 PRONTO** — módulo funcional, ciclo testado, 4 envios HOMOLOGADO_TOTAL em produção

---

## Frente 6 — Comunicação aos cooperados (bot WA pronto)

### Bot WhatsApp pós-Sprint Bot Autoatendimento (M24)

🟢 **SPRINT INTEIRAMENTE FECHADO** ontem (24/05). 8 blocos completos:
- 1.a — comandos universais INICIO/SAIR/MENU
- 1.b — ME CHAME DEPOIS + cron horário comercial
- 2 — 11 modelos novos
- 3 — Ver saldo + Ver fatura no motor
- 4 — Atualizar Cadastro
- 5 — Atualizar Contrato (com solicitação + aprovação humana)
- 6 — Cadastro Proxy (com mídia)
- 7 — NPS
- 8 — Menu Fatura + "Já paguei" (com confirmação humana)

234 specs verdes no motor. 22 ações novas. Padrões reusáveis estabelecidos.

### Cobertura de telefones na CoopereBR

| Aspecto | Valor |
|---|---|
| Cooperados ATIVOS com telefone | 301 de 304 (99,0%) |
| Sem telefone | 3 (1,0%) |
| `ConversaWhatsapp` no banco | **43** |

**🟡 Conclusão:** quase todos os ATIVOS têm telefone cadastrado (premissa pro bot funcionar), mas apenas **43 conversas WhatsApp registradas** — significa que ≤ 43 cooperados já interagiram com o bot ao menos uma vez. **A maioria não conhece o bot.**

### Plano de comunicação inicial pra produção real

🔴 **NÃO EXISTE** plano de "vocês agora estão na usina cooperebr1, esperem fatura em D dia X" — precisa ser desenhado.

**Recomendação:**
- Cron de boas-vindas pós-onboarding (template email + WA): "Bem-vindo à CoopereBR! Seu cooperado-id é X, sua usina alocada é cooperebr1, sua próxima fatura virá em DD/MM."
- Tutorial automático mencionando o email da EDP que precisa ser cadastrado (Gap 3 do Mapa de Integridade — Ciclo de Ativação).
- Lembrete D+30 sem fatura recebida (alerta admin "verificar homologação EDP").

### Status: **🟡 GAP MENOR** (bot pronto, mas plano de comunicação inicial pra produção precisa ser desenhado)

---

## Frente 7 — Contratos legais / documentos

### Assinafy / Módulo Documentos

🔴 **ZERO INTEGRAÇÃO ASSINAFY** — `grep -rln "assinafy" backend/src/` retorna **0 arquivos**. Sprint 3 nunca rodou.

### Estado atual da assinatura digital

- Schema `ModeloDocumento` aceita apenas `CONTRATO` ou `PROCURACAO` (limitação P0-03 do Mapa de Integridade)
- Página `/portal/assinar/[token]` existe e funciona com assinatura via "checkbox + IP + data"
- Token JWT 7 dias (validado no Bloco 6 do Sprint Bot Autoatendimento)
- **🔴 NÃO HÁ validade jurídica brasileira** (sem ICP-Brasil, sem Assinafy)
- 5 documentos do sistema (Termo Adesão / Procuração ANEEL / Termo Responsabilidade / Proposta / Contrato) — apenas 2 tipos suportados no schema

### Templates docs/templates-documentos/

🟢 **ESTRUTURA EXISTE** — 6 pastas (00-contratos-saas-instituicoes / 01-termos-adesao / 02-termos-responsabilidade / 03-procuracoes / 04-contratos-internos / 05-anexos-lgpd-privacidade / 06-institucional-parceiros).

🟡 **CNPJ + sede + representante legal em branco** (princípio multi-tenant 17/05 — preenchimento contextual a cada onboarding). Pra cooperebr1, é necessário:
- Preencher CNPJ real da CoopereBR (cooperativa registrada na Junta Comercial)
- Sede CoopereBR (endereço + município/UF)
- Representante legal (presidente da cooperativa)

Memória `principio_multi_tenant_templates_17_05.md` resolveu a divergência antiga CNPJ 49.950.705/0001-69 × 58.103.611/0001-45 — agora templates ficam em branco.

### Contrato arrendamento E-Solares × CoopereBR

🔴 **NÃO REFERENCIADO NO SISTEMA** — `proprietarioNome="ESOLARES"` é só string. Não há documento `ContratoUso` (3 modalidades, Sprint 4). Pra produção, alguém precisa:
1. Cadastrar E-Solares como `Cooperado` PJ + `usinaPropriaId=usina-linhares`
2. Criar `ContratoUso` com `valorFixoMensal` ou `percentualRepasse`
3. Cron mensal de geração de `LancamentoCaixa` pro repasse

### D-30H/I (RN 482/2012 defasada)

🔴 **D-30H ainda em curso**: Termo de adesão (`web/app/assinar/page.tsx:33,59`) cita RN 482/2012 — Sprint 3a deve atualizar pra Lei 14.300/2022. Bot CoopereAI prompt já parcialmente resolvido.

### Status: **🔴 GAP CRÍTICO** (Sprint 3 Assinafy não rodou + Sprint 4 Portal Proprietário não rodou + contrato E-Solares fora do sistema + D-30H ainda pendente)

---

## Frente 8 — Contabilidade / tributário

### Premissa cooperebr1 (do prompt)

> *"cooperebr1 é pré-2023, NÃO paga Fio B — esse aspecto limpo."*

**🔴 ATENÇÃO:** validar com Luciano. **Banco diz `dataHomologacao=2024-06-01`** (frente 2) — se preciso, cooperebr1 é GD III, paga Fio B integral, e a premissa do prompt está **errada**. Esse é o risco regulatório mais grave do mapa todo.

### Segregação receita (ato cooperativo Própria/Auxiliar/Não Cooperativa)

🔴 **NÃO EXISTE** — Sprint Contabilidade Tributária Segregada APROVADO 17/05 mas posição #8 do roadmap (após Bloco F Automação Concessionária — não rodou ainda). 61h Code estimadas.

### SCEE energia compensada — relatórios

| Componente | Estado |
|---|---|
| `Cobranca.kwhCompensado` snapshot | 🟢 existe |
| Relatório consolidado por cooperativa | 🟡 `relatorios/conferencia-kwh` existe (tela `/dashboard/relatorios/conferencia-kwh`) |
| DRE | 🔴 não existe — Sprint 7 (Fatia D2 Plano Mestre) |
| Conciliação bancária | 🔴 não existe — Sprint 7 (Fatia D1) |
| Fechamento mensal | 🔴 não existe — Sprint 7 |

### PIS/COFINS isenção ato cooperativo (STF Tema 536 + STJ Tema 986)

🔴 Não implementado. Sprint Contabilidade Tributária Segregada cobre. Benefício inicial APROVADO: APENAS `ENERGIA_SCEE`.

### Status: **🟡 GAP MENOR** (não bloqueia operação real curto prazo — pode entrar com débito + sprint dedicado) **MAS 🔴 SE classeGd cooperebr1 estiver errada** (Fio B não cobrado), risco financeiro grande.

---

## Tabela executiva — 8 frentes

| # | Frente | Status | Bloqueador prod? | Esforço fix |
|---|---|---|---|---|
| 1 | Tenant CoopereBR operacional | 🔴 GAP CRÍTICO | **Parcial** | Importar cooperados reais + saneamento dados sintéticos: 1-2 sem (com Luciano) |
| 2 | Usina cooperebr1 | 🔴 GAP CRÍTICO (classeGd) | **SIM se classeGd errada** | Confirmar `dataHomologacao` real + ajustar classeGd: 30min código + decisão regulatória |
| 3 | Cooperados ligados à cooperebr1 | 🔴 GAP CRÍTICO | **SIM** | Backfill `numeroUC` + `distribuidora` + `tarifaContratual` em legados: 1-2 sem |
| 4 | Pipeline OCR + faturamento | 🔴 BLOQUEADOR | **SIM** | Asaas produção + desligar BLOQUEIO_MODELOS_NAO_FIXO + canário 1 cooperado: Fatia A 2-4d (existente Plano Mestre) |
| 5 | Lista concessionária EDP-ES | 🟢 PRONTO | Não | — |
| 6 | Comunicação cooperados (bot) | 🟡 GAP MENOR | Não | Plano comunicação + cron boas-vindas: 1-2 dias |
| 7 | Contratos legais / Assinafy | 🔴 GAP CRÍTICO | **Parcial** (operação roda sem Assinafy mas com risco jurídico) | Sprint 3 Assinafy + Sprint 4 Portal Proprietário: 2-3 sem |
| 8 | Contabilidade / tributário | 🟡 GAP MENOR | **SIM se Fio B errado** (frente 2) | Sprint Contabilidade Tributária Segregada: 61h Code, posição #8 roadmap (depois) |

---

## Riscos críticos — Luciano precisa saber AGORA

### 🚨 RISCO 1 (regulatório catastrófico) — Classe GD cooperebr1 inconsistente

**Banco diz:** `dataHomologacao=2024-06-01` + `classeGdAnotada=GD_II`.
**Realidade regulatória:** se 2024-06-01 é a data REAL, cooperebr1 é **GD III** (pós-07/01/2024). Fio B INTEGRAL desde dia 1.
**Implicação financeira:** se a cooperativa não cobra Fio B integral (porque PRODUTO.md diz "cooperebr1 não paga Fio B"), está absorvendo prejuízo OU repassando a cooperados como tarifa errada — **autuação ANEEL/EDP possível**.
**Estimativa do impacto:** depende de quantos meses de produção × volume × tarifa Fio B. Caso Exfishes documentado teve R$ 310k/ano de prejuízo por mudança similar.

**Ação imediata Luciano:**
1. Confirmar `dataHomologacao` REAL do protocolo EDP-ES (Acessar a documentação física)
2. Confirmar classeGdAnotada — foi heurística ou apoiada por dossiê judicial?
3. Se cooperebr1 é REALMENTE GD II ou GD I, **ajustar dataHomologacao** no banco (com auditoria prévia conforme CLAUDE.md). Caso contrário, **implementar Fio B (Sprint 5a) antes de qualquer cobrança real**.

### 🚨 RISCO 2 (técnico bloqueador) — Engine COMPENSADOS bloqueada + tarifaContratual vazia

`BLOQUEIO_MODELOS_NAO_FIXO=true` ainda ativo + **71 dos 76 contratos ATIVOS sem `tarifaContratual`**. Plano Mestre Fatia A (canário 1 cooperado COMPENSADOS) **não pode rodar** sem backfill prévio (`Contrato.tarifaContratual` é input direto da engine COMPENSADOS).

**Ação Code (1-2 sessões):**
1. Script backfill `tarifaContratual` em contratos legados (forward-only resolveu novos, legados ficaram)
2. Validação E2E Fatia A canário (já planejado)
3. Desligar `BLOQUEIO_MODELOS_NAO_FIXO` após canário PAGA via webhook

### 🚨 RISCO 3 (técnico bloqueador) — Asaas SANDBOX + nome PF Luciano

`AsaasConfig.ambiente=SANDBOX` + apiKey PF Luciano (D-novo-A). Nenhum cooperado real consegue pagar via PIX/boleto real.

**Ação operacional Luciano (1-2 semanas calendário):**
1. Abrir conta Asaas PJ CoopereBR (CNPJ real cooperativa)
2. Configurar `AsaasConfig` da CoopereBR com `apiKey` produção + `webhookToken`
3. Atualizar webhook URL no painel Asaas (não localhost)

### 🚨 RISCO 4 (operacional) — Banco 99,7% sintético

303 de 304 cooperados ATIVOS com `ambienteTeste=true`. Cobranças automatizadas (cron `cronEnviarCobrancas`) e WA cobrança (cron `cronAbordarInadimplentes`) estão **gated por env** (`WA_COBRANCA_HABILITADO`/`WA_INADIMPLENTES_HABILITADO` ambos false) — proteção correta mas significa que **nada disso roda hoje em escala** com cooperados reais.

**Ação Luciano:**
1. Confirmar lista de cooperados REAIS (não-teste) — esperar 50? 100? 300? Sabe quantos?
2. Mapear: dos 71 com contrato ATIVO, quantos são reais? Lista importável?
3. Preparar dataset de migração — talvez precisa de Sprint dedicado pra importar massivamente de um sistema legado (planilha?)

### 🚨 RISCO 5 (regulatório) — D-30H ainda pendente (RN 482/2012)

Termo de adesão atual cita regulamentação revogada. Risco jurídico ativo. Sprint 3a (1-2 dias Code + revisão jurídica) deve rodar antes de QUALQUER cooperado real assinar Termo novo.

---

## Plano de ataque proposto — 6 sub-sprints / prompts em sequência

### Premissa do plano

Cooperebr1 entra em produção real em **fases**:
- **Fase 0 — Pré-onboarding** (1 semana, operacional Luciano): saneamento prévio + decisões regulatórias críticas
- **Fase 1 — Canário técnico** (1-2 semanas Code): 1 cooperado real COMPENSADOS via Asaas produção
- **Fase 2 — Expansão controlada** (2-3 semanas Code + operacional): 5-10 cooperados reais paralelos
- **Fase 3 — Produção plena** (4-6 semanas Code + operacional): 50+ cooperados reais

### Sub-Sprint A — Decisões regulatórias urgentes (Luciano + claude.ai, 1-2 dias)

**Esforço:** zero código. Pesquisa documental + decisão Luciano.

**Entregas:**
1. Confirmar `dataHomologacao` REAL da cooperebr1 (consultar EDP-ES, dossiê judicial, protocolo ANEEL)
2. Confirmar classeGd CORRETA (I / II / III) — aprovado por advogado regulatório se possível
3. Decisão: Sprint 5a (Fio B) rodar ANTES do canário OU pode pular se cooperebr1 é GD I?
4. Lista do "universo real CoopereBR" — quantos cooperados reais existem hoje, em qual sistema legado, formato de exportação?
5. Conta Asaas PJ produção — Luciano abre (1-2 semanas calendário pra aprovação Asaas)

**Critério "passou":** Luciano consegue responder as 5 perguntas com clareza.

### Sub-Sprint B — Saneamento prévio dados (Code, 1-2 semanas)

**Esforço:** 1-2 sessões Code dedicadas.

**Entregas:**
1. Auditoria prévia (Decisão 23 + CLAUDE.md migration safety): listar UCs sem `distribuidora` (295) + sem `numeroUC` (238) + contratos sem `tarifaContratual` (71) + contratos sem `kwhContratoMensal` (5) + cooperados sem `AsaasCustomer` (242). Relatório consolidado pra Luciano.
2. Script backfill `tarifaContratual` em contratos legados (calcular via plano + tarifa concessionária snapshot — D-30R forward-only continua, mas legados ganham backfill operacional)
3. Script backfill `distribuidora` para EDP-ES (heurística por endereço/estado já documentada no MAPA-INTEGRIDADE-SISTEMA.md)
4. Decisão Luciano por caso: o que fazer com os 233 cooperados "ATIVO sem contrato"? Encerrar? Migrar?
5. Saneamento `cnpj` da CoopereBR (hoje `00.000.000/0001-00` placeholder)

**Critério "passou":** Banco real reflete operação real. Cooperados que vão pra produção têm UC + Contrato + Asaas + dados regulatórios completos.

### Sub-Sprint C — Asaas produção + Fatia A canário (Code, 1-2 semanas)

**Esforço:** 1 sessão Code + validação operacional Luciano.

**Entregas:**
1. Configurar `AsaasConfig` CoopereBR com produção (D-novo-A resolve)
2. Validar webhook produção (subir URL real, registrar no painel Asaas)
3. Escolher 1 cooperado real CoopereBR (Luciano define — Marcio? Carolina?) — usar contatos teste se necessário (27981341348 + lucbragatto+suffix@gmail.com)
4. Fluxo E2E: cobrança gerada → enviada Asaas → cooperado paga PIX/boleto → webhook bate → `LancamentoCaixa` REALIZADO + cobrança PAGA
5. Smoke regression suite Jest (234/234 motor + cobranças + asaas)

**Critério "passou":** 1 cobrança real PAGA via Asaas produção com webhook chegando.

### Sub-Sprint D — Sprint 5a Fio B (DECISÃO: se necessário) (Code, 3-5 dias)

**Condicional** — só se Sub-Sprint A confirmar cooperebr1 é GD II ou GD III.

**Esforço:** 3-5 dias Code dedicado.

**Entregas:**
- Schema `Cobranca.fioB` populado em todas cobranças geradas pós-fix
- Fórmula aplica progressão correta por ano e classe GD
- Spec do OpenClaw 188 linhas portada (com adaptação à taxonomia GD I/II/III)
- Specs Jest cobrindo cenários 2026/2027/2028/2029
- 1 cooperado teste GD II/III com cobrança gerada e Fio B correto

**Critério "passou":** Cobrança cooperebr1 calcula Fio B integral correto.

### Sub-Sprint E — Sprint 3 Assinafy (Code, 2-3 semanas)

**Esforço:** 2-3 semanas Code + validação jurídica externa.

**Entregas:**
- Integração Assinafy completa
- 5 templates iniciais SISGD: Proposta + Termo de Adesão + Termo de Responsabilidade + Procuração ANEEL + Contrato
- Schema `ModeloDocumento` expandido (TERMO_ADESAO, TERMO_RESPONSABILIDADE, PROCURACAO_ANEEL adicionados)
- Atualizar termo + bot pra Lei 14.300/2022 (D-30H + D-30I)
- Cláusula alocação dinâmica no Termo (D-30J)

**Critério "passou":** novo cooperado assina os 5 documentos numa única jornada, recebe PDFs com validade jurídica via Assinafy.

### Sub-Sprint F — Onboarding plano de comunicação + Sprint 4 Portal Proprietário (Code, 2 semanas)

**Esforço:** 2 semanas Code distribuídas.

**Entregas:**
1. Cron de boas-vindas pós-onboarding cooperebr1 (template email + WA)
2. Tutorial automático "email EDP obrigatório" (Gap 3 do Mapa de Integridade)
3. Cadastrar E-Solares como `Cooperado` PJ + criar `ContratoUso` cooperebr1
4. Sprint 4 Portal Proprietário (`/proprietario`) com cálculo 3 modalidades + cron mensal de repasse + remover hardcode R$ 0,50/kWh
5. Notificação WA E-Solares no D+5 de cada mês

**Critério "passou":** E-Solares acessa `/proprietario` e vê repasse mensal calculado correto + recebe email confirmação.

---

## Estimativa total realista

| Fase | Esforço Code | Esforço Operacional | Duração calendário |
|---|---|---|---|
| Sub-Sprint A (decisões regulatórias) | 0 | Luciano + advogado | **1-2 semanas** |
| Sub-Sprint B (saneamento dados) | 8-12h | Luciano decide saneamentos | **1-2 semanas** |
| Sub-Sprint C (Asaas produção + canário) | 6-10h | Luciano abre conta (1-2 semanas) | **2-3 semanas** |
| Sub-Sprint D (Sprint 5a Fio B se necessário) | 3-5 dias | Validação advogado | **1 semana** |
| Sub-Sprint E (Assinafy) | 2-3 semanas | Validação jurídica | **3-4 semanas** |
| Sub-Sprint F (comunicação + portal proprietário) | 2 semanas | — | **2-3 semanas** |
| **TOTAL** | **5-7 semanas Code dedicado** | Paralelo | **8-12 semanas calendário** |

### Ordem crítica (cada um destrava o próximo)

```
Sub-Sprint A (regulatório) ──┐
                              ↓
              ┌─ Sub-Sprint B (saneamento dados) ──┐
              │                                    ↓
              └─→ Sub-Sprint D (Fio B SE GD II/III) ──┐
                                                       ↓
                                       Sub-Sprint C (canário Asaas produção)
                                                       ↓
                              ┌─ Sub-Sprint F (comunicação + portal) ─┐
                              │                                       ↓
                              └─→ Sub-Sprint E (Assinafy) ─→ PRODUÇÃO PLENA cooperebr1
```

**Marco final:** cooperebr1 em produção real plena (50+ cooperados reais + Asaas + Fio B correto + comunicação + Assinafy + Portal Proprietário) em **~8-12 semanas calendário**, dependendo de:
- Tempo Luciano abrir conta Asaas PJ (1-2 semanas Asaas demora aprovação)
- Disponibilidade advogado regulatório (1-2 semanas calendário)
- Quantos cooperados reais existem hoje pra importar

### Cenário otimista (cooperebr1 é GD I, sem Fio B)

- Sub-Sprint D pulado
- Sub-Sprint E pode ser adiado se Luciano aceitar risco jurídico temporário (debt D-30H + D-novo-AE catalogados)
- **5-7 semanas calendário** pra produção parcial (sem Assinafy)

### Cenário realista

- Sub-Sprint D necessário (cooperebr1 é GD II ou III)
- **8-10 semanas calendário** pra produção plena

### Cenário conservador

- Sprint 0 Auditoria Regulatória Emergencial precisa rodar (D-30A/B/E pendentes)
- Sprint 5 completo necessário (estrutura regulatória ANEEL completa)
- **12-16 semanas calendário** pra produção blindada

---

## Décimo-segundo achado — pergunta sobre escopo

Antes de implementar qualquer sub-sprint, **uma pergunta crítica pro Luciano:**

> **"Você quer cooperebr1 em produção REAL (cobrança automatizada + Asaas produção + Fio B correto + Assinafy + 50+ cooperados reais) ou produção INICIAL CONTROLADA (1 cooperado canário primeiro, expansão gradual)?"**

A diferença é grande:
- **Real plena:** Sub-Sprints A→F todos rodam. 8-12 semanas.
- **Controlada gradual:** Sub-Sprints A + B + C primeiro (canário). 4-6 semanas. E, F entram depois conforme aprende com os primeiros casos.

Recomendação inicial: **Controlada gradual.** O banco quase 100% sintético da CoopereBR e a inconsistência classeGd justificam começar pequeno, validar premissas regulatórias com 1 caso real, e escalar com confiança.

---

## Notas operacionais

- Backend online (pid 38736 → 37084 após Etapa F do M24), PM2 estável
- 234/234 specs verdes no motor (estado pós-M24)
- Frontend dev em `:3001` ativo
- Working tree limpo + push origin/main confirmado no fechamento M24 (`aa355f3`)
- 12 débitos catalogados Sprint Bot Autoatendimento (D-novo-U a AF) — pendentes Sprint Housekeeping pós-validação produção

## O que NÃO foi investigado nesta Fase 1 (escopo limitado)

- Caso CooperToken consolidado (Sprint CT — Fatia C Plano Mestre): não toquei, fora do escopo de produção operacional cooperebr1
- Iniciativa Fluxos Customizáveis (D-novo-T): visão longo prazo, irrelevante pra cooperebr1
- Sungrow monitoramento: cron desativado (Sprint 9+), irrelevante pra cooperebr1 inicial
- Compliance Fiscal SPED/NF3e: posição #12 do roadmap, irrelevante pra cooperebr1 inicial
- Convite indicação MLM E2E (D-30M): pendente validação E2E mas não bloqueia cooperebr1
- Login facial / Diagramas C4: fora do escopo

## Apêndice — Dados quantitativos consolidados

Distribuição completa dos cooperados ATIVOS (304 total):
```json
{
  "total": 304,
  "ambienteTeste_true": 303,
  "semTelefone": 3,
  "semEmail": 0,
  "semAsaasCustomer": 242,
  "comUCs": 294,
  "semUCs": 10,
  "comContratoAtivo": 71,
  "semContrato": 233
}
```

Distribuição contratos da CoopereBR (80 total):
```json
{
  "ATIVO": 76,
  "PENDENTE_ATIVACAO": 1,
  "ENCERRADO": 3,
  "ATIVOS_semPercentualUsina": 8,
  "ATIVOS_semTarifaContratual": 71,
  "ATIVOS_comTarifaContratual": 5
}
```

Distribuição UCs (303 total):
```json
{
  "total": 303,
  "comNumeroUC_legado": 65,
  "semNumeroUC_legado": 238,
  "distribuidora_EDP_ES": 8,
  "distribuidora_OUTRAS": 295
}
```

Cobranças (39 total CoopereBR):
```json
{
  "A_VENCER": 1,
  "VENCIDO": 3,
  "PAGO": 35,
  "comModeloCobrancaUsado": 5,
  "semModeloCobrancaUsado": 34
}
```

Usinas CoopereBR (7 total):
```
usina-linhares (cooperebr1): 150k kWh/mês EDP_ES GD_II EM_PRODUCAO 66 contratos ATIVO
cmp8fkxvt0001valkj8utb8vr (cooperebr2): 167k kWh/mês EDP_ES GD_II HOMOLOGADA 2 contratos ATIVO
Usina Solar Sul (sem apelido): 165k AGUARDANDO_HOMOLOGACAO 0 contratos
Usina Solar Norte: 150k HOMOLOGADA GD_II 1 contrato (proprietarioNome null)
Usina Solar Palmeiras: 100kWp EM_PRODUCAO 1 contrato
Usina Solar Guarapari: 37.5k EM_PRODUCAO "Energia Verde Ltda" 4 contratos
Usina Solar Serra: 27k EM_PRODUCAO "Solar Serrana SA" 2 contratos
```

Estado AsaasConfig CoopereBR:
```
ambiente: SANDBOX
apiKey: 836891eb6663... (D-novo-A: PF Luciano, não PJ)
webhookToken: existe
```

Env flags atuais:
```
WA_INADIMPLENTES_HABILITADO=false
WA_COBRANCA_HABILITADO=false
BLOQUEIO_MODELOS_NAO_FIXO=true
NODE_ENV=development
ASAAS_PIX_EXCEDENTE_ATIVO=(não inspecionado .env)
```
