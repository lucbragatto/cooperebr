# Validação Sprint 15 + 21 — Estado dos 3 papéis de Condomínio

**Data:** 01/05/2026
**Modo:** read-only.
**Insumo pra:** Luciano colar em claude.ai (limite 100 anexos atingido).
**Aplica regra de validação prévia + retomada** (memória `regra_validacao_previa_e_retomada.md`).

---

## Definição original Sprint 15

**Encontrada em:** `docs/MAPA-INTEGRIDADE-SISTEMA.md:822` — uma única linha:

> **Sprint 15: Cadastro Condomínio atomizado**

**Sem detalhamento** em outros docs. Não há sessão dedicada, sem entrada no `historico/COOPEREBR-ALINHAMENTO`, sem spec específico em `docs/specs/`. Escopo planejado **inferido**:

- Fluxo guiado de cadastro: síndico → condomínio → unidades → vincular condôminos → cobrança rateada
- Schema `Condominio` + `UnidadeCondominio` (já existem) usados de forma orquestrada
- Tela dedicada de cadastro atomizado (em uma jornada única)

**Sem contradições entre fontes** — porque há apenas uma fonte (1 linha).

---

## Definição original Sprint 21

**Encontrada em:** `docs/MAPA-INTEGRIDADE-SISTEMA.md:828` — uma única linha:

> **Sprint 21: Painel Síndico detalhado**

Mesmo problema do Sprint 15 — **sem detalhamento**. Escopo inferido:

- Continuação do Sprint 15 — após condomínio cadastrado, síndico tem painel próprio
- Visão consolidada (consumo unidades, áreas comuns, cobrança rateada, repasse)
- Login dedicado de síndico (perfil próprio?)

**Sem contradições** — única fonte, 1 linha.

---

## Estado atual no sistema (banco real, snapshot 01/05)

### Papel 1 — Condomínio como **Parceiro** (entidade dona do sistema, tipo ANEEL)

- `Cooperativa.tipoParceiro = CONDOMINIO`: **0 cooperativas** no banco (só `COOPERATIVA = 2`).
- Schema **suporta** (enum `TipoParceiro` inclui CONDOMINIO).
- 0 implementação de fluxo dedicado pra parceiro tipo CONDOMINIO.

**Veredito:** 🔴 **suportado em schema, 0 uso real**.

### Papel 2 — Condomínio como **Membro** (entidade `Condominio` vinculada a Parceiro)

- Schema `Condominio` existe: `cooperativaId`, `cnpj`, `endereco`, `administradoraId`, **`sindicoNome/sindicoCpf/sindicoEmail/sindicoTelefone`** (campos do síndico INLINE, não FK), `modeloRateio`, `excedentePolitica`, `excedentePixChave`, `taxaAdministrativa`. **Sem relação direta com `Cooperado`** — é uma entidade independente.
- `UnidadeCondominio`: `condominioId` + `numero` + `cooperadoId?` (FK opcional pra Cooperado) + `fracaoIdeal` + `percentualFixo`.
- **Banco:** 1 Condomínio + 10 UnidadeCondominio (Residencial Solar das Palmeiras, vinculado à CoopereBR — `cooperativaId=cmn0ho8bx0000uox8wu96u6fd`).
- **18 Cooperados PJ** existem no banco — entre eles **4 que parecem condomínios** por nome:
  - CONDOMINIO DO EDIFICIO CHURCHILL S
  - CONDOMINIO DO EDIFICIO COSTA DO ATLANTICO
  - CONDOMINIO DO EDIFICIO ISLA BONITA
  - CONDOMINIO DO EDIFICIO JUAN LES PINS
- **Mas NÃO estão como Condominio do schema** — estão apenas como Cooperado PJ (sem entrada em `Condominio`).
- **Cobranças PAGAS de cooperados PJ:** **0** (confirma que pipeline manual cobrou só PF até agora).
- Tela `/dashboard/condominios/{,novo,[id]}` existe (3 telas em `web/app/dashboard/condominios/`).

**Veredito:** 🟡 **schema completo, 1 uso real (Solar das Palmeiras), 4 condomínios paralelos como Cooperado PJ (sem usar schema dedicado)**.

### Papel 3 — Condomínio como **Convênio** (síndico envia convites, cada apto vira cooperado)

- Schema `ContratoConvenio` tem `tipo: TipoConvenio` (enum inclui **CONDOMINIO**, ASSOCIACAO, SINDICATO, EMPRESA, CLUBE, OUTRO).
- Faixas progressivas de desconto por # de membros (`HistoricoFaixaConvenio`, `convenios-progressao.service.ts`).
- **Banco:** 2 ContratoConvenio + 215 ConvenioCooperado (vínculos):
  - `CV-HANGAR-1776949098321` — **165 membros** (Hangar Academia — comercial, não condomínio)
  - `CV-MORADAS-1776949184175` — **50 membros** (Moradas da Enseada — **caso real do condomínio Moradas como CONVÊNIO**)

**Confirmação importante:** Moradas da Enseada está implementado **como Convênio**, NÃO como `Condominio` do schema. 50 cooperados captados via convênio (síndico envia link, cada morador se cadastra como Cooperado normal vinculado ao Convênio).

**Veredito:** 🟢 **funciona em produção real (50 vínculos Moradas + 165 Hangar)**.

### Síndico

- **Perfil dedicado SINDICO:** **NÃO existe.** Enum `PerfilUsuario` tem só `SUPER_ADMIN`, `ADMIN`, `OPERADOR`, `COOPERADO`, `AGREGADOR`.
- **Campos inline:** `Condominio.sindicoNome/Cpf/Email/Telefone` — dados do síndico ficam no Condominio, sem virar usuário com login.
- **Portal síndico:** **0 telas em `web/app/portal/`** (não existe `/portal/sindico/`).
- **1 Administradora** cadastrada no banco — Patrícia (papel 10 do PRODUTO.md). Sem fluxo operacional.

**Veredito:** 🔴 **schema parcial (campos inline), 0 portal, 0 perfil dedicado**.

---

## Modelo descrito por Luciano confere?

**Sim, parcialmente.** Os 3 papéis EXISTEM tecnicamente, mas com **graus diferentes de maturidade** e **preferência clara pela rota Convênio**:

| Papel descrito por Luciano | Existe no schema? | Usado em produção? |
|---|---|---|
| Parceiro (tem usina, gerencia créditos) | ✅ enum `CONDOMINIO` em `tipoParceiro` | ❌ 0 cooperativas tipo CONDOMINIO |
| Membro (assina como Cooperado, ex Moradas na CoopereBR) | ✅ schema dedicado `Condominio` + `UnidadeCondominio` | 🟡 1 caso (Solar das Palmeiras), Moradas NÃO usa esse schema |
| Convênio (síndico envia convites, aptos viram cooperados diretos) | ✅ `ContratoConvenio.tipo=CONDOMINIO` | 🟢 1 caso real (Moradas da Enseada com 50 membros) |

**Achado importante:** Moradas da Enseada — o caso real que Luciano usa como exemplo — está implementado como **Convênio (Papel 3)**, não como **Condominio do schema (Papel 2)**. Isso significa que **a rota preferida na prática é a 3**, e o schema `Condominio` está subutilizado.

---

## Lacuna real Sprint 15 (Cadastro Condomínio atomizado)

Se Sprint 15 = "fluxo guiado pra cadastrar Condomínio + unidades + condôminos como Membro (Papel 2)":

- 🔴 Falta: fluxo guiado de criação atômica (hoje precisa criar Condominio → adicionar unidades 1 a 1 → vincular cooperados separadamente).
- 🔴 Falta: importação CSV/Excel da lista de unidades.
- 🔴 Falta: associação automática de UnidadeCondominio com Cooperado pré-existente ou criação atomizada.
- 🟡 Schema completo, mas Moradas (caso real) **não usa esse caminho**.

**Pergunta de produto:** vale investir em Sprint 15 (Papel 2) se Moradas escolheu Papel 3 (Convênio)? Talvez o caminho a fortalecer seja **Convênio com tipo CONDOMINIO**, não fluxo dedicado.

---

## Lacuna real Sprint 21 (Painel Síndico detalhado)

Se Sprint 21 = "portal próprio de síndico com visão consolidada do condomínio":

- 🔴 Falta: perfil `SINDICO` no enum `PerfilUsuario`.
- 🔴 Falta: rota `/portal/sindico/` completa.
- 🔴 Falta: vincular dados do `Condominio.sindicoNome/Cpf/Email/Telefone` a um `Usuario` com login.
- 🔴 Falta: painel consolidado (consumo unidades, áreas comuns, cobrança rateada, repasse).

**Bloqueio:** Sprint 21 depende de Sprint 15. Se 15 não acontece (porque Convênio resolve), 21 não tem o que mostrar (Convênio não tem síndico — tem Conveniado, que é outro papel).

**Alternativa Code:** "Painel Conveniado" (já planejado em `PLANO-CONVENIOS-2026-04-01.md` Seção 5.2 — `/portal/convenio/`) seria o equivalente prático, com Helena entrando como **Conveniado do convênio CV-MORADAS**, não como Síndico.

---

## Recomendação Code

### Sprint 15 (Cadastro Condomínio atomizado): **DESCARTAR ou ADIAR**

**Justificativa:**
- Caso real (Moradas) **não usou** esse caminho — escolheu Convênio.
- Schema `Condominio` está vivo mas subutilizado (1 registro de teste em 311 cooperados).
- Risco de investir em fluxo que ninguém usar.

**Sugestão:** **descartar Sprint 15 da pilha pré-produção**. Reabrir como sugestão pendente em `sugestoes_pendentes.md` ("Cadastro Condomínio atomizado — esperar 2º caso real além de Solar das Palmeiras"). Se mais condomínios reais escolherem Papel 2, reavaliar.

### Sprint 21 (Painel Síndico): **DESCARTAR**

**Justificativa:**
- Depende de Sprint 15 (que recomendamos descartar).
- Equivalente funcional já existe planejado (Portal Conveniado em PLANO-CONVENIOS, parte do Sprint 17 novo Banco de Documentos / Assinafy ou novo sprint independente).
- Helena (síndica do Moradas) na prática vira **Conveniado do CV-MORADAS**, não usa portal de síndico.

**Sugestão:** **descartar Sprint 21**. Atender Helena via Portal Conveniado quando esse for implementado.

### Decisão alternativa (se Luciano discordar)

Se Luciano insistir em manter Sprint 15+21 (papel 2 estratégico mesmo sem caso real), recomenda Code **adiar pra depois de 2º cliente em produção** que use Papel 2. Hoje 0 condomínios em produção real (Solar das Palmeiras é teste).

---

## Síntese executiva (5 linhas pra Luciano colar)

1. Sprints 15+21 têm definição original **mínima** (1 linha cada em MAPA-INTEGRIDADE-SISTEMA.md).
2. Schema dos 3 papéis **existe** (Cooperativa.tipoParceiro=CONDOMINIO + Condominio + ContratoConvenio.tipo=CONDOMINIO). Síndico só inline em campos.
3. Caso real Moradas da Enseada (50 membros) usa **Papel 3 (Convênio)**, não Papel 2 (Condominio do schema).
4. Schema `Condominio` está subutilizado (1 registro de teste). 4 condomínios reais cadastrados como **Cooperado PJ** (sem usar schema dedicado).
5. **Recomendação Code:** descartar Sprint 15+21 da pilha pré-produção. Helena atendida via Portal Conveniado quando esse vier. Reavaliar Sprint 15 quando aparecer 2º cliente real Papel 2.

---

*Investigação read-only conduzida por Claude Code (Opus 4.7) em 2026-05-01.*
*Aplica regra de validação prévia + retomada.*
*Insumos: schema.prisma + queries banco real + MAPA-INTEGRIDADE-SISTEMA.md + PLANO-CONVENIOS-2026-04-01.md.*
