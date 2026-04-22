# Investigação — 5 lacunas antigas (23/04/2026)

## B.1 — Wizard admin desconectado do Motor de Proposta

**Estado: RESOLVIDO**

- Step3Simulacao.tsx:146 chama `/motor-proposta/calcular` com payload completo
- Step4Proposta.tsx:105 chama `/motor-proposta/aceitar` com `planoId` + `resultado`
- Motor cria PropostaCooperado + Contrato com snapshots (Sprint 5 T3)
- Wizard flui: Fatura → Dados → Simulação → Aceite → Documentos → Assinatura → Alocação

**Impacto:** nenhum.

## B.2 — Vínculo GeracaoMensal ↔ Cobrança

**Estado: ABERTO**

- Campo `Cobranca.geracaoMensalId` existe no schema mas **nunca é preenchido** nos 2 pontos de criação de cobrança (`faturas.service.ts:560` e `faturas.service.ts:939`).
- Nem `cobrancas.service.ts:create()` recebe `geracaoMensalId`.
- Das 30 cobranças no banco, nenhuma tem `geracaoMensalId` preenchido.
- Das 15 GeracaoMensal, nenhuma está vinculada a cobrança.

**Impacto:** importante. Cobrança gerada não referencia a geração real da usina. Relatórios de conferência kWh ficam incompletos.

**Proposta:** fix médio — quando gerar cobrança via pipeline fatura, buscar GeracaoMensal da usina daquele mês e preencher o campo. Sprint 9.

## B.3 — FaturaProcessada desconectada da Cobrança

**Estado: RESOLVIDO**

- `faturas.service.ts:574` preenche `faturaProcessadaId: faturaId` no pipeline individual
- `faturas.service.ts:953` preenche `faturaProcessadaId: fatura.id` no pipeline em lote
- Ambos os caminhos de geração de cobrança via fatura vinculam corretamente.
- Cobrança criada manualmente (via `cobrancas.service.ts:create`) não tem `faturaProcessadaId` — intencional (admin criando sem fatura OCR).

**Impacto:** nenhum.

## B.4 — Frontend só mostra cobranças do 1º contrato

**Estado: RESOLVIDO**

- `cooperados.service.ts:122` busca cobranças com `contrato: { cooperadoId }` — filtra por cooperado, não por contrato específico.
- Aceita filtro opcional `ucId` pra cooperado escolher qual UC ver.
- Portal `financeiro/page.tsx:77` chama `/cooperados/meu-perfil/cobrancas` sem filtro de contrato — retorna todas.
- Cooperado com múltiplos contratos vê cobranças de todos.

**Impacto:** nenhum.

## B.5 — Sem verificação de dependências ao deletar

**Estado: RESOLVIDO (parcial)**

- `cooperados.service.ts:824` (`remove`): verifica contratos ativos + cobranças pendentes antes de deletar. Bloqueia com BadRequestException.
- `usinas.service.ts:248` (`remove`): verifica contratos ativos/pendentes. Bloqueia.
- `cooperativas.service.ts:230` (`remove`): **NÃO verifica dependências**. Deleta direto, banco bloqueia por FK constraint.

**Impacto:** menor. O banco protege via FK, mas a mensagem de erro é críptica (Prisma P2003 em vez de mensagem amigável).

**Proposta:** fix trivial — adicionar check de cooperados/usinas/contratos antes de deletar cooperativa, com mensagem clara. Sprint 9.
