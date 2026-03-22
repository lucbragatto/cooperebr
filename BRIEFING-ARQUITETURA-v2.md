# BRIEFING DE ARQUITETURA — cooperebr v2
*Gerado em 2026-03-20 com base nas decisões tomadas hoje*

## CONTEXTO DO SISTEMA
Plataforma SaaS para gestão de cooperativas de energia solar (Geração Distribuída - ANEEL).
Stack: NestJS + Prisma + PostgreSQL (Supabase) + Next.js

---

## DECISÕES DE NEGÓCIO TOMADAS HOJE

### 1. Ciclo de vida do cooperado
```
CADASTRADO → EM_ANALISE → APROVADO → ATIVO
```
- APROVADO = checklist completo, aguarda ativação do admin
- ATIVO = pode receber cobranças e créditos
- Status `PENDENTE` deve ser migrado para este novo fluxo

### 2. Ciclo de vida do contrato
```
PENDENTE_ATIVACAO → ATIVO → SUSPENSO → ENCERRADO
LISTA_ESPERA (sem usina disponível)
```
- Contrato nasce como PENDENTE_ATIVACAO (não ATIVO)
- Quando admin ativa o cooperado → todos contratos PENDENTE_ATIVACAO → ATIVO em cascata
- Cobrança SÓ gerada para contratos ATIVO

### 3. kWh do contrato — modelo ANUAL
- Base: histórico 12 meses da fatura (admin pode excluir meses discrepantes)
- `kwhContratoAnual` = total 12 meses (ex: 3.420 kWh)
- `kwhContratoMensal` = calculado (kwhContratoAnual / 12)
- Contrato é anual, renovado automaticamente
- Cancelamento: cooperado avisa com X dias de antecedência, paga durante o aviso

### 4. percentualUsina — pertence ao CONTRATO, não ao cooperado
- `Contrato.percentualUsina` = kwhContratoAnual / (usina.capacidadeKwhMensal * 12) * 100
- Soma dos % de todos os contratos ATIVOS + PENDENTE_ATIVACAO de uma usina ≤ 100%
- Validação com transação Prisma (evitar race condition)
- `Cooperado.percentualUsina` deve ser REMOVIDO (campo legado)

### 5. Regra geográfica ANEEL
- UC só pode ser vinculada a usina da MESMA distribuidora
- Ao criar contrato/proposta, filtrar usinas por `distribuidora.id` da UC
- Campo `Distribuidora` já existe — garantir que UC e Usina têm distribuidora cadastrada

### 6. Terminologia
| Hoje (confuso) | Correto |
|---|---|
| Aba "Fatura" | "Fatura Concessionária" |
| FaturaProcessada APROVADA | "Dados Conferidos" |
| Aba "Cobranças" | "Cobranças Cooperativa" |
| "Motor Proposta" | manter (técnico) |

---

## NOVA MODELAGEM — PLANOS DE COBRANÇA

### Problema atual
O modelo `Plano` atual é simples e não suporta:
- Múltiplos modelos de cálculo (fixo, compensado, dinâmico)
- Hierarquia de configuração (super admin → cooperativa → usina → contrato)
- Geração real variável mês a mês
- Saldo de créditos acumulado

### Novos modelos necessários

#### ModeloCobranca (gerenciado pelo Super Admin)
```prisma
model ModeloCobranca {
  id                      String   @id @default(cuid())
  nome                    String
  descricao               String?
  tipo                    TipoModelo  // FIXO_MEDIO | COMPENSADO_FIXO | COMPENSADO_DINAMICO
  baseCalculo             BaseCalculo // TOTAL | TE_TUSD_COM_ICMS | TE_TUSD_SEM_ICMS
  calculoDesconto         CalcDesconto // POR_FORA | POR_DENTRO
  descontoMinimo          Float
  descontoMaximo          Float
  permiteOverridePorUsina Boolean  @default(true)
  permiteRegraVolume      Boolean  @default(false)
  ativo                   Boolean  @default(true)
  createdAt               DateTime @default(now())
  updatedAt               DateTime @updatedAt
  configuracoes           ConfiguracaoCobranca[]
}
```

#### ConfiguracaoCobranca (por cooperativa ou usina)
```prisma
model ConfiguracaoCobranca {
  id                    String   @id @default(cuid())
  cooperativaId         String
  usinaId               String?  // null = regra geral da cooperativa
  modeloCobrancaId      String
  desconto              Float
  regraVolume           Json?    // faixas kWh → % desconto
  vigenciaInicio        DateTime
  vigenciaFim           DateTime?
  descontoPosVigencia   Float?
  ativo                 Boolean  @default(true)
  modelo                ModeloCobranca @relation(fields: [modeloCobrancaId], references: [id])
}
```

#### Campos novos no Contrato
```prisma
// Adicionar ao model Contrato:
kwhContratoAnual        Float?
kwhContratoMensal       Float?   // calculado
percentualUsina         Float?   // MOVIDO de Cooperado para cá
descontoOverride        Float?   // null = herda da usina/cooperativa
baseCalculoOverride     BaseCalculo? // null = herda do modelo
regrasAplicadas         Json?    // snapshot da regra no momento da cobrança
propostaId              String?  // FK para Proposta (rastreabilidade)
```

#### GeracaoMensal (novo — geração real da usina)
```prisma
model GeracaoMensal {
  id              String   @id @default(cuid())
  usinaId         String
  mesReferencia   DateTime // primeiro dia do mês
  kwhGerado       Float    // inserido pelo admin com a fatura da usina
  observacao      String?
  criadoEm        DateTime @default(now())
  usina           Usina    @relation(fields: [usinaId], references: [id])
  @@unique([usinaId, mesReferencia])
}
```

#### CobrancaMensal (reformular Cobranca existente)
```prisma
// Adicionar campos ao model Cobranca:
mesReferencia       DateTime?
kwhEntregue         Float?   // % cooperado * kwhGerado da usina
kwhConsumido        Float?   // lido da fatura do cooperado
kwhCompensado       Float?   // min(entregue, consumido + saldo anterior)
kwhSaldoAnterior    Float?   // saldo vindo do mês anterior
kwhSaldoFinal       Float?   // saldo que vai pro próximo mês
precoKwh            Float?   // calculado conforme plano
baseCalculoUsada    String?  // snapshot
modeloUsado         String?  // snapshot
```

---

## HIERARQUIA DE DESCONTO (cascata)

```
Ao calcular cobrança, buscar desconto nessa ordem:
1. Contrato.descontoOverride (não null?) → usa
2. ConfiguracaoCobranca onde usinaId = contrato.usinaId → usa
3. ConfiguracaoCobranca onde usinaId = null (geral da cooperativa) → usa
4. Nenhum → lançar erro "Cooperativa sem plano de cobrança configurado"
```

---

## O QUE JÁ FOI IMPLEMENTADO HOJE
- ✅ Status PENDENTE_ATIVACAO no enum StatusContrato
- ✅ Lista de cooperados reformulada (usina, contrato, checklist)
- ✅ Visão geral com card checklist + botão ativar
- ✅ Abas renomeadas (Fatura Concessionária, Cobranças Cooperativa)
- ✅ Aba proposta: histórico sempre visível, excluir proposta
- ✅ Segurança: JWT → .env, registro público bloqueado, ValidationPipe
- ✅ percentualUsina movido de Cooperado para Contrato (parcial — falta prisma db push)
- ✅ Validação de 100% de capacidade na usina

## PENDENTE — prisma generate + db push
⚠️ Precisa parar o servidor NestJS antes de rodar:
```bash
cd backend
npx prisma generate
npx prisma db push
```

---

## PRÓXIMOS PASSOS SUGERIDOS (em ordem)

### FASE 1 — Estabilização (fazer agora)
1. Rodar `prisma db push` com servidor parado
2. Corrigir race condition no percentualUsina (usar `prisma.$transaction`)
3. Corrigir BUG-07: associação proposta↔contrato por timestamp → usar `propostaId` FK
4. Corrigir BUG-08: percentualUsina sobrescrito em loop (já implementado, validar)
5. Corrigir fluxo FASE 1/FASE 2: cadastro separado de vinculação à usina
6. Filtro geográfico: usinas filtradas pela distribuidora da UC

### FASE 2 — Nova modelagem de planos (próxima semana)
1. Criar `ModeloCobranca` e `ConfiguracaoCobranca` no schema
2. Criar `GeracaoMensal` no schema
3. Reformular `Cobranca` com campos mensais
4. Adicionar campos ao `Contrato` (kwhContratoAnual, descontoOverride, etc)
5. Implementar lógica de cascata para busca do desconto
6. Tela de configuração de planos (super admin)
7. Tela de seleção de plano (admin cooperativa)

### FASE 3 — Features avançadas (futuro)
1. Dashboard do cooperado (saldo de créditos, histórico)
2. Relatório para concessionária (por usina, % por UC)
3. Renovação automática de contratos
4. Antecipação de recebíveis (exportação de dados)
5. Notificações automáticas (geração abaixo do previsto, saldo zerado)

---

## RELATÓRIOS DE QA DISPONÍVEIS
Todos em `C:\Users\Luciano\cooperebr\`:
- RELATORIO-QA-COOPERADOS.md (54 achados)
- RELATORIO-QA-CONTRATOS.md
- RELATORIO-QA-MOTOR-PROPOSTA.md
- RELATORIO-QA-FINANCEIRO.md
- RELATORIO-QA-INFRAESTRUTURA.md
- RELATORIO-QA-OPERACIONAL.md
- RELATORIO-QA-FRONTEND.md
- RELATORIO-QA-FINAL.md (consolidado)
- RELATORIO-QA-PERCENTUAL-USINA.md
