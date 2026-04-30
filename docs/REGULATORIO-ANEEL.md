# REGULATORIO-ANEEL — SISGD

> **Manual técnico-regulatório do SISGD.**
> Cobre Lei 14.300/2022, classes GD, Fio B, 5 flags configuráveis, política de alocação, engine de otimização e motor de diagnóstico pré-venda.
> Para visão de produto humana, ver [PRODUTO.md](./PRODUTO.md).
> Para visão técnica de schema/endpoints/módulos, ver [SISTEMA.md](./SISTEMA.md) (Fatia 3 do Doc-0, ainda stub).
> Para estado atual de execução, ver [CONTROLE-EXECUCAO.md](./CONTROLE-EXECUCAO.md).

**Última atualização:** 30/04/2026 — Doc-0 Fatia 2

---

## ⚠️ DISCLAIMER REGULATÓRIO

Este documento descreve o **entendimento atual do SISGD** sobre regulação ANEEL aplicável a Geração Distribuída (GD).

**Não substitui consultoria jurídica especializada.**

Premissas regulatórias críticas — especialmente **limite de 25% de concentração**, **transição GD II/III**, **mistura de classes**, **transferência de saldo entre UCs** e **cláusulas contratuais de alocação dinâmica** — devem ser validadas com:

1. **Advogado especializado em ANEEL** antes de ativação em produção real.
2. **Consulta direta à distribuidora local** de cada parceiro (regras locais variam — EDP-ES pode aceitar X que CEMIG não aceita).
3. **Análise de pareceres** da própria ANEEL e da distribuidora.

**Cada parceiro é responsável** por validar localmente com sua distribuidora antes de ativar funcionalidades regulatoriamente sensíveis (qualquer das 5 flags, política de alocação customizada, transferência de saldo, etc.).

O SISGD oferece **estrutura técnica e fluxos operacionais**; **não oferece parecer jurídico** sobre conformidade regulatória.

---

# PARTE I — Marco Regulatório

## Seção 1 — Lei 14.300/2022 e o marco temporal

**A Lei 14.300/2022** (Marco Legal da Microgeração e Minigeração Distribuída) consolidou e atualizou as regras de SCEE no Brasil. **Vigência: 07/01/2023.**

### Cutoffs principais

- **07/01/2023** — entrada em vigor da Lei 14.300. Usinas homologadas **antes** dessa data têm regime privilegiado (GD I).
- **07/01/2024** — fim do período de transição. Usinas homologadas **após** essa data caem no regime pleno da Lei 14.300 (GD III).
- **2029** — fim das faixas progressivas de Fio B. A partir de 2029, GD III paga 100% do Fio B.

### O que a lei regulamenta

- Sistema de Compensação de Energia Elétrica (SCEE) — créditos kWh injetados abatem consumo na próxima fatura.
- Limite de **5 MW por central geradora** (não por titular).
- **Validade de 60 meses** dos créditos kWh acumulados.
- **Empréstimo gratuito** dos créditos pra distribuidora durante o período (RN 1.000/2021, art. 655).
- Faixa progressiva de cobrança do Fio B (TUSD parcela uso de rede) por classes GD.

### Documentos ANEEL vigentes

- **RN 1.000/2021** — consolidação. Substitui RN 482/2012 e RN 687/2015.
- **RN 1.059/2023** — atualizações pós-Lei 14.300.

### Documentos ANEEL DEFASADOS

- **RN 482/2012** — substituída pela RN 1.000/2021. **NÃO deve ser citada em termos novos.**
- **RN 687/2015** — substituída pela RN 1.000/2021.

> **Risco regulatório ativo no SISGD hoje:** termo de adesão (`web/app/assinar/page.tsx:33,59`) e bot CoopereAI (`coopere-ai.service.ts:25`) ainda citam **RN 482/2012**. Débitos D-30H + D-30I. **Sprint 3** (Banco de Documentos) atualiza.

---

## Seção 2 — REN 1.000/2021 e procedimentos comerciais

A REN 1.000/2021 consolida os procedimentos comerciais de distribuidoras de energia elétrica.

### Pontos relevantes pro SISGD

- **Habilitação de UC para SCEE** — protocolo na distribuidora, prazo de análise, critérios de homologação.
- **Composição da fatura** — TUSD (Fio A + Fio B) + TE + ICMS + PIS/COFINS + CIP + bandeira tarifária.
- **Compensação progressiva** — créditos kWh recebidos são abatidos em ordem cronológica (FIFO confirmado em análise de 5 faturas EDP-ES).
- **Mínimo faturável** — UCs em SCEE pagam custo de disponibilidade mesmo quando consumo é totalmente compensado: 30 kWh (monofásico), 50 kWh (bifásico), 100 kWh (trifásico).
- **Empréstimo gratuito** — distribuidora não paga rendimentos sobre créditos kWh acumulados.

### Dados oficiais

- **Bandeira tarifária mensal** — publicada pela ANEEL em `dadosabertos.aneel.gov.br/dataset/.../bandeira-tarifaria-acionamento.csv`. SISGD consome via `BandeiraAneelService` (cron mensal `0 6 1 * *`). 🟢 Implementado.
- **Tarifas homologadas por distribuidora** — publicadas pela ANEEL via Resoluções Homologatórias (ex: REH 3.297/2024 para EDP-ES). SISGD armazena em `TarifaConcessionaria`.

---

## Seção 3 — Classes GD (I, II, III)

### Definição (decisão sessão claude.ai 30/04)

**Classe GD vem da DATA DE HOMOLOGAÇÃO da usina geradora**, não da UC consumidora.

| Classe | Data de homologação da usina | Regime de Fio B |
|---|---|---|
| **GD I** | Antes de **07/01/2023** | **Isento** do Fio B (regra antiga RN 482/2012). |
| **GD II** | Entre **07/01/2023 e 06/01/2024** | Regras transitórias (Fio B com faixas progressivas aceleradas). |
| **GD III** | A partir de **07/01/2024** | Regime pleno Lei 14.300 (Fio B em 60% em 2026, escala até 100% em 2029). |

### Princípio fundamental

**A UC herda a classe GD da usina à qual está vinculada.**

- Mudou de usina → mudou de classe → mudou o cálculo do Fio B → muda a fatura efetiva do cooperado.
- Caso Exfishes (Apêndice C de [PRODUTO.md](./PRODUTO.md)) provou: realocação Usina A (GD I) → Usina B (GD III) gerou salto de R$ 6.600 → R$ 32.486/mês.

### Tabela progressiva do Fio B (vigente 2023-2029)

| Ano | GD I | GD II | GD III |
|---|---|---|---|
| 2023 | Isento | 15% | — (não existia) |
| 2024 | Isento | 30% | 30% |
| 2025 | Isento | 45% | 45% |
| **2026** | **Isento** | **60%** | **60%** |
| 2027 | Isento | 75% | 75% |
| 2028 | Isento | 90% | 90% |
| 2029+ | Isento | 100% | 100% |

> **Insumo histórico:** spec do Assis (`docs/specs/PROPOSTA-GD1-GD2-FIOB-2026-03-26.md`, 26/03/2026) propunha taxonomia diferente (`GD1_ATE_75KW`/`GD1_ACIMA_75KW`/`GD2_COMPARTILHADO`). Decisão claude.ai 30/04 adota a taxonomia GD I/II/III por data de homologação. Trechos da spec do Assis (especialmente fórmulas) podem ser portados se compatíveis. Caso C de [PRODUTO.md](./PRODUTO.md).

### Implicações pra schema

- **Novo campo:** `Usina.classeGd` (enum `ClasseGd` com valores `GD_I`, `GD_II`, `GD_III`).
- **Novo campo:** `Usina.dataProtocoloDistribuidora` (DateTime — data de protocolo na distribuidora; pode diferir da homologação).
- **Novo campo:** `Uc.dataProtocoloDistribuidora` (DateTime — data em que UC foi protocolada para SCEE; insumo crítico pra Sprint 0 Auditoria).

---

## Seção 4 — Conceitos operacionais

### TUSD (Tarifa de Uso do Sistema de Distribuição)

A TUSD é composta por:
- **Fio A** — parcela relativa a transmissão e geração (FCC + outras).
- **Fio B** — parcela relativa ao **uso da rede de distribuição** (fios, transformadores).

**Em GD I**, o cooperado paga 0% do Fio B (isento).
**Em GD II/III**, paga proporcionalmente conforme tabela progressiva.

### TE (Tarifa de Energia)

Componente da fatura relativo à energia em si (sem uso de rede). Cobrada normalmente em todos os regimes.

### kWh compensado

Energia injetada pela usina geradora (GD) que abate consumo da UC consumidora no SCEE.

**Exemplo numérico (Luciano, mês 2026-03, EDP-ES):**
- `consumoAtualKwh` = 1.088 kWh (consumiu da rede)
- `creditosRecebidosKwh` = 1.832,7441 kWh (compensação aplicada)
- `valorCompensadoReais` = R$ 596,64 (já abatido na fatura)
- `totalAPagar` = R$ 184,46 (sobrou após compensação)
- `valorSemDesconto` = R$ 781,10 (referência sem GD)

> **Nota crítica:** `creditosRecebidosKwh > consumoAtualKwh` é possível porque cooperado tem **saldo acumulado** (Luciano tinha 5.442 kWh acumulados de meses anteriores). Isso afeta o cálculo do modelo COMPENSADOS — ver Seção 7.

### kWh injetado

Energia que a usina coloca na rede. Vira crédito kWh no saldo SCEE da UC.

### Saldo SCEE

Créditos kWh acumulados, **validade 60 meses** por ANEEL.

**Princípio decisão sessão 30/04:** **saldo é por par (UC, Usina, mês)**, não por cooperado. Se cooperado tem 2 UCs, cada UC tem saldo próprio. Se cooperado consome de 2 usinas (com flag `multipleUsinasPerUc`), cada par UC×Usina tem saldo independente.

**Saldo intransferível entre UCs** — flag `transferenciaSaldoEntreUcs` default `false`. Ativação caso a caso (raro — depende da distribuidora).

### Bandeira tarifária

Cobrança adicional sobre o kWh consumido, definida mensalmente pela ANEEL:
- **Verde** — sem cobrança adicional (R$ 0).
- **Amarela** — pequena cobrança.
- **Vermelha 1 / 2** — cobrança maior.
- **Escassez Hídrica** — emergencial.

SISGD sincroniza mensalmente via `BandeiraAneelService`. Atualmente está com `bandeira_tarifaria_acionamento` da ANEEL.

### Mínimo faturável (custo de disponibilidade)

UC em SCEE paga sempre, mesmo quando consumo é 100% compensado:
- **30 kWh** monofásico
- **50 kWh** bifásico
- **100 kWh** trifásico

SISGD configura via `ConfigTenant.minimo_*` por parceiro. Padrão = ANEEL.

---

## Seção 5 — Restrições regulatórias críticas

### Limite 5 MW por central geradora

Lei 14.300, art. 5º. Aplica-se à usina, não ao titular. Um proprietário pode ter várias usinas, cada uma de até 5 MW.

### Limite de concentração 25%

**Premissa SISGD baseada em práticas de mercado** — flag `concentracaoMaxPorCooperadoUsina` default `25`.

> ⚠️ **Validação local obrigatória.** ANEEL não estabelece limite explícito de concentração; é prática de mercado adotada por distribuidoras como referência de não-concentração de SCEE (evitar "GD individual disfarçada de compartilhada"). Cada parceiro deve confirmar com sua distribuidora local antes de ativar este limite ou ajustá-lo.

### Compatibilidade de distribuidora

UC e Usina **devem pertencer à mesma distribuidora local** (ANEEL não permite SCEE entre concessionárias diferentes).

🟢 Implementado em `validarCompatibilidadeAneel(ucId, usinaId)` em `usinas.service.ts:77`. Chamado em `cooperados.service.ts:495,1151` e `contratos.service.ts:178,180,304`.

### Compensação no SCEE

- Créditos abatem **na ordem cronológica** (FIFO confirmado em análise EDP-ES).
- ICMS **não é devolvido** na compensação (fica com a distribuidora).
- CIP (iluminação pública) **não é compensada** — cobrança fixa.

### Saldo intransferível entre UCs (default)

ANEEL: cada UC tem saldo próprio em SCEE. Transferência entre UCs do mesmo titular é **excepção** (varia por distribuidora).

Flag SISGD `transferenciaSaldoEntreUcs` default `false`.

---

# PARTE II — Modelo Conceitual SISGD

## Seção 6 — Princípios do produto

### 6.1 — Configurabilidade por parceiro

SISGD não impõe regras regulatórias **uniformes**. Cada parceiro configura suas regras locais (5 flags), respeitando os limites estabelecidos pela distribuidora local. Isso reflete a realidade operacional: a CoopereBR (EDP-ES) pode operar diferente de uma cooperativa em Minas (CEMIG).

### 6.2 — Audit trail obrigatório

**Toda mudança de flag regulatória gera registro em `AuditLog`** com `usuario`, `timestamp`, `flagAlterada`, `valorAntigo`, `valorNovo`, `motivo`.

Implicação técnica: model `AuditLog` já criado (Sprint 13a Dia 1, schema preparado). Interceptor + decorator vêm em **Sprint 5/6**.

### 6.3 — Simulação prévia obrigatória

**Antes de qualquer mudança que impacte custo do cooperado** (mudança de usina, mudança de classe GD, alteração de flag, etc.), sistema **mostra simulação prévia**: "ao executar esta ação, fatura projetada do cooperado X muda de R$ Y para R$ Z".

Implementação: Sprint 5 (validações no Motor.aceitar + alocarListaEspera + gerarCobrancaPosFatura). Sprint 8 (Engine de Otimização).

### 6.4 — Defaults conservadores

Todas as flags têm **default conservador** (mais restritivo). Parceiro precisa **explicitamente** ativar comportamentos não-padrão. Audit registra a mudança.

### 6.5 — Validação local com distribuidora

**SISGD não substitui** validação local com a distribuidora. Documentação da Seção 15 detalha o processo.

---

## Seção 7 — Modelagem de dados

### 7.1 — Atributos da Usina (novo schema)

```prisma
model Usina {
  id                          String       @id @default(cuid())
  // existentes:
  nome                        String
  potenciaKwp                 Decimal      @db.Decimal(10, 2)
  capacidade                  Decimal      // capacidade em kWh/mês
  distribuidora               DistribuidoraEnum
  cooperativaId               String
  // novos (Sprint 5):
  classeGd                    ClasseGd     // GD_I, GD_II, GD_III
  dataProtocoloDistribuidora  DateTime?    // quando protocolada na distribuidora
  dataHomologacao             DateTime?    // quando ANEEL liberou (já existe)
  // ...
}

enum ClasseGd {
  GD_I    // homologada antes de 07/01/2023
  GD_II   // homologada entre 07/01/2023 e 06/01/2024
  GD_III  // homologada a partir de 07/01/2024
}
```

### 7.2 — Atributos da UC (novo schema)

```prisma
model Uc {
  id                          String       @id @default(cuid())
  // existentes:
  numero                      String       // canônico SISGD (10 dígitos)
  numeroUC                    String?      // legado EDP (9 dígitos)
  numeroConcessionariaOriginal String?     // formato cru da fatura
  distribuidora               DistribuidoraEnum
  cooperadoId                 String
  // novos (Sprint 5):
  dataProtocoloDistribuidora  DateTime?    // quando UC protocolada para SCEE
  // ...
}
```

### 7.3 — Schema N:M Contrato↔Usina (controlado por flag)

Quando flag `multipleUsinasPerUc=true`, UC pode consumir de múltiplas usinas (split de créditos):

```prisma
// novo modelo (Sprint 5)
model UcUsinaRateio {
  id                String   @id @default(cuid())
  ucId              String
  uc                Uc       @relation(fields: [ucId], references: [id])
  usinaId           String
  usina             Usina    @relation(fields: [usinaId], references: [id])
  percentualRateio  Decimal  @db.Decimal(5, 2) // soma=100% por UC
  contratoId        String
  contrato          Contrato @relation(fields: [contratoId], references: [id])
  cooperativaId     String
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  @@unique([ucId, usinaId, contratoId])
  @@map("uc_usina_rateio")
}
```

**Validação:** `Σ percentualRateio` por `ucId` = 100%. Bloqueada na criação/edição se flag `multipleUsinasPerUc=false` para o parceiro.

### 7.4 — Cálculo de classe GD efetiva

```ts
// pseudo-código
function classeGdEfetiva(uc: Uc, contrato: Contrato): ClasseGd {
  // Se flag multipleUsinasPerUc=true, lookup nos rateios
  if (parceiro.flags.multipleUsinasPerUc) {
    const rateios = await getUcUsinaRateios(uc.id);
    const usinas = await getUsinas(rateios.map(r => r.usinaId));
    // Se todas as usinas têm mesma classe → essa classe
    const classes = unique(usinas.map(u => u.classeGd));
    if (classes.length === 1) return classes[0];
    // Mix de classes → MAIS RESTRITIVA prevalece (GD_III > GD_II > GD_I)
    if (classes.includes('GD_III')) return 'GD_III';
    if (classes.includes('GD_II')) return 'GD_II';
    return 'GD_I';
  }
  // Senão, lookup direto no contrato
  const usina = await getUsina(contrato.usinaId);
  return usina.classeGd;
}
```

**Princípio:** mistura de classes com `multipleClassesGdPerUc=true` adota **classe mais restritiva** (mais Fio B = mais conservador).

### 7.5 — Saldo por par (UC, Usina, mês)

Hoje SISGD não persiste saldo agregado. Diagnóstico de fatura real (commit `5ae9dfd`) confirmou:
- 0 cobranças com `kwhCompensado` preenchido em produção.
- Saldo só pode ser reconstruído somando snapshots `Cobranca.kwhCompensado` retroativos.

**Sprint 5 implementa:**

```prisma
model SaldoSCEE {
  id              String   @id @default(cuid())
  ucId            String
  uc              Uc       @relation(fields: [ucId], references: [id])
  usinaId         String
  usina           Usina    @relation(fields: [usinaId], references: [id])
  mesReferencia   String   // "2026-04"
  saldoInicialKwh Decimal  @db.Decimal(10, 2)
  saldoFinalKwh   Decimal  @db.Decimal(10, 2)
  validadeAte     DateTime // saldoInicialKwh + 60 meses
  cooperativaId   String
  createdAt       DateTime @default(now())
  @@unique([ucId, usinaId, mesReferencia])
  @@map("saldo_scee")
}
```

### 7.6 — Modelo de RegrasFioB

Tabela progressiva como dado estruturado (não código):

```prisma
model RegrasFioB {
  id            String   @id @default(cuid())
  ano           Int
  classeGd      ClasseGd
  percentualFioB Decimal @db.Decimal(5, 2)
  cooperativaId String?  // null = global SISGD; preenchido = override por parceiro
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  @@unique([ano, classeGd, cooperativaId])
  @@map("regras_fio_b")
}
```

Seed inicial (Sprint 5) com tabela 2022-2029 (Seção 3.4).

---

## Seção 8 — As 5 flags regulatórias

### 8.1 — `multipleUsinasPerUc`

- **O que controla:** permite uma UC consumir de **múltiplas usinas** simultaneamente (schema N:M Contrato↔Usina).
- **Default:** `false`.
- **Cenários de ativação:** UC de grande consumidor (acima de 100.000 kWh/mês) que excede capacidade de uma única usina; cooperado com múltiplas modalidades de plano.
- **Validação local:** confirmar com distribuidora se aceita "rateio de múltiplas geradoras" para uma mesma UC.
- **Audit trail:** mudança gera `AuditLog` com motivo obrigatório.
- **UI esperada:** toggle em `/parceiro/configuracoes/regulatorio`.
- **Riscos:** se ativado e distribuidora não aceitar → UC pode ter SCEE bloqueado pela distribuidora.

### 8.2 — `multipleClassesGdPerUc`

- **O que controla:** permite UC consumir de usinas de **classes GD diferentes** (mix de origens).
- **Default:** `false`.
- **Cenários de ativação:** parceiro tem usinas GD I e GD II e quer rotear consumo entre elas conforme disponibilidade.
- **Validação local:** confirmar com distribuidora se aceita mix de classes para uma mesma UC.
- **Audit trail:** sim.
- **UI esperada:** toggle (depende de `multipleUsinasPerUc=true`).
- **Riscos:** mix de classes pode confundir cálculo de Fio B; SISGD adota **classe mais restritiva** como conservadora.

### 8.3 — `concentracaoMaxPorCooperadoUsina`

- **O que controla:** limite máximo de % que **um cooperado** pode ocupar em uma usina.
- **Default:** `25` (25%).
- **Cenários de ativação:** sempre ativo (campo numérico, default 25).
- **Validação local:** confirmar com distribuidora se 25% é o limite local; alguns aceitam 30-40% em casos especiais.
- **Audit trail:** mudança do valor numérico gera `AuditLog`.
- **UI esperada:** campo numérico em `/parceiro/configuracoes/regulatorio`.
- **Riscos:** caso Exfishes (Apêndice C de PRODUTO.md) provou: 39,55% violava o limite e ninguém detectou. Ativação OBRIGATÓRIA.

### 8.4 — `misturaClassesMesmaUsina`

- **O que controla:** permite cooperados de **classes GD diferentes** na mesma usina (raro).
- **Default:** `false`.
- **Cenários de ativação:** caso especial — usina GD I com cooperados antigos misturada com novos cooperados GD III.
- **Validação local:** confirmar com distribuidora.
- **Audit trail:** sim.
- **UI esperada:** toggle.
- **Riscos:** complica cálculo de Fio B individualizado por cooperado.

### 8.5 — `transferenciaSaldoEntreUcs`

- **O que controla:** permite transferência de saldo SCEE **entre UCs do mesmo cooperado**.
- **Default:** `false` (saldo intransferível — regra ANEEL conservadora).
- **Cenários de ativação:** cooperado tem 2 UCs (residencial + comercial) e quer compartilhar saldo.
- **Validação local:** **obrigatória** — varia muito entre distribuidoras.
- **Audit trail:** sim.
- **UI esperada:** toggle.
- **Riscos:** ANEEL não tem regra clara; cada UC tem saldo próprio em SCEE. Transferência **excepcional**.

### Princípio fundamental

**Saldo é por par (UC, Usina, mês)**, não por cooperado. Todas as flags pressupõem isso.

---

## Seção 9 — Política de Alocação por Faixas

### 9.1 — Conceito

Hoje a alocação é manual — Marcos (admin) pega cooperado da `ListaEspera`, escolhe usina, atribui. Sem regra estruturada, casos como Exfishes acontecem.

**Sprint 8 implementa Política de Alocação por Faixas** — regras estruturadas que sugerem (ou bloqueiam) alocações fora do padrão.

### 9.2 — Padrão SISGD

```
Pequenos consumidores (até 500 kWh/mês)  → Usinas GD II (faixas progressivas Fio B)
Médios (500-2.000 kWh/mês)               → GD I ou GD II conforme disponibilidade
Grandes (acima de 2.000 kWh/mês)         → Usinas GD I (Fio B isento)
```

**Justificativa:** grandes consumidores se beneficiam mais do Fio B isento (GD I); pequenos sentem menos a diferença e podem ser alocados em GD II liberando GD I para quem precisa.

### 9.3 — Customização por parceiro

Cada parceiro pode definir faixas próprias:

```prisma
model PoliticaAlocacao {
  id                String   @id @default(cuid())
  parceiroId        String
  cooperativa       Cooperativa @relation(fields: [parceiroId], references: [id])
  faixaMin          Decimal  @db.Decimal(10, 2) // kWh/mês
  faixaMax          Decimal? @db.Decimal(10, 2) // null = sem limite superior
  classeGdPreferida ClasseGd
  ordem             Int      // ordem de avaliação (menor primeiro)
  ativa             Boolean  @default(true)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  @@map("politica_alocacao")
}
```

Seed inicial: 3 entradas para cada parceiro (Pequenos/Médios/Grandes) com defaults SISGD. Parceiro edita ou adiciona.

### 9.4 — Simulação prévia obrigatória

Antes de alocar, sistema **mostra preview**:
- Concentração resultante na usina alvo: X%.
- Classe GD do cooperado após alocação: GD_Y.
- Fatura projetada (estimada): R$ Z.
- Compatibilidade ANEEL: ✓/✗.

Se simulação viola política ou flag, sistema **bloqueia** com motivo claro.

### 9.5 — Migração controlada

Quando parceiro **muda** a política, cooperados existentes **NÃO migram automaticamente**. Engine de Otimização (Seção 10) sugere realocações em lote, admin aprova caso a caso.

---

## Seção 10 — Engine de Otimização com Split

### 10.1 — Algoritmo

Engine roda **periodicamente (mensal)** + **sob demanda** (trigger admin) e sugere realocações que minimizam custo total da operação respeitando **todas as restrições**:

1. Concentração ≤ flag `concentracaoMaxPorCooperadoUsina`.
2. Política de Alocação por Faixas em vigor (Seção 9).
3. Capacidade da usina (`Σ kwhContrato ≤ Usina.capacidade`).
4. Compatibilidade ANEEL (mesma distribuidora).
5. **Estabilidade mínima** — cooperado alocado < 3 meses **não migra** (anti-rebalanceamento agressivo).
6. Split (Seção 10.4) só ativo se `multipleUsinasPerUc=true`.

### 10.2 — Restrições matemáticas

Pode ser modelado como problema de programação linear:

```
Minimize: Σ custo(cooperado_i, usina_j) × x_ij

Sujeito a:
  Σ_j x_ij = 1 ∀i              (cada cooperado em alguma usina)
  Σ_i (kwh_i × x_ij) ≤ cap_j ∀j (capacidade da usina)
  x_ij ≤ flag.concentracaoMax ∀i,j (não excede limite)
  classe_GD compatível com política
  x_ij = 0 se distribuidora_i ≠ distribuidora_j
```

Para `multipleUsinasPerUc=true`, `x_ij` vira `0 ≤ x_ij ≤ 1` e `Σ_j x_ij = 1`.

Implementação prática: **heurística greedy + busca local** (mais simples que LP completo). Sprint 8 valida.

### 10.3 — Modos

#### Modo Sugestão (default)

Engine calcula realocações ótimas e **publica como sugestões em painel**. Admin do parceiro **aprova caso a caso**.

UI: `/parceiro/alocacao` lista sugestões com:
- Cooperado afetado.
- Usina origem → Usina destino.
- Motivo (concentração reduzida, faixa adequada, etc.).
- **Simulação prévia** (impacto na fatura).
- Botão "Aprovar" ou "Rejeitar".

#### Modo Automático com guard-rails

Engine **executa** realocações pequenas automaticamente. Grandes precisam aprovação.

**Guard-rails:**
- Limite mensal de N% de cooperados realocados (default 5%).
- Realocações que mudam classe GD precisam aprovação (sempre).
- Realocações que aumentam fatura projetada > X% precisam aprovação.

**Default OFF** — Luciano confirma quando ativar.

### 10.4 — Split (multipleUsinasPerUc)

Quando ativado, uma UC pode ser dividida entre múltiplas usinas. Útil para grandes consumidores que excedem capacidade de uma usina.

**Exemplo:** UC consome 50.000 kWh/mês. Usina A tem 30.000 kWh disponível, Usina B tem 25.000 kWh. Engine aloca:
- Usina A: 60% (30.000 kWh)
- Usina B: 40% (20.000 kWh)

`UcUsinaRateio` armazena. Cobrança mensal é calculada por par (UC, Usina) com Fio B individualizado por classe GD da usina.

### 10.5 — Estabilidade mínima

**Cooperado alocado < 3 meses NÃO migra automaticamente.** Evita "ping-pong" entre usinas.

Configurável por parceiro via `ConfigTenant.engine_estabilidade_min_meses` (default 3).

---

## Seção 11 — Motor de Diagnóstico Pré-Venda

### 11.1 — Funil

```
Lead acessa /diagnostico (rota nova)
  ↓
Captcha + cookie de sessão (anti-abuso)
  ↓
Upload fatura PDF/imagem ou cola dados manualmente
  ↓
Pipeline ingestão (reutiliza faturas.service.extrairOcr)
  ↓
Motor de análise (regras + LLM híbrido — Claude AI)
  ↓
Versão Express (grátis, <30s) OU Versão Completo (paga, R$ 199-499)
  ↓
Lead recebe relatório → opcionalmente vira lead qualificado
```

### 11.2 — Versão Express (grátis)

Análise resumida:
- **Distribuidora detectada** (do OCR).
- **Classe GD recomendada** (baseada em consumo + faixas SISGD).
- **Economia projetada** com plano FIXO_MENSAL (modelo mais simples) com desconto típico (15-20%).
- **Sugestão de usina compatível** (se há vaga).

**Performance:** <30 segundos. Roda em LLM cache + regras pré-computadas.

**Anti-abuso:** captcha (reCAPTCHA ou hCaptcha), rate limit 5 req/IP/dia, cookie de sessão.

### 11.3 — Versão Completo (paga)

**Sugestão de preço:** R$ 199-499 (validar com mercado).

Relatório aprofundado:
- Comparativo vs plano FIXO/COMPENSADOS/DINAMICO (3 cenários).
- Breakdown de Fio B por classe GD (GD I vs GD II vs GD III).
- Projeção 2026-2029 (Fio B progressivo).
- Recomendação personalizada de usina (considerando concentração, capacidade, distribuidora).
- Identificação de inconsistências na fatura (cobranças indevidas, mínimo faturável errado, etc.).

**Performance:** ~2 minutos (LLM mais profundo, lookup em base completa).

**Cobrança:** integração Asaas dedicada (sandbox primeiro, produção em Sprint 9).

### 11.4 — Anti-abuso

- **Captcha** em todas as submissões.
- **Rate limit** por IP: Express 5/dia, Completo 1/dia (paga).
- **Cookie de sessão** (mesmo dispositivo não faz 10 Express seguidos).
- **Validação de dados** — bloqueia inputs suspeitos (consumo > 1.000.000 kWh, valores negativos, etc.).

### 11.5 — Conflito de namespace (D-30K)

Endpoint atual `GET /faturas/diagnostico` é healthcheck técnico (verifica config_tenant, faturas, bucket Supabase, campos novos cooperado).

**Sprint 9 renomeia para `GET /faturas/healthcheck`** antes de criar rotas `/diagnostico/*` (frontend) e `/diagnostico/*` (backend).

### 11.6 — Vira gancho de vendas concreto

Diferencial: lead recebe **valor antes de virar cooperado**. Concorrência tradicional pede cadastro completo antes de mostrar economia. SISGD entrega análise gratuita em <30s.

Conversão esperada: Express → Completo > 5%, Completo → Cooperado > 30%.

---

# PARTE III — Implementação

## Seção 12 — Funcionalidades impactadas (tabela cruzada)

Como cada funcionalidade existente muda quando Sprint 5 + Sprint 8 + Sprint 9 entram:

| Funcionalidade existente | Como muda | Sprint |
|---|---|---|
| `validarCompatibilidadeAneel` (mesma distribuidora) | Estende para validar classe GD + concentração | 5 |
| `Motor.aceitar()` | Consulta flags do parceiro antes de criar contrato; valida concentração | 5 |
| `alocarListaEspera` | Idem aceitar() + simulação prévia obrigatória | 5 |
| `gerarCobrancaPosFatura` | Calcula Fio B ponderado por classe GD; consulta `RegrasFioB` | 5 |
| `MetricasSaasService` (painel SISGD) | Adiciona métricas regulatórias (concentrações, classes GD por parceiro) | 5 |
| `usinas.service.proprietarioDashboard` | Inclui classe GD da usina + Fio B vigente | 4 (Portal Proprietário) |
| `cobrancas.service` | Cálculo COMPENSADOS leva Fio B em conta | 2 + 5 |
| `ListaEspera` | Adiciona sugestões da Engine de Otimização | 8 |
| `/dashboard/usinas/listas` | Lista de compensação inclui classe GD + concentração atual | 5 |
| `/portal/ucs` modal "Nova UC" | Mostra classe GD recomendada para UC nova | 5 |
| Termo de Adesão | Atualiza referências regulatórias + cláusula alocação dinâmica | 3 |
| Bot CoopereAI system prompt | Atualiza regulação citada (Lei 14.300 / RN 1.000) | 3 |

---

## Seção 13 — Telas novas (Sprints 0/5/8/9)

| Tela | Sprint | Função |
|---|---|---|
| `/dashboard/super-admin/auditoria-regulatoria` | 0 | Dashboard temporário de auditoria — concentrações, saldos, mudanças de classe |
| `/parceiro/configuracoes/regulatorio` | 5 | Toggle das 5 flags + campo numérico do `concentracaoMax` + audit log |
| `/parceiro/configuracoes/politica-alocacao` | 8 | Definir faixas + classe GD preferida |
| `/parceiro/alocacao` | 8 | Painel da Engine de Otimização com sugestões + aprovação |
| `/parceiro/usinas/[id]/concentracao` | 5 | Histórico de concentração por usina (cooperados ocupando) |
| `/parceiro/membros/[id]/regulatorio` | 5 | Vista regulatória de um membro: classe GD efetiva, saldo SCEE, histórico |
| `/diagnostico` | 9 | Funil público — upload de fatura + Express grátis |
| `/diagnostico/express/[token]` | 9 | Resultado Express |
| `/diagnostico/completo` | 9 | Compra do Completo + pagamento Asaas |
| `/diagnostico/completo/[token]` | 9 | Resultado Completo |
| `/dashboard/super-admin/regulatorio` | 5 | Visão cross-tenant de todos os parceiros (concentrações suspeitas, etc.) |

---

## Seção 14 — Sprints e dependências

> Detalhamento completo em [PLANO-ATE-PRODUCAO.md](./PLANO-ATE-PRODUCAO.md). Aqui apenas escopo regulatório.

### Sprint 0 — Auditoria Regulatória Emergencial

- **Severidade:** P0 urgente.
- **Estimativa:** 1 semana.
- **Pode rodar quando:** AGORA (paralelo a Doc-0 fechar).
- **Bloqueia:** Sprint 5 depende dos achados.

**Escopo regulatório:**
- Listar UCs ativas com classe GD efetiva (cruzar `Uc.id → Contrato.usinaId → Usina.dataHomologacao`).
- Listar concentrações > 25% por cooperado-usina (ranking).
- Listar UCs com saldo > 2 meses (proxy: agregar `Cobranca.kwhCompensado` recente vs consumo médio).
- Listar UCs sem `dataProtocoloDistribuidora` (campo precisa ser criado **antes** da auditoria começar).
- Auditoria do snapshot do Motor.aceitar (`tarifaContratual` vazia em contratos COMPENSADOS).

**Entregas:**
- Relatório executivo (PDF + dashboard temporário em `/dashboard/super-admin/auditoria-regulatoria`).
- Plano corretivo caso a caso.

### Sprint 5 — Módulo Regulatório ANEEL

- **Severidade:** P0 estruturante.
- **Estimativa:** 3-4 semanas.
- **Pode rodar quando:** após Sprint 0.
- **Bloqueia:** Sprint 8.

**Escopo regulatório (completo):**
- Schema novo: `Usina.classeGd` + `Usina.dataProtocoloDistribuidora` + `Uc.dataProtocoloDistribuidora` + `RegrasFioB` + `ConfigRegulatoriaParceiro` + `UcUsinaRateio` + `SaldoSCEE`.
- Seed `RegrasFioB` 2022-2029.
- 5 flags com audit trail.
- Validações no Motor.aceitar + alocarListaEspera + gerarCobrancaPosFatura.
- Cálculo classe GD efetiva.
- Cálculo Fio B ponderado (mix de origens).
- Cron diário de auditoria de concentração (D-30F).
- UI `/parceiro/configuracoes/regulatorio`.
- Atualização de termos (Sprint 3 vai fazer parcial; Sprint 5 garante consistência regulatória).

### Sprint 8 — Política + Engine de Otimização

- **Severidade:** P1.
- **Estimativa:** 2-3 semanas.
- **Pode rodar quando:** após Sprint 5.
- **Bloqueia:** Sprint 9 (Motor de Diagnóstico depende de Engine pra projetar economia).

**Escopo regulatório:**
- Modelo `PoliticaAlocacao` (Seção 9.3).
- Política padrão SISGD (Seção 9.2) seedada + customização por parceiro.
- Modelo `AlocacaoOtima` (snapshot).
- Algoritmo de otimização com restrições (Seção 10.2).
- Modo Sugestão default + Automático com guard-rails.
- Suporte Split (Seção 10.4).
- Estabilidade mínima (Seção 10.5).
- Painel `/parceiro/alocacao`.

### Sprint 9 — Motor de Diagnóstico Pré-Venda

- **Severidade:** P1 estratégico.
- **Estimativa:** 3-4 semanas.
- **Pode rodar quando:** após Sprints 5 + 8.
- **Bloqueia:** —

**Escopo regulatório:**
- Funil público `/diagnostico` (Seção 11.1).
- Express grátis (Seção 11.2).
- Completo pago R$ 199-499 (Seção 11.3).
- Anti-abuso (Seção 11.4).
- Renomear `/faturas/diagnostico` → `/faturas/healthcheck` (D-30K).

---

# PARTE IV — Operação e Compliance

## Seção 15 — Processo de validação local com distribuidora

Quando parceiro quer ativar uma flag não-padrão (`multipleUsinasPerUc=true`, `multipleClassesGdPerUc=true`, ou ajustar `concentracaoMaxPorCooperadoUsina` acima de 25%):

### Passo 1 — Documentar a regra desejada

Parceiro escreve por escrito o que quer: "Quero permitir que cooperado X tenha 35% da Usina Y, atualmente em 32%, porque é grande consumidor industrial."

### Passo 2 — Consulta formal à distribuidora

Parceiro envia consulta formal à distribuidora local:
- Carta com a regra desejada.
- Justificativa técnica e comercial.
- Pergunta direta: **"A distribuidora aceita esta operação no SCEE?"**

### Passo 3 — Resposta da distribuidora

Resposta pode ser:
- **Aceita** — parceiro recebe parecer formal. Arquivar.
- **Aceita com restrições** — confirmar quais restrições e operacionalizar.
- **Não aceita** — não ativar a flag.

### Passo 4 — Ativar a flag no SISGD

Após resposta favorável:
- Admin do parceiro acessa `/parceiro/configuracoes/regulatorio`.
- Ativa a flag.
- Sistema **exige preencher motivo** (campo obrigatório no audit log).
- Motivo deve incluir referência ao parecer da distribuidora ("Conforme parecer Distribuidora X de DD/MM/AAAA").

### Passo 5 — Monitoramento contínuo

Sistema monitora cron diário (Sprint 5). Se distribuidora reverter posição (raríssimo mas pode acontecer), parceiro deve **desativar a flag** rapidamente.

### Recomendação adicional

**Consultar advogado especializado em ANEEL** antes de ativar qualquer flag não-padrão. SISGD oferece estrutura técnica; **não oferece parecer jurídico**.

---

## Seção 16 — Casos reais documentados

> Anonimização parcial: nomes ofuscados como Caso A/B/C. Números preservados pra valor instrutivo.

### Caso A — Cooperado de Grande Porte (Exfishes)

**Linha do tempo:**

- **Abril/2026** — cooperado ocupava **39,55% da Usina A (GD I)**. Limite ANEEL/distribuidoras como referência: **25%**. Sistema não bloqueou nem alertou.
- **Maio/2026** — alguém realizou **realocação cega** de Usina A (GD I) para Usina B (GD III). Sistema processou normalmente.
- **Resultado:** fatura saltou de **~R$ 6.600/mês** para **R$ 32.486/mês**. Mudança implícita de classe GD (isento → 60% Fio B em 2026) explica.
- **Prejuízo:** R$ 310.000/ano se a realocação não fosse revertida.

**Status atual** (30/04/2026): cooperado está com 0,05% na Usina B "queimando saldo". Plano: passar 100% pra Usina A. Saldo intransferível entre UCs (default `transferenciaSaldoEntreUcs=false`).

**Lições regulatórias:**

1. **Concentração não validada** permite > 25% — Sprint 0 lista, Sprint 5 valida automaticamente.
2. **Mudança de classe GD na realocação não detectada** — Sprint 5 cálculo de classe GD efetiva + Sprint 8 Engine bloqueia.
3. **Saldo grande parado** é sinal de alerta operacional — Sprint 5 monitora.
4. **Simulação prévia obrigatória** — Sprint 8 entrega.

### Caso B — Concentrações Suspeitas Atuais

Investigação em sessão claude.ai 30/04 confirmou outras concentrações fora do limite:

- **FIGATTA** (anonimizado): 35% na Usina GD II (55.000 kWh / 157.000 kWh).
- **CRIAR Centro de Saúde** (anonimizado): 16% na mesma Usina GD II (25.000 kWh).
- **Agregado FIGATTA + CRIAR**: 51% em apenas 2 cooperados.

**Implicação:** sintoma não é isolado. **Sprint 0** identifica todos os casos.

### Caso C — Spec Fio B do Assis (insumo histórico)

**Origem:** `docs/specs/PROPOSTA-GD1-GD2-FIOB-2026-03-26.md` (188 linhas, 26/03/2026).

**Conteúdo:** schema `tusdFioA`/`tusdFioB`/enum `ModalidadeGD` (`GD1_ATE_75KW`/`GD1_ACIMA_75KW`/`GD2_COMPARTILHADO`), tabela progressiva 2022-2029, refactor do motor de cobrança com fórmula:

```
tusdFioB = parcela Fio B da TUSD
fioB_cobrado = tusdFioB × (percentualFioB / 100)
tarifaEfetiva = tusdFioA + fioB_cobrado + TE
```

**Decisão sessão 30/04:** marcar como **insumo histórico** (D-30L). Arquitetura nova (Sprint 5) usa taxonomia diferente:

| Aspecto | Spec Assis (26/03) | Decisão claude.ai (30/04) |
|---|---|---|
| Taxonomia | 3 modalidades por potência+contexto | 3 classes GD por **data de homologação** |
| Modalidades/Classes | `GD1_ATE_75KW`, `GD1_ACIMA_75KW`, `GD2_COMPARTILHADO` | `GD_I` (antes 07/01/2023), `GD_II` (07/01/2023-06/01/2024), `GD_III` (≥07/01/2024) |
| Onde mora | enum em `TarifaConcessionaria` | enum em `Usina` |
| Cálculo de classe | depende de potência da usina | depende de data de homologação da usina |

**Aproveitar:** tabela de % Fio B 2022-2029 (Seção 3.4) e a fórmula `tarifaEfetiva = tusdFioA + (tusdFioB × pct) + TE` podem ser portadas se compatíveis com a nova taxonomia.

**Por que adotamos a nova taxonomia:**
- Mais alinhada com o entendimento jurídico atual da Lei 14.300/2022 (cutoffs temporais).
- Mais simples de explicar pra cooperado ("usina antiga = GD I = sem Fio B").
- Permite migração natural conforme regulamentação evolui.

---

## Seção 17 — Disclaimer e responsabilidades

### Limitações do SISGD

O SISGD oferece:
- Estrutura técnica para implementar regras regulatórias.
- Fluxos operacionais que automatizam validações.
- Audit trail das mudanças.
- Documentação das premissas adotadas.

O SISGD **não oferece**:
- Parecer jurídico sobre conformidade regulatória.
- Garantia de que a configuração escolhida pelo parceiro está em conformidade com a distribuidora local.
- Substituição da consulta formal a advogado especializado.

### Responsabilidades

**Luciano (dono SISGD):**
- Manter a estrutura técnica atualizada (tabela de Fio B, defaults SISGD, etc.).
- Documentar mudanças regulatórias relevantes em REGULATORIO-ANEEL.md.
- **NÃO aprovar configurações específicas de parceiros.**

**Admin do parceiro:**
- Validar localmente com sua distribuidora antes de ativar flags não-padrão.
- Manter audit log com motivos justificáveis.
- Consultar advogado especializado quando necessário.
- Comunicar membros sobre mudanças regulatórias que os afetem.

**Membro:**
- Ciente das condições contratuais (Termo de Adesão atualizado em Sprint 3).
- Validar que sua UC está em SCEE ativo na distribuidora.

### Termos atualizados (Sprint 3)

Termo de Adesão e Procuração ANEEL serão atualizados em **Sprint 3** para citar:
- Lei 14.300/2022 + RN 1.000/2021 (substituindo RN 482/2012 — D-30H, D-30I).
- Cláusula de **alocação dinâmica autorizada** (D-30J): "Cooperado autoriza Parceiro a realocar UC entre usinas geradoras vinculadas, respeitando regras da distribuidora local e Lei 14.300/2022. Mudanças que aumentem custo efetivo serão comunicadas com X dias de antecedência."

**Validação jurídica obrigatória** dos templates pelo advogado especializado em ANEEL antes de Sprint 3 ir pra produção.

---

## Seção 18 — Glossário regulatório

> Para glossário completo (regulatório + SISGD), ver [PRODUTO.md Apêndice D](./PRODUTO.md).

### Termos exclusivos deste documento

- **Classe GD I** — usina homologada antes de 07/01/2023. Isenta de Fio B.
- **Classe GD II** — usina homologada entre 07/01/2023 e 06/01/2024. Regras transitórias.
- **Classe GD III** — usina homologada a partir de 07/01/2024. Regime pleno Lei 14.300.
- **Fio A** — parcela da TUSD relativa a transmissão e geração.
- **Fio B** — parcela da TUSD relativa ao uso da rede de distribuição. **Crítico em GD.**
- **Tarifa efetiva** — `tusdFioA + (tusdFioB × percentualFioB) + TE`. Tarifa real paga pelo cooperado.
- **Saldo SCEE** — créditos kWh acumulados na UC. Validade 60 meses.
- **Empréstimo gratuito** — distribuidora não paga rendimentos sobre saldo SCEE.
- **Concentração** — % de uma usina que um único cooperado ocupa.
- **5 flags regulatórias** — `multipleUsinasPerUc`, `multipleClassesGdPerUc`, `concentracaoMaxPorCooperadoUsina`, `misturaClassesMesmaUsina`, `transferenciaSaldoEntreUcs`.
- **Engine de Otimização** — algoritmo que sugere realocações respeitando todas as restrições.
- **Política de Alocação por Faixas** — regra estruturada que define qual classe GD para qual faixa de consumo.
- **Modo Sugestão / Automático com guard-rails** — modos do Engine de Otimização.
- **Estabilidade mínima** — cooperado < 3 meses não migra automaticamente.
- **Split** — UC dividida entre múltiplas usinas (`multipleUsinasPerUc=true`).
- **Mistura de classes** — UC consumindo de usinas de classes GD diferentes (`multipleClassesGdPerUc=true`).

### Termos jurídicos relevantes

- **CTN** — Código Tributário Nacional.
- **STF** — Supremo Tribunal Federal. Vinculante por art. 927 CPC.
- **STJ** — Superior Tribunal de Justiça. Súmulas e Temas vinculantes.
- **Tema 986/STJ** — TUSD compõe base de ICMS em fornecimento tradicional. Ressalva expressa do relator Min. Herman Benjamin para inaplicabilidade ao SCEE/GD (empréstimo gratuito).
- **Lei 5.764/1971** — regime cooperativo, "ato cooperativo típico" (art. 79).
- **Tema 536/STF** — PIS/COFINS não incide sobre atos cooperativos típicos.

> Para detalhamento de jurisprudência e teses jurídicas relevantes, ver `docs/historico/recebidos-2026-04-28-claude-ai/CONTEXTO-JURIDICO.md` (323 linhas — briefing jurídico do Luciano).

---

*Manual técnico-regulatório vivo. Atualizar quando ANEEL publicar resoluções relevantes (RN, REH) ou quando descobertas operacionais (auditoria, casos reais) exigirem revisão.*

*Última atualização: 30/04/2026 — Doc-0 Fatia 2.*
