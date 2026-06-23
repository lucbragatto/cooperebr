# Investigação — Funil de Captação (Roteador M48): estado real × escopo do teste

> **Data:** 2026-06-23 · **Autor:** orquestrador (read-only) · **Gatilho:** Luciano pediu pra
> testar "a função de cadastro de alguém que tem créditos injetados, como forma de captar clientes",
> com uma fatura GD real do repositório. Depois perguntou (corretamente): *"você testou o OCR na
> fatura real? Na rota real do wizard de cadastro?"* — este doc responde com precisão e preserva o
> material pra retomar.

---

## 1. O que é o funil de captação (Roteador M48)

`RoteamentoCadastroService.decidirCaminho()` (`backend/src/roteamento-cadastro/roteamento-cadastro.service.ts:171`)
classifica quem cadastra em **4 caminhos**, cruzando autodeclaração + fornecedor × parceiros SISGD:

| Caminho | Quando | Significado comercial |
|---|---|---|
| **A_MIGRACAO** | Recebe GD, fornecedor NÃO bate com parceiro SISGD | **Lead de captação** — concorrente fora da plataforma → migrar (M47) |
| **B_REDIRECT_PARCEIRO** | Fornecedor bate com alias/CNPJ de OUTRO parceiro SISGD | Anti-canibalização — não roubar cliente de parceiro nosso |
| **C_NOVO** | Não recebe GD, OU já é cliente do mesmo tenant | Cadastro normal |
| **AMBIGUO_ADMIN** | Recebe GD mas não declarou de quem | Admin investiga |

---

## 2. O que ESTÁ ligado (wired) na produção

O roteador **está integrado nas duas rotas reais de cadastro** — não é código morto:

- **Rota pública** `POST /publico/cadastro-web` → `publico.controller.ts:308` chama `decidirCaminho`,
  resultado gravado nos 4 campos do Cooperado via `cadastroWebV2` (`:1105-1108`).
- **Rota admin** (wizard) `POST /cooperados` → `cooperados.controller.ts:213` chama `decidirCaminho`,
  grava `roteamentoCaminho`/`roteamentoTenantAlvo`/`roteamentoRazao`/`roteamentoDecididoEm` (`:223-226`).

**Natureza:** ADVISORY (decisão Q1 orquestrador 22/06). O roteador **decide e registra**, mas **NÃO
bloqueia / migra / redireciona** — isso é enforcement das Camadas 2/3 (não construídas).

---

## 3. O que NÃO está ligado (os buracos reais)

### 3.1 OCR → roteador: HOOK DEFERIDO (confirmado por leitura direta)
- As duas rotas passam pro `decidirCaminho` **APENAS** `jaRecebeCreditosGd` + `fornecedorGdAtual`
  (autodeclaração do formulário). **NENHUMA passa `classificacaoScee`** (verificado:
  `publico.controller.ts:309-311` e `cooperados.controller.ts:214-216`).
- O `decidirCaminho` **aceita** `classificacaoScee` como param opcional (`service.ts:65`), mas o
  comentário do próprio service marca: *"DEFERIDO até hook OCR+Concierge integrar"* (`service.ts:10`).
- O pipeline de OCR **SABE** classificar SCEE: os adapters `concierge/fatura-canonica/edp-es.adapter.ts:270`
  e `elfsm.adapter.ts:148` computam `classificacaoScee` (GD_I/GD_II/GD_III/NAO_GD) das rubricas da fatura.
  **Mas esse sinal NÃO é entregue ao roteador no fluxo de cadastro.** Os dois mundos (OCR e funil) estão
  desconectados.
- **Consequência:** hoje a pessoa **declara manualmente** "recebo créditos GD" + digita o fornecedor.
  A fatura (PDF) NÃO preenche isso sozinha. O "auto-detectar pela fatura" é trabalho futuro.

### 3.2 Vitrines (Camadas 2/3): NÃO construídas
O cérebro decide, mas não existe a tela que **age** na decisão (puxar o lead A, redirecionar o B,
fazer o pitch de migração). Desbloqueadas pelo M51; esperam spec do orquestrador.

---

## 4. O teste do orquestrador (23/06) — escopo HONESTO

Rodei a **função real** (`decidirCaminho`, compilada no `dist/`) contra o **banco real**, com a pessoa
da fatura GD `backend/test/fixtures/faturas/edp-luciano-gd.pdf` (Luciano, recebe 1.832,7441 kWh/mês,
saldo 5.442 kWh, participação 0,150% num rateio GD).

**Resultado: 5 de 5 cenários classificados corretamente:**

| Cenário | Input | Caminho |
|---|---|---|
| 1 | recebe GD, fornecedor "CoopereBR", tenant=CoopereBR | C_NOVO (já é cliente) ✅ |
| 2 | recebe GD, fornecedor "CoopereBR", tenant=Teste | B_REDIRECT (→ CoopereBR) ✅ |
| 3 | recebe GD, fornecedor "Soluna Energia Solar" (concorrente) | **A_MIGRACAO (captação)** ✅ |
| 4 | recebe GD, sem fornecedor | AMBIGUO_ADMIN ✅ |
| 5 | NÃO recebe GD | C_NOVO (lead novo) ✅ |

### ⚠️ O QUE O TESTE **NÃO** FEZ (resposta às perguntas do Luciano)
1. **NÃO rodou o OCR na fatura.** Eu li o PDF com meus próprios olhos pra confirmar a compensação; o
   OCR/Concierge do sistema **nunca tocou** o arquivo. (E mesmo se rodasse, não há fio ligando o
   resultado ao roteador — ver §3.1.)
2. **NÃO passou pela rota HTTP real do wizard.** Chamei o service **em isolamento** (script standalone
   `node`), pulando o controller, a validação de DTO, a resolução de tenant e a persistência dos 4
   campos. Testei o **cérebro**, não o **fluxo ponta-a-ponta**.

**Tradução:** provei que a *lógica de decisão* está correta. NÃO provei (a) o OCR lendo a fatura,
(b) a rota viva controller→cadastro→persistência, (c) o elo OCR→roteador (que não existe).

---

## 5. Próximos passos pra fechar o ponta-a-ponta

1. **Smoke E2E real do funil** — `POST /publico/cadastro-web?tenant=<slug>` com payload declarando GD +
   fornecedor concorrente → confirmar no banco que o Cooperado nasce com `roteamentoCaminho=A_MIGRACAO`.
   *(Cria dado de teste → usar contatos whitelist `27981341348` + `lucbragatto+...@gmail.com`; limpar depois.)*
2. **Hook OCR→roteador** — fazer o Concierge classificar a fatura no upload e alimentar `classificacaoScee`
   no `decidirCaminho` (auto-detectar GD sem depender da autodeclaração). Sprint própria.
3. **Vitrines Camadas 2/3** — a UI que transforma a decisão em ação comercial (o "captar" de verdade).

---

## 6. Mapa de arquivos (pra retomar)
- Motor: `backend/src/roteamento-cadastro/roteamento-cadastro.service.ts` (`decidirCaminho:171`)
- Specs unitárias: `roteamento-cadastro.service.spec.ts` (cobre os 4 caminhos)
- Chamada pública: `backend/src/publico/publico.controller.ts:308` (+ grava `:1105`)
- Chamada admin: `backend/src/cooperados/cooperados.controller.ts:213` (+ grava `:223`)
- OCR que classifica SCEE (desconectado do funil): `concierge/fatura-canonica/edp-es.adapter.ts:270`
- Fatura GD usada: `backend/test/fixtures/faturas/edp-luciano-gd.pdf`
- Check-in de integração token/clube relacionado: `docs/relatorios/checkin-integracao-token-clube-2026-06-22.md`
