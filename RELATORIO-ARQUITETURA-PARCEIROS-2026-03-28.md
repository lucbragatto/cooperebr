# Relatório de Arquitetura — Modelo de Parceiros CoopereBR
**Data:** 2026-03-28 | **Autor:** Assis

---

## 1. Visão do negócio (como Luciano definiu)

Um **Parceiro** pode ser:
- Cooperativa
- Condomínio
- Associação
- Consórcio

Cada parceiro:
- Tem **seus próprios membros** (cooperados, condôminos, associados, consorciados)
- Pode ter **uma ou mais UCs próprias** → o parceiro em si também pode ser beneficiário de energia
- Pode estar vinculado a **uma ou mais usinas** (não exclusividade)
- Cada membro também pode ter suas próprias UCs

A usina é um recurso **compartilhado**:
- Uma usina pode atender múltiplos parceiros simultaneamente
- Cada parceiro (e cada membro) tem um percentual daquela usina via contrato
- Exemplo: Usina Y → 30% para Cooperativa X + 70% para Condomínio J

Planos de cobrança:
- Definidos pelo Super Admin (modelos globais) ou pelo Admin do parceiro
- Aplicáveis a: parceiro como entidade, membro individual, usina
- Hierarquia de desconto: contrato individual → usina → cooperativa → erro

A Administradora:
- É uma entidade que **gerencia múltiplos condomínios**
- Também pode ser tratada como um tipo de parceiro (PJ com perfil administrador)

---

## 2. O que já existe no banco (análise do schema atual)

### ✅ O que está correto e pode ser aproveitado

| Elemento | Situação |
|---|---|
| `Cooperativa` com `tipoParceiro` | ✅ Já modela os 4 tipos (COOPERATIVA, CONSORCIO, ASSOCIACAO, CONDOMINIO) |
| `Cooperado` com `cooperativaId` | ✅ Membros já se vinculam ao parceiro |
| `Contrato` com `percentualUsina` | ✅ Multi-usina por membro já funciona (cada contrato = 1 usina) |
| `ConfiguracaoCobranca` por cooperativa e usina | ✅ Hierarquia de planos já modelada |
| `Administradora` ligada a `Cooperativa` | ✅ Existe, funcional |
| `Plano` com `ModeloCobranca` | ✅ Modelos FIXO_MENSAL, CREDITOS_COMPENSADOS, CREDITOS_DINAMICO |
| `GeracaoMensal` por usina | ✅ Geração real registrável por mês |

---

### ❌ O que está faltando ou errado

#### Problema 1 — Usina vinculada a UMA cooperativa só
```prisma
model Usina {
  cooperativaId  String?
  cooperativa    Cooperativa?  @relation("CooperativaUsinas", ...)
}
```
**Hoje:** cada usina tem um único `cooperativaId`. Isso implica que a usina "pertence" a um parceiro só.

**O que precisa:** a usina é independente (pertence à CoopereBR/operadora). Parceiros se conectam a ela via contratos, não via ownership. O campo `cooperativaId` na usina deveria ser o ID da operadora (CoopereBR), não do parceiro.

**Impacto:** o filtro no wizard `!u.cooperativaId` quebra tudo — todas as usinas já têm cooperativaId da CoopereBR e somem da lista.

---

#### Problema 2 — Parceiro não tem UCs próprias
```prisma
model Uc {
  cooperadoId  String  // FK obrigatória para Cooperado
}
```
**Hoje:** UC pertence apenas a um `Cooperado` (pessoa física/jurídica membro). O parceiro como entidade não pode ter UC própria.

**O que precisa:** UC deve poder pertencer também a um parceiro diretamente. Ou o parceiro precisa de um `Cooperado` representante (CNPJ) para ter UCs vinculadas — solução mais simples, já que `Cooperado` aceita PJ.

---

#### Problema 3 — Membro em múltiplas usinas = múltiplos contratos (OK), mas sem visão consolidada
Um membro pode ter N contratos com N usinas diferentes. O modelo suporta isso. Porém não existe endpoint ou tela que mostre: "membro X recebe energia de usinas A, B e C, com percentuais X%, Y%, Z%".

---

#### Problema 4 — Entidade `Condominio` paralela e redundante
```prisma
model Condominio {
  cooperativaId  String?
  administradoraId  String?
  modeloRateio  String
  aliquotaIR  Float?
  ...
  unidades  UnidadeCondominio[]
}
```
Existe uma tabela `condominios` **separada** de `cooperativas`. Um parceiro do tipo CONDOMINIO tem duas representações: uma em `cooperativas` (para planos, cobranças, SaaS) e outra em `condominios` (para rateio, impostos, unidades). Isso é duplicidade — o mesmo condomínio pode existir nas duas tabelas sem ligação direta.

**O que precisa:** os campos específicos de condomínio devem ser extensão de `Cooperativa`, não tabela separada.

---

#### Problema 5 — Planos por usina sem vínculo explícito com múltiplos parceiros
`ConfiguracaoCobranca` tem `cooperativaId` e `usinaId?`. Isso permite definir um plano específico para a combinação cooperativa+usina. Mas não há como definir um plano para "todos os membros desse parceiro nessa usina" de forma distinta do plano geral.

---

## 3. Modelo alvo (o que precisa chegar)

```
Usina (recurso independente, da CoopereBR)
  └── vinculada a múltiplos parceiros via Contrato.percentualUsina

Parceiro (= Cooperativa, tipoParceiro define o subtipo)
  ├── tipoParceiro: COOPERATIVA | CONDOMINIO | ASSOCIACAO | CONSORCIO
  ├── UCs próprias → via Cooperado representante PJ (CNPJ do parceiro)
  ├── membros → Cooperado[] com cooperativaId = parceiro.id
  │     ├── cada membro tem suas UCs (Uc.cooperadoId)
  │     └── cada membro tem contratos com usinas (Contrato → Usina)
  ├── plano de cobrança → ConfiguracaoCobranca (herdado pelos membros)
  └── campos extras por tipo:
        CONDOMINIO: modeloRateio, aliquotaIR, aliquotaPIS, aliquotaCOFINS, sindicoNome
        (atualmente em tabela separada — precisa unificar)

Administradora
  └── gerencia N parceiros do tipo CONDOMINIO
  └── pode ser tratada como Cooperativa com tipoParceiro = 'ADMINISTRADORA' (novo tipo)
```

---

## 4. Gaps de schema a corrigir

### Gap 1 — Usina: separar "operadora" de "parceiro consumidor"
**Solução A (simples):** adicionar campo `operadoraId String?` na Usina para a CoopereBR, mantendo `cooperativaId` como campo legado sem uso obrigatório.

**Solução B (correta):** remover `cooperativaId` da Usina. A relação usina↔parceiro é sempre via `Contrato`. Usina tem apenas `operadoraId` (quem arrendou/opera).

Recomendo: **Solução B** a médio prazo, **Solução A** como patch imediato para não quebrar nada.

### Gap 2 — Parceiro com UC própria
**Solução:** criar um `Cooperado` representante automático quando `tipoParceiro != COOPERATIVA` (ou em qualquer tipo), com `cpf/cnpj = cnpj do parceiro`, `tipoPessoa = PJ`. UCs desse cooperado são as "UCs do parceiro".

Alternativa futura: adicionar `cooperativaId String?` em `Uc` para vínculo direto.

### Gap 3 — Condomínio unificado com Cooperativa
**Solução:** adicionar os campos específicos de condomínio diretamente em `Cooperativa`:
```prisma
// Campos a adicionar em Cooperativa (nullable, usados só quando tipoParceiro = CONDOMINIO):
sindicoNome           String?
sindicoCpf            String?
sindicoEmail          String?
sindicoTelefone       String?
modeloRateio          String?   // PROPORCIONAL_CONSUMO | FRACAO_IDEAL | PERCENTUAL_FIXO
excedentePolitica     String?   // CREDITO_PROXIMO_MES | PIX_DIRETO
aliquotaIR            Float?
aliquotaPIS           Float?
aliquotaCOFINS        Float?
taxaAdministrativa    Float?
administradoraId      String?   // FK para Administradora
```
E `UnidadeCondominio.condominioId` passa a referenciar `cooperativaId`.

### Gap 4 — Novo tipo ADMINISTRADORA
Adicionar `'ADMINISTRADORA'` ao campo `tipoParceiro`. Uma administradora é um parceiro que não tem membros diretos, mas gerencia parceiros do tipo CONDOMINIO.

---

## 5. Gaps de wizard a corrigir (imediato)

### Bug A — Step1 trava (1 caractere)
**Causa:** funções `Step1()` a `Step5()` e `Stepper()` definidas dentro do componente pai. A cada keystroke → re-render → React desmonta/remonta o step → input perde foco.
**Correção:** extrair as funções para fora do componente pai (componentes independentes com props).

### Bug B — Step2 não lista usinas
**Causa:** filtro `!u.cooperativaId` remove todas as usinas que já têm parceiro/operadora vinculada.
**Correção:** remover o filtro; exibir todas as usinas com capacidade disponível (% livre calculado).

### Novo Step — Membros (inserir entre Dados e Usina)
**Fluxo proposto:**
```
1. Dados do Parceiro
2. Membros ← NOVO
   - COOPERATIVA/ASSOCIACAO/CONSORCIO: buscar cooperados existentes por CPF/nome OU cadastrar novo
   - CONDOMINIO: cadastrar unidades (nº unidade + condômino opcional)
3. Usina (todas as usinas + % disponível por usina)
4. Espera
5. Plano SaaS
6. Cobrança
```

---

## 6. Prioridades de execução

### 🔴 Imediato (pode fazer agora, sem migração de banco)
1. Corrigir Bug A — extrair Steps para componentes externos
2. Corrigir Bug B — remover filtro de usinas; mostrar todas com % livre
3. Adicionar Step de Membros no wizard

### 🟠 Próximo sprint (requer migração de schema)
4. Adicionar campos de condomínio em `Cooperativa` (Gap 3)
5. Vincular `UnidadeCondominio` a `Cooperativa` em vez de `Condominio`
6. Adicionar `tipoParceiro = ADMINISTRADORA`
7. Criar cooperado representante automático para UC do parceiro (Gap 2)

### 🟡 Médio prazo (refatoração mais profunda)
8. Separar `operadoraId` de `cooperativaId` na Usina (Gap 1 — Solução B)
9. Deprecar tabela `condominios` separada
10. Visão consolidada: membro em múltiplas usinas

---

## 7. Resumo executivo

O modelo atual **suporta** a visão de negócio em 70% — parceiros, membros, usinas compartilhadas e planos em cascata já existem. Os problemas principais são:

1. **Usina não é multi-parceiro "limpo"** — tem um `cooperativaId` que confunde operadora com parceiro consumidor
2. **Parceiro não tem UC própria** diretamente — workaround via cooperado PJ é aceitável
3. **Condomínio existe em tabela separada** — causa duplicidade e confusão na tela
4. **Wizard com bugs** que impedem o cadastro (Step1 trava, Step2 vazio)
5. **Falta step de membros** — parceiro nasce sem nenhum membro associado

Nenhum desses problemas é bloqueante para o modelo de negócio funcionar hoje, mas os bugs do wizard (1 e 2) precisam ser corrigidos antes de qualquer teste real.
